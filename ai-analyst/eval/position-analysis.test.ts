/**
 * Position Analysis Calculation Tests
 *
 * Tests the accuracy of P&L calculations for existing positions.
 * These tests ensure we never repeat the "80% vs 27.5%" calculation error.
 */

import { describe, test, expect } from 'bun:test';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface PositionParams {
  longStrike: number;
  shortStrike: number;
  costBasis: number; // Per share (e.g., 3.62)
  currentValue: number; // Per share (e.g., 4.00)
  currentPrice: number; // Stock price
}

interface CalculatedMetrics {
  spreadWidth: number;
  maxValue: number;
  maxProfit: number;
  currentProfit: number;
  profitCapturedPct: number;
  remainingProfit: number;
  cushionToShortStrike: number;
  cushionPct: number;
  breakeven: number;
}

/**
 * Calculate position metrics (mirrors the logic in yahoo.ts)
 * This is a pure function for testing - no API calls
 */
function calculatePositionMetrics(params: PositionParams): CalculatedMetrics {
  const { longStrike, shortStrike, costBasis, currentValue, currentPrice } =
    params;

  const spreadWidth = shortStrike - longStrike;
  const maxValue = spreadWidth;
  const maxProfit = maxValue - costBasis;
  const currentProfit = currentValue - costBasis;
  const profitCapturedPct =
    maxProfit > 0 ? Math.round((currentProfit / maxProfit) * 1000) / 10 : 0;
  const remainingProfit = maxProfit - currentProfit;
  const cushionToShortStrike = currentPrice - shortStrike;
  const cushionPct =
    Math.round((cushionToShortStrike / currentPrice) * 1000) / 10;
  const breakeven = longStrike + costBasis;

  return {
    spreadWidth,
    maxValue,
    maxProfit,
    currentProfit,
    profitCapturedPct,
    remainingProfit,
    cushionToShortStrike,
    cushionPct,
    breakeven,
  };
}

// ============================================================================
// TEST CASES
// ============================================================================

describe('Position Analysis Calculations', () => {
  describe('P&L Calculations', () => {
    test('AVGO 320/325 - The Original Bug Case', () => {
      // This is the exact case that caused the 80% vs 27.5% confusion
      const metrics = calculatePositionMetrics({
        longStrike: 320,
        shortStrike: 325,
        costBasis: 3.62,
        currentValue: 4.0,
        currentPrice: 352.13,
      });

      // Spread basics
      expect(metrics.spreadWidth).toBe(5);
      expect(metrics.maxValue).toBe(5);

      // P&L - THE CRITICAL CALCULATIONS
      expect(metrics.maxProfit).toBeCloseTo(1.38, 2); // $5.00 - $3.62 = $1.38
      expect(metrics.currentProfit).toBeCloseTo(0.38, 2); // $4.00 - $3.62 = $0.38
      expect(metrics.profitCapturedPct).toBeCloseTo(27.5, 1); // NOT 80%!
      expect(metrics.remainingProfit).toBeCloseTo(1.0, 2); // $1.38 - $0.38 = $1.00

      // Risk metrics
      expect(metrics.cushionToShortStrike).toBeCloseTo(27.13, 2);
      expect(metrics.cushionPct).toBeCloseTo(7.7, 1);
      expect(metrics.breakeven).toBe(323.62);
    });

    test('Position at max profit (both strikes deep ITM)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 170,
        shortStrike: 175,
        costBasis: 4.2,
        currentValue: 5.0, // At max value
        currentPrice: 200, // Well above both strikes
      });

      expect(metrics.maxProfit).toBeCloseTo(0.8, 2); // $5.00 - $4.20
      expect(metrics.currentProfit).toBeCloseTo(0.8, 2);
      expect(metrics.profitCapturedPct).toBeCloseTo(100, 0); // Full profit captured
      expect(metrics.remainingProfit).toBeCloseTo(0, 2);
    });

    test('Position at breakeven (no profit yet)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 180,
        shortStrike: 185,
        costBasis: 4.0,
        currentValue: 4.0, // Worth exactly what we paid
        currentPrice: 186,
      });

      expect(metrics.maxProfit).toBe(1.0);
      expect(metrics.currentProfit).toBe(0);
      expect(metrics.profitCapturedPct).toBe(0);
      expect(metrics.remainingProfit).toBe(1.0);
    });

    test('Position at a loss', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 190,
        shortStrike: 195,
        costBasis: 4.5,
        currentValue: 3.0, // Worth less than we paid
        currentPrice: 192,
      });

      expect(metrics.maxProfit).toBe(0.5);
      expect(metrics.currentProfit).toBe(-1.5); // Loss
      expect(metrics.profitCapturedPct).toBeLessThan(0); // Negative
      expect(metrics.remainingProfit).toBe(2.0); // Would need to gain $2 to hit max
    });

    test('Narrow spread ($2.50 width)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 150,
        shortStrike: 152.5,
        costBasis: 2.0,
        currentValue: 2.25,
        currentPrice: 155,
      });

      expect(metrics.spreadWidth).toBe(2.5);
      expect(metrics.maxProfit).toBe(0.5);
      expect(metrics.currentProfit).toBe(0.25);
      expect(metrics.profitCapturedPct).toBe(50);
    });

    test('Wide spread ($10 width)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 100,
        shortStrike: 110,
        costBasis: 8.5,
        currentValue: 9.5,
        currentPrice: 115,
      });

      expect(metrics.spreadWidth).toBe(10);
      expect(metrics.maxProfit).toBe(1.5);
      expect(metrics.currentProfit).toBe(1.0);
      expect(metrics.profitCapturedPct).toBeCloseTo(66.7, 1);
    });
  });

  describe('Cushion Calculations', () => {
    test('Stock well above short strike', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 100,
        shortStrike: 105,
        costBasis: 4.0,
        currentValue: 4.8,
        currentPrice: 120, // $15 above short strike
      });

      expect(metrics.cushionToShortStrike).toBe(15);
      expect(metrics.cushionPct).toBe(12.5); // 15/120 * 100
    });

    test('Stock just above short strike (thin cushion)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 100,
        shortStrike: 105,
        costBasis: 4.0,
        currentValue: 4.5,
        currentPrice: 107, // Only $2 above short strike
      });

      expect(metrics.cushionToShortStrike).toBe(2);
      expect(metrics.cushionPct).toBeCloseTo(1.9, 1);
    });

    test('Stock below short strike (at risk)', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 100,
        shortStrike: 105,
        costBasis: 4.0,
        currentValue: 2.5,
        currentPrice: 103, // Below short strike
      });

      expect(metrics.cushionToShortStrike).toBe(-2); // Negative cushion
      expect(metrics.cushionPct).toBeLessThan(0);
    });
  });

  describe('Breakeven Calculations', () => {
    test('Standard breakeven', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 180,
        shortStrike: 185,
        costBasis: 3.5,
        currentValue: 4.0,
        currentPrice: 190,
      });

      expect(metrics.breakeven).toBe(183.5); // 180 + 3.50
    });

    test('High cost basis breakeven', () => {
      const metrics = calculatePositionMetrics({
        longStrike: 200,
        shortStrike: 205,
        costBasis: 4.8,
        currentValue: 4.9,
        currentPrice: 210,
      });

      expect(metrics.breakeven).toBe(204.8); // Very close to short strike
    });
  });
});

