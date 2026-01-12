/**
 * Options Greeks Calculator
 *
 * Calculates delta, gamma, theta, vega for option spreads.
 * Provides capital efficiency and risk exposure metrics.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface OptionParameters {
  strike: number;
  currentPrice: number;
  dte: number; // Days to expiration
  iv: number; // Implied volatility as decimal (0.30 = 30%)
  riskFreeRate?: number; // Default 0.05 (5%)
  optionType: 'call' | 'put';
}

export interface OptionGreeks {
  delta: number; // -1 to 1
  gamma: number; // Rate of delta change
  theta: number; // Daily time decay ($)
  vega: number; // IV sensitivity ($)
  rho: number; // Interest rate sensitivity
}

export interface SpreadGreeks {
  // Net Greeks for the spread
  netDelta: number; // Net directional exposure
  netGamma: number; // Net gamma risk
  netTheta: number; // Daily time decay (+ = good for spread holder)
  netVega: number; // Net IV sensitivity

  // Individual leg Greeks
  longLeg: OptionGreeks;
  shortLeg: OptionGreeks;

  // Capital efficiency metrics
  deltaPerDollar: number; // Delta exposure per $100 risked
  leverageRatio: number; // Equivalent stock exposure vs cost

  // Risk metrics
  gammaRisk: 'LOW' | 'MODERATE' | 'HIGH';
  thetaProfile: 'FAVORABLE' | 'NEUTRAL' | 'UNFAVORABLE';
  vegaExposure: 'LONG_VOL' | 'NEUTRAL' | 'SHORT_VOL';

  // Analysis
  summary: string;
  risks: string[];
  opportunities: string[];
}

// ============================================================================
// BLACK-SCHOLES CALCULATIONS
// ============================================================================

/**
 * Standard normal probability density function
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution function
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
  if (T <= 0) return S > K ? 10 : -10;
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

// ============================================================================
// GREEKS CALCULATIONS
// ============================================================================

/**
 * Calculate all Greeks for a single option
 */
export function calculateGreeks(params: OptionParameters): OptionGreeks {
  const {
    strike,
    currentPrice,
    dte,
    iv,
    riskFreeRate = 0.05,
    optionType,
  } = params;

  const T = dte / 365;
  const S = currentPrice;
  const K = strike;
  const r = riskFreeRate;
  const sigma = iv;

  // Handle edge cases
  if (T <= 0 || sigma <= 0) {
    // At expiration
    const intrinsic =
      optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    const itm = intrinsic > 0;

    return {
      delta: optionType === 'call' ? (itm ? 1 : 0) : itm ? -1 : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    };
  }

  const d1 = calcD1(S, K, T, r, sigma);
  const d2 = calcD2(d1, sigma, T);
  const sqrtT = Math.sqrt(T);

  // Delta
  let delta: number;
  if (optionType === 'call') {
    delta = normalCDF(d1);
  } else {
    delta = normalCDF(d1) - 1;
  }

  // Gamma (same for calls and puts)
  const gamma = normalPDF(d1) / (S * sigma * sqrtT);

  // Theta (daily, in dollars per share)
  const term1 = -(S * normalPDF(d1) * sigma) / (2 * sqrtT);
  let theta: number;
  if (optionType === 'call') {
    theta = term1 - r * K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    theta = term1 + r * K * Math.exp(-r * T) * normalCDF(-d2);
  }
  theta = theta / 365; // Convert to daily

  // Vega (per 1% IV change, in dollars per share)
  const vega = (S * normalPDF(d1) * sqrtT) / 100;

  // Rho (per 1% rate change)
  let rho: number;
  if (optionType === 'call') {
    rho = (K * T * Math.exp(-r * T) * normalCDF(d2)) / 100;
  } else {
    rho = (-K * T * Math.exp(-r * T) * normalCDF(-d2)) / 100;
  }

  return { delta, gamma, theta, vega, rho };
}

/**
 * Calculate Greeks for a vertical spread (call debit or put credit)
 */
