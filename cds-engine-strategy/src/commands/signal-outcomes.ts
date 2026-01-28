/**
 * Signal Outcomes Command
 * v1.0.0: Automatic signal outcome tracking for CI/CD
 *
 * Checks pending signals to see if they hit their target prices.
 * Used by the weekly report workflow to validate scanner accuracy.
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import {
  isConfigured,
  getPendingSignals,
  updateSignalOutcome,
  getSignalAccuracy,
  type PendingSignal,
} from '../storage/supabase.ts';

interface OutcomeCheckResult {
  signal: PendingSignal;
  currentPrice: number;
  highPrice: number;
  maxGainPct: number;
  status: 'target_hit' | 'target_missed' | 'pending' | 'expired';
  daysElapsed: number;
}

/**
 * Check signal outcomes against current/historical prices
 */
export async function checkSignalOutcomes(options: {
  minAgeDays?: number;
  maxAgeDays?: number;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<void> {
  const {
    minAgeDays = 7,
    maxAgeDays = 60,
    dryRun = false,
    verbose = false,
  } = options;

  console.log(chalk.bold('\n📊 Signal Outcome Tracker\n'));

  if (!isConfigured()) {
    logger.error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
    );
    return;
  }

  // Get pending signals
  console.log(
    chalk.gray(`  Fetching signals ${minAgeDays}-${maxAgeDays} days old...`)
  );
  const pendingSignals = await getPendingSignals(minAgeDays, maxAgeDays);

  if (pendingSignals.length === 0) {
    console.log(chalk.yellow('  No pending signals to check.'));
    await displayAccuracyReport();
    return;
  }

  console.log(
    chalk.gray(`  Found ${pendingSignals.length} signals to check\n`)
  );

  // Get unique tickers
  const tickers = [...new Set(pendingSignals.map((s) => s.ticker))];

  // Fetch current prices and historical highs
  console.log(
    chalk.gray(`  Fetching price data for ${tickers.length} tickers...`)
  );
  const priceData = await fetchPriceData(tickers, maxAgeDays);

  // Check each signal
  const results: OutcomeCheckResult[] = [];
  let updated = 0;
  let hits = 0;
  let misses = 0;

  for (const signal of pendingSignals) {
    const prices = priceData.get(signal.ticker);
    if (!prices) {
      if (verbose) {
        console.log(chalk.gray(`  Skipping ${signal.ticker}: no price data`));
      }
      continue;
    }

    const daysElapsed = Math.floor(
      (Date.now() - new Date(signal.signalDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Calculate max gain from signal price
    const maxGainPct =
      (prices.highSinceSignal - signal.priceAtSignal) / signal.priceAtSignal;

    // Determine outcome
    let status: OutcomeCheckResult['status'] = 'pending';
    const targetPrice = signal.targetPrice ?? signal.priceAtSignal * 1.15; // Default 15% target

    if (prices.highSinceSignal >= targetPrice) {
      status = 'target_hit';
      hits++;
    } else if (daysElapsed >= maxAgeDays) {
      status = 'expired';
      misses++;
    } else if (prices.currentPrice < signal.priceAtSignal * 0.9) {
      // Lost more than 10% - mark as missed
      status = 'target_missed';
      misses++;
    }

    const result: OutcomeCheckResult = {
      signal,
      currentPrice: prices.currentPrice,
      highPrice: prices.highSinceSignal,
      maxGainPct,
      status,
      daysElapsed,
    };
    results.push(result);

    // Update database if not dry run and outcome determined
    if (!dryRun && status !== 'pending') {
      const success = await updateSignalOutcome(signal.id, {
        status: status === 'expired' ? 'target_missed' : status,
        outcomeDate: new Date(),
        outcomePrice: prices.currentPrice,
        maxPriceSeen: prices.highSinceSignal,
        maxGainPct,
      });
      if (success) updated++;
    }
  }

  // Display results
  displayResults(results, verbose);

  // Summary
  console.log(chalk.bold('\n📈 Session Summary'));
  console.log(chalk.gray('  ─────────────────────────'));
  console.log(`  Signals checked: ${results.length}`);
  console.log(`  Target hits: ${chalk.green(hits.toString())}`);
  console.log(`  Misses/Expired: ${chalk.red(misses.toString())}`);
  if (!dryRun) {
    console.log(`  Database updated: ${updated}`);
  } else {
    console.log(chalk.yellow('  (Dry run - no updates made)'));
  }

  // Show accuracy report
  await displayAccuracyReport();
}

/**
 * Fetch current prices and historical highs for tickers
 */
async function fetchPriceData(
  tickers: string[],
  lookbackDays: number
): Promise<Map<string, { currentPrice: number; highSinceSignal: number }>> {
  const result = new Map<
    string,
    { currentPrice: number; highSinceSignal: number }
  >();

  for (const ticker of tickers) {
    try {
      // Get current quote
      const quote = await yahooProvider.getQuote(ticker);
      if (!quote || quote.regularMarketPrice === undefined) continue;

      const currentPrice = quote.regularMarketPrice;

      // Get historical data for high price
      const historical = await yahooProvider.getHistorical(ticker);
      if (!historical || historical.length === 0) {
        result.set(ticker, {
          currentPrice,
          highSinceSignal: currentPrice,
        });
        continue;
      }

      // Filter to lookback period and find high
      const cutoffDate = new Date(
        Date.now() - lookbackDays * 24 * 60 * 60 * 1000
      );
      const recentBars = historical.filter((bar) => bar.date >= cutoffDate);

      let highSinceSignal: number = currentPrice;
      for (const bar of recentBars) {
        if (bar.high > highSinceSignal) {
          highSinceSignal = bar.high;
        }
      }

      result.set(ticker, {
        currentPrice,
        highSinceSignal,
      });
    } catch {
      // Skip tickers with errors
    }
  }

  return result;
}

/**
 * Display outcome check results
 */
function displayResults(results: OutcomeCheckResult[], verbose: boolean): void {
  // Group by status
  const hits = results.filter((r) => r.status === 'target_hit');
  const misses = results.filter(
    (r) => r.status === 'target_missed' || r.status === 'expired'
  );
  const pending = results.filter((r) => r.status === 'pending');

  if (hits.length > 0) {
    console.log(chalk.bold.green('\n✅ Target Hits'));
    const table = new Table({
      head: [
        'Ticker',
        'Grade',
        'Signal Date',
        'Entry',
        'Target',
        'High',
        'Gain',
        'Days',
      ],
      style: { head: ['cyan'] },
    });

    for (const r of hits) {
      table.push([
        r.signal.ticker,
        r.signal.signalGrade,
        r.signal.signalDate,
        `$${r.signal.priceAtSignal.toFixed(2)}`,
        `$${(r.signal.targetPrice ?? 0).toFixed(2)}`,
        `$${r.highPrice.toFixed(2)}`,
        chalk.green(`+${(r.maxGainPct * 100).toFixed(1)}%`),
        r.daysElapsed.toString(),
      ]);
    }
    console.log(table.toString());
  }

  if (misses.length > 0 && verbose) {
    console.log(chalk.bold.red('\n❌ Misses/Expired'));
    const table = new Table({
      head: [
        'Ticker',
        'Grade',
        'Signal Date',
        'Entry',
        'Target',
        'Current',
        'Max Gain',
        'Days',
      ],
      style: { head: ['cyan'] },
    });

    for (const r of misses) {
      const gainColor = r.maxGainPct >= 0 ? chalk.green : chalk.red;
      table.push([
        r.signal.ticker,
        r.signal.signalGrade,
        r.signal.signalDate,
        `$${r.signal.priceAtSignal.toFixed(2)}`,
        `$${(r.signal.targetPrice ?? 0).toFixed(2)}`,
        `$${r.currentPrice.toFixed(2)}`,
        gainColor(
          `${r.maxGainPct >= 0 ? '+' : ''}${(r.maxGainPct * 100).toFixed(1)}%`
        ),
        r.daysElapsed.toString(),
      ]);
    }
    console.log(table.toString());
  }

  if (pending.length > 0 && verbose) {
    console.log(
      chalk.bold.yellow(`\n⏳ Still Pending: ${pending.length} signals`)
    );
  }
}

/**
 * Display signal accuracy report
 */
async function displayAccuracyReport(): Promise<void> {
  console.log(chalk.bold('\n📊 Signal Accuracy Report'));
  console.log(chalk.gray('  ─────────────────────────'));

  const accuracy = await getSignalAccuracy();

  if (accuracy.length === 0) {
    console.log(chalk.gray('  No outcome data available yet.'));
    return;
  }

  // Group by grade for summary
  const byGrade = new Map<
    string,
    { hits: number; misses: number; pending: number }
  >();
  for (const a of accuracy) {
    if (!byGrade.has(a.grade)) {
      byGrade.set(a.grade, { hits: 0, misses: 0, pending: 0 });
    }
    const g = byGrade.get(a.grade)!;
    g.hits += a.hits;
    g.misses += a.misses;
    g.pending += a.pending;
  }

  const table = new Table({
    head: ['Grade', 'Signals', 'Hits', 'Misses', 'Pending', 'Accuracy'],
    style: { head: ['cyan'] },
  });

  for (const [grade, stats] of Array.from(byGrade.entries()).sort()) {
    const total = stats.hits + stats.misses + stats.pending;
    const resolved = stats.hits + stats.misses;
    const accuracyPct = resolved > 0 ? (stats.hits / resolved) * 100 : null;

    const accuracyColor =
      accuracyPct === null
        ? chalk.gray
        : accuracyPct >= 60
          ? chalk.green
          : accuracyPct >= 40
            ? chalk.yellow
            : chalk.red;

    table.push([
      chalk.bold(grade),
      total.toString(),
      chalk.green(stats.hits.toString()),
      chalk.red(stats.misses.toString()),
      chalk.gray(stats.pending.toString()),
      accuracyPct !== null
        ? accuracyColor(`${accuracyPct.toFixed(1)}%`)
        : chalk.gray('--'),
    ]);
  }

  console.log(table.toString());
}

/**
 * CLI entry point
 */
export function registerSignalOutcomesCommand(
  program: import('commander').Command
): void {
  program
    .command('signal-outcomes')
    .description('Check and update signal outcomes for accuracy tracking')
    .option('--min-age <days>', 'Minimum signal age to check (default: 7)', '7')
    .option(
      '--max-age <days>',
      'Maximum signal age to check (default: 60)',
      '60'
    )
    .option('--dry-run', 'Check outcomes without updating database')
    .option('-v, --verbose', 'Show detailed output including misses')
    .action(async (opts) => {
      await checkSignalOutcomes({
        minAgeDays: parseInt(opts.minAge, 10),
        maxAgeDays: parseInt(opts.maxAge, 10),
        dryRun: opts.dryRun ?? false,
        verbose: opts.verbose ?? false,
      });
    });
}
