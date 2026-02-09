/**
 * PCS Technical Signal Detection
 *
 * Uses shared technical helpers from @portfolio/providers for common signals,
 * plus PCS-specific logic for RSI zones, MA position, ADX, and Bollinger Bands.
 *
 * Key differences from CDS:
 * - RSI ideal zone shifted to 40-55 (neutral/slightly bullish)
 * - MA50 preferred over MA200 (less directional requirement)
 * - No "Near 52-week low" (dangerous for credit selling)
 * - BB middle zone preferred (stability signal)
 * - Moderate ADX preferred (not too volatile)
 */

import { RSI, SMA, ADX, BollingerBands } from 'technicalindicators';
import type { Signal, QuoteData, HistoricalData } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';
import {
  checkGoldenCross as sharedCheckGoldenCross,
  checkVolumeSurge as sharedCheckVolumeSurge,
  checkOBVTrend as sharedCheckOBVTrend,
  checkMACD as sharedCheckMACD,
  applySignalGroupCaps,
} from '@portfolio/providers';

interface TechnicalResult {
  score: number;
  signals: Signal[];
}

// ============================================================================
// PCS-SPECIFIC SIGNALS
// ============================================================================

/**
 * RSI scoring for PCS entry
 * PCS ideal zone: 40-55 (neutral-to-slightly-bullish)
 */
