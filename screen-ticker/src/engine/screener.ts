import type {
  StockScore,
  ScanOptions,
  HistoricalData,
  QuarterlyPerformance,
  QuoteSummary,
} from '../types/index.ts';
import { yahooProvider } from '../providers/yahoo.ts';
import {
  fetchTickersFromDB,
  fetchSP500Tickers,
  isTickerDBConfigured,
} from '../providers/tickers.ts';
import { calculateStockScore } from './scorer.ts';
import { logger } from '../utils/logger.ts';
import { SP500_SAMPLE } from '../config/thresholds.ts';
import {
  calculateMultiPeriodRS,
  type RelativeStrengthResult,
} from '../utils/relative-strength.ts';
import { analyzeQuarterlyPerformance } from '../utils/quarterly-earnings.ts';
import {
  calculateSectorStrength,
  type SectorStrengthResult,
} from '../utils/sector-strength.ts';

/**
 * Options chain data
 */
export interface OptionsData {
  calls: Array<{
    strike: number;
    expiration: Date;
    bid: number;
    ask: number;
    openInterest: number;
    volume: number;
    impliedVolatility: number;
  }>;
  puts: Array<{
    strike: number;
    expiration: Date;
    bid: number;
    ask: number;
    openInterest: number;
    volume: number;
    impliedVolatility: number;
  }>;
  expiration: Date;
}

/**
 * Extended analysis result with historical data
 * v1.7.0: Added sector strength
 */
export interface AnalysisResult {
  score: StockScore;
  historical: HistoricalData[];
  summary: QuoteSummary;
  relativeStrength?: {
    rs20: RelativeStrengthResult | null;
    rs50: RelativeStrengthResult | null;
    rs200: RelativeStrengthResult | null;
    overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  };
  options?: OptionsData | null;
  quarterlyPerformance?: QuarterlyPerformance | null;
  /** v1.7.0: Sector relative strength */
  sectorStrength?: SectorStrengthResult | null;
}

/**
 * Get list of tickers to scan based on options
 */
export async function getTickersToScan(
  options: ScanOptions
): Promise<string[]> {
  // If specific tickers provided, use those
  if (options.tickers) {
    return options.tickers.split(',').map((t) => t.trim().toUpperCase());
  }

  // Try to fetch from database or Wikipedia
  if (options.list === 'sp500') {
    const tickers = await fetchSP500Tickers({ limit: options.top });
    if (tickers.length > 0) {
      return tickers;
    }
  } else if (isTickerDBConfigured() && options.list === 'all') {
    const tickers = await fetchTickersFromDB({
      tickerType: 'stock',
      limit: options.top,
    });
    if (tickers.length > 0) {
      return tickers;
    }
  }

  // Fallback to hardcoded sample if DB not available
  logger.warn('Using fallback ticker list. Configure Supabase for full list.');

  if (options.list === 'sp500') {
    return SP500_SAMPLE;
  }

  return SP500_SAMPLE.slice(0, 10);
}

/**
 * Debug output for indicator values
 * v2.5.0: Helps troubleshoot scoring issues
 */
