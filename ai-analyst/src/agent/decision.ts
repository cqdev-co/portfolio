/**
 * Alert Decision Engine
 * Determines whether to trigger alerts based on scan results and criteria
 * 
 * Supports DYNAMIC THRESHOLDS based on market regime:
 * - Bull market: Widen RSI range (catch shallow dips)
 * - Bear market: Tighten RSI range (wait for capitulation)
 * - High VIX: Relax IV threshold (everything is expensive)
 * - Pullback detected: Widen RSI range (opportunity!)
 */

import type { ScanResult } from "../services/scanner.ts";
import type { WatchlistItem, AlertType, AlertPriority } from "../services/supabase.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface MarketContext {
  regime: "RISK_ON" | "RISK_OFF" | "NEUTRAL" | "VOLATILE";
  spyTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  vix: number;
  vixLevel: "LOW" | "NORMAL" | "ELEVATED" | "HIGH";
}

export interface DynamicAdjustments {
  rsiLowAdjust: number;      // Added to RSI low threshold
  rsiHighAdjust: number;     // Added to RSI high threshold
  ivAdjust: number;          // Added to IV threshold
  cushionAdjust: number;     // Added to cushion threshold
  reasons: string[];         // Why adjustments were made
}

export interface AlertCriteria {
  // Entry signal conditions (all must be true)
  rsiInBuyZone: boolean;           // RSI within target range
  ivBelowThreshold: boolean;       // IV percentile below watchlist threshold
  aboveMA200: boolean;             // Above 200-day MA
  cushionAboveMin: boolean;        // Cushion meets minimum
  gradeMetMin: boolean;            // Grade meets minimum

  // Actual values used (after dynamic adjustments)
  rsiLow: number;                  // Effective RSI low threshold
  rsiHigh: number;                 // Effective RSI high threshold
  ivPercentile?: number;           // Current IV percentile
  ivThreshold?: number;            // Effective IV threshold (after adjustment)

  // Dynamic adjustment info
  adjustments?: DynamicAdjustments;

  // Risk flags (any triggers alert)
  earningsWithin7Days: boolean;
  cushionBelow5Percent: boolean;
  dteBelow5Days: boolean;
}

export interface AlertDecision {
  trigger: boolean;
  alertType: AlertType;
  priority: AlertPriority;
  reason: string;
  data: Record<string, unknown>;
}

export interface PositionRiskCheck {
  position: Position;
  risks: {
    type: "DTE" | "CUSHION" | "EARNINGS";
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
  }[];
  needsAlert: boolean;
}

// ============================================================================
// DYNAMIC THRESHOLD ADJUSTMENTS
// ============================================================================

/**
 * Calculate dynamic threshold adjustments based on market conditions
 */
