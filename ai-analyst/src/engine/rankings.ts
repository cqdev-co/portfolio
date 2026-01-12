/**
 * Comparative Rankings Engine
 *
 * Ranks opportunities by risk-adjusted expected value.
 * Enables Victor to compare current ticker against alternatives.
 */

import type { ScanResult } from '../services/scanner.ts';
import {
  calculateExpectedValue,
  type ExpectedValueResult,
} from './expected-value.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface RankedOpportunity {
  ticker: string;
  rank: number;

  // Core metrics
  price: number;
  grade: string;
  gradeScore: number; // 0-100 normalized
  riskScore: number; // 1-10 (lower is better)

  // Spread details
  spread?: {
    strikes: string;
    debit: number;
    cushion: number;
    maxProfit: number;
    dte: number;
  };

  // Expected value (if calculable)
  expectedValue?: ExpectedValueResult;

  // Composite scores
  riskAdjustedScore: number; // Primary ranking metric
  sharpeRatio?: number; // EV / Risk
  capitalEfficiency: number; // Return potential per $ at risk

  // Reasons for ranking
  strengths: string[];
  weaknesses: string[];

  // Comparison context
  vsTopTicker?: {
    ticker: string;
    delta: number; // How much worse than #1
    keyDifference: string;
  };
}

export interface RankingContext {
  totalScanned: number;
  averageScore: number;
  topTicker: string;
  currentTickerRank?: number;
  currentTickerPercentile?: number;
}

export interface ComparativeAnalysis {
  ticker: string;
  rank: number;
  totalInSet: number;
  percentile: number;

  // How it compares
  betterThan: RankedOpportunity[];
  worseThan: RankedOpportunity[];

  // Key differentiators
  advantages: string[];
  disadvantages: string[];

