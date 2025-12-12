/**
 * Market Regime Detection
 * Determines if we're in a bull, bear, or neutral market using SPY
 */

import { yahooProvider } from "../providers/yahoo.ts";

export type MarketRegime = "bull" | "neutral" | "bear";

export interface MarketContext {
  regime: MarketRegime;
  spyPrice: number;
  spyMA50: number;
  spyMA200: number;
  return20d: number;
  return50d: number;
  vix?: number;
  signals: string[];
  recommendation: string;
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Analyze market regime using SPY
 */
export async function getMarketRegime(): Promise<MarketContext | null> {
  try {
    // Fetch SPY historical data (need 250 days for MA200)
    const history = await yahooProvider.getHistorical("SPY", 365);
    if (!history || history.length < 200) {
      return null;
    }

    // Get prices (most recent first)
    const closes = history.map(h => h.close);
    const currentPrice = closes[0];
    
    // Calculate moving averages
    const ma50 = calculateSMA(closes, 50);
    const ma200 = calculateSMA(closes, 200);
    
    if (!ma50 || !ma200) return null;
    
    // Calculate returns
    const price20dAgo = closes[20] ?? closes[closes.length - 1];
    const price50dAgo = closes[50] ?? closes[closes.length - 1];
    const return20d = ((currentPrice - price20dAgo) / price20dAgo) * 100;
    const return50d = ((currentPrice - price50dAgo) / price50dAgo) * 100;
    
    // Score the market (higher = more bullish)
    let score = 0;
    const signals: string[] = [];
    
    // SPY vs MA200 (most important)
    const pctAboveMA200 = ((currentPrice - ma200) / ma200) * 100;
    if (pctAboveMA200 > 5) {
      score += 2;
      signals.push(`SPY +${pctAboveMA200.toFixed(1)}% above MA200`);
    } else if (pctAboveMA200 > 0) {
      score += 1;
      signals.push(`SPY slightly above MA200`);
    } else if (pctAboveMA200 > -5) {
      score -= 1;
      signals.push(`SPY slightly below MA200`);
    } else {
      score -= 2;
      signals.push(`SPY ${pctAboveMA200.toFixed(1)}% below MA200`);
    }
    
    // SPY vs MA50
    const pctAboveMA50 = ((currentPrice - ma50) / ma50) * 100;
    if (pctAboveMA50 > 2) {
      score += 1;
      signals.push(`Above MA50`);
    } else if (pctAboveMA50 < -2) {
      score -= 1;
      signals.push(`Below MA50`);
    }
    
    // Recent momentum (20-day)
    if (return20d > 3) {
      score += 1;
      signals.push(`Strong 20d momentum (+${return20d.toFixed(1)}%)`);
    } else if (return20d < -3) {
      score -= 1;
      signals.push(`Weak 20d momentum (${return20d.toFixed(1)}%)`);
    }
    
    // Golden/Death cross
    if (ma50 > ma200) {
      score += 1;
      signals.push(`Golden cross active (MA50 > MA200)`);
    } else {
      score -= 1;
      signals.push(`Death cross (MA50 < MA200)`);
    }
    
    // Determine regime
    let regime: MarketRegime;
    let recommendation: string;
    
    if (score >= 3) {
      regime = "bull";
      recommendation = "Full position sizes, standard stops";
    } else if (score >= 1) {
      regime = "bull";
      recommendation = "Normal position sizes, watch for weakness";
    } else if (score >= -1) {
      regime = "neutral";
      recommendation = "Reduce position size to 50-75%, tighter stops";
    } else if (score >= -3) {
      regime = "bear";
      recommendation = "Small positions only (25-50%), defensive plays";
    } else {
      regime = "bear";
      recommendation = "Cash preferred, only high-conviction trades";
    }
    
    return {
      regime,
      spyPrice: currentPrice,
      spyMA50: ma50,
      spyMA200: ma200,
      return20d,
      return50d,
      signals,
      recommendation,
    };
  } catch (error) {
    console.error("Error fetching market regime:", error);
    return null;
  }
}

