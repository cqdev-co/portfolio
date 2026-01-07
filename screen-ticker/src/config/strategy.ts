/**
 * Strategy Configuration Loader
 * v2.5.0: Load strategy config from YAML for consistent thresholds
 *
 * Reads from /strategy.config.yaml at repo root
 */

import { parse } from 'yaml';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { MarketRegime } from '../utils/market-regime.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface RegimeAdjustments {
  min_score: number;
  rsi_max: number;
  rsi_min?: number;
  position_size_multiplier: number;
  max_concurrent_positions: number;
  require_ma50_above: boolean;
  require_golden_cross?: boolean;
  cushion_minimum_pct?: number;
}

export interface MarketRegimeConfig {
  enabled: boolean;
  description: string;
  adjustments: RegimeAdjustments;
}

export interface StrategyConfig {
  entry: {
    trend: {
      above_ma200: boolean;
      above_ma50: boolean;
      ma50_above_ma200: boolean;
    };
    momentum: {
      rsi_min: number;
      rsi_max: number;
      rsi_ideal_min: number;
      rsi_ideal_max: number;
    };
    cushion: {
      minimum_pct: number;
      preferred_pct: number;
      excellent_pct: number;
    };
  };
  market_regime: {
    bull: MarketRegimeConfig;
    neutral: MarketRegimeConfig;
    bear: MarketRegimeConfig;
    no_trade: {
      spy_below_ma200_pct: number;
      vix_above: number;
      consecutive_down_days: number;
    };
  };
  validation: {
    min_ai_score: number;
    min_confidence: number;
  };
}

// ============================================================================
// DEFAULT CONFIG (fallback if YAML not found)
// ============================================================================

const DEFAULT_CONFIG: StrategyConfig = {
  entry: {
    trend: {
      above_ma200: true,
      above_ma50: true,
      ma50_above_ma200: false,
    },
    momentum: {
      rsi_min: 30,
      rsi_max: 55,
      rsi_ideal_min: 35,
      rsi_ideal_max: 50,
    },
    cushion: {
      minimum_pct: 7.0,
      preferred_pct: 10.0,
      excellent_pct: 15.0,
    },
  },
  market_regime: {
    bull: {
      enabled: true,
      description: 'Standard entry criteria',
      adjustments: {
        min_score: 65,
        rsi_max: 60,
        position_size_multiplier: 1.0,
        max_concurrent_positions: 6,
        require_ma50_above: false,
      },
    },
    neutral: {
      enabled: true,
      description: 'Selective entries',
      adjustments: {
        min_score: 70,
        rsi_max: 55,
        position_size_multiplier: 0.75,
        max_concurrent_positions: 4,
        require_ma50_above: true,
      },
    },
    bear: {
      enabled: true,
      description: 'Defensive mode',
      adjustments: {
        min_score: 80,
        rsi_max: 50,
        rsi_min: 25,
        position_size_multiplier: 0.5,
        max_concurrent_positions: 2,
        require_ma50_above: true,
        require_golden_cross: true,
        cushion_minimum_pct: 10.0,
      },
    },
    no_trade: {
      spy_below_ma200_pct: -10,
      vix_above: 35,
      consecutive_down_days: 5,
    },
  },
  validation: {
    min_ai_score: 65,
    min_confidence: 70,
  },
};

// ============================================================================
// LOADER
// ============================================================================

let cachedConfig: StrategyConfig | null = null;

/**
 * Load strategy configuration from YAML
 * Caches result for performance
 */
export function loadStrategyConfig(): StrategyConfig {
  if (cachedConfig) return cachedConfig;

  // Try to find strategy.config.yaml
  const possiblePaths = [
    join(process.cwd(), '..', 'strategy.config.yaml'),
    join(process.cwd(), 'strategy.config.yaml'),
    join(process.cwd(), '..', '..', 'strategy.config.yaml'),
  ];

  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = parse(content) as Partial<StrategyConfig>;

        // Merge with defaults to fill any missing fields
        cachedConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          entry: {
            ...DEFAULT_CONFIG.entry,
            ...parsed.entry,
          },
          market_regime: {
            ...DEFAULT_CONFIG.market_regime,
            ...parsed.market_regime,
          },
        };

        return cachedConfig;
      } catch (error) {
        console.warn(`Failed to parse strategy.config.yaml: ${error}`);
      }
    }
  }

  // Return defaults if no config found
  cachedConfig = DEFAULT_CONFIG;
  return cachedConfig;
}

/**
 * Get regime-specific adjustments
 */
export function getRegimeAdjustments(regime: MarketRegime): RegimeAdjustments {
  const config = loadStrategyConfig();
  return config.market_regime[regime].adjustments;
}

/**
 * Get effective min score based on market regime
 */
export function getEffectiveMinScore(
  baseMinScore: number,
  regime: MarketRegime
): number {
  const adjustments = getRegimeAdjustments(regime);
  // Use the higher of: user-specified min or regime min
  return Math.max(baseMinScore, adjustments.min_score);
}

/**
 * Check if no-trade conditions are met
 */
export function checkNoTradeConditions(
  spyPctBelowMA200: number,
  vix?: number
): { noTrade: boolean; reason?: string } {
  const config = loadStrategyConfig();
  const noTrade = config.market_regime.no_trade;

  if (spyPctBelowMA200 <= noTrade.spy_below_ma200_pct) {
    return {
      noTrade: true,
      reason:
        `SPY ${Math.abs(spyPctBelowMA200).toFixed(1)}% below MA200 ` +
        `(threshold: ${Math.abs(noTrade.spy_below_ma200_pct)}%)`,
    };
  }

  if (vix && vix >= noTrade.vix_above) {
    return {
      noTrade: true,
      reason: `VIX at ${vix.toFixed(1)} (threshold: ${noTrade.vix_above})`,
    };
  }

  return { noTrade: false };
}

/**
 * Clear cached config (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
