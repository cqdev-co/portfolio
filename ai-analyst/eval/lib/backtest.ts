/**
 * Backtesting Framework for AI Analyst
 *
 * Tracks recommendations, outcomes, and calculates performance metrics.
 * Uses JSON files for persistence - no database required.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// =============================================================================
// TYPES
// =============================================================================

export type RecommendationType =
  | 'BULLISH'
  | 'BEARISH'
  | 'NEUTRAL'
  | 'HOLD'
  | 'CLOSE';
export type SpreadType =
  | 'CALL_DEBIT'
  | 'PUT_DEBIT'
  | 'CALL_CREDIT'
  | 'PUT_CREDIT'
  | 'IRON_CONDOR';
export type OutcomeStatus =
  | 'PENDING'
  | 'WIN'
  | 'LOSS'
  | 'BREAKEVEN'
  | 'EXPIRED';

export interface SpreadRecommendation {
  type: SpreadType;
  longStrike: number;
  shortStrike: number;
  expiration: string; // ISO date
  estimatedDebit: number;
  estimatedMaxProfit: number;
  breakeven: number;
  pop?: number; // Probability of Profit
}

export interface Recommendation {
  id: string;
  timestamp: string; // ISO date
  ticker: string;
  priceAtRecommendation: number;
  recommendation: RecommendationType;
  spread?: SpreadRecommendation;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string; // e.g., "30 days", "weekly expiry"
  confidence?: number; // 0-100
  reasoning?: string;
  aiModel?: string;
  contextSnapshot?: {
    rsi?: number;
    iv?: number;
    ma200Distance?: number;
    daysToEarnings?: number;
  };
}

export interface Outcome {
  recommendationId: string;
  status: OutcomeStatus;
  closedAt?: string; // ISO date
  priceAtClose?: number;
  actualProfit?: number; // Per contract in dollars
  actualProfitPct?: number;
  notes?: string;
  daysHeld?: number;
}

export interface BacktestRecord {
  recommendation: Recommendation;
  outcome?: Outcome;
}

export interface PerformanceMetrics {
  totalRecommendations: number;
  closedTrades: number;
  pendingTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // 0-100%
  avgWin: number; // dollars
  avgLoss: number; // dollars
  profitFactor: number; // gross profit / gross loss
  totalProfit: number; // dollars
  avgHoldingPeriod: number; // days
  byTicker: Record<string, { wins: number; losses: number; profit: number }>;
  byRecommendationType: Record<
    RecommendationType,
    { wins: number; losses: number }
  >;
  monthlyPerformance: Record<string, { profit: number; trades: number }>;
}

// =============================================================================
// STORAGE
// =============================================================================

const DEFAULT_DATA_DIR = join(process.cwd(), 'eval', 'backtests');
const RECORDS_FILE = 'recommendations.json';

function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function getRecordsPath(dataDir: string): string {
  return join(dataDir, RECORDS_FILE);
}

export function loadRecords(
  dataDir: string = DEFAULT_DATA_DIR
): BacktestRecord[] {
  ensureDataDir(dataDir);
  const path = getRecordsPath(dataDir);

  if (!existsSync(path)) {
    return [];
  }

  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data) as BacktestRecord[];
  } catch {
    return [];
  }
}

export function saveRecords(
  records: BacktestRecord[],
  dataDir: string = DEFAULT_DATA_DIR
): void {
  ensureDataDir(dataDir);
  const path = getRecordsPath(dataDir);
  writeFileSync(path, JSON.stringify(records, null, 2));
}

// =============================================================================
// RECOMMENDATION LOGGING
// =============================================================================

export function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function logRecommendation(
  rec: Omit<Recommendation, 'id' | 'timestamp'>,
  dataDir: string = DEFAULT_DATA_DIR
): Recommendation {
  const records = loadRecords(dataDir);

  const recommendation: Recommendation = {
    ...rec,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  records.push({ recommendation });
  saveRecords(records, dataDir);

  return recommendation;
}

export function getRecommendation(
  id: string,
  dataDir: string = DEFAULT_DATA_DIR
): BacktestRecord | undefined {
  const records = loadRecords(dataDir);
  return records.find((r) => r.recommendation.id === id);
}

export function getPendingRecommendations(
  dataDir: string = DEFAULT_DATA_DIR
): BacktestRecord[] {
  const records = loadRecords(dataDir);
  return records.filter((r) => !r.outcome || r.outcome.status === 'PENDING');
}

// =============================================================================
// OUTCOME TRACKING
// =============================================================================

export function recordOutcome(
  recommendationId: string,
  outcome: Omit<Outcome, 'recommendationId'>,
  dataDir: string = DEFAULT_DATA_DIR
): BacktestRecord | undefined {
  const records = loadRecords(dataDir);
  const index = records.findIndex(
    (r) => r.recommendation.id === recommendationId
  );

  if (index === -1) {
    return undefined;
  }

  const record = records[index];
  const rec = record.recommendation;

  // Calculate days held
  const daysHeld = outcome.closedAt
    ? Math.ceil(
        (new Date(outcome.closedAt).getTime() -
          new Date(rec.timestamp).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : undefined;

  record.outcome = {
    ...outcome,
    recommendationId,
    daysHeld,
  };

  saveRecords(records, dataDir);
  return record;
}

/**
 * Auto-evaluate outcome based on price movement
 */
