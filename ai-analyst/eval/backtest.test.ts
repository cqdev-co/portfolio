/**
 * Backtesting Framework Tests
 *
 * Tests recommendation tracking, outcome evaluation, and performance metrics.
 */

import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  loadRecords,
  saveRecords,
  logRecommendation,
  recordOutcome,
  getPendingRecommendations,
  evaluateOutcome,
  calculateMetrics,
  calculateSharpeRatio,
  generateSampleData,
  formatMetricsReport,
  type Recommendation,
  type BacktestRecord,
  type SpreadRecommendation,
} from './lib/backtest.ts';

// Test data directory
const TEST_DATA_DIR = join(process.cwd(), 'eval', 'backtests', '.test');

// Cleanup before/after tests
beforeEach(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true });
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true });
  }
});

// =============================================================================
// STORAGE TESTS
// =============================================================================

describe('Backtest Storage', () => {
  test('Load returns empty array for new directory', () => {
    const records = loadRecords(TEST_DATA_DIR);
    expect(records).toEqual([]);
  });

  test('Save and load records', () => {
    const records: BacktestRecord[] = [
      {
        recommendation: {
          id: 'test_1',
          timestamp: '2024-01-01T00:00:00Z',
          ticker: 'NVDA',
          priceAtRecommendation: 188.61,
          recommendation: 'BULLISH',
        },
      },
    ];

    saveRecords(records, TEST_DATA_DIR);
    const loaded = loadRecords(TEST_DATA_DIR);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].recommendation.ticker).toBe('NVDA');
  });

  test('Persists across multiple saves', () => {
    const rec1: BacktestRecord = {
      recommendation: {
        id: 'test_1',
        timestamp: '2024-01-01T00:00:00Z',
        ticker: 'NVDA',
        priceAtRecommendation: 188,
        recommendation: 'BULLISH',
      },
    };

    saveRecords([rec1], TEST_DATA_DIR);

    const records = loadRecords(TEST_DATA_DIR);
    const rec2: BacktestRecord = {
      recommendation: {
        id: 'test_2',
        timestamp: '2024-01-02T00:00:00Z',
        ticker: 'AAPL',
        priceAtRecommendation: 195,
        recommendation: 'BEARISH',
      },
    };
    records.push(rec2);
    saveRecords(records, TEST_DATA_DIR);

    const reloaded = loadRecords(TEST_DATA_DIR);
    expect(reloaded).toHaveLength(2);
  });
});

// =============================================================================
// RECOMMENDATION LOGGING TESTS
// =============================================================================

