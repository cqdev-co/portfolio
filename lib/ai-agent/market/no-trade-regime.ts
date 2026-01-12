/**
 * No-Trade Regime Detection
 *
 * Cash-Preserving Strategy Implementation
 *
 * This module detects when market conditions are unfavorable for trading
 * and explicitly recommends staying in cash. This is a STRATEGY, not inactivity.
 *
 * Most retail losses happen when people force trades in bad conditions.
 * This system protects your core strategy by detecting:
 * - Low trend strength (choppy markets)
 * - High signal conflict (mixed messages)
 * - Whipsaw conditions (false breakouts)
 *
 * Trading Regimes:
 * - GO: Green light - favorable conditions, normal sizing
 * - CAUTION: Yellow light - reduced sizing, only Grade A setups
 * - NO_TRADE: Red light - preserve cash, wait for better conditions
 */

import {
  getVIXData,
  getSPYTrend,
  getSectorPerformance,
  type VIXData,
  type SPYTrend,
} from './index';

import {
  getChopAnalysis,
  getADXAnalysis,
  countDirectionReversals,
  isWhipsawCondition,
  type ChopAnalysis,
  type ADXAnalysis,
} from './chop-index';

import {
  analyzeSignalConflicts,
  type ConflictAnalysis,
  type SignalInputs,
} from './signal-conflicts';

import { fetchBreadthViaProxy, type BreadthAnalysis } from './market-breadth';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Trading regime - traffic light system
 */
export type TradingRegime = 'GO' | 'CAUTION' | 'NO_TRADE';

/**
 * Reason category for regime determination
 */
export type RegimeReason =
  | 'LOW_TREND_STRENGTH'
  | 'HIGH_CHOP'
  | 'SIGNAL_CONFLICT'
  | 'HIGH_VOLATILITY'
  | 'WHIPSAW'
  | 'WEAK_BREADTH'
  | 'MULTIPLE_FACTORS'
  | 'CLEAR_CONDITIONS';

/**
 * Full trading regime analysis
 */
export interface TradingRegimeAnalysis {
  /** Current regime (GO, CAUTION, NO_TRADE) */
  regime: TradingRegime;
  /** Primary reason for regime */
  primaryReason: RegimeReason;
  /** Confidence in the assessment (0-100) */
  confidence: number;
  /** All contributing factors */
  reasons: string[];
  /** Actionable recommendation */
  recommendation: string;

  // Component analyses
  /** Chop index analysis */
  chop?: ChopAnalysis;
  /** Signal conflict analysis */
  conflicts: ConflictAnalysis;
  /** VIX data */
  vix?: VIXData;
  /** SPY trend data */
  spy?: SPYTrend;
  /** ADX trend strength analysis */
  adx?: ADXAnalysis;
  /** Market breadth analysis */
  breadth?: BreadthAnalysis;

  // Metrics for display
  metrics: {
    chopIndex?: number;
    conflictScore: number;
    trendStrength: 'WEAK' | 'MODERATE' | 'STRONG';
    vixLevel?: string;
    spyTrend?: string;
    directionReversals?: number;
    adxValue?: number;
    adxTrend?: string;
    breadthScore?: number;
    breadthSignal?: string;
  };

  /** When this analysis expires and should be refreshed */
  validUntil: Date;
  /** Timestamp of analysis */
  timestamp: Date;
}

/**
 * Historical price data for regime analysis
 */
export interface PriceHistory {
  highs: number[];
  lows: number[];
  closes: number[];
}

// ============================================================================
// REGIME DETECTION LOGIC
// ============================================================================

/**
 * Determine trading regime from all factors
 */
