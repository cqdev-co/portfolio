/**
 * Position Parser
 * Parses options spread notation like "111/112 Call Debit Spread"
 */

export type SpreadType =
  | 'call_debit'
  | 'call_credit'
  | 'put_debit'
  | 'put_credit'
  | 'unknown';

export type SpreadDirection = 'bullish' | 'bearish' | 'neutral';

export interface ParsedPosition {
  /** Lower strike price */
  lowerStrike: number;
  /** Higher strike price */
  higherStrike: number;
  /** Spread width in dollars */
  width: number;
  /** Type of spread */
  type: SpreadType;
  /** Direction bias */
  direction: SpreadDirection;
  /** The critical strike (where you start losing money) */
  criticalStrike: number;
  /** Original input string */
  raw: string;
  /** Human-readable description */
  description: string;
}

/**
 * Parse a position string like "111/112 Call Debit Spread"
 *
 * Supported formats:
 * - "111/112 Call Debit Spread"
 * - "115/110 Put Credit Spread"
 * - "$111/$112 call debit"
 * - "111/112 CDS" (Call Debit Spread)
 * - "115/110 PCS" (Put Credit Spread)
 */
export function parsePosition(input: string): ParsedPosition | null {
  const raw = input.trim();

  // Extract strikes: look for patterns like "111/112" or "$111/$112"
  const strikePattern = /\$?(\d+(?:\.\d+)?)\s*\/\s*\$?(\d+(?:\.\d+)?)/;
  const strikeMatch = raw.match(strikePattern);

  if (!strikeMatch) {
    return null;
  }

  const strike1 = parseFloat(strikeMatch[1]!);
  const strike2 = parseFloat(strikeMatch[2]!);
  const lowerStrike = Math.min(strike1, strike2);
  const higherStrike = Math.max(strike1, strike2);
  const width = higherStrike - lowerStrike;

  // Determine spread type from keywords
  const lower = raw.toLowerCase();
  let type: SpreadType = 'unknown';
  let direction: SpreadDirection = 'neutral';
  let criticalStrike: number;
  let description: string;

  // Call Debit Spread (Bull Call Spread)
  // Buy lower call, sell higher call
  // Max profit above higher strike, max loss below lower strike
  if (
    lower.includes('call debit') ||
    lower.includes('call debt') ||
    lower.includes('cds') ||
    (lower.includes('call') && lower.includes('debit'))
  ) {
    type = 'call_debit';
    direction = 'bullish';
    criticalStrike = lowerStrike; // Lose money below this
    description = `Bull Call Spread: Buy $${lowerStrike}C / Sell $${higherStrike}C`;
  }
  // Call Credit Spread (Bear Call Spread)
  // Sell lower call, buy higher call
  // Max profit below lower strike, max loss above higher strike
  else if (
    lower.includes('call credit') ||
    lower.includes('ccs') ||
    (lower.includes('call') && lower.includes('credit'))
  ) {
    type = 'call_credit';
    direction = 'bearish';
    criticalStrike = higherStrike; // Lose money above this
    description = `Bear Call Spread: Sell $${lowerStrike}C / Buy $${higherStrike}C`;
  }
  // Put Debit Spread (Bear Put Spread)
  // Buy higher put, sell lower put
  // Max profit below lower strike, max loss above higher strike
  else if (
    lower.includes('put debit') ||
    lower.includes('put debt') ||
    lower.includes('pds') ||
    (lower.includes('put') && lower.includes('debit'))
  ) {
    type = 'put_debit';
    direction = 'bearish';
    criticalStrike = higherStrike; // Lose money above this
    description = `Bear Put Spread: Buy $${higherStrike}P / Sell $${lowerStrike}P`;
  }
  // Put Credit Spread (Bull Put Spread)
  // Sell higher put, buy lower put
  // Max profit above higher strike, max loss below lower strike
  else if (
    lower.includes('put credit') ||
    lower.includes('pcs') ||
    (lower.includes('put') && lower.includes('credit'))
  ) {
    type = 'put_credit';
    direction = 'bullish';
    criticalStrike = higherStrike; // Start losing below this
    description = `Bull Put Spread: Sell $${higherStrike}P / Buy $${lowerStrike}P`;
  }
  // Default: try to infer from just "call" or "put"
  else if (lower.includes('call')) {
    // Assume debit if just "call" mentioned
    type = 'call_debit';
    direction = 'bullish';
    criticalStrike = lowerStrike;
    description = `Call Spread: $${lowerStrike}C / $${higherStrike}C`;
  } else if (lower.includes('put')) {
    // Assume credit if just "put" mentioned
    type = 'put_credit';
    direction = 'bullish';
    criticalStrike = higherStrike;
    description = `Put Spread: $${lowerStrike}P / $${higherStrike}P`;
  } else {
    // Can't determine type
    criticalStrike = lowerStrike;
    description = `Spread: $${lowerStrike} / $${higherStrike}`;
  }

  return {
    lowerStrike,
    higherStrike,
    width,
    type,
    direction,
    criticalStrike,
    raw,
    description,
  };
}

