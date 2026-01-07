/**
 * Strategy Configuration Loader
 *
 * Loads and validates the centralized strategy.config.yaml file.
 * Used by ai-analyst, screen-ticker, and other TypeScript services.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

// =============================================================================
// TYPES
// =============================================================================

export interface EntryTrend {
  above_ma200: boolean;
  above_ma50: boolean;
  ma50_above_ma200: boolean;
}

export interface EntryMomentum {
  rsi_min: number;
  rsi_max: number;
  rsi_ideal_min: number;
  rsi_ideal_max: number;
}

export interface EntryCushion {
  minimum_pct: number;
  preferred_pct: number;
  excellent_pct: number;
}

export interface EntryVolatility {
  iv_max_pct: number;
  iv_preferred_max_pct: number;
  iv_rank_max: number;
  avoid_if_iv_above: number;
}

export interface EntryEarnings {
  min_days_until: number;
  preferred_days_until: number;
  never_hold_through: boolean;
}

export interface EntrySentiment {
  analyst_bullish_min_pct: number;
  analyst_bullish_preferred: number;
  analyst_count_min: number;
}

export interface EntryFundamentals {
  require_positive_eps: boolean;
  max_pe_ratio: number;
  min_market_cap_b: number;
}

export interface EntrySpread {
  min_return_on_risk_pct: number;
  preferred_ror_pct: number;
  min_open_interest: number;
  max_bid_ask_spread_pct: number;
}

export interface EntryCriteria {
  trend: EntryTrend;
  momentum: EntryMomentum;
  cushion: EntryCushion;
  volatility: EntryVolatility;
  earnings: EntryEarnings;
  sentiment: EntrySentiment;
  fundamentals: EntryFundamentals;
  spread: EntrySpread;
}

export interface ExitProfit {
  target_pct: number;
  early_exit_pct: number;
  scale_out: boolean;
}

export interface ExitStopLoss {
  max_loss_pct: number;
  time_stop_days: number | null;
}

export interface ExitTime {
  max_hold_days: number;
  exit_before_expiry_days: number;
}

export interface ExitEvents {
  exit_before_earnings: boolean;
  exit_on_major_news: boolean;
}

export interface ExitRules {
  profit: ExitProfit;
  stop_loss: ExitStopLoss;
  time: ExitTime;
  events: ExitEvents;
}

export interface ScalingRule {
  account_min: number;
  account_max: number;
  max_position_pct: number;
  max_positions: number;
}

export interface PositionSizing {
  max_single_position_pct: number;
  preferred_position_pct: number;
  min_position_pct: number;
  max_total_deployed_pct: number;
  preferred_deployed_pct: number;
  max_concurrent_positions: number;
  scaling: ScalingRule[];
}

export interface CircuitBreakers {
  consecutive_losses_pause: number;
  pause_duration_hours: number;
  monthly_drawdown_reduce_pct: number;
  monthly_drawdown_stop_pct: number;
}

export interface RiskManagement {
  circuit_breakers: CircuitBreakers;
  correlation: {
    max_same_sector: number;
    max_correlated_positions: number;
  };
  blacklist: {
    tickers: string[];
    sectors: string[];
  };
}

export interface StrategyConfig {
  strategy: {
    name: string;
    version: string;
    description: string;
  };
  entry: EntryCriteria;
  exit: ExitRules;
  position_sizing: PositionSizing;
  spread_params: {
    dte: { target: number; min: number; max: number };
    width: Array<{
      account_max: number;
      width: number;
      typical_debit: number;
    }>;
    strikes: {
      long_strike_delta_min: number;
      long_strike_delta_max: number;
      short_strike_delta_min: number;
      short_strike_delta_max: number;
    };
  };
  risk_management: RiskManagement;
  universe: {
    tier1: string[];
    tier2: string[];
    tier3: string[];
    scanner: {
      min_price: number;
      max_price: number;
      min_volume: number;
      min_market_cap_b: number;
    };
  };
  validation: {
    min_ai_score: number;
    min_confidence: number;
    human_confirm_above: number;
  };
}

// =============================================================================
// LOADER
// =============================================================================

let cachedConfig: StrategyConfig | null = null;

/**
 * Load the strategy configuration from YAML
 */
export function loadStrategyConfig(configPath?: string): StrategyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const path = configPath ?? findConfigPath();

  if (!existsSync(path)) {
    throw new Error(
      `Strategy config not found at ${path}. ` +
        'Create strategy.config.yaml in the repository root.'
    );
  }

  const content = readFileSync(path, 'utf-8');
  cachedConfig = parse(content) as StrategyConfig;

  return cachedConfig;
}

/**
 * Find the config file by walking up from cwd
 */
function findConfigPath(): string {
  const possiblePaths = [
    join(process.cwd(), 'strategy.config.yaml'),
    join(process.cwd(), '..', 'strategy.config.yaml'),
    join(process.cwd(), '..', '..', 'strategy.config.yaml'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return possiblePaths[0]; // Will throw in loadStrategyConfig
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export interface EntryValidation {
  passed: boolean;
  failures: string[];
  warnings: string[];
  score: number;
}

/**
 * Validate a potential trade against entry criteria
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
  const cfg = config ?? loadStrategyConfig();
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
      score += 5; // Bonus for ideal range
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
      score += 10; // Excellent cushion bonus
    } else if (data.cushion_pct >= cfg.entry.cushion.preferred_pct) {
      score += 5; // Good cushion bonus
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
      score += 5; // Low IV bonus
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
      score += 5; // Comfortable earnings buffer
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
      score += 5; // Strong analyst support
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
      score += 5; // Good R/R bonus
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
  const cfg = config ?? loadStrategyConfig();

  // Find matching scaling rule
  const rule =
    cfg.position_sizing.scaling.find(
      (r) => accountSize >= r.account_min && accountSize < r.account_max
    ) ?? cfg.position_sizing.scaling[cfg.position_sizing.scaling.length - 1];

  return {
    maxPositionPct: rule.max_position_pct,
    maxPositionDollars: (accountSize * rule.max_position_pct) / 100,
    maxPositions: rule.max_positions,
    maxDeployed:
      (accountSize * cfg.position_sizing.max_total_deployed_pct) / 100,
  };
}

/**
 * Get spread width recommendation based on account size
 */
export function getSpreadWidth(
  accountSize: number,
  config?: StrategyConfig
): { width: number; typicalDebit: number } {
  const cfg = config ?? loadStrategyConfig();

  const rule =
    cfg.spread_params.width.find((w) => accountSize <= w.account_max) ??
    cfg.spread_params.width[cfg.spread_params.width.length - 1];

  return {
    width: rule.width,
    typicalDebit: rule.typical_debit,
  };
}
