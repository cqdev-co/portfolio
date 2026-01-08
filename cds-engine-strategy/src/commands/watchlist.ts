/**
 * Watchlist Command
 * v2.7.0: Manage watchlist using .github/metadata/watchlist.json
 *
 * Features:
 * - Add/remove tickers from watchlist
 * - Set price alerts (above/below targets)
 * - Check alerts and display triggered ones
 * - Uses git-tracked metadata file for version control
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// Metadata watchlist path (relative to monorepo root)
const WATCHLIST_PATH = join(
  process.cwd(),
  '..',
  '.github',
  'metadata',
  'watchlist.json'
);

export interface WatchlistItem {
  ticker: string;
  targetAbove?: number;
  targetBelow?: number;
  notes?: string;
  lastPrice?: number;
  lastChecked?: string;
  addedAt?: string;
}

/**
 * Load watchlist from metadata file
 */
function loadWatchlist(): WatchlistItem[] {
  try {
    if (existsSync(WATCHLIST_PATH)) {
      const content = readFileSync(WATCHLIST_PATH, 'utf-8');
      return JSON.parse(content) as WatchlistItem[];
    }
  } catch (error) {
    logger.debug(`Failed to load watchlist: ${error}`);
  }
  return [];
}

/**
 * Save watchlist to metadata file
 */
