/**
 * Trade Scanner Service
 *
 * Scans multiple tickers to find optimal trading opportunities.
 * Shared between CLI and Frontend for consistent scanning logic.
 *
 * Features:
 * - Predefined scan lists (tech, semis, mega-cap, etc.)
 * - Trade grading with A-F system
 * - Risk scoring
 * - Cushion and RSI filtering
 * - Uses strategy.config.yaml for thresholds (Lesson 001)
 *
 * @example
 * ```typescript
 * import { quickScan, SCAN_LISTS } from '@lib/ai-agent';
 *
 * const results = await quickScan(SCAN_LISTS.TECH, { minGrade: 'B' });
 * console.log(`Found ${results.length} opportunities`);
 * ```
 */

import { fetchTickerData } from '../data';
import { getEntryConfig, getSpreadParamsConfig } from '../config';

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
}

export interface RiskFactor {
  name: string;
  impact: number; // 1-3
  description: string;
}

export interface RiskScore {
  score: number; // 1-10 (1 = low risk, 10 = high risk)
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  factors: RiskFactor[];
  summary: string;
}

export interface ScanResult {
  ticker: string;
  price: number;
  grade: TradeGrade;
  gradeResult: TradeGradeResult;
  risk: RiskScore;
  rsi: number;
  aboveMA200: boolean;
  cushionPercent?: number;
  earningsDays?: number;
  // Additional context
  change?: number;
  changePct?: number;
  marketCap?: number;
  iv?: number;
  spread?: {
    longStrike: number;
    shortStrike: number;
    debit: number;
    dte: number;
  };
}

export interface ScanOptions {
  minGrade?: TradeGrade;
  maxRisk?: number;
  minCushion?: number;
  requireAboveMA200?: boolean;
  maxRsi?: number;
  minRsi?: number;
  onProgress?: (ticker: string, current: number, total: number) => void;
}

// ============================================================================
// SCAN LISTS
// ============================================================================

/**
 * Predefined lists of tickers for scanning
 */
export const SCAN_LISTS = {
  // Main trading universe
  TECH: [
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'META',
    'NVDA',
    'AMD',
    'CRM',
    'ORCL',
    'ADBE',
    'NOW',
    'SHOP',
    'SQ',
    'PYPL',
  ],

  SEMIS: [
    'NVDA',
    'AMD',
    'AVGO',
    'QCOM',
    'INTC',
    'MU',
    'MRVL',
    'AMAT',
    'LRCX',
    'KLAC',
    'TSM',
  ],

  MEGACAP: [
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'META',
    'NVDA',
    'TSLA',
    'BRK-B',
    'JPM',
    'V',
    'UNH',
    'MA',
  ],

  FINANCIALS: [
    'JPM',
    'BAC',
    'WFC',
    'GS',
    'MS',
    'C',
    'SCHW',
    'BLK',
    'AXP',
    'COF',
    'V',
    'MA',
  ],

  HEALTHCARE: [
    'UNH',
    'JNJ',
    'PFE',
    'ABBV',
    'MRK',
    'LLY',
    'TMO',
    'ABT',
    'BMY',
    'AMGN',
  ],

  CONSUMER: [
    'HD',
    'MCD',
    'NKE',
    'SBUX',
    'TGT',
    'COST',
    'WMT',
    'LOW',
    'DIS',
    'NFLX',
  ],

  ENERGY: [
    'XOM',
    'CVX',
    'COP',
    'SLB',
    'EOG',
    'OXY',
    'PSX',
    'VLO',
    'MPC',
    'HAL',
  ],

  // Full universe for comprehensive scans
  FULL: [
    'AAPL',
    'MSFT',
    'GOOGL',
    'AMZN',
    'META',
    'NVDA',
    'AMD',
    'TSLA',
    'CRM',
    'ORCL',
    'ADBE',
    'NOW',
    'SHOP',
    'SQ',
    'PYPL',
    'AVGO',
    'QCOM',
    'INTC',
    'MU',
    'MRVL',
    'AMAT',
    'LRCX',
    'KLAC',
    'TSM',
    'JPM',
    'BAC',
    'WFC',
    'GS',
    'MS',
    'V',
    'MA',
    'UNH',
    'JNJ',
    'LLY',
    'PFE',
    'ABBV',
    'HD',
    'MCD',
    'NKE',
    'SBUX',
    'TGT',
    'COST',
    'WMT',
    'DIS',
    'NFLX',
    'XOM',
    'CVX',
    'COP',
  ],
} as const;

// ============================================================================
// GRADING SYSTEM
// ============================================================================

