/**
 * Expected Value Calculator
 *
 * Calculates expected value, Kelly criterion, and edge for spread trades.
 * Helps Victor quantify trade quality beyond simple grades.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SpreadParameters {
  longStrike: number;
  shortStrike: number;
  debit: number; // Per share (e.g., 3.80 not 380)
  currentPrice: number;
  dte: number; // Days to expiration
  iv: number; // Implied volatility as decimal (0.30 = 30%)
  riskFreeRate?: number; // Default 0.05 (5%)
}

export interface ExpectedValueResult {
  // Core metrics
  probabilityOfProfit: number; // 0-1
  expectedWin: number; // $ per contract
  expectedLoss: number; // $ per contract (negative)
  expectedValue: number; // Net EV per contract
  expectedValuePct: number; // EV as % of risk

  // Kelly criterion
  kellyFraction: number; // Optimal bet size (0-1)
  halfKelly: number; // Conservative sizing
  suggestedContracts: number; // Based on account size

  // Edge analysis
  edgePct: number; // Your edge vs fair pricing
  fairDebit: number; // What the spread "should" cost
  isPositiveEV: boolean;

  // Risk metrics
  maxProfit: number; // Per contract
  maxLoss: number; // Per contract (negative)
  breakevenPrice: number;
  cushionPct: number; // % below current price

  // Quality assessment
  quality: 'EXCELLENT' | 'GOOD' | 'MARGINAL' | 'POOR';
  qualityReasons: string[];
}

export interface ScenarioResult {
  scenario: string;
  priceChange: number; // As decimal (-0.10 = -10%)
  newPrice: number;
  pnl: number; // Per contract
  pnlPct: number; // As % of max risk
  spreadValue: number; // Theoretical spread value
}

// ============================================================================
// BLACK-SCHOLES HELPERS
// ============================================================================

/**
 * Standard normal CDF (cumulative distribution function)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate d1 for Black-Scholes
 */
function calcD1(
  S: number, // Current price
  K: number, // Strike price
  T: number, // Time to expiration (years)
  r: number, // Risk-free rate
  sigma: number // Volatility
): number {
  if (T <= 0) return S > K ? 10 : -10; // At expiration
  return (
    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T))
  );
}

/**
 * Calculate d2 for Black-Scholes
 */
function calcD2(d1: number, sigma: number, T: number): number {
  if (T <= 0) return d1;
  return d1 - sigma * Math.sqrt(T);
}

/**
 * Calculate probability that price ends above strike (ITM for call)
 * Uses simplified approach based on lognormal distribution
 */
function probAboveStrike(
  currentPrice: number,
  strike: number,
  dte: number,
  iv: number,
  riskFreeRate: number = 0.05
): number {
  const T = dte / 365;
  if (T <= 0) return currentPrice > strike ? 1 : 0;

  const d2 = calcD2(calcD1(currentPrice, strike, T, riskFreeRate, iv), iv, T);

  return normalCDF(d2);
}

// ============================================================================
// EXPECTED VALUE CALCULATION
// ============================================================================

/**
 * Calculate expected value and related metrics for a call debit spread
 */
