/**
 * Spread Entry Decision Engine
 * v1.5.0: Transforms analysis into actionable entry decisions
 * 
 * Combines:
 * - Stock score (technical/fundamental/analyst)
 * - Entry checklist results
 * - Momentum signals
 * - Relative strength
 * - Market regime
 * - Spread quality metrics
 * 
 * Outputs:
 * - Enter Now / Wait / Pass decision
 * - Position sizing recommendation
 * - Confidence score
 * - Actionable guidance
 */

import type {
  EntryDecision,
  DecisionEngineInput,
  SpreadQualityScore,
  ConfidenceScore,
  ConfidenceLevel,
  PositionSizing,
  PositionSize,
  TimingAnalysis,
  ScoredSpread,
  EntryAction,
  Timeframe,
} from "../types/decision.ts";
import type { MarketRegime } from "../utils/market-regime.ts";
import { DEFAULT_ACCOUNT_SETTINGS } from "../types/decision.ts";

// ============================================================================
// SPREAD QUALITY SCORING
// ============================================================================

/**
 * Calculate spread quality score (0-100)
 * 
 * Factors:
 * - Intrinsic value % of cost (20 pts)
 * - Cushion % below current (15 pts)
 * - Delta alignment (10 pts)
 * - DTE alignment (10 pts)
 * - Spread width (5 pts)
 * - Return on risk (15 pts)
 * - Support protection (15 pts)
 * - Earnings risk (10 pts)
 */