  // Victor's take
  summary: string;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Convert letter grade to numeric score (0-100)
 */
function gradeToScore(grade: string): number {
  const grades: Record<string, number> = {
    'A+': 100,
    A: 95,
    'A-': 90,
    'B+': 85,
    B: 80,
    'B-': 75,
    'C+': 70,
    C: 65,
    'C-': 60,
    D: 50,
    F: 30,
  };
  return grades[grade] ?? 50;
}

/**
 * Calculate risk-adjusted score
 * Higher is better
 */
function calculateRiskAdjustedScore(
  gradeScore: number,
  riskScore: number,
  cushion?: number,
  ev?: ExpectedValueResult
): number {
  // Base score from grade (0-100)
  let score = gradeScore;

  // Adjust for risk (lower risk = better)
  // Risk of 5 is neutral, <5 adds points, >5 subtracts
  const riskAdjustment = (5 - riskScore) * 3; // ±15 points max
  score += riskAdjustment;

  // Adjust for cushion (if available)
  if (cushion !== undefined) {
    // 10% cushion is baseline, each % above adds 1 point
    const cushionAdjustment = Math.min(10, cushion - 10);
    score += cushionAdjustment;
  }

  // Adjust for expected value (if available)
  if (ev) {
    // Positive EV adds points, negative subtracts
    if (ev.isPositiveEV) {
      score += Math.min(15, ev.expectedValuePct / 2);
    } else {
      score += Math.max(-15, ev.expectedValuePct / 2);
    }

    // High probability of profit adds points
    if (ev.probabilityOfProfit >= 0.65) {
      score += 5;
    } else if (ev.probabilityOfProfit < 0.5) {
      score -= 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate capital efficiency (return per dollar at risk)
 */
function calculateCapitalEfficiency(spread?: {
  maxProfit: number;
  debit: number;
}): number {
  if (!spread) return 0;

  const maxRisk = spread.debit * 100;
  const maxReturn = spread.maxProfit * 100;

  return maxRisk > 0 ? maxReturn / maxRisk : 0;
}

/**
 * Identify strengths from scan result
 */
function identifyStrengths(
  result: ScanResult,
  ev?: ExpectedValueResult
): string[] {
  const strengths: string[] = [];

  // Grade-based strengths
  if (result.grade.grade.startsWith('A')) {
    strengths.push('Top-tier grade');
  }

  // Risk-based strengths
  if (result.risk.score <= 4) {
    strengths.push('Low risk profile');
  }

  // Cushion-based strengths
  if (result.spread && result.spread.cushion >= 12) {
    strengths.push(`Strong ${result.spread.cushion.toFixed(0)}% cushion`);
  }

  // IV-based strengths
  if (result.iv?.level === 'LOW') {
    strengths.push('Low IV - cheap options');
  }

  // EV-based strengths
  if (ev?.isPositiveEV && ev.expectedValue > 30) {
    strengths.push(`+$${ev.expectedValue.toFixed(0)} expected value`);
  }
  if (ev?.probabilityOfProfit && ev.probabilityOfProfit >= 0.65) {
    strengths.push(
      `${(ev.probabilityOfProfit * 100).toFixed(0)}% win probability`
    );
  }

  // Parse reasons for more strengths
  for (const reason of result.reasons) {
    if (reason.includes('✓') && !reason.includes('✗')) {
      // Extract the key point
      const clean = reason.replace(' ✓', '').trim();
      if (
        !strengths.some((s) => s.toLowerCase().includes(clean.toLowerCase()))
      ) {
        strengths.push(clean);
      }
    }
  }

  return strengths.slice(0, 4);
}

/**
 * Identify weaknesses from scan result
 */
function identifyWeaknesses(
  result: ScanResult,
  ev?: ExpectedValueResult
): string[] {
  const weaknesses: string[] = [];

  // Grade-based weaknesses
  if (result.grade.grade.startsWith('C') || result.grade.grade === 'D') {
    weaknesses.push('Below-average grade');
  }

  // Risk-based weaknesses
  if (result.risk.score >= 7) {
    weaknesses.push(`Elevated risk (${result.risk.score}/10)`);
  }

  // Cushion-based weaknesses
  if (result.spread && result.spread.cushion < 8) {
    weaknesses.push(`Thin ${result.spread.cushion.toFixed(0)}% cushion`);
  }

  // IV-based weaknesses
  if (result.iv?.level === 'HIGH') {
    weaknesses.push('High IV - expensive options');
  }

  // EV-based weaknesses
  if (ev && !ev.isPositiveEV) {
    weaknesses.push('Negative expected value');
  }
  if (ev?.probabilityOfProfit && ev.probabilityOfProfit < 0.5) {
    weaknesses.push(
      `Only ${(ev.probabilityOfProfit * 100).toFixed(0)}% win probability`
    );
  }

  // Parse reasons for more weaknesses
  for (const reason of result.reasons) {
    if (reason.includes('✗')) {
      const clean = reason.replace(' ✗', '').trim();
      if (
        !weaknesses.some((w) => w.toLowerCase().includes(clean.toLowerCase()))
      ) {
        weaknesses.push(clean);
      }
    }
  }

  return weaknesses.slice(0, 4);
}

// ============================================================================
// RANKING FUNCTIONS
// ============================================================================

/**
 * Rank a set of scan results
 */
export function rankOpportunities(
  results: ScanResult[],
  includeEV: boolean = true,
  defaultIV: number = 0.3
): RankedOpportunity[] {
  const ranked: RankedOpportunity[] = [];

  for (const result of results) {
    // Calculate expected value if we have spread data
    let ev: ExpectedValueResult | undefined;
    if (includeEV && result.spread) {
      try {
        const iv = result.iv?.current ? result.iv.current / 100 : defaultIV;

        ev = calculateExpectedValue({
          longStrike: parseFloat(
            result.spread.strikes.split('/')[0].replace('$', '')
          ),
          shortStrike: parseFloat(
            result.spread.strikes.split('/')[1].replace('$', '')
          ),
          debit: result.spread.debit,
          currentPrice: result.price,
          dte: result.spread.dte,
          iv,
        });
      } catch {
        // EV calculation failed - continue without it
      }
    }

    const gradeScore = gradeToScore(result.grade.grade);
    const riskAdjustedScore = calculateRiskAdjustedScore(
      gradeScore,
      result.risk.score,
      result.spread?.cushion,
      ev
    );
    const capitalEfficiency = calculateCapitalEfficiency(result.spread);

    // Calculate Sharpe-like ratio (EV / Risk)
    let sharpeRatio: number | undefined;
    if (ev && result.spread) {
      const risk = result.spread.debit * 100;
      if (risk > 0) {
        sharpeRatio = ev.expectedValue / risk;
      }
    }

    ranked.push({
      ticker: result.ticker,
      rank: 0, // Will be set after sorting
      price: result.price,
      grade: result.grade.grade,
      gradeScore,
      riskScore: result.risk.score,
      spread: result.spread,
      expectedValue: ev,
      riskAdjustedScore,
      sharpeRatio,
      capitalEfficiency,
      strengths: identifyStrengths(result, ev),
      weaknesses: identifyWeaknesses(result, ev),
    });
  }

  // Sort by risk-adjusted score (descending)
  ranked.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

  // Assign ranks and compute vs-top comparisons
  const topTicker = ranked[0]?.ticker ?? '';
  const topScore = ranked[0]?.riskAdjustedScore ?? 0;

  for (let i = 0; i < ranked.length; i++) {
    ranked[i].rank = i + 1;

    if (i > 0) {
      ranked[i].vsTopTicker = {
        ticker: topTicker,
        delta: topScore - ranked[i].riskAdjustedScore,
        keyDifference: findKeyDifference(ranked[0], ranked[i]),
      };
    }
  }

  return ranked;
}

/**
 * Find the key difference between two opportunities
 */
function findKeyDifference(
  better: RankedOpportunity,
  worse: RankedOpportunity
): string {
  // Compare grades
  if (better.gradeScore - worse.gradeScore >= 10) {
    return `${better.ticker} has better grade (${better.grade} vs ${worse.grade})`;
  }

  // Compare risk
  if (worse.riskScore - better.riskScore >= 2) {
    return `${better.ticker} has lower risk (${better.riskScore} vs ${worse.riskScore})`;
  }

  // Compare cushion
  const betterCushion = better.spread?.cushion ?? 0;
  const worseCushion = worse.spread?.cushion ?? 0;
  if (betterCushion - worseCushion >= 3) {
    return (
      `${better.ticker} has more cushion ` +
      `(${betterCushion.toFixed(0)}% vs ${worseCushion.toFixed(0)}%)`
    );
  }

  // Compare EV
  const betterEV = better.expectedValue?.expectedValue ?? 0;
  const worseEV = worse.expectedValue?.expectedValue ?? 0;
  if (betterEV - worseEV >= 20) {
    return `${better.ticker} has better expected value`;
  }

  return `${better.ticker} has overall better risk/reward profile`;
}

/**
 * Get comparative analysis for a specific ticker
 */
export function getComparativeAnalysis(
  ticker: string,
  rankedOpportunities: RankedOpportunity[]
): ComparativeAnalysis | null {
  const target = rankedOpportunities.find(
    (r) => r.ticker.toUpperCase() === ticker.toUpperCase()
  );

  if (!target) return null;

  const rank = target.rank;
  const total = rankedOpportunities.length;
  const percentile = Math.round(((total - rank + 1) / total) * 100);

  // Find opportunities better and worse than target
  const betterThan = rankedOpportunities
    .filter((r) => r.rank > rank)
    .slice(0, 3);
  const worseThan = rankedOpportunities.filter((r) => r.rank < rank).slice(-3);

  // Compile advantages vs worse opportunities
  const advantages: string[] = [];
  for (const worse of betterThan.slice(0, 2)) {
    if (target.gradeScore > worse.gradeScore) {
      advantages.push(`Better grade than ${worse.ticker}`);
    }
    if (target.riskScore < worse.riskScore) {
      advantages.push(`Lower risk than ${worse.ticker}`);
    }
  }

  // Compile disadvantages vs better opportunities
  const disadvantages: string[] = [];
  for (const better of worseThan.slice(-2)) {
    if (better.gradeScore > target.gradeScore) {
      disadvantages.push(`${better.ticker} has better grade`);
    }
    if (better.riskScore < target.riskScore) {
      disadvantages.push(`${better.ticker} has lower risk`);
    }
    if ((better.spread?.cushion ?? 0) > (target.spread?.cushion ?? 0) + 2) {
      disadvantages.push(`${better.ticker} has more cushion`);
    }
  }

  // Build summary
  let summary: string;
  if (rank === 1) {
    summary =
      `${ticker} is my #1 pick right now. ` +
      `Best risk-adjusted opportunity in the current scan.`;
  } else if (percentile >= 80) {
    summary =
      `${ticker} ranks #${rank} of ${total} - top ${100 - percentile}%. ` +
      `Strong opportunity, though ${worseThan[worseThan.length - 1]?.ticker ?? 'others'} ` +
      `edges it out.`;
  } else if (percentile >= 50) {
    summary =
      `${ticker} ranks #${rank} of ${total} - middle of the pack. ` +
      `Decent but not compelling when better alternatives exist.`;
  } else {
    summary =
      `${ticker} ranks #${rank} of ${total} - bottom ${percentile}%. ` +
      `Would look elsewhere - ${worseThan
        .slice(-2)
        .map((r) => r.ticker)
        .join(', ')} ` +
      `are better options.`;
  }

  return {
    ticker,
    rank,
    totalInSet: total,
    percentile,
    betterThan,
    worseThan,
    advantages: [...new Set(advantages)].slice(0, 3),
    disadvantages: [...new Set(disadvantages)].slice(0, 3),
    summary,
  };
}

// ============================================================================
// FORMATTING FOR AI
// ============================================================================

/**
 * Format rankings for AI context
 */
export function formatRankingsForAI(
  rankings: RankedOpportunity[],
  limit: number = 5
): string {
  if (rankings.length === 0) {
    return 'No opportunities to rank.';
  }

  const lines: string[] = [];
  lines.push(`TOP ${Math.min(limit, rankings.length)} OPPORTUNITIES:`);

  for (const r of rankings.slice(0, limit)) {
    const ev = r.expectedValue
      ? ` EV:${r.expectedValue.expectedValue >= 0 ? '+' : ''}` +
        `$${r.expectedValue.expectedValue.toFixed(0)}`
      : '';
    const cushion = r.spread ? ` ${r.spread.cushion.toFixed(0)}%cush` : '';

    lines.push(
      `  #${r.rank} ${r.ticker} - ` +
        `Grade ${r.grade} | Risk ${r.riskScore}/10${cushion}${ev}`
    );

    if (r.strengths.length > 0) {
      lines.push(`      ✓ ${r.strengths.slice(0, 2).join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format comparative analysis for AI context
 */
export function formatComparisonForAI(analysis: ComparativeAnalysis): string {
  const lines: string[] = [];

  lines.push(
    `${analysis.ticker} RANKING: #${analysis.rank}/${analysis.totalInSet} ` +
      `(top ${100 - analysis.percentile}%)`
  );
  lines.push(`  ${analysis.summary}`);

  if (analysis.disadvantages.length > 0 && analysis.rank > 1) {
    lines.push(
      `  Consider instead: ${analysis.worseThan
        .slice(-2)
        .map((r) => r.ticker)
        .join(', ')}`
    );
  }

  return lines.join('\n');
}

/**
 * Compact TOON format
 */
export function formatRankingsTOON(
  rankings: RankedOpportunity[],
  limit: number = 3
): string {
  const parts = rankings.slice(0, limit).map((r) => {
    const ev = r.expectedValue
      ? `EV${r.expectedValue.expectedValue >= 0 ? '+' : ''}` +
        `${r.expectedValue.expectedValue.toFixed(0)}`
      : '';
    return `#${r.rank}${r.ticker}:${r.grade}|R${r.riskScore}${ev ? '|' + ev : ''}`;
  });

  return `RANK:${parts.join(';')}`;
}
