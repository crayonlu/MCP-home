import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { SqliteStore } from '../../src/storage/sqlite-store.js';
import { SecretBox } from '../../src/security/secret-box.js';
import type { ToolCallDraft } from '../../src/domain/models.js';

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), 'mcp-home-store-'));
  const databasePath = join(directory, 'test.sqlite');
  const store = new SqliteStore(
    databasePath,
    new SecretBox('store-test-master-key-0000000000000000000000001'),
  );
  const serverA = store.createServer({
    slug: 'server-a',
    name: 'Server A',
    kind: 'remote',
    transport: { type: 'streamable-http', url: 'https://example.test/mcp' },
    credentialId: null,
    enabled: true,
  });
  const serverB = store.createServer({
    slug: 'server-b',
    name: 'Server B',
    kind: 'remote',
    transport: { type: 'streamable-http', url: 'https://example.test/mcp' },
    credentialId: null,
    enabled: true,
  });
  return {
    store,
    serverA,
    serverB,
    databasePath,
    close() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function draft(overrides: Partial<ToolCallDraft> = {}): ToolCallDraft {
  const now = Date.now();
  return {
    endpointType: 'aggregate',
    principalKind: 'access_key',
    principalId: 'principal-1',
    serverId: '00000000-0000-4000-8000-000000000001',
    exposedToolName: 'remote.echo',
    upstreamToolName: 'echo',
    status: 'success',
    errorType: null,
    startedAt: new Date(now - 10).toISOString(),
    completedAt: new Date(now).toISOString(),
    durationMs: 10,
    ...overrides,
  };
}

describe('tool visibility projection store', () => {
  it('defaults to visible, supports per-tool overrides and inherit removal', () => {
    const { store, serverA, close } = createStore();
    try {
      const id = serverA.id;
      expect(store.getServerProjection(id)).toBeNull();
      expect(store.getProjectionIndex().has(id)).toBe(false);

      store.setServerProjection(id, 'hidden');
      expect(store.getServerProjection(id)?.defaultVisibility).toBe('hidden');

      store.setToolProjection(id, 'echo', 'visible');
      store.setToolProjection(id, 'slow', 'hidden');
      const index = store.getProjectionIndex().get(id);
      expect(index?.defaultVisibility).toBe('hidden');
      expect(index?.overrides.get('echo')).toBe('visible');
      expect(index?.overrides.get('slow')).toBe('hidden');

      // inherit removes the override row entirely
      store.setToolProjection(id, 'echo', 'inherit');
      const after = store.getProjectionIndex().get(id);
      expect(after?.overrides.has('echo')).toBe(false);

      const projections = store.listToolProjections(id);
      expect(projections.map((entry) => entry.upstreamToolName)).toEqual(['slow']);
    } finally {
      close();
    }
  });
});

describe('tool call store', () => {
  it('inserts, filters, counts and aggregates tool calls', () => {
    const { store, serverA, serverB, close } = createStore();
    try {
      store.insertToolCalls([
        draft({ serverId: serverA.id, status: 'success', durationMs: 20 }),
        draft({ endpointType: 'individual', serverId: serverB.id, exposedToolName: 'echo', upstreamToolName: 'echo', status: 'success', durationMs: 40 }),
        draft({ serverId: serverA.id, status: 'timeout', errorType: 'REQUEST_TIMEOUT', durationMs: 100 }),
      ]);

      const all = store.listToolCalls({ limit: 50, offset: 0 });
      expect(all).toHaveLength(3);
      expect(store.countToolCalls({ limit: 50, offset: 0 })).toBe(3);

      const server1 = store.listToolCalls({ limit: 50, offset: 0, serverId: serverA.id });
      expect(server1).toHaveLength(2);

      const stats = store.toolCallStats({});
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(2);
      expect(stats.error).toBe(1);
      expect(stats.avgDurationMs).toBe(53);
      expect(stats.topTools[0]?.tool).toBe('echo');
      expect(stats.topFailing[0]?.tool).toBe('echo');
      expect(stats.topFailing[0]?.errorType).toBe('REQUEST_TIMEOUT');
    } finally {
      close();
    }
  });

  it('deletes rows older than the retention boundary in batches', () => {
    const { store, serverA, serverB, close } = createStore();
    try {
      store.insertToolCalls([
        draft({ serverId: serverA.id, startedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() }),
        draft({
          serverId: serverB.id,
          startedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
        }),
        draft({ serverId: serverA.id, startedAt: new Date().toISOString() }),
      ]);
      const deleted = store.deleteOldToolCalls(
        new Date(Date.now() - 30 * 86_400_000).toISOString(),
      );
      expect(deleted).toBe(2);
      expect(store.countToolCalls({ limit: 50, offset: 0 })).toBe(1);
    } finally {
      close();
    }
  });

  it('registers the row-cap trigger as a backstop', () => {
    const { databasePath, close } = createStore();
    try {
      const read = new DatabaseSync(databasePath, { readOnly: true });
      const rows = read.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trim_tool_calls'").all();
      expect(rows).toHaveLength(1);
      read.close();
    } finally {
      close();
    }
  });
});
