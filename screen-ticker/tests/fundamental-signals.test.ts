/**
 * Tests for Fundamental Signals
 */
import { describe, test, expect } from 'bun:test';
import { calculateFundamentalSignals } from '../src/signals/fundamental.ts';
import type { QuoteSummary } from '../src/types/index.ts';

// Helper to create mock QuoteSummary for fundamental tests
function createFundamentalMock(
  overrides: Partial<{
    pegRatio: number;
    freeCashflow: number;
    enterpriseValue: number;
    enterpriseToEbitda: number;
    ebitda: number;
    earningsGrowth: number;
    revenueGrowth: number;
    profitMargins: number;
    returnOnEquity: number;
    marketCap: number;
    financialCurrency: string;
  }> = {}
): QuoteSummary {
  return {
    defaultKeyStatistics: {
      pegRatio:
        overrides.pegRatio !== undefined
          ? { raw: overrides.pegRatio }
          : undefined,
      enterpriseValue: { raw: overrides.enterpriseValue ?? 100_000_000_000 },
      enterpriseToEbitda:
        overrides.enterpriseToEbitda !== undefined
          ? { raw: overrides.enterpriseToEbitda }
          : undefined,
    },
    financialData: {
      freeCashflow: { raw: overrides.freeCashflow ?? 5_000_000_000 },
      ebitda: { raw: overrides.ebitda ?? 15_000_000_000 },
      earningsGrowth: { raw: overrides.earningsGrowth ?? 0.1 },
      revenueGrowth: { raw: overrides.revenueGrowth ?? 0.08 },
      profitMargins: { raw: overrides.profitMargins ?? 0.15 },
      returnOnEquity: { raw: overrides.returnOnEquity ?? 0.12 },
      financialCurrency: overrides.financialCurrency ?? 'USD',
    },
    price: {
      marketCap: { raw: overrides.marketCap ?? 100_000_000_000 },
    },
  } as QuoteSummary;
}

