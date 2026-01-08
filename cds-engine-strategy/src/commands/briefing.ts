/**
 * Daily Briefing Command
 * v1.0.0: One-stop morning routine for CDS trading
 *
 * Combines:
 * - Market regime analysis
 * - Earnings proximity warnings
 * - Top opportunities from recent scans
 * - Watchlist alerts
 */

import chalk from 'chalk';
import { logger } from '../utils/logger.ts';
import { getMarketRegime } from '../utils/market-regime.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Metadata watchlist path (relative to monorepo root)
const WATCHLIST_PATH = join(
  process.cwd(),
  '..',
  '.github',
  'metadata',
  'watchlist.json'
);

interface WatchlistItem {
  ticker: string;
  targetAbove?: number;
  targetBelow?: number;
  notes?: string;
  lastPrice?: number;
  lastChecked?: string;
}

interface BriefingOptions {
  verbose?: boolean;
}

/**
 * Load watchlist from metadata file
 */
function loadWatchlist(): WatchlistItem[] {
  try {
    if (existsSync(WATCHLIST_PATH)) {
      const content = readFileSync(WATCHLIST_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    logger.debug(`Failed to load watchlist: ${error}`);
  }
  return [];
}

/**
 * Get earnings info for a ticker
 */
async function getEarningsInfo(
  ticker: string
): Promise<{ date: Date | null; daysUntil: number | null }> {
  try {
    const summary = await yahooProvider.getQuoteSummary(ticker);
    const earningsDates = summary?.calendarEvents?.earnings?.earningsDate ?? [];

    if (earningsDates.length > 0) {
      const now = Date.now();
      for (const dateVal of earningsDates) {
        const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (date.getTime() > now) {
          const daysUntil = Math.ceil(
            (date.getTime() - now) / (1000 * 60 * 60 * 24)
          );
          return { date, daysUntil };
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return { date: null, daysUntil: null };
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Main briefing command
 */
export async function showDailyBriefing(
  options: BriefingOptions
): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  console.log();
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan(`  DAILY BRIEFING - ${dateStr}`));
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log();

  // 1. Market Regime
  console.log(chalk.bold.white('📊 MARKET REGIME'));
  console.log(chalk.gray('─'.repeat(40)));

  try {
    const regime = await getMarketRegime();

    if (regime) {
      const regimeColor =
        regime.regime === 'bull'
          ? chalk.green
          : regime.regime === 'bear'
            ? chalk.red
            : chalk.yellow;

      const regimeEmoji =
        regime.regime === 'bull'
          ? '🟢'
          : regime.regime === 'bear'
            ? '🔴'
            : '🟡';

      console.log(
        `  ${regimeEmoji} ` +
          regimeColor(regime.regime.toUpperCase()) +
          chalk.gray(` | VIX: ${regime.vix?.toFixed(1) ?? 'N/A'}`)
      );
      console.log(
        chalk.gray(`  SPY: $${regime.spyPrice.toFixed(2)}`) +
          chalk.gray(` | 20d Return: ${(regime.return20d * 100).toFixed(1)}%`) +
          chalk.gray(` | 50d Return: ${(regime.return50d * 100).toFixed(1)}%`)
      );

      // Action recommendation
      if (regime.regime === 'bull') {
        console.log(chalk.green('  → Full position sizes. Look for entries.'));
      } else if (regime.regime === 'bear') {
        console.log(chalk.red('  → No new CDS positions. Consider hedges.'));
      } else {
        console.log(
          chalk.yellow('  → Grade A setups only. 50% position size.')
        );
      }
    } else {
      console.log(chalk.yellow('  ⚠️ Could not determine regime'));
    }
  } catch (error) {
    console.log(chalk.red('  ✗ Failed to fetch regime'));
    logger.debug(`Regime error: ${error}`);
  }

  console.log();

  // 2. Watchlist Alerts
  console.log(chalk.bold.white('👁️  WATCHLIST ALERTS'));
  console.log(chalk.gray('─'.repeat(40)));

  const watchlist = loadWatchlist();

  if (watchlist.length === 0) {
    console.log(chalk.gray('  No items in watchlist'));
    console.log(chalk.gray('  Add: Edit .github/metadata/watchlist.json'));
  } else {
    let alertCount = 0;

    for (const item of watchlist) {
      try {
        const quote = await yahooProvider.getQuote(item.ticker);
        const price = quote?.regularMarketPrice ?? 0;

        let alert = '';
        let alertColor = chalk.white;

        if (item.targetBelow && price <= item.targetBelow) {
          alert = `↓ HIT TARGET BELOW $${item.targetBelow}`;
          alertColor = chalk.green;
          alertCount++;
        } else if (item.targetAbove && price >= item.targetAbove) {
          alert = `↑ HIT TARGET ABOVE $${item.targetAbove}`;
          alertColor = chalk.red;
          alertCount++;
        }

        if (alert) {
          console.log(
            alertColor(`  🎯 ${item.ticker}: $${price.toFixed(2)} - ${alert}`)
          );
          if (item.notes) {
            console.log(chalk.gray(`     Note: ${item.notes}`));
          }
        }
      } catch {
        // Skip failed tickers
      }
    }

    if (alertCount === 0) {
      console.log(chalk.gray('  No price alerts triggered'));
      console.log(
        chalk.gray(`  Watching: ${watchlist.map((w) => w.ticker).join(', ')}`)
      );
    }
  }

  console.log();

  // 3. Earnings This Week
  console.log(chalk.bold.white('📅 EARNINGS PROXIMITY'));
  console.log(chalk.gray('─'.repeat(40)));

  const earningsToCheck =
    watchlist.length > 0
      ? watchlist.map((w) => w.ticker)
      : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'];

  const earningsAlerts: { ticker: string; days: number; date: Date }[] = [];

  for (const ticker of earningsToCheck) {
    const { date, daysUntil } = await getEarningsInfo(ticker);
    if (date && daysUntil !== null && daysUntil <= 14) {
      earningsAlerts.push({ ticker, days: daysUntil, date });
    }
  }

  earningsAlerts.sort((a, b) => a.days - b.days);

  if (earningsAlerts.length === 0) {
    console.log(chalk.gray('  No earnings within 14 days for watched stocks'));
  } else {
    for (const ea of earningsAlerts) {
      const urgency =
        ea.days <= 3 ? chalk.bold.red : ea.days <= 7 ? chalk.red : chalk.yellow;

      const action = ea.days <= 7 ? ' ← CLOSE POSITIONS' : '';

      console.log(
        urgency(
          `  ⚠️ ${ea.ticker}: ${formatDate(ea.date)} (${ea.days} days)${action}`
        )
      );
    }
  }

  console.log();

  // 4. Today's Action
  console.log(chalk.bold.white("🎯 TODAY'S ACTION"));
  console.log(chalk.gray('─'.repeat(40)));

  // Determine action based on regime
  try {
    const regime = await getMarketRegime();

    if (regime?.regime === 'bull') {
      console.log(chalk.green('  ✅ Run full scan: bun run cds:scan-all'));
      console.log(chalk.gray('     Look for setups with score ≥70'));
    } else if (regime?.regime === 'bear') {
      console.log(chalk.red('  🛑 No new CDS positions today'));
      console.log(
        chalk.gray('     Consider: Review existing positions for exits')
      );
    } else {
      console.log(chalk.yellow('  ⚠️ Selective mode: Only Grade A setups'));
      console.log(chalk.gray('     Run: bun run cds:scan --min-score 80'));
    }
  } catch {
    console.log(chalk.gray('  Run: bun run cds:regime to check market'));
  }

  console.log();
  console.log(chalk.bold.cyan('═'.repeat(60)));
  console.log();
}
