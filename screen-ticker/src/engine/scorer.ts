import type { 
  StockScore, 
  Signal, 
  QuoteData, 
  QuoteSummary, 
  HistoricalData,
  WeekContext,
  StockStyle
} from "../types/index.ts";
import { calculateTechnicalSignals } from "../signals/technical.ts";
import { calculateFundamentalSignals } from "../signals/fundamental.ts";
import { calculateAnalystSignals } from "../signals/analyst.ts";

/**
 * Classify stock as growth, value, or blend based on financial metrics
 * v1.1.1: Lowered growth threshold from 50% to 35% earnings growth
 */
function classifyStock(summary: QuoteSummary): StockStyle {
  const earningsGrowth = summary.financialData?.earningsGrowth?.raw ?? 0;
  const revenueGrowth = summary.financialData?.revenueGrowth?.raw ?? 0;
  const peg = summary.defaultKeyStatistics?.pegRatio?.raw;
  const pe = summary.summaryDetail?.trailingPE?.raw;
  
  // High growth: >35% earnings or >25% revenue growth (lowered from 50%/30%)
  if (earningsGrowth > 0.35 || revenueGrowth > 0.25) {
    return "growth";
  }
  
  // Value: PEG < 1 or P/E < 15
  if ((peg && peg > 0 && peg < 1) || (pe && pe > 0 && pe < 15)) {
    return "value";
  }
  
  return "blend";
}

/**
 * Calculate ATR (Average True Range) for volatility context
 * Used for position sizing and stop loss calculation
 */
function calculateATR(historical: HistoricalData[], period: number = 14): { atr: number; atrPercent: number } | null {
  if (historical.length < period + 1) return null;
  
  const trValues: number[] = [];
  
  // Calculate True Range for each day
  for (let i = 1; i < historical.length; i++) {
    const current = historical[i];
    const previous = historical[i - 1];
    if (!current || !previous) continue;
    
    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previous.close);
    const lowClose = Math.abs(current.low - previous.close);
    
    const trueRange = Math.max(highLow, highClose, lowClose);
    trValues.push(trueRange);
  }
  
  if (trValues.length < period) return null;
  
  // Calculate ATR (simple moving average of TR)
  const recentTR = trValues.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;
  
  // Calculate ATR as percentage of current price
  const currentPrice = historical[historical.length - 1]?.close ?? 0;
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  
  return { atr, atrPercent };
}

/**
 * Calculate 52-week context from quote and historical data
 */
