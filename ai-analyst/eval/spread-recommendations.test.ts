/**
 * Spread Recommendation Calculation Tests
 *
 * Tests the accuracy of spread metrics including:
 * - Risk/Reward ratios
 * - Probability of Profit (PoP)
 * - Cushion calculations
 * - Return on Risk
 */

import { describe, test, expect } from 'bun:test';

// ============================================================================
// TEST UTILITIES - Mirrors logic from yahoo.ts
// ============================================================================

/**
 * Cumulative Normal Distribution Function (CDF)
 * Used for PoP calculation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate Probability of Profit
 */
function calculatePoP(
  currentPrice: number,
  breakeven: number,
  iv: number,
  dte: number
): number {
  if (iv <= 0 || dte <= 0) {
    return currentPrice > breakeven ? 75 : 25;
  }

  const T = dte / 365;
  const z = Math.log(currentPrice / breakeven) / (iv * Math.sqrt(T));
  const pop = normalCDF(z) * 100;

  return Math.min(95, Math.max(5, Math.round(pop)));
}

interface SpreadParams {
  currentPrice: number;
  longStrike: number;
  shortStrike: number;
  estimatedDebit: number; // Per share
  iv: number; // As decimal (0.35 = 35%)
  dte: number;
}

interface SpreadMetrics {
  spreadWidth: number;
  maxProfit: number;
  breakeven: number;
  cushion: number; // As percentage
  returnOnRisk: number; // As percentage
  pop: number; // As percentage (0-100)
}

function calculateSpreadMetrics(params: SpreadParams): SpreadMetrics {
  const { currentPrice, longStrike, shortStrike, estimatedDebit, iv, dte } =
    params;

  const spreadWidth = shortStrike - longStrike;
  const maxProfit = spreadWidth - estimatedDebit;
  const breakeven = longStrike + estimatedDebit;
  const cushion = ((currentPrice - breakeven) / currentPrice) * 100;
  const returnOnRisk = (maxProfit / estimatedDebit) * 100;
  const pop = calculatePoP(currentPrice, breakeven, iv, dte);

  return {
    spreadWidth,
    maxProfit: Math.round(maxProfit * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    cushion: Math.round(cushion * 10) / 10,
    returnOnRisk: Math.round(returnOnRisk * 10) / 10,
    pop,
  };
}

// ============================================================================
// TEST CASES
// ============================================================================

describe('Spread Metrics Calculations', () => {
  describe('Basic Spread Math', () => {
    test('Standard $5 wide spread', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 188.61,
        longStrike: 180,
        shortStrike: 185,
        estimatedDebit: 4.18,
        iv: 0.35,
        dte: 28,
      });

      expect(metrics.spreadWidth).toBe(5);
      expect(metrics.maxProfit).toBe(0.82); // $5.00 - $4.18
      expect(metrics.breakeven).toBe(184.18); // $180 + $4.18
      expect(metrics.returnOnRisk).toBeCloseTo(19.6, 1); // 0.82/4.18 * 100
    });

    test('$10 wide spread', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 350,
        longStrike: 340,
        shortStrike: 350,
        estimatedDebit: 8.5,
        iv: 0.4,
        dte: 30,
      });

      expect(metrics.spreadWidth).toBe(10);
      expect(metrics.maxProfit).toBe(1.5);
      expect(metrics.breakeven).toBe(348.5);
      expect(metrics.returnOnRisk).toBeCloseTo(17.6, 1);
    });

    test('$2.50 wide spread', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 52,
        longStrike: 50,
        shortStrike: 52.5,
        estimatedDebit: 2.0,
        iv: 0.3,
        dte: 21,
      });

      expect(metrics.spreadWidth).toBe(2.5);
      expect(metrics.maxProfit).toBe(0.5);
      expect(metrics.returnOnRisk).toBe(25);
    });
  });

  describe('Cushion Calculations', () => {
    test('Good cushion (price well above breakeven)', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 200,
        longStrike: 180,
        shortStrike: 185,
        estimatedDebit: 4.0,
        iv: 0.35,
        dte: 30,
      });

      // Breakeven = 184, current = 200
      // Cushion = (200 - 184) / 200 = 8%
      expect(metrics.breakeven).toBe(184);
      expect(metrics.cushion).toBe(8);
    });

    test('Thin cushion (price near breakeven)', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 185,
        longStrike: 180,
        shortStrike: 185,
        estimatedDebit: 4.0,
        iv: 0.35,
        dte: 30,
      });

      // Breakeven = 184, current = 185
      // Cushion = (185 - 184) / 185 = 0.5%
      expect(metrics.cushion).toBeCloseTo(0.5, 1);
    });

    test('Negative cushion (price below breakeven)', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 182,
        longStrike: 180,
        shortStrike: 185,
        estimatedDebit: 4.0,
        iv: 0.35,
        dte: 30,
      });

      // Breakeven = 184, current = 182
      // Cushion = (182 - 184) / 182 = -1.1%
      expect(metrics.cushion).toBeLessThan(0);
    });
  });

  describe('Return on Risk', () => {
    test('High return spread (25%+)', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 100,
        longStrike: 95,
        shortStrike: 100,
        estimatedDebit: 4.0, // 20% max profit
        iv: 0.3,
        dte: 30,
      });

      expect(metrics.returnOnRisk).toBe(25); // $1 profit / $4 risk
    });

    test('Low return spread (<15%)', () => {
      const metrics = calculateSpreadMetrics({
        currentPrice: 100,
        longStrike: 90,
        shortStrike: 95,
        estimatedDebit: 4.5, // Only $0.50 max profit
        iv: 0.3,
        dte: 30,
      });

      expect(metrics.returnOnRisk).toBeCloseTo(11.1, 1); // $0.50 / $4.50
    });
  });
});