export function evaluateOutcome(
  rec: Recommendation,
  currentPrice: number,
  currentDate: Date = new Date()
): Partial<Outcome> {
  const spread = rec.spread;

  if (!spread) {
    // Non-spread recommendation - simple price target check
    if (rec.targetPrice && currentPrice >= rec.targetPrice) {
      return {
        status: 'WIN',
        priceAtClose: currentPrice,
        actualProfitPct:
          ((currentPrice - rec.priceAtRecommendation) /
            rec.priceAtRecommendation) *
          100,
      };
    }
    if (rec.stopLoss && currentPrice <= rec.stopLoss) {
      return {
        status: 'LOSS',
        priceAtClose: currentPrice,
        actualProfitPct:
          ((currentPrice - rec.priceAtRecommendation) /
            rec.priceAtRecommendation) *
          100,
      };
    }
    return { status: 'PENDING' };
  }

  // Spread recommendation evaluation
  const expDate = new Date(spread.expiration);
  const isExpired = currentDate >= expDate;

  if (spread.type === 'CALL_DEBIT') {
    if (isExpired) {
      if (currentPrice >= spread.shortStrike) {
        // Max profit
        return {
          status: 'WIN',
          priceAtClose: currentPrice,
          actualProfit: spread.estimatedMaxProfit,
          actualProfitPct:
            (spread.estimatedMaxProfit / spread.estimatedDebit) * 100,
        };
      } else if (currentPrice >= spread.longStrike) {
        // Partial profit/loss
        const intrinsicValue = currentPrice - spread.longStrike;
        const profit = intrinsicValue - spread.estimatedDebit;
        return {
          status: profit > 0 ? 'WIN' : profit < -0.05 ? 'LOSS' : 'BREAKEVEN',
          priceAtClose: currentPrice,
          actualProfit: profit,
          actualProfitPct: (profit / spread.estimatedDebit) * 100,
        };
      } else {
        // Total loss
        return {
          status: 'LOSS',
          priceAtClose: currentPrice,
          actualProfit: -spread.estimatedDebit,
          actualProfitPct: -100,
        };
      }
    }

    // Not expired yet - check if ITM with good profit
    if (currentPrice >= spread.shortStrike) {
      // Could close early for near-max profit
      return { status: 'PENDING', priceAtClose: currentPrice };
    }
  }

  return { status: 'PENDING' };
}

// =============================================================================
// PERFORMANCE METRICS
// =============================================================================

