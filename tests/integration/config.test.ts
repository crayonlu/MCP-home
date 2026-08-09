import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { controlRequest, createTestRuntime, jsonResponse } from '../support/runtime.js';

const exportSchema = z
  .object({
    version: z.literal(1),
    secretsIncluded: z.boolean(),
    credentials: z.array(
      z
        .object({
          ref: z.string(),
          name: z.string(),
          type: z.string(),
          payload: z.unknown().optional(),
        })
        .passthrough(),
    ),
    servers: z.array(
      z
        .object({
          slug: z.string(),
          credentialRef: z.string().nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

describe('configuration backup', () => {
  it('redacts by default and restores a secret export with remapped IDs', async () => {
    const source = createTestRuntime();
    const destination = createTestRuntime();
    try {
      const credential = z.object({ id: z.string() }).parse(
        await jsonResponse(
          await controlRequest(source.runtime, source.controlKey, 'POST', '/api/v1/credentials', {
            name: 'Backup credential',
            payload: { type: 'bearer', token: 'backup-secret' },
          }),
        ),
      );
      await jsonResponse(
        await controlRequest(source.runtime, source.controlKey, 'POST', '/api/v1/servers', {
          slug: 'backup-server',
          name: 'Backup server',
          kind: 'remote',
          transport: {
            type: 'streamable-http',
            url: 'https://mcp.example.test/mcp',
            protocolMode: 'auto',
            allowSseFallback: false,
            headers: { 'x-static-secret': 'transport-secret' },
          },
          credentialId: credential.id,
          enabled: false,
          settings: {},
        }),
      );

      const redacted = exportSchema.parse(
        await jsonResponse(
          await controlRequest(source.runtime, source.controlKey, 'GET', '/api/v1/config/export'),
        ),
      );
      expect(redacted.secretsIncluded).toBe(false);
      expect(redacted.credentials[0]?.payload).toBeUndefined();
      expect(JSON.stringify(redacted)).not.toContain('transport-secret');
      const rejected = await controlRequest(
        destination.runtime,
        destination.controlKey,
        'POST',
        '/api/v1/config/import',
        redacted,
      );
      expect(rejected.status).toBe(400);

      const backup = exportSchema.parse(
        await jsonResponse(
          await controlRequest(
            source.runtime,
            source.controlKey,
            'GET',
            '/api/v1/config/export?includeSecrets=true',
          ),
        ),
      );
      expect(backup.secretsIncluded).toBe(true);
      expect(backup.credentials[0]?.payload).toEqual({
        type: 'bearer',
        token: 'backup-secret',
      });
      expect(JSON.stringify(backup)).toContain('transport-secret');
      await jsonResponse(
        await controlRequest(
          destination.runtime,
          destination.controlKey,
          'POST',
          '/api/v1/config/import',
          backup,
        ),
      );
      const importedServers = z
        .array(z.object({ slug: z.string(), credentialId: z.string().nullable() }).passthrough())
        .parse(
          await jsonResponse(
            await controlRequest(
              destination.runtime,
              destination.controlKey,
              'GET',
              '/api/v1/servers',
            ),
          ),
        );
      const importedCredentials = z
        .array(z.object({ id: z.string(), name: z.string() }).passthrough())
        .parse(
          await jsonResponse(
            await controlRequest(
              destination.runtime,
              destination.controlKey,
              'GET',
              '/api/v1/credentials',
            ),
          ),
        );
      expect(importedServers).toHaveLength(1);
      expect(importedCredentials).toHaveLength(1);
      expect(importedServers[0]?.credentialId).toBe(importedCredentials[0]?.id);
      expect(importedCredentials[0]?.id).not.toBe(credential.id);
    } finally {
      await source.close();
      await destination.close();
    }
  });
});