describe('calculateFundamentalSignals', () => {
  describe('PEG Ratio (Graduated)', () => {
    test('attractive PEG (<1.0) gets points', () => {
      const summary = createFundamentalMock({ pegRatio: 0.8 });
      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const pegSignal = result.signals.find((s) => s.name === 'PEG Attractive');

      expect(pegSignal).toBeDefined();
      expect(pegSignal!.points).toBeGreaterThan(0);
    });

    test('reasonable PEG (1.5-2.0) gets points', () => {
      const summary = createFundamentalMock({ pegRatio: 1.7 }); // Between 1.5 and 2.0
      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const pegSignal = result.signals.find((s) => s.name === 'PEG Reasonable');

      expect(pegSignal).toBeDefined();
      expect(pegSignal!.points).toBeGreaterThan(0);
    });

    test('no signal for high PEG (>2.0)', () => {
      const summary = createFundamentalMock({ pegRatio: 2.5 });
      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const pegSignal = result.signals.find((s) => s.name.includes('PEG'));

      expect(pegSignal).toBeUndefined();
    });
  });

  describe('FCF Yield', () => {
    test('high FCF yield (>5%) gets points', () => {
      // 8B FCF / 100B market cap = 8% yield
      const summary = createFundamentalMock({
        freeCashflow: 8_000_000_000,
        marketCap: 100_000_000_000,
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const fcfSignal = result.signals.find((s) => s.name === 'High FCF Yield');

      expect(fcfSignal).toBeDefined();
      expect(fcfSignal!.points).toBeGreaterThan(0);
    });

    test('positive FCF yield (3-5%) gets points', () => {
      // 4B FCF / 100B market cap = 4% yield
      const summary = createFundamentalMock({
        freeCashflow: 4_000_000_000,
        marketCap: 100_000_000_000,
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const fcfSignal = result.signals.find(
        (s) => s.name === 'Positive FCF Yield'
      );

      expect(fcfSignal).toBeDefined();
      expect(fcfSignal!.points).toBeGreaterThan(0);
    });

    test('no signal for negative FCF', () => {
      const summary = createFundamentalMock({
        freeCashflow: -1_000_000_000,
        marketCap: 100_000_000_000,
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const fcfSignal = result.signals.find((s) => s.name.includes('FCF'));

      expect(fcfSignal).toBeUndefined();
    });
  });

  describe('EV/EBITDA', () => {
    test('low EV/EBITDA (<15) gets points', () => {
      // Use enterpriseToEbitda directly (this is what Yahoo provides)
      const summary = createFundamentalMock({
        enterpriseToEbitda: 10, // < 15 threshold
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const evSignal = result.signals.find((s) => s.name === 'Low EV/EBITDA');

      expect(evSignal).toBeDefined();
      expect(evSignal!.points).toBeGreaterThan(0);
    });

    test('reasonable EV/EBITDA (15-20) gets partial points', () => {
      const summary = createFundamentalMock({
        enterpriseToEbitda: 17, // Between 15 and 20
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const evSignal = result.signals.find(
        (s) => s.name === 'Reasonable EV/EBITDA'
      );

      expect(evSignal).toBeDefined();
      expect(evSignal!.points).toBeGreaterThan(0);
    });

    test('no signal for high EV/EBITDA (>20)', () => {
      const summary = createFundamentalMock({
        enterpriseToEbitda: 25, // > 20 threshold
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const evSignal = result.signals.find((s) => s.name.includes('EV/EBITDA'));

      expect(evSignal).toBeUndefined();
    });
  });

  describe('Growth Metrics', () => {
    test('strong earnings growth (>35%) gets 5 points', () => {
      const summary = createFundamentalMock({ earningsGrowth: 0.5 }); // 50%

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const growthSignal = result.signals.find(
        (s) => s.name === 'Strong Earnings Growth'
      );

      expect(growthSignal).toBeDefined();
      expect(growthSignal!.points).toBe(5);
    });

    test('revenue growth (>15%) gets points', () => {
      const summary = createFundamentalMock({
        revenueGrowth: 0.25, // 25%
        earningsGrowth: 0.05, // Don't trigger earnings growth
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const revenueSignal = result.signals.find(
        (s) => s.name === 'Revenue Growing'
      );

      expect(revenueSignal).toBeDefined();
    });
  });

  describe('Quality Metrics', () => {
    test('strong profit margins (>20%) gets 5 points', () => {
      const summary = createFundamentalMock({ profitMargins: 0.25 }); // 25%

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const marginsSignal = result.signals.find(
        (s) => s.name === 'Strong Profit Margins'
      );

      expect(marginsSignal).toBeDefined();
      expect(marginsSignal!.points).toBe(5);
    });

    test('high ROE (>20%) gets points', () => {
      const summary = createFundamentalMock({ returnOnEquity: 0.3 }); // 30%

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      const roeSignal = result.signals.find((s) => s.name === 'High ROE');

      expect(roeSignal).toBeDefined();
      expect(roeSignal!.points).toBeGreaterThan(0);
    });
  });

  describe('Score Capping', () => {
    test('score is capped at 30', () => {
      // Create summary that would score > 30
      const summary = createFundamentalMock({
        pegRatio: 0.5, // 8 pts
        freeCashflow: 10_000_000_000, // ~6 pts
        marketCap: 100_000_000_000,
        ebitda: 15_000_000_000, // ~5 pts
        earningsGrowth: 0.6, // 5 pts
        revenueGrowth: 0.3, // 3 pts
        profitMargins: 0.3, // 5 pts
        returnOnEquity: 0.35, // 5 pts
        // Total would be ~37 pts
      });

      const result = calculateFundamentalSignals(
        summary,
        summary.price?.marketCap?.raw ?? 0
      );

      expect(result.score).toBeLessThanOrEqual(30);
    });
  });
});
