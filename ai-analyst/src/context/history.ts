/**
 * Trade History Service
 * Fetches and analyzes past trades for context
 */

import {
  getTradesByTicker,
  getAllTrades,
  getTickerStats,
} from '../services/supabase.ts';
import {
  buildTickerHistory,
  getPrimaryPattern,
  buildTickerTOONContext,
  toonToString,
} from './toon.ts';
import type {
  Trade,
  TickerHistory,
  TOONContext,
  MarketRegime,
} from '../types/index.ts';

// Default account size - can be overridden
const DEFAULT_ACCOUNT_SIZE = 1500;

/**
 * Get full history analysis for a ticker
 */
export async function getTickerHistory(
  ticker: string
): Promise<TickerHistory | null> {
  const trades = await getTradesByTicker(ticker);

  if (trades.length === 0) {
    return null;
  }

  return buildTickerHistory(ticker, trades);
}

/**
 * Get TOON context for a ticker analysis
 * Used to build AI prompt context
 */
export async function getTickerContextForAI(
  ticker: string,
  marketRegime: MarketRegime,
  accountSize: number = DEFAULT_ACCOUNT_SIZE
): Promise<string | null> {
  const trades = await getTradesByTicker(ticker);

  if (trades.length === 0) {
    return null;
  }

  const pattern = getPrimaryPattern(trades);
  const context = buildTickerTOONContext(
    ticker,
    trades,
    accountSize,
    marketRegime,
    pattern
  );

  return toonToString(context);
}

/**
 * Format ticker history for CLI display
 */
export function formatHistoryForDisplay(history: TickerHistory): string[] {
  const lines: string[] = [];

  // Summary line
  lines.push(
    `${history.totalTrades} trades | ` +
      `${history.winRate.toFixed(0)}% win rate | ` +
      `${history.totalPnl >= 0 ? '+' : ''}$${history.totalPnl.toFixed(0)} total P&L`
  );

  // Last trade
  if (history.lastTrade) {
    const last = history.lastTrade;
    const pnl = last.realizedPnl ?? 0;
    const pnlStr =
      pnl >= 0 ? `+$${pnl.toFixed(0)}` : `-$${Math.abs(pnl).toFixed(0)}`;
    const typeStr = formatTradeType(last.tradeType);
    const dateStr = last.closeDate
      ? last.closeDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : last.openDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });

    lines.push(
      `Last: $${last.longStrike}/${last.shortStrike} ${typeStr} ` +
        `closed ${pnlStr} (${dateStr})`
    );
  }

  // Patterns
  if (history.patterns.length > 0) {
    lines.push(`Pattern: ${history.patterns[0]}`);
  }

  return lines;
}

/**
 * Format trade type for display
 */
function formatTradeType(type: string): string {
  switch (type) {
    case 'call_debit':
      return 'CDS';
    case 'put_credit':
      return 'PCS';
    case 'call_credit':
      return 'CCS';
    case 'put_debit':
      return 'PDS';
    default:
      return type.toUpperCase();
  }
}

/**
 * Get all unique tickers from trade history
 */
export async function getTradedTickers(): Promise<string[]> {
  const trades = await getAllTrades();
  const tickers = new Set(trades.map((t) => t.ticker));
  return Array.from(tickers).sort();
}

/**
 * Get trades grouped by ticker with stats
 */
export async function getTradesByTickerWithStats(): Promise<
  Map<
    string,
    { trades: Trade[]; stats: Awaited<ReturnType<typeof getTickerStats>> }
  >
> {
  const trades = await getAllTrades();
  const result = new Map<
    string,
    { trades: Trade[]; stats: Awaited<ReturnType<typeof getTickerStats>> }
  >();

  // Group trades by ticker
  const byTicker = new Map<string, Trade[]>();
  for (const trade of trades) {
    const existing = byTicker.get(trade.ticker) ?? [];
    existing.push(trade);
    byTicker.set(trade.ticker, existing);
  }

  // Get stats for each ticker
  for (const [ticker, tickerTrades] of byTicker) {
    const stats = await getTickerStats(ticker);
    result.set(ticker, { trades: tickerTrades, stats });
  }

  return result;
}

/**
 * Check if we have history for a ticker
 */
export async function hasHistoryForTicker(ticker: string): Promise<boolean> {
  const trades = await getTradesByTicker(ticker);
  return trades.length > 0;
}

/**
 * Get win rate insights for AI context
 */
export function getWinRateInsight(history: TickerHistory): string {
  if (history.totalTrades < 3) {
    return 'Limited trade history - no clear patterns yet';
  }

  if (history.winRate >= 70) {
    return `Strong track record (${history.winRate.toFixed(0)}% win rate)`;
  } else if (history.winRate >= 50) {
    return `Moderate success (${history.winRate.toFixed(0)}% win rate)`;
  } else {
    return `Challenging history (${history.winRate.toFixed(0)}% win rate) - review patterns`;
  }
}