describe('Recommendation Logging', () => {
  test('Log recommendation generates ID and timestamp', () => {
    const rec = logRecommendation(
      {
        ticker: 'NVDA',
        priceAtRecommendation: 188.61,
        recommendation: 'BULLISH',
      },
      TEST_DATA_DIR
    );

    expect(rec.id).toMatch(/^rec_\d+_[a-z0-9]+$/);
    expect(rec.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('Log recommendation with spread details', () => {
    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: 185,
      shortStrike: 190,
      expiration: '2024-02-16',
      estimatedDebit: 3.8,
      estimatedMaxProfit: 1.2,
      breakeven: 188.8,
      pop: 65,
    };

    const rec = logRecommendation(
      {
        ticker: 'NVDA',
        priceAtRecommendation: 188.61,
        recommendation: 'BULLISH',
        spread,
        confidence: 75,
      },
      TEST_DATA_DIR
    );

    expect(rec.spread?.longStrike).toBe(185);
    expect(rec.spread?.shortStrike).toBe(190);
    expect(rec.confidence).toBe(75);
  });

  test('Get pending recommendations', () => {
    // Log 3 recommendations
    logRecommendation(
      {
        ticker: 'NVDA',
        priceAtRecommendation: 188,
        recommendation: 'BULLISH',
      },
      TEST_DATA_DIR
    );

    logRecommendation(
      {
        ticker: 'AAPL',
        priceAtRecommendation: 195,
        recommendation: 'BULLISH',
      },
      TEST_DATA_DIR
    );

    const rec3 = logRecommendation(
      {
        ticker: 'MSFT',
        priceAtRecommendation: 420,
        recommendation: 'BEARISH',
      },
      TEST_DATA_DIR
    );

    // Mark one as closed
    recordOutcome(
      rec3.id,
      {
        status: 'WIN',
        closedAt: new Date().toISOString(),
        actualProfit: 150,
      },
      TEST_DATA_DIR
    );

    const pending = getPendingRecommendations(TEST_DATA_DIR);
    expect(pending).toHaveLength(2);
  });
});

// =============================================================================
// OUTCOME TRACKING TESTS
// =============================================================================

describe('Outcome Tracking', () => {
  test('Record outcome for recommendation', () => {
    const rec = logRecommendation(
      {
        ticker: 'NVDA',
        priceAtRecommendation: 188,
        recommendation: 'BULLISH',
      },
      TEST_DATA_DIR
    );

    const record = recordOutcome(
      rec.id,
      {
        status: 'WIN',
        closedAt: new Date().toISOString(),
        priceAtClose: 195,
        actualProfit: 120,
        actualProfitPct: 31.6,
      },
      TEST_DATA_DIR
    );

    expect(record?.outcome?.status).toBe('WIN');
    expect(record?.outcome?.actualProfit).toBe(120);
  });

  test('Calculate days held automatically', () => {
    const recDate = new Date('2024-01-01');
    const closeDate = new Date('2024-01-15');

    // Manually create a backdated recommendation
    const records: BacktestRecord[] = [
      {
        recommendation: {
          id: 'test_hold',
          timestamp: recDate.toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
        },
      },
    ];
    saveRecords(records, TEST_DATA_DIR);

    const record = recordOutcome(
      'test_hold',
      {
        status: 'WIN',
        closedAt: closeDate.toISOString(),
      },
      TEST_DATA_DIR
    );

    expect(record?.outcome?.daysHeld).toBe(14);
  });

  test('Returns undefined for non-existent recommendation', () => {
    const result = recordOutcome(
      'fake_id',
      {
        status: 'WIN',
      },
      TEST_DATA_DIR
    );

    expect(result).toBeUndefined();
  });
});

// =============================================================================
// OUTCOME EVALUATION TESTS
// =============================================================================

describe('Outcome Evaluation', () => {
  const baseRec: Recommendation = {
    id: 'eval_test',
    timestamp: '2024-01-01T00:00:00Z',
    ticker: 'NVDA',
    priceAtRecommendation: 188,
    recommendation: 'BULLISH',
  };

  test('Evaluate simple price target - WIN', () => {
    const rec = { ...baseRec, targetPrice: 200, stopLoss: 175 };
    const result = evaluateOutcome(rec, 205);

    expect(result.status).toBe('WIN');
    expect(result.actualProfitPct).toBeGreaterThan(0);
  });

  test('Evaluate simple price target - LOSS', () => {
    const rec = { ...baseRec, targetPrice: 200, stopLoss: 175 };
    const result = evaluateOutcome(rec, 170);

    expect(result.status).toBe('LOSS');
    expect(result.actualProfitPct).toBeLessThan(0);
  });

  test('Evaluate call debit spread at expiration - MAX PROFIT', () => {
    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: 185,
      shortStrike: 190,
      expiration: '2024-01-01',
      estimatedDebit: 3.8,
      estimatedMaxProfit: 1.2,
      breakeven: 188.8,
    };
    const rec = { ...baseRec, spread };
    const expDate = new Date('2024-01-02'); // After expiration

    const result = evaluateOutcome(rec, 195, expDate);

    expect(result.status).toBe('WIN');
    expect(result.actualProfit).toBe(1.2);
  });

  test('Evaluate call debit spread at expiration - TOTAL LOSS', () => {
    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: 185,
      shortStrike: 190,
      expiration: '2024-01-01',
      estimatedDebit: 3.8,
      estimatedMaxProfit: 1.2,
      breakeven: 188.8,
    };
    const rec = { ...baseRec, spread };
    const expDate = new Date('2024-01-02');

    const result = evaluateOutcome(rec, 180, expDate);

    expect(result.status).toBe('LOSS');
    expect(result.actualProfit).toBe(-3.8);
    expect(result.actualProfitPct).toBe(-100);
  });

  test('Evaluate call debit spread at expiration - PARTIAL PROFIT', () => {
    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: 185,
      shortStrike: 190,
      expiration: '2024-01-01',
      estimatedDebit: 3.8,
      estimatedMaxProfit: 1.2,
      breakeven: 188.8,
    };
    const rec = { ...baseRec, spread };
    const expDate = new Date('2024-01-02');

    // Price at 189 = $4 intrinsic - $3.80 cost = $0.20 profit
    const result = evaluateOutcome(rec, 189, expDate);

    expect(result.status).toBe('WIN');
    expect(result.actualProfit).toBeCloseTo(0.2, 2);
  });

  test('Evaluate pending (not expired)', () => {
    const spread: SpreadRecommendation = {
      type: 'CALL_DEBIT',
      longStrike: 185,
      shortStrike: 190,
      expiration: '2025-12-31',
      estimatedDebit: 3.8,
      estimatedMaxProfit: 1.2,
      breakeven: 188.8,
    };
    const rec = { ...baseRec, spread };

    const result = evaluateOutcome(rec, 188);

    expect(result.status).toBe('PENDING');
  });
});

