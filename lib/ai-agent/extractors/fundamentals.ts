/**
 * Fundamentals extractor
 *
 * Phase 1C: digest a `FinancialsDeep` payload into a compact summary
 * of strength, positives, and red flags. Pure threshold-based — Phase 3
 * may swap in a model-driven version once we have a real eval set.
 *
 * Phase 1 leaves `comparison` null. Wiring peer-comparison would
 * require a peer set + their financials, which the current preflight
 * doesn't fan out to.
 */

import type { FinancialsDeep } from '../data/types';
import type { FundamentalsDigest } from './types';

export function extractFundamentals(input: FinancialsDeep): FundamentalsDigest {
  const positives: string[] = [];
  const red_flags: string[] = [];
  const { income, balance, cashFlow } = input;

  // Income statement signals
  if (income.revenueGrowth != null && income.revenueGrowth >= 15) {
    positives.push(`Revenue +${income.revenueGrowth.toFixed(1)}% YoY`);
  } else if (income.revenueGrowth != null && income.revenueGrowth <= -5) {
    red_flags.push(
      `Revenue ${income.revenueGrowth.toFixed(1)}% YoY (declining)`
    );
  }

  if (income.operatingMargin >= 20) {
    positives.push(`Operating margin ${income.operatingMargin.toFixed(0)}%`);
  } else if (income.operatingMargin <= 0) {
    red_flags.push(
      `Operating margin ${income.operatingMargin.toFixed(0)}% (unprofitable)`
    );
  }

  if (income.netMargin <= 0) {
    red_flags.push(`Net margin ${income.netMargin.toFixed(0)}% (net loss)`);
  } else if (income.netMargin >= 15) {
    positives.push(`Net margin ${income.netMargin.toFixed(0)}%`);
  }

  // Balance sheet signals
  if (balance.debtToEquity > 2) {
    red_flags.push(`Debt/Equity ${balance.debtToEquity.toFixed(2)} (high)`);
  } else if (balance.debtToEquity < 0.5) {
    positives.push(`Debt/Equity ${balance.debtToEquity.toFixed(2)} (low)`);
  }

  if (balance.currentRatio < 1) {
    red_flags.push(
      `Current ratio ${balance.currentRatio.toFixed(2)} (liquidity tight)`
    );
  }

  // Cash flow signals
  if (cashFlow.freeCashFlow <= 0) {
    red_flags.push(`Free cash flow negative`);
  } else if (cashFlow.fcfYield != null && cashFlow.fcfYield >= 5) {
    positives.push(`FCF yield ${cashFlow.fcfYield.toFixed(1)}%`);
  }

  // Strength bucket: more positives than red flags = STRONG, more red
  // flags than positives = WEAK, else NEUTRAL. Hard floor: any net loss
  // OR negative FCF degrades to at most NEUTRAL.
  let strength: FundamentalsDigest['strength'];
  if (red_flags.length > positives.length) {
    strength = 'WEAK';
  } else if (positives.length > red_flags.length + 1) {
    strength = 'STRONG';
  } else {
    strength = 'NEUTRAL';
  }
  // Safety override: if there's a hard red flag (net loss or neg FCF),
  // never surface as STRONG.
  const hasHardRed = red_flags.some(
    (r) => r.includes('net loss') || r.includes('Free cash flow negative')
  );
  if (hasHardRed && strength === 'STRONG') {
    strength = 'NEUTRAL';
  }

  return {
    strength,
    positives,
    red_flags,
    comparison: null,
  };
}
