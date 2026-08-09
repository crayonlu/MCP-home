import type { z } from 'zod';

interface ApiInit {
  method?: string;
  body?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, schema: z.ZodType<T>, init: ApiInit = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = readProblem(body);
    throw new ApiError(
      problem?.message ?? `HTTP ${response.status}`,
      response.status,
      problem?.code,
    );
  }
  return schema.parse(body);
}

export async function login(controlKey: string): Promise<void> {
  const response = await fetch('/api/v1/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { authorization: `Bearer ${controlKey}` },
  });
  if (!response.ok) throw new ApiError('Control API Key 无效', response.status);
}

export async function logout(): Promise<void> {
  await fetch('/api/v1/session', { method: 'DELETE', credentials: 'same-origin' });
}

export function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function readProblem(value: unknown): { code?: string; message: string } | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const message = value.error.message;
  const code = value.error.code;
  if (typeof message !== 'string') return null;
  return {
    message,
    ...(typeof code === 'string' ? { code } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
