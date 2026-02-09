/**
 * Spread Scanner Command
 *
 * Scans tickers to find those with viable deep ITM call spreads
 * meeting criteria from strategy.config.yaml:
 * - Cushion: ≥7% (from entry.cushion.minimum_pct)
 * - Return: ≥15% (from entry.spread.min_return_on_risk_pct)
 * - DTE: 21-45 days (from spread_params.dte)
 *
 * Two-stage workflow:
 * 1. Run `bun run scan` to find technically sound stocks (ENTER decisions)
 * 2. Run `bun run scan-spreads --from-scan` to find viable spreads
 *
 * v1.9.0: Uses YahooProvider with proxy support to avoid rate limiting
 * v2.8.0: Reads criteria from strategy.config.yaml
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { logger } from '../utils/logger.ts';
import {
  fetchSP500Tickers,
  isTickerDBConfigured,
  TICKER_LISTS,
} from '@portfolio/providers';
import { createClient } from '@supabase/supabase-js';
import { yahooProvider } from '../providers/yahoo.ts';
import { getSpreadCriteria } from '../config/strategy.ts';

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

// Spread criteria interface
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

/**
 * v2.8.0: Build criteria from strategy.config.yaml
 * This ensures we follow the documented strategy rules
 */
function buildCriteriaFromConfig(): Criteria {
  const configCriteria = getSpreadCriteria();

  return {
    minDebitRatio: configCriteria.minDebitRatio, // From config: 55%
    maxDebitRatio: configCriteria.maxDebitRatio, // From config: 80%
    minCushion: configCriteria.minCushion,
    minPoP: configCriteria.minPoP,
    minReturn: configCriteria.minReturn,
    targetDTE: configCriteria.targetDTE,
    minOI: configCriteria.minOI,
    widths: [5, 10],
  };
}

// Relaxed criteria for showing "close" setups
function buildRelaxedCriteria(): Criteria {
  const configCriteria = getSpreadCriteria();

  return {
    minDebitRatio: configCriteria.minDebitRatio - 0.1, // 10% below config
    maxDebitRatio: Math.min(0.95, configCriteria.maxDebitRatio + 0.1), // 10% above config, cap at 95%
    minCushion: Math.max(2, configCriteria.minCushion - 2), // 2% below config minimum
    minPoP: Math.max(50, configCriteria.minPoP - 10), // 10% below config
    minReturn: configCriteria.minReturn * 0.75, // 75% of config minimum
    targetDTE: configCriteria.maxDTE, // Use max DTE from config
    minOI: Math.max(5, Math.floor(configCriteria.minOI / 10)), // Relaxed OI
    widths: [1, 2.5, 5, 10, 20], // Include all widths
  };
}

// Active criteria (will be set at runtime from config)
let CRITERIA: Criteria;

// v2.6.0: Width presets for different account sizes
// v2.7.0: Added $1 width for very low-priced stocks
const WIDTH_PRESETS: Record<string, number[]> = {
  small: [1, 2.5, 5], // Small accounts ($1-5k) - includes $1 for low-priced stocks
  medium: [2.5, 5, 10], // Medium accounts ($5-25k)
  large: [5, 10, 20], // Large accounts ($25k+)
  all: [1, 2.5, 5, 10, 20], // Show all options
};

/**
 * v2.7.0: Get adaptive widths based on stock price
 * Lower-priced stocks need smaller widths to be viable
 * Always includes smaller widths for flexibility
 */
