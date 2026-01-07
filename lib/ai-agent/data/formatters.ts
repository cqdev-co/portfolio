/**
 * Data Formatters for AI Context
 *
 * Format ticker data into AI-friendly strings.
 * Used by both CLI and Frontend.
 */

import type { TickerData, SearchResult } from './types';

/**
 * Safe toFixed helper - handles undefined/null values
 */
function safeFixed(value: number | undefined | null, digits: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

/**
 * Format ticker data for AI context
 */
export function formatTickerDataForAI(t: TickerData): string {
  const lines: string[] = [];

  lines.push(`\n=== ${t.ticker} DATA ===`);
  lines.push(
    `Price: $${safeFixed(t.price, 2)} ` +
      `(${(t.change ?? 0) >= 0 ? '+' : ''}${safeFixed(t.change, 2)}%)`
  );

  // Technical indicators
  if (t.rsi !== undefined) {
    lines.push(`RSI: ${safeFixed(t.rsi, 1)}`);
  }
  if (t.adx !== undefined) {
    lines.push(`ADX: ${safeFixed(t.adx, 0)} (${t.trendStrength ?? 'UNKNOWN'})`);
  }

  // Moving averages
  if (t.ma20 !== undefined) lines.push(`MA20: $${safeFixed(t.ma20, 2)}`);
  if (t.ma50 !== undefined) lines.push(`MA50: $${safeFixed(t.ma50, 2)}`);
  if (t.ma200 !== undefined) {
    lines.push(
      `MA200: $${safeFixed(t.ma200, 2)} ` +
        `(${t.aboveMA200 ? 'ABOVE ✓' : 'BELOW ✗'})`
    );
  }

  // Fundamentals
  if (t.marketCap !== undefined && t.marketCap > 0) {
    const mcapStr =
      t.marketCap >= 1e12
        ? `$${(t.marketCap / 1e12).toFixed(1)}T`
        : t.marketCap >= 1e9
          ? `$${(t.marketCap / 1e9).toFixed(0)}B`
          : `$${(t.marketCap / 1e6).toFixed(0)}M`;
    lines.push(`Market Cap: ${mcapStr}`);
  }
  if (t.peRatio !== undefined) lines.push(`P/E: ${safeFixed(t.peRatio, 1)}`);
  if (t.forwardPE !== undefined) {
    lines.push(`Forward P/E: ${safeFixed(t.forwardPE, 1)}`);
  }
  if (t.beta !== undefined) lines.push(`Beta: ${safeFixed(t.beta, 2)}`);

  // Sector context
  if (t.sectorContext?.name) {
    lines.push(`Sector: ${t.sectorContext.name}`);
    if (t.sectorContext.vsAvg !== undefined) {
      lines.push(
        `P/E vs Sector: ${t.sectorContext.vsAvg > 0 ? '+' : ''}` +
          `${safeFixed(t.sectorContext.vsAvg, 0)}%`
      );
    }
  }

  // IV Analysis - check all required fields
  if (t.iv?.currentIV !== undefined) {
    const ivLine = `IV: ${safeFixed(t.iv.currentIV, 1)}%`;
    const levelPart = t.iv.ivLevel ? ` (${t.iv.ivLevel})` : '';
    const pctPart =
      t.iv.ivPercentile !== undefined
        ? ` - ${t.iv.ivPercentile}th percentile`
        : '';
    lines.push(ivLine + levelPart + pctPart);

    if (t.iv.hv20 !== undefined) {
      lines.push(`HV20: ${safeFixed(t.iv.hv20, 1)}%`);
    }
    if (t.iv.premium) {
      lines.push(`Options Premium: ${t.iv.premium}`);
    }
  }

  // Spread recommendation - check all required fields
  if (
    t.spread?.longStrike !== undefined &&
    t.spread?.shortStrike !== undefined
  ) {
    const debitStr =
      t.spread.estimatedDebit !== undefined
        ? `Debit: $${safeFixed(t.spread.estimatedDebit, 2)}, `
        : '';
    const cushionStr =
      t.spread.cushion !== undefined
        ? `Cushion: ${safeFixed(t.spread.cushion, 1)}%`
        : '';
    lines.push(
      `Spread: $${t.spread.longStrike}/$${t.spread.shortStrike}, ` +
        debitStr +
        cushionStr
    );
    if (t.spread.pop !== undefined) {
      lines.push(`PoP: ${safeFixed(t.spread.pop, 0)}%`);
    }
  }

  // Support/Resistance
  if (t.support !== undefined || t.resistance !== undefined) {
    const srParts: string[] = [];
    if (t.support !== undefined) srParts.push(`S: $${safeFixed(t.support, 2)}`);
    if (t.resistance !== undefined) {
      srParts.push(`R: $${safeFixed(t.resistance, 2)}`);
    }
    if (srParts.length > 0) {
      lines.push(srParts.join(' · '));
    }
  }

  // Trade grade
  if (t.grade?.grade) {
    lines.push(
      `Grade: ${t.grade.grade} (${t.grade.score ?? '—'}/100) - ` +
        `${t.grade.recommendation ?? 'N/A'}`
    );
  }

  // Earnings
  if (t.earningsDays !== null && t.earningsDays !== undefined) {
    const earningsStr =
      t.earningsDays > 0 ? `in ${t.earningsDays} days` : 'PASSED';
    const warning = t.earningsWarning ? ' ⚠️ CAUTION' : '';
    lines.push(`Earnings: ${earningsStr}${warning}`);
  }

  // Analyst ratings
  if (t.analystRatings?.bullishPercent !== undefined) {
    const r = t.analystRatings;
    lines.push(
      `Analysts: ${r.bullishPercent}% Bullish ` +
        `(${r.strongBuy ?? 0}SB ${r.buy ?? 0}B ${r.hold ?? 0}H ` +
        `${r.sell ?? 0}S ${r.strongSell ?? 0}SS)`
    );
  }

  // Target prices
  if (t.targetPrices?.mean !== undefined) {
    const tp = t.targetPrices;
    const upsideStr =
      tp.upside !== undefined
        ? ` (${tp.upside > 0 ? '+' : ''}${safeFixed(tp.upside, 1)}%)`
        : '';
    lines.push(
      `Target: $${safeFixed(tp.low, 0)}-$${safeFixed(tp.mean, 0)}-` +
        `$${safeFixed(tp.high, 0)}${upsideStr}`
    );
  }

  // Performance
  if (t.performance) {
    const p = t.performance;
    const parts: string[] = [];
    if (p.day5 !== undefined) {
      parts.push(`5d: ${p.day5 > 0 ? '+' : ''}${safeFixed(p.day5, 1)}%`);
    }
    if (p.month1 !== undefined) {
      parts.push(`1m: ${p.month1 > 0 ? '+' : ''}${safeFixed(p.month1, 1)}%`);
    }
    if (p.ytd !== undefined) {
      parts.push(`YTD: ${p.ytd > 0 ? '+' : ''}${safeFixed(p.ytd, 1)}%`);
    }
    if (parts.length > 0) {
      lines.push(`Perf: ${parts.join(' · ')}`);
    }
  }

  // Short interest
  if (t.shortInterest?.shortPct !== undefined) {
    const ratioStr =
      t.shortInterest.shortRatio !== undefined
        ? ` (${safeFixed(t.shortInterest.shortRatio, 1)} days to cover)`
        : '';
    lines.push(
      `Short Interest: ${safeFixed(t.shortInterest.shortPct, 1)}%${ratioStr}`
    );
  }

  // News
  if (t.news && t.news.length > 0) {
    lines.push('Recent News:');
    for (const n of t.news.slice(0, 3)) {
      lines.push(`  • ${n.title}`);
    }
  }

  // Data quality warning
  if (t.dataQuality?.isStale && t.dataQuality?.warning) {
    lines.push(`⚠️ ${t.dataQuality.warning}`);
  }

  return lines.join('\n');
}

/**
 * Format search results for AI context
 */
export function formatSearchResultsForAI(results: SearchResult[]): string {
  if (!results || results.length === 0) {
    return 'No search results found.';
  }

  const lines: string[] = ['Search Results:'];

  for (const r of results.slice(0, 5)) {
    lines.push(`\n• ${r.title || 'Untitled'}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
    if (r.url) lines.push(`  Source: ${r.url}`);
  }

  return lines.join('\n');
}

/**
 * Format a simple ticker summary (one line)
 */
export function formatTickerSummary(t: TickerData): string {
  const parts: string[] = [
    t.ticker,
    `$${safeFixed(t.price, 2)}`,
    `${(t.changePct ?? 0) >= 0 ? '+' : ''}${safeFixed(t.changePct, 1)}%`,
  ];

  if (t.rsi !== undefined) parts.push(`RSI ${safeFixed(t.rsi, 0)}`);
  if (t.aboveMA200 !== undefined) {
    parts.push(t.aboveMA200 ? '↑MA200' : '↓MA200');
  }
  if (t.grade?.grade) parts.push(`Grade: ${t.grade.grade}`);

  return parts.join(' · ');
}
