import { RSI, SMA, MACD, OBV, ADX, BollingerBands } from 'technicalindicators';
import type { Signal, HistoricalData, QuoteData } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';
import { isNearSupport } from '../utils/support-resistance.ts';

interface TechnicalResult {
  score: number;
  signals: Signal[];
}

/**
 * Calculate RSI with scoring aligned to strategy.config.yaml
 *
 * Per strategy config:
 * - RSI ideal range: 35-50 (sweet spot for CDS entry)
 * - RSI acceptable: 30-55
 * - RSI < 30: Oversold (potential falling knife)
 * - RSI > 55: Extended (wait for pullback)
 *
 * v2.5.0: Restructured to reward ideal entry zone, not just oversold
 */
function checkRSI(
  closes: number[],
  _thresholds = defaultThresholds.technical
): Signal | null {
  if (closes.length < 15) return null;

  const rsiResult = RSI.calculate({
    values: closes,
    period: 14,
  });

  const currentRSI = rsiResult[rsiResult.length - 1];
  if (currentRSI === undefined) return null;

  // IDEAL ENTRY ZONE (35-50) - Best for CDS spreads
  // Stock has pulled back but isn't broken
  if (currentRSI >= 35 && currentRSI <= 50) {
    return {
      name: 'RSI Entry Zone',
      category: 'technical',
      points: 10, // Highest RSI score - this is the sweet spot
      description: `RSI(14) = ${currentRSI.toFixed(1)} (ideal entry zone)`,
      value: currentRSI,
    };
  }

  // APPROACHING OVERSOLD (30-35) - Good entry but watch for more downside
  if (currentRSI >= 30 && currentRSI < 35) {
    return {
      name: 'RSI Approaching Oversold',
      category: 'technical',
      points: 7,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (approaching oversold)`,
      value: currentRSI,
    };
  }

  // OVERSOLD (<30) - Potential falling knife, lower score
  // Could bounce, but verify trend before entry
  if (currentRSI < 30) {
    return {
      name: 'RSI Oversold',
      category: 'technical',
      points: 5,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (oversold - verify trend)`,
      value: currentRSI,
    };
  }

  // SLIGHTLY EXTENDED (50-55) - Acceptable but not ideal
  if (currentRSI > 50 && currentRSI <= 55) {
    return {
      name: 'RSI Acceptable',
      category: 'technical',
      points: 4,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (slightly extended)`,
      value: currentRSI,
    };
  }

  // EXTENDED (55-70) - Wait for pullback
  if (currentRSI > 55 && currentRSI < 70) {
    return {
      name: 'RSI Extended',
      category: 'technical',
      points: 1,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (extended - wait)`,
      value: currentRSI,
    };
  }

  // OVERBOUGHT (>70) - No points, skip
  return null;
}

/**
 * v2.5.0: Check for pullback-in-uptrend (ideal CDS entry setup)
 *
 * This is THE signal we want for deep ITM call debit spreads:
 * - Long-term trend is UP (above MA200)
 * - Price has pulled back to moving average support
 * - Not broken down (still in healthy uptrend structure)
 *
 * Awards high points because this is the core entry setup.
 */