function getAdaptiveWidths(price: number, baseWidths: number[]): number[] {
  // Start with base widths and add smaller ones for lower-priced stocks
  const allWidths = new Set(baseWidths);

  if (price < 10) {
    // Very low-priced: add $1, $2.5 widths, filter out anything > $5
    allWidths.add(1);
    allWidths.add(2.5);
    return [...allWidths].filter((w) => w <= 5).sort((a, b) => a - b);
  } else if (price < 25) {
    // Low-priced: add $2.5, use up to $5
    allWidths.add(2.5);
    return [...allWidths].filter((w) => w <= 5).sort((a, b) => a - b);
  } else if (price < 75) {
    // Medium-priced: use up to $10
    return [...allWidths].filter((w) => w <= 10).sort((a, b) => a - b);
  }
  // High-priced: use all configured widths
  return [...allWidths].sort((a, b) => a - b);
}

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

    // Sort by strike
    const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

    // v2.7.1: Much wider ITM range - any ITM strike is acceptable
    // The cushion check will filter out strikes that are too close to ATM
    // For deep ITM spreads, we want delta > 0.7 which means roughly 5%+ ITM
    let itmLowPct: number;
    let itmHighPct: number;

    if (price < 15) {
      // Very low-priced: 3-25% ITM (very wide range)
      itmLowPct = 0.75;
      itmHighPct = 0.97;
    } else if (price < 50) {
      // Low-priced: 3-20% ITM
      itmLowPct = 0.8;
      itmHighPct = 0.97;
    } else if (price < 150) {
      // Medium-priced: 3-15% ITM
      itmLowPct = 0.85;
      itmHighPct = 0.97;
    } else {
      // High-priced: 3-12% ITM
      itmLowPct = 0.88;
      itmHighPct = 0.97;
    }

    const minITM = price * itmLowPct;
    const maxITM = price * itmHighPct;

    // v2.7.0: Get adaptive widths based on stock price
    const adaptiveWidths = getAdaptiveWidths(price, CRITERIA.widths);

    // v2.7.0: Log available strikes in verbose mode
    logger.debug(
      `  ${ticker}: Price $${price.toFixed(2)}, ITM range $${minITM.toFixed(2)}-$${maxITM.toFixed(2)}, widths: $${adaptiveWidths.join('/$')}`
    );
    logger.debug(
      `  ${ticker}: Available strikes: ${sortedCalls.map((c) => `$${c.strike}`).join(', ')}`
    );

    // v2.7.0: Track rejection reasons for diagnostics
    const rejectionStats = {
      notInITMRange: 0,
      lowOI: 0,
      noShortStrike: 0,
      debitTooHigh: 0,
      debitTooLow: 0,
      invalidDebit: 0,
      lowCushion: 0,
      lowReturn: 0,
      lowPoP: 0,
      evaluated: 0,
    };

    // v2.7.0: Relaxed OI requirement for low-priced stocks
    const minOI = price < 15 ? Math.min(5, CRITERIA.minOI) : CRITERIA.minOI;

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

    // v2.7.0: Track best near-miss for diagnostics
    let bestNearMiss: {
      long: number;
      short: number;
      debit: number;
      width: number;
      cushion: number;
      pop: number;
      returnPct: number;
      failReason: string;
    } | null = null;

    for (const longCall of sortedCalls) {
      // Must be in ITM range
      if (longCall.strike < minITM || longCall.strike > maxITM) {
        rejectionStats.notInITMRange++;
        continue;
      }
      // Must have liquidity
      if ((longCall.openInterest || 0) < minOI) {
        rejectionStats.lowOI++;
        continue;
      }

      // v2.7.0: Try adaptive widths based on stock price
      for (const width of adaptiveWidths) {
        const shortStrike = longCall.strike + width;
        const shortCall = sortedCalls.find((c) => c.strike === shortStrike);
        if (!shortCall) {
          rejectionStats.noShortStrike++;
          continue;
        }
        if ((shortCall.openInterest || 0) < 5) {
          rejectionStats.lowOI++;
          continue;
        }

        rejectionStats.evaluated++;

        // Calculate market debit
        const marketDebit = (longCall.ask || 0) - (shortCall.bid || 0);
        const midDebit =
          ((longCall.bid || 0) + (longCall.ask || 0)) / 2 -
          ((shortCall.bid || 0) + (shortCall.ask || 0)) / 2;

        // Apply criteria
        const marketRatio = marketDebit / width;

        let debit: number | null = null;
        if (marketDebit > 0 && isFinite(marketDebit)) {
          if (
            marketRatio >= CRITERIA.minDebitRatio &&
            marketRatio <= CRITERIA.maxDebitRatio
          ) {
            // Market debit in acceptable range — use as-is
            debit = marketDebit;
          } else if (marketRatio > CRITERIA.maxDebitRatio && midDebit > 0) {
            // v2.9.0: Market debit too high — try mid-market pricing
            // Deep ITM spreads naturally have inflated market debit due to
            // bid-ask spread on both legs. Mid-market is a fairer estimate
            // of the actual fill price with a limit order.
            const midRatio = midDebit / width;
            if (
              midRatio >= CRITERIA.minDebitRatio &&
              midRatio <= CRITERIA.maxDebitRatio
            ) {
              debit = midDebit;
              logger.debug(
                `    ${ticker} $${longCall.strike}/$${shortStrike}: Market debit $${marketDebit.toFixed(2)} (${(marketRatio * 100).toFixed(0)}%) too high, using mid $${midDebit.toFixed(2)} (${(midRatio * 100).toFixed(0)}%)`
              );
            } else {
              rejectionStats.debitTooHigh++;
              logger.debug(
                `    ${ticker} $${longCall.strike}/$${shortStrike}: Debit too high - market $${marketDebit.toFixed(2)} (${(marketRatio * 100).toFixed(0)}%), mid $${midDebit.toFixed(2)} (${(midRatio * 100).toFixed(0)}%) > ${CRITERIA.maxDebitRatio * 100}%`
              );
              continue;
            }
          } else if (marketRatio < CRITERIA.minDebitRatio && midDebit > 0) {
            debit = midDebit * 1.1;
            if (debit / width > CRITERIA.maxDebitRatio) {
              rejectionStats.debitTooLow++;
              continue;
            }
          } else if (marketRatio > CRITERIA.maxDebitRatio) {
            rejectionStats.debitTooHigh++;
            logger.debug(
              `    ${ticker} $${longCall.strike}/$${shortStrike}: Debit too high - $${marketDebit.toFixed(2)} (${(marketRatio * 100).toFixed(0)}% > ${CRITERIA.maxDebitRatio * 100}%), no mid-market available`
            );
            continue;
          }
        }

        if (!debit) {
          rejectionStats.invalidDebit++;
          continue;
        }

        // Calculate metrics
        const breakeven = longCall.strike + debit;
        const cushion = ((price - breakeven) / price) * 100;
        const maxProfit = width - debit;
        const returnOnRisk = maxProfit / debit;

        // Calculate PoP early so we can track near-misses
        const iv = longCall.impliedVolatility || 0.3;
        const pop = calculatePoP(price, breakeven, iv, dte);

        // Track this as a potential near-miss before checking criteria
        const spreadCandidate = {
          long: longCall.strike,
          short: shortStrike,
          debit,
          width,
          cushion,
          pop,
          returnPct: returnOnRisk * 100,
        };

        // Check cushion and return
        if (cushion < CRITERIA.minCushion) {
          rejectionStats.lowCushion++;
          logger.debug(
            `    ${ticker} $${longCall.strike}/$${shortStrike}: Low cushion - ${cushion.toFixed(1)}% < ${CRITERIA.minCushion}% (BE: $${breakeven.toFixed(2)}, price: $${price.toFixed(2)})`
          );
          // Track as near-miss if cushion is close (within 3%)
          if (
            cushion >= CRITERIA.minCushion - 3 &&
            (!bestNearMiss || cushion > bestNearMiss.cushion)
          ) {
            bestNearMiss = {
              ...spreadCandidate,
              failReason: `cushion ${cushion.toFixed(1)}%`,
            };
          }
          continue;
        }
        if (returnOnRisk < CRITERIA.minReturn) {
          rejectionStats.lowReturn++;
          logger.debug(
            `    ${ticker} $${longCall.strike}/$${shortStrike}: Low return - ${(returnOnRisk * 100).toFixed(0)}% < ${CRITERIA.minReturn * 100}%`
          );
          // Track as near-miss
          if (!bestNearMiss || cushion > bestNearMiss.cushion) {
            bestNearMiss = {
              ...spreadCandidate,
              failReason: `return ${(returnOnRisk * 100).toFixed(0)}%`,
            };
          }
          continue;
        }

        if (pop < CRITERIA.minPoP) {
          rejectionStats.lowPoP++;
          logger.debug(
            `    ${ticker} $${longCall.strike}/$${shortStrike}: Low PoP - ${pop.toFixed(0)}% < ${CRITERIA.minPoP}%`
          );
          // Track as near-miss if PoP is close (within 10%)
          if (
            pop >= CRITERIA.minPoP - 10 &&
            (!bestNearMiss || cushion > bestNearMiss.cushion)
          ) {
            bestNearMiss = {
              ...spreadCandidate,
              failReason: `PoP ${pop.toFixed(0)}%`,
            };
          }
          continue;
        }

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
      // v2.7.0: Better diagnostic for why no spread was found
      const itmCalls = sortedCalls.filter(
        (c) => c.strike >= minITM && c.strike <= maxITM
      );

      // Build detailed reason
      if (rejectionStats.evaluated === 0) {
        if (itmCalls.length === 0) {
          const closestStrike =
            sortedCalls.length > 0
              ? sortedCalls.reduce((closest, c) => {
                  const targetMid = (minITM + maxITM) / 2;
                  return Math.abs(c.strike - targetMid) <
                    Math.abs(closest.strike - targetMid)
                    ? c
                    : closest;
                }, sortedCalls[0]!)
              : undefined;
          result.reason = `No ITM strikes ($${minITM.toFixed(0)}-$${maxITM.toFixed(0)}), closest: $${closestStrike?.strike}`;
        } else if (rejectionStats.lowOI > 0) {
          result.reason = `Low OI on ${rejectionStats.lowOI} strikes (need ${minOI}+)`;
        } else if (rejectionStats.noShortStrike > 0) {
          result.reason = `No short strikes at $${adaptiveWidths.join('/$')} widths`;
        } else {
          result.reason = 'No spreads to evaluate';
        }
      } else {
        // We evaluated spreads but all failed criteria
        const failures: string[] = [];
        if (rejectionStats.debitTooHigh > 0)
          failures.push(
            `debit>${CRITERIA.maxDebitRatio * 100}%: ${rejectionStats.debitTooHigh}`
          );
        if (rejectionStats.lowCushion > 0)
          failures.push(
            `cushion<${CRITERIA.minCushion}%: ${rejectionStats.lowCushion}`
          );
        if (rejectionStats.lowPoP > 0)
          failures.push(`PoP<${CRITERIA.minPoP}%: ${rejectionStats.lowPoP}`);
        if (rejectionStats.lowReturn > 0)
          failures.push(
            `return<${CRITERIA.minReturn * 100}%: ${rejectionStats.lowReturn}`
          );
        if (rejectionStats.invalidDebit > 0)
          failures.push(`bad debit: ${rejectionStats.invalidDebit}`);
        result.reason = `${rejectionStats.evaluated} spreads failed: ${failures.join(', ')}`;
      }

      logger.debug(`  ${ticker}: ${result.reason}`);
      logger.debug(
        `    Stats: ITM=${itmCalls.length}, evaluated=${rejectionStats.evaluated}, noShort=${rejectionStats.noShortStrike}, highDebit=${rejectionStats.debitTooHigh}, lowCushion=${rejectionStats.lowCushion}, lowPoP=${rejectionStats.lowPoP}`
      );

      // v2.7.0: Show best near-miss if we evaluated any spreads
      if (bestNearMiss) {
        logger.debug(
          `    Near-miss: $${bestNearMiss.long}/$${bestNearMiss.short} ($${bestNearMiss.width}w) - debit $${bestNearMiss.debit.toFixed(2)}, cushion ${bestNearMiss.cushion.toFixed(1)}%, PoP ${bestNearMiss.pop.toFixed(0)}%, return ${bestNearMiss.returnPct.toFixed(0)}% [FAILED: ${bestNearMiss.failReason}]`
        );
      }
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
  dte?: number; // v2.7.1: Target DTE (default: 30, use 60+ for more cushion)
  pop?: number; // v2.7.1: Minimum PoP override (default: 70 strict, 55 relaxed)
}

/**
 * Main scan-spreads command
 * v2.6.0: Added width presets support
 * v2.7.1: Added DTE option for longer-dated spreads with more cushion
 * v2.8.0: Reads criteria from strategy.config.yaml
 */
export async function scanSpreads(options: ScanSpreadsOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  // v2.8.0: Set criteria based on mode (config values vs relaxed)
  CRITERIA = options.relaxed
    ? buildRelaxedCriteria()
    : buildCriteriaFromConfig();

  // v2.7.1: Override DTE if specified (otherwise use config)
  if (options.dte) {
    CRITERIA = { ...CRITERIA, targetDTE: options.dte };
  }

  // v2.7.1: Override PoP if specified
  if (options.pop) {
    CRITERIA = { ...CRITERIA, minPoP: options.pop };
  }

  // Log config source
  logger.debug(`Loaded criteria from strategy.config.yaml:`);
  logger.debug(
    `  cushion: ${CRITERIA.minCushion}% | return: ${(CRITERIA.minReturn * 100).toFixed(0)}% | DTE: ${CRITERIA.targetDTE} | OI: ${CRITERIA.minOI}`
  );

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
  console.log(chalk.gray('  Config: strategy.config.yaml'));
  if (options.relaxed) {
    console.log(
      chalk.yellow('  Mode: RELAXED (showing close-to-viable setups)')
    );
  } else {
    console.log(chalk.green('  Mode: STRICT (from strategy.config.yaml)'));
  }
  console.log();
  console.log(chalk.gray('  Criteria:'));
  console.log(
    chalk.gray(
      `    • Debit: ${(CRITERIA.minDebitRatio * 100).toFixed(0)}-${(CRITERIA.maxDebitRatio * 100).toFixed(0)}% of width`
    )
  );
  console.log(
    chalk.gray(
      `    • Cushion: ≥${CRITERIA.minCushion}% (config: entry.cushion.minimum_pct)`
    )
  );
  console.log(chalk.gray(`    • PoP: ≥${CRITERIA.minPoP}%`));
  console.log(
    chalk.gray(
      `    • Return: ≥${(CRITERIA.minReturn * 100).toFixed(0)}% (config: entry.spread.min_return_on_risk_pct)`
    )
  );
  console.log(
    chalk.gray(
      `    • Target DTE: ~${CRITERIA.targetDTE} days (config: spread_params.dte)`
    )
  );
  console.log(
    chalk.gray(
      `    • Min OI: ${CRITERIA.minOI} (config: entry.spread.min_open_interest)`
    )
  );
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
