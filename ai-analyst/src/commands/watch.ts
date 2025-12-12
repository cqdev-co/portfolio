/**
 * Watchlist Command
 * Manage tickers to monitor for opportunities
 */

import chalk from "chalk";
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  configureWatchlistItem,
  isConfigured,
  type WatchlistItem,
} from "../services/supabase.ts";

// ============================================================================
// LIST COMMAND
// ============================================================================

/**
 * Display current watchlist
 */
export async function listWatchlist(): Promise<void> {
  console.log();
  console.log(chalk.bold.white("  📋 WATCHLIST"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  if (!isConfigured()) {
    console.log(chalk.yellow("  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"));
    console.log();
    return;
  }

  const watchlist = await getWatchlist();

  if (watchlist.length === 0) {
    console.log(chalk.gray("  No tickers in watchlist."));
    console.log();
    console.log(chalk.gray("  Add tickers with: bun run analyst watch add NVDA AAPL GOOGL"));
    console.log();
    return;
  }

  // Header
  console.log(
    chalk.gray("  ") +
    chalk.bold.white("Ticker".padEnd(8)) +
    chalk.bold.white("RSI Range".padEnd(12)) +
    chalk.bold.white("IV%".padEnd(6)) +
    chalk.bold.white("Cushion".padEnd(9)) +
    chalk.bold.white("Grade".padEnd(7)) +
    chalk.bold.white("Notes")
  );
  console.log(chalk.gray("  " + "─".repeat(60)));

  for (const item of watchlist) {
    const rsiRange = `${item.targetRsiLow}-${item.targetRsiHigh}`;
    const ivPct = `${item.targetIvPercentile}%`;
    const cushion = `${item.minCushionPct}%`;
    const notes = item.notes ? item.notes.substring(0, 20) : "";

    console.log(
      chalk.gray("  ") +
      chalk.cyan(item.ticker.padEnd(8)) +
      chalk.white(rsiRange.padEnd(12)) +
      chalk.white(ivPct.padEnd(6)) +
      chalk.white(cushion.padEnd(9)) +
      chalk.white(item.minGrade.padEnd(7)) +
      chalk.gray(notes)
    );
  }

  console.log();
  console.log(chalk.gray(`  ${watchlist.length} ticker(s) being monitored`));
  console.log();
}

// ============================================================================
// ADD COMMAND
// ============================================================================

export interface AddWatchOptions {
  rsiLow?: number;
  rsiHigh?: number;
  ivPercentile?: number;
  cushion?: number;
  grade?: string;
  notes?: string;
}

/**
 * Add tickers to watchlist
 */
export async function addToWatch(
  tickers: string[], 
  options: AddWatchOptions = {}
): Promise<void> {
  console.log();
  console.log(chalk.bold.white("  ➕ ADD TO WATCHLIST"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  if (!isConfigured()) {
    console.log(chalk.yellow("  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"));
    console.log();
    return;
  }

  if (tickers.length === 0) {
    console.log(chalk.yellow("  ⚠️  No tickers provided"));
    console.log();
    console.log(chalk.gray("  Usage: bun run analyst watch add NVDA AAPL GOOGL"));
    console.log();
    return;
  }

  const results = await addToWatchlist(tickers, {
    targetRsiLow: options.rsiLow,
    targetRsiHigh: options.rsiHigh,
    targetIvPercentile: options.ivPercentile,
    minCushionPct: options.cushion,
    minGrade: options.grade,
    notes: options.notes,
  });

  for (const item of results) {
    console.log(chalk.green(`  ✓ Added ${item.ticker}`));
  }

  const failed = tickers.filter(
    t => !results.some(r => r.ticker === t.toUpperCase())
  );
  for (const ticker of failed) {
    console.log(chalk.red(`  ✗ Failed to add ${ticker.toUpperCase()}`));
  }

  console.log();
  console.log(chalk.gray(`  ${results.length} ticker(s) added to watchlist`));
  console.log();
}

// ============================================================================
// REMOVE COMMAND
// ============================================================================

/**
 * Remove ticker from watchlist
 */
export async function removeFromWatch(ticker: string): Promise<void> {
  console.log();
  console.log(chalk.bold.white("  ➖ REMOVE FROM WATCHLIST"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  if (!isConfigured()) {
    console.log(chalk.yellow("  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"));
    console.log();
    return;
  }

  const success = await removeFromWatchlist(ticker);

  if (success) {
    console.log(chalk.green(`  ✓ Removed ${ticker.toUpperCase()} from watchlist`));
  } else {
    console.log(chalk.red(`  ✗ Failed to remove ${ticker.toUpperCase()}`));
  }

  console.log();
}

// ============================================================================
// CONFIGURE COMMAND
// ============================================================================

export interface ConfigureWatchOptions {
  rsiLow?: number;
  rsiHigh?: number;
  ivPercentile?: number;
  cushion?: number;
  grade?: string;
  notes?: string;
  active?: boolean;
}

/**
 * Configure watchlist item thresholds
 */
export async function configureWatch(
  ticker: string,
  options: ConfigureWatchOptions
): Promise<void> {
  console.log();
  console.log(chalk.bold.white("  ⚙️  CONFIGURE WATCHLIST ITEM"));
  console.log(chalk.gray("  ────────────────────────────────────────────────────────────────────"));
  console.log();

  if (!isConfigured()) {
    console.log(chalk.yellow("  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"));
    console.log();
    return;
  }

  // Check if any options were provided
  const hasOptions = Object.values(options).some(v => v !== undefined);
  if (!hasOptions) {
    console.log(chalk.yellow("  ⚠️  No configuration options provided"));
    console.log();
    console.log(chalk.gray("  Options:"));
    console.log(chalk.gray("    --rsi-low <n>       Minimum RSI threshold (default: 35)"));
    console.log(chalk.gray("    --rsi-high <n>      Maximum RSI threshold (default: 55)"));
    console.log(chalk.gray("    --iv <n>            IV percentile threshold (default: 50)"));
    console.log(chalk.gray("    --cushion <n>       Minimum cushion % (default: 8)"));
    console.log(chalk.gray("    --grade <g>         Minimum grade (default: B)"));
    console.log(chalk.gray("    --notes <text>      Notes about this ticker"));
    console.log(chalk.gray("    --active/--inactive Enable/disable monitoring"));
    console.log();
    return;
  }

  const result = await configureWatchlistItem(ticker, {
    targetRsiLow: options.rsiLow,
    targetRsiHigh: options.rsiHigh,
    targetIvPercentile: options.ivPercentile,
    minCushionPct: options.cushion,
    minGrade: options.grade,
    notes: options.notes,
    active: options.active,
  });

  if (result) {
    console.log(chalk.green(`  ✓ Updated ${result.ticker}`));
    console.log();
    console.log(chalk.gray("  Current settings:"));
    console.log(chalk.gray(`    RSI Range: ${result.targetRsiLow}-${result.targetRsiHigh}`));
    console.log(chalk.gray(`    IV Percentile: ${result.targetIvPercentile}%`));
    console.log(chalk.gray(`    Min Cushion: ${result.minCushionPct}%`));
    console.log(chalk.gray(`    Min Grade: ${result.minGrade}`));
    console.log(chalk.gray(`    Active: ${result.active ? "Yes" : "No"}`));
    if (result.notes) {
      console.log(chalk.gray(`    Notes: ${result.notes}`));
    }
  } else {
    console.log(chalk.red(`  ✗ Failed to update ${ticker.toUpperCase()}`));
    console.log(chalk.gray("    Make sure the ticker is in your watchlist first."));
  }

  console.log();
}

// ============================================================================
// FORMAT HELPERS
// ============================================================================

/**
 * Format watchlist for AI context
 */
export function formatWatchlistForAI(watchlist: WatchlistItem[]): string {
  if (watchlist.length === 0) {
    return "No tickers in watchlist.";
  }

  let output = "WATCHLIST:\n";
  for (const item of watchlist) {
    output += `- ${item.ticker}: RSI ${item.targetRsiLow}-${item.targetRsiHigh}, `;
    output += `IV<${item.targetIvPercentile}%, `;
    output += `Cushion>${item.minCushionPct}%, `;
    output += `Grade>=${item.minGrade}`;
    if (item.notes) {
      output += ` (${item.notes})`;
    }
    output += "\n";
  }
  return output;
}
