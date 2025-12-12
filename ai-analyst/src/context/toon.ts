/**
 * TOON (Token Optimized Object Notation) Context Builder
 * Compresses trade history and live market data into minimal tokens
 * 
 * Trade History Abbreviations:
 * - t = ticker, ty = trade type, d = direction, ls/ss = strikes
 * - o = outcome, pnl = P&L, dh = days held, rsi = entry RSI
 * - n = count, wr = win rate, h = history, p = pattern
 * - acct = account size, mkt = market regime
 * 
 * Ticker Data Format (pipe-delimited):
 * TICKER|PRICE|CHANGE|RSI|MA:20/50/200|TREND|IV+LVL|S+R|SPREAD|CUSHION|GRADE|RISK
 * 
 * Example:
 * NVDA|185.55|+1.7%|RSI51|MA:184/187/155|↑MA200|IV40E|S184R187|165/170@4.02|8.6%|B+|R3
 * 
 * IV Levels: L=LOW, N=NORMAL, E=ELEVATED, H=HIGH
 * Trend: ↑MA200 = above, ↓MA200 = below
 */

import type { 
  Trade, 
  TradeType, 
  TradeOutcome,
  MarketRegime,
  TOONTrade, 
  TOONTickerContext, 
  TOONContext,
  TickerHistory 
} from "../types/index.ts";

// ============================================================================
// TICKER DATA TYPES (for live market data encoding)
// ============================================================================

export interface TickerDataInput {
  ticker: string;
  price: number;
  changePct: number;
  rsi?: number;
  adx?: number;
  trendStrength?: 'WEAK' | 'MODERATE' | 'STRONG';
  ma20?: number;
  ma50?: number;
  ma200?: number;
  aboveMA200?: boolean;
  iv?: number;
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  nearestSupport?: number;
  nearestResistance?: number;
  spreadLong?: number;
  spreadShort?: number;
  spreadDebit?: number;
  cushion?: number;
  grade?: string;
  riskScore?: number;
  earningsDays?: number | null;
  marketCap?: number;
  peRatio?: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  tickers?: string[];
  recommendation?: string;
}

// ============================================================================
// TYPE ABBREVIATION MAPS
// ============================================================================

const TRADE_TYPE_MAP: Record<TradeType, string> = {
  call_debit: "cd",
  put_credit: "pc",
  call_credit: "cc",
  put_debit: "pd",
};

const OUTCOME_MAP: Record<TradeOutcome, string> = {
  win: "w",
  loss: "l",
  breakeven: "be",
  max_profit: "mp",
  max_loss: "ml",
};

const REGIME_MAP: Record<MarketRegime, string> = {
  bull: "b",
  neutral: "n",
  bear: "br",
};

// ============================================================================
// COMPRESSION FUNCTIONS
// ============================================================================

/**
 * Compress a single trade to TOON format
 */
export function compressTrade(trade: Trade): TOONTrade {
  const toon: TOONTrade = {
    ty: TRADE_TYPE_MAP[trade.tradeType],
    d: trade.direction === "bullish" ? "b" : "br",
    ls: trade.longStrike,
    ss: trade.shortStrike,
    o: trade.outcome ? OUTCOME_MAP[trade.outcome] : "?",
    pnl: Math.round(trade.realizedPnl ?? 0),
  };

  // Only include optional fields if they have value
  if (trade.daysHeld !== undefined) {
    toon.dh = trade.daysHeld;
  }
  if (trade.entryRsi !== undefined) {
    toon.rsi = Math.round(trade.entryRsi);
  }

  return toon;
}

/**
 * Compress ticker history to TOON format
 */
