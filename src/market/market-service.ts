import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { marketCatalog, type MarketEntry } from './catalog.js'
import { AppError } from '../domain/errors.js'
import type { ControlService } from '../control/control-service.js'
import type { CredentialPayload } from '../domain/models.js'

export interface InstallJob {
  id: string
  entryId: string
  status: 'installing' | 'completed' | 'failed'
  step: string
  output: string
  result?: unknown
  error?: string
}

export class MarketService {
  readonly #service: ControlService;
  readonly #marketDir: string;
  readonly #uvEnv: Record<string, string>;
  readonly #jobs = new Map<string, InstallJob>();

  constructor(service: ControlService, marketDir: string, dataDir?: string) {
    this.#service = service;
    this.#marketDir = marketDir;
    const uvRoot = dataDir === undefined ? marketDir : join(dataDir, '.uv');
    this.#uvEnv = {
      UV_CACHE_DIR: join(uvRoot, 'cache'),
      UV_TOOL_DIR: join(uvRoot, 'tools'),
      UV_TOOL_BIN_DIR: join(uvRoot, 'tools', 'bin'),
      UV_COMPILE_BYTECODE: '0',
    };
  }

  list() {
    const servers = this.#service.listServers();
    return marketCatalog.map((entry) => ({
      ...entry,
      installed: servers.some((server) => server.slug === entry.id),
    }));
  }

  getJob(jobId: string): InstallJob {
    const job = this.#jobs.get(jobId);
    if (!job) throw new AppError('market_job_not_found', 'Install job not found', 404);
    return job;
  }

  async install(id: string, values: Record<string, string> = {}) {
    const entry = this.#entry(id);
    if (this.#service.listServers().some((server) => server.slug === entry.id)) {
      throw new AppError('market_installed', `Market entry "${id}" is already installed`, 409);
    }
    for (const requirement of entry.requires) {
      if (requirement.required && !values[requirement.name]) {
        throw new AppError(
          'market_missing_value',
          `Missing required value ${requirement.name}`,
          400,
        );
      }
    }
    const job: InstallJob = {
      id: randomUUID(),
      entryId: entry.id,
      status: 'installing',
      step: 'starting',
      output: '',
    };
    this.#jobs.set(job.id, job);
    void this.#runInstall(entry, values, job);
    return { jobId: job.id, status: 'installing' };
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
  }

  #update(job: InstallJob, patch: Partial<InstallJob>) {
    Object.assign(job, patch);
  }

  async #runInstall(entry: MarketEntry, values: Record<string, string>, job: InstallJob) {
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
      this.#update(job, { status: 'completed', step: 'done', result });
    } catch (error) {
      this.#update(job, {
        status: 'failed',
        step: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
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

  #uvxInstall(entry: MarketEntry, job: InstallJob): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#update(job, { step: `uv tool install ${entry.package ?? entry.id}` });
      const child = spawn(
        'uv',
        ['tool', 'install', entry.package ?? entry.id],
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

  #npmInstall(entry: MarketEntry, job: InstallJob): Promise<void> {
    return new Promise((resolve, reject) => {
      mkdirSync(this.#marketDir, { recursive: true });
      this.#update(job, { step: `npm install ${entry.package ?? entry.id}` });
      const child = spawn(
        'npm',
        [
          'install',
          '--prefix',
          this.#marketDir,
          '--no-audit',
          '--no-fund',
          entry.package ?? entry.id,
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
