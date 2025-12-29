/**
 * Analyze Command
 * Main ticker analysis with fair value and strategy recommendation
 */

import chalk from "chalk";
import YahooFinance from "yahoo-finance2";
import { RSI, SMA } from "technicalindicators";

// Instantiate yahoo-finance2 (required in v3+)
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "rippiReport"],
});
import { 
  calculateFairValue, 
  formatFairValueForDisplay, 
  type ValuationInputs 
} from "../engine/fair-value.ts";
import { 
  selectStrategy, 
  formatStrategyForDisplay, 
  getStrategyEmoji 
} from "../engine/strategy.ts";
import { 
  generateCompletion, 
  validateAIRequirement, 
  type OllamaMode 
} from "../services/ollama.ts";
import { 
  getPsychologicalFairValue,
  getKeyMagneticLevels,
  hasMeanReversionSignal,
  type PsychologicalFairValue,
} from "../services/psychological-fair-value.ts";
import {
  getIVAnalysis,
  findSpreadWithAlternatives,
  type IVAnalysis,
  type SpreadRecommendation,
  type SpreadSelectionContext,
} from "../services/yahoo.ts";
import type { 
  MarketRegime, 
  FairValueResult, 
  StrategyRecommendation 
} from "../types/index.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ACCOUNT_SIZE = 1500;

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzeOptions {
  aiMode: OllamaMode;
  aiModel?: string;
  position?: string;
  noChart?: boolean;
  accountSize?: number;
}

// Analyst rating change (upgrade/downgrade)
interface RatingChange {
  date: string;
  firm: string;
  action: string;
  toGrade: string;
  fromGrade?: string;
  targetPrice?: number;
  priorTarget?: number;
}

// Analyst ratings breakdown
interface AnalystRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  bullishPercent: number;
  recentChanges: RatingChange[];
}

// Ownership breakdown
interface OwnershipData {
  insidersPercent: number;
  institutionsPercent: number;
  institutionsCount: number;
  recentInsiderSales?: {
    totalValue: number;
    transactions: number;
    lastDate?: string;
  };
}

interface TargetPrices {
  low: number;
  mean: number;
  high: number;
  upside: number;
}

interface PricePerformance {
  day5: number;
  month1: number;
  month3: number;
  ytd: number;
}

interface EarningsInfo {
  date?: string;
  daysUntil?: number;
  streak?: number;
  lastSurprise?: number;
  avgSurprise?: number;
}

interface SectorContext {
  name: string;
  avgPE?: number;
  vsAvg?: number;
}

interface VolumeAnalysis {
  todayPct: number;
  trend: 'increasing' | 'stable' | 'declining';
  unusualDays: number;
}

interface RiskMetrics {
  beta?: number;
}

interface VolatilityMetrics {
  iv?: number;          // Implied volatility %
  hv20?: number;        // 20-day historical volatility
  ivRank?: number;      // IV percentile
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  premium?: 'cheap' | 'fair' | 'expensive';
}

interface ShortInterest {
  shortPct: number;
  shortRatio: number;
  sharesShort: number;
}

interface RelativeStrength {
  vsSPY: number;
  vsSector?: number;
}

interface OptionsFlow {
  pcRatioOI: number;
  pcRatioVol: number;
  totalCallOI: number;
  totalPutOI: number;
}

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  sector: string;
  // Valuation
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  trailingEps?: number;
  forwardEps?: number;
  // Cash flow
  freeCashFlow?: number;
  sharesOutstanding?: number;
  // Growth
  earningsGrowth?: number;
  revenueGrowth?: number;
  // Analyst
  targetPrice?: number;
  numberOfAnalysts?: number;
  recommendationMean?: number;
  // Technical
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  ma50?: number;
  ma200?: number;
  beta?: number;
  // Target price range
  targetPrices?: TargetPrices;
  // Price performance
  performance?: PricePerformance;
  // Enhanced analyst data
  analystRatings?: AnalystRatings;
  // Ownership data
  ownership?: OwnershipData;
  // NEW: Additional context
  earnings?: EarningsInfo;
  sectorContext?: SectorContext;
  volumeAnalysis?: VolumeAnalysis;
  risk?: RiskMetrics;
  volatility?: VolatilityMetrics;
  // NEW: High-value additions
  shortInterest?: ShortInterest;
  relativeStrength?: RelativeStrength;
  optionsFlow?: OptionsFlow;
  // NEW: Spread recommendation
  spread?: SpreadRecommendation;
}

