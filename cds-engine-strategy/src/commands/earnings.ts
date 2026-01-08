/**
 * Earnings Calendar Command
 * v2.6.0: Display upcoming earnings for tracked stocks
 *
 * Features:
 * - Show earnings dates for watchlist
 * - Show earnings for any ticker list
 * - Color-coded by proximity (red = soon, yellow = within week)
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface EarningsInfo {
  ticker: string;
  earningsDate: Date | null;
  daysUntil: number | null;
  price: number;
  score?: number;
}

// Local watchlist path
const LOCAL_WATCHLIST_PATH = join(process.cwd(), '.watchlist.json');

/**
 * Fetch watchlist tickers
 */
async function getWatchlistTickers(): Promise<string[]> {
  if (existsSync(LOCAL_WATCHLIST_PATH)) {
    try {
      const content = readFileSync(LOCAL_WATCHLIST_PATH, 'utf-8');
      const watchlist = JSON.parse(content);
      return watchlist.items?.map((i: { ticker: string }) => i.ticker) ?? [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Get earnings date from Yahoo Finance
 */
async function getEarningsInfo(ticker: string): Promise<EarningsInfo> {
  const result: EarningsInfo = {
    ticker,
    earningsDate: null,
    daysUntil: null,
    price: 0,
  };

  try {
    const [quote, summary] = await Promise.all([
      yahooProvider.getQuote(ticker),
      yahooProvider.getQuoteSummary(ticker),
    ]);

    result.price = quote?.regularMarketPrice ?? 0;

    // Extract earnings date from calendarEvents
    const earningsDates = summary?.calendarEvents?.earnings?.earningsDate ?? [];
    if (earningsDates.length > 0) {
      // Find nearest future earnings date
      const now = Date.now();
      for (const dateVal of earningsDates) {
        const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (date.getTime() > now) {
          result.earningsDate = date;
          result.daysUntil = Math.ceil(
            (date.getTime() - now) / (1000 * 60 * 60 * 24)
          );
          break;
        }
      }
    }
  } catch (error) {
    logger.debug(`Failed to get earnings for ${ticker}: ${error}`);
  }

  return result;
}

/**
 * Format days until earnings with color
 */
function formatDaysUntil(days: number | null): string {
  if (days === null) return chalk.gray('Unknown');

  if (days <= 0) return chalk.bold.red('TODAY');
  if (days <= 3) return chalk.bold.red(`${days} days ⚠️`);
  if (days <= 7) return chalk.yellow(`${days} days`);
  if (days <= 14) return chalk.cyan(`${days} days`);
  return chalk.gray(`${days} days`);
}

/**
 * Format date
 */
function formatDate(date: Date | null): string {
  if (!date) return chalk.gray('-');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface EarningsOptions {
  list?: string;
  tickers?: string;
  watchlist?: boolean;
  days?: number;
  verbose?: boolean;
}

/**
 * Main earnings calendar command
 */
export async function showEarningsCalendar(
  options: EarningsOptions
): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const daysFilter = options.days ?? 30;

  console.log();
  console.log(chalk.bold.cyan('  📅 Earnings Calendar'));
  console.log(chalk.gray(`  Showing earnings within ${daysFilter} days`));
  console.log();

  // Get ticker list
  let tickers: string[] = [];
  let sourceDesc: string;

  if (options.tickers) {
    tickers = options.tickers.split(',').map((t) => t.trim().toUpperCase());
    sourceDesc = 'specified tickers';
  } else if (options.watchlist) {
    tickers = await getWatchlistTickers();
    if (tickers.length === 0) {
      console.log(chalk.yellow('  Watchlist is empty'));
      console.log(chalk.gray('  Add tickers: bun run watchlist add AAPL'));
      console.log();
      return;
    }
    sourceDesc = 'watchlist';
  } else {
    // Default to some common tickers
    tickers = [
      'AAPL',
      'MSFT',
      'GOOGL',
      'AMZN',
      'META',
      'NVDA',
      'TSLA',
      'AMD',
      'NFLX',
      'CRM',
    ];
    sourceDesc = 'default list';
  }

  console.log(
    chalk.gray(`  Source: ${sourceDesc} (${tickers.length} tickers)`)
  );
  console.log();

  // Fetch earnings info
  const results: EarningsInfo[] = [];

  for (const ticker of tickers) {
    process.stdout.write(chalk.gray(`  Checking ${ticker}...`));

    const info = await getEarningsInfo(ticker);
    results.push(info);

    if (info.earningsDate) {
      console.log(chalk.green(` ${formatDate(info.earningsDate)}`));
    } else {
      console.log(chalk.gray(' no date'));
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  // Filter to those within days filter and with dates
  const upcoming = results
    .filter((r) => r.daysUntil !== null && r.daysUntil <= daysFilter)
    .sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));

  const noDate = results.filter((r) => r.earningsDate === null);
  const beyondFilter = results.filter(
    (r) => r.daysUntil !== null && r.daysUntil > daysFilter
  );

  // Display results
  console.log();
  console.log(chalk.gray('─'.repeat(56)));
  console.log();

  if (upcoming.length === 0) {
    console.log(
      chalk.yellow(`  No earnings within ${daysFilter} days for tracked stocks`)
    );
    console.log();
    return;
  }

  // Earnings table
  const table = new Table({
    head: [
      chalk.cyan('Ticker'),
      chalk.cyan('Price'),
      chalk.cyan('Earnings Date'),
      chalk.cyan('Days Until'),
      chalk.cyan('Alert'),
    ],
    colWidths: [8, 10, 18, 14, 20],
    style: { head: [], border: ['gray'] },
  });

  for (const r of upcoming) {
    // Alert for positions that should be closed
    let alert = '';
    if (r.daysUntil !== null && r.daysUntil <= 7) {
      alert = chalk.red('Close positions!');
    } else if (r.daysUntil !== null && r.daysUntil <= 14) {
      alert = chalk.yellow('Plan exit');
    }

    table.push([
      chalk.bold(r.ticker),
      chalk.white(`$${r.price.toFixed(2)}`),
      formatDate(r.earningsDate),
      formatDaysUntil(r.daysUntil),
      alert,
    ]);
  }

  console.log(table.toString());

  // Warnings section
  const imminent = upcoming.filter(
    (r) => r.daysUntil !== null && r.daysUntil <= 7
  );
  if (imminent.length > 0) {
    console.log();
    console.log(chalk.bold.red('  ⚠️  EARNINGS IMMINENT - CLOSE POSITIONS:'));
    for (const r of imminent) {
      console.log(
        chalk.red(
          `     ${r.ticker}: ${formatDate(r.earningsDate)} (${r.daysUntil} days)`
        )
      );
    }
  }

  // Summary
  console.log();
  console.log(chalk.gray(`  Summary:`));
  console.log(
    chalk.gray(`    • ${upcoming.length} earnings within ${daysFilter} days`)
  );
  if (imminent.length > 0) {
    console.log(
      chalk.red(`    • ${imminent.length} within 7 days (close positions!)`)
    );
  }
  if (beyondFilter.length > 0) {
    console.log(
      chalk.gray(`    • ${beyondFilter.length} beyond ${daysFilter} days`)
    );
  }
  if (noDate.length > 0) {
    console.log(chalk.gray(`    • ${noDate.length} with no earnings date`));
  }

  console.log();
}
