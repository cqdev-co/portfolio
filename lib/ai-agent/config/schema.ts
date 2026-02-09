/**
 * Strategy Configuration Zod Schema
 *
 * Runtime validation for strategy.config.yaml to ensure all fields
 * are well-formed and within sane ranges. This catches misconfigurations
 * BEFORE they affect real trading decisions.
 *
 * @example
 * ```typescript
 * import { validateStrategyConfig } from '@lib/ai-agent/config/schema';
 *
 * const config = getStrategyConfig();
 * const result = validateStrategyConfig(config);
 * if (!result.success) {
 *   console.error('Invalid strategy config:', result.error.issues);
 * }
 * ```
 */

import { z } from 'zod';

// ============================================================================
// ENTRY CRITERIA SCHEMAS
// ============================================================================

const trendSchema = z.object({
  above_ma200: z.boolean(),
  above_ma50: z.boolean(),
  ma50_above_ma200: z.boolean(),
});

const momentumSchema = z
  .object({
    rsi_min: z.number().min(0).max(100),
    rsi_max: z.number().min(0).max(100),
    rsi_ideal_min: z.number().min(0).max(100),
    rsi_ideal_max: z.number().min(0).max(100),
  })
  .refine((data) => data.rsi_min < data.rsi_max, {
    message: 'rsi_min must be less than rsi_max',
  })
  .refine((data) => data.rsi_ideal_min < data.rsi_ideal_max, {
    message: 'rsi_ideal_min must be less than rsi_ideal_max',
  })
  .refine((data) => data.rsi_ideal_min >= data.rsi_min, {
    message: 'rsi_ideal_min must be >= rsi_min',
  })
  .refine((data) => data.rsi_ideal_max <= data.rsi_max, {
    message: 'rsi_ideal_max must be <= rsi_max',
  });

const cushionSchema = z
  .object({
    minimum_pct: z.number().min(0).max(100),
    preferred_pct: z.number().min(0).max(100),
    excellent_pct: z.number().min(0).max(100),
  })
  .refine((data) => data.minimum_pct < data.preferred_pct, {
    message: 'minimum_pct must be less than preferred_pct',
  })
  .refine((data) => data.preferred_pct < data.excellent_pct, {
    message: 'preferred_pct must be less than excellent_pct',
  });

const volatilitySchema = z
  .object({
    iv_max_pct: z.number().min(0).max(200),
    iv_preferred_max_pct: z.number().min(0).max(200),
    iv_rank_max: z.number().min(0).max(100),
    avoid_if_iv_above: z.number().min(0).max(200),
  })
  .refine((data) => data.iv_preferred_max_pct <= data.iv_max_pct, {
    message: 'iv_preferred_max_pct must be <= iv_max_pct',
  })
  .refine((data) => data.iv_max_pct <= data.avoid_if_iv_above, {
    message: 'iv_max_pct must be <= avoid_if_iv_above',
  });

const earningsSchema = z
  .object({
    min_days_until: z.number().int().min(0),
    preferred_days_until: z.number().int().min(0),
    never_hold_through: z.boolean(),
  })
  .refine((data) => data.min_days_until <= data.preferred_days_until, {
    message: 'min_days_until must be <= preferred_days_until',
  });

const sentimentSchema = z
  .object({
    analyst_bullish_min_pct: z.number().min(0).max(100),
    analyst_bullish_preferred: z.number().min(0).max(100),
    analyst_count_min: z.number().int().min(0),
  })
  .refine(
    (data) => data.analyst_bullish_min_pct <= data.analyst_bullish_preferred,
    {
      message: 'analyst_bullish_min_pct must be <= analyst_bullish_preferred',
    }
  );

const fundamentalsSchema = z.object({
  require_positive_eps: z.boolean(),
  max_pe_ratio: z.number().min(0),
  min_market_cap_b: z.number().min(0),
});

const spreadEntrySchema = z
  .object({
    min_return_on_risk_pct: z.number().min(0).max(100),
    preferred_ror_pct: z.number().min(0).max(100),
    min_open_interest: z.number().int().min(0),
    max_bid_ask_spread_pct: z.number().min(0).max(100),
    min_pop_pct: z.number().min(0).max(100).optional(),
    min_debit_ratio_pct: z.number().min(0).max(100).optional(),
    max_debit_ratio_pct: z.number().min(0).max(100).optional(),
  })
  .refine((data) => data.min_return_on_risk_pct <= data.preferred_ror_pct, {
    message: 'min_return_on_risk_pct must be <= preferred_ror_pct',
  });

