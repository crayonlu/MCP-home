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

  it('previews and imports a harness mcpServers config (stdio + remote)', async () => {
    const runtime = createTestRuntime();
    try {
      const harnessConfig = {
        mcpServers: {
          mosaic: {
            command: 'npx',
            args: ['-y', 'mosaic-mcp'],
            env: {
              MOSAIC_SERVER_URL: 'http://localhost:3001',
              MOSAIC_USERNAME: 'admin',
              MOSAIC_PASSWORD: 'top-secret',
            },
          },
          docs: {
            url: 'https://docs.example.test/mcp',
            headers: { Authorization: 'Bearer remote-token' },
          },
        },
      };

      // Preview: masked, no writes.
      const preview = z
        .object({
          preview: z.literal(true),
          entries: z.array(
            z
              .object({
                slug: z.string(),
                kind: z.enum(['remote', 'home']),
                transportSummary: z.string(),
                credential: z
                  .object({ type: z.string(), fields: z.array(z.object({ name: z.string() })) })
                  .nullable(),
                warnings: z.array(z.string()),
              })
              .passthrough(),
          ),
        })
        .parse(
          await jsonResponse(
            await controlRequest(
              runtime.runtime,
              runtime.controlKey,
              'POST',
              '/api/v1/config/import-harness',
              { config: harnessConfig, preview: true },
            ),
          ),
        );
      const mosaicPreview = preview.entries.find((e) => e.slug === 'mosaic');
      const docsPreview = preview.entries.find((e) => e.slug === 'docs');
      expect(mosaicPreview?.kind).toBe('home');
      expect(mosaicPreview?.credential?.type).toBe('env');
      expect(mosaicPreview?.credential?.fields.map((f) => f.name)).toContain('MOSAIC_PASSWORD');
      expect(mosaicPreview?.credential?.fields.map((f) => f.name)).not.toContain(
        'MOSAIC_SERVER_URL',
      );
      expect(JSON.stringify(preview)).not.toContain('top-secret');
      expect(JSON.stringify(preview)).not.toContain('remote-token');
      expect(mosaicPreview?.warnings.join(' ')).toContain('Market');
      expect(docsPreview?.kind).toBe('remote');
      expect(docsPreview?.credential?.type).toBe('bearer');

      // Import for real.
      const result = z
        .object({
          preview: z.literal(false),
          entries: z.array(
            z
              .object({ slug: z.string(), status: z.string(), serverId: z.string().optional() })
              .passthrough(),
          ),
        })
        .parse(
          await jsonResponse(
            await controlRequest(
              runtime.runtime,
              runtime.controlKey,
              'POST',
              '/api/v1/config/import-harness',
              { config: harnessConfig },
            ),
          ),
        );
      expect(result.entries.map((e) => e.status)).toEqual(['created', 'created']);

      // Secrets landed in an encrypted credential, not in the transport env.
      const servers = z
        .array(
          z
            .object({ slug: z.string(), transport: z.record(z.string(), z.unknown()) })
            .passthrough(),
        )
        .parse(
          await jsonResponse(
            await controlRequest(runtime.runtime, runtime.controlKey, 'GET', '/api/v1/servers'),
          ),
        );
      const mosaicServer = servers.find((s) => s.slug === 'mosaic');
      const mosaicEnv = z.record(z.string(), z.string()).parse(mosaicServer?.transport.env ?? {});
      expect(mosaicEnv.MOSAIC_SERVER_URL).toBe('http://localhost:3001');
      expect(mosaicEnv).not.toHaveProperty('MOSAIC_PASSWORD');
      expect(JSON.stringify(servers)).not.toContain('top-secret');

      // Second import reports conflicts instead of duplicating.
      const again = z
        .object({ entries: z.array(z.object({ slug: z.string(), status: z.string() })) })
        .parse(
          await jsonResponse(
            await controlRequest(
              runtime.runtime,
              runtime.controlKey,
              'POST',
              '/api/v1/config/import-harness',
              { config: harnessConfig },
            ),
          ),
        );
      expect(again.entries.map((e) => e.status)).toEqual(['conflict', 'conflict']);
    } finally {
      await runtime.close();
    }
  });

  it('upsert mode diffs existing servers: unchanged skip, changed update', async () => {
    const runtime = createTestRuntime();
    try {
      const config = {
        mcpServers: {
          mosaic: {
            command: 'npx',
            args: ['-y', 'mosaic-mcp'],
            env: { MOSAIC_SERVER_URL: 'http://localhost:3001', MOSAIC_PASSWORD: 'pw-one' },
          },
        },
      };
      await jsonResponse(
        await controlRequest(
          runtime.runtime,
          runtime.controlKey,
          'POST',
          '/api/v1/config/import-harness',
          { config },
        ),
      );

      const entrySchema = z.object({
        slug: z.string(),
        status: z.string(),
        changes: z.array(z.string()).optional(),
      });

      // Identical config in upsert mode -> unchanged.
      const same = z.object({ entries: z.array(entrySchema) }).parse(
        await jsonResponse(
          await controlRequest(
            runtime.runtime,
            runtime.controlKey,
            'POST',
            '/api/v1/config/import-harness',
            { config, mode: 'upsert' },
          ),
        ),
      );
      expect(same.entries[0]?.status).toBe('unchanged');

      // Changed env (password) + args -> changed with field names only.
      const updatedConfig = {
        mcpServers: {
          mosaic: {
            command: 'npx',
            args: ['-y', 'mosaic-mcp@next'],
            env: { MOSAIC_SERVER_URL: 'http://localhost:3001', MOSAIC_PASSWORD: 'pw-two' },
          },
        },
      };
      const changed = z.object({ entries: z.array(entrySchema) }).parse(
        await jsonResponse(
          await controlRequest(
            runtime.runtime,
            runtime.controlKey,
            'POST',
            '/api/v1/config/import-harness',
            { config: updatedConfig, mode: 'upsert', preview: true },
          ),
        ),
      );
      expect(changed.entries[0]?.status).toBe('changed');
      expect(changed.entries[0]?.changes).toContain('args');
      expect(changed.entries[0]?.changes).toContain('credential');
      expect(JSON.stringify(changed)).not.toContain('pw-two');

      await jsonResponse(
        await controlRequest(
          runtime.runtime,
          runtime.controlKey,
          'POST',
          '/api/v1/config/import-harness',
          { config: updatedConfig, mode: 'upsert' },
        ),
      );

      // The server now runs the new command/args; the secret lives only in the credential.
      const servers = z
        .array(z.object({ slug: z.string(), transport: z.record(z.string(), z.unknown()) }).passthrough())
        .parse(
          await jsonResponse(
            await controlRequest(runtime.runtime, runtime.controlKey, 'GET', '/api/v1/servers'),
          ),
        );
      const mosaic = servers.find((server) => server.slug === 'mosaic');
      expect(mosaic?.transport.args).toEqual(['-y', 'mosaic-mcp@next']);
      expect(JSON.stringify(servers)).not.toContain('pw-two');
    } finally {
      await runtime.close();
    }
  });
});
