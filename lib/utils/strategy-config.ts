/**
 * Strategy Configuration - Re-export from canonical source
 *
 * The canonical strategy config types and loader live in @portfolio/ai-agent.
 * This file re-exports everything for backward compatibility and adds
 * the comprehensive `validateEntry` helper.
 *
 * @example
 * ```typescript
 * import { getStrategyConfig, validateEntry } from '@portfolio/utils/strategy-config';
 * ```
 *
 * @see {@link ../ai-agent/config/index.ts} for the canonical source
 */

// =============================================================================
// RE-EXPORTS FROM CANONICAL SOURCE (@portfolio/ai-agent config)
// =============================================================================

export {
  // Config loader
  getStrategyConfig,
  clearConfigCache,
  setConfigPath,
  // Convenience getters
  getEntryConfig,
  getExitConfig,
  getPositionSizingConfig,
  getSpreadParamsConfig,
  getRiskManagementConfig,
  getMarketRegimeConfig,
  getLessonsLearned,
  // Helpers
  getMaxPositionSize,
  getSpreadWidth,
  shouldCloseOnProfit,
  shouldCloseOnDTE,
  checkPinRisk,
  getExitRecommendation,
  isRSIValid,
  isCushionValid,
  isEarningsSafe,
  // Types
  type StrategyConfig,
  type EntryConfig,
  type ExitConfig,
  type PositionSizingConfig,
  type SpreadParamsConfig,
  type RiskManagementConfig,
  type MarketRegimeConfig,
  type TrendConfig,
  type MomentumConfig,
  type CushionConfig,
  type VolatilityConfig,
  type EarningsConfig,
  type SentimentConfig,
  type FundamentalsConfig,
  type SpreadEntryConfig,
  type ProfitConfig,
  type StopLossConfig,
  type TimeExitConfig,
  type EventExitConfig,
  type PinRiskConfig,
  type DTEConfig,
  type SpreadWidthConfig,
  type StrikeConfig,
  type CircuitBreakerConfig,
  type CorrelationConfig,
  type BlacklistConfig,
  type UniverseConfig,
  type RegimeAdjustments,
  type LessonReference,
} from '../ai-agent/config/index.ts';

import {
  getStrategyConfig,
  type StrategyConfig,
} from '../ai-agent/config/index.ts';

// =============================================================================
// TYPE ALIASES (backward compatibility)
// =============================================================================

// These aliases preserve the old naming convention for any future consumers
// that may reference the previous type names from this module.
export type { EntryConfig as EntryCriteria } from '../ai-agent/config/index.ts';
export type { ExitConfig as ExitRules } from '../ai-agent/config/index.ts';
export type { TrendConfig as EntryTrend } from '../ai-agent/config/index.ts';
export type { MomentumConfig as EntryMomentum } from '../ai-agent/config/index.ts';
export type { CushionConfig as EntryCushion } from '../ai-agent/config/index.ts';
export type { VolatilityConfig as EntryVolatility } from '../ai-agent/config/index.ts';
export type { EarningsConfig as EntryEarnings } from '../ai-agent/config/index.ts';
export type { SentimentConfig as EntrySentiment } from '../ai-agent/config/index.ts';
export type { FundamentalsConfig as EntryFundamentals } from '../ai-agent/config/index.ts';
export type { SpreadEntryConfig as EntrySpread } from '../ai-agent/config/index.ts';

// =============================================================================
// COMPREHENSIVE ENTRY VALIDATION
// =============================================================================

export interface EntryValidation {
  passed: boolean;
  failures: string[];
  warnings: string[];
  score: number;
}

/**
 * Validate a potential trade against all entry criteria at once.
 *
 * Unlike the individual validators in @portfolio/ai-agent/config (isRSIValid,
 * isCushionValid, etc.), this function runs ALL checks and returns a
 * comprehensive score with pass/fail status.
 */
