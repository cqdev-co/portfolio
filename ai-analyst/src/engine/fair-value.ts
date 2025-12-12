/**
 * Fair Value Calculator
 * Estimates intrinsic value using DCF and relative valuation
 */

import type { FairValueResult, ValueVerdict } from "../types/index.ts";

// ============================================================================
// SECTOR BENCHMARKS
// ============================================================================

/**
 * Sector average P/E ratios (approximate)
 */
const SECTOR_PE: Record<string, number> = {
  "Technology": 28,
  "Financial Services": 12,
  "Healthcare": 22,
  "Consumer Cyclical": 20,
  "Communication Services": 18,
  "Industrials": 20,
  "Consumer Defensive": 22,
  "Energy": 12,
  "Utilities": 18,
  "Real Estate": 35,
  "Basic Materials": 15,
};

/**
 * Sector average PEG ratios
 */
const SECTOR_PEG: Record<string, number> = {
  "Technology": 1.8,
  "Financial Services": 1.2,
  "Healthcare": 1.5,
  "Consumer Cyclical": 1.4,
  "Communication Services": 1.3,
  "Industrials": 1.4,
  "Consumer Defensive": 2.0,
  "Energy": 1.0,
  "Utilities": 2.5,
  "Real Estate": 2.0,
  "Basic Materials": 1.2,
};

// ============================================================================
// VALUATION INPUTS
// ============================================================================

export interface ValuationInputs {
  ticker: string;
  currentPrice: number;
  sector?: string;
  
  // Earnings data
  trailingEps?: number;
  forwardEps?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  
  // Cash flow data
  freeCashFlow?: number;
  marketCap?: number;
  sharesOutstanding?: number;
  
  // Growth data
  earningsGrowth?: number;
  revenueGrowth?: number;
  
  // Analyst data
  targetPrice?: number;
}

// ============================================================================
// DCF VALUATION
// ============================================================================

/**
 * Simple DCF valuation based on FCF yield
 * 
 * Method: FCF per share × (1 + growth)^5 / discount rate
 * Simplified for quick estimation
 */
function calculateDCFValue(inputs: ValuationInputs): number | null {
  if (
    !inputs.freeCashFlow || 
    !inputs.sharesOutstanding ||
    inputs.freeCashFlow <= 0
  ) {
    return null;
  }

  const fcfPerShare = inputs.freeCashFlow / inputs.sharesOutstanding;
  
  // Use forward growth or default to 5%
  const growthRate = inputs.earningsGrowth ?? 0.05;
  const clampedGrowth = Math.max(-0.1, Math.min(0.3, growthRate)); // Clamp -10% to 30%
  
  // 10% discount rate (typical cost of equity)
  const discountRate = 0.10;
  
  // Terminal multiple based on growth
  const terminalMultiple = clampedGrowth > 0.15 ? 20 : clampedGrowth > 0.05 ? 15 : 12;
  
  // 5-year projection
  let presentValue = 0;
  let projectedFcf = fcfPerShare;
  
  for (let year = 1; year <= 5; year++) {
    projectedFcf *= (1 + clampedGrowth);
    presentValue += projectedFcf / Math.pow(1 + discountRate, year);
  }
  
  // Terminal value
  const terminalValue = (projectedFcf * terminalMultiple) / 
                        Math.pow(1 + discountRate, 5);
  
  return presentValue + terminalValue;
}

// ============================================================================
// P/E RELATIVE VALUATION
// ============================================================================

/**
 * Calculate fair value based on P/E relative to sector
 */
function calculatePERelativeValue(inputs: ValuationInputs): number | null {
  if (!inputs.trailingEps || inputs.trailingEps <= 0 || !inputs.sector) {
    return null;
  }

  const sectorPE = SECTOR_PE[inputs.sector] ?? 20;
  
  // Adjust sector P/E based on company's growth
  let adjustedPE = sectorPE;
  if (inputs.earningsGrowth !== undefined) {
    if (inputs.earningsGrowth > 0.20) {
      adjustedPE *= 1.3; // Premium for high growth
    } else if (inputs.earningsGrowth > 0.10) {
      adjustedPE *= 1.1; // Slight premium
    } else if (inputs.earningsGrowth < 0) {
      adjustedPE *= 0.8; // Discount for declining
    }
  }

  return inputs.trailingEps * adjustedPE;
}

// ============================================================================
// PEG VALUATION
// ============================================================================

/**
 * Calculate fair value based on PEG ratio
 */
function calculatePEGValue(inputs: ValuationInputs): number | null {
  if (
    !inputs.trailingEps || 
    inputs.trailingEps <= 0 ||
    !inputs.earningsGrowth ||
    inputs.earningsGrowth <= 0
  ) {
    return null;
  }

  const sector = inputs.sector ?? "Technology";
  const fairPEG = SECTOR_PEG[sector] ?? 1.5;
  
  // Fair P/E = PEG × Growth Rate (as percentage)
  const growthPct = inputs.earningsGrowth * 100;
  const fairPE = fairPEG * growthPct;
  
  return inputs.trailingEps * fairPE;
}

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