function checkPullbackInUptrend(
  currentPrice: number,
  closes: number[]
): Signal[] {
  const signals: Signal[] = [];

  if (closes.length < 200) return signals;

  // Calculate moving averages
  const sma20 = SMA.calculate({ values: closes, period: 20 });
  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const sma200 = SMA.calculate({ values: closes, period: 200 });

  const ma20 = sma20[sma20.length - 1];
  const ma50 = sma50[sma50.length - 1];
  const ma200 = sma200[sma200.length - 1];

  if (ma20 === undefined || ma50 === undefined || ma200 === undefined) {
    return signals;
  }

  // Core requirement: Must be above MA200 (long-term uptrend)
  if (currentPrice <= ma200) return signals;

  // Calculate distances
  const distToMA20 = (currentPrice - ma20) / currentPrice;
  const distToMA50 = (currentPrice - ma50) / currentPrice;

  // Check for healthy trend structure
  const healthyStructure = ma50 > ma200;
  const strongStructure = ma20 > ma50 && ma50 > ma200;

  // BEST SIGNAL: Pullback to MA50 in healthy uptrend
  // Price within 3% of MA50, above MA200, MA50 > MA200
  if (healthyStructure && Math.abs(distToMA50) < 0.03) {
    signals.push({
      name: 'Pullback to MA50',
      category: 'technical',
      points: 12, // High value - this is THE entry setup
      description: `Uptrend intact, pulled back to MA50 support`,
      value: ma50,
    });
  }

  // GOOD SIGNAL: Pullback to MA20 in strong uptrend
  // Price within 2% of MA20, strong structure (MA20 > MA50 > MA200)
  if (strongStructure && Math.abs(distToMA20) < 0.02) {
    signals.push({
      name: 'Pullback to MA20',
      category: 'technical',
      points: 8,
      description: `Strong uptrend, testing MA20 support`,
      value: ma20,
    });
  }

  // Check for healthy pullback from recent high
  // Find 20-day high
  const recent20 = closes.slice(-20);
  const high20 = Math.max(...recent20);
  const pullbackPct = (high20 - currentPrice) / high20;

  // GOOD SIGNAL: 5-15% pullback from high, still above MA200
  // Not too shallow (just noise) and not too deep (broken)
  if (pullbackPct >= 0.05 && pullbackPct <= 0.15 && currentPrice > ma200) {
    signals.push({
      name: 'Healthy Pullback',
      category: 'technical',
      points: 7,
      description:
        `${(pullbackPct * 100).toFixed(0)}% pullback from high, ` +
        `trend intact`,
      value: pullbackPct,
    });
  }

  return signals;
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
      name: 'Golden Cross',
      category: 'technical',
      points: defaultWeights.technical.goldenCross,
      description: '50 SMA crossed above 200 SMA',
      value: true,
    };
  }

  // Already in golden cross territory
  if (currentSMA50 > currentSMA200) {
    return {
      name: 'Golden Cross Active',
      category: 'technical',
      points: Math.floor(defaultWeights.technical.goldenCross * 0.6),
      description: '50 SMA above 200 SMA (bullish structure)',
      value: currentSMA200,
    };
  }

  return null;
}

/**
 * Check price position relative to key moving averages
 * GRADUATED scoring based on how many MAs price is above
 */