// =============================================================================
// PERFORMANCE METRICS TESTS
// =============================================================================

describe('Performance Metrics', () => {
  test('Empty data returns zeroed metrics', () => {
    const metrics = calculateMetrics(TEST_DATA_DIR);

    expect(metrics.totalRecommendations).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
  });

  test('Calculate metrics from sample data', () => {
    const sampleData = generateSampleData(20);
    saveRecords(sampleData, TEST_DATA_DIR);

    const metrics = calculateMetrics(TEST_DATA_DIR);

    expect(metrics.totalRecommendations).toBe(20);
    expect(metrics.closedTrades).toBeGreaterThan(0);
    expect(metrics.winRate).toBeGreaterThan(0);
    expect(metrics.winRate).toBeLessThanOrEqual(100);
  });

  test('Win rate calculation', () => {
    // Create 3 wins, 1 loss = 75% win rate
    const records: BacktestRecord[] = [];

    for (let i = 0; i < 4; i++) {
      records.push({
        recommendation: {
          id: `test_${i}`,
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
          spread: {
            type: 'CALL_DEBIT',
            longStrike: 185,
            shortStrike: 190,
            expiration: '2024-01-15',
            estimatedDebit: 3.8,
            estimatedMaxProfit: 1.2,
            breakeven: 188.8,
          },
        },
        outcome: {
          recommendationId: `test_${i}`,
          status: i < 3 ? 'WIN' : 'LOSS',
          actualProfit: i < 3 ? 120 : -380,
          daysHeld: 10,
        },
      });
    }

    saveRecords(records, TEST_DATA_DIR);
    const metrics = calculateMetrics(TEST_DATA_DIR);

    expect(metrics.wins).toBe(3);
    expect(metrics.losses).toBe(1);
    expect(metrics.winRate).toBe(75);
  });

  test('Profit factor calculation', () => {
    const records: BacktestRecord[] = [
      {
        recommendation: {
          id: 'win_1',
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: 'win_1',
          status: 'WIN',
          actualProfit: 200,
        },
      },
      {
        recommendation: {
          id: 'loss_1',
          timestamp: new Date().toISOString(),
          ticker: 'AAPL',
          priceAtRecommendation: 195,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: 'loss_1',
          status: 'LOSS',
          actualProfit: -100,
        },
      },
    ];

    saveRecords(records, TEST_DATA_DIR);
    const metrics = calculateMetrics(TEST_DATA_DIR);

    // Profit factor = gross profit / gross loss = 200 / 100 = 2.0
    expect(metrics.profitFactor).toBe(2);
    expect(metrics.totalProfit).toBe(100);
  });

  test('By ticker breakdown', () => {
    const records: BacktestRecord[] = [
      {
        recommendation: {
          id: 'nvda_1',
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: 'nvda_1',
          status: 'WIN',
          actualProfit: 150,
        },
      },
      {
        recommendation: {
          id: 'nvda_2',
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 190,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: 'nvda_2',
          status: 'LOSS',
          actualProfit: -100,
        },
      },
      {
        recommendation: {
          id: 'aapl_1',
          timestamp: new Date().toISOString(),
          ticker: 'AAPL',
          priceAtRecommendation: 195,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: 'aapl_1',
          status: 'WIN',
          actualProfit: 200,
        },
      },
    ];

    saveRecords(records, TEST_DATA_DIR);
    const metrics = calculateMetrics(TEST_DATA_DIR);

    expect(metrics.byTicker['NVDA'].wins).toBe(1);
    expect(metrics.byTicker['NVDA'].losses).toBe(1);
    expect(metrics.byTicker['NVDA'].profit).toBe(50);
    expect(metrics.byTicker['AAPL'].wins).toBe(1);
    expect(metrics.byTicker['AAPL'].profit).toBe(200);
  });
});