interface TechnicalData {
  rsi: number;
  ma20: number;
  ma50: number;
  ma200: number;
  aboveMA200: boolean;
  score: number;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchStockData(ticker: string): Promise<StockData | null> {
  try {
    const quote = await yahooFinance.quote(ticker);
    
    if (!quote || !quote.regularMarketPrice) {
      return null;
    }

    // Get additional data
    let insights: Awaited<ReturnType<typeof yahooFinance.quoteSummary>> | null = null;
    try {
      insights = await yahooFinance.quoteSummary(ticker, {
        modules: [
          "financialData", 
          "defaultKeyStatistics", 
          "earningsHistory",
          "calendarEvents",
          "recommendationTrend",
          "upgradeDowngradeHistory",
          "majorHoldersBreakdown",
          "insiderTransactions",
          "assetProfile",  // For sector/industry data
        ],
      });
    } catch {
      // Insights optional
    }

    const fd = insights?.financialData;
    const ks = insights?.defaultKeyStatistics;
    
    // Process analyst ratings breakdown
    let analystRatings: AnalystRatings | undefined;
    const recTrend = insights?.recommendationTrend?.trend?.[0]; // Current month
    if (recTrend) {
      const total = (recTrend.strongBuy ?? 0) + (recTrend.buy ?? 0) + 
        (recTrend.hold ?? 0) + (recTrend.sell ?? 0) + (recTrend.strongSell ?? 0);
      const bullish = (recTrend.strongBuy ?? 0) + (recTrend.buy ?? 0);
      
      // Process recent upgrades/downgrades
      const recentChanges: RatingChange[] = [];
      const history = insights?.upgradeDowngradeHistory?.history ?? [];
      for (const change of history.slice(0, 5)) {
        recentChanges.push({
          date: change.epochGradeDate 
            ? new Date(change.epochGradeDate).toISOString().split('T')[0]
            : 'Unknown',
          firm: change.firm ?? 'Unknown',
          action: change.action ?? 'unknown',
          toGrade: change.toGrade ?? 'Unknown',
          fromGrade: change.fromGrade,
          targetPrice: change.currentPriceTarget,
          priorTarget: change.priorPriceTarget,
        });
      }
      
      analystRatings = {
        strongBuy: recTrend.strongBuy ?? 0,
        buy: recTrend.buy ?? 0,
        hold: recTrend.hold ?? 0,
        sell: recTrend.sell ?? 0,
        strongSell: recTrend.strongSell ?? 0,
        total,
        bullishPercent: total > 0 ? Math.round((bullish / total) * 100) : 0,
        recentChanges,
      };
    }
    
    // Process ownership data
    let ownership: OwnershipData | undefined;
    const holders = insights?.majorHoldersBreakdown;
    if (holders) {
      // Process insider transactions for recent sales
      const insiderTx = insights?.insiderTransactions?.transactions ?? [];
      const recentSales = insiderTx
        .filter(tx => tx.transactionText?.toLowerCase().includes('sale'))
        .slice(0, 10);
      
      const totalSalesValue = recentSales.reduce(
        (sum, tx) => sum + (tx.value ?? 0), 0
      );
      
      ownership = {
        insidersPercent: Math.round((holders.insidersPercentHeld ?? 0) * 1000) / 10,
        institutionsPercent: Math.round(
          (holders.institutionsPercentHeld ?? 0) * 1000
        ) / 10,
        institutionsCount: holders.institutionsCount ?? 0,
        recentInsiderSales: recentSales.length > 0 ? {
          totalValue: totalSalesValue,
          transactions: recentSales.length,
          lastDate: recentSales[0]?.startDate 
            ? new Date(recentSales[0].startDate).toISOString().split('T')[0]
            : undefined,
        } : undefined,
      };
    }

    // Process target prices
    let targetPrices: TargetPrices | undefined;
    if (fd?.targetLowPrice && fd?.targetMeanPrice && fd?.targetHighPrice) {
      const upside = ((fd.targetMeanPrice - quote.regularMarketPrice) / 
        quote.regularMarketPrice) * 100;
      targetPrices = {
        low: fd.targetLowPrice,
        mean: fd.targetMeanPrice,
        high: fd.targetHighPrice,
        upside: Math.round(upside * 10) / 10,
      };
    }
    
    // Calculate price performance and historical volatility from historical data
    let performance: PricePerformance | undefined;
    let hv20: number | undefined;
    try {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const history = await yahooFinance.chart(ticker, {
        period1: startOfYear < threeMonthsAgo ? startOfYear : threeMonthsAgo,
        period2: now,
        interval: "1d",
      });
      
      if (history?.quotes && history.quotes.length > 5) {
        const closes = history.quotes
          .map(q => ({ date: q.date, close: q.close }))
          .filter((q): q is { date: Date; close: number } => 
            q.close !== null && q.close !== undefined && q.date !== null
          );
        
        const currentPrice = quote.regularMarketPrice;
        
        const findPriceAtDaysAgo = (days: number): number | null => {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - days);
          for (let i = closes.length - 1; i >= 0; i--) {
            if (closes[i].date <= targetDate) {
              return closes[i].close;
            }
          }
          return closes[0]?.close ?? null;
        };
        
        const price5d = findPriceAtDaysAgo(5);
        const price1m = findPriceAtDaysAgo(30);
        const price3m = findPriceAtDaysAgo(90);
        const ytdPrice = closes.find(c => 
          c.date.getFullYear() === now.getFullYear()
        )?.close;
        
        if (price5d && price1m && price3m && ytdPrice) {
          performance = {
            day5: Math.round(((currentPrice - price5d) / price5d) * 1000) / 10,
            month1: Math.round(((currentPrice - price1m) / price1m) * 1000) / 10,
            month3: Math.round(((currentPrice - price3m) / price3m) * 1000) / 10,
            ytd: Math.round(((currentPrice - ytdPrice) / ytdPrice) * 1000) / 10,
          };
        }
        
        // Calculate 20-day Historical Volatility (HV20)
        const recentCloses = closes.slice(-21).map(c => c.close);
        if (recentCloses.length >= 21) {
          const returns: number[] = [];
          for (let i = 1; i < recentCloses.length; i++) {
            returns.push(Math.log(recentCloses[i] / recentCloses[i - 1]));
          }
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / 
            (returns.length - 1);
          const stdDev = Math.sqrt(variance);
          hv20 = Math.round(stdDev * Math.sqrt(252) * 1000) / 10;
        }
      }
    } catch {
      // Performance data optional
    }
    
    // Calculate relative strength vs SPY (30-day)
    let relativeStrength: RelativeStrength | undefined;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const spyHistory = await yahooFinance.chart('SPY', {
        period1: thirtyDaysAgo,
        period2: new Date(),
        interval: '1d',
      });
      
      if (spyHistory?.quotes && spyHistory.quotes.length > 5 && performance) {
        const spyStart = spyHistory.quotes[0]?.close;
        const spyEnd = spyHistory.quotes[spyHistory.quotes.length - 1]?.close;
        
        if (spyStart && spyEnd) {
          const spyReturn = ((spyEnd - spyStart) / spyStart) * 100;
          relativeStrength = {
            vsSPY: Math.round((performance.month1 - spyReturn) * 10) / 10,
          };
        }
      }
    } catch {
      // Relative strength optional
    }
    
