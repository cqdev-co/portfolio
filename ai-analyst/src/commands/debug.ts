/**
 * Debug Command
 * Shows ALL context that would be sent to AI without making the call
 * Displays raw data from Yahoo Finance, technical indicators, PFV, etc.
 *
 * Features:
 * - Full raw data inspection
 * - TOON format preview
 * - Token cost estimation
 * - Optional log file output
 */

import chalk from 'chalk';
import * as fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { RSI, SMA } from 'technicalindicators';
import {
  calculateFairValue,
  type ValuationInputs,
} from '../engine/fair-value.ts';
import { selectStrategy } from '../engine/strategy.ts';
import {
  getPsychologicalFairValue,
  type PsychologicalFairValue,
} from '../services/psychological-fair-value.ts';
import {
  getIVAnalysis,
  findSpreadWithAlternatives,
  type IVAnalysis,
  type SpreadRecommendation,
  type SpreadSelectionContext,
} from '../services/yahoo.ts';
import type {
  MarketRegime,
  FairValueResult,
  StrategyRecommendation,
} from '../types/index.ts';

// Instantiate yahoo-finance2 (required in v3+)
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

// ============================================================================
// TYPES
// ============================================================================

export interface DebugOptions {
  accountSize?: number;
  compact?: boolean;
  log?: boolean;
}

// ============================================================================
// LOGGING SYSTEM
// ============================================================================

/**
 * Logger that writes to both console and optionally a file
 * Strips ANSI color codes for file output
 */
class DebugLogger {
  private logLines: string[] = [];
  private logEnabled: boolean;

  constructor(logEnabled: boolean) {
    this.logEnabled = logEnabled;
  }

  // Strip ANSI escape codes for clean file output
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  log(message: string = ''): void {
    console.log(message);
    if (this.logEnabled) {
      this.logLines.push(this.stripAnsi(message));
    }
  }

  logSection(title: string, emoji: string): void {
    const line = chalk.bold.cyan(`  ${emoji} ${title}`);
    const divider = chalk.gray('  ' + '─'.repeat(68));
    console.log();
    console.log(line);
    console.log(divider);
    if (this.logEnabled) {
      this.logLines.push('');
      this.logLines.push(`  ${emoji} ${title}`);
      this.logLines.push('  ' + '─'.repeat(68));
    }
  }

  logJson(obj: unknown, indent = 2): void {
    const json = JSON.stringify(obj, null, 2);
    const padding = ' '.repeat(indent);
    for (const line of json.split('\n')) {
      console.log(chalk.gray(padding + line));
      if (this.logEnabled) {
        this.logLines.push(padding + line);
      }
    }
  }

  logRaw(content: string, indent = 2): void {
    const padding = ' '.repeat(indent);
    for (const line of content.split('\n')) {
      console.log(chalk.white(padding + line));
      if (this.logEnabled) {
        this.logLines.push(padding + line);
      }
    }
  }

  logDivider(char = '─'): void {
    const line = char.repeat(76);
    console.log(line);
    if (this.logEnabled) {
      this.logLines.push(line);
    }
  }

  saveToFile(ticker: string): string | null {
    if (!this.logEnabled || this.logLines.length === 0) {
      return null;
    }

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      // @ts-expect-error - Bun types don't recognize recursive option
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const filename = `debug-${ticker}-${timestamp}.log`;
    const filepath = path.join(logsDir, filename);

    // Write log file
    fs.writeFileSync(filepath, this.logLines.join('\n'), 'utf-8');

    return filepath;
  }
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
  date?: string; // "Feb 26"
  daysUntil?: number; // 62
  time?: string; // "AMC" | "BMO" | "TAS"
  streak?: number; // Consecutive beats (negative = misses)
  lastSurprise?: number; // Last quarter surprise %
  avgSurprise?: number; // Avg surprise over 4 quarters
}

interface SectorContext {
  name: string;
  avgPE?: number;
  vsAvg?: number; // % above/below sector avg P/E
}

