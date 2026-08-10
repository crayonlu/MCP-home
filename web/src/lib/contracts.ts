import { z } from 'zod';

export const protocolModeSchema = z.enum(['auto', 'legacy', 'modern']);

export const transportSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('streamable-http'),
    url: z.string(),
    protocolMode: protocolModeSchema,
    allowSseFallback: z.boolean(),
    headers: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()),
    cwd: z.string().optional(),
    env: z.record(z.string(), z.string()),
    protocolMode: protocolModeSchema,
  }),
]);

export const serverRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  kind: z.enum(['remote', 'home']),
  transport: transportSchema,
  credentialId: z.string().nullable(),
  enabled: z.boolean(),
  settings: z.object({
    connectTimeoutMs: z.number(),
    requestTimeoutMs: z.number(),
    maxTotalTimeoutMs: z.number(),
    maxConcurrency: z.number(),
    restart: z.enum(['never', 'on-failure', 'always']),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const runtimeStateSchema = z.object({
  serverId: z.string(),
  status: z.enum([
    'disabled',
    'unknown',
    'connecting',
    'ready',
    'degraded',
    'unreachable',
    'auth-required',
    'start-failed',
  ]),
  protocolVersion: z.string().nullable(),
  protocolEra: z.enum(['modern', 'legacy']).nullable(),
  processId: z.number().nullable(),
  restartCount: z.number(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
  updatedAt: z.string(),
});

export const serverStatusSchema = z.object({
  server: serverRecordSchema,
  runtime: runtimeStateSchema.nullable(),
  snapshot: z.unknown().nullable(),
});

export const credentialRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['bearer', 'api-key', 'headers', 'env', 'oauth']),
  status: z.enum(['ready', 'expired', 'invalid', 'pending']),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const apiKeyRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(['control', 'access']),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
});

export const issuedKeySchema = z.object({
  key: apiKeyRecordSchema,
  secret: z.string(),
});

export const overviewSchema = z.object({
  servers: z.object({
    total: z.number(),
    enabled: z.number(),
    remote: z.number(),
    home: z.number(),
    ready: z.number(),
    unhealthy: z.number(),
  }),
  credentials: z.number(),
  endpoints: z.object({ aggregate: z.string() }),
});

export const endpointSchema = z.object({
  url: z.string(),
  authorization: z.record(z.string(), z.unknown()),
});

export const serverEndpointSchema = z.object({
  aggregateUrl: z.string(),
  individualUrl: z.string(),
  authorization: z.record(z.string(), z.unknown()),
});

export const authorizationResultSchema = z
  .object({
    status: z.string(),
    authorizationUrl: z.string().optional(),
    callbackUrl: z.string().optional(),
    serverId: z.string(),
  })
  .passthrough();

export const unknownRecordSchema = z.record(z.string(), z.unknown());

export type ServerRecord = z.infer<typeof serverRecordSchema>;
export type ServerStatus = z.infer<typeof serverStatusSchema>;
export type CredentialRecord = z.infer<typeof credentialRecordSchema>;
export type ApiKeyRecord = z.infer<typeof apiKeyRecordSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export const eventRecordSchema = z.object({
  id: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  type: z.string(),
  serverId: z.string().nullable(),
  message: z.string(),
  detail: unknownRecordSchema,
  createdAt: z.string(),
});

export const diagnosticsSchema = z.object({
  ok: z.boolean(),
  database: z.string(),
  servers: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      enabled: z.boolean(),
      status: z.string(),
      hasSnapshot: z.boolean(),
    }),
  ),
});

export const keyListSchema = z.object({
  key: apiKeyRecordSchema,
  secret: z.string(),
});

export type EventRecord = z.infer<typeof eventRecordSchema>;
export type Diagnostics = z.infer<typeof diagnosticsSchema>;

export type View = 'overview' | 'servers' | 'credentials' | 'keys' | 'logs';