export function calculateSpreadQualityScore(
  spread: DecisionEngineInput["spreadCandidates"][0],
  support1: number | undefined,
  daysToEarnings: number | undefined
): SpreadQualityScore {
  const breakdown = {
    intrinsicValue: 0,
    cushion: 0,
    delta: 0,
    dte: 0,
    spreadWidth: 0,
    returnOnRisk: 0,
    supportProtection: 0,
    earningsRisk: 0,
  };

  // 1. Intrinsic Value (0-20 pts)
  // 100%+ intrinsic = 20 pts, scales down
  // Paying less than intrinsic (>100%) is best
  if (spread.intrinsicPct >= 100) {
    breakdown.intrinsicValue = 20;  // Discount - best case
  } else if (spread.intrinsicPct >= 80) {
    breakdown.intrinsicValue = 16 + ((spread.intrinsicPct - 80) / 20) * 4;
  } else if (spread.intrinsicPct >= 60) {
    breakdown.intrinsicValue = 10 + ((spread.intrinsicPct - 60) / 20) * 6;
  } else if (spread.intrinsicPct >= 40) {
    breakdown.intrinsicValue = 5 + ((spread.intrinsicPct - 40) / 20) * 5;
  } else {
    breakdown.intrinsicValue = (spread.intrinsicPct / 40) * 5;
  }

  // 2. Cushion (0-20 pts) - MOST IMPORTANT for safety
  // 7%+ cushion = 20 pts, 5% = 16 pts, 3% = 10 pts, 1% = 5 pts
  if (spread.cushionPct >= 7) {
    breakdown.cushion = 20;
  } else if (spread.cushionPct >= 5) {
    breakdown.cushion = 16 + ((spread.cushionPct - 5) / 2) * 4;
  } else if (spread.cushionPct >= 3) {
    breakdown.cushion = 10 + ((spread.cushionPct - 3) / 2) * 6;
  } else if (spread.cushionPct >= 1) {
    breakdown.cushion = 5 + ((spread.cushionPct - 1) / 2) * 5;
  } else if (spread.cushionPct > 0) {
    breakdown.cushion = spread.cushionPct * 5;
  }

  // 3. Delta Alignment (0-10 pts)
  // Ideal: 0.75-0.85 for deep ITM spreads
  const delta = spread.delta;
  if (delta >= 0.75 && delta <= 0.85) {
    breakdown.delta = 10;  // Perfect range
  } else if (delta >= 0.70 && delta <= 0.90) {
    breakdown.delta = 7;   // Good range
  } else if (delta >= 0.60 && delta <= 0.95) {
    breakdown.delta = 4;   // Acceptable
  } else {
    breakdown.delta = 2;   // Suboptimal
  }

  // 4. DTE Alignment (0-10 pts)
  // Ideal: 21-45 days for theta management
  const dte = Math.ceil(
    (spread.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (dte >= 21 && dte <= 45) {
    breakdown.dte = 10;    // Ideal range
  } else if (dte >= 14 && dte <= 60) {
    breakdown.dte = 7;     // Good range
  } else if (dte >= 7 && dte <= 90) {
    breakdown.dte = 4;     // Acceptable
  } else {
    breakdown.dte = 2;     // Too short or too long
  }

  // 5. Spread Width (0-5 pts)
  // Ideal: exactly $5 for deep ITM call debit spreads
  // Spread width = maxProfit + maxLoss (netDebit for debit spreads)
  const estimatedWidth = spread.netDebit + spread.maxProfit;
  
  if (Math.abs(estimatedWidth - 5) < 0.5) {
    breakdown.spreadWidth = 5;  // Perfect $5 width
  } else if (estimatedWidth >= 4 && estimatedWidth <= 6) {
    breakdown.spreadWidth = 4;  // Close to $5
  } else if (estimatedWidth >= 3 && estimatedWidth <= 7) {
    breakdown.spreadWidth = 2;  // Acceptable
  } else {
    breakdown.spreadWidth = 0;  // Not ideal
  }

  // 6. Return on Risk (0-10 pts) - Lower weight, safety > return
  // ROI = maxProfit / maxLoss (which equals netDebit for debit spreads)
  const returnOnRisk = (spread.maxProfit / spread.netDebit) * 100;
  if (returnOnRisk >= 50) {
    breakdown.returnOnRisk = 10;
  } else if (returnOnRisk >= 30) {
    breakdown.returnOnRisk = 7 + ((returnOnRisk - 30) / 20) * 3;
  } else if (returnOnRisk >= 15) {
    breakdown.returnOnRisk = 4 + ((returnOnRisk - 15) / 15) * 3;
  } else if (returnOnRisk >= 5) {
    breakdown.returnOnRisk = (returnOnRisk / 15) * 4;
  }

  // 7. Support Protection (0-15 pts)
  // Support below breakeven provides extra safety
  if (support1 && support1 < spread.breakeven) {
    const supportCushion = ((spread.breakeven - support1) / spread.breakeven) * 100;
    if (supportCushion >= 5) {
      breakdown.supportProtection = 15;
    } else if (supportCushion >= 3) {
      breakdown.supportProtection = 10;
    } else if (supportCushion >= 1) {
      breakdown.supportProtection = 6;
    } else {
      breakdown.supportProtection = 3;
    }
  } else if (support1) {
    // Support above breakeven - less protection
    breakdown.supportProtection = 2;
  }

  // 8. Earnings Risk (0-10 pts)
  // No earnings during spread period is ideal
  if (!daysToEarnings || daysToEarnings > dte + 7) {
    breakdown.earningsRisk = 10;  // No earnings risk
  } else if (daysToEarnings > dte) {
    breakdown.earningsRisk = 7;   // Expires before earnings
  } else if (daysToEarnings > dte - 5) {
    breakdown.earningsRisk = 3;   // Close to earnings
  } else {
    breakdown.earningsRisk = 0;   // Earnings during spread
  }

  // Calculate total
  const total = Math.round(
    breakdown.intrinsicValue +
    breakdown.cushion +
    breakdown.delta +
    breakdown.dte +
    breakdown.spreadWidth +
    breakdown.returnOnRisk +
    breakdown.supportProtection +
    breakdown.earningsRisk
  );

  // Determine rating
  let rating: SpreadQualityScore["rating"];
  if (total >= 80) {
    rating = "excellent";
  } else if (total >= 60) {
    rating = "good";
  } else if (total >= 40) {
    rating = "fair";
  } else {
    rating = "poor";
  }

  return {
    total,
    breakdown: {
      intrinsicValue: Math.round(breakdown.intrinsicValue),
      cushion: Math.round(breakdown.cushion),
      delta: Math.round(breakdown.delta),
      dte: Math.round(breakdown.dte),
      spreadWidth: Math.round(breakdown.spreadWidth),
      returnOnRisk: Math.round(breakdown.returnOnRisk),
      supportProtection: Math.round(breakdown.supportProtection),
      earningsRisk: Math.round(breakdown.earningsRisk),
    },
    rating,
  };
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate unified confidence score (0-100)
 * 
 * Weights:
 * - Stock score: 30%
 * - Checklist pass rate: 25%
 * - Momentum signals: 20%
 * - Relative strength: 15%
 * - Market regime: 10%
 */
export function calculateConfidence(
  input: DecisionEngineInput
): ConfidenceScore {
  const breakdown = {
    stockScore: 0,
    checklistPassRate: 0,
    momentum: 0,
    relativeStrength: 0,
    marketRegime: 0,
  };

  // 1. Stock Score (0-30 pts)
  // Map 0-100 score to 0-30
  breakdown.stockScore = Math.round((input.stockScore / 100) * 30);

  // 2. Checklist Pass Rate (0-25 pts)
  // 7/7 = 25, 6/7 = 21, 5/7 = 18, etc.
  const passRate = input.checklistTotal > 0 
    ? input.checklistPassed / input.checklistTotal 
    : 0;
  breakdown.checklistPassRate = Math.round(passRate * 25);

  // 3. Momentum Signals (0-20 pts)
  // Improving = 20, Stable = 12, Deteriorating = 4
  if (input.momentumOverall === "improving") {
    breakdown.momentum = 20;
  } else if (input.momentumOverall === "stable") {
    breakdown.momentum = 12;
  } else {
    breakdown.momentum = 4;
  }
  
  // Adjust based on individual signals
  const improvingCount = input.momentumSignals.filter(
    s => s.direction === "improving"
  ).length;
  const deterioratingCount = input.momentumSignals.filter(
    s => s.direction === "deteriorating"
  ).length;
  
  // Bonus/penalty for signal consensus
  if (improvingCount >= 4) {
    breakdown.momentum = Math.min(20, breakdown.momentum + 3);
  } else if (deterioratingCount >= 4) {
    breakdown.momentum = Math.max(0, breakdown.momentum - 5);
  }

  // 4. Relative Strength (0-15 pts)
  switch (input.relativeStrengthTrend) {
    case "strong":
      breakdown.relativeStrength = 15;
      break;
    case "moderate":
      breakdown.relativeStrength = 10;
      break;
    case "weak":
      breakdown.relativeStrength = 5;
      break;
    case "underperforming":
      breakdown.relativeStrength = 2;
      break;
  }

  // 5. Market Regime (0-10 pts)
  switch (input.marketRegime) {
    case "bull":
      breakdown.marketRegime = 10;
      break;
    case "neutral":
      breakdown.marketRegime = 6;
      break;
    case "bear":
      breakdown.marketRegime = 2;
      break;
  }

  // Calculate total
  const total = Math.round(
    breakdown.stockScore +
    breakdown.checklistPassRate +
    breakdown.momentum +
    breakdown.relativeStrength +
    breakdown.marketRegime
  );

  // Determine confidence level
  let level: ConfidenceLevel;
  if (total >= 85) {
    level = "very_high";
  } else if (total >= 70) {
    level = "high";
  } else if (total >= 55) {
    level = "moderate";
  } else if (total >= 40) {
    level = "low";
  } else {
    level = "insufficient";
  }

  return {
    total,
    level,
    breakdown,
  };
}

// ============================================================================
// POSITION SIZING
// ============================================================================

/**
 * Position sizing matrix
 * Based on confidence level + market regime
 */
const POSITION_SIZE_MATRIX: Record<
  ConfidenceLevel, 
  Record<MarketRegime, { size: PositionSize; pct: number }>
> = {
  very_high: {
    bull: { size: "full", pct: 100 },
    neutral: { size: "three_quarter", pct: 75 },
    bear: { size: "half", pct: 50 },
  },
  high: {
    bull: { size: "three_quarter", pct: 75 },
    neutral: { size: "half", pct: 50 },
    bear: { size: "quarter", pct: 25 },
  },
  moderate: {
    bull: { size: "half", pct: 50 },
    neutral: { size: "quarter", pct: 25 },
    bear: { size: "skip", pct: 0 },
  },
  low: {
    bull: { size: "quarter", pct: 25 },
    neutral: { size: "skip", pct: 0 },
    bear: { size: "skip", pct: 0 },
  },
  insufficient: {
    bull: { size: "skip", pct: 0 },
    neutral: { size: "skip", pct: 0 },
    bear: { size: "skip", pct: 0 },
  },
};

/**
 * Determine position sizing based on confidence and market regime
 */
export function determinePositionSize(
  confidence: ConfidenceScore,
  marketRegime: MarketRegime,
  spreadDebit: number,
  accountSize: number = DEFAULT_ACCOUNT_SETTINGS.accountSize,
  maxRiskPercent: number = DEFAULT_ACCOUNT_SETTINGS.maxRiskPercent
): PositionSizing {
  const sizing = POSITION_SIZE_MATRIX[confidence.level][marketRegime];
  const reasoning: string[] = [];

  // Calculate max risk in dollars
  const baseMaxRisk = accountSize * (maxRiskPercent / 100);
  const adjustedMaxRisk = baseMaxRisk * (sizing.pct / 100);
  
  // Calculate max contracts (spread cost * 100 per contract)
  const costPerContract = spreadDebit * 100;
  const maxContracts = costPerContract > 0 
    ? Math.floor(adjustedMaxRisk / costPerContract)
    : 0;

  // Build reasoning
  reasoning.push(`Confidence: ${confidence.level.replace("_", " ")} (${confidence.total}/100)`);
  reasoning.push(`Market: ${marketRegime} regime`);
  
  if (sizing.size === "skip") {
    reasoning.push("Position size too small to trade");
  } else {
    reasoning.push(`${sizing.pct}% of max position`);
  }

  // Add specific adjustments
  if (confidence.breakdown.momentum < 10) {
    reasoning.push("⚠ Weak momentum reduces size");
  }
  if (confidence.breakdown.relativeStrength < 8) {
    reasoning.push("⚠ Underperforming SPY");
  }
  if (marketRegime === "bear") {
    reasoning.push("⚠ Bear market caution");
  }

  return {
    size: sizing.size,
    percentage: sizing.pct,
    maxContracts: Math.max(0, maxContracts),
    maxRiskDollars: Math.round(adjustedMaxRisk),
    reasoning,
  };
}

// ============================================================================
// TIMING ANALYSIS
// ============================================================================

/**
 * Analyze timing: Enter now or wait for pullback?
 */
export function analyzeEntryTiming(input: DecisionEngineInput): TimingAnalysis {
  const {
    currentPrice,
    rsiValue,
    ma20,
    support1,
  } = input;

  // Determine RSI zone
  let rsiZone: TimingAnalysis["rsiZone"];
  const rsi = rsiValue ?? 50;
  if (rsi < 30) {
    rsiZone = "oversold";
  } else if (rsi <= 50) {
    rsiZone = "ideal";
  } else if (rsi <= 55) {
    rsiZone = "neutral";
  } else if (rsi < 70) {
    rsiZone = "extended";
  } else {
    rsiZone = "overbought";
  }

  // Price vs MA20
  let priceVsMA20: TimingAnalysis["priceVsMA20"];
  if (!ma20) {
    priceVsMA20 = "at";
  } else if (currentPrice < ma20 * 0.99) {
    priceVsMA20 = "below";
  } else if (currentPrice > ma20 * 1.01) {
    priceVsMA20 = "above";
  } else {
    priceVsMA20 = "at";
  }

  // Distance to support
  const distanceToSupport = support1 
    ? ((currentPrice - support1) / currentPrice) * 100 
    : 10;  // Default 10% if no support

  // Check for recent pullback (simplified - would need historical data)
  // For now, assume pullback if RSI < 45 and price near support
  const recentPullback = rsi < 45 && distanceToSupport < 5;

  // Decision logic
  let action: "enter" | "wait";
  let waitTarget: number | undefined;
  let waitReason: string | undefined;
  let enterReason: string | undefined;

  // Enter now conditions
  const enterConditions = [
    rsiZone === "oversold",
    rsiZone === "ideal" && priceVsMA20 !== "above",
    distanceToSupport < 3,
    recentPullback,
  ];
  
  // Wait conditions
  const waitConditions = [
    rsiZone === "overbought",
    rsiZone === "extended" && priceVsMA20 === "above",
    distanceToSupport > 7 && rsiZone !== "oversold",
  ];

  const enterScore = enterConditions.filter(Boolean).length;
  const waitScore = waitConditions.filter(Boolean).length;

  if (enterScore > waitScore || rsiZone === "oversold") {
    action = "enter";
    
    if (rsiZone === "oversold") {
      enterReason = "RSI oversold — potential bounce";
    } else if (distanceToSupport < 3) {
      enterReason = "Price near support — good entry zone";
    } else if (priceVsMA20 === "below") {
      enterReason = "Price below MA20 — favorable entry";
    } else {
      enterReason = "Technical conditions favorable for entry";
    }
  } else {
    action = "wait";
    
    if (rsiZone === "overbought") {
      waitReason = "RSI overbought — wait for pullback";
      waitTarget = ma20 ?? currentPrice * 0.97;
    } else if (rsiZone === "extended") {
      waitReason = "Price extended — wait for consolidation";
      waitTarget = ma20 ?? support1 ?? currentPrice * 0.95;
    } else if (distanceToSupport > 7) {
      waitReason = "Price far from support — wait for better entry";
      waitTarget = support1 ?? currentPrice * 0.95;
    } else {
      waitReason = "Consider waiting for pullback";
      waitTarget = support1 ?? ma20 ?? currentPrice * 0.97;
    }
  }

  return {
    action,
    waitTarget,
    waitReason,
    enterReason,
    rsiZone,
    priceVsMA20,
    distanceToSupport,
    recentPullback,
  };
}

// ============================================================================
// MAIN DECISION ENGINE
// ============================================================================

/**
 * Main entry point: Evaluate all factors and produce entry decision
 */
export function evaluateEntry(input: DecisionEngineInput): EntryDecision {
  const warnings: string[] = [];
  const reasoning: string[] = [];
  const entryGuidance: string[] = [];
  const riskManagement: string[] = [];

  // 1. Calculate confidence score
  const confidence = calculateConfidence(input);
  reasoning.push(
    `Confidence: ${confidence.total}/100 (${confidence.level.replace("_", " ")})`
  );

  // 2. Analyze timing
  const timing = analyzeEntryTiming(input);

  // 3. Score and select best spread
  let bestSpread: ScoredSpread | null = null;
  let spreadScore: SpreadQualityScore | null = null;

  if (input.spreadCandidates.length > 0) {
    // Score all spreads and pick best
    const scoredSpreads = input.spreadCandidates.map(spread => {
      const dte = Math.ceil(
        (spread.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const quality = calculateSpreadQualityScore(
        spread,
        input.support1,
        input.daysToEarnings
      );
      return {
        ...spread,
        dte,
        maxLoss: spread.netDebit,
        qualityScore: quality,
      } as ScoredSpread;
    });

    // Sort by quality score descending
    scoredSpreads.sort((a, b) => b.qualityScore.total - a.qualityScore.total);
    bestSpread = scoredSpreads[0] ?? null;
    spreadScore = bestSpread?.qualityScore ?? null;

    if (spreadScore) {
      reasoning.push(`Best spread score: ${spreadScore.total}/100 (${spreadScore.rating})`);
    }
  } else {
    warnings.push("No spread candidates available");
  }

  // 4. Calculate position sizing
  const positionSizing = determinePositionSize(
    confidence,
    input.marketRegime,
    bestSpread?.netDebit ?? 0,
    input.accountSize,
    input.maxRiskPercent
  );

  // 5. Determine final action
  let action: EntryAction;
  let timeframe: Timeframe;
  
  // Track if we have spread data
  const hasSpreadData = bestSpread && spreadScore && spreadScore.total >= 40;
  
  // Critical check: Is price below MA200?
  const belowMA200 = input.ma200 && input.currentPrice < input.ma200;

  // Decision matrix - now handles missing spread data gracefully
  if (positionSizing.size === "skip") {
    action = "pass";
    timeframe = "this_week";
    reasoning.push("Insufficient confidence or unfavorable conditions");
  } else if (confidence.level === "insufficient") {
    action = "pass";
    timeframe = "this_week";
    reasoning.push("Confidence too low for entry");
  } else if (belowMA200 && timing.rsiZone !== "oversold") {
    // Below MA200 and not severely oversold = WAIT
    // This is a critical safety check
    action = "wait_for_pullback";
    timeframe = "this_week";
    reasoning.push("Below MA200 — wait for trend confirmation");
    warnings.push("⚠️ Price below MA200 (long-term downtrend)");
  } else if (confidence.level === "low" && !hasSpreadData) {
    // Low confidence AND no spread = pass
    action = "pass";
    timeframe = "this_week";
    reasoning.push("Low confidence and no spread data available");
  } else if (timing.action === "wait") {
    // Timing says wait - regardless of spread data
    action = "wait_for_pullback";
    timeframe = timing.rsiZone === "overbought" ? "this_week" : "1-3_days";
    reasoning.push(timing.waitReason ?? "Wait for better entry");
  } else if (hasSpreadData) {
    // Has spread data and timing is favorable
    action = "enter_now";
    timeframe = "immediate";
    reasoning.push(timing.enterReason ?? "Conditions favorable for entry");
  } else {
    // No spread data but good confidence + timing = ENTER (stock buy, no spread)
    // This is a valid entry, just without spread recommendation
    action = "enter_now";
    timeframe = "immediate";
    reasoning.push("Stock entry favorable (no spread data available)");
  }

  // 6. Build entry guidance
  if (action === "enter_now" && bestSpread) {
    // Has spread recommendation
    entryGuidance.push(
      `Enter today: Buy $${bestSpread.longStrike}C / ` +
      `Sell $${bestSpread.shortStrike}C`
    );
    entryGuidance.push(
      `Cost: $${(bestSpread.netDebit * 100).toFixed(0)} per contract`
    );
    if (positionSizing.maxContracts > 0) {
      entryGuidance.push(
        `Suggested: ${positionSizing.maxContracts} contract(s) ` +
        `($${(positionSizing.maxContracts * bestSpread.netDebit * 100).toFixed(0)} total)`
      );
    }
  } else if (action === "enter_now" && !bestSpread) {
    // Good entry but no spread data - recommend stock or manual options
    entryGuidance.push(`Stock entry favorable at current price`);
    entryGuidance.push(`Options: Check broker for available strikes`);
    entryGuidance.push(`Target 6-10% ITM long / 2-5% ITM short for $5 spread`);
  } else if (action === "wait_for_pullback" && timing.waitTarget) {
    entryGuidance.push(
      `Wait for price to reach $${timing.waitTarget.toFixed(2)}`
    );
    entryGuidance.push(`Set price alert at target`);
    entryGuidance.push(`Re-evaluate when target is reached`);
  } else {
    entryGuidance.push("No entry recommended at this time");
    entryGuidance.push("Monitor for improved conditions");
  }

  // 7. Build risk management guidance
  if (bestSpread && action !== "pass") {
    riskManagement.push(
      `Max loss: $${(bestSpread.netDebit * 100 * (positionSizing.maxContracts || 1)).toFixed(0)}`
    );
    riskManagement.push(
      `Breakeven: $${bestSpread.breakeven.toFixed(2)}`
    );
    if (input.support1) {
      riskManagement.push(
        `Exit if price breaks below $${input.support1.toFixed(2)} support`
      );
    }
    riskManagement.push(
      `Take profit at 50-60% of max gain`
    );
  }

  // 8. Add warnings
  if (input.daysToEarnings && input.daysToEarnings < 14) {
    warnings.push(`⚠️ Earnings in ${input.daysToEarnings} days`);
  }
  if (input.marketRegime === "bear") {
    warnings.push("⚠️ Bear market — reduced position sizes");
  }
  if (input.checklistPassed < input.checklistTotal - 2) {
    warnings.push(
      `⚠️ Only ${input.checklistPassed}/${input.checklistTotal} checklist items passed`
    );
  }
  if (input.momentumOverall === "deteriorating") {
    warnings.push("⚠️ Momentum deteriorating");
  }
  if (input.relativeStrengthTrend === "underperforming") {
    warnings.push("⚠️ Underperforming market");
  }

  // Add checklist fail reasons as warnings
  for (const reason of input.checklistFailReasons.slice(0, 3)) {
    warnings.push(`⚠️ ${reason}`);
  }

  return {
    action,
    confidence,
    timeframe,
    positionSizing,
    recommendedSpread: bestSpread,
    spreadScore,
    timing,
    marketRegime: input.marketRegime,
    reasoning,
    entryGuidance,
    riskManagement,
    warnings,
  };
}

/**
 * Format position size for display
 */
export function formatPositionSize(size: PositionSize): string {
  switch (size) {
    case "full":
      return "FULL (100%)";
    case "three_quarter":
      return "MODERATE (75%)";
    case "half":
      return "REDUCED (50%)";
    case "quarter":
      return "SMALL (25%)";
    case "skip":
      return "SKIP (0%)";
  }
}

/**
 * Format confidence level for display
 */
export function formatConfidenceLevel(level: ConfidenceLevel): string {
  switch (level) {
    case "very_high":
      return "VERY HIGH";
    case "high":
      return "HIGH";
    case "moderate":
      return "MODERATE";
    case "low":
      return "LOW";
    case "insufficient":
      return "INSUFFICIENT";
  }
}

/**
 * Format action for display
 */
export function formatAction(action: EntryAction): string {
  switch (action) {
    case "enter_now":
      return "ENTER NOW";
    case "wait_for_pullback":
      return "WAIT FOR PULLBACK";
    case "pass":
      return "PASS";
  }
}