interface VolatilityMetrics {
  iv?: number; // Implied volatility %
  hv20?: number; // 20-day historical volatility
  ivRank?: number; // IV percentile in 52-week range
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  premium?: 'cheap' | 'fair' | 'expensive';
}

interface VolumeAnalysis {
  todayPct: number; // Today's volume as % of avg
  trend: 'increasing' | 'stable' | 'declining';
  unusualDays: number; // Days with >2x volume in last 10
}

interface RiskMetrics {
  beta?: number;
  maxDrawdown30d?: number;
}

interface ShortInterest {
  shortPct: number; // % of float shorted
  shortRatio: number; // Days to cover
  sharesShort: number; // Total shares short
  priorMonthShort?: number; // Prior month for comparison
}

interface RelativeStrength {
  vsSPY: number; // 30-day return vs SPY
  vsSector?: number; // vs sector ETF (XLK, XLF, etc.)
  percentile?: number; // Rank in sector
}

interface OptionsFlow {
  pcRatioOI: number; // Put/Call ratio (open interest)
  pcRatioVol: number; // Put/Call ratio (volume)
  totalCallOI: number;
  totalPutOI: number;
}

interface RiskReward {
  maxProfit: number; // Max profit in dollars
  maxLoss: number; // Max loss (debit paid)
  breakeven: number; // Breakeven price
  profitPct: number; // Max profit as % of risk
  rrRatio: string; // e.g., "1:2.5"
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
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  trailingEps?: number;
  forwardEps?: number;
  freeCashFlow?: number;
  sharesOutstanding?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  targetPrice?: number;
  numberOfAnalysts?: number;
  recommendationMean?: number;
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
  // NEW: Earnings info with history
  earnings?: EarningsInfo;
  // NEW: Sector context
  sectorContext?: SectorContext;
  // NEW: Volatility metrics
  volatility?: VolatilityMetrics;
  // NEW: Volume analysis
  volumeAnalysis?: VolumeAnalysis;
  // NEW: Risk metrics
  risk?: RiskMetrics;
  // NEW: Short interest
  shortInterest?: ShortInterest;
  // NEW: Relative strength
  relativeStrength?: RelativeStrength;
  // NEW: Options flow
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

    let insights: Awaited<ReturnType<typeof yahooFinance.quoteSummary>> | null =
      null;
    try {
      insights = await yahooFinance.quoteSummary(ticker, {
        modules: [
          'financialData',
          'defaultKeyStatistics',
          'earningsHistory',
          'calendarEvents',
          'recommendationTrend',
          'upgradeDowngradeHistory',
          'majorHoldersBreakdown',
          'insiderTransactions',
          'assetProfile', // For sector/industry data
        ],
      });
    } catch {
      // Insights optional
    }

    // Use type assertion for yahoo-finance2 module properties
    const insightsAny = insights as Record<string, unknown> | null;
    const fd = insightsAny?.financialData as
      | {
          targetLowPrice?: number;
          targetMeanPrice?: number;
          targetHighPrice?: number;
          freeCashflow?: number;
          earningsGrowth?: number;
          revenueGrowth?: number;
          numberOfAnalystOpinions?: number;
          recommendationMean?: number;
        }
      | undefined;
    const ks = insightsAny?.defaultKeyStatistics as
      | {
          sharesOutstanding?: number;
          shortPercentOfFloat?: number;
          shortRatio?: number;
          sharesShort?: number;
          pegRatio?: number;
          beta?: number;
        }
      | undefined;

