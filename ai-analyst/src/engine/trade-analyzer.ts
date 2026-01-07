/**
 * Advanced Trade Analyzer
 * Provides trade grading, scenario analysis, and risk scoring
 */

// ============================================================================
// TYPES
// ============================================================================

export type TradeGrade =
  | 'A+'
  | 'A'
  | 'A-'
  | 'B+'
  | 'B'
  | 'B-'
  | 'C+'
  | 'C'
  | 'C-'
  | 'D'
  | 'F';

export interface GradingCriteria {
  name: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  reason: string;
}

export interface TradeGradeResult {
  grade: TradeGrade;
  score: number;
  maxScore: number;
  percentage: number;
  criteria: GradingCriteria[];
  summary: string;
  recommendation: 'STRONG BUY' | 'BUY' | 'WAIT' | 'AVOID';
  // Additional data for analysis
  rsi?: number;
  aboveMA200?: boolean;
  earningsDays?: number;
}

export interface ScenarioResult {
  scenario: string;
  priceChange: number;
  newPrice: number;
  spreadValue: number;
  pnl: number;
  pnlPercent: number;
  outcome: 'MAX PROFIT' | 'PROFIT' | 'BREAKEVEN' | 'LOSS' | 'MAX LOSS';
}

export interface RiskScore {
  score: number; // 1-10 (1 = low risk, 10 = high risk)
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  factors: RiskFactor[];
  summary: string;
}

export interface RiskFactor {
  name: string;
  impact: number; // 1-3
  description: string;
}

export interface AdvancedAnalysis {
  grade: TradeGradeResult;
  scenarios: ScenarioResult[];
  risk: RiskScore;
}

// ============================================================================
// GRADE RUBRIC (for transparency)
// ============================================================================

export const GRADE_RUBRIC = {
  criteria: [
    {
      name: 'Above MA200',
      maxPoints: 25,
      desc: 'Price above 200-day MA = bullish trend',
    },
    {
      name: 'RSI Zone',
      maxPoints: 20,
      desc: 'RSI 35-55 = ideal entry, 55-65 = partial, >65 = overbought',
    },
    {
      name: 'Cushion',
      maxPoints: 20,
      desc: '>10% = full, 7-10% = partial, <7% = risky',
    },
    {
      name: 'IV Level',
      maxPoints: 15,
      desc: 'Normal/Low = full, Elevated = partial, High = risky',
    },
    {
      name: 'Earnings',
      maxPoints: 10,
      desc: '>14 days = safe, 7-14 = partial, <7 = avoid',
    },
    {
      name: 'Risk/Reward',
      maxPoints: 10,
      desc: '>20% return = full, 15-20% = partial, <15% = poor',
    },
  ],
  grades: {
    'A+': { min: 95, recommendation: 'STRONG BUY' },
    A: { min: 90, recommendation: 'STRONG BUY' },
    'A-': { min: 85, recommendation: 'BUY' },
    'B+': { min: 80, recommendation: 'BUY' },
    B: { min: 75, recommendation: 'BUY' },
    'B-': { min: 70, recommendation: 'WAIT' },
    'C+': { min: 65, recommendation: 'WAIT' },
    C: { min: 60, recommendation: 'WAIT' },
    'C-': { min: 55, recommendation: 'AVOID' },
    D: { min: 50, recommendation: 'AVOID' },
    F: { min: 0, recommendation: 'AVOID' },
  },
  riskLevels: {
    '1-3': 'LOW - Favorable conditions, standard position size',
    '4-5': 'MODERATE - Some concerns, consider reduced size',
    '6-7': 'HIGH - Multiple red flags, minimal exposure only',
    '8-10': 'EXTREME - Avoid trade entirely',
  },
};

/**
 * Get human-readable explanation of grade and risk
 */
export function explainGradeRubric(
  grade: TradeGradeResult,
  risk: RiskScore
): string {
  const lines: string[] = [];

  lines.push(`GRADE: ${grade.grade} (${grade.score}/${grade.maxScore} points)`);
  lines.push('');
  lines.push('Scoring Breakdown:');

  for (const c of grade.criteria) {
    const status = c.passed ? '✓' : '✗';
    lines.push(
      `  ${status} ${c.name}: ${c.points}/${c.maxPoints} - ${c.reason}`
    );
  }

  lines.push('');
  lines.push(`RISK: ${risk.score}/10 (${risk.level})`);
  lines.push('');
  lines.push('Risk Factors:');

  for (const f of risk.factors) {
    const impact = '!'.repeat(f.impact);
    lines.push(`  ${impact} ${f.name}: ${f.description}`);
  }

  return lines.join('\n');
}