export function compressTickerHistory(
  ticker: string,
  trades: Trade[],
  pattern?: string
): TOONTickerContext {
  const closedTrades = trades.filter(t => t.status !== "open");
  const wins = closedTrades.filter(
    t => t.outcome === "win" || t.outcome === "max_profit"
  ).length;
  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl ?? 0), 
    0
  );
  const winRate = closedTrades.length > 0 
    ? Math.round((wins / closedTrades.length) * 100) 
    : 0;

  // Only include last 5 trades in history to save tokens
  const recentTrades = trades.slice(0, 5).map(compressTrade);

  const toon: TOONTickerContext = {
    t: ticker.toUpperCase(),
    n: trades.length,
    wr: winRate,
    pnl: Math.round(totalPnl),
    h: recentTrades,
  };

  if (pattern) {
    toon.p = pattern;
  }

  return toon;
}

/**
 * Build full TOON context for AI
 */
export function buildTOONContext(
  accountSize: number,
  tickerHistories: Map<string, Trade[]>,
  marketRegime: MarketRegime,
  patterns: Map<string, string> = new Map()
): TOONContext {
  const tickers: TOONTickerContext[] = [];

  for (const [ticker, trades] of tickerHistories) {
    if (trades.length > 0) {
      tickers.push(
        compressTickerHistory(ticker, trades, patterns.get(ticker))
      );
    }
  }

  // Sort by number of trades descending (most traded first)
  tickers.sort((a, b) => b.n - a.n);

  // Limit to top 10 tickers to save tokens
  const limitedTickers = tickers.slice(0, 10);

  return {
    acct: accountSize,
    tickers: limitedTickers,
    mkt: REGIME_MAP[marketRegime],
  };
}

/**
 * Build TOON context for a single ticker analysis
 */
export function buildTickerTOONContext(
  ticker: string,
  trades: Trade[],
  accountSize: number,
  marketRegime: MarketRegime,
  pattern?: string
): TOONContext {
  const tickerContext = compressTickerHistory(ticker, trades, pattern);

  return {
    acct: accountSize,
    tickers: [tickerContext],
    mkt: REGIME_MAP[marketRegime],
  };
}

/**
 * Convert TOON context to JSON string for AI prompt
 */
export function toonToString(context: TOONContext): string {
  return JSON.stringify(context);
}

// ============================================================================
// TICKER DATA TOON ENCODING (Live Market Data)
// ============================================================================

const IV_LEVEL_MAP: Record<string, string> = {
  LOW: 'L',
  NORMAL: 'N',
  ELEVATED: 'E',
  HIGH: 'H',
};

/**
 * Encode live ticker data to TOON format
 * Reduces ~800 tokens to ~50 tokens per ticker
 * 
 * Format: TICKER|PRICE|CHANGE|RSI|ADX|MA:20/50/200|TREND|IV|S/R|SPREAD|CUSH|GRADE|RISK|EARN
 */
