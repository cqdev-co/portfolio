/**
 * Integration Tests - End-to-End Validation
 *
 * These tests hit real Yahoo Finance APIs and are ALWAYS SKIPPED by default.
 * They're only for manual debugging - run with:
 *   SKIP_INTEGRATION=false bun test tests/integration.test.ts
 *
 * This service is not production-critical, so we don't need deep integration testing.
 */
import { describe, test, expect } from 'bun:test';
import { yahooProvider } from '../src/providers/yahoo.ts';
import { calculateTechnicalSignals } from '../src/signals/technical.ts';
import { calculateFundamentalSignals } from '../src/signals/fundamental.ts';
import { calculateAnalystSignals } from '../src/signals/analyst.ts';
import { detectSupportResistance } from '../src/utils/support-resistance.ts';

// Always skip unless explicitly enabled with SKIP_INTEGRATION=false
// These tests are for manual debugging only
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION !== 'false';

// Longer timeout for external API calls (30 seconds)
const API_TIMEOUT = 30000;

describe.skipIf(SKIP_INTEGRATION)('Integration Tests', () => {
  describe('Yahoo Provider', () => {
    test(
      'fetches quote data for valid symbol',
      async () => {
        const quote = await yahooProvider.getQuote('AAPL');

        expect(quote).not.toBeNull();
        expect(quote!.regularMarketPrice).toBeGreaterThan(0);
        expect(quote!.symbol).toBe('AAPL');
      },
      { timeout: API_TIMEOUT }
    );

    test(
      'fetches historical data with correct range',
      async () => {
        const historical = await yahooProvider.getHistorical('AAPL');

        expect(historical.length).toBeGreaterThan(200);
        expect(historical[0]).toHaveProperty('date');
        expect(historical[0]).toHaveProperty('close');
      },
      { timeout: API_TIMEOUT }
    );

    test(
      'fetches quote summary with all required modules',
      async () => {
        const summary = await yahooProvider.getQuoteSummary('AAPL');

        expect(summary).not.toBeNull();
        expect(summary!.financialData).toBeDefined();
      },
      { timeout: API_TIMEOUT }
    );

    test(
      'handles invalid symbol gracefully',
      async () => {
        const quote = await yahooProvider.getQuote('INVALID_SYMBOL_XYZ123');
        expect(quote).toBeNull();
      },
      { timeout: API_TIMEOUT }
    );
  });

  describe('Signal Calculations', () => {
    test(
      'calculates all signal types for real data',
      async () => {
        const [quote, summary, historical] = await Promise.all([
          yahooProvider.getQuote('AAPL'),
          yahooProvider.getQuoteSummary('AAPL'),
          yahooProvider.getHistorical('AAPL'),
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
      },
      { timeout: API_TIMEOUT }
    );
  });

  describe('Support/Resistance Detection', () => {
    test(
      'detects levels for real stock data',
      async () => {
        const historical = await yahooProvider.getHistorical('AAPL');
        const levels = detectSupportResistance(historical);

        expect(levels.length).toBeGreaterThan(0);
        expect(levels.every((l) => l.price > 0)).toBe(true);
      },
      { timeout: API_TIMEOUT }
    );
  });
});
