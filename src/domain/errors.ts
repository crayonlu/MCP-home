export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function errorMessage(value: unknown): string {
  return toError(value).message;
}