export function encodeTickerToTOON(data: TickerDataInput): string {
  const parts: string[] = [];
  
  // Ticker and price (required)
  parts.push(data.ticker.toUpperCase());
  parts.push(data.price.toFixed(2));
  
  // Change percent
  const sign = data.changePct >= 0 ? '+' : '';
  parts.push(`${sign}${data.changePct.toFixed(1)}%`);
  
  // RSI
  parts.push(data.rsi ? `RSI${Math.round(data.rsi)}` : '-');
  
  // ADX with trend strength (ADX25M = ADX 25, Moderate trend)
  if (data.adx && data.trendStrength) {
    const trendCode = data.trendStrength === 'STRONG' ? 'S' 
      : data.trendStrength === 'MODERATE' ? 'M' : 'W';
    parts.push(`ADX${Math.round(data.adx)}${trendCode}`);
  } else {
    parts.push('-');
  }
  
  // Moving averages (compact: MA:20/50/200)
  if (data.ma20 || data.ma50 || data.ma200) {
    const ma20 = data.ma20 ? Math.round(data.ma20) : '-';
    const ma50 = data.ma50 ? Math.round(data.ma50) : '-';
    const ma200 = data.ma200 ? Math.round(data.ma200) : '-';
    parts.push(`MA:${ma20}/${ma50}/${ma200}`);
  } else {
    parts.push('-');
  }
  
  // Trend indicator (↑MA200 or ↓MA200)
  if (data.aboveMA200 !== undefined) {
    parts.push(data.aboveMA200 ? '↑MA200' : '↓MA200');
  } else {
    parts.push('-');
  }
  
  // IV with level (e.g., IV40E = 40% elevated)
  if (data.iv && data.ivLevel) {
    parts.push(`IV${Math.round(data.iv)}${IV_LEVEL_MAP[data.ivLevel] || ''}`);
  } else {
    parts.push('-');
  }
  
  // Support/Resistance (S180R190)
  if (data.nearestSupport || data.nearestResistance) {
    const s = data.nearestSupport ? `S${Math.round(data.nearestSupport)}` : '';
    const r = data.nearestResistance ? `R${Math.round(data.nearestResistance)}` : '';
    parts.push(`${s}${r}` || '-');
  } else {
    parts.push('-');
  }
  
  // Spread (165/170@4.02)
  if (data.spreadLong && data.spreadShort && data.spreadDebit) {
    parts.push(
      `${data.spreadLong}/${data.spreadShort}@${data.spreadDebit.toFixed(2)}`
    );
  } else {
    parts.push('-');
  }
  
  // Cushion
  parts.push(data.cushion ? `${data.cushion.toFixed(1)}%` : '-');
  
  // Grade
  parts.push(data.grade || '-');
  
  // Risk score
  parts.push(data.riskScore ? `R${data.riskScore}` : '-');
  
  // Earnings days (E14 = 14 days until earnings, E- = no data)
  if (data.earningsDays !== undefined && data.earningsDays !== null) {
    parts.push(`E${data.earningsDays}`);
  } else {
    parts.push('E-');
  }
  
  // Fundamentals: Market Cap (MC1.5T or MC360B) and P/E (PE116)
  if (data.marketCap) {
    const mcStr = data.marketCap >= 1e12 
      ? `MC${(data.marketCap / 1e12).toFixed(1)}T`
      : `MC${Math.round(data.marketCap / 1e9)}B`;
    parts.push(mcStr);
  } else {
    parts.push('-');
  }
  
  if (data.peRatio) {
    parts.push(`PE${data.peRatio.toFixed(0)}`);
  } else {
    parts.push('-');
  }
  
  return parts.join('|');
}

/**
 * Encode multiple tickers to TOON format
 */
export function encodeTickersToTOON(tickers: TickerDataInput[]): string {
  return tickers.map(encodeTickerToTOON).join('\n');
}

/**
 * Get the TOON decoder specification for the system prompt
 * This teaches the AI how to read TOON-encoded data
 */
export function getTOONDecoderSpec(): string {
  return `## TOON Data Format
Ticker data uses pipe-delimited TOON format:
TICKER|PRICE|CHG|RSI|ADX|MA|TREND|IV|S/R|SPREAD|CUSH|GRADE|RISK|EARN|MCAP|PE

Key:
- RSI51 = RSI at 51
- ADX25M = ADX 25, M=Moderate (W=Weak<20, M=Moderate 20-40, S=Strong>40)
- MA:184/187/155 = MA20/MA50/MA200 prices
- ↑MA200/↓MA200 = price above/below 200-day MA
- IV40E = 40% IV, E=Elevated (L=Low, N=Normal, H=High)
- S180R190 = Support $180, Resistance $190
- 165/170@4.02 = Buy $165/Sell $170 spread, $4.02 debit
- R3 = Risk score 3/10
- E14 = 14 days until earnings (E- = no earnings data)
- MC1.5T = Market Cap $1.5 Trillion (MC360B = $360 Billion)
- PE116 = P/E Ratio 116

IMPORTANT: ADX tells you trend STRENGTH:
- ADX <20 (W): WEAK trend, stick to RSI 35-55 strictly
- ADX 20-40 (M): MODERATE trend, RSI up to 60 okay
- ADX >40 (S): STRONG trend, RSI up to 65 acceptable

Example: NVDA|185.55|+1.7%|RSI51|ADX32M|MA:184/187/155|↑MA200|IV40E|S180R190|165/170@4.02|8.6%|B+|R3|E45|MC1.5T|PE55`;
}