function checkRSI(closes: number[]): Signal | null {
  if (closes.length < 15) return null;

  const rsiResult = RSI.calculate({ values: closes, period: 14 });
  const currentRSI = rsiResult[rsiResult.length - 1];
  if (currentRSI === undefined) return null;

  const thresholds = defaultThresholds.technical;

  if (
    currentRSI >= thresholds.rsiIdealMin &&
    currentRSI <= thresholds.rsiIdealMax
  ) {
    return {
      name: 'RSI Ideal Zone',
      category: 'technical',
      points: defaultWeights.technical.rsiIdealZone,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (ideal for PCS)`,
      value: currentRSI,
    };
  }

  if (currentRSI > 55 && currentRSI <= 65) {
    return {
      name: 'RSI Acceptable',
      category: 'technical',
      points: 5,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (slightly extended, acceptable)`,
      value: currentRSI,
    };
  }

  if (currentRSI >= 35 && currentRSI < 40) {
    return {
      name: 'RSI Approaching Oversold',
      category: 'technical',
      points: 4,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (approaching oversold - caution)`,
      value: currentRSI,
    };
  }

  if (currentRSI < 35) {
    return {
      name: 'RSI Oversold Warning',
      category: 'technical',
      points: 1,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (oversold - high risk for PCS)`,
      value: currentRSI,
    };
  }

  if (currentRSI > 65) {
    return {
      name: 'RSI Extended',
      category: 'technical',
      points: 2,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (extended - may pull back)`,
      value: currentRSI,
    };
  }

  return null;
}

/**
 * MA position check for PCS
 * Above MA50 is the primary requirement (less strict than CDS MA200)
 */
function checkMAPosition(currentPrice: number, closes: number[]): Signal[] {
  const signals: Signal[] = [];
  if (closes.length < 50) return signals;

  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const currentSMA50 = sma50[sma50.length - 1];

  if (currentSMA50 !== undefined && currentPrice > currentSMA50) {
    signals.push({
      name: 'Above MA50',
      category: 'technical',
      points: defaultWeights.technical.maPosition,
      description: `Price above 50-day MA ($${currentSMA50.toFixed(2)})`,
      value: currentSMA50,
    });
  }

  if (closes.length >= 200) {
    const sma200 = SMA.calculate({ values: closes, period: 200 });
    const currentSMA200 = sma200[sma200.length - 1];
    if (currentSMA200 !== undefined && currentPrice > currentSMA200) {
      signals.push({
        name: 'Above MA200',
        category: 'technical',
        points: 4,
        description: `Price above 200-day MA ($${currentSMA200.toFixed(2)})`,
        value: currentSMA200,
      });
    }
  }

  return signals;
}

/**
 * ADX trend strength for PCS
 * Moderate trend (20-35) is ideal for credit spreads
 */
function checkADX(historical: HistoricalData[]): Signal | null {
  if (historical.length < 20) return null;

  try {
    const adxResult = ADX.calculate({
      high: historical.map((d) => d.high),
      low: historical.map((d) => d.low),
      close: historical.map((d) => d.close),
      period: 14,
    });

    if (adxResult.length === 0) return null;
    const currentADX = adxResult[adxResult.length - 1]?.adx;
    if (currentADX === undefined) return null;

    if (currentADX > 20 && currentADX < 35) {
      return {
        name: 'Moderate Trend',
        category: 'technical',
        points: 4,
        description: `ADX ${currentADX.toFixed(0)} — moderate trend (ideal for PCS)`,
        value: currentADX,
      };
    }

    if (currentADX >= 35) {
      return {
        name: 'Strong Trend',
        category: 'technical',
        points: 3,
        description: `ADX ${currentADX.toFixed(0)} — strong trend (watch for reversals)`,
        value: currentADX,
      };
    }
  } catch {
    // ADX calculation failed
  }
  return null;
}

/**
 * Bollinger Band position for PCS
 * Middle zone (0.35-0.65) is ideal — stable price
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
    if (!current || !current.upper || !current.lower) return null;

    const bandWidth = current.upper - current.lower;
    if (bandWidth === 0) return null;

    const percentB = (currentPrice - current.lower) / bandWidth;

    if (percentB >= 0.35 && percentB <= 0.65) {
      return {
        name: 'BB Middle Zone',
        category: 'technical',
        points: 3,
        description: `Price in middle Bollinger zone — stable`,
        value: percentB,
      };
    }

    if (percentB < 0.15) {
      return {
        name: 'BB Lower Warning',
        category: 'technical',
        points: 0,
        description: `Price near lower Bollinger — risk for PCS`,
        value: percentB,
      };
    }
  } catch {
    // BB calculation failed
  }
  return null;
}

// ============================================================================
// PCS-SPECIFIC GROUP CAPS (slightly different from CDS)
// ============================================================================

const PCS_SIGNAL_GROUP_CAPS: Record<
  string,
  { keywords: string[]; maxPoints: number }
> = {
  movingAverage: {
    keywords: ['ma', 'golden', 'sma', 'moving average'],
    maxPoints: 15,
  },
  momentum: {
    keywords: ['rsi', 'macd', 'obv'],
    maxPoints: 12,
  },
  pricePosition: {
    keywords: ['support', 'bollinger', 'bb'],
    maxPoints: 10,
  },
};

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Calculate all technical signals for PCS strategy
 * Uses shared functions for Golden Cross, Volume, OBV, MACD
 * Uses PCS-specific functions for RSI, MA position, ADX, BB
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

  // PCS-specific RSI zones
  const rsiSignal = checkRSI(closes);
  if (rsiSignal) signals.push(rsiSignal);

  // Shared: Golden Cross
  const goldenCrossSignal = sharedCheckGoldenCross(
    closes,
    defaultWeights.technical.goldenCross
  );
  if (goldenCrossSignal) signals.push(goldenCrossSignal);

  // PCS-specific MA Position (MA50 primary)
  const maPositionSignals = checkMAPosition(currentPrice ?? 0, closes);
  for (const signal of maPositionSignals) signals.push(signal);

  // Shared: Volume Surge
  const volumeSignal = sharedCheckVolumeSurge(
    quote,
    defaultThresholds.technical.volumeSurgeMultiplier,
    defaultWeights.technical.volumeSurge
  );
  if (volumeSignal) signals.push(volumeSignal);

  // Shared: OBV Trend
  const obvSignal = sharedCheckOBVTrend(
    closes,
    volumes,
    defaultWeights.technical.obvTrend
  );
  if (obvSignal) signals.push(obvSignal);

  // Shared: MACD
  const macdSignal = sharedCheckMACD(closes);
  if (macdSignal) signals.push(macdSignal);

  // PCS-specific ADX
  const adxSignal = checkADX(historical);
  if (adxSignal) signals.push(adxSignal);

  // PCS-specific Bollinger Bands
  const bbSignal = checkBollingerBands(closes, currentPrice ?? 0);
  if (bbSignal) signals.push(bbSignal);

  // Apply PCS-specific group caps (using shared applySignalGroupCaps)
  const cappedScore = applySignalGroupCaps(signals, PCS_SIGNAL_GROUP_CAPS);

  return {
    score: Math.min(cappedScore, 40),
    signals,
  };
}
