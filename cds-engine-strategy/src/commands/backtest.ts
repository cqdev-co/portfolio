/**
 * Backtest Command
 * v2.6.0: Historical backtesting for scanner signals
 *
 * Analyzes how past scanner signals would have performed:
 * - Simulates entries on ENTER signals from historical scans
 * - Tracks hypothetical performance over time
 * - Generates win rate and profit statistics
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { createClient } from '@supabase/supabase-js';
import { yahooProvider } from '../providers/yahoo.ts';

interface BacktestTrade {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  entryScore: number;
  exitDate: string;
  exitPrice: number;
  pnlPct: number;
  holdDays: number;
  outcome: 'win' | 'loss' | 'breakeven';
}

interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgHold: number;
  totalReturn: number;
  profitFactor: number;
}

/**
 * Get Supabase client
 */
function getClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Fetch historical scan results
 */
async function fetchHistoricalScans(
  days: number,
  minScore: number
): Promise<
  Array<{
    ticker: string;
    scan_date: string;
    total_score: number;
    price: number;
  }>
> {
  const client = getClient();
  if (!client) {
    logger.error('Supabase not configured');
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const { data, error } = await client
      .from('stock_opportunities')
      .select('ticker, scan_date, total_score, price')
      .gte('scan_date', startDate.toISOString().split('T')[0])
      .gte('total_score', minScore)
      .order('scan_date', { ascending: true });

    if (error) {
      logger.error(`Database error: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (e) {
    logger.error(`Failed to fetch scans: ${e}`);
    return [];
  }
}

// Future enhancement: Get historical price for a specific date
// function getHistoricalPrice(ticker: string, targetDate: string): Promise<number | null>

/**
 * Simulate trades based on historical scans
 */
async function simulateTrades(
  scans: Array<{
    ticker: string;
    scan_date: string;
    total_score: number;
    price: number;
  }>,
  holdDays: number,
  targetProfit: number,
  stopLoss: number,
  verbose: boolean
): Promise<BacktestTrade[]> {
  const trades: BacktestTrade[] = [];
  const processedEntries = new Set<string>(); // Prevent duplicate entries

  for (const scan of scans) {
    const key = `${scan.ticker}-${scan.scan_date}`;
    if (processedEntries.has(key)) continue;
    processedEntries.add(key);

    if (verbose) {
      process.stdout.write(
        chalk.gray(`  Simulating ${scan.ticker} from ${scan.scan_date}...`)
      );
    }

    try {
      // Get current price (for exit)
      const historical = await yahooProvider.getHistorical(scan.ticker);
      if (!historical || historical.length < holdDays + 10) {
        if (verbose) console.log(chalk.yellow(' insufficient data'));
        continue;
      }

      // Find entry date in historical data
      const entryDate = new Date(scan.scan_date);
      const entryIdx = historical.findIndex(
        (h) => h.date.getTime() >= entryDate.getTime()
      );

      if (entryIdx === -1 || entryIdx + holdDays >= historical.length) {
        if (verbose) console.log(chalk.gray(' incomplete period'));
        continue;
      }

      const entryBar = historical[entryIdx];
      const entryPrice = entryBar?.close ?? scan.price;

      // Simulate exit (check each day for target/stop)
      let exitPrice = entryPrice;
      let exitIdx = entryIdx + holdDays;
      let exitReason = 'time';

      for (
        let i = entryIdx + 1;
        i <= entryIdx + holdDays && i < historical.length;
        i++
      ) {
        const bar = historical[i];
        if (!bar) continue;

        // Check target profit (using high)
        const highPnl = ((bar.high - entryPrice) / entryPrice) * 100;
        if (highPnl >= targetProfit) {
          exitPrice = entryPrice * (1 + targetProfit / 100);
          exitIdx = i;
          exitReason = 'target';
          break;
        }

        // Check stop loss (using low)
        const lowPnl = ((bar.low - entryPrice) / entryPrice) * 100;
        if (lowPnl <= -stopLoss) {
          exitPrice = entryPrice * (1 - stopLoss / 100);
          exitIdx = i;
          exitReason = 'stop';
          break;
        }

        // End of period - exit at close
        if (i === entryIdx + holdDays) {
          exitPrice = bar.close;
        }
      }

      const exitBar = historical[exitIdx];
      const exitDate = exitBar?.date.toISOString().split('T')[0] ?? '';
      const actualHold = exitIdx - entryIdx;

      const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      trades.push({
        ticker: scan.ticker,
        entryDate: scan.scan_date,
        entryPrice,
        entryScore: scan.total_score,
        exitDate,
        exitPrice,
        pnlPct,
        holdDays: actualHold,
        outcome: pnlPct > 0.5 ? 'win' : pnlPct < -0.5 ? 'loss' : 'breakeven',
      });

      if (verbose) {
        const resultColor =
          pnlPct > 0 ? chalk.green : pnlPct < 0 ? chalk.red : chalk.gray;
        console.log(
          resultColor(
            ` ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% (${exitReason})`
          )
        );
      }
    } catch (error) {
      if (verbose) console.log(chalk.red(' error'));
      logger.debug(`Trade sim error: ${error}`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  return trades;
}

/**
 * Calculate backtest statistics
 */
function calculateStats(trades: BacktestTrade[]): BacktestStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHold: 0,
      totalReturn: 0,
      profitFactor: 0,
    };
  }

  const wins = trades.filter((t) => t.outcome === 'win');
  const losses = trades.filter((t) => t.outcome === 'loss');

  const totalWinPct = wins.reduce((sum, t) => sum + t.pnlPct, 0);
  const totalLossPct = Math.abs(losses.reduce((sum, t) => sum + t.pnlPct, 0));

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / trades.length) * 100,
    avgWin: wins.length > 0 ? totalWinPct / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLossPct / losses.length : 0,
    avgHold: trades.reduce((sum, t) => sum + t.holdDays, 0) / trades.length,
    totalReturn: trades.reduce((sum, t) => sum + t.pnlPct, 0),
    profitFactor: totalLossPct > 0 ? totalWinPct / totalLossPct : totalWinPct,
  };
}

export interface BacktestOptions {
  days: number;
  minScore: number;
  holdDays: number;
  targetProfit: number;
  stopLoss: number;
  verbose: boolean;
}

/**
 * Main backtest command
 */
export async function runBacktest(options: BacktestOptions): Promise<void> {
  logger.setVerbose(options.verbose);

  console.log();
  console.log(chalk.bold.cyan('  📈 Scanner Backtest'));
  console.log(chalk.gray(`  Analyzing last ${options.days} days of signals`));
  console.log();

  console.log(chalk.gray('  Parameters:'));
  console.log(chalk.gray(`    • Min score: ${options.minScore}`));
  console.log(chalk.gray(`    • Max hold: ${options.holdDays} days`));
  console.log(chalk.gray(`    • Target: +${options.targetProfit}%`));
  console.log(chalk.gray(`    • Stop: -${options.stopLoss}%`));
  console.log();

  // Fetch historical scans
  console.log(chalk.gray('  Fetching historical scans...'));
  const scans = await fetchHistoricalScans(options.days, options.minScore);

  if (scans.length === 0) {
    console.log(chalk.yellow('  No historical scan data found'));
    console.log(chalk.gray('  Run scans daily to build history'));
    console.log();
    return;
  }

  console.log(chalk.gray(`  Found ${scans.length} scan signals`));
  console.log();

  // Simulate trades
  console.log(chalk.gray('  Simulating trades...'));
  const trades = await simulateTrades(
    scans,
    options.holdDays,
    options.targetProfit,
    options.stopLoss,
    options.verbose
  );

  if (trades.length === 0) {
    console.log(chalk.yellow('  No trades could be simulated'));
    console.log();
    return;
  }

  // Calculate stats
  const stats = calculateStats(trades);

  // Display results
  console.log();
  console.log(chalk.gray('─'.repeat(56)));
  console.log();

  // Stats summary
  console.log(chalk.bold.white('  Backtest Results'));
  console.log();

  const statsTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    colWidths: [24, 20],
    style: { head: [], border: ['gray'] },
  });

  const winRateColor =
    stats.winRate >= 60
      ? chalk.green
      : stats.winRate >= 50
        ? chalk.yellow
        : chalk.red;
  const pfColor =
    stats.profitFactor >= 1.5
      ? chalk.green
      : stats.profitFactor >= 1
        ? chalk.yellow
        : chalk.red;
  const returnColor = stats.totalReturn >= 0 ? chalk.green : chalk.red;

  statsTable.push(
    ['Total Trades', chalk.white(stats.totalTrades.toString())],
    [
      'Wins / Losses',
      chalk.green(`${stats.wins}`) +
        chalk.gray(' / ') +
        chalk.red(`${stats.losses}`),
    ],
    ['Win Rate', winRateColor(`${stats.winRate.toFixed(1)}%`)],
    ['Avg Win', chalk.green(`+${stats.avgWin.toFixed(1)}%`)],
    ['Avg Loss', chalk.red(`-${stats.avgLoss.toFixed(1)}%`)],
    ['Profit Factor', pfColor(stats.profitFactor.toFixed(2))],
    [
      'Total Return',
      returnColor(
        `${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn.toFixed(1)}%`
      ),
    ],
    ['Avg Hold Days', chalk.white(stats.avgHold.toFixed(1))]
  );

  console.log(statsTable.toString());
  console.log();

  // Recent trades table
  const recentTrades = trades.slice(-10);
  if (recentTrades.length > 0) {
    console.log(chalk.bold.white('  Recent Trades'));
    console.log();

    const tradesTable = new Table({
      head: [
        chalk.cyan('Ticker'),
        chalk.cyan('Entry'),
        chalk.cyan('Score'),
        chalk.cyan('Exit'),
        chalk.cyan('P&L'),
        chalk.cyan('Days'),
      ],
      colWidths: [8, 12, 8, 12, 10, 7],
      style: { head: [], border: ['gray'] },
    });

    for (const t of recentTrades) {
      const pnlColor =
        t.pnlPct > 0 ? chalk.green : t.pnlPct < 0 ? chalk.red : chalk.gray;

      tradesTable.push([
        chalk.bold(t.ticker),
        chalk.gray(t.entryDate),
        chalk.white(t.entryScore.toString()),
        chalk.gray(t.exitDate),
        pnlColor(`${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(1)}%`),
        chalk.gray(t.holdDays.toString()),
      ]);
    }

    console.log(tradesTable.toString());
  }

  // Interpretation
  console.log();
  if (stats.winRate >= 60 && stats.profitFactor >= 1.5) {
    console.log(
      chalk.bold.green(
        '  ✅ Scanner signals show strong historical performance'
      )
    );
  } else if (stats.winRate >= 50 && stats.profitFactor >= 1) {
    console.log(
      chalk.yellow('  ⚠️  Scanner signals show moderate historical performance')
    );
  } else {
    console.log(
      chalk.red('  ❌ Scanner signals underperforming - review criteria')
    );
  }

  console.log();
}
