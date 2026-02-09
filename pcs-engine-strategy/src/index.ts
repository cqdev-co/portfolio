#!/usr/bin/env bun
/**
 * PCS Engine Strategy CLI
 * v1.0.0 - Put Credit Spread Trading Engine
 *
 * A complete CLI for scanning, evaluating, and managing
 * put credit spread opportunities.
 *
 * Usage: bun run src/index.ts <command> [options]
 */

// Suppress dotenv logging noise
process.env.DOTENV_CONFIG_QUIET = 'true';

import { config } from 'dotenv';
import { join } from 'path';
import { Command } from 'commander';

// Load .env from repository root (parent of pcs-engine-strategy)
const rootEnvPath = join(process.cwd(), '..', '.env');
config({ path: rootEnvPath });

// Also try .env.local from root
const rootEnvLocalPath = join(process.cwd(), '..', '.env.local');
config({ path: rootEnvLocalPath });
import { runScan } from './commands/scan.ts';
import { scanSpreads } from './commands/scan-spreads.ts';
import { runScanAll } from './commands/scan-all.ts';
import { runRegime } from './commands/regime.ts';
import { runBriefing } from './commands/briefing.ts';
import { recordEntry, recordExit } from './commands/trade.ts';
import { runPerformance } from './commands/performance.ts';

const program = new Command();

program
  .name('pcs-engine')
  .description('Put Credit Spread (PCS) trading engine')
  .version('1.0.0');

// ============================================================================
// SCAN: Stock screening for PCS candidates
// ============================================================================
program
  .command('scan')
  .description('Screen stocks for PCS suitability')
  .option('--list <name>', 'Ticker list: mega, growth, value, sp500', 'mega')
  .option('--tickers <symbols>', 'Comma-separated ticker symbols')
  .option('--top <n>', 'Limit to top N tickers', parseInt)
  .option(
    '--min-score <n>',
    'Minimum score threshold',
    (v: string) => Number(v),
    65
  )
  .option('--dry-run', 'Do not save to database', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await runScan({
      list: opts.list,
      tickers: opts.tickers,
      top: opts.top,
      minScore: opts.minScore,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });
  });

// ============================================================================
// SCAN-SPREADS: Find viable put credit spreads
// ============================================================================
program
  .command('scan-spreads')
  .description('Find viable OTM put credit spreads')
  .option(
    '--list <name>',
    'Ticker list: mega, growth, value, etf, sp500',
    'mega'
  )
  .option('--tickers <symbols>', 'Comma-separated ticker symbols')
  .option('--dte <days>', 'Target DTE', parseInt)
  .option('--pop <pct>', 'Minimum PoP percentage', parseInt)
  .option('--relaxed', 'Relax criteria for more results', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await scanSpreads({
      list: opts.list,
      tickers: opts.tickers,
      dte: opts.dte,
      pop: opts.pop,
      relaxed: opts.relaxed,
      verbose: opts.verbose,
    });
  });

// ============================================================================
// SCAN-ALL: Combined stock + spread scanning
// ============================================================================
program
  .command('scan-all')
  .description('Full PCS scan (stock screening + spread analysis)')
  .option('--list <name>', 'Ticker list: mega, growth, sp500', 'mega')
  .option('--tickers <symbols>', 'Comma-separated ticker symbols')
  .option('--top <n>', 'Limit to top N', parseInt)
  .option('--min-score <n>', 'Minimum score', (v: string) => Number(v), 65)
  .option('--summary', 'Summary mode', false)
  .option('--watchlist', 'Scan watchlist', false)
  .option('--from-db', 'Use tickers from DB', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await runScanAll({
      list: opts.list,
      tickers: opts.tickers,
      top: opts.top,
      minScore: opts.minScore,
      summary: opts.summary,
      watchlist: opts.watchlist,
      fromDb: opts.fromDb,
      verbose: opts.verbose,
    });
  });

// ============================================================================
// REGIME: Market regime analysis
// ============================================================================
program
  .command('regime')
  .description('Analyze market regime for PCS strategy')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await runRegime({ verbose: opts.verbose });
  });

// ============================================================================
// BRIEFING: Daily market briefing
// ============================================================================
program
  .command('briefing')
  .description('PCS daily briefing')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await runBriefing({ verbose: opts.verbose });
  });

// ============================================================================
// TRADE: Record entries and exits
// ============================================================================
const trade = program.command('trade').description('Record PCS trades');

trade
  .command('entry')
  .description('Record PCS trade entry')
  .requiredOption('--ticker <symbol>', 'Ticker symbol')
  .requiredOption('--short-strike <price>', 'Short put strike', parseFloat)
  .requiredOption('--long-strike <price>', 'Long put strike', parseFloat)
  .requiredOption('--expiration <date>', 'Expiration date (YYYY-MM-DD)')
  .requiredOption('--credit <amount>', 'Credit received per spread', parseFloat)
  .option('--contracts <n>', 'Number of contracts', parseInt, 1)
  .option('--iv-rank <pct>', 'IV Rank at entry', parseInt)
  .option('--score <n>', 'Total score at entry', parseInt)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await recordEntry({
      ticker: opts.ticker,
      shortStrike: opts.shortStrike,
      longStrike: opts.longStrike,
      expiration: opts.expiration,
      credit: opts.credit,
      contracts: opts.contracts,
      ivRank: opts.ivRank,
      score: opts.score,
      verbose: opts.verbose,
    });
  });

trade
  .command('exit')
  .description('Record PCS trade exit')
  .requiredOption('--trade-id <id>', 'Trade ID')
  .requiredOption('--debit <amount>', 'Debit to close', parseFloat)
  .option('--reason <text>', 'Exit reason', 'manual')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await recordExit({
      tradeId: opts.tradeId,
      debit: opts.debit,
      reason: opts.reason,
      verbose: opts.verbose,
    });
  });

// ============================================================================
// PERFORMANCE: Trade analytics
// ============================================================================
program
  .command('performance')
  .description('PCS performance analytics')
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (opts) => {
    await runPerformance({ verbose: opts.verbose });
  });

program.parse(process.argv);