    // Calculate options flow (put/call ratio)
    let optionsFlow: OptionsFlow | undefined;
    try {
      const options = await yahooFinance.options(ticker);
      
      let totalCallOI = 0;
      let totalPutOI = 0;
      let totalCallVol = 0;
      let totalPutVol = 0;
      
      for (const expiry of options.options || []) {
        for (const call of expiry.calls || []) {
          totalCallOI += call.openInterest || 0;
          totalCallVol += call.volume || 0;
        }
        for (const put of expiry.puts || []) {
          totalPutOI += put.openInterest || 0;
          totalPutVol += put.volume || 0;
        }
      }
      
      if (totalCallOI > 0) {
        optionsFlow = {
          pcRatioOI: Math.round((totalPutOI / totalCallOI) * 100) / 100,
          pcRatioVol: totalCallVol > 0 
            ? Math.round((totalPutVol / totalCallVol) * 100) / 100 
            : 0,
          totalCallOI,
          totalPutOI,
        };
      }
    } catch {
      // Options flow optional
    }
    
    // Get IV analysis from options chain
    let ivAnalysis: IVAnalysis | null = null;
    try {
      ivAnalysis = await getIVAnalysis(ticker);
    } catch {
      // IV analysis optional
    }
    
    // Get optimal spread recommendation with context (consistent with chat command)
    let spread: SpreadRecommendation | null = null;
    try {
      // Build spread context from available data (MAs available from quote)
      const spreadContext: SpreadSelectionContext = {
        ma50: quote.fiftyDayAverage ?? undefined,
        ma200: quote.twoHundredDayAverage ?? undefined,
      };
      const spreadResult = await findSpreadWithAlternatives(ticker, 30, undefined, spreadContext);
      spread = spreadResult.primary;
    } catch {
      // Spread optional
    }
    
    // Process earnings info with beat/miss history
    let earnings: EarningsInfo | undefined;
    const earningsHist = insights?.earningsHistory?.history ?? [];
    const calEvents = insights?.calendarEvents;
    
    let streak = 0;
    let surpriseSum = 0;
    let surpriseCount = 0;
    let lastSurprise: number | undefined;
    
    for (let i = 0; i < earningsHist.length && i < 4; i++) {
      const h = earningsHist[i];
      if (h.epsActual !== undefined && h.epsEstimate !== undefined && 
          h.epsEstimate !== 0) {
        const surprise = ((h.epsActual - h.epsEstimate) / 
          Math.abs(h.epsEstimate)) * 100;
        if (i === 0) lastSurprise = Math.round(surprise * 10) / 10;
        surpriseSum += surprise;
        surpriseCount++;
        if (i === 0 || (streak > 0 && surprise > 0) || 
            (streak < 0 && surprise < 0)) {
          streak += surprise > 0 ? 1 : -1;
        }
      }
    }
    
    const nextEarnings = calEvents?.earnings?.earningsDate?.[0];
    let earningsDate: string | undefined;
    let daysUntilEarnings: number | undefined;
    
    if (nextEarnings) {
      const earningsDateObj = new Date(nextEarnings);
      const now = new Date();
      daysUntilEarnings = Math.ceil(
        (earningsDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      earningsDate = earningsDateObj.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric' 
      });
    }
    
    if (earningsDate || surpriseCount > 0) {
      earnings = {
        date: earningsDate,
        daysUntil: daysUntilEarnings,
        streak: streak !== 0 ? streak : undefined,
        lastSurprise,
        avgSurprise: surpriseCount > 0 
          ? Math.round((surpriseSum / surpriseCount) * 10) / 10 
          : undefined,
      };
    }
    
    // Sector context
    const sectorAvgPE: Record<string, number> = {
      'Technology': 28, 'Healthcare': 22, 'Financial Services': 15,
      'Consumer Cyclical': 20, 'Communication Services': 18, 'Industrials': 22,
      'Consumer Defensive': 24, 'Energy': 12, 'Basic Materials': 14,
      'Real Estate': 35, 'Utilities': 18,
    };
    
