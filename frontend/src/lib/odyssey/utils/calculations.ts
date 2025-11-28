/**
 * Financial calculations for the Odyssey dashboard
 */

/**
 * Calculate risk/reward ratio
 */
export function calculateRiskReward(
  maxProfit: number,
  maxRisk: number
): number {
  if (maxRisk === 0) return 0;
  return maxProfit / maxRisk;
}

/**
 * Calculate break-even price for credit spreads
 */
export function calculateBreakEven(
  strike: number,
  premium: number,
  direction: "bull_put" | "bear_call"
): number {
  if (direction === "bull_put") {
    return strike - premium;
  } else {
    return strike + premium;
  }
}

/**
 * Calculate probability of profit (simplified)
 * Based on delta approximation
 */
export function calculateProbabilityOfProfit(
  delta: number,
  isCreditSpread: boolean = true
): number {
  if (isCreditSpread) {
    // For credit spreads, POP ≈ 1 - |delta|
    return Math.round((1 - Math.abs(delta)) * 100);
  } else {
    // For debit spreads, POP ≈ |delta|
    return Math.round(Math.abs(delta) * 100);
  }
}

/**
 * Calculate days to expiration
 */
export function calculateDTE(expirationDate: Date | string): number {
  const expDate = 
    typeof expirationDate === "string" 
      ? new Date(expirationDate) 
      : expirationDate;
  const today = new Date();
  const diff = expDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate implied volatility percentile
 * (requires historical IV data - simplified version)
 */
export function calculateIVPercentile(
  currentIV: number,
  historicalIVs: number[]
): number {
  if (historicalIVs.length === 0) return 50;
  
  const sorted = [...historicalIVs].sort((a, b) => a - b);
  const belowCurrent = sorted.filter((iv) => iv <= currentIV).length;
  return Math.round((belowCurrent / sorted.length) * 100);
}

/**
 * Calculate position size based on account size and risk
 */
export function calculatePositionSize(
  accountSize: number,
  riskPercentage: number,
  maxRiskPerContract: number
): number {
  const totalRiskAmount = accountSize * (riskPercentage / 100);
  return Math.floor(totalRiskAmount / maxRiskPerContract);
}

/**
 * Calculate return on risk (ROR)
 */
export function calculateReturnOnRisk(
  premium: number,
  maxRisk: number
): number {
  if (maxRisk === 0) return 0;
  return (premium / maxRisk) * 100;
}

/**
 * Estimate theta decay per day
 */
export function estimateThetaDecay(
  premium: number,
  dte: number
): number {
  if (dte === 0) return 0;
  // Simplified linear decay model
  return premium / dte;
}

/**
 * Calculate spread width
 */
export function calculateSpreadWidth(
  longStrike: number,
  shortStrike: number
): number {
  return Math.abs(longStrike - shortStrike);
}

/**
 * Calculate max profit for credit spread
 */
export function calculateMaxProfitCredit(premium: number): number {
  return premium;
}

/**
 * Calculate max risk for credit spread
 */
export function calculateMaxRiskCredit(
  spreadWidth: number,
  premium: number
): number {
  return spreadWidth - premium;
}

/**
 * Calculate max profit for debit spread
 */
export function calculateMaxProfitDebit(
  spreadWidth: number,
  netDebit: number
): number {
  return spreadWidth - netDebit;
}

/**
 * Calculate max risk for debit spread
 */
export function calculateMaxRiskDebit(netDebit: number): number {
  return netDebit;
}