function saveWatchlist(items: WatchlistItem[]): void {
  try {
    // Ensure directory exists
    const dir = dirname(WATCHLIST_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(WATCHLIST_PATH, JSON.stringify(items, null, 4));
    logger.debug(`Saved watchlist to ${WATCHLIST_PATH}`);
  } catch (error) {
    logger.error(`Failed to save watchlist: ${error}`);
  }
}

/**
 * Add ticker to watchlist
 */
export async function addToWatchlist(
  ticker: string,
  options: {
    targetAbove?: number;
    targetBelow?: number;
    notes?: string;
  } = {}
): Promise<void> {
  const symbol = ticker.toUpperCase();
  const watchlist = loadWatchlist();

  // Check if already exists
  const existingIdx = watchlist.findIndex((i) => i.ticker === symbol);

  if (existingIdx >= 0) {
    // Update existing
    const existing = watchlist[existingIdx];
    if (existing) {
      existing.targetAbove = options.targetAbove ?? existing.targetAbove;
      existing.targetBelow = options.targetBelow ?? existing.targetBelow;
      existing.notes = options.notes ?? existing.notes;
    }
    console.log(chalk.yellow(`  Updated ${symbol} in watchlist`));
  } else {
    // Add new
    watchlist.push({
      ticker: symbol,
      targetAbove: options.targetAbove,
      targetBelow: options.targetBelow,
      notes: options.notes,
      addedAt: new Date().toISOString().split('T')[0],
    });
    console.log(chalk.green(`  Added ${symbol} to watchlist`));
  }

  saveWatchlist(watchlist);
  console.log(chalk.gray(`  File: .github/metadata/watchlist.json`));
}

/**
 * Remove ticker from watchlist
 */
export async function removeFromWatchlist(ticker: string): Promise<void> {
  const symbol = ticker.toUpperCase();
  const watchlist = loadWatchlist();

  const idx = watchlist.findIndex((i) => i.ticker === symbol);
  if (idx === -1) {
    console.log(chalk.yellow(`  ${symbol} not in watchlist`));
    return;
  }

  watchlist.splice(idx, 1);
  saveWatchlist(watchlist);

  console.log(chalk.green(`  Removed ${symbol} from watchlist`));
}

/**
 * Check watchlist for triggered alerts
 */
export async function checkWatchlist(options: {
  verbose?: boolean;
}): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const watchlist = loadWatchlist();

  if (watchlist.length === 0) {
    console.log();
    console.log(chalk.yellow('  Watchlist is empty'));
    console.log(chalk.gray('  Add tickers: bun run watchlist add AAPL'));
    console.log(
      chalk.gray('  With alerts: bun run watchlist add AAPL --above 200')
    );
    console.log(chalk.gray('  Or edit: .github/metadata/watchlist.json'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.bold.cyan('  📋 Watchlist'));
  console.log(chalk.gray(`  ${watchlist.length} items`));
  console.log();

  const alerts: Array<{
    ticker: string;
    message: string;
    type: 'above' | 'below';
  }> = [];

  const table = new Table({
    head: [
      chalk.cyan('Ticker'),
      chalk.cyan('Price'),
      chalk.cyan('Alert ↑'),
      chalk.cyan('Alert ↓'),
      chalk.cyan('Status'),
      chalk.cyan('Notes'),
    ],
    colWidths: [8, 10, 10, 10, 12, 30],
    style: { head: [], border: ['gray'] },
  });

  for (const item of watchlist) {
    process.stdout.write(chalk.gray(`  Checking ${item.ticker}...`));

    try {
      const quote = await yahooProvider.getQuote(item.ticker);
      const price = quote?.regularMarketPrice;

      if (!price) {
        console.log(chalk.yellow(' no data'));
        continue;
      }

      // Update last price
      item.lastPrice = price;
      item.lastChecked = new Date().toISOString().split('T')[0];

      // Check alerts
      let status = chalk.gray('OK');

      if (item.targetAbove && price >= item.targetAbove) {
        status = chalk.green('↑ TRIGGERED');
        alerts.push({
          ticker: item.ticker,
          message: `Price $${price.toFixed(2)} ≥ target $${item.targetAbove}`,
          type: 'above',
        });
      } else if (item.targetBelow && price <= item.targetBelow) {
        status = chalk.red('↓ TRIGGERED');
        alerts.push({
          ticker: item.ticker,
          message: `Price $${price.toFixed(2)} ≤ target $${item.targetBelow}`,
          type: 'below',
        });
      } else if (item.targetAbove && item.targetBelow) {
        // Show distance to nearest alert
        const distAbove = ((item.targetAbove - price) / item.targetAbove) * 100;
        const distBelow = ((price - item.targetBelow) / item.targetBelow) * 100;
        if (distAbove < distBelow) {
          status = chalk.yellow(`${distAbove.toFixed(1)}% to ↑`);
        } else {
          status = chalk.yellow(`${distBelow.toFixed(1)}% to ↓`);
        }
      } else if (item.targetAbove) {
        const dist = ((item.targetAbove - price) / item.targetAbove) * 100;
        status = chalk.gray(`${dist.toFixed(1)}% to ↑`);
      } else if (item.targetBelow) {
        const dist = ((price - item.targetBelow) / item.targetBelow) * 100;
        status = chalk.gray(`${dist.toFixed(1)}% to ↓`);
      }

      table.push([
        chalk.bold(item.ticker),
        chalk.white(`$${price.toFixed(2)}`),
        item.targetAbove
          ? chalk.green(`$${item.targetAbove}`)
          : chalk.gray('-'),
        item.targetBelow ? chalk.red(`$${item.targetBelow}`) : chalk.gray('-'),
        status,
        chalk.gray((item.notes ?? '').slice(0, 28)),
      ]);

      console.log(chalk.green(' ✓'));
    } catch (error) {
      console.log(chalk.red(' ✗'));
      logger.debug(`Failed: ${error}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  // Save updated prices
  saveWatchlist(watchlist);

  console.log();
  console.log(table.toString());

  // Show triggered alerts prominently
  if (alerts.length > 0) {
    console.log();
    console.log(chalk.bold.yellow('  🔔 ALERTS TRIGGERED:'));
    for (const alert of alerts) {
      const icon = alert.type === 'above' ? '📈' : '📉';
      console.log(
        chalk.bold(`  ${icon} ${alert.ticker}: `) + chalk.white(alert.message)
      );
    }
  }

  console.log();
}

/**
 * Show watchlist without checking prices
 */
export async function showWatchlist(): Promise<void> {
  const watchlist = loadWatchlist();

  if (watchlist.length === 0) {
    console.log();
    console.log(chalk.yellow('  Watchlist is empty'));
    console.log(chalk.gray('  Edit: .github/metadata/watchlist.json'));
    return;
  }

  console.log();
  console.log(chalk.bold.cyan('  📋 Watchlist'));
  console.log(chalk.gray(`  Source: .github/metadata/watchlist.json`));
  console.log();

  const table = new Table({
    head: [
      chalk.cyan('Ticker'),
      chalk.cyan('Last Price'),
      chalk.cyan('Alert ↑'),
      chalk.cyan('Alert ↓'),
      chalk.cyan('Added'),
      chalk.cyan('Notes'),
    ],
    colWidths: [8, 12, 10, 10, 12, 30],
    style: { head: [], border: ['gray'] },
  });

  for (const item of watchlist) {
    table.push([
      chalk.bold(item.ticker),
      item.lastPrice
        ? chalk.white(`$${item.lastPrice.toFixed(2)}`)
        : chalk.gray('-'),
      item.targetAbove ? chalk.green(`$${item.targetAbove}`) : chalk.gray('-'),
      item.targetBelow ? chalk.red(`$${item.targetBelow}`) : chalk.gray('-'),
      chalk.gray(item.addedAt ?? item.lastChecked ?? '-'),
      chalk.gray((item.notes ?? '').slice(0, 28)),
    ]);
  }

  console.log(table.toString());
  console.log();
}

/**
 * Get watchlist tickers (for use by other commands)
 */
export function getWatchlistTickers(): string[] {
  const watchlist = loadWatchlist();
  return watchlist.map((item) => item.ticker);
}
