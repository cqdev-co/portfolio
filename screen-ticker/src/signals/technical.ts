import { RSI, SMA, MACD, OBV } from "technicalindicators";
import type { Signal, HistoricalData, QuoteData } from "../types/index.ts";
import { defaultThresholds, defaultWeights } from "../config/thresholds.ts";
import { isNearSupport } from "../utils/support-resistance.ts";

interface TechnicalResult {
  score: number;
  signals: Signal[];
}

/**
 * Calculate RSI with GRADUATED scoring
 * - RSI < 30: Full points (strongly oversold)
 * - RSI 30-40: Partial points (approaching oversold)
 * - RSI 40-50: Small points (neutral-bearish)
 */
function checkRSI(
  closes: number[],
  thresholds = defaultThresholds.technical
): Signal | null {
  if (closes.length < 15) return null;

  const rsiResult = RSI.calculate({
    values: closes,
    period: 14,
  });

  const currentRSI = rsiResult[rsiResult.length - 1];
  if (currentRSI === undefined) return null;

  // Strongly oversold - full points
  if (currentRSI < 30) {
    return {
      name: "RSI Oversold",
      category: "technical",
      points: defaultWeights.technical.rsiOversold,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (strongly oversold)`,
      value: currentRSI,
    };
  }

  // Approaching oversold - partial points
  if (currentRSI < thresholds.rsiOversold) {
    return {
      name: "RSI Approaching Oversold",
      category: "technical",
      points: Math.floor(defaultWeights.technical.rsiOversold * 0.6),
      description: `RSI(14) = ${currentRSI.toFixed(1)} (approaching oversold)`,
      value: currentRSI,
    };
  }

  // Neutral-bearish range - small bonus
  if (currentRSI < 50) {
    return {
      name: "RSI Neutral-Bearish",
      category: "technical",
      points: 3,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (neutral, room to run)`,
      value: currentRSI,
    };
  }

  return null;
}

/**
 * Check for Golden Cross (50 SMA > 200 SMA)
 */
function checkGoldenCross(closes: number[]): Signal | null {
  if (closes.length < 200) return null;

  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const sma200 = SMA.calculate({ values: closes, period: 200 });

  const currentSMA50 = sma50[sma50.length - 1];
  const currentSMA200 = sma200[sma200.length - 1];
  const prevSMA50 = sma50[sma50.length - 2];
  const prevSMA200 = sma200[sma200.length - 2];

  if (
    currentSMA50 === undefined ||
    currentSMA200 === undefined ||
    prevSMA50 === undefined ||
    prevSMA200 === undefined
  ) {
    return null;
  }

  // Recent golden cross (within last few days)
  if (currentSMA50 > currentSMA200 && prevSMA50 <= prevSMA200) {
    return {
      name: "Golden Cross",
      category: "technical",
      points: defaultWeights.technical.goldenCross,
      description: "50 SMA crossed above 200 SMA",
      value: true,
    };
  }

  // Already in golden cross territory
  if (currentSMA50 > currentSMA200) {
    return {
      name: "Golden Cross Active",
      category: "technical",
      points: Math.floor(defaultWeights.technical.goldenCross * 0.6),
      description: "50 SMA above 200 SMA (bullish structure)",
      value: currentSMA200,
    };
  }

  return null;
}

/**
 * Check price position relative to key moving averages
 * GRADUATED scoring based on how many MAs price is above
 */
function checkMAPosition(
  currentPrice: number,
  closes: number[]
): Signal[] {
  const signals: Signal[] = [];
  
  if (closes.length < 20) return signals;

  const sma20 = SMA.calculate({ values: closes, period: 20 });
  const currentSMA20 = sma20[sma20.length - 1];
  
  let maAboveCount = 0;
  let maTotalCount = 0;

  // MA20
  if (currentSMA20 !== undefined) {
    maTotalCount++;
    if (currentPrice > currentSMA20) {
      maAboveCount++;
    }
  }

  // MA50
  if (closes.length >= 50) {
    const sma50 = SMA.calculate({ values: closes, period: 50 });
    const currentSMA50 = sma50[sma50.length - 1];
    if (currentSMA50 !== undefined) {
      maTotalCount++;
      if (currentPrice > currentSMA50) {
        maAboveCount++;
      }
    }
  }

  // MA200 - most important
  if (closes.length >= 200) {
    const sma200 = SMA.calculate({ values: closes, period: 200 });
    const currentSMA200 = sma200[sma200.length - 1];
    if (currentSMA200 !== undefined) {
      maTotalCount++;
      if (currentPrice > currentSMA200) {
        maAboveCount++;
        // Special signal for being above MA200
        signals.push({
          name: "Above MA200",
          category: "technical",
          points: 5,
          description: `Price above 200-day MA ($${currentSMA200.toFixed(2)})`,
          value: currentSMA200,
        });
      }
    }
  }

  // Overall MA position signal
  if (maTotalCount >= 2) {
    const ratio = maAboveCount / maTotalCount;
    if (ratio >= 0.66) {
      signals.push({
        name: "Strong MA Position",
        category: "technical",
        points: 5,
        description: `Price above ${maAboveCount}/${maTotalCount} key moving averages`,
        value: ratio,
      });
    } else if (ratio >= 0.5) {
      signals.push({
        name: "Mixed MA Position",
        category: "technical",
        points: 2,
        description: `Price above ${maAboveCount}/${maTotalCount} moving averages`,
        value: ratio,
      });
    }
  }

  return signals;
}