export function calculateExpectedValue(
  params: SpreadParameters,
  accountSize: number = 1500
): ExpectedValueResult {
  const {
    longStrike,
    shortStrike,
    debit,
    currentPrice,
    dte,
    iv,
    riskFreeRate = 0.05,
  } = params;

  // Basic spread math
  const spreadWidth = shortStrike - longStrike;
  const maxProfit = (spreadWidth - debit) * 100; // Per contract
  const maxLoss = -debit * 100; // Per contract
  const breakevenPrice = longStrike + debit;
  const cushionPct = ((currentPrice - shortStrike) / currentPrice) * 100;

  // Probability calculations
  // For a call debit spread:
  // - Max profit if price >= short strike at expiration
  // - Max loss if price <= long strike at expiration
  // - Partial profit/loss in between

  const probAboveLong = probAboveStrike(
    currentPrice,
    longStrike,
    dte,
    iv,
    riskFreeRate
  );
  const probAboveShort = probAboveStrike(
    currentPrice,
    shortStrike,
    dte,
    iv,
    riskFreeRate
  );

  // Simplified: use probability of full profit (above short strike)
  // In reality there's a gradient, but this is conservative
  const probMaxProfit = probAboveShort;
  const probMaxLoss = 1 - probAboveLong;
  const probPartial = probAboveLong - probAboveShort;

  // For partial outcome, estimate average at 50% of max profit
  const avgPartialPnl = (maxProfit + maxLoss) / 2;

  // Expected value calculation
  const expectedWin = probMaxProfit * maxProfit;
  const expectedPartial = probPartial * avgPartialPnl;
  const expectedLoss = probMaxLoss * maxLoss;
  const expectedValue = expectedWin + expectedPartial + expectedLoss;
  const expectedValuePct = (expectedValue / Math.abs(maxLoss)) * 100;

  // Probability of profit (any profit)
  const probabilityOfProfit = probMaxProfit + probPartial * 0.5;

  // Fair value calculation
  // What "should" the spread cost given these probabilities?
  const fairValue =
    probMaxProfit * spreadWidth +
    probPartial * spreadWidth * 0.5 +
    probMaxLoss * 0;
  const fairDebit = fairValue;
  const edgePct = ((fairDebit - debit) / debit) * 100;

  // Kelly criterion
  // f* = (p * b - q) / b
  // where p = prob win, q = prob loss, b = win/loss ratio
  const winLossRatio = Math.abs(maxProfit / maxLoss);
  const kellyNumerator =
    probabilityOfProfit * winLossRatio - (1 - probabilityOfProfit);
  const kellyFraction = Math.max(0, Math.min(1, kellyNumerator / winLossRatio));
  const halfKelly = kellyFraction / 2;

  // Suggested contracts based on half-Kelly and account size
  const riskPerContract = Math.abs(maxLoss);
  const maxRiskAmount = accountSize * halfKelly;
  const suggestedContracts = Math.max(
    1,
    Math.floor(maxRiskAmount / riskPerContract)
  );

  // Quality assessment
  const qualityReasons: string[] = [];
  let quality: ExpectedValueResult['quality'];

  if (expectedValue > 0 && probabilityOfProfit >= 0.65 && edgePct > 5) {
    quality = 'EXCELLENT';
    qualityReasons.push(`Positive EV (+$${expectedValue.toFixed(0)}/contract)`);
    qualityReasons.push(
      `High PoP (${(probabilityOfProfit * 100).toFixed(0)}%)`
    );
    qualityReasons.push(`Good edge (${edgePct.toFixed(1)}%)`);
  } else if (expectedValue > 0 && probabilityOfProfit >= 0.55) {
    quality = 'GOOD';
    qualityReasons.push(`Positive EV (+$${expectedValue.toFixed(0)}/contract)`);
    if (probabilityOfProfit >= 0.6) {
      qualityReasons.push(
        `Decent PoP (${(probabilityOfProfit * 100).toFixed(0)}%)`
      );
    }
  } else if (expectedValue > -20 && probabilityOfProfit >= 0.5) {
    quality = 'MARGINAL';
    qualityReasons.push('Near break-even EV');
    qualityReasons.push(
      `PoP around ${(probabilityOfProfit * 100).toFixed(0)}%`
    );
  } else {
    quality = 'POOR';
    if (expectedValue < 0) {
      qualityReasons.push(
        `Negative EV ($${expectedValue.toFixed(0)}/contract)`
      );
    }
    if (probabilityOfProfit < 0.5) {
      qualityReasons.push(
        `Low PoP (${(probabilityOfProfit * 100).toFixed(0)}%)`
      );
    }
    if (edgePct < 0) {
      qualityReasons.push('Paying premium over fair value');
    }
  }

  return {
    probabilityOfProfit,
    expectedWin,
    expectedLoss,
    expectedValue,
    expectedValuePct,
    kellyFraction,
    halfKelly,
    suggestedContracts,
    edgePct,
    fairDebit,
    isPositiveEV: expectedValue > 0,
    maxProfit,
    maxLoss,
    breakevenPrice,
    cushionPct,
    quality,
    qualityReasons,
  };
}

// ============================================================================
// SCENARIO ANALYSIS
// ============================================================================

/**
 * Analyze spread P&L under different price scenarios
 */