/**
 * Calculate fair value using multiple methods
 */
export function calculateFairValue(inputs: ValuationInputs): FairValueResult {
  const reasoning: string[] = [];
  
  // Calculate using each method
  const dcfValue = calculateDCFValue(inputs);
  const peRelativeValue = calculatePERelativeValue(inputs);
  const pegValue = calculatePEGValue(inputs);
  
  // Build reasoning
  if (dcfValue) {
    reasoning.push(
      `DCF: $${dcfValue.toFixed(2)} (based on FCF growth projection)`
    );
  }
  if (peRelativeValue) {
    reasoning.push(
      `P/E Relative: $${peRelativeValue.toFixed(2)} (vs ${inputs.sector} avg)`
    );
  }
  if (pegValue) {
    reasoning.push(
      `PEG: $${pegValue.toFixed(2)} (growth-adjusted)`
    );
  }
  
  // Calculate composite fair value (average of available methods)
  const values = [dcfValue, peRelativeValue, pegValue].filter(
    (v): v is number => v !== null
  );
  
  let compositeFairValue: number;
  if (values.length > 0) {
    compositeFairValue = values.reduce((a, b) => a + b, 0) / values.length;
  } else {
    // Fallback: use analyst target or current price
    compositeFairValue = inputs.targetPrice ?? inputs.currentPrice;
    reasoning.push("Limited data - using analyst target as reference");
  }
  
  // Calculate margin of safety
  const marginOfSafety = 
    ((compositeFairValue - inputs.currentPrice) / compositeFairValue) * 100;
  
  // Determine verdict
  let verdict: ValueVerdict;
  if (marginOfSafety > 15) {
    verdict = "undervalued";
    reasoning.push(
      `${marginOfSafety.toFixed(0)}% margin of safety - potentially undervalued`
    );
  } else if (marginOfSafety < -15) {
    verdict = "overvalued";
    reasoning.push(
      `Trading ${Math.abs(marginOfSafety).toFixed(0)}% above fair value - potentially overvalued`
    );
  } else {
    verdict = "fair";
    reasoning.push("Trading near fair value");
  }
  
  // Add P/E context
  if (inputs.trailingPE && inputs.sector) {
    const sectorPE = SECTOR_PE[inputs.sector] ?? 20;
    if (inputs.trailingPE < sectorPE * 0.8) {
      reasoning.push(
        `P/E ${inputs.trailingPE.toFixed(1)} below sector avg ${sectorPE} ✓`
      );
    } else if (inputs.trailingPE > sectorPE * 1.3) {
      reasoning.push(
        `P/E ${inputs.trailingPE.toFixed(1)} above sector avg ${sectorPE} ⚠`
      );
    }
  }
  
  return {
    ticker: inputs.ticker,
    currentPrice: inputs.currentPrice,
    dcfValue,
    peRelativeValue,
    pegValue,
    marginOfSafety,
    verdict,
    reasoning,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format fair value result for CLI display
 */
export function formatFairValueForDisplay(result: FairValueResult): string[] {
  const lines: string[] = [];
  
  // Main values
  const values: string[] = [];
  if (result.dcfValue) {
    values.push(`DCF: $${result.dcfValue.toFixed(0)}`);
  }
  if (result.peRelativeValue) {
    values.push(`P/E Rel: $${result.peRelativeValue.toFixed(0)}`);
  }
  
  if (values.length > 0) {
    lines.push(values.join(" | ") + ` | Current: $${result.currentPrice.toFixed(2)}`);
  }
  
  // Margin of safety
  const mosSign = result.marginOfSafety >= 0 ? "" : "";
  const mosColor = result.marginOfSafety > 10 ? "✓" : 
                   result.marginOfSafety < -10 ? "⚠" : "";
  lines.push(
    `Margin of Safety: ${mosSign}${result.marginOfSafety.toFixed(0)}% ${mosColor}`
  );
  
  // Verdict
  const verdictStr = result.verdict.charAt(0).toUpperCase() + 
                     result.verdict.slice(1);
  lines.push(`Verdict: ${verdictStr}`);
  
  return lines;
}

/**
 * Get a one-line fair value summary
 */
export function getFairValueSummary(result: FairValueResult): string {
  const avgValue = [result.dcfValue, result.peRelativeValue, result.pegValue]
    .filter((v): v is number => v !== null)
    .reduce((a, b, _, arr) => a + b / arr.length, 0);
  
  if (avgValue > 0) {
    return `Fair Value: ~$${avgValue.toFixed(0)} (${result.verdict})`;
  }
  return `Fair Value: ${result.verdict}`;
}