/**
 * Check price proximity to moving averages
 * Award points for being near (within 3%) a key MA - potential bounce
 */
function checkMAProximity(
  currentPrice: number,
  closes: number[]
): Signal | null {
  if (closes.length < 50) return null;

  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const currentSMA50 = sma50[sma50.length - 1];

  if (currentSMA50 === undefined) return null;

  const distanceToMA50 = Math.abs(currentPrice - currentSMA50) / currentPrice;

  // Within 3% of MA50 and below it (potential bounce)
  if (distanceToMA50 < 0.03 && currentPrice <= currentSMA50) {
    return {
      name: "Near MA50 Support",
      category: "technical",
      points: 4,
      description: `Price within ${(distanceToMA50 * 100).toFixed(1)}% of 50-day MA`,
      value: currentSMA50,
    };
  }

  // Check MA200 proximity if available
  if (closes.length >= 200) {
    const sma200 = SMA.calculate({ values: closes, period: 200 });
    const currentSMA200 = sma200[sma200.length - 1];

    if (currentSMA200 !== undefined) {
      const distanceToMA200 = Math.abs(currentPrice - currentSMA200) / currentPrice;

      if (distanceToMA200 < 0.03 && currentPrice <= currentSMA200) {
        return {
          name: "Near MA200 Support",
          category: "technical",
          points: 6,
          description: `Price within ${(distanceToMA200 * 100).toFixed(1)}% of 200-day MA`,
          value: currentSMA200,
        };
      }
    }
  }

  return null;
}

/**
 * Check for volume surge
 */
function checkVolumeSurge(
  _volumes: number[],
  quote: QuoteData,
  thresholds = defaultThresholds.technical
): Signal | null {
  if (!quote.regularMarketVolume || !quote.averageDailyVolume10Day) {
    return null;
  }

  const ratio = quote.regularMarketVolume / quote.averageDailyVolume10Day;

  if (ratio >= thresholds.volumeSurgeMultiplier) {
    return {
      name: "Volume Surge",
      category: "technical",
      points: defaultWeights.technical.volumeSurge,
      description: `Volume ${ratio.toFixed(1)}x avg (${(
        quote.regularMarketVolume / 1_000_000
      ).toFixed(1)}M)`,
      value: ratio,
    };
  }

  return null;
}

/**
 * Check for price near support level
 */
function checkNearSupport(
  currentPrice: number,
  historical: HistoricalData[],
  thresholds = defaultThresholds.technical
): Signal | null {
  if (isNearSupport(currentPrice, historical, thresholds.nearSupportPercent)) {
    return {
      name: "Near Support",
      category: "technical",
      points: defaultWeights.technical.nearSupport,
      description: `Price within ${(
        thresholds.nearSupportPercent * 100
      ).toFixed(0)}% of support`,
      value: true,
    };
  }

  return null;
}

/**
 * Check OBV (On-Balance Volume) trend
 */
function checkOBVTrend(
  closes: number[],
  volumes: number[]
): Signal | null {
  if (closes.length < 20 || volumes.length < 20) return null;

  const obvResult = OBV.calculate({
    close: closes,
    volume: volumes,
  });

  if (obvResult.length < 10) return null;

  // Check if OBV is trending up (compare last 5 to previous 5)
  const recent = obvResult.slice(-5);
  const previous = obvResult.slice(-10, -5);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  if (recentAvg > prevAvg * 1.05) {
    return {
      name: "OBV Uptrend",
      category: "technical",
      points: defaultWeights.technical.obvTrend,
      description: "On-Balance Volume trending higher",
      value: true,
    };
  }

  return null;
}

