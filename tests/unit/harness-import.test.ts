import { describe, expect, it } from 'vitest';
import {
  parseHarnessConfig,
  toPreview,
  toSlug,
} from '../../src/config/harness-import.js';

describe('harness config parser', () => {
  it('imports a remote entry with a bearer credential from the Authorization header', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: {
        Docs: {
          url: 'https://docs.example.test/mcp',
          headers: { Authorization: 'Bearer abc123' },
        },
      },
    });
    expect(entry?.kind).toBe('remote');
    expect(entry?.slug).toBe('docs');
    expect(entry?.credential?.payload).toEqual({ type: 'bearer', token: 'abc123' });
    expect(entry?.warnings.join(' ')).toContain('Bearer');
    // The token must not leak into the plaintext transport headers.
    expect(JSON.stringify(entry?.transport)).not.toContain('abc123');
  });

  it('imports a remote entry with arbitrary headers as a headers credential', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: {
        api: { url: 'https://api.example.test/mcp', headers: { 'x-api-key': 'k' } },
      },
    });
    expect(entry?.credential?.payload).toEqual({
      type: 'headers',
      headers: { 'x-api-key': 'k' },
    });
    if (entry?.transport.type === 'streamable-http') {
      expect(entry.transport.headers).toEqual({});
    }
  });

  it('imports a remote entry without headers as credential-less', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: { public: { url: 'https://public.example.test/mcp' } },
    });
    expect(entry?.credential).toBeNull();
  });

  it('splits stdio env into an encrypted credential (secret-looking keys) and transport env', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: {
        mosaic: {
          command: 'npx',
          args: ['-y', 'mosaic-mcp'],
          env: {
            MOSAIC_SERVER_URL: 'http://localhost:3001',
            MOSAIC_USERNAME: 'admin',
            MOSAIC_PASSWORD: 'pw',
            api_KEY: 'k',
          },
        },
      },
    });
    expect(entry?.kind).toBe('home');
    expect(entry?.transport.type).toBe('stdio');
    if (entry?.transport.type === 'stdio') {
      expect(entry.transport.env).toEqual({
        MOSAIC_SERVER_URL: 'http://localhost:3001',
        MOSAIC_USERNAME: 'admin',
      });
    }
    expect(entry?.credential?.payload).toEqual({
      type: 'env',
      variables: { MOSAIC_PASSWORD: 'pw', api_KEY: 'k' },
    });
  });

  it('flags npx packages that match a curated Market entry', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: { mosaic: { command: 'npx', args: ['mosaic-mcp'] } },
    });
    expect(entry?.warnings.join(' ')).toContain('Market');
  });

  it('warns when a package runner is not in the curated catalog', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: { custom: { command: 'npx', args: ['-y', 'some-random-mcp'] } },
    });
    expect(entry?.warnings.join(' ')).toContain('resolvable');
  });

  it('rejects entries with neither url nor command', () => {
    expect(() => parseHarnessConfig({ mcpServers: { broken: {} } })).toThrow(/url.*command/i);
  });

  it('sanitizes names into slugs', () => {
    expect(toSlug('My Cool MCP!')).toBe('my-cool-mcp');
    expect(toSlug('--weird__name--')).toBe('weird-name');
    expect(toSlug('中文名字')).toBe('mcp');
  });

  it('previews never expose secret values', () => {
    const [entry] = parseHarnessConfig({
      mcpServers: {
        mosaic: {
          command: 'npx',
          args: ['mosaic-mcp'],
          env: { MOSAIC_PASSWORD: 'top-secret-value' },
        },
        docs: {
          url: 'https://docs.example.test/mcp',
          headers: { Authorization: 'Bearer another-secret' },
        },
      },
    });
    const previews = parseHarnessConfig({
      mcpServers: {
        mosaic: {
          command: 'npx',
          args: ['mosaic-mcp'],
          env: { MOSAIC_PASSWORD: 'top-secret-value' },
        },
        docs: {
          url: 'https://docs.example.test/mcp',
          headers: { Authorization: 'Bearer another-secret' },
        },
      },
    }).map(toPreview);
    const serialized = JSON.stringify(previews);
    expect(serialized).not.toContain('top-secret-value');
    expect(serialized).not.toContain('another-secret');
    expect(previews[0]?.credential?.fields.map((f) => f.name)).toEqual(['MOSAIC_PASSWORD']);
    expect(previews[1]?.credential?.fields.map((f) => f.name)).toEqual(['token']);
    expect(entry).toBeDefined();
  });
});
