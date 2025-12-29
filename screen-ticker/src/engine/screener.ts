import type { 
  StockScore, 
  ScanOptions, 
  HistoricalData,
  QuarterlyPerformance,
  QuoteSummary 
} from "../types/index.ts";
import { yahooProvider } from "../providers/yahoo.ts";
import { 
  fetchTickersFromDB, 
  fetchSP500Tickers,
  isTickerDBConfigured 
} from "../providers/tickers.ts";
import { calculateStockScore } from "./scorer.ts";
import { logger } from "../utils/logger.ts";
import { SP500_SAMPLE } from "../config/thresholds.ts";
import { 
  calculateMultiPeriodRS, 
  type RelativeStrengthResult 
} from "../utils/relative-strength.ts";
import { analyzeQuarterlyPerformance } from "../utils/quarterly-earnings.ts";
import { calculateSectorStrength, type SectorStrengthResult } from "../utils/sector-strength.ts";

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
    overallTrend: "strong" | "moderate" | "weak" | "underperforming";
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
    return options.tickers.split(",").map((t) => t.trim().toUpperCase());
  }

  // Try to fetch from database
  if (isTickerDBConfigured()) {
    if (options.list === "sp500") {
      const tickers = await fetchSP500Tickers();
      if (tickers.length > 0) {
        return tickers;
      }
    } else if (options.list === "all") {
      const tickers = await fetchTickersFromDB({ tickerType: "stock" });
      if (tickers.length > 0) {
        return tickers;
      }
    }
  }

  // Fallback to hardcoded sample if DB not available
  logger.warn(
    "Using fallback ticker list. Configure Supabase for full list."
  );
  
  if (options.list === "sp500") {
    return SP500_SAMPLE;
  }

  return SP500_SAMPLE.slice(0, 10);
}

/**
 * Scan a single ticker and return its score
 * Uses debug logging for batch scans to reduce noise
 */
export async function scanTicker(
  symbol: string, 
  options: { verbose?: boolean } = {}
): Promise<StockScore | null> {
  try {
    const { quote, summary, historical } = await yahooProvider.getAllData(
      symbol
    );

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

    return calculateStockScore(symbol, quote, summary, historical);
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
      yahooProvider.getHistorical("SPY"),
    ]);

    const { quote, summary, historical } = stockData;

    if (!quote || !summary) {
      logger.warn(`Incomplete data for ${symbol}, skipping`);
      return null;
    }

    const score = calculateStockScore(symbol, quote, summary, historical);
    
    // Calculate relative strength vs SPY
    let relativeStrength: AnalysisResult["relativeStrength"];
    if (spyData && spyData.length > 0 && historical.length > 0) {
      relativeStrength = calculateMultiPeriodRS(historical, spyData);
    }

    // Fetch options data (30 DTE default)
    const options = await yahooProvider.getOptionsChain(symbol, 30);

    // Analyze quarterly performance (v1.4.0)
    const quarterlyPerformance = analyzeQuarterlyPerformance(summary);

    // v1.7.0: Calculate sector relative strength
    const sectorStrength = await calculateSectorStrength(summary.assetProfile?.sector);

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
 */
export async function scanTickers(
  tickers: string[],
  options: { verbose?: boolean; batchSize?: number } = {}
): Promise<StockScore[]> {
  const results: StockScore[] = [];
  const total = tickers.length;
  let skipped = 0;
  let processed = 0;

  // Batch size: balance between speed and rate limiting
  // 5 concurrent requests is safe for Yahoo Finance
  const BATCH_SIZE = options.batchSize ?? 5;

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
          score: await scanTicker(ticker, { verbose: options.verbose }),
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

    // Progress update every 50 tickers (or after each batch in verbose)
    if (!options.verbose && processed % 50 < BATCH_SIZE && processed > 0) {
      logger.info(`Progress: ${processed}/${total} tickers scanned...`);
    }
  }

  logger.success(
    `Scanned ${results.length}/${total} tickers successfully` +
    (skipped > 0 ? ` (${skipped} skipped due to missing data)` : "")
  );
  return results;
}

/**
 * Run the full screening process
 */
export async function runScreener(
  options: ScanOptions
): Promise<StockScore[]> {
  const tickers = await getTickersToScan(options);
  
  logger.header(`Stock Opportunity Scanner`);
  logger.info(`List: ${options.list ?? "custom"}`);
  logger.info(`Tickers to scan: ${tickers.length}`);
  logger.info(`Minimum Score: ${options.minScore}`);
  logger.info(`Dry Run: ${options.dryRun}`);
  logger.divider();

  const scores = await scanTickers(tickers, { verbose: options.verbose });

  // Filter by minimum score
  const filtered = scores.filter((s) => s.totalScore >= options.minScore);

  // Sort by score descending
  filtered.sort((a, b) => b.totalScore - a.totalScore);

  return filtered;
}