/**
 * Get grade rubric dynamically from config
 * This ensures grading thresholds match strategy.config.yaml
 */
export function getGradeRubric() {
  const entry = getEntryConfig();

  return {
    criteria: [
      {
        name: 'Above MA200',
        maxPoints: 25,
        desc: 'Price above 200-day MA = bullish trend',
      },
      {
        name: 'RSI Zone',
        maxPoints: 20,
        desc: `RSI ${entry.momentum.rsi_ideal_min}-${entry.momentum.rsi_ideal_max} = ideal, ${entry.momentum.rsi_ideal_max}-${entry.momentum.rsi_max + 5} = partial, >${entry.momentum.rsi_max + 10} = overbought`,
      },
      {
        name: 'Cushion',
        maxPoints: 20,
        desc: `>${entry.cushion.preferred_pct}% = full, ${entry.cushion.minimum_pct}-${entry.cushion.preferred_pct}% = partial, <${entry.cushion.minimum_pct}% = risky`,
      },
      {
        name: 'IV Level',
        maxPoints: 15,
        desc: `<${entry.volatility.iv_preferred_max_pct}% = full, ${entry.volatility.iv_preferred_max_pct}-${entry.volatility.iv_max_pct}% = partial, >${entry.volatility.avoid_if_iv_above}% = risky`,
      },
      {
        name: 'Earnings',
        maxPoints: 10,
        desc: `>${entry.earnings.preferred_days_until} days = safe, ${entry.earnings.min_days_until}-${entry.earnings.preferred_days_until} = partial, <${entry.earnings.min_days_until} = avoid`,
      },
      {
        name: 'Risk/Reward',
        maxPoints: 10,
        desc: `>${entry.spread.preferred_ror_pct}% return = full, ${entry.spread.min_return_on_risk_pct}-${entry.spread.preferred_ror_pct}% = partial, <${entry.spread.min_return_on_risk_pct}% = poor`,
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
  };
}

/**
 * Grade rubric for transparency (static export for backward compatibility)
 * @deprecated Use getGradeRubric() for dynamic config-based values
 */
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
};

interface GradingInput {
  price: number;
  rsi?: number;
  ma200?: number;
  aboveMA200?: boolean;
  earningsDays?: number | null;
  cushionPercent?: number;
  dte?: number;
  spreadWidth?: number;
  debit?: number;
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

/**
 * Compare grades (returns true if a >= b)
 */
export function gradeAtLeast(a: TradeGrade, b: TradeGrade): boolean {
  const gradeOrder: TradeGrade[] = [
    'A+',
    'A',
    'A-',
    'B+',
    'B',
    'B-',
    'C+',
    'C',
    'C-',
    'D',
    'F',
  ];
  return gradeOrder.indexOf(a) <= gradeOrder.indexOf(b);
}

/**
 * Grade a trade opportunity using config-based thresholds
 */
export function gradeTradeOpportunity(input: GradingInput): TradeGradeResult {
  const entry = getEntryConfig();
  const spreadParams = getSpreadParamsConfig();
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

  // 2. RSI Range (20 points) - uses config thresholds
  if (input.rsi !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    const { rsi_min, rsi_max, rsi_ideal_min, rsi_ideal_max } = entry.momentum;

    if (input.rsi >= rsi_ideal_min && input.rsi <= rsi_ideal_max) {
      points = 20;
      passed = true;
      reason = `RSI ${input.rsi.toFixed(1)} in ideal range (${rsi_ideal_min}-${rsi_ideal_max})`;
    } else if (input.rsi > rsi_ideal_max && input.rsi <= rsi_max + 5) {
      points = 10;
      passed = true;
      reason = `RSI ${input.rsi.toFixed(1)} slightly elevated but acceptable`;
    } else if (input.rsi > rsi_max + 5) {
      points = 0;
      passed = false;
      reason = `RSI ${input.rsi.toFixed(1)} too high - overbought`;
    } else if (input.rsi < rsi_min) {
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

  // 3. Cushion (20 points) - uses config thresholds
  if (input.cushionPercent !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    const { minimum_pct, preferred_pct, excellent_pct } = entry.cushion;

    if (input.cushionPercent >= excellent_pct) {
      points = 20;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - excellent buffer`;
    } else if (input.cushionPercent >= preferred_pct) {
      points = 15;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - good buffer`;
    } else if (input.cushionPercent >= minimum_pct) {
      points = 10;
      passed = true;
      reason = `${input.cushionPercent.toFixed(1)}% cushion - acceptable`;
    } else if (input.cushionPercent >= minimum_pct - 2) {
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

  // 4. Earnings Safety (15 points) - uses config thresholds
  if (input.earningsDays !== undefined && input.earningsDays !== null) {
    let points = 0;
    let passed = false;
    let reason = '';

    const { min_days_until, preferred_days_until } = entry.earnings;

    if (input.earningsDays > preferred_days_until + 10) {
      points = 15;
      passed = true;
      reason = `Earnings ${input.earningsDays} days out - safe`;
    } else if (input.earningsDays > min_days_until) {
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

  // 5. DTE Appropriateness (10 points) - uses config thresholds
  if (input.dte !== undefined) {
    let points = 0;
    let passed = false;
    let reason = '';

    const { min: dteMin, max: dteMax } = spreadParams.dte;

    if (input.dte >= dteMin && input.dte <= dteMax) {
      points = 10;
      passed = true;
      reason = `${input.dte} DTE in optimal range (${dteMin}-${dteMax})`;
    } else if (input.dte > dteMax && input.dte <= dteMax + 15) {
      points = 7;
      passed = true;
      reason = `${input.dte} DTE slightly long but acceptable`;
    } else if (input.dte > 14 && input.dte < dteMin) {
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

  // 6. Risk/Reward (10 points) - uses config thresholds
  if (input.spreadWidth !== undefined && input.debit !== undefined) {
    const maxProfit = input.spreadWidth - input.debit;
    const returnOnRisk = (maxProfit / input.debit) * 100;

    let points = 0;
    let passed = false;
    let reason = '';

    const { min_return_on_risk_pct, preferred_ror_pct } = entry.spread;

    if (returnOnRisk >= preferred_ror_pct) {
      points = 10;
      passed = true;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - excellent`;
    } else if (returnOnRisk >= min_return_on_risk_pct) {
      points = 7;
      passed = true;
      reason = `${returnOnRisk.toFixed(0)}% return on risk - good`;
    } else if (returnOnRisk >= min_return_on_risk_pct - 5) {
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

// ============================================================================
// RISK SCORING
// ============================================================================

interface RiskInput {
  rsi?: number;
  cushionPercent?: number;
  earningsDays?: number | null;
  dte?: number;
  positionSizePercent?: number;
  aboveMA200?: boolean;
}

/**
 * Calculate risk score for a trade
 */
export function calculateRiskScore(input: RiskInput): RiskScore {
  const factors: RiskFactor[] = [];
  let totalRisk = 0;

  // 1. RSI Risk
  if (input.rsi !== undefined) {
    if (input.rsi > 65) {
      factors.push({
        name: 'Overbought RSI',
        impact: 3,
        description: `RSI at ${input.rsi.toFixed(0)} indicates overbought`,
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
        description: `Only ${input.cushionPercent.toFixed(1)}% cushion`,
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
        description: `Earnings in ${input.earningsDays} days`,
      });
      totalRisk += 3;
    } else if (input.earningsDays <= 14) {
      factors.push({
        name: 'Upcoming Earnings',
        impact: 2,
        description: `Earnings in ${input.earningsDays} days`,
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
        description: `Only ${input.dte} DTE - limited recovery time`,
      });
      totalRisk += 2;
    }
  }

  // 5. Trend Risk
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
      : `${factors.length} risk factor${factors.length > 1 ? 's' : ''}: ` +
        `${factors.map((f) => f.name).join(', ')}`;

  return {
    score,
    level,
    factors,
    summary,
  };
}

// ============================================================================
// SCANNER FUNCTIONS
// ============================================================================

/**
 * Analyze a single ticker for trade opportunity
 */
async function analyzeTicker(ticker: string): Promise<ScanResult | null> {
  try {
    const data = await fetchTickerData(ticker);
    if (!data || !data.price) {
      return null;
    }

    // Extract relevant data
    const rsi = data.rsi ?? 50;
    const aboveMA200 = data.aboveMA200 ?? false;
    const earningsDays = data.earningsDays ?? undefined;
    const cushionPercent = data.spread?.cushion;

    // Grade the opportunity
    const gradeResult = gradeTradeOpportunity({
      price: data.price,
      rsi,
      aboveMA200,
      earningsDays,
      cushionPercent,
      dte: data.spread?.dte,
      spreadWidth: data.spread
        ? data.spread.shortStrike - data.spread.longStrike
        : undefined,
      debit: data.spread?.estimatedDebit,
    });

    // Calculate risk
    const risk = calculateRiskScore({
      rsi,
      cushionPercent,
      earningsDays,
      dte: data.spread?.dte,
      aboveMA200,
    });

    return {
      ticker,
      price: data.price,
      grade: gradeResult.grade,
      gradeResult,
      risk,
      rsi,
      aboveMA200,
      cushionPercent,
      earningsDays,
      change: data.change,
      changePct: data.changePct,
      marketCap: data.marketCap,
      iv: data.iv?.currentIV,
      spread:
        data.spread && data.spread.estimatedDebit && data.spread.dte
          ? {
              longStrike: data.spread.longStrike,
              shortStrike: data.spread.shortStrike,
              debit: data.spread.estimatedDebit,
              dte: data.spread.dte,
            }
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Quick scan of tickers with basic filtering
 */
export async function quickScan(
  tickers: readonly string[],
  options: ScanOptions = {}
): Promise<ScanResult[]> {
  const {
    minGrade = 'C',
    maxRisk = 7,
    minCushion,
    requireAboveMA200 = false,
    maxRsi = 65,
    minRsi = 30,
    onProgress,
  } = options;

  const results: ScanResult[] = [];
  const total = tickers.length;

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    if (onProgress) {
      onProgress(ticker, i + 1, total);
    }

    const result = await analyzeTicker(ticker);
    if (!result) continue;

    // Apply filters
    if (!gradeAtLeast(result.grade, minGrade)) continue;
    if (result.risk.score > maxRisk) continue;
    if (minCushion && (result.cushionPercent ?? 0) < minCushion) continue;
    if (requireAboveMA200 && !result.aboveMA200) continue;
    if (result.rsi > maxRsi || result.rsi < minRsi) continue;

    results.push(result);
  }

  // Sort by grade (best first)
  results.sort((a, b) => {
    if (a.gradeResult.percentage !== b.gradeResult.percentage) {
      return b.gradeResult.percentage - a.gradeResult.percentage;
    }
    return a.risk.score - b.risk.score;
  });

  return results;
}

/**
 * Full scan with all details (slower but comprehensive)
 */
export async function fullScan(
  tickers: readonly string[],
  options: ScanOptions = {}
): Promise<ScanResult[]> {
  // Full scan uses the same logic but with no grade filter by default
  return quickScan(tickers, {
    ...options,
    minGrade: options.minGrade ?? 'F',
  });
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format scan results for AI context
 */
export function formatScanResultsForAI(results: ScanResult[]): string {
  if (results.length === 0) {
    return 'No opportunities found matching criteria.';
  }

  let output = `\n=== SCAN RESULTS (${results.length} found) ===\n`;

  for (const r of results.slice(0, 10)) {
    output += `\n${r.ticker} | Grade: ${r.grade} | Risk: ${r.risk.score}/10\n`;
    output += `  Price: $${r.price.toFixed(2)}`;
    if (r.changePct !== undefined) {
      const sign = r.changePct >= 0 ? '+' : '';
      output += ` (${sign}${r.changePct.toFixed(2)}%)`;
    }
    output += `\n`;
    output += `  RSI: ${r.rsi.toFixed(1)} | MA200: ${r.aboveMA200 ? 'Above ✓' : 'Below ✗'}\n`;

    if (r.cushionPercent !== undefined) {
      output += `  Cushion: ${r.cushionPercent.toFixed(1)}%\n`;
    }
    if (r.earningsDays !== undefined) {
      output += `  Earnings: ${r.earningsDays} days\n`;
    }
    if (r.spread) {
      output += `  Spread: $${r.spread.longStrike}/$${r.spread.shortStrike} `;
      output += `@ $${r.spread.debit.toFixed(2)} (${r.spread.dte} DTE)\n`;
    }

    output += `  ${r.gradeResult.recommendation} - ${r.risk.summary}\n`;
  }

  if (results.length > 10) {
    output += `\n... and ${results.length - 10} more results\n`;
  }

  output += `\n=== END SCAN ===\n`;

  return output;
}

/**
 * Encode scan results to TOON format
 */
export function encodeScanResultsToTOON(results: ScanResult[]): string {
  const lines = results.slice(0, 10).map((r) => {
    const parts = [
      r.ticker,
      `G:${r.grade}`,
      `R:${r.risk.score}`,
      `$${r.price.toFixed(0)}`,
      `RSI:${r.rsi.toFixed(0)}`,
    ];
    if (r.cushionPercent !== undefined) {
      parts.push(`C:${r.cushionPercent.toFixed(1)}%`);
    }
    return parts.join('|');
  });

  return `SCAN[${results.length}]:\n${lines.join('\n')}`;
}