export function calculateDynamicAdjustments(
  result: ScanResult,
  context?: MarketContext
): DynamicAdjustments {
  const adjustments: DynamicAdjustments = {
    rsiLowAdjust: 0,
    rsiHighAdjust: 0,
    ivAdjust: 0,
    cushionAdjust: 0,
    reasons: [],
  };

  if (!context) return adjustments;

  // 1. Market Regime Adjustments
  if (context.spyTrend === "BULLISH") {
    // Bull market: dips are shallow, widen RSI range
    adjustments.rsiHighAdjust += 5;
    adjustments.reasons.push("Bull market: RSI +5 (shallow dips)");
  } else if (context.spyTrend === "BEARISH") {
    // Bear market: wait for real capitulation
    adjustments.rsiHighAdjust -= 5;
    adjustments.rsiLowAdjust -= 3;
    adjustments.reasons.push("Bear market: RSI -5 (wait for capitulation)");
  }

  // 2. VIX-Based IV Adjustment
  if (context.vixLevel === "HIGH" || context.vix > 25) {
    // High VIX: everything is expensive, relax IV threshold
    adjustments.ivAdjust += 15;
    adjustments.reasons.push(`High VIX (${context.vix.toFixed(0)}): IV +15%`);
  } else if (context.vixLevel === "ELEVATED" || context.vix > 20) {
    adjustments.ivAdjust += 8;
    adjustments.reasons.push(`Elevated VIX (${context.vix.toFixed(0)}): IV +8%`);
  } else if (context.vixLevel === "LOW" || context.vix < 15) {
    // Low VIX: can be stricter on IV
    adjustments.ivAdjust -= 5;
    adjustments.reasons.push(`Low VIX (${context.vix.toFixed(0)}): IV -5%`);
  }

  // 3. Ticker-Specific: Pullback Detection
  // If price dropped significantly from recent high, this is an opportunity
  const changePct = result.changePct;
  if (changePct <= -3) {
    // Significant daily drop - widen RSI range to catch the dip
    adjustments.rsiHighAdjust += 8;
    adjustments.reasons.push(`Pullback ${changePct.toFixed(1)}%: RSI +8`);
  } else if (changePct <= -1.5) {
    adjustments.rsiHighAdjust += 4;
    adjustments.reasons.push(`Dip ${changePct.toFixed(1)}%: RSI +4`);
  }

  // 4. Volatile Regime: Relax cushion slightly
  if (context.regime === "VOLATILE") {
    adjustments.cushionAdjust -= 1;
    adjustments.reasons.push("Volatile regime: cushion -1%");
  }

  return adjustments;
}

// ============================================================================
// ENTRY SIGNAL DECISION
// ============================================================================

/**
 * Evaluate if a scan result should trigger an entry signal alert
 * @param context Optional market context for dynamic threshold adjustments
 */
export function evaluateEntrySignal(
  result: ScanResult,
  watchlistItem: WatchlistItem,
  context?: MarketContext
): AlertDecision {
  const criteria = buildCriteria(result, watchlistItem, context);

  // Check if all entry conditions are met
  const entryConditionsMet = 
    criteria.rsiInBuyZone &&
    criteria.ivBelowThreshold &&
    criteria.aboveMA200 &&
    criteria.cushionAboveMin &&
    criteria.gradeMetMin &&
    !criteria.earningsWithin7Days;

  if (!entryConditionsMet) {
    // Build specific rejection reason with effective thresholds
    const rejectionReasons: string[] = [];
    if (!criteria.rsiInBuyZone) {
      rejectionReasons.push(`RSI outside range (${criteria.rsiLow}-${criteria.rsiHigh})`);
    }
    if (!criteria.ivBelowThreshold) {
      rejectionReasons.push(`IV too high (${criteria.ivPercentile}% > ${criteria.ivThreshold}%)`);
    }
    if (!criteria.aboveMA200) rejectionReasons.push("Below MA200");
    if (!criteria.cushionAboveMin) rejectionReasons.push("Cushion too low");
    if (!criteria.gradeMetMin) rejectionReasons.push("Grade below minimum");
    if (criteria.earningsWithin7Days) rejectionReasons.push("Earnings within 7 days");

    return {
      trigger: false,
      alertType: "ENTRY_SIGNAL",
      priority: "LOW",
      reason: rejectionReasons.join(", ") || "Entry conditions not met",
      data: { criteria, adjustments: criteria.adjustments },
    };
  }

  // Determine priority based on grade
  let priority: AlertPriority = "MEDIUM";
  if (result.grade.grade.startsWith("A")) {
    priority = "HIGH";
  } else if (result.grade.grade.startsWith("C")) {
    priority = "LOW";
  }

  // Build reason string
  const reasons: string[] = [];
  if (result.grade.rsi !== undefined) {
    reasons.push(`RSI ${result.grade.rsi.toFixed(0)}`);
  }
  if (result.iv?.percentile !== undefined) {
    reasons.push(`IV ${result.iv.percentile}%`);
  }
  if (result.spread?.cushion) {
    reasons.push(`${result.spread.cushion.toFixed(1)}% cushion`);
  }
  reasons.push(`Grade ${result.grade.grade}`);

  return {
    trigger: true,
    alertType: "ENTRY_SIGNAL",
    priority,
    reason: reasons.join(", "),
    data: {
      ticker: result.ticker,
      price: result.price,
      changePct: result.changePct,
      grade: result.grade.grade,
      rsi: result.grade.rsi,
      iv: result.iv,
      spread: result.spread,
      risk: result.risk,
      criteria,
    },
  };
}

