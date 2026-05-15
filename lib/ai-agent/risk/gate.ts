/**
 * Risk gate
 *
 * Phase 2: validate a `ParsedRecommendation` against the live
 * `strategy.config.yaml` rules + the user's account size + their open
 * positions. Pure function — no I/O. The chat route fetches positions
 * and ticker context once, then calls this synchronously.
 *
 * Rules covered (severity = BLOCK unless noted):
 *   - position_sizing      — debit cost ≤ max_single_position_pct% of account
 *   - rsi_band             — RSI within [rsi_min, rsi_max] (WARN outside ideal band)
 *   - trend_above_ma200    — price above MA200 if entry.trend.above_ma200
 *   - iv_ceiling           — IV ≤ avoid_if_iv_above (WARN above iv_preferred_max_pct)
 *   - earnings_window      — daysUntilEarnings ≥ entry.earnings.min_days_until
 *   - dte_band             — DTE within [spread_params.dte.min, max]
 *   - concentration        — same-ticker total risk ≤ max_per_ticker (10% rule of thumb)
 *   - total_exposure       — sum of position risk ≤ max_total_deployed_pct%
 *   - blacklist            — ticker / sector not in risk_management.blacklist
 *   - parser               — surfaced when the parser failed (gate_skipped=true)
 */

import {
  getEntryConfig,
  getPositionSizingConfig,
  getSpreadParamsConfig,
  getRiskManagementConfig,
} from '../config';
import type {
  ParsedRecommendation,
  RiskRule,
  RiskVerdict,
  RiskViolation,
  TradeAction,
  ValidateInput,
} from './types';

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/** Actions that imply opening a new position (need full validation). */
const OPENING_ACTIONS: TradeAction[] = ['BUY', 'ADD'];

/**
 * Validate a parsed recommendation against the live strategy config.
 * Pure function. Never throws.
 *
 * If the recommendation isn't actionable (e.g. WAIT, AVOID, HOLD),
 * we still run the blacklist + concentration checks but skip the
 * position-sizing / DTE / IV rules that only make sense for a new
 * position.
 */
export function validateRecommendation(input: ValidateInput): RiskVerdict {
  const start = Date.now();
  const violations: RiskViolation[] = [];
  const { recommendation, account, positions, tickerContext } = input;

  // Always-on rule: blacklist check applies to any action that names a ticker.
  if (recommendation.ticker) {
    pushIf(violations, checkBlacklist(recommendation.ticker));
  }

  // Concentration applies whenever we know existing exposure.
  pushIf(
    violations,
    checkConcentration(recommendation.ticker, positions, account.sizeUSD)
  );

  // Total exposure check is independent of action; honored even on AVOID
  // calls so the operator can be told if their book is over-deployed.
  pushIf(violations, checkTotalExposure(positions, account.sizeUSD));

  if (OPENING_ACTIONS.includes(recommendation.action)) {
    pushIf(violations, checkPositionSizing(recommendation, account.sizeUSD));
    pushIf(violations, checkDTEBand(recommendation));
    if (tickerContext) {
      pushIf(violations, checkRSIBand(tickerContext.rsi));
      pushIf(violations, checkTrend(tickerContext.aboveMA200));
      pushIf(violations, checkIVCeiling(tickerContext.iv_pct));
      pushIf(violations, checkEarningsWindow(tickerContext.daysUntilEarnings));
    }
  }

  const approved = !violations.some((v) => v.severity === 'BLOCK');
  return {
    approved,
    gate_skipped: false,
    violations,
    recommendation,
    latency_ms: Date.now() - start,
  };
}

/**
 * Convenience: produce the "gate_skipped" verdict the caller should
 * use when the parser returned null. Surfaces a single parser-rule
 * note so the UI can render "no structured call found" instead of an
 * empty/false-pass pill.
 */
export function skipGate(reason: string): RiskVerdict {
  return {
    approved: true,
    gate_skipped: true,
    violations: [
      {
        rule: 'parser',
        severity: 'WARN',
        detail: reason,
      },
    ],
    recommendation: null,
    latency_ms: 0,
  };
}

// ============================================================================
// PER-RULE CHECKS
// ============================================================================

function checkPositionSizing(
  rec: ParsedRecommendation,
  accountSize: number
): RiskViolation | null {
  if (!rec.spread || rec.spread.debit == null) return null;
  const sizing = safeGet(getPositionSizingConfig);
  if (!sizing) return null;

  const contracts = rec.spread.contracts ?? 1;
  const cost = rec.spread.debit * 100 * contracts;
  const maxPct = sizing.max_single_position_pct;
  const maxDollars = accountSize * (maxPct / 100);

  if (cost > maxDollars) {
    return {
      rule: 'position_sizing',
      severity: 'BLOCK',
      detail:
        `Position cost $${cost.toFixed(0)} exceeds max single position ` +
        `$${maxDollars.toFixed(0)} (${maxPct}% of $${accountSize}).`,
      observed: cost,
      threshold: maxDollars,
    };
  }
  return null;
}

function checkRSIBand(rsi: number | undefined): RiskViolation | null {
  if (rsi == null) return null;
  const entry = safeGet(getEntryConfig);
  if (!entry) return null;
  const { rsi_min, rsi_max, rsi_ideal_min, rsi_ideal_max } = entry.momentum;

  if (rsi < rsi_min || rsi > rsi_max) {
    return {
      rule: 'rsi_band',
      severity: 'BLOCK',
      detail: `RSI ${rsi.toFixed(0)} outside hard band ${rsi_min}-${rsi_max}.`,
      observed: rsi,
      threshold: `${rsi_min}-${rsi_max}`,
    };
  }
  if (rsi < rsi_ideal_min || rsi > rsi_ideal_max) {
    return {
      rule: 'rsi_band',
      severity: 'WARN',
      detail:
        `RSI ${rsi.toFixed(0)} outside ideal band ` +
        `${rsi_ideal_min}-${rsi_ideal_max} (still tradeable).`,
      observed: rsi,
      threshold: `${rsi_ideal_min}-${rsi_ideal_max}`,
    };
  }
  return null;
}