// ============================================================================
// CONVERSATION SUMMARIZATION
// ============================================================================

/**
 * Extract key information from a message for summarization
 */
function extractMessageKeyInfo(msg: ConversationMessage): {
  tickers: string[];
  action?: string;
} {
  const content = msg.content.toUpperCase();
  
  // Extract tickers (2-5 uppercase letters that look like symbols)
  const tickerMatches = content.match(/\b[A-Z]{2,5}\b/g) || [];
  const commonWords = new Set([
    'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'HAS', 'HAD',
    'RSI', 'ITM', 'OTM', 'ATM', 'DTE', 'BUY', 'SELL', 'WAIT', 'PASS',
    'FOMC', 'CPI', 'GDP', 'FED', 'MAX', 'MIN', 'LOW', 'HIGH',
  ]);
  const tickers = [...new Set(
    tickerMatches.filter(t => !commonWords.has(t))
  )];
  
  // Extract action/recommendation
  let action: string | undefined;
  if (/\b(BUY|ENTER|LONG)\b/.test(content)) action = 'BUY';
  else if (/\b(SELL|EXIT|CLOSE)\b/.test(content)) action = 'SELL';
  else if (/\b(WAIT|HOLD)\b/.test(content)) action = 'WAIT';
  else if (/\b(AVOID|PASS)\b/.test(content)) action = 'AVOID';
  
  return { tickers, action };
}

/**
 * Summarize conversation history to reduce tokens
 * Converts full messages to compact summaries
 * 
 * Before: 100+ tokens per message
 * After: ~20 tokens per summary
 */