function printDebugIndicators(
  symbol: string,
  quote: import('../types/index.ts').QuoteData,
  summary: import('../types/index.ts').QuoteSummary,
  historical: HistoricalData[],
  score: StockScore
): void {
  const price = quote.regularMarketPrice ?? 0;
  const ma50 = quote.fiftyDayAverage;
  const ma200 = quote.twoHundredDayAverage;

  // Calculate RSI manually for display
  let rsiValue = 'N/A';
  if (historical.length >= 15) {
    const closes = historical.map((h) => h.close);
    const rsiSignal = score.signals.find((s) =>
      s.name.toLowerCase().includes('rsi')
    );
    if (rsiSignal && typeof rsiSignal.value === 'number') {
      rsiValue = rsiSignal.value.toFixed(1);
    }
  }

  // Get 20-day high for pullback calculation
  const recent20 = historical.slice(-20);
  const high20 =
    recent20.length > 0 ? Math.max(...recent20.map((h) => h.close)) : price;
  const pullbackPct = ((high20 - price) / high20) * 100;

  console.log(`\n  ┌─ ${symbol} DEBUG INDICATORS ───────────────────────`);
  console.log(`  │ Price:     $${price.toFixed(2)}`);
  console.log(
    `  │ MA50:      ${ma50 ? `$${ma50.toFixed(2)} (${price > ma50 ? '↑ above' : '↓ below'})` : 'N/A'}`
  );
  console.log(
    `  │ MA200:     ${ma200 ? `$${ma200.toFixed(2)} (${price > ma200 ? '↑ above' : '↓ below'})` : 'N/A'}`
  );
  console.log(`  │ RSI(14):   ${rsiValue}`);
  console.log(`  │ Pullback:  ${pullbackPct.toFixed(1)}% from 20d high`);
  console.log(`  │`);
  console.log(`  │ SCORES:`);
  console.log(`  │   Technical:   ${score.technicalScore}/50`);
  console.log(`  │   Fundamental: ${score.fundamentalScore}/30`);
  console.log(`  │   Analyst:     ${score.analystScore}/20`);
  console.log(`  │   TOTAL:       ${score.totalScore}/100`);
  console.log(`  │`);
  console.log(`  │ SIGNALS (${score.signals.length}):`);
  for (const signal of score.signals.slice(0, 8)) {
    const pts = signal.points > 0 ? `+${signal.points}` : signal.points;
    console.log(`  │   [${pts.toString().padStart(3)}] ${signal.name}`);
  }
  if (score.signals.length > 8) {
    console.log(`  │   ... and ${score.signals.length - 8} more`);
  }
  console.log(`  └────────────────────────────────────────────────\n`);
}

/**
 * Scan a single ticker and return its score
 * Uses debug logging for batch scans to reduce noise
 * v2.5.0: Added debugIndicators option
 */
export async function scanTicker(
  symbol: string,
  options: { verbose?: boolean; debugIndicators?: boolean } = {}
): Promise<StockScore | null> {
  try {
    const { quote, summary, historical } =
      await yahooProvider.getAllData(symbol);

    if (!quote || !summary) {
      // Use debug for batch scans (expected for many tickers)
      // Only warn in verbose mode
      if (options.verbose) {
        logger.warn(`Incomplete data for ${symbol}, skipping`);
      } else {
        logger.debug(`Skipping ${symbol}: incomplete data`);
      }
      return null;
    }

    const score = calculateStockScore(symbol, quote, summary, historical);

    // v2.5.0: Print debug indicators if requested
    if (options.debugIndicators && score.totalScore >= 60) {
      printDebugIndicators(symbol, quote, summary, historical, score);
    }

    return score;
  } catch (error) {
    // Only log errors that aren't expected during batch scans
    if (options.verbose) {
      logger.error(`Failed to scan ${symbol}: ${error}`);
    } else {
      logger.debug(`Skipping ${symbol}: ${error}`);
    }
    return null;
  }
}

/**
 * Analyze a single ticker with full data including historical
 * v1.7.0: Added sector strength calculation
 */
export async function analyzeTicker(
  symbol: string
): Promise<AnalysisResult | null> {
  try {
    // Fetch stock data and SPY data in parallel
    const [stockData, spyData] = await Promise.all([
      yahooProvider.getAllData(symbol),
      yahooProvider.getHistorical('SPY'),
    ]);

    const { quote, summary, historical } = stockData;

    if (!quote || !summary) {
      logger.warn(`Incomplete data for ${symbol}, skipping`);
      return null;
    }

    const score = calculateStockScore(symbol, quote, summary, historical);

    // Calculate relative strength vs SPY
    let relativeStrength: AnalysisResult['relativeStrength'];
    if (spyData && spyData.length > 0 && historical.length > 0) {
      relativeStrength = calculateMultiPeriodRS(historical, spyData);
    }

    // Fetch options data (30 DTE default)
    const options = await yahooProvider.getOptionsChain(symbol, 30);

    // Analyze quarterly performance (v1.4.0)
    const quarterlyPerformance = analyzeQuarterlyPerformance(summary);

    // v1.7.0: Calculate sector relative strength
    const sectorStrength = await calculateSectorStrength(
      summary.assetProfile?.sector
    );

    return {
      score,
      historical,
      summary,
      relativeStrength,
      options,
      quarterlyPerformance,
      sectorStrength,
    };
  } catch (error) {
    logger.error(`Failed to analyze ${symbol}: ${error}`);
    return null;
  }
}