/**
 * Analyze a position against current price and support/resistance levels
 */
export interface PositionAnalysis {
  position: ParsedPosition;
  currentPrice: number;

  /** Distance from current price to critical strike */
  cushion: number;
  cushionPct: number;

  /** How support levels relate to the position */
  supportAnalysis: {
    s1?: { price: number; belowCritical: boolean; distance: number };
    s2?: { price: number; belowCritical: boolean; distance: number };
  };

  /** Estimated probability of profit (rough) */
  probabilityOfProfit: number;

  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Recommended action */
  recommendation: string;
}

export function analyzePosition(
  position: ParsedPosition,
  currentPrice: number,
  support1?: number | null,
  support2?: number | null
): PositionAnalysis {
  const { criticalStrike, direction } = position;

  // Calculate cushion based on direction
  let cushion: number;
  let cushionPct: number;

  if (direction === 'bullish') {
    // Bullish spreads: we want price to stay ABOVE critical strike
    cushion = currentPrice - criticalStrike;
    cushionPct = (cushion / currentPrice) * 100;
  } else {
    // Bearish spreads: we want price to stay BELOW critical strike
    cushion = criticalStrike - currentPrice;
    cushionPct = (cushion / currentPrice) * 100;
  }

  // Analyze support levels
  const supportAnalysis: PositionAnalysis['supportAnalysis'] = {};

  if (support1) {
    supportAnalysis.s1 = {
      price: support1,
      belowCritical: support1 < criticalStrike,
      distance: Math.abs(support1 - criticalStrike),
    };
  }

  if (support2) {
    supportAnalysis.s2 = {
      price: support2,
      belowCritical: support2 < criticalStrike,
      distance: Math.abs(support2 - criticalStrike),
    };
  }

  // Estimate probability of profit
  // This is a rough estimate based on cushion
  let probabilityOfProfit: number;
  if (cushionPct >= 15) {
    probabilityOfProfit = 90;
  } else if (cushionPct >= 10) {
    probabilityOfProfit = 85;
  } else if (cushionPct >= 7) {
    probabilityOfProfit = 80;
  } else if (cushionPct >= 5) {
    probabilityOfProfit = 70;
  } else if (cushionPct >= 3) {
    probabilityOfProfit = 60;
  } else if (cushionPct >= 0) {
    probabilityOfProfit = 50;
  } else {
    // Negative cushion = already past critical strike
    probabilityOfProfit = Math.max(10, 50 + cushionPct * 5);
  }

  // Adjust probability if support is below critical strike (extra cushion)
  if (direction === 'bullish' && support1 && support1 < criticalStrike) {
    probabilityOfProfit = Math.min(95, probabilityOfProfit + 5);
  }

  // Determine risk level
  let riskLevel: PositionAnalysis['riskLevel'];
  if (cushionPct >= 10) {
    riskLevel = 'low';
  } else if (cushionPct >= 5) {
    riskLevel = 'medium';
  } else if (cushionPct >= 0) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }

  // Generate recommendation
  let recommendation: string;
  if (riskLevel === 'low') {
    recommendation = 'HOLD — your strike is well-protected';
  } else if (riskLevel === 'medium') {
    recommendation = 'HOLD with caution — monitor price action';
  } else if (riskLevel === 'high') {
    recommendation = 'CAUTION — consider closing if price deteriorates';
  } else {
    recommendation =
      'DANGER — price has breached your critical level, consider closing';
  }

  return {
    position,
    currentPrice,
    cushion,
    cushionPct,
    supportAnalysis,
    probabilityOfProfit,
    riskLevel,
    recommendation,
  };
}