/**
 * Build criteria object from scan result and watchlist item
 * Applies dynamic adjustments based on market context
 */
function buildCriteria(
  result: ScanResult,
  watchlistItem: WatchlistItem,
  context?: MarketContext
): AlertCriteria {
  const rsi = result.grade.rsi;
  const cushion = result.spread?.cushion;
  const earningsDays = result.grade.earningsDays;
  const ivPercentile = result.iv?.percentile;

  // Calculate dynamic adjustments
  const adjustments = calculateDynamicAdjustments(result, context);

  // Apply adjustments to thresholds
  const effectiveRsiLow = Math.max(15, watchlistItem.targetRsiLow + adjustments.rsiLowAdjust);
  const effectiveRsiHigh = Math.min(80, watchlistItem.targetRsiHigh + adjustments.rsiHighAdjust);
  const effectiveIvThreshold = watchlistItem.ivPercentileMin 
    ? Math.min(100, Math.max(0, watchlistItem.ivPercentileMin + adjustments.ivAdjust))
    : undefined;
  const effectiveCushion = Math.max(3, watchlistItem.minCushionPct + adjustments.cushionAdjust);

  // IV check with dynamic threshold
  const ivBelowThreshold = 
    ivPercentile === undefined ||     // No IV data - pass
    !effectiveIvThreshold ||          // No threshold set - pass
    ivPercentile <= effectiveIvThreshold;  // IV below adjusted threshold - pass

  return {
    // Entry conditions with dynamic thresholds
    rsiInBuyZone: rsi !== undefined && 
      rsi >= effectiveRsiLow && 
      rsi <= effectiveRsiHigh,
    
    rsiLow: effectiveRsiLow,
    rsiHigh: effectiveRsiHigh,
    
    ivBelowThreshold,
    ivPercentile,
    ivThreshold: effectiveIvThreshold,
    
    aboveMA200: result.grade.aboveMA200 !== false,
    
    cushionAboveMin: cushion !== undefined && 
      cushion >= effectiveCushion,
    
    gradeMetMin: gradeToValue(result.grade.grade) >= 
      gradeToValue(watchlistItem.minGrade),

    // Include adjustments for logging
    adjustments: adjustments.reasons.length > 0 ? adjustments : undefined,

    // Risk flags
    earningsWithin7Days: earningsDays !== null && earningsDays <= 7,
    
    cushionBelow5Percent: cushion !== undefined && cushion < 5,
    
    dteBelow5Days: result.spread?.dte !== undefined && result.spread.dte < 5,
  };
}

// ============================================================================
// POSITION RISK DECISION
// ============================================================================

/**
 * Check a position for risk conditions
 */
