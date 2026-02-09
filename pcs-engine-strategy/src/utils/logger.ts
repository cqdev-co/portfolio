import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

const LOG_PREFIXES: Record<LogLevel, string> = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✓'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✗'),
  debug: chalk.gray('⋯'),
};

class Logger {
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

  ticker(symbol: string, score: number, signals: string[]): void {
    const scoreColor =
      score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
    console.log(
      `  ${chalk.bold(symbol.padEnd(6))} ` +
        `${scoreColor(score.toString().padStart(3))} pts  ` +
        `${chalk.gray(signals.slice(0, 3).join(', '))}`
    );
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(60)));
  }

  header(title: string): void {
    console.log();
    console.log(chalk.bold.cyan(title));
    this.divider();
  }
}

export const logger = new Logger();
