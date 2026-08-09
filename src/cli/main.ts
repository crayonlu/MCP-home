#!/usr/bin/env node
import { Command } from 'commander';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { ControlClient } from '../control/client.js';

const localConfigSchema = z.object({
  url: z.url().superRefine((value, context) => {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.username !== '' ||
      url.password !== ''
    ) {
      context.addIssue({
        code: 'custom',
        message: 'MCP Home URL must be an HTTP(S) origin',
      });
    }
  }),
  controlKey: z.string().min(1),
});

interface GlobalOptions {
  url?: string;
  key?: string;
  output: 'human' | 'json';
}

const program = new Command()
  .name('mcp-home')
  .description('Complete CLI for the MCP Home Control API')
  .version('0.1.0')
  .option('--url <url>', 'MCP Home base URL')
  .option('--key <key>', 'Control API key')
  .option('--output <format>', 'human or json', parseOutput, 'human');

const server = program.command('server').description('Manage MCP servers');
server.command('list').action(run((client) => client.request('GET', '/api/v1/servers')));
server
  .command('get <id>')
  .action(run((client, id: string) => client.request('GET', `/api/v1/servers/${id}`)));
server
  .command('add <file>')
  .description('Create from a JSON file or - for stdin')
  .action(run((client, file: string) => client.request('POST', '/api/v1/servers', readJson(file))));
server
  .command('update <id> <file>')
  .action(
    run((client, id: string, file: string) =>
      client.request('PATCH', `/api/v1/servers/${id}`, readJson(file)),
    ),
  );
server
  .command('delete <id>')
  .action(run((client, id: string) => client.request('DELETE', `/api/v1/servers/${id}`)));
for (const action of ['test', 'enable', 'disable', 'refresh', 'restart']) {
  server
    .command(`${action} <id>`)
    .action(run((client, id: string) => client.request('POST', `/api/v1/servers/${id}/${action}`)));
}
for (const view of ['capabilities', 'status', 'logs', 'endpoint']) {
  server
    .command(`${view} <id>`)
    .action(run((client, id: string) => client.request('GET', `/api/v1/servers/${id}/${view}`)));
}

const credential = program
  .command('credential')
  .description('Manage encrypted upstream credentials');
credential.command('list').action(run((client) => client.request('GET', '/api/v1/credentials')));
credential
  .command('get <id>')
  .action(run((client, id: string) => client.request('GET', `/api/v1/credentials/${id}`)));
credential
  .command('add <file>')
  .action(
    run((client, file: string) => client.request('POST', '/api/v1/credentials', readJson(file))),
  );
credential
  .command('update <id> <file>')
  .action(
    run((client, id: string, file: string) =>
      client.request('PATCH', `/api/v1/credentials/${id}`, readJson(file)),
    ),
  );
credential
  .command('delete <id>')
  .action(run((client, id: string) => client.request('DELETE', `/api/v1/credentials/${id}`)));
for (const action of ['test', 'revoke']) {
  credential
    .command(`${action} <id>`)
    .action(
      run((client, id: string) => client.request('POST', `/api/v1/credentials/${id}/${action}`)),
    );
}
credential
  .command('authorize <id>')
  .option('--server-id <id>', 'associated remote MCP server')
  .option('--force', 'force a new authorization grant')
  .action(
    run((client, id: string, command: Command) => {
      const options = command.opts<{ serverId?: string; force?: boolean }>();
      return client.request('POST', `/api/v1/credentials/${id}/authorize`, {
        ...(options.serverId === undefined ? {} : { serverId: options.serverId }),
        force: options.force ?? false,
      });
    }),
  );

mountKeyCommands(program, 'control-key', 'control-keys');
mountKeyCommands(program, 'access-key', 'access-keys');

program
  .command('capability <server-id>')
  .description('Show a server capability snapshot')
  .action(run((client, id: string) => client.request('GET', `/api/v1/servers/${id}/capabilities`)));

const config = program.command('config').description('Import and export configuration');
config
  .command('export [file]')
  .option('--include-secrets', 'include plaintext credential secrets for a restorable backup')
  .action(
    run(async (client, file: string | undefined, command: Command) => {
      const includeSecrets = command.opts<{ includeSecrets?: boolean }>().includeSecrets ?? false;
      if (includeSecrets && !file) {
        throw new Error('--include-secrets requires a destination file');
      }
      const value = await client.request(
        'GET',
        `/api/v1/config/export?includeSecrets=${includeSecrets ? 'true' : 'false'}`,
      );
      if (file) {
        const destination = resolve(file);
        writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
        chmodSync(destination, 0o600);
        return { written: destination, secretsIncluded: includeSecrets };
      }
      return value;
    }),
  );
