/**
 * Strategy Configuration Loader
 *
 * Loads trading strategy rules from strategy.config.yaml.
 * All services should use this config instead of hardcoded values.
 *
 * This creates a single source of truth for:
 * - Entry criteria (RSI, cushion, IV, earnings)
 * - Exit rules (profit targets, time stops, pin risk)
 * - Position sizing
 * - Spread parameters
 * - Risk management
 *
 * @example
 * ```typescript
 * import { getStrategyConfig, StrategyConfig } from '@lib/ai-agent/config';
 *
 * const config = getStrategyConfig();
 * console.log(config.entry.momentum.rsi_max); // 55
 * console.log(config.exit.profit.target_pct); // 75
 * ```
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { validateStrategyConfig } from './schema';

// Re-export schema validation utilities
export {
  strategyConfigSchema,
  validateStrategyConfig,
  assertValidStrategyConfig,
} from './schema';

// ============================================================================
// TYPES
// ============================================================================

export interface TrendConfig {
  above_ma200: boolean;
  above_ma50: boolean;
  ma50_above_ma200: boolean;
}

export interface MomentumConfig {
  rsi_min: number;
  rsi_max: number;
  rsi_ideal_min: number;
  rsi_ideal_max: number;
}

export interface CushionConfig {
  minimum_pct: number;
  preferred_pct: number;
  excellent_pct: number;
}

export interface VolatilityConfig {
  iv_max_pct: number;
  iv_preferred_max_pct: number;
  iv_rank_max: number;
  avoid_if_iv_above: number;
}

export interface EarningsConfig {
  min_days_until: number;
  preferred_days_until: number;
  never_hold_through: boolean;
}

export interface SentimentConfig {
  analyst_bullish_min_pct: number;
  analyst_bullish_preferred: number;
  analyst_count_min: number;
}

export interface FundamentalsConfig {
  require_positive_eps: boolean;
  max_pe_ratio: number;
  min_market_cap_b: number;
}

export interface SpreadEntryConfig {
  min_return_on_risk_pct: number;
  preferred_ror_pct: number;
  min_open_interest: number;
  max_bid_ask_spread_pct: number;
}

export interface EntryConfig {
  trend: TrendConfig;
  momentum: MomentumConfig;
  cushion: CushionConfig;
  volatility: VolatilityConfig;
  earnings: EarningsConfig;
  sentiment: SentimentConfig;
  fundamentals: FundamentalsConfig;
  spread: SpreadEntryConfig;
}

export interface ProfitConfig {
  min_acceptable_pct: number;
  target_pct: number;
  greed_limit_pct: number;
  early_exit_threshold_pct: number;
  early_exit_days: number;
  never_chase_max_profit: boolean;
  scale_out: boolean;
}

export interface StopLossConfig {
  max_loss_pct: number;
  time_stop_days: number | null;
}

export interface TimeExitConfig {
  max_hold_days: number;
  gamma_risk_zone_dte: number;
  forced_exit_dte: number;
  exit_rule: string;
}

export interface EventExitConfig {
  exit_before_earnings: boolean;
  exit_on_major_news: boolean;
}

export interface PinRiskConfig {
  enabled: boolean;
  cushion_warning_pct: number;
  cushion_exit_pct: number;
  dte_threshold: number;
}

export interface ExitConfig {
  profit: ProfitConfig;
  stop_loss: StopLossConfig;
  time: TimeExitConfig;
  events: EventExitConfig;
  pin_risk: PinRiskConfig;
}

export interface PositionSizingConfig {
  max_single_position_pct: number;
  preferred_position_pct: number;
  min_position_pct: number;
  max_total_deployed_pct: number;
  preferred_deployed_pct: number;
  max_concurrent_positions: number;
  scaling: Array<{
    account_min: number;
    account_max: number;
    max_position_pct: number;
    max_positions: number;
  }>;
}

export interface DTEConfig {
  target: number;
  min: number;
  max: number;
}

export interface SpreadWidthConfig {
  account_max: number;
  width: number;
  typical_debit: number;
}

export interface StrikeConfig {
  long_strike_delta_min: number;
  long_strike_delta_max: number;
  short_strike_delta_min: number;
  short_strike_delta_max: number;
}

export interface SpreadParamsConfig {
  dte: DTEConfig;
  width: SpreadWidthConfig[];
  strikes: StrikeConfig;
}

export interface CircuitBreakerConfig {
  consecutive_losses_pause: number;
  pause_duration_hours: number;
  monthly_drawdown_reduce_pct: number;
  monthly_drawdown_stop_pct: number;
}

export interface CorrelationConfig {
  max_same_sector: number;
  max_correlated_positions: number;
}

export interface BlacklistConfig {
  tickers: string[];
  sectors: string[];
}

export interface RiskManagementConfig {
  circuit_breakers: CircuitBreakerConfig;
  correlation: CorrelationConfig;
  blacklist: BlacklistConfig;
}

export interface UniverseConfig {
  tier1: string[];
  tier2: string[];
  tier3: string[];
  scanner: {
    min_price: number;
    max_price: number;
    min_volume: number;
    min_market_cap_b: number;
  };
}

export interface RegimeAdjustments {
  min_score: number;
  rsi_max: number;
  position_size_multiplier: number;
  max_concurrent_positions: number;
  require_ma50_above?: boolean;
  require_golden_cross?: boolean;
  cushion_minimum_pct?: number;
  rsi_min?: number;
}

export interface MarketRegimeConfig {
  bull: {
    enabled: boolean;
    description: string;
    adjustments: RegimeAdjustments;
  };
  neutral: {
    enabled: boolean;
    description: string;
    adjustments: RegimeAdjustments;
  };
  bear: {
    enabled: boolean;
    description: string;
    adjustments: RegimeAdjustments;
  };
  no_trade: {
    spy_below_ma200_pct: number;
    vix_above: number;
    consecutive_down_days: number;
  };
}

export interface LessonReference {
  id: string;
  title: string;
  date: string;
  ticker?: string;
  cost?: number;
  rules_changed: string[];
  summary: string;
}

export interface StrategyConfig {
  strategy: {
    name: string;
    version: string;
    description: string;
  };
  entry: EntryConfig;
  exit: ExitConfig;
  position_sizing: PositionSizingConfig;
  spread_params: SpreadParamsConfig;
  risk_management: RiskManagementConfig;
  universe: UniverseConfig;
  market_regime: MarketRegimeConfig;
  alerts: {
    triggers: Record<string, boolean>;
  };
  validation: {
    min_ai_score: number;
    min_confidence: number;
    human_confirm_above: number;
  };
  lessons?: LessonReference[];
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

let cachedConfig: StrategyConfig | null = null;
let configPath: string | null = null;

/**
 * Find the strategy.config.yaml file
 * Searches up from current directory to find the repo root
 */
