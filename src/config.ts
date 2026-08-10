import { chmodSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const publicUrlSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    context.addIssue({ code: 'custom', message: 'Public URL must use HTTP or HTTPS' });
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    context.addIssue({
      code: 'custom',
      message: 'Public URL must be an origin without a path, query, or fragment',
    });
  }
  if (url.username !== '' || url.password !== '') {
    context.addIssue({ code: 'custom', message: 'Public URL must not contain credentials' });
  }
});

const envSchema = z
  .object({
    MCP_HOME_HOST: z.string().default('127.0.0.1'),
    MCP_HOME_PORT: z.coerce.number().int().min(1).max(65_535).default(3344),
    MCP_HOME_PUBLIC_URL: publicUrlSchema.default('http://127.0.0.1:3344'),
    MCP_HOME_DATA_DIR: z.string().default('./data'),
    MCP_HOME_MASTER_KEY: z.string().min(32),
    MCP_HOME_BOOTSTRAP_CONTROL_KEY: z.string().min(32).optional(),
    MCP_HOME_ALLOWED_HOSTS: z.string().optional(),
    MCP_HOME_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    MCP_HOME_OAUTH_URL_CLIENT_ID: z.enum(['true', 'false']).default('true'),
  })
  .superRefine((value, context) => {
    if (value.MCP_HOME_BOOTSTRAP_CONTROL_KEY === value.MCP_HOME_MASTER_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['MCP_HOME_BOOTSTRAP_CONTROL_KEY'],
        message: 'Bootstrap Control Key must differ from the master key',
      });
    }
  });

export interface RuntimeConfig {
  host: string;
  port: number;
  publicUrl: URL;
  dataDir: string;
  databasePath: string;
  masterKey: string;
  bootstrapControlKey?: string;
  allowedHosts: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  oauthUrlClientId: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = envSchema.parse(env);
  const dataDir = resolve(parsed.MCP_HOME_DATA_DIR);
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  chmodSync(dataDir, 0o700);
  const bootstrap = parsed.MCP_HOME_BOOTSTRAP_CONTROL_KEY;
  const publicUrl = new URL(parsed.MCP_HOME_PUBLIC_URL);
  const configuredHosts =
    parsed.MCP_HOME_ALLOWED_HOSTS?.split(',')
      .map((host) => host.trim())
      .filter(Boolean) ?? [];
  return {
    host: parsed.MCP_HOME_HOST,
    port: parsed.MCP_HOME_PORT,
    publicUrl,
    dataDir,
    databasePath: resolve(dataDir, 'mcp-home.sqlite'),
    masterKey: parsed.MCP_HOME_MASTER_KEY,
    ...(bootstrap === undefined ? {} : { bootstrapControlKey: bootstrap }),
    allowedHosts: configuredHosts.length === 0 ? [publicUrl.hostname] : configuredHosts,
    logLevel: parsed.MCP_HOME_LOG_LEVEL,
    oauthUrlClientId: parsed.MCP_HOME_OAUTH_URL_CLIENT_ID === 'true',
  };
}