function checkMAPosition(currentPrice: number, closes: number[]): Signal[] {
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
          name: 'Above MA200',
          category: 'technical',
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
        name: 'Strong MA Position',
        category: 'technical',
        points: 5,
        description: `Price above ${maAboveCount}/${maTotalCount} key moving averages`,
        value: ratio,
      });
    } else if (ratio >= 0.5) {
      signals.push({
        name: 'Mixed MA Position',
        category: 'technical',
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
      name: 'Near MA50 Support',
      category: 'technical',
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
      const distanceToMA200 =
        Math.abs(currentPrice - currentSMA200) / currentPrice;

      if (distanceToMA200 < 0.03 && currentPrice <= currentSMA200) {
        return {
          name: 'Near MA200 Support',
          category: 'technical',
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
      name: 'Volume Surge',
      category: 'technical',
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
      name: 'Near Support',
      category: 'technical',
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
function checkOBVTrend(closes: number[], volumes: number[]): Signal | null {
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
      name: 'OBV Uptrend',
      category: 'technical',
      points: defaultWeights.technical.obvTrend,
      description: 'On-Balance Volume trending higher',
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
      name: 'MACD Bullish',
      category: 'technical',
      points: 5,
      description: 'MACD crossed above signal line',
      value: true,
    };
  }

  // MACD above signal (continuation)
  if (current.MACD > current.signal && current.MACD > 0) {
    return {
      name: 'MACD Positive',
      category: 'technical',
      points: 3,
      description: 'MACD above signal and positive',
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

  const prices = historical.slice(-252).map((d) => d.close);
  const low52 = Math.min(...prices);
  const high52 = Math.max(...prices);

  const range = high52 - low52;
  if (range === 0) return null;

  const positionInRange = (currentPrice - low52) / range;
  const pctFromLow = (currentPrice - low52) / low52;

  // Within 10% of 52-week low - contrarian opportunity
  if (pctFromLow < 0.1) {
    return {
      name: 'Near 52-Week Low',
      category: 'technical',
      points: 8,
      description: `${(pctFromLow * 100).toFixed(1)}% above 52-week low ($${low52.toFixed(2)})`,
      value: low52,
    };
  }

  // In bottom 25% of range
  if (positionInRange < 0.25) {
    return {
      name: 'Lower 52-Week Range',
      category: 'technical',
      points: 4,
      description: `In bottom 25% of 52-week range`,
      value: positionInRange,
    };
  }

  return null;
}

/**
 * v1.7.0: Check ADX (Average Directional Index) for trend strength
 * ADX > 25 indicates a strong trend
 * ADX < 20 indicates a weak/ranging market
 */
function checkADX(historical: HistoricalData[]): Signal | null {
  if (historical.length < 20) return null;

  const highs = historical.map((d) => d.high);
  const lows = historical.map((d) => d.low);
  const closes = historical.map((d) => d.close);

  try {
    const adxResult = ADX.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14,
    });

    if (adxResult.length === 0) return null;

    const currentADX = adxResult[adxResult.length - 1]?.adx;
    if (currentADX === undefined) return null;

    // Strong trend (ADX > 30)
    if (currentADX > 30) {
      return {
        name: 'Strong Trend',
        category: 'technical',
        points: 5,
        description: `ADX ${currentADX.toFixed(0)} — strong trend in place`,
        value: currentADX,
      };
    }

    // Moderate trend (ADX 25-30)
    if (currentADX > 25) {
      return {
        name: 'Trending',
        category: 'technical',
        points: 3,
        description: `ADX ${currentADX.toFixed(0)} — trend developing`,
        value: currentADX,
      };
    }

    // Weak trend (ADX < 20) - potential breakout setup
    if (currentADX < 20) {
      return {
        name: 'Consolidating',
        category: 'technical',
        points: 2,
        description: `ADX ${currentADX.toFixed(0)} — ranging, watch for breakout`,
        value: currentADX,
      };
    }
  } catch {
    // ADX calculation failed, return null
  }

  return null;
}

/**
 * v1.8.0: Check for RSI/Price Divergence
 *
 * Bullish Divergence: Price makes lower low, RSI makes higher low
 * Bearish Divergence: Price makes higher high, RSI makes lower high
 *
 * This is one of the most reliable reversal signals.
 */
function checkRSIDivergence(
  closes: number[],
  lookback: number = 20
): Signal | null {
  if (closes.length < lookback + 14) return null;

  // Calculate RSI for the lookback period
  const rsiValues: number[] = [];

  for (let i = 14; i < closes.length; i++) {
    const slice = closes.slice(i - 14, i + 1);
    let gains = 0;
    let losses = 0;

    for (let j = 1; j < slice.length; j++) {
      const prev = slice[j - 1];
      const curr = slice[j];
      if (prev === undefined || curr === undefined) continue;
      const change = curr - prev;
      if (change >= 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  if (rsiValues.length < lookback) return null;

  // Get recent data for analysis
  const recentCloses = closes.slice(-lookback);
  const recentRSI = rsiValues.slice(-lookback);

  // Find swing lows in price (for bullish divergence)
  // Look for two lows where second is lower than first
  let priceLow1 = Infinity,
    priceLow2 = Infinity;
  let rsiAtLow1 = 0,
    rsiAtLow2 = 0;
  let low1Idx = -1,
    low2Idx = -1;

  // Find swing lows (local minima)
  for (let i = 2; i < recentCloses.length - 2; i++) {
    const curr = recentCloses[i];
    const prev1 = recentCloses[i - 1];
    const prev2 = recentCloses[i - 2];
    const next1 = recentCloses[i + 1];
    const next2 = recentCloses[i + 2];
    const currRSI = recentRSI[i];

    if (
      curr !== undefined &&
      prev1 !== undefined &&
      prev2 !== undefined &&
      next1 !== undefined &&
      next2 !== undefined &&
      currRSI !== undefined &&
      curr < prev1 &&
      curr < prev2 &&
      curr < next1 &&
      curr < next2
    ) {
      if (low1Idx === -1) {
        priceLow1 = curr;
        rsiAtLow1 = currRSI;
        low1Idx = i;
      } else if (i - low1Idx >= 3) {
        priceLow2 = curr;
        rsiAtLow2 = currRSI;
        low2Idx = i;
      }
    }
  }

  // Check for bullish divergence: price lower low, RSI higher low
  if (
    low1Idx !== -1 &&
    low2Idx !== -1 &&
    priceLow2 < priceLow1 * 0.99 && // Price made lower low (1%+ lower)
    rsiAtLow2 > rsiAtLow1 + 3 // RSI made higher low (3+ pts higher)
  ) {
    return {
      name: 'Bullish RSI Divergence',
      category: 'technical',
      points: 8,
      description: `Price lower low but RSI higher low — reversal signal`,
      value: rsiAtLow2,
    };
  }

  // Note: Bearish divergence detection removed as it's not a buy signal
  // Could be added as a warning in the bear case instead

  return null;
}

/**
 * v1.8.0: Check for MACD/Price Divergence
 *
 * Similar to RSI divergence but uses MACD histogram.
 * MACD divergence often occurs before RSI divergence.
 */
function checkMACDDivergence(closes: number[]): Signal | null {
  if (closes.length < 35) return null;

  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  if (macdResult.length < 20) return null;

  const recentMACD = macdResult.slice(-20);
  const recentCloses = closes.slice(-20);

  // Find troughs in MACD histogram
  const histograms = recentMACD.map((m) => m.histogram ?? 0);

  let low1Idx = -1,
    low2Idx = -1;
  let histLow1 = 0,
    histLow2 = 0;
  let priceLow1 = Infinity,
    priceLow2 = Infinity;

  // Find local minima in histogram (negative values trending toward zero)
  for (let i = 2; i < histograms.length - 2; i++) {
    const curr = histograms[i];
    const prev = histograms[i - 1];
    const next = histograms[i + 1];
    const price = recentCloses[i];

    if (
      curr !== undefined &&
      prev !== undefined &&
      next !== undefined &&
      price !== undefined &&
      curr < 0 && // Must be in negative territory
      curr < prev &&
      curr < next
    ) {
      if (low1Idx === -1) {
        histLow1 = curr;
        priceLow1 = price;
        low1Idx = i;
      } else if (i - low1Idx >= 3) {
        histLow2 = curr;
        priceLow2 = price;
        low2Idx = i;
      }
    }
  }

  // Bullish MACD divergence: price lower low, histogram higher low
  if (
    low1Idx !== -1 &&
    low2Idx !== -1 &&
    priceLow2 < priceLow1 * 0.99 && // Price made lower low
    histLow2 > histLow1 // MACD histogram made higher low
  ) {
    return {
      name: 'Bullish MACD Divergence',
      category: 'technical',
      points: 6,
      description: `Price lower low but MACD higher low — momentum building`,
      value: histLow2,
    };
  }

  return null;
}

/**
 * v1.7.0: Check Bollinger Band position for mean reversion
 * Price near lower band = potential bounce
 * Price near upper band = extended, potential pullback
 */
function checkBollingerBands(
  closes: number[],
  currentPrice: number
): Signal | null {
  if (closes.length < 25) return null;

  try {
    const bbResult = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });

    if (bbResult.length === 0) return null;

    const current = bbResult[bbResult.length - 1];
    if (!current || !current.upper || !current.lower || !current.middle) {
      return null;
    }

    const bandWidth = current.upper - current.lower;
    if (bandWidth === 0) return null;

    // Calculate %B (position within bands)
    // %B = (Price - Lower) / (Upper - Lower)
    // 0 = at lower band, 1 = at upper band, 0.5 = at middle
    const percentB = (currentPrice - current.lower) / bandWidth;

    // Near lower band (%B < 0.15) - potential bounce
    if (percentB < 0.15) {
      return {
        name: 'Near Lower Bollinger',
        category: 'technical',
        points: 5,
        description: `Price near lower band — oversold bounce potential`,
        value: percentB,
      };
    }

    // At lower half but not extreme (0.15-0.35) - favorable entry
    if (percentB < 0.35) {
      return {
        name: 'Lower Bollinger Zone',
        category: 'technical',
        points: 3,
        description: `Price in lower band zone — favorable entry area`,
        value: percentB,
      };
    }

    // At middle band - neutral, no signal
    // Don't award points for being in the middle

    // Near upper band (%B > 0.85) - extended, note as warning
    // (This is informational, not a buy signal)
  } catch {
    // Bollinger calculation failed, return null
  }

  return null;
}

/**
 * Signal group caps to prevent excessive scoring from related signals
 * v1.7.1: Added to prevent MA-related signal stacking
 * v2.5.0: Added pullback group for entry setup signals
 */
const SIGNAL_GROUP_CAPS: Record<
  string,
  { keywords: string[]; maxPoints: number }
> = {
  movingAverage: {
    keywords: ['ma', 'golden', 'sma', 'moving average'],
    maxPoints: 15, // Cap MA-related signals at 15 points
  },
  momentum: {
    keywords: ['rsi', 'macd', 'obv'],
    maxPoints: 12, // Cap momentum indicators at 12 points
  },
  pricePosition: {
    keywords: ['52-week', 'support', 'bollinger'],
    maxPoints: 12, // Cap price position signals at 12 points
  },
  pullback: {
    keywords: ['pullback', 'pulled back'],
    maxPoints: 15, // Cap pullback signals (can overlap with entry setup)
  },
};

/**
 * Apply signal group caps to prevent related signals from stacking excessively
 */
function applySignalGroupCaps(signals: Signal[]): number {
  let totalScore = 0;
  const groupScores: Record<string, number> = {};

  // Initialize group scores
  for (const group of Object.keys(SIGNAL_GROUP_CAPS)) {
    groupScores[group] = 0;
  }

  for (const signal of signals) {
    const signalNameLower = signal.name.toLowerCase();
    let assignedToGroup = false;

    // Check which group this signal belongs to
    for (const [groupName, config] of Object.entries(SIGNAL_GROUP_CAPS)) {
      const belongsToGroup = config.keywords.some((kw) =>
        signalNameLower.includes(kw)
      );

      if (belongsToGroup) {
        // Add points up to the group cap
        const currentGroupScore = groupScores[groupName] ?? 0;
        const pointsToAdd = Math.min(
          signal.points,
          config.maxPoints - currentGroupScore
        );
        groupScores[groupName] = currentGroupScore + pointsToAdd;
        totalScore += pointsToAdd;
        assignedToGroup = true;
        break;
      }
    }

    // If signal doesn't belong to any capped group, add full points
    if (!assignedToGroup) {
      totalScore += signal.points;
    }
  }

  return totalScore;
}

/**
 * Calculate all technical signals for a stock
 * v1.7.0: Added ADX trend strength and Bollinger Band signals
 * v1.7.1: Added signal group caps to prevent stacking
 */
export function calculateTechnicalSignals(
  quote: QuoteData,
  historical: HistoricalData[]
): TechnicalResult {
  const signals: Signal[] = [];

  if (historical.length < 20) {
    return { score: 0, signals: [] };
  }

  const closes = historical.map((d) => d.close);
  const volumes = historical.map((d) => d.volume);
  const currentPrice = quote.regularMarketPrice ?? closes[closes.length - 1];

  // RSI (v2.5.0: rewards ideal entry zone 35-50)
  const rsiSignal = checkRSI(closes);
  if (rsiSignal) {
    signals.push(rsiSignal);
  }

  // v2.5.0: Pullback-in-uptrend detection (core CDS entry signal)
  const pullbackSignals = checkPullbackInUptrend(currentPrice ?? 0, closes);
  for (const signal of pullbackSignals) {
    signals.push(signal);
  }

  // Golden Cross
  const goldenCrossSignal = checkGoldenCross(closes);
  if (goldenCrossSignal) {
    signals.push(goldenCrossSignal);
  }

  // MA Position (graduated based on how many MAs price is above)
  const maPositionSignals = checkMAPosition(currentPrice ?? 0, closes);
  for (const signal of maPositionSignals) {
    signals.push(signal);
  }

  // MA Proximity (near key MA levels)
  const maProximitySignal = checkMAProximity(currentPrice ?? 0, closes);
  if (maProximitySignal) {
    signals.push(maProximitySignal);
  }

  // Volume Surge
  const volumeSignal = checkVolumeSurge(volumes, quote);
  if (volumeSignal) {
    signals.push(volumeSignal);
  }

  // Near Support
  const supportSignal = checkNearSupport(currentPrice ?? 0, historical);
  if (supportSignal) {
    signals.push(supportSignal);
  }

  // OBV Trend
  const obvSignal = checkOBVTrend(closes, volumes);
  if (obvSignal) {
    signals.push(obvSignal);
  }

  // MACD
  const macdSignal = checkMACD(closes);
  if (macdSignal) {
    signals.push(macdSignal);
  }

  // 52-Week Position
  const weekPositionSignal = check52WeekPosition(currentPrice ?? 0, historical);
  if (weekPositionSignal) {
    signals.push(weekPositionSignal);
  }

  // v1.7.0: ADX Trend Strength
  const adxSignal = checkADX(historical);
  if (adxSignal) {
    signals.push(adxSignal);
  }

  // v1.7.0: Bollinger Bands position
  const bbSignal = checkBollingerBands(closes, currentPrice ?? 0);
  if (bbSignal) {
    signals.push(bbSignal);
  }

  // v1.8.0: RSI Divergence (highly reliable reversal signal)
  const rsiDivergenceSignal = checkRSIDivergence(closes);
  if (rsiDivergenceSignal) {
    signals.push(rsiDivergenceSignal);
  }

  // v1.8.0: MACD Divergence
  const macdDivergenceSignal = checkMACDDivergence(closes);
  if (macdDivergenceSignal) {
    signals.push(macdDivergenceSignal);
  }

  // v1.7.1: Apply signal group caps to prevent stacking
  const cappedScore = applySignalGroupCaps(signals);

  // Cap at 50 points total
  return {
    score: Math.min(cappedScore, 50),
    signals,
  };
}