    // Get sector from assetProfile (not available on quote object)
    const sector = insights?.assetProfile?.sector ?? 'Unknown';
    const avgPE = sectorAvgPE[sector];
    let sectorContext: SectorContext | undefined;
    
    if (sector !== 'Unknown') {
      sectorContext = {
        name: sector,
        avgPE,
        vsAvg: avgPE && quote.trailingPE 
          ? Math.round(((quote.trailingPE - avgPE) / avgPE) * 100)
          : undefined,
      };
    }
    
    // Volume analysis
    const todayVol = quote.regularMarketVolume ?? 0;
    const avgVol = quote.averageDailyVolume10Day ?? 1;
    const todayPct = Math.round((todayVol / avgVol) * 100);
    
    const volumeAnalysis: VolumeAnalysis = {
      todayPct,
      trend: 'stable',
      unusualDays: 0,
    };
    
    // Risk metrics (beta from defaultKeyStatistics is more reliable)
    const beta = ks?.beta ?? quote.beta;
    let risk: RiskMetrics | undefined;
    if (beta !== undefined) {
      risk = { beta };
    }

    return {
      ticker: quote.symbol ?? ticker,
      name: quote.shortName ?? quote.longName ?? ticker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      avgVolume: quote.averageDailyVolume10Day ?? 0,
      marketCap: quote.marketCap ?? 0,
      sector,  // From assetProfile, not quote
      trailingPE: quote.trailingPE,
      forwardPE: quote.forwardPE,
      pegRatio: ks?.pegRatio,
      trailingEps: quote.epsTrailingTwelveMonths,
      forwardEps: quote.epsForward,
      freeCashFlow: fd?.freeCashflow,
      sharesOutstanding: ks?.sharesOutstanding,
      earningsGrowth: fd?.earningsGrowth,
      revenueGrowth: fd?.revenueGrowth,
      targetPrice: fd?.targetMeanPrice,
      numberOfAnalysts: fd?.numberOfAnalystOpinions,
      recommendationMean: fd?.recommendationMean,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      ma50: quote.fiftyDayAverage,
      ma200: quote.twoHundredDayAverage,
      beta,
      // Target prices and performance
      targetPrices,
      performance,
      // Enhanced data
      analystRatings,
      ownership,
      // NEW: Additional context
      earnings,
      sectorContext,
      volumeAnalysis,
      risk,
      volatility: (hv20 !== undefined || ivAnalysis) ? {
        iv: ivAnalysis?.currentIV,
        hv20,
        ivRank: ivAnalysis?.ivPercentile,
        ivLevel: ivAnalysis?.ivLevel,
        premium: ivAnalysis && hv20 
          ? ivAnalysis.currentIV > hv20 * 1.15 
            ? 'expensive' 
            : ivAnalysis.currentIV < hv20 * 0.85 
              ? 'cheap' 
              : 'fair'
          : undefined,
      } : undefined,
      // NEW: High-value additions
      shortInterest: ks?.shortPercentOfFloat ? {
        shortPct: Math.round(ks.shortPercentOfFloat * 1000) / 10,
        shortRatio: ks.shortRatio ?? 0,
        sharesShort: ks.sharesShort ?? 0,
      } : undefined,
      relativeStrength,
      optionsFlow,
      // NEW: Spread recommendation
      spread: spread ?? undefined,
    };
  } catch (err) {
    console.error("Error fetching stock data:", err);
    return null;
  }
}

async function fetchTechnicalData(
  ticker: string,
  stockData: StockData | null
): Promise<TechnicalData | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 100); // Only need ~100 days for RSI/MA20/MA50

    const history = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    if (!history.quotes || history.quotes.length < 50) {
      return null;
    }

    const closes = history.quotes
      .map(q => q.close)
      .filter((c): c is number => c !== null && c !== undefined);

    if (closes.length < 50) {
      return null;
    }

    // Calculate indicators
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const rsi = rsiValues[rsiValues.length - 1] ?? 50;

    const ma20Values = SMA.calculate({ values: closes, period: 20 });
    const ma50Values = SMA.calculate({ values: closes, period: 50 });

    const ma20 = ma20Values[ma20Values.length - 1] ?? closes[closes.length - 1];
    const ma50 = ma50Values[ma50Values.length - 1] ?? closes[closes.length - 1];
    
    // Use Yahoo Finance's pre-calculated MA200 (more accurate than calculating 
    // from limited historical data)
    const ma200 = stockData?.ma200 ?? closes[closes.length - 1];

    const currentPrice = closes[closes.length - 1];
    const aboveMA200 = currentPrice > ma200;

    // Simple score calculation
    let score = 50;
    if (rsi < 40) score += 10;
    if (rsi > 70) score -= 10;
    if (aboveMA200) score += 15;
    if (currentPrice > ma50) score += 10;
    if (currentPrice > ma20) score += 5;

    return {
      rsi,
      ma20,
      ma50,
      ma200,
      aboveMA200,
      score: Math.max(0, Math.min(100, score)),
    };
  } catch (err) {
    console.error("Error fetching technical data:", err);
    return null;
  }
}

// ============================================================================
// MARKET REGIME
// ============================================================================