function determineRegime(
  chop: ChopAnalysis | null,
  conflicts: ConflictAnalysis,
  vix: VIXData | null,
  spy: SPYTrend | null,
  whipsaw: boolean,
  reversals: number,
  adx: ADXAnalysis | null,
  breadth: BreadthAnalysis | null
): {
  regime: TradingRegime;
  primaryReason: RegimeReason;
  reasons: string[];
} {
  const reasons: string[] = [];
  let noTradeReasons = 0;
  let cautionReasons = 0;
  let goReasons = 0;

  // 1. Check for NO_TRADE conditions

  // High chop index (> 61.8)
  if (chop && chop.level === 'CHOPPY') {
    reasons.push(`Chop Index ${chop.value.toFixed(1)} - consolidating market`);
    noTradeReasons++;
  } else if (chop && chop.level === 'TRANSITIONAL') {
    reasons.push(`Chop Index ${chop.value.toFixed(1)} - transitional`);
    cautionReasons++;
  }

  // High signal conflict (> 60%)
  if (conflicts.isTooConflicted) {
    reasons.push(
      `Signal conflict ${conflicts.conflictScore}% - ` +
        `${conflicts.conflicts.filter((c) => c.severity === 'HIGH').length} ` +
        `major conflicts`
    );
    noTradeReasons++;
  } else if (conflicts.conflictScore > 40) {
    reasons.push(`Moderate signal conflict ${conflicts.conflictScore}%`);
    cautionReasons++;
  }

  // High/Extreme VIX
  if (vix && (vix.level === 'HIGH' || vix.level === 'EXTREME')) {
    reasons.push(
      `VIX ${vix.current.toFixed(1)} (${vix.level}) - high fear environment`
    );
    noTradeReasons++;
  } else if (vix && vix.level === 'ELEVATED') {
    reasons.push(
      `VIX ${vix.current.toFixed(1)} (${vix.level}) - elevated caution`
    );
    cautionReasons++;
  }

  // Whipsaw conditions
  if (whipsaw) {
    reasons.push('Whipsaw detected - high reversals with flat price');
    noTradeReasons++;
  } else if (reversals >= 3) {
    reasons.push(`${reversals} direction reversals in 5 days`);
    cautionReasons++;
  }

  // Weak trend + bearish SPY
  if (spy && spy.trend === 'BEARISH' && !spy.aboveMA200) {
    reasons.push('SPY in bearish trend below MA200');
    cautionReasons++;
  }

  // ADX-based trend strength (REAL ADX - Quick Win #1)
  if (adx) {
    if (adx.strength === 'WEAK' || adx.adx < 15) {
      reasons.push(`ADX ${adx.adx.toFixed(1)} - no clear trend, range-bound`);
      cautionReasons++;
    } else if (adx.strength === 'MODERATE') {
      reasons.push(`ADX ${adx.adx.toFixed(1)} - moderate trend strength`);
      // Neutral - no impact
    } else if (adx.strength === 'STRONG' || adx.strength === 'VERY_STRONG') {
      reasons.push(
        `ADX ${adx.adx.toFixed(1)} - ${adx.strength.toLowerCase()} ` +
          `${adx.direction.toLowerCase()} trend`
      );
      goReasons++;
    }
  }

  // Market Breadth Analysis (Quick Win #3)
  // BreadthAnalysis uses: score (0-100), level (HEALTHY|NARROWING|WEAK|DIVERGENT)
  if (breadth) {
    const score = breadth.score;
    const level = breadth.level;

    if (level === 'WEAK' || level === 'DIVERGENT') {
      reasons.push(
        `Market breadth ${score.toFixed(0)}% (${level}) - weak participation, ` +
          `internal weakness`
      );
      noTradeReasons++;
    } else if (level === 'NARROWING') {
      reasons.push(
        `Market breadth ${score.toFixed(0)}% - narrowing participation`
      );
      cautionReasons++;
    } else if (level === 'HEALTHY' && score >= 60) {
      reasons.push(
        `Market breadth ${score.toFixed(0)}% - strong participation, ` +
          `broad rally`
      );
      goReasons++;
    }
  }

  // 2. Determine final regime
  let regime: TradingRegime;
  let primaryReason: RegimeReason;

  if (noTradeReasons >= 2) {
    regime = 'NO_TRADE';
    primaryReason = 'MULTIPLE_FACTORS';
  } else if (noTradeReasons === 1) {
    // Single strong NO_TRADE reason - check if GO reasons offset it
    if (goReasons >= 2) {
      // Strong offsetting factors, downgrade to CAUTION
      regime = 'CAUTION';
      primaryReason = 'SIGNAL_CONFLICT';
      reasons.push('Strong offsetting factors detected');
    } else if (conflicts.isTooConflicted) {
      regime = 'NO_TRADE';
      primaryReason = 'SIGNAL_CONFLICT';
    } else if (chop && chop.level === 'CHOPPY') {
      regime = 'NO_TRADE';
      primaryReason = 'HIGH_CHOP';
    } else if (vix && (vix.level === 'HIGH' || vix.level === 'EXTREME')) {
      regime = 'NO_TRADE';
      primaryReason = 'HIGH_VOLATILITY';
    } else if (whipsaw) {
      regime = 'NO_TRADE';
      primaryReason = 'WHIPSAW';
    } else if (
      breadth &&
      (breadth.level === 'WEAK' || breadth.level === 'DIVERGENT')
    ) {
      regime = 'NO_TRADE';
      primaryReason = 'WEAK_BREADTH';
    } else {
      regime = 'CAUTION';
      primaryReason = 'SIGNAL_CONFLICT';
    }
  } else if (cautionReasons >= 2) {
    regime = 'CAUTION';
    primaryReason = cautionReasons > 2 ? 'MULTIPLE_FACTORS' : 'SIGNAL_CONFLICT';
  } else if (cautionReasons === 1) {
    // Single caution reason - check if GO reasons offset it
    if (goReasons >= 2) {
      regime = 'GO';
      primaryReason = 'CLEAR_CONDITIONS';
      reasons.push('Caution offset by strong trend/breadth');
    } else {
      regime = 'CAUTION';
      if (conflicts.conflictScore > 40) {
        primaryReason = 'SIGNAL_CONFLICT';
      } else if (chop && chop.level === 'TRANSITIONAL') {
        primaryReason = 'LOW_TREND_STRENGTH';
      } else if (adx && adx.strength === 'WEAK') {
        primaryReason = 'LOW_TREND_STRENGTH';
      } else {
        primaryReason = 'HIGH_VOLATILITY';
      }
    }
  } else {
    regime = 'GO';
    primaryReason = 'CLEAR_CONDITIONS';
    if (reasons.length === 0) {
      reasons.push('All signals aligned - favorable conditions');
    }
  }

  return { regime, primaryReason, reasons };
}