/**
 * Scan multiple tickers with progress logging
 * v1.4.1: Reduced verbosity for skipped tickers
 * v1.7.1: Batch concurrent scanning for 3-5x performance improvement
 * v2.4.0: Reduced batch size to respect proxy rate limits
 * v2.5.0: Added debugIndicators option
 */
export async function scanTickers(
  tickers: string[],
  options: {
    verbose?: boolean;
    batchSize?: number;
    debugIndicators?: boolean;
  } = {}
): Promise<StockScore[]> {
  const results: StockScore[] = [];
  const total = tickers.length;
  let skipped = 0;
  let processed = 0;

  // v2.4.1: Reduced batch size to 1 (serial) for reliability
  // Concurrent fetches were causing connection issues on large scans
  // Serial is slower (~1 ticker/sec) but 100% reliable
  const BATCH_SIZE = options.batchSize ?? 1;

  // Delay between tickers to prevent connection buildup
  const BATCH_DELAY_MS = 200;

  logger.info(`Scanning ${total} tickers (batch size: ${BATCH_SIZE})...`);

  // Process tickers in batches for concurrent execution
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE).filter(Boolean);

    // Process batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        if (options.verbose) {
          logger.debug(`Scanning ${ticker}...`);
        }
        return {
          ticker,
          score: await scanTicker(ticker, {
            verbose: options.verbose,
            debugIndicators: options.debugIndicators,
          }),
        };
      })
    );

    // Collect results
    for (const { ticker, score } of batchResults) {
      processed++;
      if (score) {
        results.push(score);

        // Log high-scoring stocks immediately
        if (score.totalScore >= 70) {
          logger.ticker(
            ticker,
            score.totalScore,
            score.signals.slice(0, 3).map((s) => s.name)
          );
        }
      } else {
        skipped++;
      }
    }

    // Progress update every 20 tickers (or after each batch in verbose)
    if (!options.verbose && processed % 20 < BATCH_SIZE && processed > 0) {
      logger.info(`Progress: ${processed}/${total} tickers scanned...`);
    }

    // v2.4.0: Delay between batches to prevent rate limit buildup
    if (i + BATCH_SIZE < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  logger.success(
    `Scanned ${results.length}/${total} tickers successfully` +
      (skipped > 0 ? ` (${skipped} skipped due to missing data)` : '')
  );
  return results;
}

/**
 * Run the full screening process
 * v2.5.0: Added debugIndicators support
 */
export async function runScreener(options: ScanOptions): Promise<StockScore[]> {
  const tickers = await getTickersToScan(options);

  logger.header(`Stock Opportunity Scanner`);
  logger.info(`List: ${options.list ?? 'custom'}`);
  logger.info(`Tickers to scan: ${tickers.length}`);
  logger.info(`Minimum Score: ${options.minScore}`);
  logger.info(`Dry Run: ${options.dryRun}`);
  if (options.debugIndicators) {
    logger.info(`Debug Indicators: enabled (score >= 60)`);
  }
  logger.divider();

  const scores = await scanTickers(tickers, {
    verbose: options.verbose,
    debugIndicators: options.debugIndicators,
  });

  // Filter by minimum score
  const filtered = scores.filter((s) => s.totalScore >= options.minScore);

  // Sort by score descending
  filtered.sort((a, b) => b.totalScore - a.totalScore);

  return filtered;
}