async function getMarketRegime(): Promise<{ regime: MarketRegime; spyPrice: number }> {
  try {
    const spy = await yahooFinance.quote("SPY");
    const spyPrice = spy?.regularMarketPrice ?? 0;
    
    // Simple regime detection based on SPY vs MA
    const ma50 = spy?.fiftyDayAverage ?? spyPrice;
    const ma200 = spy?.twoHundredDayAverage ?? spyPrice;
    
    let regime: MarketRegime = "neutral";
    if (spyPrice > ma50 && spyPrice > ma200) {
      regime = "bull";
    } else if (spyPrice < ma50 && spyPrice < ma200) {
      regime = "bear";
    }
    
    return { regime, spyPrice };
  } catch {
    return { regime: "neutral", spyPrice: 0 };
  }
}

// ============================================================================
// AI ANALYSIS
// ============================================================================

async function generateAIAnalysis(
  config: { mode: OllamaMode; model?: string },
  stock: StockData,
  technical: TechnicalData | null,
  fairValue: FairValueResult,
  strategy: StrategyRecommendation,
  alternatives: StrategyRecommendation[],
  marketRegime: MarketRegime,
  accountSize: number,
  pfv: PsychologicalFairValue | null
): Promise<string> {
  // Import shared TOON functions
  const { 
    buildAnalysisSystemPrompt, 
    buildAnalysisUserPrompt 
  } = await import("../context/toon.ts");

  // Use shared functions for consistent encoding across commands
  const systemPrompt = buildAnalysisSystemPrompt(accountSize);
  const userPrompt = buildAnalysisUserPrompt({
    stock: {
      ticker: stock.ticker,
      name: stock.name,
      price: stock.price,
      changePct: stock.changePct,
      volume: stock.volume,
      avgVolume: stock.avgVolume,
      marketCap: stock.marketCap,
      fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
      trailingPE: stock.trailingPE,
      forwardPE: stock.forwardPE,
      trailingEps: stock.trailingEps,
      forwardEps: stock.forwardEps,
      earningsGrowth: stock.earningsGrowth,
      revenueGrowth: stock.revenueGrowth,
      targetPrice: stock.targetPrice,
      numberOfAnalysts: stock.numberOfAnalysts,
      // Target prices and performance
      targetPrices: stock.targetPrices,
      performance: stock.performance,
      // Analyst and ownership data
      analystRatings: stock.analystRatings,
      ownership: stock.ownership,
      // NEW: Additional context
      beta: stock.beta,
      earnings: stock.earnings,
      sectorContext: stock.sectorContext,
      volumeAnalysis: stock.volumeAnalysis,
      risk: stock.risk,
      volatility: stock.volatility,
      // NEW: High-value additions
      shortInterest: stock.shortInterest,
      relativeStrength: stock.relativeStrength,
      optionsFlow: stock.optionsFlow,
      // Risk/Reward from spread (use stock.spread from yahoo service)
      riskReward: stock.spread ? {
        maxProfit: Math.round(stock.spread.maxProfit * 100),
        maxLoss: Math.round(stock.spread.estimatedDebit * 100),
        breakeven: stock.spread.breakeven,
        profitPct: Math.round((stock.spread.maxProfit / stock.spread.estimatedDebit) * 100),
        rrRatio: `1:${(stock.spread.maxProfit / stock.spread.estimatedDebit).toFixed(1)}`,
        pop: stock.spread.pop,  // Probability of Profit
      } : undefined,
    },
    technical: technical ? {
      rsi: technical.rsi,
      ma20: technical.ma20,
      ma50: technical.ma50,
      ma200: technical.ma200,
      aboveMA200: technical.aboveMA200,
      score: technical.score,
    } : null,
    fairValue,
    strategy,
    alternatives,
    marketRegime,
    pfv,
  });

  try {
    const response = await generateCompletion(config, systemPrompt, userPrompt);
    return response.content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `AI analysis unavailable: ${msg}`;
  }
}

// ============================================================================
// DISPLAY
// ============================================================================

function printDivider(char = "─"): void {
  console.log(chalk.gray(char.repeat(72)));
}

function printSubDivider(): void {
  console.log(chalk.gray("  " + "─".repeat(68)));
}

function displayHeader(stock: StockData, technical: TechnicalData | null): void {
  printDivider("═");
  console.log();
  console.log(`  ${chalk.bold.cyan(stock.ticker)}  ${chalk.gray(stock.name)}`);
  
  const changeColor = stock.change >= 0 ? chalk.green : chalk.red;
  const changeSign = stock.change >= 0 ? "+" : "";
  const scoreDisplay = technical?.score 
    ? (technical.score >= 70 ? chalk.green(`${technical.score}/100 ★★`) : 
       technical.score >= 50 ? chalk.yellow(`${technical.score}/100 ★`) :
       chalk.gray(`${technical.score}/100`))
    : chalk.gray("—");
  
  console.log(
    `  ${chalk.white("$" + stock.price.toFixed(2))}  ` +
    changeColor(`${changeSign}${stock.changePct.toFixed(1)}%`) + "  " +
    `Score: ${scoreDisplay}`
  );
  console.log();
  printDivider("═");
}