export function calculateMetrics(
  dataDir: string = DEFAULT_DATA_DIR
): PerformanceMetrics {
  const records = loadRecords(dataDir);

  const metrics: PerformanceMetrics = {
    totalRecommendations: records.length,
    closedTrades: 0,
    pendingTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    totalProfit: 0,
    avgHoldingPeriod: 0,
    byTicker: {},
    byRecommendationType: {
      BULLISH: { wins: 0, losses: 0 },
      BEARISH: { wins: 0, losses: 0 },
      NEUTRAL: { wins: 0, losses: 0 },
      HOLD: { wins: 0, losses: 0 },
      CLOSE: { wins: 0, losses: 0 },
    },
    monthlyPerformance: {},
  };

  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let totalHoldingDays = 0;
  let closedWithDays = 0;

  for (const record of records) {
    const { recommendation: rec, outcome } = record;

    if (!outcome || outcome.status === 'PENDING') {
      metrics.pendingTrades++;
      continue;
    }

    metrics.closedTrades++;

    // Initialize ticker stats
    if (!metrics.byTicker[rec.ticker]) {
      metrics.byTicker[rec.ticker] = { wins: 0, losses: 0, profit: 0 };
    }

    const profit = outcome.actualProfit ?? 0;
    metrics.totalProfit += profit;
    metrics.byTicker[rec.ticker].profit += profit;

    // Track holding period
    if (outcome.daysHeld !== undefined) {
      totalHoldingDays += outcome.daysHeld;
      closedWithDays++;
    }

    // Monthly tracking
    if (outcome.closedAt) {
      const month = outcome.closedAt.substring(0, 7); // YYYY-MM
      if (!metrics.monthlyPerformance[month]) {
        metrics.monthlyPerformance[month] = { profit: 0, trades: 0 };
      }
      metrics.monthlyPerformance[month].profit += profit;
      metrics.monthlyPerformance[month].trades++;
    }

    // Win/Loss tracking
    if (outcome.status === 'WIN') {
      metrics.wins++;
      metrics.byTicker[rec.ticker].wins++;
      metrics.byRecommendationType[rec.recommendation].wins++;
      totalWinAmount += profit;
    } else if (outcome.status === 'LOSS') {
      metrics.losses++;
      metrics.byTicker[rec.ticker].losses++;
      metrics.byRecommendationType[rec.recommendation].losses++;
      totalLossAmount += Math.abs(profit);
    } else if (outcome.status === 'BREAKEVEN') {
      metrics.breakevens++;
    }
  }

  // Calculate derived metrics
  const totalDecided = metrics.wins + metrics.losses;
  if (totalDecided > 0) {
    metrics.winRate = (metrics.wins / totalDecided) * 100;
  }

  if (metrics.wins > 0) {
    metrics.avgWin = totalWinAmount / metrics.wins;
  }

  if (metrics.losses > 0) {
    metrics.avgLoss = totalLossAmount / metrics.losses;
  }

  if (totalLossAmount > 0) {
    metrics.profitFactor = totalWinAmount / totalLossAmount;
  } else if (totalWinAmount > 0) {
    metrics.profitFactor = Infinity;
  }

  if (closedWithDays > 0) {
    metrics.avgHoldingPeriod = totalHoldingDays / closedWithDays;
  }

  return metrics;
}

// =============================================================================
// REPORTING
// =============================================================================

