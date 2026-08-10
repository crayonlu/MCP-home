import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { marketCatalog, type MarketEntry } from './catalog.js'
import { AppError } from '../domain/errors.js'
import type { ControlService } from '../control/control-service.js'
import type { CredentialPayload } from '../domain/models.js'

export class MarketService {
  readonly #service: ControlService;
  readonly #marketDir: string;

  constructor(service: ControlService, marketDir: string) {
    this.#service = service;
    this.#marketDir = marketDir;
  }

  list() {
    return marketCatalog.map((entry) => ({
      ...entry,
      installed: this.#isInstalled(entry),
    }));
  }

  async install(id: string, values: Record<string, string> = {}) {
    const entry = this.#entry(id);
    if (this.#isInstalled(entry)) {
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
    if (entry.kind === 'home-stdio') {
      await this.#npmInstall(entry);
      const credential = this.#service.createCredential({
        name: entry.name,
        payload: { type: 'env', variables: values },
      });
      const args = (entry.argsTemplate ?? []).map((argument) =>
        argument.replace(/\$\{([^}]+)\}/g, (_, key: string) => values[key] ?? ''),
      );
      const server = await this.#service.createServer({
        slug: entry.id,
        name: entry.name,
        kind: 'home',
        transport: {
          type: 'stdio',
          command: this.#binPath(entry),
          args,
        },
        credentialId: credential.id,
        enabled: true,
      });
      return { server, credential };
    }
    const credential = this.#service.createCredential({
      name: entry.name,
      payload: this.#credentialPayload(entry, values),
    });
    const server = await this.#service.createServer({
      slug: entry.id,
      name: entry.name,
      kind: 'remote',
      transport: { type: 'streamable-http', url: entry.url ?? '' },
      credentialId: credential.id,
      enabled: true,
    });
    return { server, credential };
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

  #entry(id: string): MarketEntry {
    const entry = marketCatalog.find((item) => item.id === id);
    if (!entry) throw new AppError('market_not_found', `Market entry "${id}" not found`, 404);
    return entry;
  }

  #isInstalled(entry: MarketEntry): boolean {
    if (entry.kind === 'remote') {
      return this.#service.listServers().some((server) => server.slug === entry.id);
    }
    return existsSync(this.#binPath(entry));
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

  #npmInstall(entry: MarketEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      mkdirSync(this.#marketDir, { recursive: true });
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
      child.stdout.on('data', (chunk) => {
        output += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        output += String(chunk);
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
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
