'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/**
 * Common stop-words that match `\b[A-Z]{2,5}\b` but should never be
 * rendered as ticker chips. Kept short and curated; the chip
 * highlighter is conservative — it leans on a known list rather than
 * trying to guess.
 */
const TICKER_DENY = new Set<string>([
  'A',
  'I',
  'AM',
  'PM',
  'AI',
  'API',
  'CEO',
  'CFO',
  'COO',
  'IPO',
  'GDP',
  'CPI',
  'PPI',
  'FED',
  'FOMC',
  'ETF',
  'YOY',
  'YTD',
  'MOM',
  'EOD',
  'TLDR',
  'DCF',
  'PE',
  'EPS',
  'OK',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'NYC',
  'USA',
  'EU',
  'UK',
  'TV',
  'PR',
  'HQ',
  'IT',
  'OR',
  'AND',
  'THE',
  'FOR',
  'BUT',
  'NOT',
  'ALL',
  'ANY',
  'NEW',
  'TOP',
  'OLD',
  'BIG',
  'LOW',
  'HIGH',
  'MID',
  'IV',
  'RSI',
  'MA',
  'SMA',
  'EMA',
  'BUY',
  'SELL',
  'HOLD',
  'GO',
  'NO',
  'GO',
]);

const TICKER_ALLOW = new Set<string>([
  'AAPL',
  'MSFT',
  'NVDA',
  'GOOG',
  'GOOGL',
  'META',
  'AMZN',
  'TSLA',
  'AVGO',
  'AMD',
  'NFLX',
  'INTC',
  'ORCL',
  'CRM',
  'ADBE',
  'QCOM',
  'CSCO',
  'IBM',
  'PYPL',
  'SHOP',
  'UBER',
  'LYFT',
  'COIN',
  'PLTR',
  'SNOW',
  'DDOG',
  'NET',
  'CRWD',
  'PANW',
  'ZS',
  'OKTA',
  'MDB',
  'TEAM',
  'ZM',
  'DOCU',
  'JPM',
  'BAC',
  'WFC',
  'GS',
  'MS',
  'C',
  'V',
  'MA',
  'AXP',
  'SCHW',
  'BLK',
  'COF',
  'XOM',
  'CVX',
  'COP',
  'OXY',
  'SLB',
  'WMT',
  'TGT',
  'COST',
  'HD',
  'LOW',
  'NKE',
  'MCD',
  'SBUX',
  'KO',
  'PEP',
  'PG',
  'JNJ',
  'PFE',
  'MRNA',
  'LLY',
  'UNH',
  'BA',
  'CAT',
  'GE',
  'HON',
  'LMT',
  'RTX',
  'F',
  'GM',
  'DIS',
  'CMCSA',
  'T',
  'VZ',
  'TMUS',
  'SPY',
  'QQQ',
  'IWM',
  'DIA',
  'VOO',
  'VTI',
  'VXX',
  'UVXY',
  'TLT',
  'GLD',
  'SLV',
]);

const TICKER_REGEX = /\b[A-Z]{1,5}(?:\.[A-Z]{1,2})?\b/g;

/**
 * Renders an inline pill tag for a ticker symbol — the small chip
 * that appears next to bolded company names in the inspiration UI.
 */
export function TickerChip({ symbol }: { symbol: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center align-baseline',
        'mx-0.5 rounded px-1.5 py-px',
        'text-[10px] font-mono font-semibold tracking-wide',
        'bg-muted/70 text-foreground/80',
        'border border-border/40'
      )}
    >
      {symbol}
    </span>
  );
}

/**
 * Splits a string into text + ticker-chip segments. A token is
 * promoted to a chip only when it appears in the curated allow-list.
 * This keeps the chips intentional — we'd rather miss a chip than
 * mis-format a normal capitalised acronym.
 */
export function renderTickerInline(
  text: string,
  keyPrefix: string
): React.ReactNode {
  if (!text) return text;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  for (const match of text.matchAll(TICKER_REGEX)) {
    const symbol = match[0];
    const start = match.index ?? 0;

    if (
      TICKER_DENY.has(symbol) ||
      !TICKER_ALLOW.has(symbol) ||
      symbol.length < 2
    ) {
      continue;
    }

    if (start > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${i}`}>
          {text.slice(lastIndex, start)}
        </Fragment>
      );
    }
    nodes.push(<TickerChip key={`${keyPrefix}-c-${i}`} symbol={symbol} />);
    lastIndex = start + symbol.length;
    i += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t-end`}>{text.slice(lastIndex)}</Fragment>
    );
  }

  return nodes.length > 0 ? nodes : text;
}
