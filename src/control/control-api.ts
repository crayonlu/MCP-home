import { z } from 'zod';
import { AppError } from '../domain/errors.js';
import type { Logger } from '../observability/logger.js';
import type { AuthService } from '../security/auth-service.js';
import { bearerToken } from '../security/auth-service.js';
import { ControlSessionService, cookieValue } from '../security/control-session.js';
import type { Store } from '../storage/store.js';
import type { ControlService } from './control-service.js';
import type { MarketService } from '../market/market-service.js';
import { controlOpenApi } from './openapi.js';

const keyInputSchema = z.object({ name: z.string().min(1).max(120) });

interface HonoLike {
  use(
    path: string,
    handler: (context: HonoContext, next: () => Promise<void>) => Promise<Response | void>,
  ): void;
  get(path: string, handler: (context: HonoContext) => Response | Promise<Response>): void;
  post(path: string, handler: (context: HonoContext) => Response | Promise<Response>): void;
  patch(path: string, handler: (context: HonoContext) => Response | Promise<Response>): void;
  delete(path: string, handler: (context: HonoContext) => Response | Promise<Response>): void;
}

interface HonoContext {
  req: {
    raw: Request;
    path: string;
    param(name: string): string;
    query(name: string): string | undefined;
    json(): Promise<unknown>;
  };
}

export function mountControlApi(
  app: HonoLike,
  options: {
    service: ControlService;
    auth: AuthService;
    sessions: ControlSessionService;
    store: Store;
    publicUrl: URL;
    secureCookies: boolean;
    logger: Logger;
    market?: MarketService;
  },
): void {
  const route =
    (handler: (context: HonoContext) => unknown | Promise<unknown>, status = 200) =>
    async (context: HonoContext): Promise<Response> => {
      try {
        return jsonResponse(await handler(context), status);
      } catch (error) {
        return errorResponse(error, options.logger);
      }
    };

  app.post(
    '/api/v1/session',
    route(async (context) => {
      const principal = options.auth.authenticateBearer('control', context.req.raw);
      const token = await options.sessions.issue(principal);
      return responseWithCookie(
        { authenticated: true, principal: { id: principal.id, name: principal.name } },
        token,
        options.secureCookies,
      );
    }),
  );

  app.use('/api/v1/*', async (context, next) => {
    if (
      context.req.path === '/api/v1/session' &&
      (context.req.raw.method === 'POST' || context.req.raw.method === 'DELETE')
    ) {
      await next();
      return;
    }
    try {
      const token = bearerToken(context.req.raw);
      if (token) {
        options.auth.authenticate('control', token);
      } else {
        const session = cookieValue(context.req.raw, 'mcp_home_session');
        if (!session) throw new AppError('unauthorized', 'Control credential required', 401);
        const principal = await options.sessions.verify(session);
        const key = options.store.getApiKey(principal.id, 'control');
        if (!key || key.revokedAt !== null) {
          throw new AppError('unauthorized', 'Control session credential was revoked', 401);
        }
      }
      await next();
    } catch (error) {
      return errorResponse(error, options.logger);
    }
  });

  app.delete(
    '/api/v1/session',
    () =>
      new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'set-cookie': 'mcp_home_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
        },
      }),
  );

  app.get(
    '/api/v1/openapi.json',
    route(() => controlOpenApi(options.publicUrl)),
  );
  app.get(
    '/api/v1/servers',
    route(() => options.service.listServers()),
  );
  app.post(
    '/api/v1/servers',
    route((context) => context.req.json().then((body) => options.service.createServer(body)), 201),
  );
  app.get(
    '/api/v1/servers/:id',
    route((context) => options.service.getServer(context.req.param('id'))),
  );
  app.patch(
    '/api/v1/servers/:id',
    route(async (context) =>
      options.service.updateServer(context.req.param('id'), await context.req.json()),
    ),
  );
  app.delete(
    '/api/v1/servers/:id',
    route(async (context) => {
      await options.service.deleteServer(context.req.param('id'));
      return { deleted: true };
    }),
  );

  app.post(
    '/api/v1/servers/:id/test',
    route((context) => options.service.testServer(context.req.param('id'))),
  );
  app.post(
    '/api/v1/servers/:id/enable',
    route((context) => options.service.enableServer(context.req.param('id'))),
  );
  app.post(
    '/api/v1/servers/:id/disable',
    route((context) => options.service.disableServer(context.req.param('id'))),
  );
  app.post(
    '/api/v1/servers/:id/refresh',
    route((context) => options.service.refreshServer(context.req.param('id'))),
  );
  app.post(
    '/api/v1/servers/:id/restart',
    route((context) => options.service.restartServer(context.req.param('id'))),
  );
  app.get(
    '/api/v1/servers/:id/capabilities',
    route((context) => options.service.serverCapabilities(context.req.param('id'))),
  );
  app.get(
    '/api/v1/servers/:id/status',
    route((context) => options.service.serverStatus(context.req.param('id'))),
  );
  app.get(
    '/api/v1/servers/:id/logs',
    route((context) =>
      options.service.serverLogs(
        context.req.param('id'),
        numberQuery(context.req.query('limit'), 100),
      ),
    ),
  );
  app.get(
    '/api/v1/servers/:id/endpoint',
    route((context) => options.service.serverEndpoint(context.req.param('id'))),
  );

  app.get(
    '/api/v1/credentials',
    route(() => options.service.listCredentials()),
  );
  app.post(
    '/api/v1/credentials',
    route(async (context) => options.service.createCredential(await context.req.json()), 201),
  );
  app.get(
    '/api/v1/credentials/:id',
    route((context) => options.service.getCredential(context.req.param('id'))),
  );
  app.patch(
    '/api/v1/credentials/:id',
    route(async (context) =>
      options.service.updateCredential(context.req.param('id'), await context.req.json()),
    ),
  );
  app.delete(
    '/api/v1/credentials/:id',
    route(async (context) => {
      await options.service.deleteCredential(context.req.param('id'));
      return { deleted: true };
    }),
  );
  app.post(
    '/api/v1/credentials/:id/test',
    route((context) => options.service.testCredential(context.req.param('id'))),
  );
  app.post(
    '/api/v1/credentials/:id/authorize',
    route(async (context) =>
      options.service.authorizeCredential(
        context.req.param('id'),
        await readOptionalJson(context.req.raw),
      ),
    ),
  );
  app.post(
    '/api/v1/credentials/:id/revoke',
    route((context) => options.service.revokeCredential(context.req.param('id'))),
  );

  mountKeyRoutes(app, route, options.service, 'control');
  mountKeyRoutes(app, route, options.service, 'access');

  app.get(
    '/api/v1/overview',
    route(() => options.service.overview()),
  );
  app.get(
    '/api/v1/events',
    route((context) =>
      options.store.listEvents({ limit: numberQuery(context.req.query('limit'), 100) }),
    ),
  );
  app.get(
    '/api/v1/diagnostics',
    route(() => options.service.diagnostics()),
  );
  app.get(
    '/api/v1/config/export',
    route((context) =>
      options.service.exportConfig(booleanQuery(context.req.query('includeSecrets'), false)),
    ),
  );
  app.post(
    '/api/v1/config/import',
    route(async (context) => options.service.importConfig(await context.req.json())),
  );
  app.get(
    '/api/v1/endpoints/aggregate',
    route(() => options.service.aggregateEndpoint()),
  );

  const market = options.market;
  if (market) {
    app.get('/api/v1/market', route(() => market.list()));
    app.post(
      '/api/v1/market/:id/install',
      route(async (context) => {
        const body = (await context.req.json()) as { values?: Record<string, string> };
        return market.install(context.req.param('id'), body.values ?? {});
      }),
    );
    app.post(
      '/api/v1/market/:id/uninstall',
      route(async (context) => {
        await market.uninstall(context.req.param('id'));
        return { uninstalled: true };
      }),
    );
  }
}

