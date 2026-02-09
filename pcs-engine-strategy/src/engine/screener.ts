/**
 * PCS Stock Screener
 *
 * Screens stocks for suitability as put credit spread candidates.
 * Uses technical, fundamental, analyst, and IV signals.
 */

import type {
  QuoteData,
  QuoteSummary,
  HistoricalData,
} from '../types/index.ts';
import type { PCSStockScore } from '../types/index.ts';
import { calculateTechnicalSignals } from '../signals/technical.ts';
import { calculateFundamentalSignals } from '../signals/fundamental.ts';
import { calculateAnalystSignals } from '../signals/analyst.ts';
import { estimateIVRank, calculateIVSignals } from '../signals/iv-analysis.ts';

/**
 * Screen a single stock for PCS suitability
 */
export function screenStock(
  quote: QuoteData,
  summary: QuoteSummary | null,
  historical: HistoricalData[],
  atmIV: number | null = null
): PCSStockScore {
  const currentPrice = quote.regularMarketPrice ?? 0;
  const closes = historical.map((d) => d.close);

  // 1. Technical signals (max 40 pts for PCS)
  const technicalResult = calculateTechnicalSignals(quote, historical);

  // 2. Fundamental signals (max 25 pts for PCS)
  const fundamentalResult = calculateFundamentalSignals(summary);

  // 3. Analyst signals (max 15 pts for PCS)
  const analystResult = calculateAnalystSignals(summary);

  // 4. IV signals (max 20 pts, NEW for PCS)
  const ivRank = estimateIVRank(atmIV, closes);
  const ivResult = calculateIVSignals(ivRank, atmIV);

  // Total score (max 100)
  const totalScore = Math.min(
    100,
    technicalResult.score +
      fundamentalResult.score +
      analystResult.score +
      ivResult.score
  );

  // Upside potential
  const targetPrice = summary?.financialData?.targetMeanPrice?.raw;
  const upsidePotential =
    targetPrice && currentPrice > 0
      ? ((targetPrice - currentPrice) / currentPrice) * 100
      : 0;

  // Warnings
  const warnings: string[] = [];
  if (currentPrice < (quote.twoHundredDayAverage ?? 0)) {
    warnings.push('Below MA200');
  }
  if ((ivRank ?? 0) < 15) {
    warnings.push('IV too low for premium selling');
  }

  return {
    ticker: quote.symbol,
    name: quote.shortName,
    price: currentPrice,
    technicalScore: technicalResult.score,
    fundamentalScore: fundamentalResult.score,
    analystScore: analystResult.score,
    ivScore: ivResult.score,
    totalScore,
    upsidePotential,
    signals: [
      ...technicalResult.signals,
      ...fundamentalResult.signals,
      ...analystResult.signals,
      ...ivResult.signals,
    ],
    warnings,
    scanDate: new Date(),
    sector: summary?.assetProfile?.sector,
    industry: summary?.assetProfile?.industry,
    ivRank: ivRank ?? undefined,
  };
}