export function summarizeConversation(
  history: ConversationMessage[],
  maxTurns: number = 5
): string {
  if (history.length === 0) return '';
  
  const summaries: string[] = [];
  
  // Process messages in pairs (user + assistant)
  for (let i = 0; i < history.length && summaries.length < maxTurns; i += 2) {
    const userMsg = history[i];
    const assistantMsg = history[i + 1];
    
    if (!userMsg) continue;
    
    const userInfo = extractMessageKeyInfo(userMsg);
    const tickerStr = userInfo.tickers.length > 0 
      ? userInfo.tickers.slice(0, 2).join(',') 
      : 'general';
    
    let summary = `[U:${tickerStr}`;
    
    if (assistantMsg) {
      const assistantInfo = extractMessageKeyInfo(assistantMsg);
      if (assistantInfo.action) {
        summary += `→V:${assistantInfo.action}`;
      }
    }
    
    summary += ']';
    summaries.push(summary);
  }
  
  return summaries.length > 0 
    ? `Prior: ${summaries.join(' ')}` 
    : '';
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

/**
 * Detect patterns in trade history
 * Returns human-readable pattern strings
 */
export function detectPatterns(trades: Trade[]): string[] {
  const patterns: string[] = [];
  const closedTrades = trades.filter(t => t.status !== "open");
  
  if (closedTrades.length < 3) {
    return patterns;
  }

  // Pattern 1: RSI at entry correlation
  const tradesWithRsi = closedTrades.filter(t => t.entryRsi !== undefined);
  if (tradesWithRsi.length >= 3) {
    const winningRsis = tradesWithRsi
      .filter(t => t.outcome === "win" || t.outcome === "max_profit")
      .map(t => t.entryRsi!);
    const losingRsis = tradesWithRsi
      .filter(t => t.outcome === "loss" || t.outcome === "max_loss")
      .map(t => t.entryRsi!);

    if (winningRsis.length > 0 && losingRsis.length > 0) {
      const avgWinRsi = winningRsis.reduce((a, b) => a + b, 0) / winningRsis.length;
      const avgLossRsi = losingRsis.reduce((a, b) => a + b, 0) / losingRsis.length;

      if (avgLossRsi > avgWinRsi + 10) {
        patterns.push(`Losses tend to occur at RSI > ${Math.round(avgLossRsi)}`);
      }
      if (avgWinRsi < 50 && avgLossRsi > 55) {
        patterns.push(`Better entries at RSI < 50`);
      }
    }
  }

  // Pattern 2: Days held correlation
  const tradesWithDays = closedTrades.filter(t => t.daysHeld !== undefined);
  if (tradesWithDays.length >= 3) {
    const winningDays = tradesWithDays
      .filter(t => t.outcome === "win" || t.outcome === "max_profit")
      .map(t => t.daysHeld!);
    const losingDays = tradesWithDays
      .filter(t => t.outcome === "loss" || t.outcome === "max_loss")
      .map(t => t.daysHeld!);

    if (winningDays.length > 0) {
      const avgWinDays = winningDays.reduce((a, b) => a + b, 0) / winningDays.length;
      if (avgWinDays < 7) {
        patterns.push(`Winning trades held avg ${Math.round(avgWinDays)} days`);
      }
    }

    if (losingDays.length > 0) {
      const avgLossDays = losingDays.reduce((a, b) => a + b, 0) / losingDays.length;
      if (avgLossDays > 14) {
        patterns.push(`Consider cutting losses earlier (avg loss held ${Math.round(avgLossDays)} days)`);
      }
    }
  }

  // Pattern 3: Strategy type success
  const byType = new Map<string, { wins: number; total: number }>();
  for (const trade of closedTrades) {
    const existing = byType.get(trade.tradeType) ?? { wins: 0, total: 0 };
    existing.total++;
    if (trade.outcome === "win" || trade.outcome === "max_profit") {
      existing.wins++;
    }
    byType.set(trade.tradeType, existing);
  }

  for (const [type, stats] of byType) {
    if (stats.total >= 3) {
      const winRate = (stats.wins / stats.total) * 100;
      const typeName = type === "call_debit" ? "Call Debit Spreads" 
        : type === "put_credit" ? "Put Credit Spreads"
        : type;
      if (winRate >= 70) {
        patterns.push(`${Math.round(winRate)}% win rate on ${typeName}`);
      } else if (winRate < 40) {
        patterns.push(`Low win rate on ${typeName} (${Math.round(winRate)}%)`);
      }
    }
  }

  return patterns;
}

/**
 * Get the primary pattern for a ticker (most important one)
 */
export function getPrimaryPattern(trades: Trade[]): string | undefined {
  const patterns = detectPatterns(trades);
  return patterns[0];
}

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

/**
 * Build full ticker history analysis from trades
 */
export function buildTickerHistory(
  ticker: string,
  trades: Trade[]
): TickerHistory {
  const closedTrades = trades.filter(t => t.status !== "open");
  const wins = closedTrades.filter(
    t => t.outcome === "win" || t.outcome === "max_profit"
  ).length;
  const losses = closedTrades.filter(
    t => t.outcome === "loss" || t.outcome === "max_loss"
  ).length;
  
  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl ?? 0), 
    0
  );
  const avgPnl = closedTrades.length > 0 
    ? totalPnl / closedTrades.length 
    : 0;

  const daysHeld = closedTrades
    .filter(t => t.daysHeld !== undefined)
    .map(t => t.daysHeld!);
  const avgDaysHeld = daysHeld.length > 0 
    ? daysHeld.reduce((a, b) => a + b, 0) / daysHeld.length 
    : 0;

  return {
    ticker: ticker.toUpperCase(),
    totalTrades: trades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 
      ? (wins / closedTrades.length) * 100 
      : 0,
    totalPnl,
    avgPnl,
    avgDaysHeld,
    lastTrade: trades[0],
    patterns: detectPatterns(trades),
    recentTrades: trades.slice(0, 5),
  };
}