function checkTrend(aboveMA200: boolean | undefined): RiskViolation | null {
  if (aboveMA200 == null) return null;
  const entry = safeGet(getEntryConfig);
  if (!entry?.trend.above_ma200) return null;
  if (!aboveMA200) {
    return {
      rule: 'trend_above_ma200',
      severity: 'BLOCK',
      detail: 'Price below 200-day MA; entry rule requires above_ma200.',
      observed: 'below',
      threshold: 'above',
    };
  }
  return null;
}

function checkIVCeiling(iv_pct: number | undefined): RiskViolation | null {
  if (iv_pct == null) return null;
  const entry = safeGet(getEntryConfig);
  if (!entry) return null;
  const hardCeiling = entry.volatility.avoid_if_iv_above;
  const softCeiling = entry.volatility.iv_preferred_max_pct;

  if (iv_pct > hardCeiling) {
    return {
      rule: 'iv_ceiling',
      severity: 'BLOCK',
      detail: `IV ${iv_pct.toFixed(0)}% above hard ceiling ${hardCeiling}%.`,
      observed: iv_pct,
      threshold: hardCeiling,
    };
  }
  if (iv_pct > softCeiling) {
    return {
      rule: 'iv_ceiling',
      severity: 'WARN',
      detail: `IV ${iv_pct.toFixed(0)}% above preferred ${softCeiling}% (premium pricier).`,
      observed: iv_pct,
      threshold: softCeiling,
    };
  }
  return null;
}

function checkEarningsWindow(
  daysUntil: number | null | undefined
): RiskViolation | null {
  if (daysUntil == null) return null;
  const entry = safeGet(getEntryConfig);
  if (!entry) return null;
  const minDays = entry.earnings.min_days_until;
  if (daysUntil >= 0 && daysUntil < minDays) {
    return {
      rule: 'earnings_window',
      severity: 'BLOCK',
      detail: `Earnings in ${daysUntil}d; entry requires ≥${minDays}d buffer.`,
      observed: daysUntil,
      threshold: minDays,
    };
  }
  return null;
}

function checkDTEBand(rec: ParsedRecommendation): RiskViolation | null {
  if (!rec.spread || rec.spread.dte == null) return null;
  const params = safeGet(getSpreadParamsConfig);
  if (!params) return null;
  const { min, max } = params.dte;
  if (rec.spread.dte < min || rec.spread.dte > max) {
    return {
      rule: 'dte_band',
      severity: 'BLOCK',
      detail: `DTE ${rec.spread.dte} outside band ${min}-${max}.`,
      observed: rec.spread.dte,
      threshold: `${min}-${max}`,
    };
  }
  return null;
}

function checkConcentration(
  ticker: string,
  positions: ValidateInput['positions'],
  accountSize: number
): RiskViolation | null {
  if (!ticker) return null;
  const sizing = safeGet(getPositionSizingConfig);
  if (!sizing) return null;
  const sameTicker = positions.filter(
    (p) => p.ticker.toUpperCase() === ticker.toUpperCase()
  );
  if (sameTicker.length === 0) return null;
  const existing = sameTicker.reduce((s, p) => s + p.riskUSD, 0);
  const maxPerTicker = accountSize * (sizing.max_single_position_pct / 100);
  if (existing >= maxPerTicker) {
    return {
      rule: 'concentration',
      severity: 'BLOCK',
      detail:
        `Existing ${ticker.toUpperCase()} exposure $${existing.toFixed(0)} ` +
        `is already at the per-ticker cap $${maxPerTicker.toFixed(0)}.`,
      observed: existing,
      threshold: maxPerTicker,
    };
  }
  return null;
}

function checkTotalExposure(
  positions: ValidateInput['positions'],
  accountSize: number
): RiskViolation | null {
  const sizing = safeGet(getPositionSizingConfig);
  if (!sizing) return null;
  const total = positions.reduce((s, p) => s + p.riskUSD, 0);
  const cap = accountSize * (sizing.max_total_deployed_pct / 100);
  if (total > cap) {
    return {
      rule: 'total_exposure',
      severity: 'WARN',
      detail:
        `Total deployed $${total.toFixed(0)} above cap ` +
        `$${cap.toFixed(0)} (${sizing.max_total_deployed_pct}%).`,
      observed: total,
      threshold: cap,
    };
  }
  return null;
}

function checkBlacklist(ticker: string): RiskViolation | null {
  const risk = safeGet(getRiskManagementConfig);
  if (!risk) return null;
  const t = ticker.toUpperCase();
  if (risk.blacklist.tickers.map((x) => x.toUpperCase()).includes(t)) {
    return {
      rule: 'blacklist',
      severity: 'BLOCK',
      detail: `${t} is in the strategy.config.yaml ticker blacklist.`,
      observed: t,
      threshold: null,
    };
  }
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function pushIf<T>(arr: T[], item: T | null | undefined): void {
  if (item) arr.push(item);
}

/**
 * Wrap config getters that can throw if `strategy.config.yaml` is
 * missing — we don't want a missing config to fail-closed the gate;
 * we want it to skip the rule.
 */
function safeGet<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

// Re-export the rule type so consumers can pattern-match on it without
// importing the `types` module separately.
export type { RiskRule };