// ============================================================================
// TRADE GRADING
// ============================================================================

interface GradingInput {
  price: number;
  rsi?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  aboveMA200?: boolean;
  earningsDays?: number | null;
  cushionPercent?: number;
  dte?: number;
  spreadWidth?: number;
  debit?: number;
}

export function gradeTradeOpportunity(input: GradingInput): TradeGradeResult {
  const criteria: GradingCriteria[] = [];
  let totalScore = 0;
  const maxScore = 100;

  // 1. MA200 Position (25 points)
  if (input.aboveMA200 !== undefined) {
    const passed = input.aboveMA200;
    const points = passed ? 25 : 0;
    criteria.push({
      name: 'Above MA200',
      points,
      maxPoints: 25,
      passed,
      reason: passed
        ? `Price above MA200 - bullish trend confirmed`
        : `Price below MA200 - trend not favorable`,
    });
    totalScore += points;
  }

  // 2. RSI Range (20 points)
  if (input.rsi !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    if (input.rsi >= 35 && input.rsi <= 55) {
      points = 20;
      passed = true;
      reason = `RSI ${input.rsi.toFixed(1)} in ideal range (35-55)`;
    } else if (input.rsi > 55 && input.rsi <= 60) {
      points = 10;
      passed = true;
      reason = `RSI ${input.rsi.toFixed(1)} slightly elevated but acceptable`;
    } else if (input.rsi > 60) {
      points = 0;
      passed = false;
      reason = `RSI ${input.rsi.toFixed(1)} too high - overbought`;
    } else if (input.rsi < 35) {
      points = 5;
      passed = false;
      reason = `RSI ${input.rsi.toFixed(1)} oversold - wait for stabilization`;
    }

    criteria.push({
      name: 'RSI Range',
      points,
      maxPoints: 20,
      passed,
      reason,
    });
    totalScore += points;
  }

  // 3. Cushion (20 points)
  if (input.cushionPercent !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    if (input.cushionPercent >= 10) {
      points = 20;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - excellent buffer`;
    } else if (input.cushionPercent >= 7) {
      points = 15;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - good buffer`;
    } else if (input.cushionPercent >= 5) {
      points = 10;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - acceptable`;
    } else if (input.cushionPercent >= 3) {
      points = 5;
      passed = false;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - tight margin`;
    } else {
      points = 0;
      passed = false;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - too risky`;
    }

    criteria.push({
      name: 'Cushion',
      points,
      maxPoints: 20,
      passed,
      reason,
    });
    totalScore += points;
  }

  // 4. Earnings Safety (15 points)
  if (input.earningsDays !== undefined && input.earningsDays !== null) {
    let points = 0;
    let passed = false;
    let reason = '';

    if (input.earningsDays > 30) {
      points = 15;
      passed = true;
      reason = `Earnings ${input.earningsDays} days out - safe`;
    } else if (input.earningsDays > 14) {
      points = 10;
      passed = true;
      reason = `Earnings ${input.earningsDays} days out - monitor`;
    } else if (input.earningsDays > 7) {
      points = 0;
      passed = false;
      reason = `Earnings ${input.earningsDays} days out - too close`;
    } else {
      points = -10; // Penalty
      passed = false;
      reason = `Earnings in ${input.earningsDays} days - AVOID`;
    }

    criteria.push({
      name: 'Earnings Safety',
      points: Math.max(0, points),
      maxPoints: 15,
      passed,
      reason,
    });
    totalScore += Math.max(0, points);
  }

  // 5. DTE Appropriateness (10 points)
  if (input.dte !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    if (input.dte >= 21 && input.dte <= 45) {
      points = 10;
      passed = true;
      reason = `${input.dte} DTE in optimal range (21-45)`;
    } else if (input.dte > 45 && input.dte <= 60) {
      points = 7;
      passed = true;
      reason = `${input.dte} DTE slightly long but acceptable`;
    } else if (input.dte > 14 && input.dte < 21) {
      points = 5;
      passed = true;
      reason = `${input.dte} DTE short - less time for recovery`;
    } else {
      points = 0;
      passed = false;
      reason = `${input.dte} DTE outside optimal range`;
    }

    criteria.push({
      name: 'DTE Range',
      points,
      maxPoints: 10,
      passed,
      reason,
    });
    totalScore += points;
  }

  // 6. Risk/Reward (10 points)
  if (input.spreadWidth !== undefined && input.debit !== undefined) {
    const maxProfit = input.spreadWidth - input.debit;
    const returnOnRisk = (maxProfit / input.debit) * 100;

    let points = 0;
    let passed = false;
    let reason = '';

    if (returnOnRisk >= 20) {
      points = 10;
      passed = true;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - excellent`;
    } else if (returnOnRisk >= 15) {
      points = 7;
      passed = true;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - good`;
    } else if (returnOnRisk >= 10) {
      points = 5;
      passed = true;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - acceptable`;
    } else {
      points = 2;
      passed = false;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - low`;
    }

    criteria.push({
      name: 'Risk/Reward',
      points,
      maxPoints: 10,
      passed,
      reason,
    });
    totalScore += points;
  }

  // Calculate final grade
  const percentage = (totalScore / maxScore) * 100;
  const grade = scoreToGrade(percentage);
  const recommendation = gradeToRecommendation(grade);

  // Generate summary
  const passedCount = criteria.filter((c) => c.passed).length;
  const failedCriteria = criteria.filter((c) => !c.passed);

  let summary = `Score: ${totalScore}/${maxScore} (${percentage.toFixed(0)}%)`;
  if (failedCriteria.length > 0) {
    summary += ` | Issues: ${failedCriteria.map((c) => c.name).join(', ')}`;
  }

  return {
    grade,
    score: totalScore,
    maxScore,
    percentage,
    criteria,
    summary,
    recommendation,
  };
}

function scoreToGrade(percentage: number): TradeGrade {
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'A-';
  if (percentage >= 80) return 'B+';
  if (percentage >= 75) return 'B';
  if (percentage >= 70) return 'B-';
  if (percentage >= 65) return 'C+';
  if (percentage >= 60) return 'C';
  if (percentage >= 55) return 'C-';
  if (percentage >= 50) return 'D';
  return 'F';
}

function gradeToRecommendation(
  grade: TradeGrade
): TradeGradeResult['recommendation'] {
  if (grade === 'A+' || grade === 'A') return 'STRONG BUY';
  if (grade === 'A-' || grade === 'B+' || grade === 'B') return 'BUY';
  if (grade === 'B-' || grade === 'C+' || grade === 'C') return 'WAIT';
  return 'AVOID';
}

// ============================================================================
// SCENARIO ANALYSIS
// ============================================================================

interface ScenarioInput {
  currentPrice: number;
  longStrike: number;
  shortStrike: number;
  debit: number;
}

export function analyzeScenarios(input: ScenarioInput): ScenarioResult[] {
  const { currentPrice, longStrike, shortStrike, debit } = input;
  const spreadWidth = shortStrike - longStrike;
  const maxProfit = (spreadWidth - debit) * 100;
  const maxLoss = debit * 100;
  const breakeven = longStrike + debit;

  const scenarios: ScenarioResult[] = [];

  // Define price change scenarios
  const priceChanges = [
    { label: 'Up 10%', change: 0.1 },
    { label: 'Up 5%', change: 0.05 },
    { label: 'Flat', change: 0 },
    { label: 'Down 5%', change: -0.05 },
    { label: 'Down 10%', change: -0.1 },
    { label: 'Down 15%', change: -0.15 },
    {
      label: 'To Breakeven',
      change: (breakeven - currentPrice) / currentPrice,
    },
    {
      label: 'To Long Strike',
      change: (longStrike - currentPrice) / currentPrice,
    },
  ];

  for (const { label, change } of priceChanges) {
    const newPrice = currentPrice * (1 + change);

    // Calculate spread value at expiration
    let spreadValue: number;
    if (newPrice >= shortStrike) {
      // Both ITM - max profit
      spreadValue = spreadWidth;
    } else if (newPrice >= longStrike) {
      // Only long call ITM
      spreadValue = newPrice - longStrike;
    } else {
      // Both OTM - max loss
      spreadValue = 0;
    }

    const pnl = (spreadValue - debit) * 100;
    const pnlPercent = (pnl / maxLoss) * 100;

    let outcome: ScenarioResult['outcome'];
    if (pnl >= maxProfit * 0.99) {
      outcome = 'MAX PROFIT';
    } else if (pnl > 0) {
      outcome = 'PROFIT';
    } else if (Math.abs(pnl) < 1) {
      outcome = 'BREAKEVEN';
    } else if (pnl <= -maxLoss * 0.99) {
      outcome = 'MAX LOSS';
    } else {
      outcome = 'LOSS';
    }

    scenarios.push({
      scenario: label,
      priceChange: change * 100,
      newPrice: Math.round(newPrice * 100) / 100,
      spreadValue: Math.round(spreadValue * 100) / 100,
      pnl: Math.round(pnl),
      pnlPercent: Math.round(pnlPercent),
      outcome,
    });
  }

  return scenarios;
}

// ============================================================================
// RISK SCORING
// ============================================================================

interface RiskInput {
  rsi?: number;
  cushionPercent?: number;
  earningsDays?: number | null;
  dte?: number;
  positionSizePercent?: number; // % of account
  aboveMA200?: boolean;
  volatilityHigh?: boolean;
}

export function calculateRiskScore(input: RiskInput): RiskScore {
  const factors: RiskFactor[] = [];
  let totalRisk = 0;

  // 1. RSI Risk
  if (input.rsi !== undefined) {
    if (input.rsi > 65) {
      factors.push({
        name: 'Overbought RSI',
        impact: 3,
        description: `RSI at ${input.rsi.toFixed(0)} indicates overbought conditions`,
      });
      totalRisk += 3;
    } else if (input.rsi > 55) {
      factors.push({
        name: 'Elevated RSI',
        impact: 1,
        description: `RSI at ${input.rsi.toFixed(0)} is slightly elevated`,
      });
      totalRisk += 1;
    }
  }

  // 2. Cushion Risk
  if (input.cushionPercent !== undefined) {
    if (input.cushionPercent < 3) {
      factors.push({
        name: 'Minimal Cushion',
        impact: 3,
        description: `Only ${input.cushionPercent.toFixed(1)}% cushion - high risk of loss`,
      });
      totalRisk += 3;
    } else if (input.cushionPercent < 5) {
      factors.push({
        name: 'Tight Cushion',
        impact: 2,
        description: `${input.cushionPercent.toFixed(1)}% cushion is below ideal`,
      });
      totalRisk += 2;
    }
  }

  // 3. Earnings Risk
  if (input.earningsDays !== undefined && input.earningsDays !== null) {
    if (input.earningsDays <= 7) {
      factors.push({
        name: 'Imminent Earnings',
        impact: 3,
        description: `Earnings in ${input.earningsDays} days - extreme volatility risk`,
      });
      totalRisk += 3;
    } else if (input.earningsDays <= 14) {
      factors.push({
        name: 'Upcoming Earnings',
        impact: 2,
        description: `Earnings in ${input.earningsDays} days - elevated volatility`,
      });
      totalRisk += 2;
    }
  }

  // 4. DTE Risk
  if (input.dte !== undefined) {
    if (input.dte < 14) {
      factors.push({
        name: 'Short DTE',
        impact: 2,
        description: `Only ${input.dte} DTE - limited time for recovery`,
      });
      totalRisk += 2;
    }
  }

  // 5. Position Size Risk
  if (input.positionSizePercent !== undefined) {
    if (input.positionSizePercent > 30) {
      factors.push({
        name: 'Oversized Position',
        impact: 3,
        description: `${input.positionSizePercent.toFixed(0)}% of account - too concentrated`,
      });
      totalRisk += 3;
    } else if (input.positionSizePercent > 20) {
      factors.push({
        name: 'Large Position',
        impact: 1,
        description: `${input.positionSizePercent.toFixed(0)}% of account - above guideline`,
      });
      totalRisk += 1;
    }
  }

  // 6. Trend Risk
  if (input.aboveMA200 === false) {
    factors.push({
      name: 'Below MA200',
      impact: 2,
      description: 'Trading against the primary trend',
    });
    totalRisk += 2;
  }

  // Normalize to 1-10 scale
  const score = Math.min(10, Math.max(1, Math.round(totalRisk * 1.5) + 1));

  let level: RiskScore['level'];
  if (score <= 3) level = 'LOW';
  else if (score <= 5) level = 'MODERATE';
  else if (score <= 7) level = 'HIGH';
  else level = 'EXTREME';

  const summary =
    factors.length === 0
      ? 'No significant risk factors identified'
      : `${factors.length} risk factor${factors.length > 1 ? 's' : ''}: ${factors.map((f) => f.name).join(', ')}`;

  return {
    score,
    level,
    factors,
    summary,
  };
}

// ============================================================================
// COMBINED ANALYSIS
// ============================================================================

export interface FullAnalysisInput {
  ticker: string;
  price: number;
  rsi?: number;
  ma200?: number;
  aboveMA200?: boolean;
  earningsDays?: number | null;
  // Spread details (optional - for existing position or recommendation)
  longStrike?: number;
  shortStrike?: number;
  debit?: number;
  dte?: number;
  // Account context
  accountSize?: number;
}

export function performFullAnalysis(
  input: FullAnalysisInput
): AdvancedAnalysis | null {
  const { price, longStrike, shortStrike, debit } = input;

  // Need spread details for full analysis
  if (!longStrike || !shortStrike || !debit) {
    return null;
  }

  const spreadWidth = shortStrike - longStrike;
  const breakeven = longStrike + debit;
  const cushionPercent = ((price - breakeven) / price) * 100;
  const positionCost = debit * 100;
  const positionSizePercent = input.accountSize
    ? (positionCost / input.accountSize) * 100
    : undefined;

  // Grade the trade
  const grade = gradeTradeOpportunity({
    price,
    rsi: input.rsi,
    ma200: input.ma200,
    aboveMA200: input.aboveMA200,
    earningsDays: input.earningsDays,
    cushionPercent,
    dte: input.dte,
    spreadWidth,
    debit,
  });

  // Scenario analysis
  const scenarios = analyzeScenarios({
    currentPrice: price,
    longStrike,
    shortStrike,
    debit,
  });

  // Risk score
  const risk = calculateRiskScore({
    rsi: input.rsi,
    cushionPercent,
    earningsDays: input.earningsDays,
    dte: input.dte,
    positionSizePercent,
    aboveMA200: input.aboveMA200,
  });

  return {
    grade,
    scenarios,
    risk,
  };
}

// ============================================================================
// FORMAT FOR AI CONTEXT
// ============================================================================

export function formatAnalysisForAI(analysis: AdvancedAnalysis): string {
  let output = '';

  // Grade section
  output += `\n=== TRADE GRADE: ${analysis.grade.grade} ===\n`;
  output += `Score: ${analysis.grade.score}/${analysis.grade.maxScore} (${analysis.grade.percentage.toFixed(0)}%)\n`;
  output += `Recommendation: ${analysis.grade.recommendation}\n\n`;

  output += `Criteria breakdown:\n`;
  for (const c of analysis.grade.criteria) {
    const icon = c.passed ? '✓' : '✗';
    output += `  ${icon} ${c.name}: ${c.points}/${c.maxPoints} pts - ${c.reason}\n`;
  }

  // Risk section
  output += `\n=== RISK SCORE: ${analysis.risk.score}/10 (${analysis.risk.level}) ===\n`;
  if (analysis.risk.factors.length > 0) {
    for (const f of analysis.risk.factors) {
      output += `  ⚠ ${f.name} (impact: ${f.impact}/3) - ${f.description}\n`;
    }
  } else {
    output += `  No significant risk factors\n`;
  }

  // Scenario section
  output += `\n=== SCENARIO ANALYSIS ===\n`;
  for (const s of analysis.scenarios) {
    const pnlStr = s.pnl >= 0 ? `+$${s.pnl}` : `-$${Math.abs(s.pnl)}`;
    output += `  ${s.scenario}: $${s.newPrice.toFixed(2)} → ${pnlStr} (${s.outcome})\n`;
  }

  return output;
}
