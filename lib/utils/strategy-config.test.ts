/**
 * Critical Path Integration Tests
 *
 * Tests the signal → entry validation → exit recommendation pipeline
 * that drives real trading decisions. These tests ensure the strategy
 * config rules are applied correctly end-to-end.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { join } from 'path';
import {
  validateEntry,
  getPositionSizing,
  type EntryValidation,
} from './strategy-config.ts';
import {
  getStrategyConfig,
  setConfigPath,
  clearConfigCache,
  shouldCloseOnProfit,
  shouldCloseOnDTE,
  checkPinRisk,
  getExitRecommendation,
  isRSIValid,
  isCushionValid,
  isEarningsSafe,
} from '../ai-agent/config/index.ts';
import {
  mapToStrategyRegime,
  mapToAIRegime,
  getRegimeAdjustments,
} from '../core/src/regime/detector.ts';

const CONFIG_PATH = join(import.meta.dir, '../../strategy.config.yaml');

beforeAll(() => {
  clearConfigCache();
  setConfigPath(CONFIG_PATH);
});

// ============================================================================
// ENTRY VALIDATION PIPELINE
// ============================================================================

describe('entry validation pipeline', () => {
  test('ideal trade passes all checks with high score', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      ma50: 170,
      rsi: 42,
      cushion_pct: 12,
      iv: 30,
      days_to_earnings: 30,
      analyst_bullish_pct: 85,
      analyst_count: 10,
      return_on_risk_pct: 22,
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test('trade below MA200 fails with clear reason', () => {
    const result = validateEntry({
      price: 150,
      ma200: 170,
      ma50: 160,
      rsi: 42,
      cushion_pct: 12,
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('MA200'))).toBe(true);
  });

  test('overbought RSI fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      rsi: 70, // Well above rsi_max (55)
      cushion_pct: 12,
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('RSI'))).toBe(true);
    // Score is reduced by the RSI penalty
    expect(result.score).toBeLessThan(100);
  });

  test('oversold RSI fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      rsi: 20, // Below rsi_min (30)
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('RSI'))).toBe(true);
  });

  test('insufficient cushion fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      cushion_pct: 3, // Below minimum_pct (7)
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('Cushion'))).toBe(true);
  });

  test('extreme IV fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      iv: 65, // Above avoid_if_iv_above (60)
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('IV'))).toBe(true);
  });

  test('approaching earnings fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      days_to_earnings: 7, // Below min_days_until (14)
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('earnings'))).toBe(true);
  });

  test('poor analyst sentiment fails entry', () => {
    const result = validateEntry({
      price: 180,
      ma200: 160,
      analyst_bullish_pct: 50, // Below analyst_bullish_min_pct (70)
    });

    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes('Analyst'))).toBe(true);
  });

  test('score properly reflects excellent vs minimum conditions', () => {
    const excellent = validateEntry({
      price: 180,
      ma200: 160,
      ma50: 170,
      rsi: 42, // In ideal range
      cushion_pct: 16, // Excellent
      iv: 25, // Below preferred max
      days_to_earnings: 30, // Above preferred
      analyst_bullish_pct: 85, // Above preferred
      return_on_risk_pct: 25, // Above preferred
    });

    // A trade that barely fails one criterion should score lower
    const failing = validateEntry({
      price: 180,
      ma200: 160,
      rsi: 60, // Above max (55) — failure
      cushion_pct: 5, // Below minimum (7) — failure
      iv: 55, // Above max (50) — warning
    });

    expect(excellent.passed).toBe(true);
    expect(failing.passed).toBe(false);
    expect(excellent.score).toBeGreaterThan(failing.score);
  });
});

// ============================================================================
// EXIT RECOMMENDATION PIPELINE
// ============================================================================

describe('exit recommendation pipeline', () => {
  test('75%+ profit triggers close recommendation', () => {
    const result = shouldCloseOnProfit(78);
    expect(result.shouldClose).toBe(true);
    expect(result.reason).toContain('target');
  });

  test('80%+ profit triggers greed limit close', () => {
    const result = shouldCloseOnProfit(85);
    expect(result.shouldClose).toBe(true);
    expect(result.reason).toContain('greed limit');
  });

  test('forced exit at 5 DTE (Lesson 001)', () => {
    const result = shouldCloseOnDTE(4);
    expect(result.shouldClose).toBe(true);
    expect(result.urgency).toBe('FORCED');
    expect(result.reason).toContain('Lesson 001');
  });

  test('gamma risk zone warning at 7 DTE', () => {
    const result = shouldCloseOnDTE(6);
    expect(result.urgency).toBe('WARNING');
  });

  test('normal conditions outside danger zone', () => {
    const result = shouldCloseOnDTE(20);
    expect(result.shouldClose).toBe(false);
    expect(result.urgency).toBe('OK');
  });

  test('pin risk triggers exit with low cushion + low DTE', () => {
    const result = checkPinRisk(1.5, 2); // 1.5% cushion, 2 DTE
    expect(result.hasRisk).toBe(true);
    expect(result.urgency).toBe('EXIT');
  });

  test('pin risk warning with borderline cushion', () => {
    const result = checkPinRisk(2.5, 2); // 2.5% cushion, 2 DTE
    expect(result.hasRisk).toBe(true);
    expect(result.urgency).toBe('WARNING');
  });

  test('no pin risk when DTE is high', () => {
    const result = checkPinRisk(2.0, 10); // Low cushion but 10 DTE
    expect(result.hasRisk).toBe(false);
    expect(result.urgency).toBe('OK');
  });

  test('comprehensive exit: forced close at low DTE overrides everything', () => {
    const result = getExitRecommendation(
      30, // Low profit
      3, // 3 DTE - below forced exit
      15 // Good cushion
    );
    expect(result.action).toBe('CLOSE');
    expect(result.urgency).toBe('IMMEDIATE');
  });

  test('comprehensive exit: greed limit hit', () => {
    const result = getExitRecommendation(
      82, // Above greed limit (80)
      20, // Plenty of time
      15 // Good cushion
    );
    expect(result.action).toBe('CLOSE');
    expect(result.urgency).toBe('IMMEDIATE');
  });

  test('comprehensive exit: hold when all parameters normal', () => {
    const result = getExitRecommendation(
      30, // Below target
      25, // Plenty of time
      15 // Good cushion
    );
    expect(result.action).toBe('HOLD');
    expect(result.urgency).toBe('NORMAL');
  });
});

// ============================================================================
// REGIME → STRATEGY CONFIG BRIDGE
// ============================================================================

describe('regime mapping bridge', () => {
  test('RISK_ON maps to bull', () => {
    expect(mapToStrategyRegime('RISK_ON')).toBe('bull');
  });

  test('RISK_OFF maps to bear', () => {
    expect(mapToStrategyRegime('RISK_OFF')).toBe('bear');
  });

  test('HIGH_VOL maps to caution', () => {
    expect(mapToStrategyRegime('HIGH_VOL')).toBe('caution');
  });

  test('NEUTRAL maps to neutral', () => {
    expect(mapToStrategyRegime('NEUTRAL')).toBe('neutral');
  });

  test('round-trip mapping preserves regime', () => {
    const regimes: Array<'RISK_ON' | 'RISK_OFF' | 'NEUTRAL' | 'HIGH_VOL'> = [
      'RISK_ON',
      'RISK_OFF',
      'NEUTRAL',
      'HIGH_VOL',
    ];
    for (const regime of regimes) {
      expect(mapToAIRegime(mapToStrategyRegime(regime))).toBe(regime);
    }
  });

  test('bull regime allows lower min score than bear', () => {
    const bull = getRegimeAdjustments('RISK_ON');
    const bear = getRegimeAdjustments('RISK_OFF');
    expect(bull.minScore).toBeLessThan(bear.minScore);
    expect(bull.positionSize).toBeGreaterThan(bear.positionSize);
  });

  test('bear regime requires Grade A only', () => {
    const bear = getRegimeAdjustments('RISK_OFF');
    expect(bear.onlyGradeA).toBe(true);
  });

  test('bull regime allows all grades', () => {
    const bull = getRegimeAdjustments('RISK_ON');
    expect(bull.onlyGradeA).toBe(false);
  });
});

// ============================================================================
// POSITION SIZING
// ============================================================================

describe('position sizing', () => {
  test('small account gets wider position limits', () => {
    const small = getPositionSizing(2000);
    const large = getPositionSizing(50000);
    expect(small.maxPositionPct).toBeGreaterThanOrEqual(large.maxPositionPct);
  });

  test('account size tiers produce different max positions', () => {
    const tier1 = getPositionSizing(3000);
    const tier3 = getPositionSizing(15000);
    expect(tier3.maxPositions).toBeGreaterThanOrEqual(tier1.maxPositions);
  });

  test('max deployed stays within config limits', () => {
    const config = getStrategyConfig();
    const sizing = getPositionSizing(10000);
    expect(sizing.maxDeployed).toBeLessThanOrEqual(
      10000 * (config.position_sizing.max_total_deployed_pct / 100)
    );
  });
});

// ============================================================================
// INDIVIDUAL VALIDATORS
// ============================================================================

describe('individual entry validators', () => {
  test('RSI in ideal range reports as valid', () => {
    const result = isRSIValid(42);
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('ideal');
  });

  test('RSI with strong ADX allows higher values', () => {
    const result = isRSIValid(60, 45); // RSI 60, ADX 45
    expect(result.valid).toBe(true);
    expect(result.reason).toContain('strong trend');
  });

  test('cushion quality classification', () => {
    const excellent = isCushionValid(16);
    const preferred = isCushionValid(11);
    const minimum = isCushionValid(8);
    const insufficient = isCushionValid(3);

    expect(excellent.quality).toBe('EXCELLENT');
    expect(preferred.quality).toBe('PREFERRED');
    expect(minimum.quality).toBe('MINIMUM');
    expect(insufficient.quality).toBe('INSUFFICIENT');
    expect(insufficient.valid).toBe(false);
  });

  test('earnings safety classification', () => {
    const safe = isEarningsSafe(30);
    const minimum = isEarningsSafe(15);
    const unsafe = isEarningsSafe(7);
    const unknown = isEarningsSafe(null);

    expect(safe.safe).toBe(true);
    expect(minimum.safe).toBe(true);
    expect(unsafe.safe).toBe(false);
    expect(unknown.safe).toBe(true); // Null = no earnings date found
  });
});
