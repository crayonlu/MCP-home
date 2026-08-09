const severity = { debug: 10, info: 20, warn: 30, error: 40 } satisfies Record<string, number>;

export type LogLevel = keyof typeof severity;

export interface Logger {
  debug(message: string, detail?: Record<string, unknown>): void;
  info(message: string, detail?: Record<string, unknown>): void;
  warn(message: string, detail?: Record<string, unknown>): void;
  error(message: string, detail?: Record<string, unknown>): void;
}

export function createLogger(minimum: LogLevel): Logger {
  const emit = (level: LogLevel, message: string, detail?: Record<string, unknown>): void => {
    if (severity[level] < severity[minimum]) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      message,
      ...(detail === undefined ? {} : { detail }),
    };
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };

  return {
    debug: (message, detail) => emit('debug', message, detail),
    info: (message, detail) => emit('info', message, detail),
    warn: (message, detail) => emit('warn', message, detail),
    error: (message, detail) => emit('error', message, detail),
  };
}