function mountKeyRoutes(
  app: HonoLike,
  route: (
    handler: (context: HonoContext) => unknown | Promise<unknown>,
    status?: number,
  ) => (context: HonoContext) => Promise<Response>,
  service: ControlService,
  kind: 'control' | 'access',
): void {
  const path = kind === 'control' ? 'control-keys' : 'access-keys';
  app.get(
    `/api/v1/${path}`,
    route(() => service.listKeys(kind)),
  );
  app.post(
    `/api/v1/${path}`,
    route(async (context) => {
      const input = keyInputSchema.parse(await context.req.json());
      return service.createKey(kind, input.name);
    }, 201),
  );
  app.delete(
    `/api/v1/${path}/:id`,
    route((context) => {
      service.revokeKey(kind, context.req.param('id'));
      return { revoked: true };
    }),
  );
}

function responseWithCookie(value: unknown, token: string, secure: boolean): Response {
  const attributes = ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=28800'];
  if (secure) attributes.push('Secure');
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': `mcp_home_session=${encodeURIComponent(token)}; ${attributes.join('; ')}`,
    },
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  if (value instanceof Response) return value;
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function errorResponse(error: unknown, logger: Logger): Response {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof z.ZodError
        ? new AppError('validation_error', 'Request validation failed', 400, {
            issues: error.issues,
          })
        : new AppError('internal_error', 'Internal server error', 500);
  if (appError.status >= 500) {
    logger.error('Control API error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return new Response(
    JSON.stringify({
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.detail === undefined ? {} : { detail: appError.detail }),
      },
    }),
    {
      status: appError.status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...(appError.status === 401
          ? { 'www-authenticate': 'Bearer realm="mcp-home-control"' }
          : {}),
      },
    },
  );
}

function numberQuery(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanQuery(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return z.enum(['true', 'false']).parse(value) === 'true';
}

async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  return text.trim() === '' ? {} : JSON.parse(text);
}