describe('Probability of Profit (PoP)', () => {
  describe('PoP Formula Verification', () => {
    test('Price well above breakeven = high PoP', () => {
      const pop = calculatePoP(200, 180, 0.35, 30);
      expect(pop).toBeGreaterThan(70); // Should be high probability
    });

    test('Price at breakeven = ~50% PoP', () => {
      const pop = calculatePoP(180, 180, 0.35, 30);
      expect(pop).toBeGreaterThan(45);
      expect(pop).toBeLessThan(55);
    });

    test('Price below breakeven = low PoP', () => {
      const pop = calculatePoP(175, 180, 0.35, 30);
      expect(pop).toBeLessThan(45);
    });
  });

  describe('IV Impact on PoP', () => {
    test('Higher IV = lower PoP (more uncertainty)', () => {
      const popLowIV = calculatePoP(190, 185, 0.2, 30);
      const popHighIV = calculatePoP(190, 185, 0.5, 30);

      expect(popLowIV).toBeGreaterThan(popHighIV);
    });

    test('Very low IV = higher PoP', () => {
      const pop = calculatePoP(190, 185, 0.15, 30);
      expect(pop).toBeGreaterThan(70);
    });
  });

  describe('DTE Impact on PoP', () => {
    test('Longer DTE = lower PoP (more time for things to go wrong)', () => {
      const popShortDTE = calculatePoP(190, 185, 0.35, 7);
      const popLongDTE = calculatePoP(190, 185, 0.35, 60);

      expect(popShortDTE).toBeGreaterThan(popLongDTE);
    });

    test('Very short DTE = higher PoP', () => {
      const pop = calculatePoP(190, 185, 0.35, 3);
      expect(pop).toBeGreaterThan(75);
    });
  });

  describe('PoP Edge Cases', () => {
    test('Zero IV defaults to cushion-based estimate', () => {
      const popAbove = calculatePoP(200, 180, 0, 30);
      const popBelow = calculatePoP(170, 180, 0, 30);

      expect(popAbove).toBe(75); // Default when above breakeven
      expect(popBelow).toBe(25); // Default when below breakeven
    });

    test('Zero DTE defaults to cushion-based estimate', () => {
      const pop = calculatePoP(200, 180, 0.35, 0);
      expect(pop).toBe(75);
    });

    test('PoP capped at 95%', () => {
      const pop = calculatePoP(300, 180, 0.1, 1); // Way above breakeven, low IV, short DTE
      expect(pop).toBeLessThanOrEqual(95);
    });

    test('PoP floored at 5%', () => {
      const pop = calculatePoP(150, 200, 0.1, 1); // Way below breakeven
      expect(pop).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('Real-World Spread Scenarios', () => {
  test('NVDA spread from debug output', () => {
    // Based on actual NVDA data from debug log
    const metrics = calculateSpreadMetrics({
      currentPrice: 188.61,
      longStrike: 170,
      shortStrike: 175,
      estimatedDebit: 4.18,
      iv: 0.344, // 34.4%
      dte: 28,
    });

    expect(metrics.spreadWidth).toBe(5);
    expect(metrics.maxProfit).toBe(0.82);
    expect(metrics.breakeven).toBe(174.18);
    expect(metrics.cushion).toBeCloseTo(7.6, 0); // ~7.7%
    expect(metrics.returnOnRisk).toBeCloseTo(19.6, 0); // ~20%
    expect(metrics.pop).toBeGreaterThan(55); // Should be decent PoP
  });

  test('AVGO spread from chat conversation', () => {
    const metrics = calculateSpreadMetrics({
      currentPrice: 352.13,
      longStrike: 340,
      shortStrike: 345,
      estimatedDebit: 3.3,
      iv: 0.404, // 40.4%
      dte: 30,
    });

    expect(metrics.spreadWidth).toBe(5);
    expect(metrics.maxProfit).toBe(1.7);
    expect(metrics.breakeven).toBe(343.3);
    expect(metrics.cushion).toBeCloseTo(2.5, 0);
    expect(metrics.pop).toBeGreaterThan(50);
  });
});

describe('Risk/Reward Validation', () => {
  test('Minimum acceptable R/R (10%+)', () => {
    const metrics = calculateSpreadMetrics({
      currentPrice: 100,
      longStrike: 95,
      shortStrike: 100,
      estimatedDebit: 4.5, // 11.1% return ($0.50 / $4.50)
      iv: 0.3,
      dte: 30,
    });

    expect(metrics.returnOnRisk).toBeGreaterThanOrEqual(10);
  });

  test('Reject spreads with <10% R/R', () => {
    const metrics = calculateSpreadMetrics({
      currentPrice: 100,
      longStrike: 95,
      shortStrike: 100,
      estimatedDebit: 4.6, // Only ~8.7% return
      iv: 0.3,
      dte: 30,
    });

    expect(metrics.returnOnRisk).toBeLessThan(10);
    // In real code, this spread would be rejected
  });
});
