/**
 * PCS Entry Decision Engine
 * v1.0.0: Put Credit Spread entry decision logic
 *
 * Key differences from CDS decision engine:
 * - Spread quality based on credit ratio, distance OTM, IV rank
 * - Confidence weights adjusted: regime has more weight (bear = dangerous for PCS)
 * - Position sizing more conservative in neutral/bear (credit spread max loss > max profit)
 * - Timing: IV rank favorability added to timing analysis
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
  MarketRegime,
} from '../types/decision.ts';
import { DEFAULT_ACCOUNT_SETTINGS } from '../types/decision.ts';

// ============================================================================
// SPREAD QUALITY SCORING (PCS-specific)
// ============================================================================

/**
 * Calculate PCS spread quality score (0-100)
 *
 * Factors:
 * - Credit ratio: % of width received as credit (20 pts)
 * - Distance OTM: how far short strike is below price (20 pts)
 * - IV Rank: higher IV = more premium (15 pts)
 * - Support buffer: support above short strike (15 pts)
 * - DTE alignment: 30-45 days ideal (10 pts)
 * - Short delta: 0.25-0.30 ideal (10 pts)
 * - Earnings risk: no earnings in period (10 pts)
 */
export function calculateSpreadQualityScore(
  spread: DecisionEngineInput['spreadCandidates'][0],
  support1: number | undefined,
  daysToEarnings: number | undefined,
  currentPrice: number
): SpreadQualityScore {
  const breakdown = {
    creditRatio: 0,
    distanceOTM: 0,
    ivRank: 0,
    supportBuffer: 0,
    dte: 0,
    delta: 0,
    earningsRisk: 0,
  };

  const width = spread.shortStrike - spread.longStrike;

  // 1. Credit Ratio (0-20 pts)
  // Ideal: 30-35% of width. >40% = too risky, <20% = not worth it
  const creditRatio = width > 0 ? (spread.netCredit / width) * 100 : 0;
  if (creditRatio >= 28 && creditRatio <= 38) {
    breakdown.creditRatio = 20;
  } else if (creditRatio >= 22 && creditRatio <= 42) {
    breakdown.creditRatio = 15;
  } else if (creditRatio >= 18 && creditRatio <= 48) {
    breakdown.creditRatio = 10;
  } else if (creditRatio >= 12) {
    breakdown.creditRatio = 5;
  }

  // 2. Distance OTM (0-20 pts)
  // How far below price the short strike is
  const distanceOTM =
    currentPrice > 0
      ? ((currentPrice - spread.shortStrike) / currentPrice) * 100
      : 0;

  if (distanceOTM >= 7 && distanceOTM <= 12) {
    breakdown.distanceOTM = 20;
  } else if (distanceOTM >= 5 && distanceOTM <= 15) {
    breakdown.distanceOTM = 15;
  } else if (distanceOTM >= 3 && distanceOTM <= 20) {
    breakdown.distanceOTM = 10;
  } else if (distanceOTM >= 1) {
    breakdown.distanceOTM = 5;
  }

  // 3. IV Rank (0-15 pts)
  if (spread.ivRank >= 50) {
    breakdown.ivRank = 15;
  } else if (spread.ivRank >= 35) {
    breakdown.ivRank = 10;
  } else if (spread.ivRank >= 20) {
    breakdown.ivRank = 6;
  } else {
    breakdown.ivRank = 2;
  }

  // 4. Support Buffer (0-15 pts)
  // Short strike should be BELOW support (support acts as a ceiling for losses)
  if (support1 && support1 > spread.shortStrike) {
    const supportBuffer =
      ((support1 - spread.shortStrike) / spread.shortStrike) * 100;
    if (supportBuffer >= 5) {
      breakdown.supportBuffer = 15;
    } else if (supportBuffer >= 3) {
      breakdown.supportBuffer = 10;
    } else if (supportBuffer >= 1) {
      breakdown.supportBuffer = 6;
    } else {
      breakdown.supportBuffer = 3;
    }
  } else if (support1) {
    // Support below short strike - less protection
    breakdown.supportBuffer = 2;
  }

  // 5. DTE (0-10 pts)
  const dte = Math.ceil(
    (spread.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (dte >= 30 && dte <= 45) {
    breakdown.dte = 10;
  } else if (dte >= 21 && dte <= 55) {
    breakdown.dte = 7;
  } else if (dte >= 14 && dte <= 70) {
    breakdown.dte = 4;
  } else {
    breakdown.dte = 2;
  }

  // 6. Short Delta (0-10 pts)
  // Ideal: 0.25-0.30 for PCS
  const delta = Math.abs(spread.shortDelta);
  if (delta >= 0.23 && delta <= 0.32) {
    breakdown.delta = 10;
  } else if (delta >= 0.18 && delta <= 0.38) {
    breakdown.delta = 7;
  } else if (delta >= 0.12 && delta <= 0.45) {
    breakdown.delta = 4;
  } else {
    breakdown.delta = 2;
  }

  // 7. Earnings Risk (0-10 pts)
  if (!daysToEarnings || daysToEarnings > dte + 7) {
    breakdown.earningsRisk = 10;
  } else if (daysToEarnings > dte) {
    breakdown.earningsRisk = 7;
  } else if (daysToEarnings > dte - 5) {
    breakdown.earningsRisk = 3;
  } else {
    breakdown.earningsRisk = 0;
  }

  const total = Math.round(
    Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  );

  let rating: SpreadQualityScore['rating'];
  if (total >= 80) rating = 'excellent';
  else if (total >= 60) rating = 'good';
  else if (total >= 40) rating = 'fair';
  else rating = 'poor';

  return {
    total,
    breakdown: {
      creditRatio: Math.round(breakdown.creditRatio),
      distanceOTM: Math.round(breakdown.distanceOTM),
      ivRank: Math.round(breakdown.ivRank),
      supportBuffer: Math.round(breakdown.supportBuffer),
      dte: Math.round(breakdown.dte),
      delta: Math.round(breakdown.delta),
      earningsRisk: Math.round(breakdown.earningsRisk),
    },
    rating,
  };
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

export function calculateConfidence(
  input: DecisionEngineInput
): ConfidenceScore {
  const breakdown = {
    stockScore: 0,
    checklistPassRate: 0,
    momentum: 0,
    relativeStrength: 0,
    marketRegime: 0,
    ivEnvironment: 0,
  };

  // 1. Stock Score (0-25 pts)
  breakdown.stockScore = Math.round((input.stockScore / 100) * 25);

  // 2. Checklist Pass Rate (0-20 pts)
  const passRate =
    input.checklistTotal > 0 ? input.checklistPassed / input.checklistTotal : 0;
  breakdown.checklistPassRate = Math.round(passRate * 20);

  // 3. Momentum (0-15 pts)
  if (input.momentumOverall === 'improving') breakdown.momentum = 15;
  else if (input.momentumOverall === 'stable') breakdown.momentum = 10;
  else breakdown.momentum = 3;

  // 4. Relative Strength (0-15 pts)
  switch (input.relativeStrengthTrend) {
    case 'strong':
      breakdown.relativeStrength = 15;
      break;
    case 'moderate':
      breakdown.relativeStrength = 10;
      break;
    case 'weak':
      breakdown.relativeStrength = 5;
      break;
    case 'underperforming':
      breakdown.relativeStrength = 2;
      break;
  }

  // 5. Market Regime (0-15 pts) - HIGHER WEIGHT than CDS
  // Bear regime is especially dangerous for PCS
  switch (input.marketRegime) {
    case 'bull':
      breakdown.marketRegime = 15;
      break;
    case 'neutral':
      breakdown.marketRegime = 8;
      break;
    case 'bear':
      breakdown.marketRegime = 0;
      break;
  }

  // 6. IV Environment (0-10 pts)
  if (input.ivRank && input.ivRank >= 50) breakdown.ivEnvironment = 10;
  else if (input.ivRank && input.ivRank >= 30) breakdown.ivEnvironment = 6;
  else if (input.ivRank && input.ivRank >= 15) breakdown.ivEnvironment = 3;

  const total = Math.round(
    Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  );

  let level: ConfidenceLevel;
  if (total >= 85) level = 'very_high';
  else if (total >= 70) level = 'high';
  else if (total >= 55) level = 'moderate';
  else if (total >= 40) level = 'low';
  else level = 'insufficient';

  return { total, level, breakdown };
}

// ============================================================================
// POSITION SIZING
// ============================================================================

const POSITION_SIZE_MATRIX: Record<
  ConfidenceLevel,
  Record<MarketRegime, { size: PositionSize; pct: number }>
> = {
  very_high: {
    bull: { size: 'full', pct: 100 },
    neutral: { size: 'half', pct: 50 },
    bear: { size: 'quarter', pct: 25 },
  },
  high: {
    bull: { size: 'three_quarter', pct: 75 },
    neutral: { size: 'quarter', pct: 25 },
    bear: { size: 'skip', pct: 0 },
  },
  moderate: {
    bull: { size: 'half', pct: 50 },
    neutral: { size: 'quarter', pct: 25 },
    bear: { size: 'skip', pct: 0 },
  },
  low: {
    bull: { size: 'quarter', pct: 25 },
    neutral: { size: 'skip', pct: 0 },
    bear: { size: 'skip', pct: 0 },
  },
  insufficient: {
    bull: { size: 'skip', pct: 0 },
    neutral: { size: 'skip', pct: 0 },
    bear: { size: 'skip', pct: 0 },
  },
};

export function determinePositionSize(
  confidence: ConfidenceScore,
  marketRegime: MarketRegime,
  spreadWidth: number,
  spreadCredit: number,
  accountSize: number = DEFAULT_ACCOUNT_SETTINGS.accountSize,
  maxRiskPercent: number = DEFAULT_ACCOUNT_SETTINGS.maxRiskPercent
): PositionSizing {
  const sizing = POSITION_SIZE_MATRIX[confidence.level][marketRegime];
  const reasoning: string[] = [];

  const baseMaxRisk = accountSize * (maxRiskPercent / 100);
  const adjustedMaxRisk = baseMaxRisk * (sizing.pct / 100);

  // Max loss per contract = (width - credit) * 100
  const maxLossPerContract = (spreadWidth - spreadCredit) * 100;
  const maxContracts =
    maxLossPerContract > 0
      ? Math.floor(adjustedMaxRisk / maxLossPerContract)
      : 0;

  reasoning.push(
    `Confidence: ${confidence.level.replace('_', ' ')} (${confidence.total}/100)`
  );
  reasoning.push(`Market: ${marketRegime} regime`);

  if (sizing.size === 'skip') {
    reasoning.push('Position size too small to trade');
  } else {
    reasoning.push(`${sizing.pct}% of max position`);
  }

  if (marketRegime === 'bear') {
    reasoning.push('Bear market — PCS positions very risky');
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

export function analyzeEntryTiming(input: DecisionEngineInput): TimingAnalysis {
  const { currentPrice, rsiValue, ma50, support1, ivRank } = input;

  let rsiZone: TimingAnalysis['rsiZone'];
  const rsi = rsiValue ?? 50;
  if (rsi < 30) rsiZone = 'oversold';
  else if (rsi <= 40) rsiZone = 'ideal';
  else if (rsi <= 55) rsiZone = 'neutral';
  else if (rsi < 65) rsiZone = 'extended';
  else rsiZone = 'overbought';

  let priceVsMA50: TimingAnalysis['priceVsMA50'];
  if (!ma50) priceVsMA50 = 'at';
  else if (currentPrice < ma50 * 0.99) priceVsMA50 = 'below';
  else if (currentPrice > ma50 * 1.01) priceVsMA50 = 'above';
  else priceVsMA50 = 'at';

  const distanceToSupport = support1
    ? ((currentPrice - support1) / currentPrice) * 100
    : 10;

  const ivRankFavorable = (ivRank ?? 0) >= 30;

  let action: 'enter' | 'wait';
  let waitTarget: number | undefined;
  let waitReason: string | undefined;
  let enterReason: string | undefined;

  // PCS timing: focus on stability + IV environment
  const enterConditions = [
    rsiZone === 'neutral' || rsiZone === 'ideal',
    priceVsMA50 === 'above' || priceVsMA50 === 'at',
    ivRankFavorable,
    distanceToSupport > 3,
  ];

  const waitConditions = [
    rsiZone === 'oversold',
    priceVsMA50 === 'below',
    !ivRankFavorable,
  ];

  const enterScore = enterConditions.filter(Boolean).length;
  const waitScore = waitConditions.filter(Boolean).length;

  if (enterScore >= 3) {
    action = 'enter';
    if (ivRankFavorable) {
      enterReason = 'IV elevated + stable price action — favorable for PCS';
    } else {
      enterReason = 'Price stable above support — acceptable for PCS';
    }
  } else if (waitScore >= 2) {
    action = 'wait';
    if (rsiZone === 'oversold') {
      waitReason = 'RSI oversold — wait for stabilization';
      waitTarget = ma50 ?? currentPrice * 1.03;
    } else if (priceVsMA50 === 'below') {
      waitReason = 'Price below MA50 — wait for reclaim';
      waitTarget = ma50;
    } else {
      waitReason = 'IV too low — wait for volatility expansion';
    }
  } else {
    action = 'enter';
    enterReason = 'Conditions acceptable for PCS entry';
  }

  return {
    action,
    waitTarget,
    waitReason,
    enterReason,
    rsiZone,
    priceVsMA50,
    distanceToSupport,
    ivRankFavorable,
  };
}

// ============================================================================
// MAIN DECISION ENGINE
// ============================================================================

export function evaluateEntry(input: DecisionEngineInput): EntryDecision {
  const warnings: string[] = [];
  const reasoning: string[] = [];
  const entryGuidance: string[] = [];
  const riskManagement: string[] = [];

  // 1. Calculate confidence
  const confidence = calculateConfidence(input);
  reasoning.push(
    `Confidence: ${confidence.total}/100 (${confidence.level.replace('_', ' ')})`
  );

  // 2. Analyze timing
  const timing = analyzeEntryTiming(input);

  // 3. Score and select best spread
  let bestSpread: ScoredSpread | null = null;
  let spreadScore: SpreadQualityScore | null = null;

  if (input.spreadCandidates.length > 0) {
    const scoredSpreads = input.spreadCandidates.map((spread) => {
      const dte = Math.ceil(
        (spread.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const width = spread.shortStrike - spread.longStrike;
      const quality = calculateSpreadQualityScore(
        spread,
        input.support1,
        input.daysToEarnings,
        input.currentPrice
      );
      return {
        ...spread,
        dte,
        maxProfit: spread.netCredit,
        maxLoss: width - spread.netCredit,
        breakeven: spread.shortStrike - spread.netCredit,
        qualityScore: quality,
      } as ScoredSpread;
    });

    scoredSpreads.sort((a, b) => b.qualityScore.total - a.qualityScore.total);
    bestSpread = scoredSpreads[0] ?? null;
    spreadScore = bestSpread?.qualityScore ?? null;

    if (spreadScore) {
      reasoning.push(
        `Best spread score: ${spreadScore.total}/100 (${spreadScore.rating})`
      );
    }
  } else {
    warnings.push('No spread candidates available');
  }

  // 4. Position sizing
  const width = bestSpread ? bestSpread.shortStrike - bestSpread.longStrike : 5;
  const credit = bestSpread?.netCredit ?? 0;
  const positionSizing = determinePositionSize(
    confidence,
    input.marketRegime,
    width,
    credit,
    input.accountSize,
    input.maxRiskPercent
  );

  // 5. Determine action
  let action: EntryAction;
  let timeframe: Timeframe;

  const hasSpreadData = bestSpread && spreadScore && spreadScore.total >= 40;
  const belowMA50 = input.ma50 && input.currentPrice < input.ma50;

  if (positionSizing.size === 'skip') {
    action = 'pass';
    timeframe = 'this_week';
    reasoning.push('Insufficient confidence or unfavorable conditions');
  } else if (confidence.level === 'insufficient') {
    action = 'pass';
    timeframe = 'this_week';
    reasoning.push('Confidence too low for entry');
  } else if (input.marketRegime === 'bear') {
    action = 'pass';
    timeframe = 'next_week';
    reasoning.push('Bear market — PCS too risky');
    warnings.push('Bear market — avoid selling puts');
  } else if (belowMA50 && timing.rsiZone === 'oversold') {
    action = 'pass';
    timeframe = 'this_week';
    reasoning.push('Below MA50 and oversold — wait for stabilization');
  } else if (timing.action === 'wait') {
    action = 'wait_for_pullback';
    timeframe = '1-3_days';
    reasoning.push(timing.waitReason ?? 'Wait for better conditions');
  } else if (hasSpreadData) {
    action = 'enter_now';
    timeframe = 'immediate';
    reasoning.push(timing.enterReason ?? 'Conditions favorable for PCS entry');
  } else {
    action = 'enter_now';
    timeframe = 'immediate';
    reasoning.push('Favorable conditions (no spread data available)');
  }

  // 6. Entry guidance
  if (action === 'enter_now' && bestSpread) {
    entryGuidance.push(
      `Sell $${bestSpread.shortStrike}P / Buy $${bestSpread.longStrike}P`
    );
    entryGuidance.push(
      `Credit: $${(bestSpread.netCredit * 100).toFixed(0)} per contract`
    );
    if (positionSizing.maxContracts > 0) {
      entryGuidance.push(
        `Suggested: ${positionSizing.maxContracts} contract(s)`
      );
    }
  } else if (action === 'wait_for_pullback' && timing.waitTarget) {
    entryGuidance.push(`Wait for conditions to improve`);
    entryGuidance.push(`Set alert at $${timing.waitTarget.toFixed(2)}`);
  } else {
    entryGuidance.push('No entry recommended at this time');
  }

  // 7. Risk management
  if (bestSpread && action !== 'pass') {
    const maxLossPerContract =
      (bestSpread.shortStrike - bestSpread.longStrike - bestSpread.netCredit) *
      100;
    riskManagement.push(
      `Max loss: $${(maxLossPerContract * (positionSizing.maxContracts || 1)).toFixed(0)}`
    );
    riskManagement.push(`Breakeven: $${bestSpread.breakeven.toFixed(2)}`);
    riskManagement.push(`Take profit at 50% of credit received`);
    riskManagement.push(`Exit if short strike breached`);
    if (input.support1) {
      riskManagement.push(
        `Support at $${input.support1.toFixed(2)} — exit if broken`
      );
    }
  }

  // 8. Warnings
  if (input.daysToEarnings && input.daysToEarnings < 14) {
    warnings.push(`Earnings in ${input.daysToEarnings} days`);
  }
  if (input.marketRegime === 'bear') {
    warnings.push('Bear market — avoid new PCS positions');
  }
  if (input.momentumOverall === 'deteriorating') {
    warnings.push('Momentum deteriorating — dangerous for credit selling');
  }
  if ((input.ivRank ?? 0) < 20) {
    warnings.push('IV Rank very low — insufficient premium');
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

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function formatPositionSize(size: PositionSize): string {
  switch (size) {
    case 'full':
      return 'FULL (100%)';
    case 'three_quarter':
      return 'MODERATE (75%)';
    case 'half':
      return 'REDUCED (50%)';
    case 'quarter':
      return 'SMALL (25%)';
    case 'skip':
      return 'SKIP (0%)';
  }
}

export function formatConfidenceLevel(level: ConfidenceLevel): string {
  switch (level) {
    case 'very_high':
      return 'VERY HIGH';
    case 'high':
      return 'HIGH';
    case 'moderate':
      return 'MODERATE';
    case 'low':
      return 'LOW';
    case 'insufficient':
      return 'INSUFFICIENT';
  }
}

export function formatAction(action: EntryAction): string {
  switch (action) {
    case 'enter_now':
      return 'ENTER NOW';
    case 'scale_in':
      return 'SCALE IN (50% now)';
    case 'wait_for_pullback':
      return 'WAIT';
    case 'pass':
      return 'PASS';
  }
}