function displayFairValue(fairValue: FairValueResult): void {
  console.log();
  console.log(chalk.bold.yellow("  💰 FUNDAMENTAL FAIR VALUE"));
  printSubDivider();
  console.log();
  
  const lines = formatFairValueForDisplay(fairValue);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

function displayPsychologicalFairValue(pfv: PsychologicalFairValue | null): void {
  console.log();
  console.log(chalk.bold.magenta("  🧠 PSYCHOLOGICAL FAIR VALUE"));
  printSubDivider();
  console.log();

  if (!pfv) {
    console.log(chalk.gray("  No options data available for PFV calculation"));
    console.log();
    return;
  }

  // Main PFV value
  const biasColor = pfv.bias === 'BULLISH' ? chalk.green :
                   pfv.bias === 'BEARISH' ? chalk.red : chalk.yellow;
  const confColor = pfv.confidence === 'HIGH' ? chalk.green :
                   pfv.confidence === 'MEDIUM' ? chalk.yellow : chalk.gray;

  console.log(
    `  Fair Value: ${chalk.bold.white('$' + pfv.fairValue.toFixed(2))}  ` +
    `Current: $${pfv.currentPrice.toFixed(2)}  ` +
    biasColor(`${pfv.deviationPercent > 0 ? '+' : ''}${pfv.deviationPercent.toFixed(1)}% ${pfv.bias}`)
  );
  console.log(
    `  Confidence: ${confColor(pfv.confidence)}  ` +
    chalk.gray(`Profile: ${pfv.profile.name}`)
  );
  console.log();

  // Component breakdown (compact)
  console.log(chalk.gray("  Components:"));
  for (const c of pfv.components) {
    const bar = '█'.repeat(Math.round(c.weight * 20));
    console.log(
      chalk.gray(`  ${c.name.padEnd(16)} $${c.value.toFixed(0).padStart(6)} `) +
      chalk.cyan(bar) +
      chalk.gray(` ${(c.weight * 100).toFixed(0)}%`)
    );
  }
  console.log();

  // Key magnetic levels
  console.log(chalk.gray("  Magnetic Levels:"));
  const levels = getKeyMagneticLevels(pfv, 5);
  for (const level of levels) {
    const icon = level.distance.startsWith('-') ? '🟢' : '🔴';
    console.log(
      `  ${icon} $${level.price.toFixed(2).padStart(8)} - ` +
      `${level.type.padEnd(12)} (${level.distance})`
    );
  }
  console.log();

  // Mean reversion signal
  const signal = hasMeanReversionSignal(pfv);
  if (signal.signal) {
    const signalIcon = signal.direction === 'LONG' ? '📈' : '📉';
    const signalColor = signal.direction === 'LONG' ? chalk.green : chalk.red;
    console.log(
      `  ${signalIcon} ${chalk.bold('Mean Reversion Signal:')} ` +
      signalColor(`${signal.direction} (${signal.strength}% strength)`)
    );
    console.log();
  }

  // Support/Resistance zones
  if (pfv.supportZone || pfv.resistanceZone) {
    if (pfv.supportZone) {
      console.log(
        chalk.green(`  Support Zone: $${pfv.supportZone.low.toFixed(2)} - $${pfv.supportZone.high.toFixed(2)}`)
      );
    }
    if (pfv.resistanceZone) {
      console.log(
        chalk.red(`  Resistance Zone: $${pfv.resistanceZone.low.toFixed(2)} - $${pfv.resistanceZone.high.toFixed(2)}`)
      );
    }
    console.log();
  }
}

function displayStrategy(
  primary: StrategyRecommendation,
  alternatives: StrategyRecommendation[]
): void {
  console.log();
  console.log(chalk.bold.green("  🎯 STRATEGY RECOMMENDATION"));
  printSubDivider();
  console.log();
  
  // Primary recommendation
  const emoji = getStrategyEmoji(primary.type);
  console.log(`  ${emoji} ${chalk.bold("RECOMMENDED:")} ${primary.name}`);
  
  const lines = formatStrategyForDisplay(primary);
  for (const line of lines.slice(1)) {  // Skip first line (already shown)
    console.log(line);
  }
  console.log();
  
  // Alternatives
  if (alternatives.length > 0) {
    console.log(chalk.gray("  Alternatives:"));
    for (const alt of alternatives) {
      const altEmoji = getStrategyEmoji(alt.type);
      console.log(
        `  ${altEmoji} ${chalk.gray(alt.name)} ` +
        chalk.gray(`(${alt.confidence}% confidence)`)
      );
    }
    console.log();
  }
}

function displayAIAnalysis(analysis: string, model: string, mode: string): void {
  console.log();
  console.log(chalk.bold.blue("  🤖 AI ANALYSIS"));
  printSubDivider();
  console.log();
  
  // Format the AI analysis with proper styling
  const formatted = formatAIOutput(analysis);
  console.log(formatted);
  
  console.log();
  console.log(chalk.gray(`  ─ Generated by ${model.split(":")[0]} (${mode})`));
  console.log();
}

/**
 * Format AI output with proper terminal styling
 * Converts markdown-like syntax to chalk-formatted output
 */
function formatAIOutput(text: string): string {
  const maxWidth = 66;
  const lines: string[] = [];
  
  // Split into logical sections (by double newlines or numbered sections)
  const sections = text
    .replace(/\*\*(\d+)\.\s*/g, '\n\n**$1. ')  // Force newline before numbered sections
    .replace(/###\s*/g, '\n\n')                 // Handle ### headers
    .split(/\n\n+/);
  
  for (const section of sections) {
    if (!section.trim()) continue;
    
    // Check if this is a numbered section header (e.g., "**1. ENTRY DECISION:**")
    const sectionMatch = section.match(/^\*\*(\d+)\.\s*([^*]+)\*\*:?\s*(.*)/s);
    if (sectionMatch) {
      const [, num, title, content] = sectionMatch;
      
      // Section header with number
      const icon = getSectionIcon(title.toUpperCase());
      lines.push('');
      lines.push(`  ${icon} ${chalk.bold.cyan(num + '. ' + title.trim().toUpperCase())}`);
      lines.push('');
      
      if (content.trim()) {
        // Process the content after the header
        const contentLines = formatSectionContent(content.trim(), maxWidth);
        lines.push(...contentLines);
      }
      continue;
    }
    
    // Check if this is a standalone header (e.g., "**ANALYSIS - NVDA**")
    const headerMatch = section.match(/^\*\*([^*]+)\*\*\s*(.*)/s);
    if (headerMatch && !headerMatch[2].trim()) {
      lines.push(`  ${chalk.bold.white(headerMatch[1].trim())}`);
      lines.push('');
      continue;
    }
    
    // Regular content - format it
    const contentLines = formatSectionContent(section, maxWidth);
    lines.push(...contentLines);
  }
  
  return lines.join('\n');
}

/**
 * Get icon for section type
 */
function getSectionIcon(title: string): string {
  if (title.includes('ENTRY') || title.includes('DECISION')) return '🎯';
  if (title.includes('RISK')) return '⚠️';
  if (title.includes('POSITION') || title.includes('SIZING')) return '💰';
  if (title.includes('BOTTOM') || title.includes('CONCLUSION')) return '📋';
  return '•';
}

/**
 * Format section content with bullets and word wrap
 */
function formatSectionContent(content: string, maxWidth: number): string[] {
  const lines: string[] = [];
  
  // Split by bullet points or sentences
  const parts = content
    .replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold.white(text))  // Bold text
    .replace(/\n-\s*/g, '\n• ')                                        // Convert - to •
    .split(/(?=•\s)/);                                                 // Split on bullets
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const isBullet = trimmed.startsWith('•');
    const indent = isBullet ? '     ' : '  ';
    const firstIndent = isBullet ? '  ' : '  ';
    
    // Word wrap this part
    const wrapped = wordWrap(trimmed, maxWidth - indent.length);
    
    for (let i = 0; i < wrapped.length; i++) {
      const prefix = i === 0 ? firstIndent : indent;
      const line = wrapped[i];
      
      // Color bullets green
      if (i === 0 && isBullet) {
        lines.push(prefix + chalk.green('•') + ' ' + line.slice(2));
      } else {
        lines.push(prefix + line);
      }
    }
  }
  
  return lines;
}

