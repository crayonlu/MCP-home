import { z } from 'zod';
import { AppError } from '../domain/errors.js';
import type { Logger } from '../observability/logger.js';
import type { CapabilityRegistry } from '../data-plane/registry.js';
import type { OAuthServer } from './oauth-server.js';

interface OAuthApp {
  get(path: string, handler: (context: OAuthContext) => Response | Promise<Response>): void;
  post(path: string, handler: (context: OAuthContext) => Response | Promise<Response>): void;
}

interface OAuthContext {
  req: {
    raw: Request;
    param(name: string): string;
    json(): Promise<unknown>;
  };
}

export function mountOAuthRoutes(
  app: OAuthApp,
  options: {
    oauth: OAuthServer;
    registry: CapabilityRegistry;
    logger: Logger;
  },
): void {
  const route =
    (handler: (context: OAuthContext) => Response | Promise<Response>) =>
    async (context: OAuthContext): Promise<Response> => {
      try {
        return await handler(context);
      } catch (error) {
        return oauthError(error, options.logger);
      }
    };

  const authorizationMetadata = () => json(options.oauth.authorizationServerMetadata());
  app.get('/.well-known/oauth-authorization-server', authorizationMetadata);

  app.get('/.well-known/oauth-protected-resource', () =>
    json(options.oauth.protectedResourceMetadata(options.oauth.mcpResource(null))),
  );
  app.get('/.well-known/oauth-protected-resource/mcp', () =>
    json(options.oauth.protectedResourceMetadata(options.oauth.mcpResource(null))),
  );
  app.get(
    '/.well-known/oauth-protected-resource/mcp/:slug',
    route((context) => {
      const slug = context.req.param('slug');
      options.registry.entryBySlug(slug);
      return json(options.oauth.protectedResourceMetadata(options.oauth.mcpResource(slug)));
    }),
  );

  app.get(
    '/oauth/authorize',
    route((context) => options.oauth.beginAuthorization(new URL(context.req.raw.url))),
  );
  app.post(
    '/oauth/authorize',
    route(async (context) =>
      options.oauth.approveAuthorization(await readUrlEncodedForm(context.req.raw)),
    ),
  );
  app.post(
    '/oauth/token',
    route(async (context) => options.oauth.token(await readUrlEncodedForm(context.req.raw))),
  );
  app.post(
    '/oauth/register',
    route(async (context) => json(options.oauth.register(await readJson(context.req.raw)), 201)),
  );
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

function oauthError(error: unknown, logger: Logger): Response {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof z.ZodError
        ? new AppError('invalid_request', 'OAuth request validation failed', 400)
        : new AppError('server_error', 'OAuth request failed', 500);
  if (appError.status >= 500) {
    logger.error('OAuth endpoint error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return json(
    {
      error: appError.code,
      error_description: appError.message,
    },
    appError.status,
  );
}

async function readUrlEncodedForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    throw new AppError('invalid_request', 'OAuth form must be URL encoded', 400);
  }
  const values = new URLSearchParams(await readLimitedBody(request));
  const form = new FormData();
  for (const [name, value] of values) form.append(name, value);
  return form;
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new AppError('invalid_request', 'OAuth registration must use JSON', 400);
  }
  try {
    return JSON.parse(await readLimitedBody(request));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('invalid_request', 'OAuth registration JSON is invalid', 400);
  }
}

async function readLimitedBody(request: Request): Promise<string> {
  const limit = 64 * 1024;
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    throw new AppError('invalid_request', 'OAuth request body is too large', 413);
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError('invalid_request', 'OAuth request body is too large', 413);
    }
    chunks.push(Buffer.from(next.value));
  }
  return Buffer.concat(chunks).toString('utf8');
}
