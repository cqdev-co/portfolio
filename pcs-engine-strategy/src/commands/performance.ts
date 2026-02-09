/**
 * PCS Performance Command
 *
 * Displays performance analytics for PCS trades.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { getPCSPerformance } from '../storage/supabase.ts';

export async function runPerformance(options: {
  verbose?: boolean;
}): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  console.log();
  console.log(chalk.bold.magenta('  PCS Performance Analytics'));
  console.log(chalk.gray('─'.repeat(50)));

  const perf = await getPCSPerformance();

  if (!perf || perf.totalTrades === 0) {
    console.log(chalk.yellow('  No closed PCS trades found'));
    console.log(chalk.gray('  Record trades using: bun run trade entry'));
    console.log();
    return;
  }

  const table = new Table({
    style: { head: [], border: ['gray'] },
  });

  table.push(
    { 'Total Trades': chalk.white(perf.totalTrades.toString()) },
    {
      'Win Rate': (perf.winRate >= 70
        ? chalk.green
        : perf.winRate >= 50
          ? chalk.yellow
          : chalk.red)(`${perf.winRate.toFixed(1)}%`),
    },
    { Winners: chalk.green(perf.winners.toString()) },
    { Losers: chalk.red(perf.losers.toString()) },
    {
      'Avg Return': (perf.avgReturn >= 0 ? chalk.green : chalk.red)(
        `${perf.avgReturn.toFixed(1)}%`
      ),
    },
    {
      'Total P&L': (perf.totalPnL >= 0 ? chalk.green : chalk.red)(
        `$${perf.totalPnL.toFixed(0)}`
      ),
    }
  );

  console.log(table.toString());

  // PCS-specific insights
  if (perf.winRate >= 70) {
    console.log(chalk.green('  Excellent win rate - strategy performing well'));
  } else if (perf.winRate >= 50) {
    console.log(chalk.yellow('  Average win rate - review entry criteria'));
  } else {
    console.log(chalk.red('  Low win rate - consider tightening criteria'));
  }

  console.log();
}
