/**
 * Market Regime Detector
 * Determines overall market conditions for strategy adjustment.
 *
 * ## Architecture Note
 *
 * There are two regime detection systems in the monorepo:
 *
 * 1. **@portfolio/core/regime** (this module) — Strategy-level regime types
 *    that map to `strategy.config.yaml` market_regime keys (bull/neutral/bear).
 *    Used by CDS engine and other strategy services for position sizing and
 *    entry criteria adjustments.
 *
 * 2. **@portfolio/ai-agent/market** — Market-level regime for AI context
 *    (RISK_ON/RISK_OFF/NEUTRAL/HIGH_VOL). Includes live VIX/SPY/sector data
 *    fetching with caching. Used by the AI chat and CLI analyst.
 *
 * These serve different purposes:
 * - Strategy regime (bull/bear) drives config-based adjustments (min scores, sizing)
 * - Market regime (RISK_ON/OFF) provides real-time AI context with VIX/sector data
 *
 * @see {@link ../../../../lib/ai-agent/market/index.ts} for the AI market regime
 * @see {@link ../../../../strategy.config.yaml} for regime adjustment rules
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Strategy-level market regime.
 * Maps directly to `strategy.config.yaml` market_regime keys.
 */
export type MarketRegime = 'bull' | 'neutral' | 'bear' | 'caution';

export interface RegimeSignal {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  weight: number;
}

export interface RegimeResult {
  regime: MarketRegime;
  confidence: number;
  signals: RegimeSignal[];
  recommendation: string;
  adjustments: {
    minScore: number;
    positionSize: number;
    onlyGradeA: boolean;
  };
}

