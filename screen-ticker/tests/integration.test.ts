/**
 * Integration Tests - End-to-End Validation
 * Tests real API data against expected behavior
 */
import { describe, test, expect } from 'bun:test';
import { yahooProvider } from '../src/providers/yahoo.ts';
import { calculateTechnicalSignals } from '../src/signals/technical.ts';
import { calculateFundamentalSignals } from '../src/signals/fundamental.ts';
import { calculateAnalystSignals } from '../src/signals/analyst.ts';
import { detectSupportResistance } from '../src/utils/support-resistance.ts';

// Skip these tests in CI (require network)
const SKIP_INTEGRATION = process.env.CI === 'true';

describe.skipIf(SKIP_INTEGRATION)('Integration Tests', () => {
  describe('Yahoo Provider', () => {
    test('fetches quote data for valid symbol', async () => {
      const quote = await yahooProvider.getQuote('AAPL');

      expect(quote).not.toBeNull();
      expect(quote!.regularMarketPrice).toBeGreaterThan(0);
      expect(quote!.symbol).toBe('AAPL');
    });

    test('fetches historical data with correct range', async () => {
      const historical = await yahooProvider.getHistorical('AAPL');

      expect(historical.length).toBeGreaterThan(200);
      expect(historical[0]).toHaveProperty('date');
      expect(historical[0]).toHaveProperty('open');
      expect(historical[0]).toHaveProperty('high');
      expect(historical[0]).toHaveProperty('low');
      expect(historical[0]).toHaveProperty('close');
      expect(historical[0]).toHaveProperty('volume');
    });

    test('fetches quote summary with all required modules', async () => {
      const summary = await yahooProvider.getQuoteSummary('AAPL');

      expect(summary).not.toBeNull();
      expect(summary!.financialData).toBeDefined();
      expect(summary!.defaultKeyStatistics).toBeDefined();
      expect(summary!.recommendationTrend).toBeDefined();
    });

    test('handles invalid symbol gracefully', async () => {
      const quote = await yahooProvider.getQuote('INVALID_SYMBOL_XYZ123');

      expect(quote).toBeNull();
    });
  });

  describe('Technical Signals Calculation', () => {
    test('calculates signals for real stock data', async () => {
      const quote = await yahooProvider.getQuote('AAPL');
      const historical = await yahooProvider.getHistorical('AAPL');

      expect(quote).not.toBeNull();
      expect(historical.length).toBeGreaterThan(0);

      const result = calculateTechnicalSignals(quote!, historical);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(Array.isArray(result.signals)).toBe(true);
    });

    test('technical score matches sum of signal points', async () => {
      const quote = await yahooProvider.getQuote('MSFT');
      const historical = await yahooProvider.getHistorical('MSFT');

      if (!quote) return;

      const result = calculateTechnicalSignals(quote, historical);

      const sumOfPoints = result.signals.reduce((sum, s) => sum + s.points, 0);

      // Score should equal sum or be capped at 50
      expect(result.score).toBe(Math.min(sumOfPoints, 50));
    });
  });

  describe('Fundamental Signals Calculation', () => {
    test('calculates signals for real stock data', async () => {
      const summary = await yahooProvider.getQuoteSummary('AAPL');

      expect(summary).not.toBeNull();

      const marketCap = summary!.price?.marketCap?.raw ?? 0;
      const result = calculateFundamentalSignals(summary!, marketCap);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(30);
      expect(Array.isArray(result.signals)).toBe(true);
    });

    test('fundamental score matches sum of signal points', async () => {
      const summary = await yahooProvider.getQuoteSummary('GOOGL');

      if (!summary) return;

      const marketCap = summary.price?.marketCap?.raw ?? 0;
      const result = calculateFundamentalSignals(summary, marketCap);

      const sumOfPoints = result.signals.reduce((sum, s) => sum + s.points, 0);

      expect(result.score).toBe(Math.min(sumOfPoints, 30));
    });
  });

  describe('Analyst Signals Calculation', () => {
    test('calculates signals for real stock data', async () => {
      const summary = await yahooProvider.getQuoteSummary('AAPL');

      expect(summary).not.toBeNull();

      const result = calculateAnalystSignals(summary!);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(20);
      expect(typeof result.upsidePotential).toBe('number');
    });

    test('analyst score matches sum of signal points', async () => {
      const summary = await yahooProvider.getQuoteSummary('NVDA');

      if (!summary) return;

      const result = calculateAnalystSignals(summary);

      const sumOfPoints = result.signals.reduce((sum, s) => sum + s.points, 0);

      expect(result.score).toBe(Math.min(sumOfPoints, 20));
    });
  });

  describe('Support/Resistance Detection', () => {
    test('detects levels for real stock data', async () => {
      const historical = await yahooProvider.getHistorical('HOOD');

      const levels = detectSupportResistance(historical);

      expect(levels.length).toBeGreaterThan(0);
      expect(levels.every((l) => l.price > 0)).toBe(true);
      expect(levels.every((l) => l.strength >= 2)).toBe(true);
    });

    test('support levels are below current price', async () => {
      const historical = await yahooProvider.getHistorical('AAPL');
      const currentPrice = historical[historical.length - 1]?.close ?? 0;

      const levels = detectSupportResistance(historical);
      const supports = levels.filter(
        (l) => l.type === 'support' && l.price < currentPrice
      );

      // Should find at least one support level below price
      expect(supports.length).toBeGreaterThan(0);
    });
  });

  describe('Score Bounds Validation', () => {
    const testSymbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'F'];

    for (const symbol of testSymbols) {
      test(`${symbol} scores are within valid bounds`, async () => {
        const [quote, summary, historical] = await Promise.all([
          yahooProvider.getQuote(symbol),
          yahooProvider.getQuoteSummary(symbol),
          yahooProvider.getHistorical(symbol),
        ]);

        if (!quote || !summary) return;

        const technical = calculateTechnicalSignals(quote, historical);
        const fundamental = calculateFundamentalSignals(
          summary,
          summary.price?.marketCap?.raw ?? 0
        );
        const analyst = calculateAnalystSignals(summary);

        // Validate bounds
        expect(technical.score).toBeGreaterThanOrEqual(0);
        expect(technical.score).toBeLessThanOrEqual(50);
        expect(fundamental.score).toBeGreaterThanOrEqual(0);
        expect(fundamental.score).toBeLessThanOrEqual(30);
        expect(analyst.score).toBeGreaterThanOrEqual(0);
        expect(analyst.score).toBeLessThanOrEqual(20);

        // Total should be <= 100
        const total = technical.score + fundamental.score + analyst.score;
        expect(total).toBeLessThanOrEqual(100);
      });
    }
  });
});
