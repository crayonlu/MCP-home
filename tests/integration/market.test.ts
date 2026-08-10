import { describe, expect, it } from 'vitest';
import { createTestRuntime, controlRequest, jsonResponse } from '../support/runtime.js';
import { credentialRecordSchema, serverRecordSchema } from '../../src/domain/models.js';

interface MarketItem {
  id: string;
  kind: string;
  installed: boolean;
}

async function marketList(
  runtime: Parameters<typeof controlRequest>[0],
  controlKey: string,
) {
  return jsonResponse(
    await controlRequest(runtime, controlKey, 'GET', '/api/v1/market'),
  ) as unknown as MarketItem[];
}

describe('market', () => {
  it('lists the curated catalog with install status', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      const items = await marketList(runtime, controlKey);
      expect(items.length).toBeGreaterThan(20);
      expect(items.some((item) => item.id === 'github' && item.kind === 'remote')).toBe(true);
      expect(items.some((item) => item.id === 'resend' && item.kind === 'home-stdio')).toBe(true);
      for (const item of items) expect(item.installed).toBe(false);
    } finally {
      await close();
    }
  });

  it('installs and uninstalls a remote bearer entry', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      const result = (await jsonResponse(
        await controlRequest(runtime, controlKey, 'POST', '/api/v1/market/context7/install', {
          values: { CONTEXT7_API_KEY: 'ctx-test' },
        }),
      )) as { server: unknown; credential: unknown };
      const server = serverRecordSchema.parse(result.server);
      const credential = credentialRecordSchema.parse(result.credential);
      expect(server.slug).toBe('context7');
      expect(credential.type).toBe('bearer');

      const afterInstall = await marketList(runtime, controlKey);
      expect(afterInstall.find((item) => item.id === 'context7')?.installed).toBe(true);

      const uninstall = await jsonResponse(
        await controlRequest(runtime, controlKey, 'POST', '/api/v1/market/context7/uninstall', {}),
      );
      expect(uninstall).toEqual({ uninstalled: true });

      const afterUninstall = await marketList(runtime, controlKey);
      expect(afterUninstall.find((item) => item.id === 'context7')?.installed).toBe(false);
    } finally {
      await close();
    }
  });

  it('installs a remote oauth entry with an empty credential', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      const result = (await jsonResponse(
        await controlRequest(runtime, controlKey, 'POST', '/api/v1/market/deepwiki/install', {}),
      )) as { server: unknown; credential: unknown };
      const credential = credentialRecordSchema.parse(result.credential);
      expect(credential.type).toBe('oauth');
      expect(credential.status).toBe('pending');
    } finally {
      await close();
    }
  });

  it('rejects missing required values and unknown entries', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      const missing = await controlRequest(runtime, controlKey, 'POST', '/api/v1/market/exa/install', {
        values: {},
      });
      expect(missing.status).toBe(400);

      const unknown = await controlRequest(
        runtime,
        controlKey,
        'POST',
        '/api/v1/market/does-not-exist/install',
        {},
      );
      expect(unknown.status).toBe(404);
    } finally {
      await close();
    }
  });

  it('rejects installing the same entry twice', async () => {
    const { runtime, controlKey, close } = createTestRuntime();
    try {
      await controlRequest(runtime, controlKey, 'POST', '/api/v1/market/context7/install', {
        values: { CONTEXT7_API_KEY: 'ctx-test' },
      });
      const second = await controlRequest(
        runtime,
        controlKey,
        'POST',
        '/api/v1/market/context7/install',
        { values: { CONTEXT7_API_KEY: 'ctx-test' } },
      );
      expect(second.status).toBe(409);
    } finally {
      await close();
    }
  });
});
