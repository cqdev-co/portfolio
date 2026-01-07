/**
 * Entry Grade Calculator for Deep ITM Call Debit Spreads
 *
 * Calculates entry signals based on empirical analysis of winning vs losing trades.
 *
 * Winning patterns (AMD, AVGO):
 * - RSI 25-45 (oversold/recovering)
 * - Buffer to support > 7%
 * - Bounce confirmed (higher low)
 * - Analyst bullish > 75%
 * - Earnings > 30 days
 *
 * Losing patterns (TSLA):
 * - RSI neutral and falling
 * - Buffer to support < 5%
 * - No bounce confirmation
 * - Analyst bullish < 50%
 * - Earnings within position window
 */

export interface EntryGradeInput {
  price: number;
  rsi?: number;
  support?: number; // 20-day low
  resistance?: number; // 20-day high
  ma50?: number;
  ma200?: number;
  bullishPct?: number; // Analyst bullish %
  daysToEarnings?: number;
  atmIV?: number; // ATM implied volatility %
  pcRatio?: number; // Put/call ratio
}

export interface EntryGrade {
  score: number; // 0-100
  signals: string[]; // What's good/bad
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID';
}

export interface TechnicalAnalysis {
  rsi14?: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  supportLevel?: number;
  resistanceLevel?: number;
  bufferToSupport?: number;
  maAlignment: 'bullish' | 'bearish' | 'mixed';
  bounceConfirmed: boolean;
  entryGrade: EntryGrade;
}

/**
 * Calculate RSI (Relative Strength Index)
 * Uses Wilder's smoothing method
 */
export function calculateRSI(
  closes: number[],
  period: number = 14
): number | undefined {
  if (closes.length < period + 1) return undefined;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const curr = closes[i];
    const prev = closes[i - 1];
    if (curr !== undefined && prev !== undefined) {
      changes.push(curr - prev);
    }
  }

  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change !== undefined) {
      if (change >= 0) gains += change;
      else losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change === undefined) continue;
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

/**
 * Calculate trend direction from price data
 */
export function calculateTrend(
  closes: number[]
): 'bullish' | 'bearish' | 'sideways' {
  if (closes.length < 10) return 'sideways';

  const halfLen = Math.floor(closes.length / 2);
  const firstHalf = closes.slice(0, halfLen);
  const secondHalf = closes.slice(halfLen);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const changePct = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (changePct > 2) return 'bullish';
  if (changePct < -2) return 'bearish';
  return 'sideways';
}

/**
 * Check if price has bounced (higher low formed)
 */
export function checkBounceConfirmed(
  closes: number[],
  lows: number[]
): boolean {
  if (lows.length < 10) return false;

  const cutoff = Math.floor(lows.length * 0.67);
  const earlyLows = lows.slice(0, cutoff);
  const lateLows = lows.slice(cutoff);

  const earlyLowest = Math.min(...earlyLows);
  const lateLowest = Math.min(...lateLows);

  const currentPrice = closes[closes.length - 1];
  if (currentPrice === undefined) return false;

  return currentPrice > lateLowest && lateLowest >= earlyLowest * 0.98;
}

/**
 * Calculate MA alignment
 */
export function calculateMAAlignment(
  price: number,
  ma50?: number,
  ma200?: number
): 'bullish' | 'bearish' | 'mixed' {
  if (!ma50 || !ma200) return 'mixed';

  const priceAbove50 = price > ma50;
  const priceAbove200 = price > ma200;
  const ma50Above200 = ma50 > ma200;

  if (priceAbove50 && priceAbove200 && ma50Above200) return 'bullish';
  if (!priceAbove50 && !priceAbove200 && !ma50Above200) return 'bearish';
  return 'mixed';
}

/**
 * Calculate buffer to support level
 */
export function calculateBufferToSupport(
  price: number,
  support: number
): number {
  if (support <= 0 || price <= support) return 0;
  return Math.round(((price - support) / price) * 1000) / 10;
}

/**
 * Calculate entry grade for Deep ITM Spread strategy
 * Based on empirical analysis of winning vs losing trades
 */
