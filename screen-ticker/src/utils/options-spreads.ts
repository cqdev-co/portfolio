/**
 * Options Vertical Spread Calculator
 * Calculates optimal call/put spreads based on support/resistance levels
 */

export interface OptionContract {
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  type: 'call' | 'put';
  openInterest: number;
  volume: number;
  impliedVolatility: number;
}

export interface VerticalSpread {
  type: 'call_debit' | 'put_credit' | 'call_credit' | 'put_debit';
  strategy: string;
  sentiment: 'bullish' | 'bearish';
  longLeg: {
    strike: number;
    premium: number;
    type: 'call' | 'put';
  };
  shortLeg: {
    strike: number;
    premium: number;
    type: 'call' | 'put';
  };
  expiration: Date;
  daysToExpiry: number;

  // Risk/Reward
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  riskRewardRatio: number;

  // Probability estimates
  probabilityOfProfit: number;

  // Display helpers
  spreadWidth: number;
  netDebit: number | null;
  netCredit: number | null;
}

export interface SpreadRecommendation {
  bullishSpread: VerticalSpread | null;
  bearishSpread: VerticalSpread | null;
  recommendation: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate call debit spread metrics
 * Buy lower strike call, sell higher strike call
 */
export function calculateCallDebitSpread(
  longCall: OptionContract,
  shortCall: OptionContract,
  currentPrice: number
): VerticalSpread {
  const netDebit = longCall.ask - shortCall.bid;
  const spreadWidth = shortCall.strike - longCall.strike;
  const maxProfit = spreadWidth - netDebit;
  const maxLoss = netDebit;
  const breakeven = longCall.strike + netDebit;

  // Simple probability estimate based on moneyness
  const distanceToBreakeven = (breakeven - currentPrice) / currentPrice;
  const probabilityOfProfit = Math.max(
    0.1,
    Math.min(0.9, 0.5 - distanceToBreakeven * 2)
  );

  const daysToExpiry = Math.ceil(
    (longCall.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return {
    type: 'call_debit',
    strategy: 'Bull Call Spread',
    sentiment: 'bullish',
    longLeg: {
      strike: longCall.strike,
      premium: longCall.ask,
      type: 'call',
    },
    shortLeg: {
      strike: shortCall.strike,
      premium: shortCall.bid,
      type: 'call',
    },
    expiration: longCall.expiration,
    daysToExpiry,
    maxProfit: Math.round(maxProfit * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    riskRewardRatio: Math.round((maxProfit / maxLoss) * 10) / 10,
    probabilityOfProfit: Math.round(probabilityOfProfit * 100),
    spreadWidth,
    netDebit: Math.round(netDebit * 100) / 100,
    netCredit: null,
  };
}

/**
 * Calculate put credit spread metrics
 * Sell higher strike put, buy lower strike put
 */
export function calculatePutCreditSpread(
  shortPut: OptionContract,
  longPut: OptionContract,
  currentPrice: number
): VerticalSpread {
  const netCredit = shortPut.bid - longPut.ask;
  const spreadWidth = shortPut.strike - longPut.strike;
  const maxProfit = netCredit;
  const maxLoss = spreadWidth - netCredit;
  const breakeven = shortPut.strike - netCredit;

  // Probability estimate - put credit spread profits if price stays above breakeven
  const distanceToBreakeven = (currentPrice - breakeven) / currentPrice;
  const probabilityOfProfit = Math.max(
    0.1,
    Math.min(0.9, 0.5 + distanceToBreakeven * 2)
  );

  const daysToExpiry = Math.ceil(
    (shortPut.expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return {
    type: 'put_credit',
    strategy: 'Bull Put Spread',
    sentiment: 'bullish',
    longLeg: {
      strike: longPut.strike,
      premium: longPut.ask,
      type: 'put',
    },
    shortLeg: {
      strike: shortPut.strike,
      premium: shortPut.bid,
      type: 'put',
    },
    expiration: shortPut.expiration,
    daysToExpiry,
    maxProfit: Math.round(maxProfit * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    riskRewardRatio: Math.round((maxProfit / maxLoss) * 10) / 10,
    probabilityOfProfit: Math.round(probabilityOfProfit * 100),
    spreadWidth,
    netDebit: null,
    netCredit: Math.round(netCredit * 100) / 100,
  };
}

/**
 * Format spread for display
 */
export function formatSpreadDisplay(spread: VerticalSpread): string[] {
  const lines: string[] = [];
  const expDate = spread.expiration.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (spread.type === 'call_debit') {
    lines.push(
      `${spread.strategy}: Buy $${spread.longLeg.strike}C / ` +
        `Sell $${spread.shortLeg.strike}C (${expDate})`
    );
    lines.push(
      `  Cost: $${spread.netDebit?.toFixed(2)} per contract ` +
        `($${((spread.netDebit ?? 0) * 100).toFixed(0)} total)`
    );
  } else if (spread.type === 'put_credit') {
    lines.push(
      `${spread.strategy}: Sell $${spread.shortLeg.strike}P / ` +
        `Buy $${spread.longLeg.strike}P (${expDate})`
    );
    lines.push(
      `  Credit: $${spread.netCredit?.toFixed(2)} per contract ` +
        `($${((spread.netCredit ?? 0) * 100).toFixed(0)} total)`
    );
  }

  lines.push(
    `  Max Profit: $${(spread.maxProfit * 100).toFixed(0)} | ` +
      `Max Loss: $${(spread.maxLoss * 100).toFixed(0)} | ` +
      `R/R: 1:${spread.riskRewardRatio}`
  );
  lines.push(
    `  Breakeven: $${spread.breakeven.toFixed(2)} | ` +
      `~${spread.probabilityOfProfit}% PoP | ` +
      `${spread.daysToExpiry} DTE`
  );

  return lines;
}

/**
 * Generate spread recommendation based on analysis
 */
export function generateSpreadRecommendation(
  currentPrice: number,
  support1: number | undefined,
  support2: number | undefined,
  resistance1: number | undefined,
  analystTarget: number | undefined,
  verdict: 'buy' | 'watch' | 'avoid',
  daysToEarnings?: number
): {
  callSpread: {
    longStrike: number;
    shortStrike: number;
    targetDTE: number;
  } | null;
  putSpread: {
    shortStrike: number;
    longStrike: number;
    targetDTE: number;
  } | null;
  notes: string[];
} {
  const notes: string[] = [];

  // Determine optimal DTE
  let targetDTE = 30; // Default 30 days
  if (daysToEarnings && daysToEarnings > 7 && daysToEarnings < 45) {
    // Avoid earnings - either expire before or after
    if (daysToEarnings < 21) {
      targetDTE = daysToEarnings - 3; // Expire before earnings
      notes.push('⚠️ Expiring before earnings to avoid IV crush');
    } else {
      targetDTE = daysToEarnings + 7; // Expire after earnings
      notes.push('📅 Expiring after earnings for potential move');
    }
  }

  // Calculate spread strikes
  const target = resistance1 ?? analystTarget ?? currentPrice * 1.15;
  const protection = support2 ?? support1 ?? currentPrice * 0.9;

  // Round to nearest $5 for cleaner strikes (for stocks > $50)
  const roundStrike = (price: number): number => {
    if (currentPrice > 100) return Math.round(price / 5) * 5;
    if (currentPrice > 50) return Math.round(price / 2.5) * 2.5;
    return Math.round(price);
  };

  let callSpread = null;
  let putSpread = null;

  if (verdict === 'buy') {
    // Bull Call Spread: Buy near current, sell at target
    const callLong = roundStrike(currentPrice * 1.02);
    const callShort = roundStrike(Math.min(target, currentPrice * 1.2));

    if (callShort > callLong) {
      callSpread = {
        longStrike: callLong,
        shortStrike: callShort,
        targetDTE,
      };
    }

    // Bull Put Spread: Sell above support, buy at support
    const putShort = roundStrike(support1 ?? currentPrice * 0.95);
    const putLong = roundStrike(protection);

    if (putShort > putLong) {
      putSpread = {
        shortStrike: putShort,
        longStrike: putLong,
        targetDTE,
      };
    }
  }

  return { callSpread, putSpread, notes };
}
