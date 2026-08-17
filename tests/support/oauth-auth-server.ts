import { serve, type ServerType } from '@hono/node-server';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { adaptModernTaskRequest } from '../../src/data-plane/task-extension.js';
import { createFixtureServer, createFixtureState } from '../fixtures/mcp-server.js';

export interface OAuthAuthServerOptions {
  /**
   * When true, the MCP endpoint rejects requests whose bearer token was not
   * issued by this fixture's token endpoint (401 + WWW-Authenticate), so the
   * refreshed token is actually exercised against the upstream.
   */
  requireAuth?: boolean;
  /** Access token lifetime minted by the token endpoint. */
  tokenTtlSeconds?: number;
}

export interface OAuthAuthServerFixture {
  /** MCP endpoint URL. */
  url: URL;
  /** Origin of the combined fixture (authorization server + resource server). */
  origin: string;
  /** Number of refresh-token grant requests received. */
  refreshAttempts(): number;
  /** Access tokens issued by the token endpoint. */
  issuedTokens(): string[];
  /** When true, refresh grants are rejected with invalid_grant. */
  setRejectRefresh(reject: boolean): void;
  close(): Promise<void>;
}

export async function startOAuthAuthServer(
  options: OAuthAuthServerOptions = {},
): Promise<OAuthAuthServerFixture> {
  const requireAuth = options.requireAuth ?? true;
  const tokenTtlSeconds = options.tokenTtlSeconds ?? 60;
  const state = createFixtureState();
  const issued = new Set<string>();
  let refreshAttempts = 0;
  let rejectRefresh = false;

  const handler = createMcpHandler(
    (context) =>
      createFixtureServer({
        name: 'remote',
        era: context.era,
        authorization: context.requestInfo?.headers.get('authorization') ?? null,
        state,
      }),
    { keepAliveMs: 0 },
  );

  const server = serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const origin = url.origin;
      if (url.pathname === '/mcp') {
        const authorization = request.headers.get('authorization') ?? null;
        const valid = requireAuth && authorization !== null && issued.has(authorization.slice(7));
        if (requireAuth && !valid) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: {
              'content-type': 'application/json',
              'www-authenticate': 'Bearer',
            },
          });
        }
        const contentType = request.headers.get('content-type') ?? '';
        if (request.method !== 'POST' || !contentType.includes('application/json')) {
          return handler.fetch(request);
        }
        const body: unknown = await request.clone().json();
        const adapted = adaptModernTaskRequest(request, body);
        return handler.fetch(adapted.request, { parsedBody: adapted.body });
      }
      if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
        return json(
          {
            resource: new URL('/mcp', origin).toString(),
            authorization_servers: [origin],
          },
          200,
        );
      }
      if (url.pathname === '/.well-known/oauth-authorization-server') {
        return json(
          {
            issuer: origin,
            authorization_endpoint: new URL('/oauth/authorize', origin).toString(),
            token_endpoint: new URL('/oauth/token', origin).toString(),
            revocation_endpoint: new URL('/oauth/revoke', origin).toString(),
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
            scopes_supported: ['mcp', 'offline_access'],
          },
          200,
        );
      }
      if (url.pathname === '/oauth/token' && request.method === 'POST') {
        const form = new URLSearchParams(await request.text());
        if (form.get('grant_type') === 'refresh_token') {
          refreshAttempts += 1;
          if (rejectRefresh) {
            return json(
              { error: 'invalid_grant', error_description: 'refresh token revoked' },
              400,
            );
          }
          return issueToken();
        }
        if (form.get('grant_type') === 'authorization_code') {
          return issueToken();
        }
        return json({ error: 'unsupported_grant_type' }, 400);
      }
      if (url.pathname === '/oauth/authorize') {
        return new Response('Mock authorization page', { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    },
  });
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('OAuth fixture address unavailable');

  function issueToken(): Response {
    const accessToken = `access-${randomUUID()}`;
    issued.add(accessToken);
    return json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: tokenTtlSeconds,
        scope: 'mcp offline_access',
      },
      200,
    );
  }

  return {
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    origin: `http://127.0.0.1:${address.port}`,
    refreshAttempts() {
      return refreshAttempts;
    },
    issuedTokens() {
      return [...issued];
    },
    setRejectRefresh(reject: boolean) {
      rejectRefresh = reject;
    },
    async close() {
      await handler.close();
      await closeServer(server);
    },
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function closeServer(server: ServerType): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