export function calculateEntryGrade(input: EntryGradeInput): EntryGrade {
  const {
    price,
    rsi,
    support,
    ma50,
    ma200,
    bullishPct = 50,
    daysToEarnings,
    atmIV,
    pcRatio,
  } = input;

  let score = 50;
  const signals: string[] = [];

  // Buffer to support (critical for spreads)
  const bufferToSupport = support
    ? calculateBufferToSupport(price, support)
    : undefined;

  if (bufferToSupport !== undefined) {
    if (bufferToSupport >= 10) {
      score += 15;
      signals.push('Strong buffer to support');
    } else if (bufferToSupport >= 7) {
      score += 10;
      signals.push('Adequate buffer to support');
    } else if (bufferToSupport >= 5) {
      signals.push('Thin buffer - monitor closely');
    } else {
      score -= 15;
      signals.push('⚠️ Minimal buffer - high risk');
    }
  }

  // RSI scoring (oversold = good for entry)
  if (rsi !== undefined) {
    if (rsi < 30) {
      score += 15;
      signals.push('RSI oversold - potential bounce');
    } else if (rsi >= 30 && rsi <= 45) {
      score += 10;
      signals.push('RSI recovering from oversold');
    } else if (rsi >= 70) {
      score -= 10;
      signals.push('RSI overbought - avoid entry');
    } else if (rsi >= 40 && rsi <= 60) {
      signals.push('RSI neutral');
    }
  }

  // MA alignment
  const maAlignment = calculateMAAlignment(price, ma50, ma200);
  if (maAlignment === 'bullish') {
    score += 10;
    signals.push('Bullish MA alignment');
  } else if (maAlignment === 'bearish') {
    score -= 5;
    signals.push('Bearish MA alignment');
  }

  // Analyst sentiment
  if (bullishPct >= 80) {
    score += 10;
    signals.push('Strong analyst support');
  } else if (bullishPct >= 65) {
    score += 5;
    signals.push('Moderate analyst support');
  } else if (bullishPct < 50) {
    score -= 10;
    signals.push('⚠️ Bearish analyst sentiment');
  }

  // Earnings proximity
  if (daysToEarnings !== undefined) {
    if (daysToEarnings < 14) {
      score -= 15;
      signals.push('🚨 Earnings within 2 weeks!');
    } else if (daysToEarnings < 30) {
      score -= 5;
      signals.push('⚠️ Earnings within 30 days');
    } else {
      signals.push('Earnings clear');
    }
  }

  // IV level (lower = cheaper spreads)
  if (atmIV !== undefined) {
    if (atmIV < 25) {
      score += 5;
      signals.push('Low IV - cheap options');
    } else if (atmIV > 50) {
      score -= 5;
      signals.push('High IV - expensive options');
    }
  }

  // Put/Call ratio (bullish flow = good)
  if (pcRatio !== undefined) {
    if (pcRatio < 0.6) {
      score += 5;
      signals.push('Bullish options flow');
    } else if (pcRatio > 1.0) {
      score -= 5;
      signals.push('Bearish options flow');
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine recommendation
  let recommendation: EntryGrade['recommendation'];
  if (score >= 75) recommendation = 'STRONG_BUY';
  else if (score >= 60) recommendation = 'BUY';
  else if (score >= 45) recommendation = 'HOLD';
  else recommendation = 'AVOID';

  return { score, signals, recommendation };
}

/**
 * Calculate full technical analysis from chart data
 */
export function analyzeTechnicals(
  closes: number[],
  highs: number[],
  lows: number[],
  quote: {
    price: number;
    ma50?: number;
    ma200?: number;
  },
  fundamentals?: {
    bullishPct?: number;
    daysToEarnings?: number;
    atmIV?: number;
    pcRatio?: number;
  }
): TechnicalAnalysis {
  const { price, ma50, ma200 } = quote;

  // Calculate indicators
  const rsi14 = calculateRSI(closes);
  const trend = calculateTrend(closes);

  // Support/resistance from recent 20-bar range
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const resistanceLevel =
    recentHighs.length > 0
      ? Math.round(Math.max(...recentHighs) * 100) / 100
      : undefined;
  const supportLevel =
    recentLows.length > 0
      ? Math.round(Math.min(...recentLows) * 100) / 100
      : undefined;

  const bufferToSupport = supportLevel
    ? calculateBufferToSupport(price, supportLevel)
    : undefined;

  const maAlignment = calculateMAAlignment(price, ma50, ma200);
  const bounceConfirmed = checkBounceConfirmed(closes, lows);

  // Calculate entry grade
  const entryGrade = calculateEntryGrade({
    price,
    rsi: rsi14,
    support: supportLevel,
    ma50,
    ma200,
    bullishPct: fundamentals?.bullishPct,
    daysToEarnings: fundamentals?.daysToEarnings,
    atmIV: fundamentals?.atmIV,
    pcRatio: fundamentals?.pcRatio,
  });

  // Add bounce confirmation to signals if applicable
  if (
    bounceConfirmed &&
    !entryGrade.signals.some((s) => s.includes('bounce'))
  ) {
    entryGrade.signals.push('Bounce confirmed (higher low)');
    entryGrade.score = Math.min(100, entryGrade.score + 10);
    // Recalculate recommendation
    if (entryGrade.score >= 75) entryGrade.recommendation = 'STRONG_BUY';
    else if (entryGrade.score >= 60) entryGrade.recommendation = 'BUY';
    else if (entryGrade.score >= 45) entryGrade.recommendation = 'HOLD';
    else entryGrade.recommendation = 'AVOID';
  }

  return {
    rsi14,
    trend,
    supportLevel,
    resistanceLevel,
    bufferToSupport,
    maAlignment,
    bounceConfirmed,
    entryGrade,
  };
}
