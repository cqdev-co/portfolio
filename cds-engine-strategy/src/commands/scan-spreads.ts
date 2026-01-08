/**
 * Spread Scanner Command
 *
 * Scans tickers to find those with viable deep ITM call spreads
 * meeting our conservative criteria:
 * - Debit: 55-80% of width
 * - Cushion: ≥5%
 * - PoP: ≥70%
 * - Return: ≥20%
 *
 * Two-stage workflow:
 * 1. Run `bun run scan` to find technically sound stocks (ENTER decisions)
 * 2. Run `bun run scan-spreads --from-scan` to find viable spreads
 *
 * v1.9.0: Uses YahooProvider with proxy support to avoid rate limiting
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import {
  fetchSP500Tickers,
  isTickerDBConfigured,
} from '../providers/tickers.ts';
import { createClient } from '@supabase/supabase-js';
import { yahooProvider } from '../providers/yahoo.ts';

// Ticker lists
const TICKER_LISTS: Record<string, string[]> = {
  // Most liquid, best for spreads
  mega: [
    'AAPL',
    'MSFT',
    'NVDA',
    'GOOGL',
    'AMZN',
    'META',
    'TSLA',
    'AMD',
    'NFLX',
    'AVGO',
  ],

  // Broader tech + growth
  growth: [
    'AAPL',
    'MSFT',
    'NVDA',
    'GOOGL',
    'AMZN',
    'META',
    'TSLA',
    'AMD',
    'NFLX',
    'AVGO',
    'CRM',
    'ADBE',
    'ORCL',
    'NOW',
    'SNOW',
    'PLTR',
    'UBER',
    'ABNB',
    'DDOG',
    'MDB',
    'SHOP',
    'SQ',
    'COIN',
    'HOOD',
    'SOFI',
    'NET',
    'CRWD',
    'ZS',
    'PANW',
    'OKTA',
  ],

  // ETFs - often best liquidity
  etf: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'ARKK', 'SMH', 'SOXX'],

  // Value/dividend stocks
  value: [
    'JPM',
    'BAC',
    'WFC',
    'GS',
    'MS',
    'XOM',
    'CVX',
    'COP',
    'SLB',
    'HAL',
    'UNH',
    'JNJ',
    'PFE',
    'MRK',
    'ABBV',
  ],
};

/**
 * Fetch ENTER tickers from today's scan results
 * These are stocks that passed the technical/fundamental screening
 */
async function fetchEnterTickersFromScan(minScore = 70): Promise<string[]> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logger.error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
    );
    return [];
  }

  const client = createClient(url, key);
  const today = new Date().toISOString().split('T')[0];

  try {
    // Fetch today's scan results with high scores
    // ENTER criteria: score ≥75, but we'll use minScore param
    const { data, error } = await client
      .from('stock_opportunities')
      .select('ticker, total_score')
      .eq('scan_date', today)
      .gte('total_score', minScore)
      .order('total_score', { ascending: false });

    if (error) {
      logger.error(`Failed to fetch scan results: ${error.message}`);
      return [];
    }

    if (!data || data.length === 0) {
      logger.warn(`No scan results found for ${today} with score ≥${minScore}`);
      logger.info("Run 'bun run scan' first to populate scan results.");
      return [];
    }

    const tickers = data.map((d) => d.ticker);
    logger.success(
      `Found ${tickers.length} tickers from today's scan with score ≥${minScore}`
    );
    return tickers;
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return [];
  }
}

// Spread criteria (matches lib/ai-agent)
interface Criteria {
  minDebitRatio: number;
  maxDebitRatio: number;
  minCushion: number;
  minPoP: number;
  minReturn: number;
  targetDTE: number;
  minOI: number;
  widths: number[]; // v2.6.0: Support multiple spread widths
}