export function calculateSpreadGreeks(
  longStrike: number,
  shortStrike: number,
  currentPrice: number,
  dte: number,
  iv: number,
  debit: number,
  optionType: 'call' | 'put' = 'call',
  riskFreeRate: number = 0.05
): SpreadGreeks {
  // Calculate Greeks for each leg
  const longLeg = calculateGreeks({
    strike: longStrike,
    currentPrice,
    dte,
    iv,
    riskFreeRate,
    optionType,
  });

  const shortLeg = calculateGreeks({
    strike: shortStrike,
    currentPrice,
    dte,
    iv,
    riskFreeRate,
    optionType,
  });

  // Net Greeks (long - short for debit spreads)
  const netDelta = longLeg.delta - shortLeg.delta;
  const netGamma = longLeg.gamma - shortLeg.gamma;
  const netTheta = longLeg.theta - shortLeg.theta;
  const netVega = longLeg.vega - shortLeg.vega;

  // Capital efficiency
  // Delta per dollar risked (debit * 100 = total risk)
  const totalRisk = debit * 100;
  const deltaPerDollar = (netDelta * 100) / totalRisk;

  // Leverage ratio: equivalent stock exposure vs cost
  // If delta is 0.70, you have $70 of stock-like exposure per contract
  const stockEquivalent = Math.abs(netDelta) * currentPrice * 100;
  const leverageRatio = stockEquivalent / totalRisk;

  // Risk assessments
  let gammaRisk: SpreadGreeks['gammaRisk'];
  if (dte <= 7 && Math.abs(netGamma) > 0.05) {
    gammaRisk = 'HIGH';
  } else if (dte <= 21 && Math.abs(netGamma) > 0.03) {
    gammaRisk = 'MODERATE';
  } else {
    gammaRisk = 'LOW';
  }

  let thetaProfile: SpreadGreeks['thetaProfile'];
  // For debit spreads, negative theta is unfavorable
  if (netTheta > -0.01) {
    thetaProfile = 'FAVORABLE';
  } else if (netTheta > -0.03) {
    thetaProfile = 'NEUTRAL';
  } else {
    thetaProfile = 'UNFAVORABLE';
  }

  let vegaExposure: SpreadGreeks['vegaExposure'];
  if (netVega > 0.05) {
    vegaExposure = 'LONG_VOL';
  } else if (netVega < -0.05) {
    vegaExposure = 'SHORT_VOL';
  } else {
    vegaExposure = 'NEUTRAL';
  }

  // Build summary and analysis
  const summary = buildGreeksSummary(
    netDelta,
    netTheta,
    netVega,
    deltaPerDollar,
    leverageRatio
  );

  const { risks, opportunities } = analyzeGreeksRisks(
    netDelta,
    netGamma,
    netTheta,
    netVega,
    dte,
    gammaRisk,
    vegaExposure
  );

  return {
    netDelta,
    netGamma,
    netTheta,
    netVega,
    longLeg,
    shortLeg,
    deltaPerDollar,
    leverageRatio,
    gammaRisk,
    thetaProfile,
    vegaExposure,
    summary,
    risks,
    opportunities,
  };
}

/**
 * Build a human-readable summary of the Greeks
 */
function buildGreeksSummary(
  delta: number,
  theta: number,
  vega: number,
  deltaPerDollar: number,
  leverageRatio: number
): string {
  const deltaStr = (delta * 100).toFixed(0);
  const thetaStr = (theta * 100).toFixed(2);
  const vegaStr = (vega * 100).toFixed(2);

  return (
    `Δ${deltaStr} (${deltaPerDollar.toFixed(2)}/$ risked) | ` +
    `θ $${thetaStr}/day | ` +
    `ν $${vegaStr}/1%IV | ` +
    `${leverageRatio.toFixed(1)}x leverage`
  );
}

/**
 * Analyze Greeks for risks and opportunities
 */
function analyzeGreeksRisks(
  delta: number,
  gamma: number,
  theta: number,
  vega: number,
  dte: number,
  gammaRisk: SpreadGreeks['gammaRisk'],
  vegaExposure: SpreadGreeks['vegaExposure']
): { risks: string[]; opportunities: string[] } {
  const risks: string[] = [];
  const opportunities: string[] = [];

  // Delta analysis
  if (delta > 0.85) {
    risks.push('Very high delta - behaves almost like stock');
  } else if (delta > 0.7) {
    opportunities.push(
      `Strong ${(delta * 100).toFixed(0)}% directional exposure`
    );
  }

  // Gamma analysis
  if (gammaRisk === 'HIGH') {
    risks.push('High gamma risk - delta will swing rapidly near expiration');
  }

  // Theta analysis
  if (theta < -0.05) {
    risks.push(
      `Time decay costs $${Math.abs(theta * 100).toFixed(0)}/day per contract`
    );
  } else if (theta > -0.02) {
    opportunities.push('Minimal time decay impact');
  }

  // Vega analysis
  if (vegaExposure === 'LONG_VOL') {
    if (dte > 30) {
      opportunities.push('Long vega - benefits from IV expansion');
    } else {
      risks.push('Long vega but short DTE - IV crush risk');
    }
  } else if (vegaExposure === 'SHORT_VOL') {
    opportunities.push('Short vega - benefits from IV contraction');
  }

  // DTE-specific risks
  if (dte <= 7) {
    risks.push('Expiration week - elevated gamma and pin risk');
  } else if (dte <= 14) {
    risks.push('Near-term expiry - accelerating time decay');
  }

  return { risks, opportunities };
}