/**
 * Generate recommendation based on regime
 */
function generateRecommendation(
  regime: TradingRegime,
  primaryReason: RegimeReason,
  conflicts: ConflictAnalysis,
  vix: VIXData | null
): string {
  switch (regime) {
    case 'NO_TRADE':
      switch (primaryReason) {
        case 'HIGH_CHOP':
          return (
            'No high-confidence setups available. ' +
            'Market is consolidating - wait for breakout/breakdown ' +
            'confirmation before entering new positions.'
          );
        case 'SIGNAL_CONFLICT':
          return (
            'Conflicting signals make directional bets risky. ' +
            'Preserve cash and wait for signal alignment. ' +
            'Consider delta-neutral strategies if must trade.'
          );
        case 'HIGH_VOLATILITY':
          return (
            `VIX at ${vix?.current ?? 'elevated'} indicates high fear. ` +
            'Stay in cash until VIX drops below 25. ' +
            'Avoid new entries - existing positions may need hedging.'
          );
        case 'WHIPSAW':
          return (
            'Whipsaw conditions detected - false breakouts likely. ' +
            'Wait for cleaner price action before trading.'
          );
        case 'WEAK_BREADTH':
          return (
            'Weak market breadth - rally lacks participation. ' +
            'Narrow leadership often precedes corrections. ' +
            'Wait for broader market strength before new entries.'
          );
        case 'MULTIPLE_FACTORS':
          return (
            'Multiple warning signs present. ' +
            'This is a clear NO-TRADE environment. ' +
            'Preserve capital - better opportunities will come.'
          );
        default:
          return (
            'Market conditions do not favor new entries. ' +
            'Preserve cash and reassess tomorrow.'
          );
      }

    case 'CAUTION': {
      const netBias = conflicts.netDirection.toLowerCase();
      return (
        `Proceed with caution. Net ${netBias} bias detected. ` +
        'Reduce position sizes by 50%. Only take Grade A setups. ' +
        'Use tighter stops and lower profit targets.'
      );
    }

    case 'GO':
      return conflicts.netDirection === 'BULLISH'
        ? 'Risk-On environment. Normal position sizing. ' +
            'Look for pullbacks to support for entries.'
        : conflicts.netDirection === 'BEARISH'
          ? 'Defensive posture but trading OK. ' +
            'Focus on high-quality names with strong relative strength.'
          : 'Neutral environment. Normal trading conditions. ' +
            'Focus on Grade A setups with clear risk/reward.';
  }
}