export interface RegimeDataProvider {
  getHistorical: (
    ticker: string,
    days: number
  ) => Promise<{ close: number; high: number; low: number }[] | null>;
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect market regime based on SPY technical analysis.
 *
 * Analyzes SPY price action relative to moving averages and volatility
 * to determine the current strategy regime. Returns adjustment parameters
 * from strategy.config.yaml.
 *
 * @param provider - Data provider for historical price data
 * @returns Regime result with adjustment parameters
 */
export async function detectMarketRegime(
  provider: RegimeDataProvider
): Promise<RegimeResult> {
  const signals: RegimeSignal[] = [];

  try {
    const history = await provider.getHistorical('SPY', 250);
    if (!history || history.length < 200) {
      return neutralResult('Insufficient data for regime detection');
    }

    // MA200 trend
    const prices = history.map((h) => h.close);
    const currentPrice = prices[prices.length - 1] ?? 0;
    const ma200 = prices.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const ma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;

    const aboveMA200 = currentPrice > ma200;
    const aboveMA50 = currentPrice > ma50;
    const goldenCross = ma50 > ma200;

    signals.push({
      name: 'SPY vs MA200',
      value: ((currentPrice - ma200) / ma200) * 100,
      signal: aboveMA200 ? 'bullish' : 'bearish',
      weight: 0.4,
    });

    signals.push({
      name: 'SPY vs MA50',
      value: ((currentPrice - ma50) / ma50) * 100,
      signal: aboveMA50 ? 'bullish' : 'bearish',
      weight: 0.3,
    });

    signals.push({
      name: 'Golden Cross',
      value: ((ma50 - ma200) / ma200) * 100,
      signal: goldenCross ? 'bullish' : 'bearish',
      weight: 0.3,
    });

    // Score calculation
    const score = signals.reduce((total, s) => {
      const direction =
        s.signal === 'bullish' ? 1 : s.signal === 'bearish' ? -1 : 0;
      return total + direction * s.weight;
    }, 0);

    if (score > 0.5) {
      return {
        regime: 'bull',
        confidence: Math.min(score, 1),
        signals,
        recommendation: 'Favorable conditions. Normal position sizing.',
        adjustments: { minScore: 65, positionSize: 1.0, onlyGradeA: false },
      };
    }

    if (score < -0.3) {
      return {
        regime: 'bear',
        confidence: Math.min(Math.abs(score), 1),
        signals,
        recommendation: 'Risk-off. Reduce exposure, tighter criteria.',
        adjustments: { minScore: 85, positionSize: 0.5, onlyGradeA: true },
      };
    }

    if (score < 0) {
      return {
        regime: 'caution',
        confidence: 0.5,
        signals,
        recommendation: 'Mixed signals. Focus on high-conviction setups.',
        adjustments: { minScore: 80, positionSize: 0.75, onlyGradeA: true },
      };
    }

    return {
      regime: 'neutral',
      confidence: 0.5,
      signals,
      recommendation: 'Proceed with normal caution.',
      adjustments: { minScore: 75, positionSize: 0.8, onlyGradeA: false },
    };
  } catch {
    return neutralResult('Error detecting market regime');
  }
}

function neutralResult(recommendation: string): RegimeResult {
  return {
    regime: 'neutral',
    confidence: 0.5,
    signals: [],
    recommendation,
    adjustments: { minScore: 75, positionSize: 0.5, onlyGradeA: true },
  };
}

// ============================================================================
// REGIME MAPPING (Unified Bridge)
// ============================================================================

/**
 * Market regime types used by the AI agent (lib/ai-agent/market).
 * Defined here for bridging without creating a circular dependency.
 */
export type AIMarketRegimeType =
  | 'RISK_ON'
  | 'RISK_OFF'
  | 'NEUTRAL'
  | 'HIGH_VOL';

/**
 * Maps an AI agent market regime type to a strategy config regime type.
 *
 * This bridge ensures that regardless of which regime detection system
 * is used (core/detector, ai-agent/market, or cds-engine), the result
 * can always be mapped to a strategy.config.yaml market_regime key for
 * consistent position sizing and entry criteria adjustments.
 *
 * Mapping:
 * - RISK_ON  → bull    (favorable conditions)
 * - RISK_OFF → bear    (defensive mode)
 * - NEUTRAL  → neutral (mixed signals)
 * - HIGH_VOL → caution (elevated volatility)
 *
 * @example
 * ```typescript
 * import { mapToStrategyRegime } from '@portfolio/core/regime';
 * import { getMarketRegime } from '@portfolio/ai-agent/market';
 *
 * const market = await getMarketRegime();
 * const strategyRegime = mapToStrategyRegime(market.regime);
 * // Use strategyRegime to look up config adjustments
 * ```
 */
export function mapToStrategyRegime(
  aiRegime: AIMarketRegimeType
): MarketRegime {
  switch (aiRegime) {
    case 'RISK_ON':
      return 'bull';
    case 'RISK_OFF':
      return 'bear';
    case 'HIGH_VOL':
      return 'caution';
    case 'NEUTRAL':
      return 'neutral';
  }
}

/**
 * Maps a strategy regime type to an AI agent market regime type.
 * Inverse of mapToStrategyRegime.
 */
export function mapToAIRegime(
  strategyRegime: MarketRegime
): AIMarketRegimeType {
  switch (strategyRegime) {
    case 'bull':
      return 'RISK_ON';
    case 'bear':
      return 'RISK_OFF';
    case 'caution':
      return 'HIGH_VOL';
    case 'neutral':
      return 'NEUTRAL';
  }
}

/**
 * Get strategy config adjustments for a given AI market regime type.
 * Bridges the AI agent regime to strategy.config.yaml adjustments.
 */
export function getRegimeAdjustments(aiRegime: AIMarketRegimeType): {
  minScore: number;
  positionSize: number;
  onlyGradeA: boolean;
} {
  const strategyRegime = mapToStrategyRegime(aiRegime);

  switch (strategyRegime) {
    case 'bull':
      return { minScore: 65, positionSize: 1.0, onlyGradeA: false };
    case 'neutral':
      return { minScore: 75, positionSize: 0.8, onlyGradeA: false };
    case 'caution':
      return { minScore: 80, positionSize: 0.75, onlyGradeA: true };
    case 'bear':
      return { minScore: 85, positionSize: 0.5, onlyGradeA: true };
  }
}