// ============================================================================
// FORMATTING FOR AI
// ============================================================================

/**
 * Format spread Greeks for AI context
 */
export function formatGreeksForAI(greeks: SpreadGreeks): string {
  const lines: string[] = [];

  lines.push(`GREEKS:`);
  lines.push(`  ${greeks.summary}`);

  // Gamma risk indicator
  const gammaIcon =
    greeks.gammaRisk === 'HIGH'
      ? '⚠️'
      : greeks.gammaRisk === 'MODERATE'
        ? '🔸'
        : '✓';
  lines.push(
    `  ${gammaIcon} Gamma: ${greeks.gammaRisk} | ` +
      `Theta: ${greeks.thetaProfile} | ` +
      `Vega: ${greeks.vegaExposure.replace('_', ' ')}`
  );

  if (greeks.risks.length > 0) {
    lines.push(`  Risks: ${greeks.risks.slice(0, 2).join('; ')}`);
  }

  if (greeks.opportunities.length > 0) {
    lines.push(`  Positives: ${greeks.opportunities.slice(0, 2).join('; ')}`);
  }

  return lines.join('\n');
}

/**
 * Compact TOON format for token efficiency
 */
export function formatGreeksTOON(greeks: SpreadGreeks): string {
  const delta = (greeks.netDelta * 100).toFixed(0);
  const theta = (greeks.netTheta * 100).toFixed(1);
  const dpd = greeks.deltaPerDollar.toFixed(1);
  const leverage = greeks.leverageRatio.toFixed(1);
  const gamma = greeks.gammaRisk.charAt(0);

  return `Δ${delta}|θ${theta}|${dpd}Δ/$|${leverage}x|γ${gamma}`;
}

/**
 * Get delta interpretation for Victor's analysis
 */
export function interpretDelta(delta: number, debit: number): string {
  const deltaAbs = Math.abs(delta);
  const exposure = (deltaAbs * 100).toFixed(0);
  const perDollar = ((deltaAbs * 100) / (debit * 100)).toFixed(1);

  if (deltaAbs >= 0.85) {
    return (
      `This spread has ${exposure} delta - essentially stock-like exposure. ` +
      `You're getting $${perDollar} of directional exposure per dollar risked.`
    );
  } else if (deltaAbs >= 0.7) {
    return (
      `Solid ${exposure} delta gives you strong directional exposure. ` +
      `That's $${perDollar} of stock-equivalent exposure per dollar at risk - ` +
      `efficient use of capital.`
    );
  } else if (deltaAbs >= 0.5) {
    return (
      `Moderate ${exposure} delta - decent directional exposure but not ` +
      `as aggressive as deep ITM. Getting $${perDollar} per dollar risked.`
    );
  } else {
    return (
      `Low ${exposure} delta means less directional exposure. ` +
      `This behaves more like a probability play than a directional bet.`
    );
  }
}

/**
 * Get theta interpretation for Victor's analysis
 */
export function interpretTheta(
  theta: number,
  dte: number,
  debit: number
): string {
  const dailyCost = Math.abs(theta * 100);
  const totalRisk = debit * 100;
  const dailyPctDrag = (dailyCost / totalRisk) * 100;

  if (theta > -0.01) {
    return (
      `Minimal time decay - theta is almost flat. ` +
      `Time is on your side here.`
    );
  } else if (dailyPctDrag < 0.5) {
    return (
      `Theta costs about $${dailyCost.toFixed(2)}/day per contract ` +
      `(${dailyPctDrag.toFixed(2)}% of risk). Manageable.`
    );
  } else if (dte <= 14) {
    return (
      `Watch out - theta is eating $${dailyCost.toFixed(2)}/day ` +
      `(${dailyPctDrag.toFixed(1)}% of risk) and you're close to expiration. ` +
      `Time decay accelerates from here.`
    );
  } else {
    return (
      `Theta drag of $${dailyCost.toFixed(2)}/day is meaningful. ` +
      `With ${dte} DTE you have time, but the clock is ticking.`
    );
  }
}