/**
 * Word wrap text to max width
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    // Strip ANSI codes for length calculation
    const cleanWord = word.replace(/\x1b\[[0-9;]*m/g, '');
    const cleanLine = currentLine.replace(/\x1b\[[0-9;]*m/g, '');
    
    if (cleanLine.length + cleanWord.length + 1 > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

function displayEntryDecision(
  stock: StockData,
  technical: TechnicalData | null,
  strategy: StrategyRecommendation,
  fairValue: FairValueResult,
  marketRegime: MarketRegime,
  pfv: PsychologicalFairValue | null
): void {
  console.log();
  console.log(chalk.bold.white("  🎯 ENTRY DECISION"));
  printSubDivider();
  console.log();
  
  // Determine action
  let action: "ENTER" | "WAIT" | "PASS" | "ENTER_WITH_CAUTION";
  const reasons: string[] = [];
  
  // Base conditions
  const aboveMA200 = technical?.aboveMA200 ?? false;
  const rsiOK = (technical?.rsi ?? 50) < 65;
  const scoreOK = (technical?.score ?? 50) >= 55;
  const valueOK = fairValue.verdict !== "overvalued";
  const strategyOK = strategy.confidence >= 50;
  
  // PFV conditions
  const pfvSignal = pfv ? hasMeanReversionSignal(pfv) : null;
  const pfvBullish = pfv?.bias === 'BULLISH';
  const pfvHighConfidence = pfv?.confidence === 'HIGH';
  
  if (!aboveMA200) {
    action = "WAIT";
    reasons.push("Below MA200 - wait for trend confirmation");
  } else if (!rsiOK) {
    action = "WAIT";
    reasons.push(`RSI elevated (${technical?.rsi?.toFixed(0)}) - wait for pullback`);
  } else if (!valueOK) {
    action = "PASS";
    reasons.push("Stock appears overvalued");
  } else if (!strategyOK) {
    action = "PASS";
    reasons.push("No favorable strategy available");
  } else if (scoreOK && strategyOK && aboveMA200) {
    // Enhanced decision with PFV
    if (pfvSignal?.signal && pfvSignal.direction === 'LONG' && pfvHighConfidence) {
      action = "ENTER";
      reasons.push(`PFV bullish signal: ${pfvSignal.strength}% strength`);
      reasons.push("Technical and psychological conditions aligned");
    } else if (pfvSignal?.signal && pfvSignal.direction === 'SHORT') {
      action = "WAIT";
      reasons.push("PFV suggests price may pull back toward fair value");
    } else if (pfvBullish && pfvHighConfidence) {
      action = "ENTER";
      reasons.push("PFV and technicals both bullish");
    } else {
      action = "ENTER";
      reasons.push("Technical and fundamental conditions favorable");
    }
  } else {
    action = "WAIT";
    reasons.push("Mixed signals - wait for clarity");
  }
  
  // Add PFV context to reasons
  if (pfv) {
    if (pfv.primaryExpiration?.isMonthlyOpex && pfv.primaryExpiration.dte <= 7) {
      reasons.push(`⚠️ Monthly OPEX in ${pfv.primaryExpiration.dte} days - max pain magnetism active`);
    }
  }
  
  // Display action
  const actionColor = action === "ENTER" ? chalk.green :
                      action === "ENTER_WITH_CAUTION" ? chalk.yellow :
                      action === "WAIT" ? chalk.yellow :
                      chalk.red;
  const actionEmoji = action === "ENTER" ? "✅" :
                      action === "ENTER_WITH_CAUTION" ? "⚠️" :
                      action === "WAIT" ? "⏳" :
                      "❌";
  
  console.log(`  ${actionEmoji} ${chalk.bold("ACTION:")} ${actionColor(action.replace("_", " "))}`);
  console.log();
  
  // Reasons
  for (const reason of reasons) {
    console.log(chalk.gray(`  • ${reason}`));
  }
  console.log();
  
  // Confidence and sizing
  console.log(chalk.gray(`  Confidence: ${strategy.confidence}/100`));
  console.log(chalk.gray(`  Position Size: ${strategy.positionSize.toFixed(0)}% of account ($${strategy.riskAmount.toFixed(0)} risk)`));
  console.log();
}

// ============================================================================
// MAIN ANALYZE FUNCTION
// ============================================================================

export async function analyzeCommand(
  ticker: string,
  options: AnalyzeOptions
): Promise<void> {
  const symbol = ticker.toUpperCase();
  const accountSize = options.accountSize ?? DEFAULT_ACCOUNT_SIZE;
  
  console.log();
  console.log(chalk.gray(`  Analyzing ${chalk.bold(symbol)}...`));
  console.log(chalk.gray(`  AI mode: ${options.aiMode}${options.aiModel ? ` (${options.aiModel})` : ""}`));
  console.log();

  // Validate AI
  const aiValidation = await validateAIRequirement(options.aiMode);
  if (!aiValidation.available) {
    console.log(chalk.red(`  ✗ ${aiValidation.error}`));
    if (aiValidation.suggestion) {
      console.log(chalk.yellow(`\n  ${aiValidation.suggestion}`));
    }
    process.exit(1);
  }

  // First fetch stockData and parallel data
  const [stockData, marketData, pfvData] = await Promise.all([
    fetchStockData(symbol),
    getMarketRegime(),
    getPsychologicalFairValue(symbol).catch(() => null),
  ]);
  
  // Then fetch technicalData using stockData.ma200 for accurate MA200
  const technicalData = await fetchTechnicalData(symbol, stockData);

  if (!stockData) {
    console.log(chalk.red(`  ✗ Failed to fetch data for ${symbol}`));
    process.exit(1);
  }

  // Calculate fair value
  const valuationInputs: ValuationInputs = {
    ticker: symbol,
    currentPrice: stockData.price,
    sector: stockData.sector,
    trailingEps: stockData.trailingEps,
    forwardEps: stockData.forwardEps,
    trailingPE: stockData.trailingPE,
    forwardPE: stockData.forwardPE,
    pegRatio: stockData.pegRatio,
    freeCashFlow: stockData.freeCashFlow,
    sharesOutstanding: stockData.sharesOutstanding,
    earningsGrowth: stockData.earningsGrowth,
    revenueGrowth: stockData.revenueGrowth,
    targetPrice: stockData.targetPrice,
  };
  const fairValue = calculateFairValue(valuationInputs);

  // Select strategy
  const { primary: strategy, alternatives } = selectStrategy({
    ticker: symbol,
    currentPrice: stockData.price,
    accountSize,
    marketRegime: marketData.regime,
    score: technicalData?.score,
    rsiValue: technicalData?.rsi,
    aboveMA200: technicalData?.aboveMA200,
    fairValue,
    hasOptions: true,
  });

  // Generate AI analysis
  console.log(chalk.gray("  Generating AI insights..."));
  const aiAnalysis = await generateAIAnalysis(
    { mode: options.aiMode, model: options.aiModel },
    stockData,
    technicalData,
    fairValue,
    strategy,
    alternatives,
    marketData.regime,
    accountSize,
    pfvData
  );

  // Display results
  displayHeader(stockData, technicalData);

  displayFairValue(fairValue);
  displayPsychologicalFairValue(pfvData);
  displayStrategy(strategy, alternatives);
  displayAIAnalysis(
    aiAnalysis, 
    options.aiModel ?? "",
    options.aiMode
  );
  displayEntryDecision(
    stockData,
    technicalData,
    strategy,
    fairValue,
    marketData.regime,
    pfvData
  );

  printDivider("═");
  console.log();
}