export function analyzeScenarios(
  params: SpreadParameters,
  scenarios?: { name: string; priceChangePct: number }[]
): ScenarioResult[] {
  const { longStrike, shortStrike, debit, currentPrice } = params;

  // Default scenarios if none provided
  const defaultScenarios = [
    { name: 'Crash (-15%)', priceChangePct: -0.15 },
    { name: 'Sharp drop (-10%)', priceChangePct: -0.1 },
    { name: 'Pullback (-5%)', priceChangePct: -0.05 },
    { name: 'Flat (0%)', priceChangePct: 0 },
    { name: 'Rally (+5%)', priceChangePct: 0.05 },
    { name: 'Strong rally (+10%)', priceChangePct: 0.1 },
    { name: 'Breakout (+15%)', priceChangePct: 0.15 },
  ];

  const scenariosToRun = scenarios ?? defaultScenarios;
  const maxLoss = debit * 100;
  const maxProfit = (shortStrike - longStrike - debit) * 100;

  return scenariosToRun.map((scenario) => {
    const newPrice = currentPrice * (1 + scenario.priceChangePct);

    // Calculate spread value at expiration
    let spreadValue: number;
    if (newPrice <= longStrike) {
      // Both legs OTM - max loss
      spreadValue = 0;
    } else if (newPrice >= shortStrike) {
      // Both legs ITM - max profit
      spreadValue = shortStrike - longStrike;
    } else {
      // Long ITM, short OTM - partial profit
      spreadValue = newPrice - longStrike;
    }

    const pnl = (spreadValue - debit) * 100;
    const pnlPct = (pnl / maxLoss) * 100;

    return {
      scenario: scenario.name,
      priceChange: scenario.priceChangePct,
      newPrice,
      pnl,
      pnlPct,
      spreadValue,
    };
  });
}

// ============================================================================
// FORMATTING FOR AI
// ============================================================================

/**
 * Format expected value analysis for AI context
 */
export function formatEVForAI(ev: ExpectedValueResult): string {
  const lines: string[] = [];

  lines.push(`EV ANALYSIS:`);
  lines.push(
    `  PoP: ${(ev.probabilityOfProfit * 100).toFixed(0)}% | ` +
      `EV: ${ev.expectedValue >= 0 ? '+' : ''}$${ev.expectedValue.toFixed(0)}/contract`
  );
  lines.push(
    `  Max: +$${ev.maxProfit.toFixed(0)} / -$${Math.abs(ev.maxLoss).toFixed(0)} | ` +
      `BE: $${ev.breakevenPrice.toFixed(2)}`
  );
  lines.push(
    `  Edge: ${ev.edgePct >= 0 ? '+' : ''}${ev.edgePct.toFixed(1)}% vs fair | ` +
      `Quality: ${ev.quality}`
  );

  if (ev.qualityReasons.length > 0) {
    lines.push(`  ${ev.qualityReasons.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format scenario analysis for AI context
 */
export function formatScenariosForAI(
  scenarios: ScenarioResult[],
  cushionPct: number
): string {
  const lines: string[] = [];

  lines.push(`SCENARIO ANALYSIS (${cushionPct.toFixed(1)}% cushion):`);

  for (const s of scenarios) {
    const pnlStr =
      s.pnl >= 0 ? `+$${s.pnl.toFixed(0)}` : `-$${Math.abs(s.pnl).toFixed(0)}`;
    const indicator = s.pnl > 0 ? '✓' : s.pnl < -50 ? '⚠' : '→';
    lines.push(
      `  ${indicator} ${s.scenario}: $${s.newPrice.toFixed(0)} → ${pnlStr}`
    );
  }

  return lines.join('\n');
}

/**
 * Compact TOON format for token efficiency
 */
export function formatEVTOON(ev: ExpectedValueResult): string {
  return (
    `EV:${ev.expectedValue >= 0 ? '+' : ''}${ev.expectedValue.toFixed(0)}|` +
    `PoP:${(ev.probabilityOfProfit * 100).toFixed(0)}%|` +
    `Edge:${ev.edgePct >= 0 ? '+' : ''}${ev.edgePct.toFixed(0)}%|` +
    `Q:${ev.quality.charAt(0)}`
  );
}
