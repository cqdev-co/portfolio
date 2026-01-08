/**
 * Tests for Support/Resistance Detection
 */
import { describe, test, expect } from 'bun:test';
import {
  detectSupportResistance,
  findNearestSupport,
  isNearSupport,
} from '../src/utils/support-resistance.ts';
import type { HistoricalData } from '../src/types/index.ts';

// Helper to create mock historical data
function createMockData(prices: number[]): HistoricalData[] {
  return prices.map((price, i) => ({
    date: new Date(Date.now() - (prices.length - i) * 86400000),
    open: price * 0.99,
    high: price * 1.02,
    low: price * 0.98,
    close: price,
    volume: 1000000,
  }));
}

// Create data with clear support/resistance patterns
function createPatternedData(): HistoricalData[] {
  // Prices that bounce off $100 support and $120 resistance
  const prices = [
    105,
    108,
    110,
    115,
    118,
    120,
    119,
    115,
    110,
    105, // down from 120
    100,
    102,
    105,
    108,
    112,
    118,
    120,
    118,
    115,
    110, // bounce at 100
    105,
    100,
    103,
    108,
    115,
    120,
    117,
    112,
    108,
    103, // another bounce
    100,
    105,
    110,
    115,
    118, // third bounce
  ];
  return createMockData(prices);
}

describe('detectSupportResistance', () => {
  test('returns empty array for insufficient data', () => {
    const shortData = createMockData([100, 105, 110]);
    const levels = detectSupportResistance(shortData);
    expect(levels).toEqual([]);
  });

  test('detects support levels at local minima', () => {
    const data = createPatternedData();
    const levels = detectSupportResistance(data);

    const supports = levels.filter((l) => l.type === 'support');
    expect(supports.length).toBeGreaterThan(0);

    // Should detect support around $100 (multiple touches)
    const support100 = supports.find((l) => l.price >= 98 && l.price <= 102);
    expect(support100).toBeDefined();
    expect(support100!.strength).toBeGreaterThanOrEqual(2);
  });

  test('detects resistance levels at local maxima', () => {
    const data = createPatternedData();
    const levels = detectSupportResistance(data);

    const resistances = levels.filter((l) => l.type === 'resistance');
    expect(resistances.length).toBeGreaterThan(0);

    // Should detect resistance around $120 (multiple touches)
    const resistance120 = resistances.find(
      (l) => l.price >= 118 && l.price <= 124
    );
    expect(resistance120).toBeDefined();
    expect(resistance120!.strength).toBeGreaterThanOrEqual(2);
  });

  test('groups nearby levels within tolerance', () => {
    // Create data with levels at 100, 101, 99 (should group)
    const prices = [
      105,
      103,
      100,
      102,
      105,
      108,
      110, // low at 100
      108,
      105,
      101,
      103,
      106,
      109,
      112, // low at 101
      110,
      107,
      99,
      102,
      105,
      108,
      110, // low at 99
    ];
    const data = createMockData(prices);
    const levels = detectSupportResistance(data, 0.03); // 3% tolerance

    const supports = levels.filter((l) => l.type === 'support');
    // Should group into ~1 support level
    expect(supports.length).toBeLessThanOrEqual(2);
  });

  test('filters levels by minimum touches', () => {
    const data = createPatternedData();

    // Require 3 touches
    const strictLevels = detectSupportResistance(data, 0.02, 3);

    // Require only 1 touch
    const looseLevels = detectSupportResistance(data, 0.02, 1);

    expect(strictLevels.length).toBeLessThanOrEqual(looseLevels.length);
  });
});

describe('findNearestSupport', () => {
  test('finds nearest support below current price', () => {
    const data = createPatternedData();
    const currentPrice = 115;

    const nearest = findNearestSupport(currentPrice, data);

    expect(nearest).not.toBeNull();
    expect(nearest!.level).toBeLessThan(currentPrice);
  });

  test('returns null when no support below price', () => {
    const data = createMockData([100, 105, 110, 115, 120]);
    const currentPrice = 95; // Below all data

    const nearest = findNearestSupport(currentPrice, data);

    expect(nearest).toBeNull();
  });

  test('calculates correct distance percentage', () => {
    const data = createPatternedData();
    const currentPrice = 110;

    const nearest = findNearestSupport(currentPrice, data);

    if (nearest) {
      const expectedDistance = (currentPrice - nearest.level) / currentPrice;
      expect(nearest.distance).toBeCloseTo(expectedDistance, 4);
    }
  });
});

describe('isNearSupport', () => {
  test('returns true when within threshold', () => {
    const data = createPatternedData();
    const currentPrice = 102; // Just above $100 support

    const result = isNearSupport(currentPrice, data, 0.05); // 5% threshold

    expect(result).toBe(true);
  });

  test('returns false when far from support', () => {
    const data = createPatternedData();
    const currentPrice = 115; // Far from $100 support

    const result = isNearSupport(currentPrice, data, 0.03); // 3% threshold

    expect(result).toBe(false);
  });

  test('respects custom threshold', () => {
    const data = createPatternedData();
    const currentPrice = 105; // 5% above $100 support

    expect(isNearSupport(currentPrice, data, 0.03)).toBe(false); // 3% - too far
    expect(isNearSupport(currentPrice, data, 0.1)).toBe(true); // 10% - close
  });
});