export function validateEntry(
  data: {
    price: number;
    ma200?: number;
    ma50?: number;
    rsi?: number;
    cushion_pct?: number;
    iv?: number;
    iv_rank?: number;
    days_to_earnings?: number;
    analyst_bullish_pct?: number;
    analyst_count?: number;
    pe_ratio?: number;
    market_cap_b?: number;
    return_on_risk_pct?: number;
  },
  config?: StrategyConfig
): EntryValidation {
  const cfg = config ?? getStrategyConfig();
  const failures: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // --- Trend ---
  if (cfg.entry.trend.above_ma200 && data.ma200) {
    if (data.price <= data.ma200) {
      failures.push(`Price ${data.price} below MA200 ${data.ma200}`);
      score -= 25;
    }
  }

  if (cfg.entry.trend.above_ma50 && data.ma50) {
    if (data.price <= data.ma50) {
      warnings.push(`Price ${data.price} below MA50 ${data.ma50}`);
      score -= 10;
    }
  }

  // --- Momentum ---
  if (data.rsi !== undefined) {
    if (data.rsi < cfg.entry.momentum.rsi_min) {
      failures.push(`RSI ${data.rsi} below min ${cfg.entry.momentum.rsi_min}`);
      score -= 15;
    }
    if (data.rsi > cfg.entry.momentum.rsi_max) {
      failures.push(`RSI ${data.rsi} above max ${cfg.entry.momentum.rsi_max}`);
      score -= 20;
    }
    if (
      data.rsi >= cfg.entry.momentum.rsi_ideal_min &&
      data.rsi <= cfg.entry.momentum.rsi_ideal_max
    ) {
      score += 5;
    }
  }

  // --- Cushion ---
  if (data.cushion_pct !== undefined) {
    if (data.cushion_pct < cfg.entry.cushion.minimum_pct) {
      failures.push(
        `Cushion ${data.cushion_pct}% below min ${cfg.entry.cushion.minimum_pct}%`
      );
      score -= 20;
    } else if (data.cushion_pct >= cfg.entry.cushion.excellent_pct) {
      score += 10;
    } else if (data.cushion_pct >= cfg.entry.cushion.preferred_pct) {
      score += 5;
    }
  }

  // --- Volatility ---
  if (data.iv !== undefined) {
    if (data.iv > cfg.entry.volatility.avoid_if_iv_above) {
      failures.push(
        `IV ${data.iv}% above hard limit ${cfg.entry.volatility.avoid_if_iv_above}%`
      );
      score -= 25;
    } else if (data.iv > cfg.entry.volatility.iv_max_pct) {
      warnings.push(
        `IV ${data.iv}% above preferred max ${cfg.entry.volatility.iv_max_pct}%`
      );
      score -= 10;
    } else if (data.iv <= cfg.entry.volatility.iv_preferred_max_pct) {
      score += 5;
    }
  }

  // --- Earnings ---
  if (data.days_to_earnings !== undefined) {
    if (data.days_to_earnings < cfg.entry.earnings.min_days_until) {
      failures.push(
        `Only ${data.days_to_earnings} days to earnings ` +
          `(min: ${cfg.entry.earnings.min_days_until})`
      );
      score -= 20;
    } else if (
      data.days_to_earnings >= cfg.entry.earnings.preferred_days_until
    ) {
      score += 5;
    }
  }

  // --- Sentiment ---
  if (data.analyst_bullish_pct !== undefined) {
    if (
      data.analyst_bullish_pct < cfg.entry.sentiment.analyst_bullish_min_pct
    ) {
      failures.push(
        `Analyst bullish ${data.analyst_bullish_pct}% below min ` +
          `${cfg.entry.sentiment.analyst_bullish_min_pct}%`
      );
      score -= 15;
    } else if (
      data.analyst_bullish_pct >= cfg.entry.sentiment.analyst_bullish_preferred
    ) {
      score += 5;
    }
  }

  // --- Return on Risk ---
  if (data.return_on_risk_pct !== undefined) {
    if (data.return_on_risk_pct < cfg.entry.spread.min_return_on_risk_pct) {
      failures.push(
        `R/R ${data.return_on_risk_pct}% below min ` +
          `${cfg.entry.spread.min_return_on_risk_pct}%`
      );
      score -= 10;
    } else if (data.return_on_risk_pct >= cfg.entry.spread.preferred_ror_pct) {
      score += 5;
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    score: Math.max(0, Math.min(100, score)),
  };
}

/**
 * Get position sizing based on account size
 *
 * @deprecated Use getMaxPositionSize() from @portfolio/ai-agent/config instead
 */
export function getPositionSizing(
  accountSize: number,
  config?: StrategyConfig
): {
  maxPositionPct: number;
  maxPositionDollars: number;
  maxPositions: number;
  maxDeployed: number;
} {
  const cfg = config ?? getStrategyConfig();

  const rule =
    cfg.position_sizing.scaling.find(
      (r) => accountSize >= r.account_min && accountSize < r.account_max
    ) ?? cfg.position_sizing.scaling[cfg.position_sizing.scaling.length - 1];

  return {
    maxPositionPct:
      rule?.max_position_pct ?? cfg.position_sizing.max_single_position_pct,
    maxPositionDollars:
      (accountSize *
        (rule?.max_position_pct ??
          cfg.position_sizing.max_single_position_pct)) /
      100,
    maxPositions:
      rule?.max_positions ?? cfg.position_sizing.max_concurrent_positions,
    maxDeployed:
      (accountSize * cfg.position_sizing.max_total_deployed_pct) / 100,
  };
}