const entrySchema = z.object({
  trend: trendSchema,
  momentum: momentumSchema,
  cushion: cushionSchema,
  volatility: volatilitySchema,
  earnings: earningsSchema,
  sentiment: sentimentSchema,
  fundamentals: fundamentalsSchema,
  spread: spreadEntrySchema,
});

// ============================================================================
// EXIT RULES SCHEMAS
// ============================================================================

const profitSchema = z
  .object({
    min_acceptable_pct: z.number().min(0).max(100),
    target_pct: z.number().min(0).max(100),
    greed_limit_pct: z.number().min(0).max(100),
    early_exit_threshold_pct: z.number().min(0).max(100),
    early_exit_days: z.number().int().min(0),
    never_chase_max_profit: z.boolean(),
    scale_out: z.boolean(),
  })
  .refine((data) => data.min_acceptable_pct <= data.target_pct, {
    message: 'min_acceptable_pct must be <= target_pct',
  })
  .refine((data) => data.target_pct <= data.greed_limit_pct, {
    message: 'target_pct must be <= greed_limit_pct',
  });

const stopLossSchema = z.object({
  max_loss_pct: z.number().min(0).max(100),
  time_stop_days: z.number().int().min(0).nullable(),
});

const timeExitSchema = z
  .object({
    max_hold_days: z.number().int().min(1),
    gamma_risk_zone_dte: z.number().int().min(0),
    forced_exit_dte: z.number().int().min(0),
    exit_rule: z.string().min(1),
  })
  .refine((data) => data.forced_exit_dte <= data.gamma_risk_zone_dte, {
    message: 'forced_exit_dte must be <= gamma_risk_zone_dte',
  });

const eventExitSchema = z.object({
  exit_before_earnings: z.boolean(),
  exit_on_major_news: z.boolean(),
});

const pinRiskSchema = z.object({
  enabled: z.boolean(),
  cushion_warning_pct: z.number().min(0).max(100),
  cushion_exit_pct: z.number().min(0).max(100),
  dte_threshold: z.number().int().min(0),
});

const exitSchema = z.object({
  profit: profitSchema,
  stop_loss: stopLossSchema,
  time: timeExitSchema,
  events: eventExitSchema,
  pin_risk: pinRiskSchema,
});

// ============================================================================
// POSITION SIZING SCHEMAS
// ============================================================================

const scalingTierSchema = z
  .object({
    account_min: z.number().min(0),
    account_max: z.number().min(0),
    max_position_pct: z.number().min(0).max(100),
    max_positions: z.number().int().min(1),
  })
  .refine((data) => data.account_min < data.account_max, {
    message: 'account_min must be less than account_max',
  });

const positionSizingSchema = z.object({
  max_single_position_pct: z.number().min(0).max(100),
  preferred_position_pct: z.number().min(0).max(100),
  min_position_pct: z.number().min(0).max(100),
  max_total_deployed_pct: z.number().min(0).max(100),
  preferred_deployed_pct: z.number().min(0).max(100),
  max_concurrent_positions: z.number().int().min(1),
  scaling: z.array(scalingTierSchema).min(1),
});

// ============================================================================
// SPREAD PARAMETERS SCHEMAS
// ============================================================================

const dteSchema = z
  .object({
    target: z.number().int().min(1),
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  })
  .refine((data) => data.min <= data.target && data.target <= data.max, {
    message: 'DTE must satisfy: min <= target <= max',
  });

const spreadWidthSchema = z.object({
  account_max: z.number().min(0),
  width: z.number().min(0),
  typical_debit: z.number().min(0),
});

const strikeSchema = z
  .object({
    long_strike_delta_min: z.number().min(0).max(1),
    long_strike_delta_max: z.number().min(0).max(1),
    short_strike_delta_min: z.number().min(0).max(1),
    short_strike_delta_max: z.number().min(0).max(1),
  })
  .refine((data) => data.long_strike_delta_min < data.long_strike_delta_max, {
    message: 'long_strike_delta_min must be less than long_strike_delta_max',
  })
  .refine((data) => data.short_strike_delta_min < data.short_strike_delta_max, {
    message: 'short_strike_delta_min must be less than short_strike_delta_max',
  });

const spreadParamsSchema = z.object({
  dte: dteSchema,
  width: z.array(spreadWidthSchema).min(1),
  strikes: strikeSchema,
});

// ============================================================================
// RISK MANAGEMENT SCHEMAS
// ============================================================================

