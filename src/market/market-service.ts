import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { marketCatalog, type MarketEntry } from './catalog.js'
import { AppError } from '../domain/errors.js'
import type { ControlService } from '../control/control-service.js'
import type { CredentialPayload, InstallJobRecord, MarketInstallation } from '../domain/models.js'
import type { Store } from '../storage/store.js'
import type { SecureActionService } from '../security/secure-action.js'
import { fingerprint } from '../upstream/stable-json.js'

export interface InstallJobView {
  id: string
  entryId: string
  status: InstallJobRecord['status']
  step: string
  output: string
  result?: unknown
  error?: string
  actionUrl?: string
}

interface LiveJob {
  record: InstallJobRecord
  output: string
  result?: unknown
  error?: string
}

export class MarketService {
  readonly #service: ControlService;
  readonly #store: Store;
  readonly #actions: SecureActionService;
  readonly #marketDir: string;
  readonly #uvEnv: Record<string, string>;
  readonly #jobs = new Map<string, LiveJob>();

  constructor(
    service: ControlService,
    store: Store,
    actions: SecureActionService,
    marketDir: string,
    dataDir?: string,
    uvIndexUrl?: string,
  ) {
    this.#service = service;
    this.#store = store;
    this.#actions = actions;
    this.#marketDir = marketDir;
    const uvRoot = dataDir === undefined ? marketDir : join(dataDir, '.uv');
    this.#uvEnv = {
      UV_CACHE_DIR: join(uvRoot, 'cache'),
      UV_TOOL_DIR: join(uvRoot, 'tools'),
      UV_TOOL_BIN_DIR: join(uvRoot, 'tools', 'bin'),
      UV_COMPILE_BYTECODE: '0',
      ...(uvIndexUrl === undefined ? {} : { UV_DEFAULT_INDEX: uvIndexUrl }),
    };
    // A fresh process never carries in-flight installs; surface them as
    // interrupted so they are visible and retryable instead of silently lost.
    this.#store.markInterruptedInstallJobs();
  }

  list() {
    const servers = this.#service.listServers();
    return marketCatalog.map((entry) => {
      const installation = this.#store.getInstallation(entry.id);
      return {
        ...entry,
        installed: servers.some((server) => server.slug === entry.id),
        installedVersion: installation?.entryVersion ?? null,
      };
    });
  }

  installations() {
    return this.#store.listInstallations();
  }

  getJob(jobId: string): InstallJobView {
    const live = this.#jobs.get(jobId);
    if (live) return this.#view(live);
    const record = this.#store.getInstallJob(jobId);
    if (!record) throw new AppError('market_job_not_found', 'Install job not found', 404);
    return {
      id: record.id,
      entryId: record.entryId,
      status: record.status,
      step: record.step,
      output: record.boundedOutput,
      error: record.errorCode ?? undefined,
    };
  }

  async install(
    id: string,
    values: Record<string, string> = {},
    principalId = 'cli',
  ): Promise<{
    jobId: string | null;
    status: string;
    actionId?: string;
    actionUrl?: string;
    installed?: unknown;
  }> {
    const entry = this.#entry(id);
    const existing = this.#store.getInstallation(entry.id);
    if (existing) {
      const server = this.#service.getServer(existing.serverId);
      return {
        jobId: null,
        status: 'already_installed',
        installed: server
          ? { entryId: entry.id, version: existing.entryVersion, serverId: server.id, slug: server.slug }
          : { entryId: entry.id, version: existing.entryVersion },
      };
    }
    for (const requirement of entry.requires) {
      if (requirement.required && !requirement.secret && !values[requirement.name]) {
        throw new AppError(
          'market_missing_value',
          `Missing required value ${requirement.name}`,
          400,
        );
      }
    }
    const missingSecrets = entry.requires.filter(
      (requirement) => requirement.required && requirement.secret && !values[requirement.name],
    );
    const requestedVersion = entry.version ?? null;

    if (missingSecrets.length > 0) {
      // URL-mode elicitation: never accept the secret through tool arguments.
      const job = this.#createJob(entry, requestedVersion, 'awaiting_secret');
      const { action, url } = this.#actions.create('market_install', job.record.id, principalId);
      this.#updateRecord(job, { actionId: action.id });
      return {
        jobId: job.record.id,
        status: 'awaiting_secret',
        actionId: action.id,
        actionUrl: url,
      };
    }

    const job = this.#createJob(entry, requestedVersion, 'installing');
    this.#update(job, { step: 'starting' });
    void this.#runInstall(entry, values, job);
    return { jobId: job.record.id, status: 'installing' };
  }

  /** Completes a URL-mode secret action and resumes the linked install job. */
  async completeAction(
    actionId: string,
    token: string,
    principalId: string,
    values: Record<string, string>,
  ): Promise<InstallJobView> {
    const action = this.#actions.complete(actionId, token, principalId, values);
    const jobId = action.target;
    const live = this.#jobs.get(jobId);
    if (live && live.record.status === 'awaiting_secret') {
      const entry = this.#entry(live.record.entryId);
      this.#update(live, { step: 'starting' });
      void this.#runInstall(entry, values, live);
      return this.#view(live);
    }
    const record = this.#store.getInstallJob(jobId);
    if (!record || record.status !== 'awaiting_secret') {
      throw new AppError('market_job_not_found', 'Install job not found or not awaiting a secret', 404);
    }
    return this.getJob(jobId);
  }

  /** Reads a pending action's required secret fields for the bound principal (web form). */
  secureActionInfo(actionId: string, principalId: string) {
    const action = this.#store.getSecureAction(actionId);
    if (!action) throw new AppError('secure_action_not_found', 'Secure action not found', 404);
    if (action.principalId !== principalId) {
      throw new AppError('forbidden', 'Secure action belongs to another principal', 403);
    }
    const job = this.#store.getInstallJob(action.target);
    const entry = job ? marketCatalog.find((item) => item.id === job.entryId) : undefined;
    return {
      actionId: action.id,
      status: action.status,
      entryId: entry?.id ?? null,
      entryName: entry?.name ?? null,
      fields: (entry?.requires ?? [])
        .filter((requirement) => requirement.secret)
        .map((requirement) => ({
          name: requirement.name,
          description: requirement.description,
        })),
    };
  }

  async uninstall(id: string) {
    const entry = this.#entry(id);
    const servers = this.#service.listServers().filter((server) => server.slug === entry.id);
    if (servers.length === 0) {
      throw new AppError('market_not_installed', `Market entry "${id}" is not installed`, 404);
    }
    for (const server of servers) {
      if (server.credentialId) this.#service.deleteCredential(server.credentialId);
      this.#service.deleteServer(server.id);
    }
    for (const installation of this.#store.listInstallations().filter((item) => item.entryId === entry.id)) {
      this.#store.deleteInstallation(installation.id);
    }
  }

  // ── internals ───────────────────────────────────────────────────────────

  #createJob(entry: MarketEntry, requestedVersion: string | null, status: InstallJobRecord['status']): LiveJob {
    const record = this.#store.createInstallJob({
      entryId: entry.id,
      requestedVersion,
      idempotencyKey: `${entry.id}:${requestedVersion ?? 'latest'}`,
      status,
      step: status,
      boundedOutput: '',
      resultReference: null,
      actionId: null,
      errorCode: null,
    });
    const live: LiveJob = { record, output: '' };
    this.#jobs.set(record.id, live);
    return live;
  }

  #view(live: LiveJob): InstallJobView {
    return {
      id: live.record.id,
      entryId: live.record.entryId,
      status: live.record.status,
      step: live.record.step,
      output: live.output || live.record.boundedOutput,
      ...(live.result === undefined ? {} : { result: live.result }),
      ...(live.error === undefined ? {} : { error: live.error }),
    };
  }

  #update(job: LiveJob, patch: { step?: string; output?: string; result?: unknown; error?: string }) {
    if (patch.step !== undefined) {
      this.#updateRecord(job, { step: patch.step });
    }
    if (patch.output !== undefined) {
      job.output = patch.output;
      this.#updateRecord(job, { boundedOutput: patch.output });
    }
    if (patch.result !== undefined) job.result = patch.result;
    if (patch.error !== undefined) job.error = patch.error;
  }

  #updateRecord(job: LiveJob, patch: Partial<InstallJobRecord>) {
    job.record = this.#store.updateInstallJob(job.record.id, patch);
  }

  async #runInstall(entry: MarketEntry, values: Record<string, string>, job: LiveJob) {
    try {
      if (entry.kind === 'home-stdio') {
        await this.#npmInstall(entry, job);
      } else if (entry.kind === 'uvx') {
        await this.#uvxInstall(entry, job);
      }
      this.#update(job, { step: 'creating credential' });
      const credential = this.#service.createCredential({
        name: entry.name,
        payload: this.#credentialPayload(entry, values),
      });
      this.#update(job, { step: 'creating server' });
      let result: unknown;
      if (entry.kind === 'home-stdio') {
        const args = (entry.argsTemplate ?? []).map((argument) =>
          argument.replace(/\$\{([^}]+)\}/g, (_, key: string) => values[key] ?? ''),
        );
        result = {
          server: await this.#service.createServer({
            slug: entry.id,
            name: entry.name,
            kind: 'home',
            transport: { type: 'stdio', command: this.#binPath(entry), args },
            credentialId: credential.id,
            enabled: true,
          }),
          credential,
        };
      } else if (entry.kind === 'uvx') {
        const args = [
          entry.package ?? entry.id,
          ...(entry.argsTemplate ?? []).map((argument) =>
            argument.replace(/\$\{([^}]+)\}/g, (_, key: string) => values[key] ?? ''),
          ),
        ];
        result = {
          server: await this.#service.createServer({
            slug: entry.id,
            name: entry.name,
            kind: 'home',
            transport: {
              type: 'stdio',
              command: 'uvx',
              args,
              env: { ...this.#uvEnv },
            },
            credentialId: credential.id,
            enabled: true,
          }),
          credential,
        };
      } else {
        result = {
          server: await this.#service.createServer({
            slug: entry.id,
            name: entry.name,
            kind: 'remote',
            transport: { type: 'streamable-http', url: entry.url ?? '' },
            credentialId: credential.id,
            enabled: true,
          }),
          credential,
        };
      }
      const server = (result as { server: { id: string } }).server;
      const installation = this.#store.createInstallation({
        source: 'curated',
        entryId: entry.id,
        entryVersion: entry.version ?? 'unpinned',
        recipeRevision: fingerprint(entry),
        serverId: server.id,
        credentialId: credential.id,
      });
      this.#update(job, { step: 'done', result: { ...(result as object), installation } });
      this.#updateRecord(job, { status: 'completed', resultReference: installation.id });
    } catch (error) {
      try {
        this.#update(job, {
          step: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        this.#updateRecord(job, {
          status: 'failed',
          errorCode: error instanceof AppError ? error.code : 'market_install_failed',
        });
      } catch {
        // The runtime may have been torn down mid-install; nothing to persist.
      }
    }
  }

  #entry(id: string): MarketEntry {
    const entry = marketCatalog.find((item) => item.id === id);
    if (!entry) throw new AppError('market_not_found', `Market entry "${id}" not found`, 404);
    return entry;
  }

  #binPath(entry: MarketEntry): string {
    return join(this.#marketDir, 'node_modules', '.bin', entry.bin ?? entry.id);
  }

  #pinnedPackage(entry: MarketEntry, kind: 'npm' | 'uvx'): string {
    const base = entry.package ?? entry.id;
    if (!entry.version) return base;
    return kind === 'uvx' ? `${base}==${entry.version}` : `${base}@${entry.version}`;
  }

  #credentialPayload(entry: MarketEntry, values: Record<string, string>): CredentialPayload {
    switch (entry.credential.type) {
      case 'oauth':
        return { type: 'oauth', tokenType: 'Bearer' };
      case 'env':
        return { type: 'env', variables: values };
      case 'bearer':
        return { type: 'bearer', token: values[entry.credential.tokenKey] ?? '' };
      case 'api-key':
        return {
          type: 'api-key',
          headerName: entry.credential.headerName,
          value: values[entry.credential.valueKey] ?? '',
        };
      case 'headers':
        return {
          type: 'headers',
          headers: Object.fromEntries(
            entry.credential.headers.map((header) => [
              header.name,
              header.valueKey ? values[header.valueKey] ?? '' : header.value ?? '',
            ]),
          ),
        };
    }
  }

  #uvxInstall(entry: MarketEntry, job: LiveJob): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#update(job, { step: `uv tool install ${this.#pinnedPackage(entry, 'uvx')}` });
      const args = ['tool', 'install', this.#pinnedPackage(entry, 'uvx')];
      for (const dependency of entry.uvWith ?? []) args.push('--with', dependency);
      const child = spawn(
        'uv',
        args,
        { env: { ...process.env, ...this.#uvEnv }, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let output = '';
      const append = (chunk: string) => {
        output = `${output}${chunk}`.slice(-4000);
        this.#update(job, { output });
      };
      child.stdout.on('data', (chunk) => append(String(chunk)));
      child.stderr.on('data', (chunk) => append(String(chunk)));
      const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          this.#update(job, { output });
          reject(
            new AppError(
              'market_install_failed',
              `uv tool install failed (${code}): ${output.slice(-400)}`,
              500,
            ),
          );
        }
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(new AppError('market_install_failed', `Failed to run uv: ${error.message}`, 500));
      });
    });
  }

  #npmInstall(entry: MarketEntry, job: LiveJob): Promise<void> {
    return new Promise((resolve, reject) => {
      mkdirSync(this.#marketDir, { recursive: true });
      this.#update(job, { step: `npm install ${this.#pinnedPackage(entry, 'npm')}` });
      const child = spawn(
        'npm',
        [
          'install',
          '--prefix',
          this.#marketDir,
          '--no-audit',
          '--no-fund',
          this.#pinnedPackage(entry, 'npm'),
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let output = '';
      const append = (chunk: string) => {
        output = `${output}${chunk}`.slice(-4000);
        this.#update(job, { output });
      };
      child.stdout.on('data', (chunk) => append(String(chunk)));
      child.stderr.on('data', (chunk) => append(String(chunk)));
      const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          this.#update(job, { output });
          reject(
            new AppError(
              'market_install_failed',
              `npm install failed (${code}): ${output.slice(-400)}`,
              500,
            ),
          );
        }
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(new AppError('market_install_failed', `Failed to run npm: ${error.message}`, 500));
      });
    });
  }
}

export type { MarketInstallation }