function calculate52WeekContext(
  quote: QuoteData,
  historical: HistoricalData[],
  currentPrice: number,
  summary: QuoteSummary
): WeekContext {
  const context: WeekContext = {};

  // Try to get from quote first
  if (quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh) {
    context.low52 = quote.fiftyTwoWeekLow;
    context.high52 = quote.fiftyTwoWeekHigh;
  } else if (historical.length >= 252) {
    // Calculate from historical data
    const prices = historical.slice(-252).map(d => d.close);
    context.low52 = Math.min(...prices);
    context.high52 = Math.max(...prices);
  }

  // Calculate percentages
  if (context.low52 && context.high52 && currentPrice > 0) {
    context.pctFromLow = (currentPrice - context.low52) / context.low52;
    context.pctFromHigh = (context.high52 - currentPrice) / context.high52;
    const range = context.high52 - context.low52;
    if (range > 0) {
      context.positionInRange = (currentPrice - context.low52) / range;
    }
  }

  // MA200
  if (quote.twoHundredDayAverage) {
    context.ma200 = quote.twoHundredDayAverage;
  }

  // Market cap
  if (quote.marketCap) {
    context.marketCap = quote.marketCap;
  }

  // Next earnings date
  const earningsDates = summary.calendarEvents?.earnings?.earningsDate;
  if (earningsDates && earningsDates.length > 0) {
    // Find the next upcoming earnings date
    const now = new Date();
    const nextEarnings = earningsDates
      .filter(d => d > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    
    if (nextEarnings) {
      context.nextEarningsDate = nextEarnings;
    }
  }

  // Sector and Industry
  if (summary.assetProfile?.sector) {
    context.sector = summary.assetProfile.sector;
  }
  if (summary.assetProfile?.industry) {
    context.industry = summary.assetProfile.industry;
  }

  // Valuation metrics for sector comparison (v1.1.1)
  if (summary.summaryDetail?.trailingPE?.raw) {
    context.trailingPE = summary.summaryDetail.trailingPE.raw;
  }
  if (summary.summaryDetail?.forwardPE?.raw) {
    context.forwardPE = summary.summaryDetail.forwardPE.raw;
  }
  if (summary.defaultKeyStatistics?.pegRatio?.raw) {
    context.pegRatio = summary.defaultKeyStatistics.pegRatio.raw;
  }
  if (summary.defaultKeyStatistics?.enterpriseToEbitda?.raw) {
    context.evEbitda = summary.defaultKeyStatistics.enterpriseToEbitda.raw;
  }
  // Analyst target for R/R fallback
  if (summary.financialData?.targetMeanPrice?.raw) {
    context.analystTarget = summary.financialData.targetMeanPrice.raw;
  }

  // v1.7.0: Beta (volatility vs market)
  if (summary.defaultKeyStatistics?.beta?.raw) {
    context.beta = summary.defaultKeyStatistics.beta.raw;
  }

  // v1.7.0: Short Interest data
  if (summary.defaultKeyStatistics?.shortPercentOfFloat?.raw) {
    context.shortPercentOfFloat = summary.defaultKeyStatistics.shortPercentOfFloat.raw;
  }
  if (summary.defaultKeyStatistics?.sharesShort?.raw) {
    context.sharesShort = summary.defaultKeyStatistics.sharesShort.raw;
  }
  if (summary.defaultKeyStatistics?.shortRatio?.raw) {
    context.shortRatio = summary.defaultKeyStatistics.shortRatio.raw;
  }

  // v1.7.0: Balance sheet health metrics
  // Note: Yahoo returns D/E as percentage (41.0 = 41%), normalize to ratio
  if (summary.financialData?.debtToEquity?.raw) {
    let debtToEquity = summary.financialData.debtToEquity.raw;
    if (debtToEquity > 10) {
      debtToEquity = debtToEquity / 100;  // Convert percentage to ratio
    }
    context.debtToEquity = debtToEquity;
  }
  if (summary.financialData?.currentRatio?.raw) {
    context.currentRatio = summary.financialData.currentRatio.raw;
  }
  if (summary.financialData?.quickRatio?.raw) {
    context.quickRatio = summary.financialData.quickRatio.raw;
  }
  if (summary.financialData?.totalCash?.raw) {
    context.totalCash = summary.financialData.totalCash.raw;
  }
  if (summary.financialData?.totalDebt?.raw) {
    context.totalDebt = summary.financialData.totalDebt.raw;
  }

  // v1.7.0: ATR for volatility context
  const atrResult = calculateATR(historical);
  if (atrResult) {
    context.atr14 = atrResult.atr;
    context.atrPercent = atrResult.atrPercent;
  }

  return context;
}

/**
 * Calculate composite score for a single stock
 */
export function calculateStockScore(
  symbol: string,
  quote: QuoteData,
  summary: QuoteSummary,
  historical: HistoricalData[]
): StockScore {
  // Calculate signals from each category
  const technical = calculateTechnicalSignals(quote, historical);
  const fundamental = calculateFundamentalSignals(summary, quote.marketCap);
  const analyst = calculateAnalystSignals(summary);

  // Combine all signals
  const allSignals: Signal[] = [
    ...technical.signals,
    ...fundamental.signals,
    ...analyst.signals,
  ];

  // Calculate total score
  const totalScore = Math.min(
    technical.score + fundamental.score + analyst.score,
    100
  );

  // Get current price
  const price = 
    quote.regularMarketPrice ?? 
    summary.financialData?.currentPrice?.raw ?? 
    0;

  // Get company name
  const name = 
    quote.shortName ?? 
    summary.price?.shortName ?? 
    symbol;

  // Calculate 52-week context (with earnings and sector)
  const context = calculate52WeekContext(quote, historical, price, summary);

  // Classify stock style
  const stockStyle = classifyStock(summary);

  return {
    ticker: symbol,
    name,
    price,
    technicalScore: technical.score,
    fundamentalScore: fundamental.score,
    analystScore: analyst.score,
    totalScore,
    upsidePotential: analyst.upsidePotential,
    signals: allSignals,
    warnings: fundamental.warnings,
    dataQuality: fundamental.dataQuality,
    scanDate: new Date(),
    context,
    stockStyle,
  };
}

/**
 * Get a summary of the score breakdown
 */
export function getScoreBreakdown(score: StockScore): string {
  return [
    `Technical: ${score.technicalScore}/50`,
    `Fundamental: ${score.fundamentalScore}/30`,
    `Analyst: ${score.analystScore}/20`,
    `Total: ${score.totalScore}/100`,
  ].join(" | ");
}

/**
 * Get the top signals by points
 */
export function getTopSignals(
  score: StockScore, 
  limit = 3
): string[] {
  return score.signals
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((s) => s.name);
}

/**
 * Determine if a stock meets the minimum score threshold
 */
export function meetsThreshold(
  score: StockScore, 
  minScore: number
): boolean {
  return score.totalScore >= minScore;
}

/**
 * Sort scores by total score descending
 */
export function sortByScore(scores: StockScore[]): StockScore[] {
  return [...scores].sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Filter and sort scores above threshold
 */
export function filterTopOpportunities(
  scores: StockScore[],
  minScore: number
): StockScore[] {
  return sortByScore(
    scores.filter((s) => meetsThreshold(s, minScore))
  );
}