function findConfigPath(): string {
  // Try common locations
  const possiblePaths = [
    // Direct path (when running from repo root)
    join(process.cwd(), 'strategy.config.yaml'),
    // From lib/ai-agent
    join(process.cwd(), '../../strategy.config.yaml'),
    // From ai-analyst
    join(process.cwd(), '../strategy.config.yaml'),
    // From frontend
    join(process.cwd(), '../strategy.config.yaml'),
    // Absolute fallback (for tests)
    '/Users/conorquinlan/Desktop/GitHub/portfolio/strategy.config.yaml',
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `strategy.config.yaml not found. Searched:\n${possiblePaths.join('\n')}`
  );
}

/**
 * Load and parse the strategy configuration
 *
 * @param forceReload - Force reload from disk (default: use cache)
 * @returns Parsed strategy configuration
 */
export function getStrategyConfig(forceReload = false): StrategyConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  if (!configPath) {
    configPath = findConfigPath();
  }

  const yaml = readFileSync(configPath, 'utf-8');
  const parsed = parseYaml(yaml);

  // Validate config at load time to fail fast on bad config
  const result = validateStrategyConfig(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid strategy.config.yaml:\n${issues}\n\nFix the config file before continuing.`
    );
  }

  cachedConfig = parsed as StrategyConfig;

  return cachedConfig;
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configPath = null;
}

/**
 * Set a custom config path (useful for testing)
 */
export function setConfigPath(path: string): void {
  configPath = path;
  cachedConfig = null;
}

// ============================================================================
// CONVENIENCE GETTERS
// ============================================================================

/**
 * Get entry criteria from config
 */
export function getEntryConfig(): EntryConfig {
  return getStrategyConfig().entry;
}

/**
 * Get exit rules from config
 */
export function getExitConfig(): ExitConfig {
  return getStrategyConfig().exit;
}

/**
 * Get position sizing rules from config
 */
export function getPositionSizingConfig(): PositionSizingConfig {
  return getStrategyConfig().position_sizing;
}

/**
 * Get spread parameters from config
 */
export function getSpreadParamsConfig(): SpreadParamsConfig {
  return getStrategyConfig().spread_params;
}

/**
 * Get risk management rules from config
 */
export function getRiskManagementConfig(): RiskManagementConfig {
  return getStrategyConfig().risk_management;
}

/**
 * Get market regime adjustments from config
 */
export function getMarketRegimeConfig(): MarketRegimeConfig {
  return getStrategyConfig().market_regime;
}

/**
 * Get lessons learned that influenced this config
 */
export function getLessonsLearned(): LessonReference[] {
  return getStrategyConfig().lessons ?? [];
}

// ============================================================================
// POSITION SIZE HELPERS
// ============================================================================

/**
 * Calculate max position size for a given account size
 */
export function getMaxPositionSize(accountSize: number): number {
  const config = getPositionSizingConfig();

  // Find the scaling tier for this account size
  const tier = config.scaling.find(
    (t) => accountSize >= t.account_min && accountSize < t.account_max
  );

  const maxPct = tier?.max_position_pct ?? config.max_single_position_pct;
  return Math.round(accountSize * (maxPct / 100));
}

/**
 * Get the appropriate spread width for account size
 */
export function getSpreadWidth(accountSize: number): number {
  const config = getSpreadParamsConfig();

  // Find the width tier for this account size
  const tier = config.width.find((w) => accountSize <= w.account_max);

  return tier?.width ?? 5; // Default to $5 wide
}

// ============================================================================
// EXIT RULE HELPERS
// ============================================================================

/**
 * Check if a position should be closed based on profit captured
 *
 * @param profitCapturedPct - Percentage of max profit captured (0-100)
 * @returns { shouldClose, reason }
 */
export function shouldCloseOnProfit(profitCapturedPct: number): {
  shouldClose: boolean;
  reason: string;
} {
  const { profit } = getExitConfig();

  if (profitCapturedPct >= profit.greed_limit_pct) {
    return {
      shouldClose: true,
      reason: `Profit ${profitCapturedPct.toFixed(0)}% >= greed limit ${profit.greed_limit_pct}% - CLOSE NOW`,
    };
  }

  if (profitCapturedPct >= profit.target_pct) {
    return {
      shouldClose: true,
      reason: `Profit ${profitCapturedPct.toFixed(0)}% >= target ${profit.target_pct}% - recommend closing`,
    };
  }

  if (profitCapturedPct >= profit.min_acceptable_pct) {
    return {
      shouldClose: false,
      reason: `Profit ${profitCapturedPct.toFixed(0)}% above minimum (${profit.min_acceptable_pct}%) - can close or hold to ${profit.target_pct}%`,
    };
  }

  return {
    shouldClose: false,
    reason: `Profit ${profitCapturedPct.toFixed(0)}% below target - continue holding`,
  };
}

/**
 * Check if a position should be closed based on DTE
 *
 * @param dte - Days to expiration
 * @returns { shouldClose, urgency, reason }
 */
export function shouldCloseOnDTE(dte: number): {
  shouldClose: boolean;
  urgency: 'FORCED' | 'WARNING' | 'OK';
  reason: string;
} {
  const { time } = getExitConfig();

  if (dte <= time.forced_exit_dte) {
    return {
      shouldClose: true,
      urgency: 'FORCED',
      reason: `${dte} DTE <= forced exit threshold (${time.forced_exit_dte}) - MUST CLOSE (Lesson 001)`,
    };
  }

  if (dte <= time.gamma_risk_zone_dte) {
    return {
      shouldClose: false,
      urgency: 'WARNING',
      reason: `${dte} DTE in gamma risk zone - close at 50%+ profit or any profit target`,
    };
  }

  return {
    shouldClose: false,
    urgency: 'OK',
    reason: `${dte} DTE outside danger zone - normal management`,
  };
}

/**
 * Check if a position has pin risk
 *
 * @param cushionPct - Current cushion percentage
 * @param dte - Days to expiration
 * @returns { hasRisk, urgency, reason }
 */
export function checkPinRisk(
  cushionPct: number,
  dte: number
): {
  hasRisk: boolean;
  urgency: 'EXIT' | 'WARNING' | 'OK';
  reason: string;
} {
  const { pin_risk } = getExitConfig();

  if (!pin_risk.enabled) {
    return { hasRisk: false, urgency: 'OK', reason: 'Pin risk check disabled' };
  }

  if (dte > pin_risk.dte_threshold) {
    return {
      hasRisk: false,
      urgency: 'OK',
      reason: `${dte} DTE > pin risk threshold (${pin_risk.dte_threshold})`,
    };
  }

  if (cushionPct <= pin_risk.cushion_exit_pct) {
    return {
      hasRisk: true,
      urgency: 'EXIT',
      reason: `Cushion ${cushionPct.toFixed(1)}% <= ${pin_risk.cushion_exit_pct}% with ${dte} DTE - EXIT IMMEDIATELY`,
    };
  }

  if (cushionPct <= pin_risk.cushion_warning_pct) {
    return {
      hasRisk: true,
      urgency: 'WARNING',
      reason: `Cushion ${cushionPct.toFixed(1)}% approaching danger zone with ${dte} DTE - consider closing`,
    };
  }

  return {
    hasRisk: false,
    urgency: 'OK',
    reason: `Cushion ${cushionPct.toFixed(1)}% safe for ${dte} DTE`,
  };
}

/**
 * Get comprehensive exit recommendation for a position
 *
 * @param profitCapturedPct - Percentage of max profit captured
 * @param dte - Days to expiration
 * @param cushionPct - Current cushion percentage
 * @returns Combined exit recommendation
 */
export function getExitRecommendation(
  profitCapturedPct: number,
  dte: number,
  cushionPct: number
): {
  action: 'CLOSE' | 'HOLD' | 'MONITOR';
  urgency: 'IMMEDIATE' | 'SOON' | 'NORMAL';
  reasons: string[];
} {
  const profitCheck = shouldCloseOnProfit(profitCapturedPct);
  const dteCheck = shouldCloseOnDTE(dte);
  const pinCheck = checkPinRisk(cushionPct, dte);

  const reasons: string[] = [];

  // Immediate close conditions
  if (dteCheck.urgency === 'FORCED') {
    reasons.push(dteCheck.reason);
    return { action: 'CLOSE', urgency: 'IMMEDIATE', reasons };
  }

  if (pinCheck.urgency === 'EXIT') {
    reasons.push(pinCheck.reason);
    return { action: 'CLOSE', urgency: 'IMMEDIATE', reasons };
  }

  if (
    profitCheck.shouldClose &&
    profitCapturedPct >= getExitConfig().profit.greed_limit_pct
  ) {
    reasons.push(profitCheck.reason);
    return { action: 'CLOSE', urgency: 'IMMEDIATE', reasons };
  }

  // Soon close conditions
  if (profitCheck.shouldClose) {
    reasons.push(profitCheck.reason);
  }
  if (dteCheck.urgency === 'WARNING') {
    reasons.push(dteCheck.reason);
  }
  if (pinCheck.urgency === 'WARNING') {
    reasons.push(pinCheck.reason);
  }

  if (reasons.length > 0) {
    const shouldClose =
      profitCheck.shouldClose || dteCheck.urgency === 'WARNING';
    return {
      action: shouldClose ? 'CLOSE' : 'MONITOR',
      urgency: 'SOON',
      reasons,
    };
  }

  // Normal hold
  return {
    action: 'HOLD',
    urgency: 'NORMAL',
    reasons: ['Position within normal parameters'],
  };
}

// ============================================================================
// ENTRY VALIDATION HELPERS
// ============================================================================

/**
 * Check if RSI is in valid entry range
 */
export function isRSIValid(
  rsi: number,
  adx?: number
): { valid: boolean; reason: string } {
  const { momentum } = getEntryConfig();

  // ADX exception: strong trend allows higher RSI
  if (adx && adx > 40 && rsi <= 65) {
    return {
      valid: true,
      reason: `RSI ${rsi.toFixed(0)} acceptable due to strong trend (ADX ${adx.toFixed(0)} > 40)`,
    };
  }

  if (rsi < momentum.rsi_min) {
    return {
      valid: false,
      reason: `RSI ${rsi.toFixed(0)} below minimum (${momentum.rsi_min}) - oversold`,
    };
  }

  if (rsi > momentum.rsi_max) {
    return {
      valid: false,
      reason: `RSI ${rsi.toFixed(0)} above maximum (${momentum.rsi_max}) - overbought`,
    };
  }

  if (rsi >= momentum.rsi_ideal_min && rsi <= momentum.rsi_ideal_max) {
    return {
      valid: true,
      reason: `RSI ${rsi.toFixed(0)} in ideal range (${momentum.rsi_ideal_min}-${momentum.rsi_ideal_max})`,
    };
  }

  return {
    valid: true,
    reason: `RSI ${rsi.toFixed(0)} acceptable (${momentum.rsi_min}-${momentum.rsi_max})`,
  };
}

/**
 * Check if cushion is sufficient
 */
export function isCushionValid(cushion: number): {
  valid: boolean;
  quality: 'EXCELLENT' | 'PREFERRED' | 'MINIMUM' | 'INSUFFICIENT';
  reason: string;
} {
  const { cushion: config } = getEntryConfig();

  if (cushion >= config.excellent_pct) {
    return {
      valid: true,
      quality: 'EXCELLENT',
      reason: `${cushion.toFixed(1)}% cushion >= excellent (${config.excellent_pct}%)`,
    };
  }

  if (cushion >= config.preferred_pct) {
    return {
      valid: true,
      quality: 'PREFERRED',
      reason: `${cushion.toFixed(1)}% cushion >= preferred (${config.preferred_pct}%)`,
    };
  }

  if (cushion >= config.minimum_pct) {
    return {
      valid: true,
      quality: 'MINIMUM',
      reason: `${cushion.toFixed(1)}% cushion at minimum (${config.minimum_pct}%)`,
    };
  }

  return {
    valid: false,
    quality: 'INSUFFICIENT',
    reason: `${cushion.toFixed(1)}% cushion below minimum (${config.minimum_pct}%)`,
  };
}

/**
 * Check if earnings date is safe
 */
export function isEarningsSafe(daysUntilEarnings: number | null): {
  safe: boolean;
  reason: string;
} {
  if (daysUntilEarnings === null) {
    return { safe: true, reason: 'No earnings date found - assume safe' };
  }

  const { earnings } = getEntryConfig();

  if (daysUntilEarnings >= earnings.preferred_days_until) {
    return {
      safe: true,
      reason: `Earnings ${daysUntilEarnings} days out >= preferred (${earnings.preferred_days_until})`,
    };
  }

  if (daysUntilEarnings >= earnings.min_days_until) {
    return {
      safe: true,
      reason: `Earnings ${daysUntilEarnings} days out - monitor closely`,
    };
  }

  return {
    safe: false,
    reason: `Earnings in ${daysUntilEarnings} days < minimum (${earnings.min_days_until}) - AVOID`,
  };
}