    // Process target prices
    let targetPrices: TargetPrices | undefined;
    if (fd?.targetLowPrice && fd?.targetMeanPrice && fd?.targetHighPrice) {
      const upside =
        ((fd.targetMeanPrice - quote.regularMarketPrice) /
          quote.regularMarketPrice) *
        100;
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
        interval: '1d',
      });

      if (history?.quotes && history.quotes.length > 5) {
        const closes = history.quotes
          .map((q) => ({ date: q.date, close: q.close }))
          .filter(
            (q): q is { date: Date; close: number } =>
              q.close !== null && q.close !== undefined && q.date !== null
          );

        const currentPrice = quote.regularMarketPrice;

        // Find prices at different time periods
        const findPriceAtDaysAgo = (days: number): number | null => {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() - days);
          // Find the closest date
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

        // YTD: Find first trading day of year
        const ytdPrice = closes.find(
          (c) => c.date.getFullYear() === now.getFullYear()
        )?.close;

        if (price5d && price1m && price3m && ytdPrice) {
          performance = {
            day5: Math.round(((currentPrice - price5d) / price5d) * 1000) / 10,
            month1:
              Math.round(((currentPrice - price1m) / price1m) * 1000) / 10,
            month3:
              Math.round(((currentPrice - price3m) / price3m) * 1000) / 10,
            ytd: Math.round(((currentPrice - ytdPrice) / ytdPrice) * 1000) / 10,
          };
        }

        // Calculate 20-day Historical Volatility (HV20)
        const recentCloses = closes.slice(-21).map((c) => c.close);
        if (recentCloses.length >= 21) {
          // Calculate daily log returns
          const returns: number[] = [];
          for (let i = 1; i < recentCloses.length; i++) {
            returns.push(Math.log(recentCloses[i] / recentCloses[i - 1]));
          }

          // Standard deviation of returns
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance =
            returns.reduce((a, b) => a + (b - mean) ** 2, 0) /
            (returns.length - 1); // Use n-1 for sample std dev
          const stdDev = Math.sqrt(variance);

          // Annualize (252 trading days) and convert to percentage
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
          pcRatioVol:
            totalCallVol > 0
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
      const spreadResult = await findSpreadWithAlternatives(
        ticker,
        30,
        undefined,
        spreadContext
      );
      spread = spreadResult.primary;
    } catch {
      // Spread optional
    }

    // Process analyst ratings breakdown
    let analystRatings: AnalystRatings | undefined;
    const recTrendModule = insightsAny?.recommendationTrend as
      | {
          trend?: Array<{
            strongBuy?: number;
            buy?: number;
            hold?: number;
            sell?: number;
            strongSell?: number;
          }>;
        }
      | undefined;
    const recTrend = recTrendModule?.trend?.[0]; // Current month
    if (recTrend) {
      const total =
        (recTrend.strongBuy ?? 0) +
        (recTrend.buy ?? 0) +
        (recTrend.hold ?? 0) +
        (recTrend.sell ?? 0) +
        (recTrend.strongSell ?? 0);
      const bullish = (recTrend.strongBuy ?? 0) + (recTrend.buy ?? 0);

      // Process recent upgrades/downgrades
      const recentChanges: RatingChange[] = [];
      const upgradeDowngradeModule = insightsAny?.upgradeDowngradeHistory as
        | {
            history?: Array<{
              epochGradeDate?: number;
              firm?: string;
              action?: string;
              toGrade?: string;
              fromGrade?: string;
              currentPriceTarget?: number;
              priorPriceTarget?: number;
            }>;
          }
        | undefined;
      const history = upgradeDowngradeModule?.history ?? [];
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
    const holders = insightsAny?.majorHoldersBreakdown as
      | {
          insidersPercentHeld?: number;
          institutionsPercentHeld?: number;
          institutionsCount?: number;
        }
      | undefined;
    if (holders) {
      // Process insider transactions for recent sales
      const insiderTxModule = insightsAny?.insiderTransactions as
        | {
            transactions?: Array<{
              transactionText?: string;
              value?: number;
              startDate?: number;
            }>;
          }
        | undefined;
      const insiderTx = insiderTxModule?.transactions ?? [];
      const recentSales = insiderTx
        .filter((tx: { transactionText?: string }) =>
          tx.transactionText?.toLowerCase().includes('sale')
        )
        .slice(0, 10);

      const totalSalesValue = recentSales.reduce(
        (sum: number, tx: { value?: number }) => sum + (tx.value ?? 0),
        0
      );

      ownership = {
        insidersPercent:
          Math.round((holders.insidersPercentHeld ?? 0) * 1000) / 10,
        institutionsPercent:
          Math.round((holders.institutionsPercentHeld ?? 0) * 1000) / 10,
        institutionsCount: holders.institutionsCount ?? 0,
        recentInsiderSales:
          recentSales.length > 0
            ? {
                totalValue: totalSalesValue,
                transactions: recentSales.length,
                lastDate: recentSales[0]?.startDate
                  ? new Date(recentSales[0].startDate)
                      .toISOString()
                      .split('T')[0]
                  : undefined,
              }
            : undefined,
      };
    }

    // Process earnings info with beat/miss history
    let earnings: EarningsInfo | undefined;
    const earningsHistoryModule = insightsAny?.earningsHistory as
      | {
          history?: Array<{
            epsActual?: number;
            epsEstimate?: number;
            surprisePercent?: number;
          }>;
        }
      | undefined;
    const earningsHist = earningsHistoryModule?.history ?? [];
    const calEvents = insightsAny?.calendarEvents as
      | {
          earnings?: { earningsDate?: Array<{ raw: number }> };
        }
      | undefined;

    // Calculate earnings streak and average surprise
    let streak = 0;
    let surpriseSum = 0;
    let surpriseCount = 0;
    let lastSurprise: number | undefined;

    for (let i = 0; i < earningsHist.length && i < 4; i++) {
      const h = earningsHist[i];
      if (
        h.epsActual !== undefined &&
        h.epsEstimate !== undefined &&
        h.epsEstimate !== 0
      ) {
        const surprise =
          ((h.epsActual - h.epsEstimate) / Math.abs(h.epsEstimate)) * 100;
        if (i === 0) lastSurprise = Math.round(surprise * 10) / 10;
        surpriseSum += surprise;
        surpriseCount++;

        // Count streak
        if (
          i === 0 ||
          (streak > 0 && surprise > 0) ||
          (streak < 0 && surprise < 0)
        ) {
          streak += surprise > 0 ? 1 : -1;
        }
      }
    }

    // Get next earnings date
    const nextEarningsRaw = calEvents?.earnings?.earningsDate?.[0];
    let earningsDate: string | undefined;
    let daysUntilEarnings: number | undefined;

    if (nextEarningsRaw?.raw) {
      const earningsDateObj = new Date(nextEarningsRaw.raw * 1000);
      const now = new Date();
      daysUntilEarnings = Math.ceil(
        (earningsDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      earningsDate = earningsDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }

    if (earningsDate || surpriseCount > 0) {
      earnings = {
        date: earningsDate,
        daysUntil: daysUntilEarnings,
        streak: streak !== 0 ? streak : undefined,
        lastSurprise,
        avgSurprise:
          surpriseCount > 0
            ? Math.round((surpriseSum / surpriseCount) * 10) / 10
            : undefined,
      };
    }

    // Sector context with P/E comparison
    const sectorAvgPE: Record<string, number> = {
      Technology: 28,
      Healthcare: 22,
      'Financial Services': 15,
      'Consumer Cyclical': 20,
      'Communication Services': 18,
      Industrials: 22,
      'Consumer Defensive': 24,
      Energy: 12,
      'Basic Materials': 14,
      'Real Estate': 35,
      Utilities: 18,
    };

    // Get sector from assetProfile (not available on quote object)
    const assetProfile = insightsAny?.assetProfile as
      | { sector?: string }
      | undefined;
    const sector = assetProfile?.sector ?? 'Unknown';
    const avgPE = sectorAvgPE[sector];
    let sectorContext: SectorContext | undefined;

    if (sector !== 'Unknown') {
      sectorContext = {
        name: sector,
        avgPE,
        vsAvg:
          avgPE && quote.trailingPE
            ? Math.round(((quote.trailingPE - avgPE) / avgPE) * 100)
            : undefined,
      };
    }

    // Volume analysis
    const todayVol = quote.regularMarketVolume ?? 0;
    const avgVol = quote.averageDailyVolume10Day ?? 1;
    const todayPct = Math.round((todayVol / avgVol) * 100);

    // Check volume trend from performance history data
    // We'll use simple heuristic: compare 5d avg to 10d avg
    let volumeTrend: 'increasing' | 'stable' | 'declining' = 'stable';
    let unusualDays = 0;

    try {
      const volHistory = await yahooFinance.chart(ticker, {
        period1: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: '1d',
      });

      if (volHistory?.quotes && volHistory.quotes.length >= 10) {
        const vols = volHistory.quotes
          .map((q) => q.volume)
          .filter((v): v is number => v !== null && v !== undefined);

        if (vols.length >= 10) {
          const last5Avg = vols.slice(-5).reduce((a, b) => a + b, 0) / 5;
          const prev5Avg = vols.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

          if (last5Avg > prev5Avg * 1.2) volumeTrend = 'increasing';
          else if (last5Avg < prev5Avg * 0.8) volumeTrend = 'declining';

          // Count unusual volume days (>2x average)
          const overallAvg = vols.reduce((a, b) => a + b, 0) / vols.length;
          unusualDays = vols
            .slice(-10)
            .filter((v) => v > overallAvg * 2).length;
        }
      }
    } catch {
      // Volume analysis optional
    }

    const volumeAnalysis: VolumeAnalysis = {
      todayPct,
      trend: volumeTrend,
      unusualDays,
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
      sector, // From assetProfile, not quote
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
      // NEW: Volatility metrics with IV vs HV
      volatility:
        hv20 !== undefined || ivAnalysis
          ? {
              iv: ivAnalysis?.currentIV,
              hv20,
              ivRank: ivAnalysis?.ivPercentile,
              ivLevel: ivAnalysis?.ivLevel,
              premium:
                ivAnalysis && hv20
                  ? ivAnalysis.currentIV > hv20 * 1.15
                    ? 'expensive'
                    : ivAnalysis.currentIV < hv20 * 0.85
                      ? 'cheap'
                      : 'fair'
                  : undefined,
            }
          : undefined,
      // NEW: Short interest
      shortInterest: ks?.shortPercentOfFloat
        ? {
            shortPct: Math.round(ks.shortPercentOfFloat * 1000) / 10,
            shortRatio: ks.shortRatio ?? 0,
            sharesShort: ks.sharesShort ?? 0,
          }
        : undefined,
      // NEW: Relative strength (vs SPY)
      relativeStrength,
      // NEW: Options flow (put/call ratio)
      optionsFlow,
      // NEW: Spread recommendation
      spread: spread ?? undefined,
    };
  } catch (err) {
    console.error('Error fetching stock data:', err);
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
      interval: '1d',
    });

    if (!history.quotes || history.quotes.length < 50) {
      return null;
    }

    const closes = history.quotes
      .map((q) => q.close)
      .filter((c): c is number => c !== null && c !== undefined);

    if (closes.length < 50) {
      return null;
    }

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
    console.error('Error fetching technical data:', err);
    return null;
  }
}