const circuitBreakerSchema = z.object({
  consecutive_losses_pause: z.number().int().min(1),
  pause_duration_hours: z.number().min(0),
  monthly_drawdown_reduce_pct: z.number().min(0).max(100),
  monthly_drawdown_stop_pct: z.number().min(0).max(100),
});

const correlationSchema = z.object({
  max_same_sector: z.number().int().min(1),
  max_correlated_positions: z.number().int().min(1),
});

const blacklistSchema = z.object({
  tickers: z.array(z.string()),
  sectors: z.array(z.string()),
});

const riskManagementSchema = z.object({
  circuit_breakers: circuitBreakerSchema,
  correlation: correlationSchema,
  blacklist: blacklistSchema,
});

// ============================================================================
// UNIVERSE SCHEMAS
// ============================================================================

const universeSchema = z.object({
  tier1: z.array(z.string()).min(1),
  tier2: z.array(z.string()),
  tier3: z.array(z.string()),
  scanner: z.object({
    min_price: z.number().min(0),
    max_price: z.number().min(0),
    min_volume: z.number().int().min(0),
    min_market_cap_b: z.number().min(0),
  }),
});

// ============================================================================
// MARKET REGIME SCHEMAS
// ============================================================================

const regimeAdjustmentsSchema = z.object({
  min_score: z.number().min(0).max(100),
  rsi_max: z.number().min(0).max(100),
  position_size_multiplier: z.number().min(0).max(2),
  max_concurrent_positions: z.number().int().min(1),
  require_ma50_above: z.boolean().optional(),
  require_golden_cross: z.boolean().optional(),
  cushion_minimum_pct: z.number().min(0).max(100).optional(),
  rsi_min: z.number().min(0).max(100).optional(),
});

const regimeEntrySchema = z.object({
  enabled: z.boolean(),
  description: z.string().min(1),
  adjustments: regimeAdjustmentsSchema,
});

const marketRegimeSchema = z.object({
  bull: regimeEntrySchema,
  neutral: regimeEntrySchema,
  bear: regimeEntrySchema,
  no_trade: z.object({
    spy_below_ma200_pct: z.number(),
    vix_above: z.number().min(0),
    consecutive_down_days: z.number().int().min(1),
  }),
});

// ============================================================================
// LESSON SCHEMA
// ============================================================================

const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  date: z.string().min(1),
  ticker: z.string().optional(),
  cost: z.number().optional(),
  rules_changed: z.array(z.string()),
  summary: z.string().min(1),
});

// ============================================================================
// FULL CONFIG SCHEMA
// ============================================================================

/**
 * Complete Zod schema for strategy.config.yaml
 *
 * Validates:
 * - All required fields are present
 * - Numeric fields are within sane ranges (0-100 for percentages, etc.)
 * - Relational constraints hold (min < max, preferred between min and max)
 * - Arrays are non-empty where required
 */
export const strategyConfigSchema = z.object({
  strategy: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1),
  }),
  entry: entrySchema,
  exit: exitSchema,
  position_sizing: positionSizingSchema,
  spread_params: spreadParamsSchema,
  risk_management: riskManagementSchema,
  universe: universeSchema,
  market_regime: marketRegimeSchema,
  alerts: z.object({
    triggers: z.record(z.string(), z.boolean()),
  }),
  validation: z.object({
    min_ai_score: z.number().min(0).max(100),
    min_confidence: z.number().min(0).max(100),
    human_confirm_above: z.number().min(0),
  }),
  lessons: z.array(lessonSchema).optional(),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export type StrategyConfigInput = z.input<typeof strategyConfigSchema>;

/**
 * Validate a parsed strategy config object.
 *
 * Returns a Zod SafeParseResult:
 * - `result.success === true` → `result.data` contains the validated config
 * - `result.success === false` → `result.error.issues` contains validation errors
 *
 * @example
 * ```typescript
 * const result = validateStrategyConfig(parsedYaml);
 * if (!result.success) {
 *   result.error.issues.forEach(issue => {
 *     console.error(`${issue.path.join('.')}: ${issue.message}`);
 *   });
 *   process.exit(1);
 * }
 * ```
 */
export function validateStrategyConfig(config: unknown) {
  return strategyConfigSchema.safeParse(config);
}

/**
 * Validate and throw on failure. Use at startup to fail fast.
 *
 * @throws {z.ZodError} if config is invalid
 */
export function assertValidStrategyConfig(config: unknown) {
  return strategyConfigSchema.parse(config);
}
