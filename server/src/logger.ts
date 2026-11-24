/** Простой журнал без внешних зависимостей. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_VALUE: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentMinLevel(): Level {
  const fromEnv = process.env.LOG_LEVEL;
  if (fromEnv === 'debug' || fromEnv === 'info' || fromEnv === 'warn' || fromEnv === 'error') {
    return fromEnv;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function write(level: Level, message: string, meta?: unknown): void {
  if (LEVEL_VALUE[level] < LEVEL_VALUE[currentMinLevel()]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) {
    sink(line);
  } else {
    sink(line, meta);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