/**
 * Calculate confidence in regime assessment
 */
function calculateConfidence(
  regime: TradingRegime,
  reasons: string[],
  conflicts: ConflictAnalysis,
  chop: ChopAnalysis | null
): number {
  let confidence = 50; // Start at neutral

  // More reasons = higher confidence in NO_TRADE/CAUTION
  if (regime === 'NO_TRADE') {
    confidence = Math.min(95, 60 + reasons.length * 10);
  } else if (regime === 'CAUTION') {
    confidence = Math.min(85, 55 + reasons.length * 8);
  } else {
    // GO regime - confidence based on signal alignment
    confidence = 70 - conflicts.conflictScore / 2;
  }

  // Boost confidence if chop index is extreme
  if (chop) {
    if (chop.value < 30 || chop.value > 70) {
      confidence = Math.min(95, confidence + 10);
    }
  }

  // Boost if conflict score is very clear
  if (conflicts.conflictScore < 20 || conflicts.conflictScore > 70) {
    confidence = Math.min(95, confidence + 10);
  }

  return Math.round(confidence);
}

/**
 * Get trend strength label
 */
function getTrendStrength(
  chop: ChopAnalysis | null,
  spy: SPYTrend | null
): 'WEAK' | 'MODERATE' | 'STRONG' {
  if (chop) {
    if (chop.level === 'TRENDING') return 'STRONG';
    if (chop.level === 'CHOPPY') return 'WEAK';
  }

  if (spy) {
    if (
      spy.trend !== 'NEUTRAL' &&
      spy.aboveMA200 === (spy.trend === 'BULLISH')
    ) {
      return 'STRONG';
    }
  }

  return 'MODERATE';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze current market conditions and determine trading regime
 *
 * @param priceHistory - Optional historical price data for chop calculation
 * @param additionalInputs - Optional additional signal inputs
 * @returns Full trading regime analysis
 */
export async function analyzeTradingRegime(
  priceHistory?: PriceHistory,
  additionalInputs?: Partial<SignalInputs>
): Promise<TradingRegimeAnalysis> {
  // Fetch market data in parallel (including breadth)
  const [vix, spy, sectors, breadth] = await Promise.all([
    getVIXData(),
    getSPYTrend(),
    getSectorPerformance(),
    // Fetch breadth via proxy - use env var or default
    fetchBreadthViaProxy(
      process.env.YAHOO_PROXY_URL ||
        'https://yahoo-proxy.conorquinlan.workers.dev'
    ).catch(() => null), // Graceful fallback
  ]);

  // Calculate technical indicators from price history
  let chop: ChopAnalysis | null = null;
  let adx: ADXAnalysis | null = null;
  let reversals = 0;
  let whipsaw = false;

  if (priceHistory && priceHistory.closes.length >= 15) {
    chop = getChopAnalysis(
      priceHistory.highs,
      priceHistory.lows,
      priceHistory.closes
    );
    // Calculate real ADX from price data (Quick Win #1)
    adx = getADXAnalysis(
      priceHistory.highs,
      priceHistory.lows,
      priceHistory.closes
    );
    reversals = countDirectionReversals(priceHistory.closes);
    whipsaw = isWhipsawCondition(
      priceHistory.highs,
      priceHistory.lows,
      priceHistory.closes
    );
  }

  // Build signal inputs (include ADX)
  const leadingSector = sectors.length > 0 ? sectors[0] : null;
  const signalInputs: SignalInputs = {
    vixLevel: vix?.level,
    vixValue: vix?.current,
    spyTrend: spy?.trend,
    spyAboveMA200: spy?.aboveMA200,
    spyAboveMA50: spy?.aboveMA50,
    sectorMomentum: leadingSector?.momentum,
    chopIndex: chop?.value,
    adxValue: adx?.adx,
    adxDirection: adx?.direction,
    ...additionalInputs,
  };

  // Analyze signal conflicts
  const conflicts = analyzeSignalConflicts(signalInputs);

  // Determine regime (now with ADX and breadth)
  const { regime, primaryReason, reasons } = determineRegime(
    chop,
    conflicts,
    vix,
    spy,
    whipsaw,
    reversals,
    adx,
    breadth
  );

  // Generate recommendation
  const recommendation = generateRecommendation(
    regime,
    primaryReason,
    conflicts,
    vix
  );

  // Calculate confidence
  const confidence = calculateConfidence(regime, reasons, conflicts, chop);

  // Build metrics (include ADX and breadth)
  const metrics = {
    chopIndex: chop?.value,
    conflictScore: conflicts.conflictScore,
    trendStrength: getTrendStrength(chop, spy),
    vixLevel: vix?.level,
    spyTrend: spy?.trend,
    directionReversals: reversals > 0 ? reversals : undefined,
    adxValue: adx?.adx,
    adxTrend: adx?.strength,
    breadthScore: breadth?.score,
    breadthSignal: breadth?.level,
  };

  // Calculate expiry (4 hours for intraday, end of day for EOD)
  const now = new Date();
  const validUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  return {
    regime,
    primaryReason,
    confidence,
    reasons,
    recommendation,
    chop: chop ?? undefined,
    conflicts,
    vix: vix ?? undefined,
    spy: spy ?? undefined,
    adx: adx ?? undefined,
    breadth: breadth ?? undefined,
    metrics,
    validUntil,
    timestamp: now,
  };
}

// ============================================================================
// REGIME TRANSITION WARNINGS
// ============================================================================

/**
 * Regime transition prediction
 */
export interface RegimeTransition {
  /** Current regime */
  currentRegime: TradingRegime;
  /** Predicted next regime */
  likelyNextRegime: TradingRegime;
  /** Probability of transition (0-100) */
  transitionProbability: number;
  /** Direction of change */
  direction: 'IMPROVING' | 'DETERIORATING' | 'STABLE';
  /** Days in current regime (if tracked) */
  daysInCurrentRegime?: number;
  /** Warning signals for transition */
  warningSignals: string[];
  /** Time horizon for prediction */
  timeHorizon: 'NEAR_TERM' | 'SHORT_TERM'; // Near = 1-2 days, Short = 3-7 days
  /** Actionable advice based on transition */
  advice: string;
}

/**
 * Metrics snapshot for transition tracking
 */
export interface RegimeMetricsSnapshot {
  timestamp: Date;
  chopIndex?: number;
  conflictScore: number;
  vixLevel?: number;
  adx?: number;
  breadthScore?: number;
  spyAboveMA50: boolean;
  spyAboveMA200: boolean;
}

/**
 * Detect regime transition based on metric changes
 *
 * Looks for leading indicators that often precede regime changes:
 * - Chop Index crossing key thresholds (38.2, 61.8)
 * - ADX rising from low levels (trend emerging)
 * - ADX falling from high levels (trend exhausting)
 * - Conflict score rising rapidly
 * - VIX crossing key levels (20, 25, 30)
 * - Breadth divergence forming
 */
export function detectRegimeTransition(
  currentAnalysis: TradingRegimeAnalysis,
  previousMetrics?: RegimeMetricsSnapshot,
  adxAnalysis?: { adx: number; rising: boolean; direction: string },
  breadthScore?: number
): RegimeTransition {
  const warnings: string[] = [];
  let transitionProbability = 20; // Base probability
  let likelyNextRegime = currentAnalysis.regime;
  let direction: RegimeTransition['direction'] = 'STABLE';

  const currentChop = currentAnalysis.metrics.chopIndex;
  const currentConflict = currentAnalysis.conflicts.conflictScore;
  const currentVix = currentAnalysis.vix?.current;

  // ================================================================
  // Check for DETERIORATING conditions (GO/CAUTION → CAUTION/NO_TRADE)
  // ================================================================

  // Chop Index approaching choppy threshold
  if (currentChop !== undefined) {
    if (currentChop > 55 && currentChop < 61.8) {
      warnings.push(
        `Chop Index ${currentChop.toFixed(1)} approaching choppy zone (61.8)`
      );
      transitionProbability += 15;
      direction = 'DETERIORATING';
    }
    // Chop Index just crossed into choppy
    if (
      currentChop >= 61.8 &&
      previousMetrics?.chopIndex &&
      previousMetrics.chopIndex < 61.8
    ) {
      warnings.push(`Chop Index crossed into choppy territory`);
      transitionProbability += 25;
    }
  }

  // Conflict score rising rapidly
  if (previousMetrics && currentConflict - previousMetrics.conflictScore > 15) {
    warnings.push(
      `Conflict score jumped ${(currentConflict - previousMetrics.conflictScore).toFixed(0)}% - signals diverging`
    );
    transitionProbability += 20;
    direction = 'DETERIORATING';
  }

  // VIX spiking
  if (currentVix !== undefined) {
    if (currentVix > 20 && currentVix < 25) {
      warnings.push(
        `VIX at ${currentVix.toFixed(1)} - approaching caution zone`
      );
      transitionProbability += 10;
      direction = 'DETERIORATING';
    }
    if (currentVix > 25 && currentVix < 30) {
      warnings.push(
        `VIX elevated at ${currentVix.toFixed(1)} - risk increasing`
      );
      transitionProbability += 15;
      direction = 'DETERIORATING';
    }
    // VIX just spiked above 25
    if (
      previousMetrics?.vixLevel &&
      currentVix > 25 &&
      previousMetrics.vixLevel <= 25
    ) {
      warnings.push(`VIX spiked above 25 - volatility regime change`);
      transitionProbability += 25;
    }
  }

  // ADX falling (trend weakening)
  if (adxAnalysis && adxAnalysis.adx > 25 && !adxAnalysis.rising) {
    warnings.push(
      `ADX ${adxAnalysis.adx.toFixed(1)} weakening - trend losing momentum`
    );
    transitionProbability += 10;
    direction = 'DETERIORATING';
  }

  // Breadth divergence
  if (breadthScore !== undefined) {
    if (breadthScore < 40 && currentAnalysis.spy?.trend === 'BULLISH') {
      warnings.push(
        `Weak breadth (${breadthScore}) despite bullish SPY - divergence warning`
      );
      transitionProbability += 20;
      direction = 'DETERIORATING';
    }
  }

  // ================================================================
  // Check for IMPROVING conditions (NO_TRADE/CAUTION → CAUTION/GO)
  // ================================================================

  // Chop Index approaching trending threshold
  if (currentChop !== undefined) {
    if (currentChop < 45 && currentChop > 38.2) {
      warnings.push(
        `Chop Index ${currentChop.toFixed(1)} approaching trending zone`
      );
      transitionProbability += 15;
      if (direction === 'STABLE') direction = 'IMPROVING';
    }
    // Chop Index just crossed into trending
    if (
      currentChop <= 38.2 &&
      previousMetrics?.chopIndex &&
      previousMetrics.chopIndex > 38.2
    ) {
      warnings.push(
        `Chop Index crossed into trending territory - breakout possible`
      );
      transitionProbability += 25;
      direction = 'IMPROVING';
    }
  }

  // Conflict score dropping
  if (previousMetrics && previousMetrics.conflictScore - currentConflict > 15) {
    warnings.push(
      `Conflict score dropped ${(previousMetrics.conflictScore - currentConflict).toFixed(0)}% - signals aligning`
    );
    transitionProbability += 15;
    if (direction !== 'DETERIORATING') direction = 'IMPROVING';
  }

  // VIX calming down
  if (currentVix !== undefined && previousMetrics?.vixLevel) {
    if (currentVix < 20 && previousMetrics.vixLevel >= 20) {
      warnings.push(`VIX dropped below 20 - fear subsiding`);
      transitionProbability += 15;
      if (direction !== 'DETERIORATING') direction = 'IMPROVING';
    }
  }

  // ADX rising from low (trend emerging)
  if (adxAnalysis && adxAnalysis.adx < 25 && adxAnalysis.rising) {
    warnings.push(
      `ADX ${adxAnalysis.adx.toFixed(1)} rising - new trend forming`
    );
    transitionProbability += 15;
    if (direction !== 'DETERIORATING') direction = 'IMPROVING';
  }

  // ================================================================
  // Determine likely next regime
  // ================================================================

  if (direction === 'DETERIORATING') {
    if (currentAnalysis.regime === 'GO') {
      likelyNextRegime = 'CAUTION';
    } else if (currentAnalysis.regime === 'CAUTION') {
      likelyNextRegime = 'NO_TRADE';
    }
  } else if (direction === 'IMPROVING') {
    if (currentAnalysis.regime === 'NO_TRADE') {
      likelyNextRegime = 'CAUTION';
    } else if (currentAnalysis.regime === 'CAUTION') {
      likelyNextRegime = 'GO';
    }
  }

  // Cap probability
  transitionProbability = Math.min(90, transitionProbability);

  // If no warnings, reduce probability
  if (warnings.length === 0) {
    transitionProbability = 10;
    direction = 'STABLE';
  }

  // Generate advice
  let advice: string;
  if (direction === 'DETERIORATING' && transitionProbability > 50) {
    advice =
      `⚠️ Conditions deteriorating. Prepare for ${likelyNextRegime} regime. ` +
      `Consider reducing exposure or tightening stops.`;
  } else if (direction === 'IMPROVING' && transitionProbability > 50) {
    advice =
      `📈 Conditions improving. Potential upgrade to ${likelyNextRegime} regime. ` +
      `Watch for confirmation before increasing exposure.`;
  } else if (transitionProbability > 30) {
    advice = `Monitor closely. ${warnings.length} warning signal${warnings.length > 1 ? 's' : ''} detected.`;
  } else {
    advice = `Current regime stable. No significant transition signals.`;
  }

  return {
    currentRegime: currentAnalysis.regime,
    likelyNextRegime,
    transitionProbability,
    direction,
    warningSignals: warnings,
    timeHorizon: transitionProbability > 60 ? 'NEAR_TERM' : 'SHORT_TERM',
    advice,
  };
}

/**
 * Format regime transition for display
 */
export function formatTransitionWarning(transition: RegimeTransition): string {
  if (transition.direction === 'STABLE') {
    return `✓ Regime stable: ${transition.currentRegime}`;
  }

  const emoji = transition.direction === 'DETERIORATING' ? '⚠️' : '📈';
  const arrow = transition.direction === 'DETERIORATING' ? '↓' : '↑';

  const lines = [
    `${emoji} REGIME TRANSITION WARNING`,
    ``,
    `${transition.currentRegime} ${arrow} ${transition.likelyNextRegime} (${transition.transitionProbability}% probability)`,
    `Timeframe: ${transition.timeHorizon === 'NEAR_TERM' ? '1-2 days' : '3-7 days'}`,
    ``,
    `Warning Signals:`,
    ...transition.warningSignals.map((w) => `  • ${w}`),
    ``,
    `${transition.advice}`,
  ];

  return lines.join('\n');
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Get emoji for regime
 */
export function getRegimeEmoji(regime: TradingRegime): string {
  switch (regime) {
    case 'GO':
      return '🟢';
    case 'CAUTION':
      return '🟡';
    case 'NO_TRADE':
      return '🔴';
  }
}

/**
 * Format regime for display (compact)
 */
export function formatRegimeBadge(analysis: TradingRegimeAnalysis): string {
  const emoji = getRegimeEmoji(analysis.regime);
  const conf = analysis.confidence;

  return `${emoji} ${analysis.regime} (${conf}% confidence)`;
}

/**
 * Format regime for AI context (verbose)
 */
export function formatRegimeForAI(analysis: TradingRegimeAnalysis): string {
  const lines: string[] = [];

  lines.push(`TRADING REGIME: ${analysis.regime}`);
  lines.push(`Confidence: ${analysis.confidence}%`);
  lines.push(`Primary Reason: ${analysis.primaryReason}`);
  lines.push('');

  // Metrics
  lines.push('METRICS:');
  if (analysis.metrics.chopIndex !== undefined) {
    lines.push(`  Chop Index: ${analysis.metrics.chopIndex.toFixed(1)}`);
  }
  lines.push(`  Conflict Score: ${analysis.metrics.conflictScore}%`);
  lines.push(`  Trend Strength: ${analysis.metrics.trendStrength}`);
  if (analysis.metrics.vixLevel) {
    lines.push(
      `  VIX: ${analysis.vix?.current} (${analysis.metrics.vixLevel})`
    );
  }
  if (analysis.metrics.spyTrend) {
    lines.push(`  SPY: ${analysis.metrics.spyTrend}`);
  }
  lines.push('');

  // Reasons
  if (analysis.reasons.length > 0) {
    lines.push('FACTORS:');
    for (const reason of analysis.reasons) {
      lines.push(`  • ${reason}`);
    }
    lines.push('');
  }

  // Recommendation
  lines.push(`→ ${analysis.recommendation}`);

  return lines.join('\n');
}

/**
 * Format regime in TOON format (~80% token reduction)
 * Example: REGIME:GO|80%|VIX:15.45:N|SPY:B|BR:85%|STR:STRONG|→Risk-On,normal
 */
export function formatRegimeTOON(analysis: TradingRegimeAnalysis): string {
  const parts: string[] = [];

  // Core: REGIME:GO|80%
  parts.push(`REGIME:${analysis.regime}|${analysis.confidence}%`);

  // VIX: VIX:15.45:N (N=normal, H=high, E=elevated, L=low)
  const vixShort =
    analysis.metrics.vixLevel === 'NORMAL'
      ? 'N'
      : analysis.metrics.vixLevel === 'HIGH'
        ? 'H'
        : analysis.metrics.vixLevel === 'ELEVATED'
          ? 'E'
          : 'L';
  parts.push(`VIX:${analysis.vix?.current ?? 0}:${vixShort}`);

  // SPY: SPY:B (B=bullish, Be=bearish, N=neutral)
  const spyShort =
    analysis.metrics.spyTrend === 'BULLISH'
      ? 'B'
      : analysis.metrics.spyTrend === 'BEARISH'
        ? 'Be'
        : 'N';
  parts.push(`SPY:${spyShort}`);

  // Breadth: BR:85%
  if (analysis.metrics.breadthScore !== undefined) {
    parts.push(`BR:${Math.round(analysis.metrics.breadthScore)}%`);
  }

  // Trend: STR:STRONG
  parts.push(`STR:${analysis.metrics.trendStrength}`);

  // Conflict: CONF:0%
  if (analysis.metrics.conflictScore > 0) {
    parts.push(`CONF:${analysis.metrics.conflictScore}%`);
  }

  // Short recommendation (first 50 chars)
  const shortRec = analysis.recommendation
    .substring(0, 50)
    .replace(/\s+/g, ' ');
  parts.push(`→${shortRec}`);

  return parts.join('|');
}

/**
 * Format regime as weekly summary
 */
export function formatWeeklySummary(analysis: TradingRegimeAnalysis): string {
  const emoji = getRegimeEmoji(analysis.regime);

  if (analysis.regime === 'NO_TRADE') {
    return (
      `${emoji} NO HIGH-CONFIDENCE SETUPS THIS WEEK\n\n` +
      `${analysis.recommendation}\n\n` +
      `Key factors:\n` +
      analysis.reasons.map((r) => `• ${r}`).join('\n')
    );
  }

  if (analysis.regime === 'CAUTION') {
    return (
      `${emoji} PROCEED WITH CAUTION\n\n` +
      `${analysis.recommendation}\n\n` +
      `Watch for:\n` +
      analysis.reasons.map((r) => `• ${r}`).join('\n')
    );
  }

  return (
    `${emoji} FAVORABLE CONDITIONS\n\n` +
    `${analysis.recommendation}\n\n` +
    `Positive signals:\n` +
    analysis.conflicts.signals
      .filter((s) => s.direction === 'BULLISH')
      .map((s) => `• ${s.name}: ${s.value}`)
      .join('\n')
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types from dependencies for convenience
export type { ChopAnalysis, ADXAnalysis } from './chop-index';
export type { ConflictAnalysis, SignalInputs } from './signal-conflicts';
export type { BreadthAnalysis } from './market-breadth';

export default {
  analyzeTradingRegime,
  getRegimeEmoji,
  formatRegimeBadge,
  formatRegimeForAI,
  formatRegimeTOON,
  formatWeeklySummary,
  detectRegimeTransition,
  formatTransitionWarning,
};
