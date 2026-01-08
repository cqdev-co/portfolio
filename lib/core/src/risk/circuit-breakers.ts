/**
 * Circuit Breakers and Risk Management
 * Based on strategy.config.yaml risk_management section
 */

export interface RiskLimits {
  maxConsecutiveLosses: number; // Pause after N losses
  maxMonthlyDrawdownPct: number; // Reduce size after this
  stopTradingDrawdownPct: number; // Stop trading after this
  maxSameSector: number; // Max positions in same sector
  maxCorrelatedPositions: number; // Max correlated trades
}

export interface TradingHistory {
  consecutiveLosses: number;
  monthlyPnLPercent: number;
  openPositionsBySector: Record<string, number>;
}

export interface CircuitBreakerStatus {
  canTrade: boolean;
  positionSizeMultiplier: number; // 1.0 = full, 0.5 = half, 0 = stop
  reason: string | null;
  pauseUntil: Date | null;
}

export interface PositionSizeResult {
  maxDollars: number;
  percentOfAccount: number;
  adjustedForRegime: boolean;
  adjustedForDrawdown: boolean;
}

const DEFAULT_LIMITS: RiskLimits = {
  maxConsecutiveLosses: 3,
  maxMonthlyDrawdownPct: 20,
  stopTradingDrawdownPct: 30,
  maxSameSector: 3,
  maxCorrelatedPositions: 4,
};

/**
 * Check circuit breakers based on trading history
 */
export function checkCircuitBreakers(
  history: TradingHistory,
  limits: RiskLimits = DEFAULT_LIMITS
): CircuitBreakerStatus {
  // Check consecutive losses
  if (history.consecutiveLosses >= limits.maxConsecutiveLosses) {
    const pauseUntil = new Date();
    pauseUntil.setHours(pauseUntil.getHours() + 48);
    return {
      canTrade: false,
      positionSizeMultiplier: 0,
      reason: `${history.consecutiveLosses} consecutive losses - 48h pause`,
      pauseUntil,
    };
  }

  // Check stop trading threshold
  if (history.monthlyPnLPercent <= -limits.stopTradingDrawdownPct) {
    return {
      canTrade: false,
      positionSizeMultiplier: 0,
      reason: `Monthly drawdown ${history.monthlyPnLPercent.toFixed(1)}% exceeds ${limits.stopTradingDrawdownPct}% limit`,
      pauseUntil: null, // Until month end
    };
  }

  // Check reduced size threshold
  if (history.monthlyPnLPercent <= -limits.maxMonthlyDrawdownPct) {
    return {
      canTrade: true,
      positionSizeMultiplier: 0.5,
      reason: `Monthly drawdown ${history.monthlyPnLPercent.toFixed(1)}% - reduced size`,
      pauseUntil: null,
    };
  }

  // All clear
  return {
    canTrade: true,
    positionSizeMultiplier: 1.0,
    reason: null,
    pauseUntil: null,
  };
}

/**
 * Calculate position size based on account and regime
 */
export function calculatePositionSize(
  accountSize: number,
  regimeMultiplier: number = 1.0,
  circuitBreakerMultiplier: number = 1.0
): PositionSizeResult {
  // Base position size by account size (from strategy doc)
  let basePct: number;
  if (accountSize <= 2500) {
    basePct = 20;
  } else if (accountSize <= 5000) {
    basePct = 15;
  } else if (accountSize <= 10000) {
    basePct = 12;
  } else {
    basePct = 8;
  }

  const adjustedPct = basePct * regimeMultiplier * circuitBreakerMultiplier;
  const maxDollars = (accountSize * adjustedPct) / 100;

  return {
    maxDollars,
    percentOfAccount: adjustedPct,
    adjustedForRegime: regimeMultiplier !== 1.0,
    adjustedForDrawdown: circuitBreakerMultiplier !== 1.0,
  };
}