/**
 * Check MACD for bullish crossover
 */
function checkMACD(closes: number[]): Signal | null {
  if (closes.length < 35) return null;

  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  if (macdResult.length < 2) return null;

  const current = macdResult[macdResult.length - 1];
  const previous = macdResult[macdResult.length - 2];

  if (
    !current?.MACD ||
    !current?.signal ||
    !previous?.MACD ||
    !previous?.signal
  ) {
    return null;
  }

  // Bullish crossover
  if (current.MACD > current.signal && previous.MACD <= previous.signal) {
    return {
      name: "MACD Bullish",
      category: "technical",
      points: 5,
      description: "MACD crossed above signal line",
      value: true,
    };
  }

  // MACD above signal (continuation)
  if (current.MACD > current.signal && current.MACD > 0) {
    return {
      name: "MACD Positive",
      category: "technical",
      points: 3,
      description: "MACD above signal and positive",
      value: current.MACD,
    };
  }

  return null;
}

/**
 * Check for 52-week low proximity (contrarian buy signal)
 */
function check52WeekPosition(
  currentPrice: number,
  historical: HistoricalData[]
): Signal | null {
  if (historical.length < 252) return null;

  const prices = historical.slice(-252).map(d => d.close);
  const low52 = Math.min(...prices);
  const high52 = Math.max(...prices);
  
  const range = high52 - low52;
  if (range === 0) return null;

  const positionInRange = (currentPrice - low52) / range;
  const pctFromLow = (currentPrice - low52) / low52;

  // Within 10% of 52-week low - contrarian opportunity
  if (pctFromLow < 0.10) {
    return {
      name: "Near 52-Week Low",
      category: "technical",
      points: 8,
      description: `${(pctFromLow * 100).toFixed(1)}% above 52-week low ($${low52.toFixed(2)})`,
      value: low52,
    };
  }

  // In bottom 25% of range
  if (positionInRange < 0.25) {
    return {
      name: "Lower 52-Week Range",
      category: "technical",
      points: 4,
      description: `In bottom 25% of 52-week range`,
      value: positionInRange,
    };
  }

  return null;
}

/**
 * Calculate all technical signals for a stock
 */
export function calculateTechnicalSignals(
  quote: QuoteData,
  historical: HistoricalData[]
): TechnicalResult {
  const signals: Signal[] = [];
  let score = 0;

  if (historical.length < 20) {
    return { score: 0, signals: [] };
  }

  const closes = historical.map((d) => d.close);
  const volumes = historical.map((d) => d.volume);
  const currentPrice = quote.regularMarketPrice ?? closes[closes.length - 1];

  // RSI (now graduated)
  const rsiSignal = checkRSI(closes);
  if (rsiSignal) {
    signals.push(rsiSignal);
    score += rsiSignal.points;
  }

  // Golden Cross
  const goldenCrossSignal = checkGoldenCross(closes);
  if (goldenCrossSignal) {
    signals.push(goldenCrossSignal);
    score += goldenCrossSignal.points;
  }

  // MA Position (graduated based on how many MAs price is above)
  const maPositionSignals = checkMAPosition(currentPrice ?? 0, closes);
  for (const signal of maPositionSignals) {
    signals.push(signal);
    score += signal.points;
  }

  // MA Proximity (near key MA levels)
  const maProximitySignal = checkMAProximity(currentPrice ?? 0, closes);
  if (maProximitySignal) {
    signals.push(maProximitySignal);
    score += maProximitySignal.points;
  }

  // Volume Surge
  const volumeSignal = checkVolumeSurge(volumes, quote);
  if (volumeSignal) {
    signals.push(volumeSignal);
    score += volumeSignal.points;
  }

  // Near Support
  const supportSignal = checkNearSupport(currentPrice ?? 0, historical);
  if (supportSignal) {
    signals.push(supportSignal);
    score += supportSignal.points;
  }

  // OBV Trend
  const obvSignal = checkOBVTrend(closes, volumes);
  if (obvSignal) {
    signals.push(obvSignal);
    score += obvSignal.points;
  }

  // MACD
  const macdSignal = checkMACD(closes);
  if (macdSignal) {
    signals.push(macdSignal);
    score += macdSignal.points;
  }

  // 52-Week Position
  const weekPositionSignal = check52WeekPosition(currentPrice ?? 0, historical);
  if (weekPositionSignal) {
    signals.push(weekPositionSignal);
    score += weekPositionSignal.points;
  }

  // Cap at 50 points
  return { 
    score: Math.min(score, 50), 
    signals 
  };
}