export function formatMetricsReport(metrics: PerformanceMetrics): string {
  let output = `\n📊 BACKTEST PERFORMANCE REPORT\n`;
  output += `${'═'.repeat(50)}\n\n`;

  output += `OVERVIEW\n`;
  output += `${'─'.repeat(30)}\n`;
  output += `Total Recommendations: ${metrics.totalRecommendations}\n`;
  output += `Closed Trades:         ${metrics.closedTrades}\n`;
  output += `Pending Trades:        ${metrics.pendingTrades}\n\n`;

  output += `PERFORMANCE\n`;
  output += `${'─'.repeat(30)}\n`;
  output += `Win Rate:        ${metrics.winRate.toFixed(1)}%\n`;
  output += `Wins / Losses:   ${metrics.wins} / ${metrics.losses}\n`;
  output += `Breakevens:      ${metrics.breakevens}\n`;
  output += `Avg Win:         $${metrics.avgWin.toFixed(2)}\n`;
  output += `Avg Loss:        $${metrics.avgLoss.toFixed(2)}\n`;
  output += `Profit Factor:   ${metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}\n`;
  output += `Total Profit:    $${metrics.totalProfit.toFixed(2)}\n`;
  output += `Avg Hold Period: ${metrics.avgHoldingPeriod.toFixed(1)} days\n\n`;

  // By Ticker
  const tickers = Object.entries(metrics.byTicker).sort(
    (a, b) => b[1].profit - a[1].profit
  );

  if (tickers.length > 0) {
    output += `BY TICKER\n`;
    output += `${'─'.repeat(30)}\n`;
    for (const [ticker, stats] of tickers.slice(0, 10)) {
      const wr =
        stats.wins + stats.losses > 0
          ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0)
          : '-';
      output += `${ticker.padEnd(6)} ${stats.wins}W/${stats.losses}L (${wr}%) $${stats.profit.toFixed(2)}\n`;
    }
    output += `\n`;
  }

  // Monthly
  const months = Object.entries(metrics.monthlyPerformance).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (months.length > 0) {
    output += `MONTHLY PERFORMANCE\n`;
    output += `${'─'.repeat(30)}\n`;
    for (const [month, stats] of months.slice(-6)) {
      const sign = stats.profit >= 0 ? '+' : '';
      output += `${month}  ${stats.trades} trades  ${sign}$${stats.profit.toFixed(2)}\n`;
    }
    output += `\n`;
  }

  return output;
}

/**
 * Get Sharpe-like ratio (simplified without risk-free rate)
 */
export function calculateSharpeRatio(
  dataDir: string = DEFAULT_DATA_DIR
): number {
  const records = loadRecords(dataDir);
  const returns: number[] = [];

  for (const record of records) {
    if (record.outcome?.actualProfitPct !== undefined) {
      returns.push(record.outcome.actualProfitPct);
    }
  }

  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return mean / stdDev;
}

// =============================================================================
// SAMPLE DATA GENERATION (for testing)
// =============================================================================

export function generateSampleData(count: number = 20): BacktestRecord[] {
  const tickers = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];
  const records: BacktestRecord[] = [];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const ticker = tickers[Math.floor(Math.random() * tickers.length)];
    const price = 100 + Math.random() * 200;
    const isWin = Math.random() > 0.4; // 60% win rate
    const daysAgo = Math.floor(Math.random() * 90);
    const holdDays = Math.floor(Math.random() * 30) + 1;

    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: Math.floor(price * 0.95),
      shortStrike: Math.floor(price),
      expiration: new Date(now - (daysAgo - holdDays) * dayMs).toISOString(),
      estimatedDebit: 2 + Math.random() * 3,
      estimatedMaxProfit: 1 + Math.random() * 2,
      breakeven: price * 0.97,
      pop: 50 + Math.random() * 30,
    };

    const recommendation: Recommendation = {
      id: `sample_${i}`,
      timestamp: new Date(now - daysAgo * dayMs).toISOString(),
      ticker,
      priceAtRecommendation: price,
      recommendation: 'BULLISH',
      spread,
      confidence: 50 + Math.random() * 40,
      contextSnapshot: {
        rsi: 30 + Math.random() * 40,
        iv: 20 + Math.random() * 30,
      },
    };

    const profit = isWin
      ? spread.estimatedMaxProfit * (0.5 + Math.random() * 0.5)
      : -spread.estimatedDebit * (0.3 + Math.random() * 0.7);

    const outcome: Outcome = {
      recommendationId: recommendation.id,
      status: isWin ? 'WIN' : 'LOSS',
      closedAt: new Date(now - (daysAgo - holdDays) * dayMs).toISOString(),
      priceAtClose: price * (isWin ? 1.05 : 0.95),
      actualProfit: profit,
      actualProfitPct: (profit / spread.estimatedDebit) * 100,
      daysHeld: holdDays,
    };

    records.push({ recommendation, outcome });
  }

  return records;
}