export function evaluatePositionRisk(
  position: Position,
  currentPrice?: number
): PositionRiskCheck {
  const risks: PositionRiskCheck["risks"] = [];
  const dte = position.dte ?? 0;

  // DTE risk
  if (dte <= 0) {
    risks.push({
      type: "DTE",
      severity: "HIGH",
      message: "Position expired or expiring today",
    });
  } else if (dte <= 5) {
    risks.push({
      type: "DTE",
      severity: "HIGH",
      message: `Only ${dte} DTE remaining - consider rolling or closing`,
    });
  } else if (dte <= 10) {
    risks.push({
      type: "DTE",
      severity: "MEDIUM",
      message: `${dte} DTE - approaching expiration`,
    });
  }

  // Cushion risk (if we have current price)
  if (currentPrice && position.longStrike) {
    const cushion = ((currentPrice - position.longStrike) / currentPrice) * 100;
    
    if (cushion < 0) {
      risks.push({
        type: "CUSHION",
        severity: "HIGH",
        message: `Price below long strike - position at max loss risk`,
      });
    } else if (cushion < 3) {
      risks.push({
        type: "CUSHION",
        severity: "HIGH",
        message: `Cushion only ${cushion.toFixed(1)}% - consider exit`,
      });
    } else if (cushion < 5) {
      risks.push({
        type: "CUSHION",
        severity: "MEDIUM",
        message: `Cushion ${cushion.toFixed(1)}% - monitor closely`,
      });
    }
  }

  // Determine if alert is needed
  const needsAlert = risks.some(r => r.severity === "HIGH");

  return {
    position,
    risks,
    needsAlert,
  };
}

/**
 * Build position risk alert decision
 */
export function buildPositionRiskAlert(
  check: PositionRiskCheck
): AlertDecision {
  if (!check.needsAlert) {
    return {
      trigger: false,
      alertType: "POSITION_RISK",
      priority: "LOW",
      reason: "No high-severity risks",
      data: {},
    };
  }

  const highRisks = check.risks.filter(r => r.severity === "HIGH");
  const reason = highRisks.map(r => r.message).join("; ");

  return {
    trigger: true,
    alertType: "POSITION_RISK",
    priority: "HIGH",
    reason,
    data: {
      ticker: check.position.ticker,
      positionType: check.position.positionType,
      strikes: check.position.longStrike && check.position.shortStrike
        ? `$${check.position.longStrike}/$${check.position.shortStrike}`
        : undefined,
      dte: check.position.dte,
      risks: check.risks,
    },
  };
}

// ============================================================================
// EARNINGS WARNING DECISION
// ============================================================================

/**
 * Check if earnings warning should be triggered
 */
export function evaluateEarningsWarning(
  ticker: string,
  earningsDays: number | null,
  hasPosition: boolean
): AlertDecision {
  if (earningsDays === null || earningsDays > 7) {
    return {
      trigger: false,
      alertType: "EARNINGS_WARNING",
      priority: "LOW",
      reason: "No earnings within 7 days",
      data: {},
    };
  }

  const priority: AlertPriority = earningsDays <= 3 ? "HIGH" : "MEDIUM";
  const reason = hasPosition
    ? `Earnings in ${earningsDays} days - consider closing position`
    : `Earnings in ${earningsDays} days - avoid new entries`;

  return {
    trigger: true,
    alertType: "EARNINGS_WARNING",
    priority,
    reason,
    data: {
      ticker,
      earningsDays,
      hasPosition,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function gradeToValue(grade: string): number {
  const grades: Record<string, number> = {
    'A+': 12, 'A': 11, 'A-': 10,
    'B+': 9, 'B': 8, 'B-': 7,
    'C+': 6, 'C': 5, 'C-': 4,
    'D': 3, 'F': 1,
  };
  return grades[grade] ?? 0;
}

/**
 * Should we send this alert based on priority and configuration?
 */
export function shouldSendAlert(
  decision: AlertDecision,
  config: {
    minPriority?: AlertPriority;
    aiReviewEnabled?: boolean;
    minConviction?: number;
  },
  aiConviction?: number
): boolean {
  if (!decision.trigger) return false;

  // Priority filter
  const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const minPriorityValue = priorityOrder[config.minPriority ?? "LOW"];
  const alertPriorityValue = priorityOrder[decision.priority];
  
  if (alertPriorityValue < minPriorityValue) {
    return false;
  }

  // AI conviction filter
  if (config.aiReviewEnabled && config.minConviction) {
    if (aiConviction === undefined || aiConviction < config.minConviction) {
      return false;
    }
  }

  return true;
}
