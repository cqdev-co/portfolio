/**
 * Scan-All Command
 * v2.6.0: Integrated workflow - scan stocks then find spreads
 *
 * One command to:
 * 1. Scan tickers for opportunities
 * 2. Find viable spreads for top results
 * 3. Display combined actionable output
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import { runScreener } from '../engine/screener.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import { getMarketRegime, type MarketContext } from '../utils/market-regime.ts';
import type { StockScore } from '../types/index.ts';
import {
  isConfigured,
  saveSignals,
  getRecentSignalTickers,
  getTopTickersFromDB,
  getMasterTickers,
  type SignalData,
} from '../storage/supabase.ts';
import { getWatchlistTickers } from './watchlist.ts';

interface SpreadResult {
  ticker: string;
  score: StockScore;
  spread: string | null;
  debit: number | null;
  width: number | null;
  cushion: number | null;
  pop: number | null;
  returnPct: number | null;
  dte: number | null;
  viable: boolean;
}

/**
 * Calculate PoP using simplified Black-Scholes
 */
function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.sqrt(2);
  const y = Math.sqrt(
    1 - Math.exp((-a * a * (4 / Math.PI + 0.147 * a * a)) / (1 + 0.147 * a * a))
  );
  return 0.5 * (1 + sign * y);
}

function calculatePoP(
  price: number,
  breakeven: number,
  iv: number,
  dte: number
): number {
  if (iv <= 0 || dte <= 0) return price > breakeven ? 75 : 25;
  const T = dte / 365;
  const z = Math.log(price / breakeven) / (iv * Math.sqrt(T));
  const pop = normalCDF(z) * 100;
  return Math.min(95, Math.max(5, Math.round(pop)));
}

/**
 * Find spread for a single ticker
 */