async function getMarketRegime(): Promise<{
  regime: MarketRegime;
  spyPrice: number;
  spyMa50: number;
  spyMa200: number;
}> {
  try {
    const spy = await yahooFinance.quote('SPY');
    const spyPrice = spy?.regularMarketPrice ?? 0;

    const ma50 = spy?.fiftyDayAverage ?? spyPrice;
    const ma200 = spy?.twoHundredDayAverage ?? spyPrice;

    let regime: MarketRegime = 'neutral';
    if (spyPrice > ma50 && spyPrice > ma200) {
      regime = 'bull';
    } else if (spyPrice < ma50 && spyPrice < ma200) {
      regime = 'bear';
    }

    return { regime, spyPrice, spyMa50: ma50, spyMa200: ma200 };
  } catch {
    return { regime: 'neutral', spyPrice: 0, spyMa50: 0, spyMa200: 0 };
  }
}

// ============================================================================
// SHARED TOON IMPORTS (from context/toon.ts)
// ============================================================================

import {
  buildAnalysisSystemPrompt,
  buildAnalysisData,
  encodeAnalysisToTOON,
  type AnalysisDataInput,
} from '../context/toon.ts';

// ============================================================================
// MAIN DEBUG FUNCTION
// ============================================================================

export async function debugCommand(
  ticker: string,
  options: DebugOptions
): Promise<void> {
  const symbol = ticker.toUpperCase();
  const accountSize = options.accountSize ?? 1500;
  const compact = options.compact ?? false;
  const logEnabled = options.log ?? false;

  // Initialize logger
  const log = new DebugLogger(logEnabled);

  log.log();
  log.logDivider('═');
  log.log(chalk.bold.yellow('  🔍 DEBUG MODE - FULL AI CONTEXT INSPECTOR'));
  log.logDivider('═');
  log.log();
  log.log(chalk.gray(`  Ticker: ${chalk.bold(symbol)}`));
  log.log(chalk.gray(`  Account Size: $${accountSize.toLocaleString()}`));
  log.log(chalk.gray(`  Timestamp: ${new Date().toISOString()}`));
  if (logEnabled) {
    log.log(chalk.cyan('  📝 Log file will be saved'));
  }
  log.log(chalk.yellow('  ⚠️  No AI calls will be made'));
  log.log();

  // ============================================================================
  // STEP 1: FETCH ALL DATA
  // ============================================================================

  log.logSection('FETCHING DATA', '📡');
  log.log();

  const startTime = Date.now();

  // First fetch stockData and parallel data
  const [stockData, marketData, pfvData] = await Promise.all([
    fetchStockData(symbol),
    getMarketRegime(),
    getPsychologicalFairValue(symbol).catch(() => null),
  ]);

  // Then fetch technicalData using stockData.ma200 for accurate MA200
  const technicalData = await fetchTechnicalData(symbol, stockData);

  const fetchDuration = Date.now() - startTime;
  log.log(chalk.green(`  ✓ Data fetched in ${fetchDuration}ms`));

  if (!stockData) {
    log.log(chalk.red(`  ✗ Failed to fetch data for ${symbol}`));
    throw new Error(`Failed to fetch data for ${symbol}`);
  }

  // ============================================================================
  // STEP 2: RAW YAHOO FINANCE DATA
  // ============================================================================

  log.logSection('RAW YAHOO FINANCE DATA (stockData)', '📈');
  log.log();
  log.logJson(stockData);

  // ============================================================================
  // STEP 3: RAW TECHNICAL INDICATORS
  // ============================================================================

  log.logSection('RAW TECHNICAL INDICATORS (technicalData)', '📉');
  log.log();
  if (technicalData) {
    log.logJson(technicalData);
  } else {
    log.log(chalk.gray('  null (failed to calculate)'));
  }

  // ============================================================================
  // STEP 4: MARKET REGIME DATA
  // ============================================================================

  log.logSection('MARKET REGIME DATA (SPY analysis)', '🌐');
  log.log();
  log.logJson(marketData);

  // ============================================================================
  // STEP 5: PSYCHOLOGICAL FAIR VALUE (PFV)
  // ============================================================================

  log.logSection('PSYCHOLOGICAL FAIR VALUE DATA (pfvData)', '🧠');
  log.log();
  if (pfvData) {
    if (compact) {
      // Compact view - just summary
      log.logJson({
        fairValue: pfvData.fairValue,
        currentPrice: pfvData.currentPrice,
        deviationPercent: pfvData.deviationPercent,
        bias: pfvData.bias,
        confidence: pfvData.confidence,
        profile: pfvData.profile.name,
        magneticLevelsCount: pfvData.magneticLevels.length,
        componentsCount: pfvData.components.length,
      });
    } else {
      // Full view - everything
      log.logJson(pfvData);
    }
  } else {
    log.log(chalk.gray('  null (no options data available)'));
  }

  // ============================================================================
  // STEP 6: DERIVED/COMPUTED DATA
  // ============================================================================

  log.logSection('DERIVED DATA (computed from raw data)', '🔧');
  log.log();

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

  log.log(chalk.gray('  valuationInputs:'));
  log.logJson(valuationInputs, 4);
  log.log();
  log.log(chalk.gray('  fairValue (result):'));
  log.logJson(fairValue, 4);
  log.log();
  log.log(chalk.gray('  strategy (primary):'));
  log.logJson(strategy, 4);
  log.log();
  log.log(chalk.gray('  alternatives:'));
  log.logJson(alternatives, 4);

  // ============================================================================
  // STEP 7: FINAL PROMPTS SENT TO AI
  // ============================================================================

  log.logSection('SYSTEM PROMPT (sent to AI)', '🤖');
  log.log();
  const systemPrompt = buildAnalysisSystemPrompt(accountSize);
  log.logRaw(systemPrompt);

  // Build analysis input for shared TOON encoder
  const analysisInput: AnalysisDataInput = {
    stock: {
      ticker: stockData.ticker,
      name: stockData.name,
      price: stockData.price,
      changePct: stockData.changePct,
      volume: stockData.volume,
      avgVolume: stockData.avgVolume,
      marketCap: stockData.marketCap,
      fiftyTwoWeekLow: stockData.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: stockData.fiftyTwoWeekHigh,
      trailingPE: stockData.trailingPE,
      forwardPE: stockData.forwardPE,
      trailingEps: stockData.trailingEps,
      forwardEps: stockData.forwardEps,
      earningsGrowth: stockData.earningsGrowth,
      revenueGrowth: stockData.revenueGrowth,
      targetPrice: stockData.targetPrice,
      numberOfAnalysts: stockData.numberOfAnalysts,
      beta: stockData.beta,
      // Target prices and performance
      targetPrices: stockData.targetPrices,
      performance: stockData.performance,
      // Analyst and ownership data
      analystRatings: stockData.analystRatings,
      ownership: stockData.ownership,
      // NEW: Additional context
      earnings: stockData.earnings,
      sectorContext: stockData.sectorContext,
      volumeAnalysis: stockData.volumeAnalysis,
      risk: stockData.risk,
      volatility: stockData.volatility,
      // NEW: High-value additions
      shortInterest: stockData.shortInterest,
      relativeStrength: stockData.relativeStrength,
      optionsFlow: stockData.optionsFlow,
      // Risk/Reward from spread (use stockData.spread from yahoo service)
      riskReward: stockData.spread
        ? {
            maxProfit: Math.round(stockData.spread.maxProfit * 100),
            maxLoss: Math.round(stockData.spread.estimatedDebit * 100),
            breakeven: stockData.spread.breakeven,
            profitPct: Math.round(
              (stockData.spread.maxProfit / stockData.spread.estimatedDebit) *
                100
            ),
            rrRatio: `1:${(stockData.spread.maxProfit / stockData.spread.estimatedDebit).toFixed(1)}`,
            pop: stockData.spread.pop, // Probability of Profit
          }
        : undefined,
    },
    technical: technicalData
      ? {
          rsi: technicalData.rsi,
          ma20: technicalData.ma20,
          ma50: technicalData.ma50,
          ma200: technicalData.ma200,
          aboveMA200: technicalData.aboveMA200,
          score: technicalData.score,
        }
      : null,
    fairValue,
    strategy,
    alternatives,
    marketRegime: marketData.regime,
    pfv: pfvData,
  };

  // Use shared TOON encoding (same as analyze command)
  const toonData = encodeAnalysisToTOON(analysisInput);
  const analysisData = buildAnalysisData(analysisInput);
  const userPrompt = `\`\`\`toon\n${toonData}\n\`\`\`\n\nAnalyze for entry.`;

  log.logSection('USER PROMPT (sent to AI) - Proper TOON Format', '💬');
  log.log();

  // Show the raw TOON output
  log.log(chalk.cyan('  TOON-encoded data:'));
  log.log();
  for (const line of toonData.split('\n')) {
    log.log(chalk.white(`    ${line}`));
  }
  log.log();
  log.log(chalk.gray('  Full prompt wrapper:'));
  log.logRaw(userPrompt);

  // ============================================================================
  // STEP 8: TOKEN ESTIMATION
  // ============================================================================

  log.logSection('TOKEN ESTIMATION', '🔢');
  log.log();

  // More accurate: ~3.5 chars per token for mixed content
  const systemTokens = Math.ceil(systemPrompt.length / 3.5);
  const userTokens = Math.ceil(userPrompt.length / 3.5);
  const totalInputTokens = systemTokens + userTokens;
  // Estimate ~200 token response
  const estOutputTokens = 200;

  // DeepSeek V3 pricing: $0.14/M input, $0.28/M output
  const inputCost = totalInputTokens * 0.00000014;
  const outputCost = estOutputTokens * 0.00000028;
  const totalCost = inputCost + outputCost;

  log.log(
    chalk.gray(
      `  System Prompt: ~${systemTokens} tokens ` +
        `(${systemPrompt.length} chars)`
    )
  );
  log.log(
    chalk.gray(
      `  User Prompt:   ~${userTokens} tokens ` + `(${userPrompt.length} chars)`
    )
  );
  log.log(chalk.gray(`  Total Input:   ~${totalInputTokens} tokens`));
  log.log(chalk.gray(`  Est. Output:   ~${estOutputTokens} tokens`));
  log.log();
  log.log(chalk.gray(`  DeepSeek V3 Cost:`));
  log.log(
    chalk.gray(`    Input:  $${inputCost.toFixed(6)} ` + `($0.14/M tokens)`)
  );
  log.log(
    chalk.gray(`    Output: $${outputCost.toFixed(6)} ` + `($0.28/M tokens)`)
  );
  log.log(chalk.green(`    Total:  $${totalCost.toFixed(6)}`));

  // ============================================================================
  // CONTEXT ANALYSIS
  // ============================================================================

  log.logSection('TOON FORMAT ANALYSIS', '🔬');
  log.log();

  log.log(chalk.green('  ✓ Proper TOON Format (toon-format/toon):'));
  log.log();

  // TOON format features
  const features = [
    'YAML-like key: value pairs for nested objects',
    'Tabular arrays[N]{fields}: for uniform data (levels)',
    'Indentation-based structure (no braces/brackets)',
    'Minimal quoting for cleaner output',
    'LLMs parse naturally - no schema explanation needed',
  ];

  for (const item of features) {
    log.log(chalk.cyan(`    • ${item}`));
  }

  log.log();

  // Compare with JSON
  const jsonData = JSON.stringify(analysisData);
  const toonChars = toonData.length;
  const jsonChars = jsonData.length;
  const savings = ((1 - toonChars / jsonChars) * 100).toFixed(0);

  log.log(chalk.yellow('  Token Savings vs JSON:'));
  log.log(
    chalk.gray(
      `    JSON:    ${jsonChars} chars → ` +
        `~${Math.ceil(jsonChars / 3.5)} tokens`
    )
  );
  log.log(
    chalk.gray(
      `    TOON:    ${toonChars} chars → ` +
        `~${Math.ceil(toonChars / 3.5)} tokens`
    )
  );
  log.log(chalk.green(`    Savings: ~${savings}%`));

  // ============================================================================
  // SUMMARY
  // ============================================================================

  log.logSection('SUMMARY', '📋');
  log.log();

  log.log(chalk.green('  ✓ All context gathered and displayed above'));
  log.log(chalk.yellow('  ⚠️  No AI call was made'));
  log.log();
  log.log(chalk.gray('  To run with actual AI analysis:'));
  log.log(chalk.white(`    bun run analyze ${symbol}`));

  // Save log file if enabled
  const logFilePath = log.saveToFile(symbol);
  if (logFilePath) {
    log.log();
    log.log(chalk.green(`  📝 Log saved: ${logFilePath}`));
  }

  log.log();
  log.logDivider('═');
  log.log();
}
