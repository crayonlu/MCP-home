import {
  WebStandardStreamableHTTPServerTransport,
  type AuthInfo,
  type Server,
} from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import type { Logger } from '../observability/logger.js';

interface LegacySession {
  server: Server;
  transport: WebStandardStreamableHTTPServerTransport;
  clientId: string;
  lastSeenAt: number;
}

interface LegacyRequestOptions {
  authInfo: AuthInfo;
  parsedBody: unknown;
}

const maxSessions = 256;
const idleSessionMs = 24 * 60 * 60 * 1_000;

export class LegacySessionHandler {
  readonly #sessions = new Map<string, LegacySession>();
  readonly #factory: () => Server;
  readonly #logger: Logger;
  #closed = false;

  constructor(factory: () => Server, logger: Logger) {
    this.#factory = factory;
    this.#logger = logger;
  }

  async fetch(request: Request, options: LegacyRequestOptions): Promise<Response> {
    if (this.#closed) return jsonRpcError(503, -32603, 'MCP endpoint is closed');
    await this.#removeExpired();
    const sessionId = request.headers.get('mcp-session-id');
    if (sessionId) {
      const session = this.#sessions.get(sessionId);
      if (!session) return jsonRpcError(404, -32001, 'MCP session not found');
      if (session.clientId !== options.authInfo.clientId) {
        return jsonRpcError(403, -32000, 'MCP session principal mismatch');
      }
      session.lastSeenAt = Date.now();
      return session.transport.handleRequest(request, { authInfo: options.authInfo });
    }
    if (!isInitializeRequest(options.parsedBody)) {
      return jsonRpcError(400, -32000, 'Mcp-Session-Id is required');
    }
    if (this.#sessions.size >= maxSessions) {
      return jsonRpcError(503, -32603, 'MCP session limit reached');
    }
    return this.#initialize(request, options);
  }

  toolsChanged(): void {
    this.#broadcast((server) => server.sendToolListChanged());
  }

  promptsChanged(): void {
    this.#broadcast((server) => server.sendPromptListChanged());
  }

  resourcesChanged(): void {
    this.#broadcast((server) => server.sendResourceListChanged());
  }

  resourceUpdated(uri: string): void {
    this.#broadcast((server) => server.sendResourceUpdated({ uri }));
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const sessions = [...this.#sessions.values()];
    this.#sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.server.close()));
  }

  async #initialize(request: Request, options: LegacyRequestOptions): Promise<Response> {
    let initializedId: string | null = null;
    let session: LegacySession | null = null;
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      keepAliveMs: 15_000,
      onsessioninitialized: (sessionId) => {
        if (!session) throw new Error('Legacy MCP session initialized before setup completed');
        initializedId = sessionId;
        this.#sessions.set(sessionId, session);
      },
      onsessionclosed: async (sessionId) => {
        await this.#closeSession(sessionId);
      },
    });
    const server = this.#factory();
    session = {
      server,
      transport,
      clientId: options.authInfo.clientId,
      lastSeenAt: Date.now(),
    };
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, {
        authInfo: options.authInfo,
        parsedBody: options.parsedBody,
      });
      if (initializedId === null) await server.close();
      return response;
    } catch (error) {
      if (initializedId !== null) this.#sessions.delete(initializedId);
      await server.close().catch(() => undefined);
      throw error;
    }
  }

  #broadcast(send: (server: Server) => Promise<void>): void {
    for (const session of this.#sessions.values()) {
      void send(session.server).catch((error) => {
        this.#logger.warn('Legacy MCP notification failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  async #removeExpired(): Promise<void> {
    const deadline = Date.now() - idleSessionMs;
    const expired = [...this.#sessions]
      .filter(([, session]) => session.lastSeenAt < deadline)
      .map(([sessionId]) => sessionId);
    for (const sessionId of expired) await this.#closeSession(sessionId);
  }

  async #closeSession(sessionId: string): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (!session) return;
    this.#sessions.delete(sessionId);
    await session.server.close().catch(() => undefined);
  }
}

function isInitializeRequest(body: unknown): boolean {
  return isRecord(body) && body.method === 'initialize';
}

function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