async function findSpread(
  ticker: string,
  price: number
): Promise<Omit<SpreadResult, 'ticker' | 'score'>> {
  const result: Omit<SpreadResult, 'ticker' | 'score'> = {
    spread: null,
    debit: null,
    width: null,
    cushion: null,
    pop: null,
    returnPct: null,
    dte: null,
    viable: false,
  };

  try {
    const optionsChain = await yahooProvider.getOptionsChain(ticker, 30);
    if (!optionsChain) return result;

    const { calls, expiration } = optionsChain;
    const expirationDate =
      expiration instanceof Date ? expiration : new Date(expiration);
    const dte = Math.ceil(
      (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    result.dte = dte;

    if (calls.length === 0) return result;

    // Look for deep ITM calls (6-12% ITM)
    const minITM = price * 0.88;
    const maxITM = price * 0.94;
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    let bestSpread: {
      long: number;
      short: number;
      debit: number;
      width: number;
      cushion: number;
      pop: number;
      returnPct: number;
    } | null = null;

    for (const longCall of sortedCalls) {
      if (longCall.strike < minITM || longCall.strike > maxITM) continue;
      if ((longCall.openInterest || 0) < 10) continue;

      for (const width of [5, 10]) {
        const shortStrike = longCall.strike + width;
        const shortCall = sortedCalls.find((c) => c.strike === shortStrike);
        if (!shortCall || (shortCall.openInterest || 0) < 5) continue;

        const marketDebit = (longCall.ask || 0) - (shortCall.bid || 0);
        const midDebit =
          ((longCall.bid || 0) + (longCall.ask || 0)) / 2 -
          ((shortCall.bid || 0) + (shortCall.ask || 0)) / 2;

        const marketRatio = marketDebit / width;
        if (marketRatio > 0.8) continue;

        let debit: number | null = null;
        if (marketDebit > 0 && isFinite(marketDebit)) {
          if (marketRatio >= 0.55 && marketRatio <= 0.8) {
            debit = marketDebit;
          } else if (marketRatio < 0.55 && midDebit > 0) {
            debit = midDebit * 1.1;
            if (debit / width > 0.8) continue;
          }
        }

        if (!debit) continue;

        const breakeven = longCall.strike + debit;
        const cushion = ((price - breakeven) / price) * 100;
        const maxProfit = width - debit;
        const returnOnRisk = maxProfit / debit;

        if (cushion < 5 || returnOnRisk < 0.2) continue;

        const iv = longCall.impliedVolatility || 0.3;
        const pop = calculatePoP(price, breakeven, iv, dte);

        if (pop < 70) continue;

        if (!bestSpread || cushion > bestSpread.cushion) {
          bestSpread = {
            long: longCall.strike,
            short: shortStrike,
            debit,
            width,
            cushion,
            pop,
            returnPct: returnOnRisk * 100,
          };
        }
      }
    }

    if (bestSpread) {
      result.spread = `${bestSpread.long}/${bestSpread.short}`;
      result.debit = bestSpread.debit;
      result.width = bestSpread.width;
      result.cushion = bestSpread.cushion;
      result.pop = bestSpread.pop;
      result.returnPct = bestSpread.returnPct;
      result.viable = true;
    }
  } catch (error) {
    logger.debug(`Spread error for ${ticker}: ${error}`);
  }

  return result;
}

export interface ScanAllOptions {
  list: string;
  tickers?: string;
  minScore?: number;
  topN?: number;
  verbose?: boolean;
  summary?: boolean; // v2.6.0: Concise output mode
  skipSpreads?: boolean;
  store?: boolean; // v2.8.0: Explicitly store signals to DB (for CI)
  noCapture?: boolean; // v2.7.0: Skip signal capture to DB
  watchlist?: boolean; // v2.7.0: Scan watchlist tickers only
  fromSignals?: boolean; // v2.7.0: Scan recent signal tickers only
  fromDb?: boolean; // v2.7.0: Scan top tickers from stock_opportunities
  fromTickers?: boolean; // v2.7.0: Scan from master tickers table
  exchange?: string; // Filter master tickers by exchange
  sector?: string; // Filter master tickers by sector
  signalDays?: number; // Days of signal/DB history to use
  dbLimit?: number; // Max tickers to pull from DB
}

/**
 * Main scan-all command
 */
export async function scanAll(options: ScanAllOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  const minScore = options.minScore ?? 70;
  const topN = options.topN ?? 10;
  const summaryMode = options.summary ?? false;

  console.log();
  console.log(chalk.bold.cyan('  🎯 Full Opportunity Scan'));
  console.log(chalk.gray('  Stock screening + spread finding in one step'));
  console.log();

  // Resolve ticker source (watchlist, signals, DB, master tickers, or list)
  let tickersToScan = options.tickers;
  let sourceLabel = options.list;

  if (options.watchlist) {
    const watchlistTickers = getWatchlistTickers();
    if (watchlistTickers.length === 0) {
      console.log(chalk.yellow('  Watchlist is empty - add tickers first'));
      console.log(chalk.gray('  Use: bun run cds:watchlist add TICKER'));
      console.log();
      return;
    }
    tickersToScan = watchlistTickers.join(',');
    sourceLabel = `watchlist (${watchlistTickers.length} tickers)`;
    console.log(chalk.gray('  Source: ') + chalk.cyan('Watchlist'));
  } else if (options.fromTickers) {
    // Use master tickers table from Supabase
    if (!isConfigured()) {
      console.log(chalk.yellow('  Supabase not configured for --from-tickers'));
      console.log(chalk.gray('  Falling back to list mode'));
    } else {
      const limit = options.dbLimit ?? 500;
      const { tickers: masterTickers, count } = await getMasterTickers({
        exchange: options.exchange,
        sector: options.sector,
        limit,
        activeOnly: true,
      });

      if (masterTickers.length === 0) {
        console.log(chalk.yellow('  No tickers found in master table'));
        console.log();
        return;
      }

      tickersToScan = masterTickers.join(',');

      // Build source label
      const filters: string[] = [];
      if (options.exchange) filters.push(`exchange: ${options.exchange}`);
      if (options.sector) filters.push(`sector: ${options.sector}`);
      const filterStr = filters.length > 0 ? ` (${filters.join(', ')})` : '';

      sourceLabel = `master tickers (${masterTickers.length}/${count} total)`;
      console.log(
        chalk.gray('  Source: ') +
          chalk.cyan(`Master Tickers Table${filterStr}`) +
          chalk.gray(` - ${masterTickers.length} of ${count} total`)
      );
    }
  } else if (options.fromDb) {
    if (!isConfigured()) {
      console.log(chalk.yellow('  Supabase not configured for --from-db'));
      console.log(chalk.gray('  Falling back to list mode'));
    } else {
      const days = options.signalDays ?? 30;
      const limit = options.dbLimit ?? 50;
      const dbTickers = await getTopTickersFromDB(days, minScore, limit);
      if (dbTickers.length === 0) {
        console.log(
          chalk.yellow(`  No tickers found in DB (last ${days} days)`)
        );
        console.log(chalk.gray('  Run a full scan first to populate DB'));
        console.log();
        return;
      }
      tickersToScan = dbTickers.join(',');
      sourceLabel = `database (${dbTickers.length} tickers)`;
      console.log(
        chalk.gray('  Source: ') +
          chalk.cyan(`Supabase DB (${days}d, top ${dbTickers.length} by score)`)
      );
    }
  } else if (options.fromSignals) {
    if (!isConfigured()) {
      console.log(chalk.yellow('  Supabase not configured for --from-signals'));
      console.log(chalk.gray('  Falling back to list mode'));
    } else {
      const signalDays = options.signalDays ?? 7;
      const signalTickers = await getRecentSignalTickers(signalDays, minScore);
      if (signalTickers.length === 0) {
        console.log(
          chalk.yellow(`  No signals found in last ${signalDays} days`)
        );
        console.log(chalk.gray('  Run a full scan first to populate signals'));
        console.log();
        return;
      }
      tickersToScan = signalTickers.join(',');
      sourceLabel = `recent signals (${signalTickers.length} tickers)`;
      console.log(
        chalk.gray('  Source: ') +
          chalk.cyan(`Recent signals (${signalDays}d, score ≥${minScore})`)
      );
    }
  }

  // Get market regime
  let marketContext: MarketContext | null = null;
  if (!summaryMode) {
    console.log(chalk.gray('  Checking market regime...'));
    marketContext = await getMarketRegime();

    if (marketContext) {
      const regimeColor =
        marketContext.regime === 'bull'
          ? chalk.green
          : marketContext.regime === 'bear'
            ? chalk.red
            : chalk.yellow;
      console.log(
        chalk.gray('  Market: ') +
          regimeColor(marketContext.regime.toUpperCase()) +
          chalk.gray(` | VIX: ${marketContext.vix?.toFixed(1) ?? 'N/A'}`)
      );
    }
  }

  // Run stock screener
  if (!summaryMode) {
    console.log(
      chalk.gray(`  Scanning ${sourceLabel} (min score: ${minScore})...`)
    );
  }

  const scores = await runScreener({
    list: options.list,
    tickers: tickersToScan,
    minScore,
    dryRun: true,
    verbose: false,
  });

  if (scores.length === 0) {
    console.log();
    console.log(chalk.yellow('  No stocks passed the minimum score threshold'));
    console.log();
    return;
  }

  // Get top N for spread analysis
  const topScores = scores.slice(0, topN);

  if (!summaryMode) {
    console.log(
      chalk.gray(`  Found ${scores.length} stocks, analyzing top ${topN}...`)
    );
    console.log();
  }

  // Find spreads for top scores
  const results: SpreadResult[] = [];

  if (!options.skipSpreads) {
    for (const score of topScores) {
      if (!summaryMode) {
        process.stdout.write(
          chalk.gray(`  [${score.ticker}] Finding spread...`)
        );
      }

      const spreadResult = await findSpread(score.ticker, score.price);
      results.push({
        ticker: score.ticker,
        score,
        ...spreadResult,
      });

      if (!summaryMode) {
        if (spreadResult.viable) {
          console.log(chalk.green(` ✓ ${spreadResult.spread}`));
        } else {
          console.log(chalk.gray(' -'));
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  } else {
    // Skip spread analysis, just show scores
    for (const score of topScores) {
      results.push({
        ticker: score.ticker,
        score,
        spread: null,
        debit: null,
        width: null,
        cushion: null,
        pop: null,
        returnPct: null,
        dte: null,
        viable: false,
      });
    }
  }

  // Display results
  console.log();
  console.log(chalk.gray('─'.repeat(72)));
  console.log();

  if (summaryMode) {
    // v2.6.0: Concise summary mode
    displaySummary(results, marketContext);
  } else {
    // Full detailed output
    displayDetailed(results, marketContext);
  }

  // v2.7.0: Auto-capture signals to database
  // v2.8.0: --store explicitly enables (for CI), default still stores unless --no-capture
  const shouldStore = options.store || !options.noCapture;
  if (shouldStore && isConfigured()) {
    await captureSignals(results, marketContext);
  }
}

/**
 * v2.7.0: Capture signals to database for performance tracking
 * v2.8.0: Added upside_potential and target_price for automatic outcome tracking
 */
async function captureSignals(
  results: SpreadResult[],
  marketContext: MarketContext | null
): Promise<void> {
  const signalsToSave: SignalData[] = results.map((r) => {
    // Extract indicator values from signals if available
    const rsiSignal = r.score.signals.find((s) =>
      s.name.toLowerCase().includes('rsi')
    );
    const rsiMatch = rsiSignal?.name.match(/(\d+)/);
    const rsiValue = rsiMatch?.[1] ? parseFloat(rsiMatch[1]) : null;

    // Calculate target price from upside potential
    const upsidePotential = r.score.upsidePotential;
    const targetPrice =
      upsidePotential > 0 ? r.score.price * (1 + upsidePotential) : null;

    return {
      ticker: r.score.ticker,
      signalDate: new Date(),
      signalScore: r.score.totalScore,
      regime: marketContext?.regime ?? null,
      regimeConfidence: null,
      sector: null, // Could be enhanced with sector lookup
      signals: r.score.signals.map((s) => s.name),
      topSignals: r.score.signals
        .slice(0, 3)
        .map((s) => s.name)
        .join(', '),
      price: r.score.price,
      ma50: null, // Would need to extract from debug data
      ma200: null,
      rsi: rsiValue,
      spreadViable: r.viable,
      spreadStrikes: r.spread,
      spreadDebit: r.debit,
      spreadCushion: r.cushion,
      spreadPop: r.pop,
      spreadReturn: r.returnPct,
      // Target tracking for automatic outcome verification
      upsidePotential: upsidePotential > 0 ? upsidePotential : null,
      targetPrice,
    };
  });

  if (signalsToSave.length > 0) {
    console.log(chalk.gray('  Capturing signals to database...'));
    await saveSignals(signalsToSave);
  }
}

/**
 * v2.6.0: Summary mode - concise output
 */
function displaySummary(
  results: SpreadResult[],
  marketContext: MarketContext | null
): void {
  const viable = results.filter((r) => r.viable);
  const topScores = results.slice(0, 5);

  // One-line market summary
  if (marketContext) {
    const regimeColor =
      marketContext.regime === 'bull'
        ? chalk.green
        : marketContext.regime === 'bear'
          ? chalk.red
          : chalk.yellow;
    console.log(
      chalk.bold('  Market: ') +
        regimeColor(marketContext.regime.toUpperCase()) +
        chalk.gray(
          ` | SPY: $${marketContext.spyPrice.toFixed(2)} | VIX: ${marketContext.vix?.toFixed(1) ?? 'N/A'}`
        )
    );
    console.log();
  }

  // Top opportunities
  console.log(chalk.bold('  Top Opportunities:'));
  for (const r of topScores) {
    const spreadInfo = r.viable
      ? chalk.green(`${r.spread} @ $${r.debit?.toFixed(2)}`)
      : chalk.gray('no viable spread');

    const scoreColor =
      r.score.totalScore >= 80
        ? chalk.green
        : r.score.totalScore >= 70
          ? chalk.yellow
          : chalk.white;

    console.log(
      `  ${chalk.bold(r.ticker.padEnd(6))} ` +
        scoreColor(`${r.score.totalScore}`) +
        chalk.gray(' pts | ') +
        spreadInfo
    );
  }

  // Bottom line
  console.log();
  console.log(
    chalk.gray(
      `  Found ${results.length} stocks, ${viable.length} with viable spreads`
    )
  );
  console.log();
}

/**
 * Full detailed output
 */
function displayDetailed(
  results: SpreadResult[],
  _marketContext: MarketContext | null
): void {
  const viable = results.filter((r) => r.viable);

  const table = new Table({
    head: [
      chalk.cyan('Ticker'),
      chalk.cyan('Score'),
      chalk.cyan('Price'),
      chalk.cyan('Spread'),
      chalk.cyan('Debit'),
      chalk.cyan('Cushion'),
      chalk.cyan('PoP'),
      chalk.cyan('Return'),
      chalk.cyan('Top Signals'),
    ],
    colWidths: [8, 7, 10, 12, 8, 9, 7, 8, 28],
    style: { head: [], border: ['gray'] },
  });

  for (const r of results) {
    const scoreColor =
      r.score.totalScore >= 80
        ? chalk.green
        : r.score.totalScore >= 70
          ? chalk.yellow
          : chalk.white;

    const topSignals = r.score.signals
      .slice(0, 2)
      .map((s) => s.name)
      .join(', ');

    table.push([
      chalk.bold(r.ticker),
      scoreColor(`${r.score.totalScore}`),
      chalk.white(`$${r.score.price.toFixed(2)}`),
      r.viable ? chalk.white(r.spread ?? '-') : chalk.gray('-'),
      r.viable ? chalk.yellow(`$${r.debit?.toFixed(2)}`) : chalk.gray('-'),
      r.viable ? chalk.green(`${r.cushion?.toFixed(1)}%`) : chalk.gray('-'),
      r.viable ? chalk.cyan(`${r.pop}%`) : chalk.gray('-'),
      r.viable ? chalk.green(`${r.returnPct?.toFixed(0)}%`) : chalk.gray('-'),
      chalk.gray(topSignals.slice(0, 26)),
    ]);
  }

  console.log(table.toString());
  console.log();

  // Highlight best opportunities
  if (viable.length > 0) {
    const best = viable.sort((a, b) => (b.cushion ?? 0) - (a.cushion ?? 0))[0];
    if (best) {
      console.log(chalk.bold.green('  🏆 Best Opportunity:'));
      console.log(
        chalk.white(`     ${best.ticker} `) +
          chalk.gray(`Score ${best.score.totalScore} | `) +
          chalk.white(`${best.spread} @ $${best.debit?.toFixed(2)} `) +
          chalk.gray('| ') +
          chalk.green(`${best.cushion?.toFixed(1)}% cushion `) +
          chalk.gray('| ') +
          chalk.cyan(`${best.pop}% PoP`)
      );
    }
  } else {
    console.log(
      chalk.yellow('  No stocks have viable spreads meeting strict criteria')
    );
    console.log(
      chalk.gray('  Consider running scan-spreads with --relaxed flag')
    );
  }

  console.log();
}