const STRICT_CRITERIA: Criteria = {
  minDebitRatio: 0.55, // Minimum debit as % of width
  maxDebitRatio: 0.8, // Maximum debit as % of width
  minCushion: 5, // Minimum % cushion
  minPoP: 70, // Minimum probability of profit
  minReturn: 0.2, // Minimum return on risk
  targetDTE: 30, // Target days to expiration
  minOI: 10, // Minimum open interest
  widths: [5, 10], // Default widths
};

// Relaxed criteria for showing "close" setups
const RELAXED_CRITERIA: Criteria = {
  minDebitRatio: 0.5, // Slightly wider range
  maxDebitRatio: 0.85,
  minCushion: 3, // Lower cushion acceptable
  minPoP: 60, // Lower PoP acceptable
  minReturn: 0.15, // Lower return acceptable
  targetDTE: 30,
  minOI: 5,
  widths: [2.5, 5, 10, 20], // v2.6.0: More width options in relaxed mode
};

let CRITERIA = STRICT_CRITERIA;

// v2.6.0: Width presets for different account sizes
const WIDTH_PRESETS: Record<string, number[]> = {
  small: [2.5, 5], // Small accounts ($1-5k)
  medium: [5, 10], // Medium accounts ($5-25k)
  large: [5, 10, 20], // Large accounts ($25k+)
  all: [2.5, 5, 10, 20], // Show all options
};

interface SpreadResult {
  ticker: string;
  price: number;
  spread: string | null;
  debit: number | null;
  width: number | null;
  debitPct: number | null;
  cushion: number | null;
  pop: number | null;
  returnPct: number | null;
  dte: number | null;
  viable: boolean;
  reason: string;
}

/**
 * Normal CDF approximation for PoP calculation
 */
function normalCDF(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.sqrt(2);
  const y = Math.sqrt(
    1 - Math.exp((-a * a * (4 / Math.PI + 0.147 * a * a)) / (1 + 0.147 * a * a))
  );
  return 0.5 * (1 + sign * y);
}

/**
 * Calculate PoP using Black-Scholes-inspired approximation
 */
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
 * Find viable spread for a ticker
 * v1.9.0: Uses YahooProvider with built-in rate limiting and retry logic
 */
