import { AppError } from '../domain/errors.js';

export class ControlClient {
  readonly #baseUrl: URL;
  readonly #apiKey: string;

  constructor(baseUrl: URL, apiKey: string) {
    this.#baseUrl = baseUrl;
    this.#apiKey = apiKey;
  }

  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const target = new URL(path, this.#baseUrl);
    if (target.origin !== this.#baseUrl.origin || !target.pathname.startsWith('/api/v1/')) {
      throw new AppError('invalid_control_path', 'Control API path must stay under /api/v1/', 400);
    }
    const response = await fetch(target, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.#apiKey}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value: unknown = await response
      .json()
      .catch(() => ({ error: { message: response.statusText } }));
    if (!response.ok) {
      const message = errorMessage(value) ?? `Control API returned ${response.status}`;
      throw new AppError('control_api_error', message, response.status, { response: value });
    }
    return value;
  }
}

function errorMessage(value: unknown): string | null {
  if (value === null || typeof value !== 'object') return null;
  const error = Reflect.get(value, 'error');
  if (error === null || typeof error !== 'object') return null;
  const message = Reflect.get(error, 'message');
  return typeof message === 'string' ? message : null;
}