config
  .command('import <file>')
  .action(
    run((client, file: string) => client.request('POST', '/api/v1/config/import', readJson(file))),
  );

const endpoint = program.command('endpoint').description('Print standard MCP endpoints');
endpoint
  .command('aggregate')
  .action(run((client) => client.request('GET', '/api/v1/endpoints/aggregate')));
endpoint
  .command('server <id>')
  .action(run((client, id: string) => client.request('GET', `/api/v1/servers/${id}/endpoint`)));

program.command('status').action(run((client) => client.request('GET', '/api/v1/overview')));
program.command('doctor').action(run((client) => client.request('GET', '/api/v1/diagnostics')));
program
  .command('events')
  .option('--limit <count>', 'maximum records', '100')
  .action(
    run((client, command: Command) =>
      client.request('GET', `/api/v1/events?limit=${encodeURIComponent(command.opts().limit)}`),
    ),
  );

program
  .command('api <method> <path>')
  .description('Call any Control API operation')
  .option('--body <file>', 'JSON body file or - for stdin')
  .action(
    run((client, method: string, path: string, command: Command) =>
      client.request(
        method.toUpperCase(),
        path,
        command.opts().body ? readJson(command.opts().body) : undefined,
      ),
    ),
  );

const auth = program.command('auth').description('Manage local CLI connection settings');
auth
  .command('login')
  .requiredOption('--url <url>')
  .requiredOption('--control-key <key>')
  .action((options: { url: string; controlKey: string }) => {
    const value = localConfigSchema.parse({ url: options.url, controlKey: options.controlKey });
    const path = configPath();
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
    process.stdout.write(`Saved ${path}\n`);
  });
auth.command('logout').action(() => {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, '{}\n', { mode: 0o600 });
  chmodSync(path, 0o600);
  process.stdout.write(`Cleared ${path}\n`);
});

await program.parseAsync(process.argv);

function mountKeyCommands(root: Command, name: string, path: string): void {
  const command = root.command(name);
  command.command('list').action(run((client) => client.request('GET', `/api/v1/${path}`)));
  command
    .command('create <name>')
    .action(
      run((client, keyName: string) =>
        client.request('POST', `/api/v1/${path}`, { name: keyName }),
      ),
    );
  command
    .command('revoke <id>')
    .action(run((client, id: string) => client.request('DELETE', `/api/v1/${path}/${id}`)));
}

function run<TArgs extends unknown[]>(
  action: (client: ControlClient, ...args: TArgs) => unknown | Promise<unknown>,
) {
  return async (...args: TArgs): Promise<void> => {
    try {
      const options = program.opts<GlobalOptions>();
      const connection = resolveConnection(options);
      const value = await action(
        new ControlClient(new URL(connection.url), connection.controlKey),
        ...args,
      );
      print(value, options.output);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  };
}

function resolveConnection(options: GlobalOptions): z.infer<typeof localConfigSchema> {
  const stored = loadLocalConfig();
  return localConfigSchema.parse({
    url: options.url ?? process.env.MCP_HOME_URL ?? stored?.url,
    controlKey: options.key ?? process.env.MCP_HOME_CONTROL_KEY ?? stored?.controlKey,
  });
}

function loadLocalConfig(): z.infer<typeof localConfigSchema> | null {
  try {
    return localConfigSchema.parse(JSON.parse(readFileSync(configPath(), 'utf8')));
  } catch {
    return null;
  }
}

function configPath(): string {
  return process.env.MCP_HOME_CONFIG ?? resolve(homedir(), '.config', 'mcp-home', 'config.json');
}

function readJson(path: string): unknown {
  const text = path === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(path), 'utf8');
  return JSON.parse(text);
}

function print(value: unknown, output: 'human' | 'json'): void {
  process.stdout.write(`${JSON.stringify(value, null, output === 'json' ? 0 : 2)}\n`);
}

function parseOutput(value: string): 'human' | 'json' {
  return z.enum(['human', 'json']).parse(value);
}