async function findViableSpread(ticker: string): Promise<SpreadResult> {
  const result: SpreadResult = {
    ticker,
    price: 0,
    spread: null,
    debit: null,
    width: null,
    debitPct: null,
    cushion: null,
    pop: null,
    returnPct: null,
    dte: null,
    viable: false,
    reason: '',
  };

  try {
    // Get quote using YahooProvider (uses proxy first, then fallback)
    const quote = await yahooProvider.getQuote(ticker);
    const price = quote?.regularMarketPrice;
    if (!price) {
      result.reason = 'No price data';
      return result;
    }
    result.price = price;

    // Get options chain using YahooProvider (has built-in rate limiting)
    const optionsChain = await yahooProvider.getOptionsChain(
      ticker,
      CRITERIA.targetDTE
    );
    if (!optionsChain) {
      result.reason = 'No options';
      return result;
    }

    const { calls, expiration } = optionsChain;
    // Handle expiration as Date or string (can be string after JSON cache serialization)
    const expirationDate =
      expiration instanceof Date ? expiration : new Date(expiration);
    const dte = Math.ceil(
      (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    result.dte = dte;

    if (calls.length === 0) {
      result.reason = 'No calls';
      return result;
    }

    // Look for deep ITM calls (6-12% ITM)
    const minITM = price * 0.88;
    const maxITM = price * 0.94;

    // Sort by strike
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    // Find viable spreads
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
      // Must be in ITM range
      if (longCall.strike < minITM || longCall.strike > maxITM) continue;
      // Must have liquidity
      if ((longCall.openInterest || 0) < CRITERIA.minOI) continue;

      // v2.6.0: Try all configured widths
      for (const width of CRITERIA.widths) {
        const shortStrike = longCall.strike + width;
        const shortCall = sortedCalls.find((c) => c.strike === shortStrike);
        if (!shortCall) continue;
        if ((shortCall.openInterest || 0) < 5) continue;

        // Calculate market debit
        const marketDebit = (longCall.ask || 0) - (shortCall.bid || 0);
        const midDebit =
          ((longCall.bid || 0) + (longCall.ask || 0)) / 2 -
          ((shortCall.bid || 0) + (shortCall.ask || 0)) / 2;

        // Apply criteria
        const marketRatio = marketDebit / width;

        let debit: number | null = null;
        if (marketDebit > 0 && isFinite(marketDebit)) {
          if (marketRatio > CRITERIA.maxDebitRatio) continue;
          if (
            marketRatio >= CRITERIA.minDebitRatio &&
            marketRatio <= CRITERIA.maxDebitRatio
          ) {
            debit = marketDebit;
          } else if (marketRatio < CRITERIA.minDebitRatio && midDebit > 0) {
            debit = midDebit * 1.1;
            if (debit / width > CRITERIA.maxDebitRatio) continue;
          }
        }

        if (!debit) continue;

        // Calculate metrics
        const breakeven = longCall.strike + debit;
        const cushion = ((price - breakeven) / price) * 100;
        const maxProfit = width - debit;
        const returnOnRisk = maxProfit / debit;

        // Check cushion and return
        if (cushion < CRITERIA.minCushion) continue;
        if (returnOnRisk < CRITERIA.minReturn) continue;

        // Calculate PoP
        const iv = longCall.impliedVolatility || 0.3;
        const pop = calculatePoP(price, breakeven, iv, dte);

        if (pop < CRITERIA.minPoP) continue;

        // Found a viable spread!
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
      result.debitPct = (bestSpread.debit / bestSpread.width) * 100;
      result.cushion = bestSpread.cushion;
      result.pop = bestSpread.pop;
      result.returnPct = bestSpread.returnPct;
      result.viable = true;
      result.reason = '✅ Viable';
    } else {
      result.reason = 'No spread meets criteria';
    }

    return result;
  } catch (error) {
    result.reason = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
    return result;
  }
}

export interface ScanSpreadsOptions {
  list: string;
  tickers?: string;
  verbose?: boolean;
  relaxed?: boolean;
  fromScan?: boolean; // Use tickers from today's scan (ENTER decisions)
  minScore?: number; // Minimum score for --from-scan (default: 70)
  widths?: string; // v2.6.0: Width preset (small, medium, large, all) or comma-separated
}

/**
 * Main scan-spreads command
 * v2.6.0: Added width presets support
 */
export async function scanSpreads(options: ScanSpreadsOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  // Set criteria based on mode
  CRITERIA = options.relaxed ? RELAXED_CRITERIA : STRICT_CRITERIA;

  // v2.6.0: Handle width option
  if (options.widths) {
    const widthInput = options.widths.toLowerCase();
    if (WIDTH_PRESETS[widthInput]) {
      CRITERIA = { ...CRITERIA, widths: WIDTH_PRESETS[widthInput] };
    } else if (widthInput.includes(',')) {
      // Parse comma-separated widths
      const parsedWidths = widthInput
        .split(',')
        .map((w) => parseFloat(w.trim()))
        .filter((w) => !isNaN(w) && w > 0);
      if (parsedWidths.length > 0) {
        CRITERIA = { ...CRITERIA, widths: parsedWidths };
      }
    } else {
      const singleWidth = parseFloat(widthInput);
      if (!isNaN(singleWidth) && singleWidth > 0) {
        CRITERIA = { ...CRITERIA, widths: [singleWidth] };
      }
    }
  }

  // Get ticker list based on source
  let tickers: string[];
  let sourceDescription: string;

  if (options.tickers) {
    // Explicit ticker list
    tickers = options.tickers.split(',').map((t) => t.trim().toUpperCase());
    sourceDescription = 'specified tickers';
  } else if (options.fromScan) {
    // Two-stage workflow: use ENTER tickers from today's scan
    const minScore = options.minScore ?? 70;
    tickers = await fetchEnterTickersFromScan(minScore);
    if (tickers.length === 0) {
      return;
    }
    sourceDescription = `today's scan (score ≥${minScore})`;
  } else {
    const listName = options.list.toLowerCase();

    if (listName === 'db' || listName === 'sp500') {
      // Fetch from Supabase
      if (!isTickerDBConfigured()) {
        logger.error('Supabase not configured for ticker fetching.');
        logger.info('Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
        return;
      }
      tickers = await fetchSP500Tickers();
      if (tickers.length === 0) {
        logger.error('No tickers found in database.');
        return;
      }
      sourceDescription = `database (${tickers.length} tickers)`;
    } else if (TICKER_LISTS[listName]) {
      tickers = TICKER_LISTS[listName];
      sourceDescription = `${listName} list`;
    } else {
      logger.error(`Unknown list: ${listName}`);
      logger.info(
        `Available lists: ${Object.keys(TICKER_LISTS).join(', ')}, db, sp500`
      );
      logger.info(
        "Or use --from-scan to use tickers from today's scan results"
      );
      return;
    }
  }

  console.log();
  console.log(chalk.bold.cyan('  🔍 Deep ITM Spread Scanner'));
  console.log(chalk.gray(`  Source: ${sourceDescription}`));
  if (options.relaxed) {
    console.log(
      chalk.yellow('  Mode: RELAXED (showing close-to-viable setups)')
    );
  } else {
    console.log(chalk.gray('  Mode: STRICT (conservative criteria)'));
  }
  console.log();
  console.log(chalk.gray('  Criteria:'));
  console.log(
    chalk.gray(
      `    • Debit: ${(CRITERIA.minDebitRatio * 100).toFixed(0)}-${(CRITERIA.maxDebitRatio * 100).toFixed(0)}% of width`
    )
  );
  console.log(chalk.gray(`    • Cushion: ≥${CRITERIA.minCushion}%`));
  console.log(chalk.gray(`    • PoP: ≥${CRITERIA.minPoP}%`));
  console.log(
    chalk.gray(`    • Return: ≥${(CRITERIA.minReturn * 100).toFixed(0)}%`)
  );
  console.log(chalk.gray(`    • Target DTE: ~${CRITERIA.targetDTE} days`));
  // v2.6.0: Show widths being scanned
  console.log(chalk.gray(`    • Widths: $${CRITERIA.widths.join(', $')}`));
  console.log();

  // Reset proxy stats for clean tracking
  yahooProvider.resetStats();

  const results: SpreadResult[] = [];

  // Scan each ticker using YahooProvider (has built-in rate limiting)
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    if (!ticker) continue;
    process.stdout.write(
      chalk.gray(`  [${i + 1}/${tickers.length}] ${ticker.padEnd(6)}`)
    );

    const result = await findViableSpread(ticker);
    results.push(result);

    if (result.viable) {
      console.log(
        chalk.green(' ✅ ') +
          chalk.white(result.spread) +
          chalk.gray(` ($${result.debit?.toFixed(2)})`)
      );
    } else {
      console.log(chalk.gray(` ❌ ${result.reason}`));
    }

    // YahooProvider handles rate limiting internally, but add small delay for UX
    await new Promise((r) => setTimeout(r, 100));
  }

  // Display results
  const viable = results.filter((r) => r.viable);

  console.log();
  console.log(chalk.gray('─'.repeat(72)));
  console.log();

  if (viable.length === 0) {
    // Check if we had options API issues (rate limiting)
    const optionsErrors = results.filter((r) =>
      r.reason.toLowerCase().includes('no options')
    );
    const rateErrors = results.filter(
      (r) =>
        r.reason.toLowerCase().includes('429') ||
        r.reason.toLowerCase().includes('rate') ||
        r.reason.toLowerCase().includes('crumb')
    );

    if (rateErrors.length > 0 || optionsErrors.length === results.length) {
      console.log(chalk.yellow('  ⚠️  Yahoo Options API rate limited'));
      console.log(
        chalk.gray(
          '  The options chain API has stricter rate limits than quote data.'
        )
      );
      console.log(chalk.gray('  Suggestions:'));
      console.log(chalk.gray('    1. Wait 5-10 minutes and try again'));
      console.log(
        chalk.gray('    2. Use fewer tickers at a time (--tickers AAPL,MSFT)')
      );
      console.log(
        chalk.gray('    3. Check your broker directly for options chains')
      );
      console.log();

      // Show manual calculation hint for tickers we have price data for
      const tickersWithPrice = results.filter((r) => r.price > 0);
      if (tickersWithPrice.length > 0) {
        console.log(chalk.cyan('  📊 Manual Spread Calculator'));
        console.log(chalk.gray('  For deep ITM call debit spreads, target:'));
        console.log(chalk.gray('    • Long strike: 6-12% below current price'));
        console.log(chalk.gray('    • Width: $5 or $10'));
        console.log(chalk.gray('    • Debit: 55-80% of width'));
        console.log();
        for (const t of tickersWithPrice.slice(0, 5)) {
          const deep = (t.price * 0.9).toFixed(0);
          const target = (t.price * 0.94).toFixed(0);
          console.log(
            chalk.white(`  ${t.ticker}: $${t.price.toFixed(2)}`) +
              chalk.gray(` → Look for strikes around $${deep}-$${target}`)
          );
        }
      }
    } else {
      console.log(chalk.yellow('  ⚠️  No tickers found with viable spreads'));
      console.log(
        chalk.gray(
          '  Try a different list or check back when market conditions improve'
        )
      );
    }
  } else {
    console.log(
      chalk.bold.green(
        `  ✅ Found ${viable.length} ticker(s) with viable spreads:\n`
      )
    );

    const table = new Table({
      head: [
        chalk.cyan('Ticker'),
        chalk.cyan('Price'),
        chalk.cyan('Spread'),
        chalk.cyan('Debit'),
        chalk.cyan('Debit%'),
        chalk.cyan('Cushion'),
        chalk.cyan('PoP'),
        chalk.cyan('Return'),
        chalk.cyan('DTE'),
      ],
      colWidths: [8, 10, 12, 8, 9, 9, 7, 9, 6],
      style: { head: [], border: ['gray'] },
    });

    for (const r of viable) {
      table.push([
        chalk.bold(r.ticker),
        chalk.white(`$${r.price.toFixed(2)}`),
        chalk.white(r.spread ?? '-'),
        chalk.yellow(`$${r.debit?.toFixed(2)}`),
        chalk.white(`${r.debitPct?.toFixed(0)}%`),
        chalk.green(`${r.cushion?.toFixed(1)}%`),
        chalk.cyan(`${r.pop}%`),
        chalk.green(`${r.returnPct?.toFixed(0)}%`),
        chalk.gray(`${r.dte}`),
      ]);
    }

    console.log(table.toString());
    console.log();

    // Best pick
    const best = viable.sort((a, b) => (b.cushion ?? 0) - (a.cushion ?? 0))[0];
    if (best) {
      console.log(
        chalk.bold.white('  🏆 Best Setup: ') +
          chalk.cyan(best.ticker) +
          chalk.gray(' - ') +
          chalk.white(`${best.spread}`) +
          chalk.gray(` @ $${best.debit?.toFixed(2)}`)
      );
      console.log(
        chalk.gray('     ') +
          chalk.green(`${best.cushion?.toFixed(1)}% cushion`) +
          chalk.gray(' | ') +
          chalk.cyan(`${best.pop}% PoP`) +
          chalk.gray(' | ') +
          chalk.green(`${best.returnPct?.toFixed(0)}% return`)
      );
    }
  }

  console.log();
}