describe('Value Capture vs Profit Capture', () => {
  test('Demonstrates the common confusion', () => {
    // Position worth $4.00 on a $5.00 max spread
    // Cost basis: $3.62

    const positionValue = 4.0;
    const maxValue = 5.0;
    const costBasis = 3.62;

    // WRONG WAY (the bug)
    const wrongValueCapture = (positionValue / maxValue) * 100; // 80%

    // RIGHT WAY
    const maxProfit = maxValue - costBasis; // $1.38
    const currentProfit = positionValue - costBasis; // $0.38
    const rightProfitCapture = (currentProfit / maxProfit) * 100; // 27.5%

    expect(wrongValueCapture).toBe(80); // This is what the AI said
    expect(rightProfitCapture).toBeCloseTo(27.5, 1); // This is correct

    // They are NOT the same!
    expect(wrongValueCapture).not.toBe(rightProfitCapture);
  });
});

describe('Edge Cases', () => {
  test('Zero cost basis (free spread somehow)', () => {
    const metrics = calculatePositionMetrics({
      longStrike: 100,
      shortStrike: 105,
      costBasis: 0,
      currentValue: 3.0,
      currentPrice: 110,
    });

    expect(metrics.maxProfit).toBe(5);
    expect(metrics.currentProfit).toBe(3);
    expect(metrics.profitCapturedPct).toBe(60);
  });

  test('Cost basis equals max value (no profit possible)', () => {
    const metrics = calculatePositionMetrics({
      longStrike: 100,
      shortStrike: 105,
      costBasis: 5.0, // Paid full spread width
      currentValue: 5.0,
      currentPrice: 120,
    });

    expect(metrics.maxProfit).toBe(0);
    expect(metrics.currentProfit).toBe(0);
    expect(metrics.profitCapturedPct).toBe(0); // Division by zero handled
  });

  test('Very small spread ($1 width)', () => {
    const metrics = calculatePositionMetrics({
      longStrike: 50,
      shortStrike: 51,
      costBasis: 0.8,
      currentValue: 0.95,
      currentPrice: 52,
    });

    expect(metrics.spreadWidth).toBe(1);
    expect(metrics.maxProfit).toBeCloseTo(0.2, 2);
    expect(metrics.currentProfit).toBeCloseTo(0.15, 2);
    expect(metrics.profitCapturedPct).toBeCloseTo(75, 0);
  });
});
