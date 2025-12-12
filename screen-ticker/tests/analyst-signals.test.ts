/**
 * Tests for Analyst Signals
 */
import { describe, test, expect } from "bun:test";
import { calculateAnalystSignals } from "../src/signals/analyst.ts";
import type { QuoteSummary } from "../src/types/index.ts";

// Helper to create mock QuoteSummary
function createMockSummary(
  overrides: Partial<QuoteSummary> = {}
): QuoteSummary {
  return {
    financialData: {
      currentPrice: { raw: 100 },
      targetMeanPrice: { raw: 125 }, // 25% upside
      numberOfAnalystOpinions: { raw: 25 },
      ...overrides.financialData,
    },
    recommendationTrend: {
      trend: [{
        strongBuy: 10,
        buy: 15,
        hold: 5,
        sell: 1,
        strongSell: 0,
      }],
      ...overrides.recommendationTrend,
    },
    earningsTrend: {
      trend: [
        { period: "0q", growth: { raw: 0.15 } },
        { period: "+1q", growth: { raw: 0.20 } },
      ],
      ...overrides.earningsTrend,
    },
    upgradeDowngradeHistory: {
      history: [],
      ...overrides.upgradeDowngradeHistory,
    },
    ...overrides,
  } as QuoteSummary;
}

describe("calculateAnalystSignals", () => {
  describe("Upside Potential (Graduated)", () => {
    test("high upside (>=25%) gets 8 points", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 130 }, // 30% upside
          numberOfAnalystOpinions: { raw: 5 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const upsideSignal = result.signals.find(
        s => s.name === "High Upside Potential"
      );

      expect(upsideSignal).toBeDefined();
      expect(upsideSignal!.points).toBe(8);
    });

    test("moderate upside (15-25%) gets 5 points", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 118 }, // 18% upside
          numberOfAnalystOpinions: { raw: 5 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const upsideSignal = result.signals.find(
        s => s.name === "Moderate Upside"
      );

      expect(upsideSignal).toBeDefined();
      expect(upsideSignal!.points).toBe(5);
    });

    test("some upside (10-15%) gets 3 points", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 112 }, // 12% upside
          numberOfAnalystOpinions: { raw: 5 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const upsideSignal = result.signals.find(
        s => s.name === "Some Upside"
      );

      expect(upsideSignal).toBeDefined();
      expect(upsideSignal!.points).toBe(3);
    });

    test("no upside signal below 10%", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 105 }, // 5% upside
          numberOfAnalystOpinions: { raw: 5 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const upsideSignal = result.signals.find(
        s => s.name.includes("Upside")
      );

      expect(upsideSignal).toBeUndefined();
    });
  });

  describe("Buy Consensus", () => {
    test("strong buy consensus when buys > 3x sells", () => {
      const summary = createMockSummary({
        recommendationTrend: {
          trend: [{
            strongBuy: 5,
            buy: 10,
            hold: 3,
            sell: 1,
            strongSell: 0, // 15 buys vs 1 sell = 15x
          }],
        },
      });

      const result = calculateAnalystSignals(summary);
      const consensusSignal = result.signals.find(
        s => s.name === "Strong Buy Consensus"
      );

      expect(consensusSignal).toBeDefined();
      expect(consensusSignal!.points).toBe(5);
    });

    test("no consensus signal when insufficient buy ratio", () => {
      const summary = createMockSummary({
        recommendationTrend: {
          trend: [{
            strongBuy: 2,
            buy: 3,
            hold: 10,
            sell: 3,
            strongSell: 2, // 5 buys vs 5 sells = 1x
          }],
        },
      });

      const result = calculateAnalystSignals(summary);
      const consensusSignal = result.signals.find(
        s => s.name === "Strong Buy Consensus"
      );

      expect(consensusSignal).toBeUndefined();
    });
  });

  describe("Positive Earnings Outlook", () => {
    test("triggers on >5% growth expectation", () => {
      const summary = createMockSummary({
        earningsTrend: {
          trend: [
            { period: "0q", growth: { raw: 0.10 } }, // 10% growth
          ],
        },
      });

      const result = calculateAnalystSignals(summary);
      const outlookSignal = result.signals.find(
        s => s.name === "Positive Earnings Outlook"
      );

      expect(outlookSignal).toBeDefined();
    });

    test("no signal for flat/negative growth", () => {
      const summary = createMockSummary({
        earningsTrend: {
          trend: [
            { period: "0q", growth: { raw: -0.05 } }, // -5% growth
          ],
        },
      });

      const result = calculateAnalystSignals(summary);
      const outlookSignal = result.signals.find(
        s => s.name === "Positive Earnings Outlook"
      );

      expect(outlookSignal).toBeUndefined();
    });
  });

  describe("Analyst Coverage", () => {
    test("high coverage signal for >=20 analysts", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 100 },
          numberOfAnalystOpinions: { raw: 25 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const coverageSignal = result.signals.find(
        s => s.name === "High Analyst Coverage"
      );

      expect(coverageSignal).toBeDefined();
      expect(coverageSignal!.points).toBe(2);
    });

    test("no coverage signal for <20 analysts", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 100 },
          numberOfAnalystOpinions: { raw: 15 },
        },
      });

      const result = calculateAnalystSignals(summary);
      const coverageSignal = result.signals.find(
        s => s.name === "High Analyst Coverage"
      );

      expect(coverageSignal).toBeUndefined();
    });
  });

  describe("Score Capping", () => {
    test("score is capped at 20", () => {
      // Create a summary that would score > 20
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 150 }, // 50% upside = 8 pts
          numberOfAnalystOpinions: { raw: 30 }, // +2 pts
        },
        recommendationTrend: {
          trend: [{
            strongBuy: 20,
            buy: 10,
            hold: 2,
            sell: 0,
            strongSell: 0, // +5 pts consensus
          }],
        },
        earningsTrend: {
          trend: [
            { period: "0q", growth: { raw: 0.50 } }, // +5 pts
          ],
        },
        upgradeDowngradeHistory: {
          history: [
            { epochGradeDate: new Date(), action: "up", firm: "Test" },
            { epochGradeDate: new Date(), action: "up", firm: "Test2" },
          ],
        },
      });

      const result = calculateAnalystSignals(summary);

      expect(result.score).toBeLessThanOrEqual(20);
    });
  });

  describe("Upside Potential Tracking", () => {
    test("tracks upside potential percentage", () => {
      const summary = createMockSummary({
        financialData: {
          currentPrice: { raw: 100 },
          targetMeanPrice: { raw: 140 }, // 40% upside
          numberOfAnalystOpinions: { raw: 5 },
        },
      });

      const result = calculateAnalystSignals(summary);

      expect(result.upsidePotential).toBeCloseTo(0.4, 2);
    });
  });
});

