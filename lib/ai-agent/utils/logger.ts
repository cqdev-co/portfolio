/**
 * Logger Utility
 *
 * Provides log levels for cleaner output.
 * Set DEBUG=true or DEBUG=1 to enable verbose logging.
 *
 * @example
 * ```typescript
 * import { log } from '@lib/ai-agent/utils/logger';
 *
 * log.debug('[Yahoo]', 'Cache miss'); // Only shows if DEBUG=true
 * log.info('[PFV]', 'Calculated'); // Always shows
 * log.warn('[Cache]', 'Stale data'); // Always shows
 * log.error('[API]', 'Failed'); // Always shows
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDebug = (): boolean => {
  const debug = process.env.DEBUG;
  return debug === 'true' || debug === '1' || debug === 'yes';
};

const formatPrefix = (level: LogLevel): string => {
  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? '';
  const levelStr = level.toUpperCase().padEnd(5);
  return isDebug() ? `[${timestamp}] ${levelStr}` : '';
};

/**
 * Logger with debug/info/warn/error levels
 */
export const log = {
  /**
   * Debug level - only shows when DEBUG=true
   * Use for verbose operational logs (cache hits, API calls, etc.)
   */
  debug: (...args: unknown[]): void => {
    if (isDebug()) {
      console.log(formatPrefix('debug'), ...args);
    }
  },

  /**
   * Info level - always shows
   * Use for important status updates the user should see
   */
  info: (...args: unknown[]): void => {
    if (isDebug()) {
      console.log(formatPrefix('info'), ...args);
    } else {
      console.log(...args);
    }
  },

  /**
   * Warn level - always shows
   * Use for non-critical issues (stale data, fallbacks, etc.)
   */
  warn: (...args: unknown[]): void => {
    if (isDebug()) {
      console.warn(formatPrefix('warn'), ...args);
    } else {
      console.warn(...args);
    }
  },

  /**
   * Error level - always shows
   * Use for errors that affect functionality
   */
  error: (...args: unknown[]): void => {
    if (isDebug()) {
      console.error(formatPrefix('error'), ...args);
    } else {
      console.error(...args);
    }
  },

  /**
   * Check if debug mode is enabled
   */
  isDebug,
};

export default log;
