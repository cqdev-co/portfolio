/**
 * PCS Trade Command
 *
 * Records trade entries and exits for PCS positions.
 */

import chalk from 'chalk';
import { logger } from '../utils/logger.ts';
import {
  recordPCSTradeEntry,
  recordPCSTradeExit,
} from '../storage/supabase.ts';

export interface TradeEntryOptions {
  ticker: string;
  shortStrike: number;
  longStrike: number;
  expiration: string;
  credit: number;
  contracts: number;
  ivRank?: number;
  score?: number;
  verbose?: boolean;
}

export interface TradeExitOptions {
  tradeId: string;
  debit: number;
  reason: string;
  verbose?: boolean;
}

/**
 * Record a new PCS trade entry
 */
export async function recordEntry(options: TradeEntryOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  console.log();
  console.log(chalk.bold.magenta('  PCS Trade Entry'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(
    chalk.white(`  ${options.ticker} `) +
      chalk.magenta(`Sell ${options.shortStrike}P / Buy ${options.longStrike}P`)
  );
  console.log(
    chalk.gray(`  Credit: `) + chalk.green(`$${options.credit.toFixed(2)}`)
  );
  console.log(
    chalk.gray(`  Contracts: `) + chalk.white(`${options.contracts}`)
  );
  console.log(chalk.gray(`  Expiration: `) + chalk.white(options.expiration));

  const width = options.shortStrike - options.longStrike;
  const maxLoss = (width - options.credit) * options.contracts * 100;
  const maxProfit = options.credit * options.contracts * 100;
  console.log(
    chalk.gray(`  Max Profit: `) + chalk.green(`$${maxProfit.toFixed(0)}`)
  );
  console.log(chalk.gray(`  Max Loss: `) + chalk.red(`$${maxLoss.toFixed(0)}`));

  const tradeId = await recordPCSTradeEntry({
    ticker: options.ticker,
    shortStrike: options.shortStrike,
    longStrike: options.longStrike,
    expiration: options.expiration,
    entryCredit: options.credit,
    contracts: options.contracts,
    entryDate: new Date().toISOString().split('T')[0] ?? '',
    ivRank: options.ivRank,
    totalScore: options.score,
  });

  if (tradeId) {
    console.log();
    console.log(chalk.green(`  Trade recorded: ${tradeId}`));
  } else {
    console.log();
    console.log(
      chalk.yellow('  Trade not saved (Supabase not configured or error)')
    );
  }
  console.log();
}

/**
 * Record a PCS trade exit
 */
export async function recordExit(options: TradeExitOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  console.log();
  console.log(chalk.bold.magenta('  PCS Trade Exit'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.gray(`  Trade ID: `) + chalk.white(options.tradeId));
  console.log(
    chalk.gray(`  Exit Debit: `) + chalk.red(`$${options.debit.toFixed(2)}`)
  );
  console.log(chalk.gray(`  Reason: `) + chalk.white(options.reason));

  await recordPCSTradeExit({
    tradeId: options.tradeId,
    exitDate: new Date().toISOString().split('T')[0] ?? '',
    exitDebit: options.debit,
    exitReason: options.reason,
  });

  console.log(chalk.green('  Exit recorded'));
  console.log();
}
