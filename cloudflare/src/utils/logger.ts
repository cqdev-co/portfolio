/**
 * Simple logger with log levels to control observability event costs.
 *
 * In production, defaults to "error" level to minimize observability events.
 * Set LOG_LEVEL env var to "debug" for verbose logging when needed.
 *
 * Log levels (in order of verbosity):
 *   - error: Only errors (default in production)
 *   - warn:  Errors + warnings
 *   - info:  Errors + warnings + info
 *   - debug: Everything (cache hits, fetch status, timing)
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Default to 'error' in production to minimize observability events
const currentLevel: LogLevel =
  ((globalThis as Record<string, unknown>).LOG_LEVEL as LogLevel) || 'error';

const shouldLog = (level: LogLevel): boolean => {
  return LEVELS[level] <= LEVELS[currentLevel];
};

export const logger = {
  /** Always logged - for critical errors */
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error(...args);
  },

  /** Logged at warn+ level - for warnings */
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(...args);
  },

  /** Logged at info+ level - for important events */
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.log(...args);
  },

  /** Logged at debug level only - for verbose debugging */
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.log(...args);
  },
};
