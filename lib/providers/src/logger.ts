import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const LOG_PREFIXES: Record<LogLevel, string> = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✓'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✗'),
  debug: chalk.gray('⋯'),
};

/**
 * Shared logger for provider modules.
 * Can be used standalone or engines can provide their own logger.
 */
export interface ProviderLogger {
  info(message: string, ...args: unknown[]): void;
  success(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

class DefaultLogger implements ProviderLogger {
  private verbose = false;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`${LOG_PREFIXES.info} ${message}`, ...args);
  }

  success(message: string, ...args: unknown[]): void {
    console.log(`${LOG_PREFIXES.success} ${chalk.green(message)}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.log(`${LOG_PREFIXES.warn} ${chalk.yellow(message)}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${LOG_PREFIXES.error} ${chalk.red(message)}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.verbose) {
      console.log(`${LOG_PREFIXES.debug} ${chalk.gray(message)}`, ...args);
    }
  }
}

export const logger = new DefaultLogger();