// =============================================================================
// SHARPE RATIO TESTS
// =============================================================================

describe('Sharpe Ratio', () => {
  test('Returns 0 for insufficient data', () => {
    const sharpe = calculateSharpeRatio(TEST_DATA_DIR);
    expect(sharpe).toBe(0);
  });

  test('Positive Sharpe for consistent wins', () => {
    const records: BacktestRecord[] = [];

    for (let i = 0; i < 10; i++) {
      records.push({
        recommendation: {
          id: `test_${i}`,
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: `test_${i}`,
          status: 'WIN',
          actualProfitPct: 20 + Math.random() * 10, // 20-30% returns
        },
      });
    }

    saveRecords(records, TEST_DATA_DIR);
    const sharpe = calculateSharpeRatio(TEST_DATA_DIR);

    expect(sharpe).toBeGreaterThan(1);
  });

  test('Near-zero Sharpe for random outcomes', () => {
    const records: BacktestRecord[] = [];

    for (let i = 0; i < 20; i++) {
      const isWin = Math.random() > 0.5;
      records.push({
        recommendation: {
          id: `test_${i}`,
          timestamp: new Date().toISOString(),
          ticker: 'NVDA',
          priceAtRecommendation: 188,
          recommendation: 'BULLISH',
        },
        outcome: {
          recommendationId: `test_${i}`,
          status: isWin ? 'WIN' : 'LOSS',
          actualProfitPct: isWin ? 30 : -30,
        },
      });
    }

    saveRecords(records, TEST_DATA_DIR);
    const sharpe = calculateSharpeRatio(TEST_DATA_DIR);

    // With 50/50 +30/-30, should be close to 0
    expect(Math.abs(sharpe)).toBeLessThan(1);
  });
});

// =============================================================================
// REPORT FORMATTING TESTS
// =============================================================================

describe('Report Formatting', () => {
  test('Format empty metrics report', () => {
    const metrics = calculateMetrics(TEST_DATA_DIR);
    const report = formatMetricsReport(metrics);

    expect(report).toContain('BACKTEST PERFORMANCE REPORT');
    expect(report).toContain('Total Recommendations: 0');
  });

  test('Format report with sample data', () => {
    const sampleData = generateSampleData(15);
    saveRecords(sampleData, TEST_DATA_DIR);

    const metrics = calculateMetrics(TEST_DATA_DIR);
    const report = formatMetricsReport(metrics);

    expect(report).toContain('Win Rate:');
    expect(report).toContain('Profit Factor:');
    expect(report).toContain('BY TICKER');
  });
});

// =============================================================================
// SAMPLE DATA GENERATION TESTS
// =============================================================================

describe('Sample Data Generation', () => {
  test('Generate specified count', () => {
    const data = generateSampleData(10);
    expect(data).toHaveLength(10);
  });

  test('All records have required fields', () => {
    const data = generateSampleData(5);

    for (const record of data) {
      expect(record.recommendation.id).toBeDefined();
      expect(record.recommendation.ticker).toBeDefined();
      expect(record.recommendation.priceAtRecommendation).toBeGreaterThan(0);
      expect(record.outcome).toBeDefined();
    }
  });

  test('Mix of wins and losses', () => {
    const data = generateSampleData(50);
    const wins = data.filter((r) => r.outcome?.status === 'WIN').length;
    const losses = data.filter((r) => r.outcome?.status === 'LOSS').length;

    expect(wins).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
    expect(wins + losses).toBe(50);
  });
});
