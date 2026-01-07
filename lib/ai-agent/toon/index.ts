/**
 * TOON (Token-Oriented Object Notation) Encoder
 *
 * Shared TOON encoding for both CLI and Frontend.
 * Uses @toon-format/toon for proper encoding.
 *
 * Benefits (from benchmarks):
 * - ~40% fewer tokens than JSON
 * - Better LLM accuracy (74% vs 70%)
 * - YAML-like, self-documenting format
 * - Perfect for uniform arrays (ticker data, market data)
 *
 * @see https://toonformat.dev/
 */

import { encode } from '@toon-format/toon';
import type { TickerData } from '../data/types';
import type { MarketRegime } from '../market';

// ============================================================================
// TOON DECODER SPEC (for system prompts)
// ============================================================================

/**
 * Get TOON format explanation for system prompts
 * Minimal since TOON is self-documenting
 */
export function getTOONDecoderSpec(): string {
  return `## Data Format
Data is in TOON format (YAML-like, self-documenting).
- Arrays use [N]{fields}: header followed by comma-separated rows
- Nested objects use indentation
- Parse naturally - no special decoding needed`;
}

// ============================================================================
// TICKER DATA TOON ENCODING
// ============================================================================

/**
 * Encode ticker data to TOON format
 * Produces compact, token-efficient output
 */
export function encodeTickerToTOON(data: TickerData): string {
  const tickerData: Record<string, unknown> = {
    ticker: data.ticker.toUpperCase(),
    price: Number(data.price.toFixed(2)),
    change: `${(data.changePct ?? 0) >= 0 ? '+' : ''}${(
      data.changePct ?? 0
    ).toFixed(1)}%`,
  };

  // Technicals
  if (data.rsi !== undefined) tickerData.rsi = Math.round(data.rsi);
  if (data.adx !== undefined && data.trendStrength) {
    tickerData.adx = Math.round(data.adx);
    tickerData.trend = data.trendStrength.toLowerCase();
  }

  // Moving averages (compact)
  const mas: Record<string, number> = {};
  if (data.ma20 !== undefined) mas.ma20 = Math.round(data.ma20);
  if (data.ma50 !== undefined) mas.ma50 = Math.round(data.ma50);
  if (data.ma200 !== undefined) mas.ma200 = Math.round(data.ma200);
  if (Object.keys(mas).length > 0) {
    tickerData.mas = mas;
    tickerData.aboveMA200 = data.aboveMA200 ?? false;
  }

  // Volatility (IV vs HV)
  if (data.iv?.currentIV !== undefined || data.hv20 !== undefined) {
    const iv = data.iv?.currentIV ? Math.round(data.iv.currentIV) : null;
    const hv = data.hv20 ? Math.round(data.hv20) : null;

    tickerData.vol = {
      iv: iv ? `${iv}%` : null,
      hv20: hv ? `${hv}%` : null,
      premium: data.iv?.premium ?? null,
    };
  }

  // Support/Resistance (compact)
  if (data.support !== undefined || data.resistance !== undefined) {
    tickerData.levels = {
      support: data.support ? Math.round(data.support) : null,
      resistance: data.resistance ? Math.round(data.resistance) : null,
    };
  }

  // Spread recommendation (compact)
  if (data.spread?.longStrike !== undefined) {
    tickerData.spread = {
      long: data.spread.longStrike,
      short: data.spread.shortStrike,
      debit: data.spread.estimatedDebit
        ? Number(data.spread.estimatedDebit.toFixed(2))
        : null,
      cushion: data.spread.cushion
        ? `${data.spread.cushion.toFixed(1)}%`
        : null,
      pop: data.spread.pop ? `${Math.round(data.spread.pop)}%` : null,
    };
  } else if (data.noSpreadReason) {
    // Explicitly tell the AI when no viable spread exists
    tickerData.spread = 'NONE_VIABLE';
    tickerData.spreadNote = data.noSpreadReason;
  }

  // Trade grade
  if (data.grade?.grade) {
    tickerData.grade = data.grade.grade;
    tickerData.score = data.grade.score ?? null;
  }

  // Earnings
  if (data.earningsDays !== undefined && data.earningsDays !== null) {
    tickerData.earnings =
      data.earningsDays > 0 ? `${data.earningsDays}d` : 'passed';
  }

  // Fundamentals (compact)
  if (data.marketCap !== undefined && data.marketCap > 0) {
    tickerData.mcap =
      data.marketCap >= 1e12
        ? `${(data.marketCap / 1e12).toFixed(1)}T`
        : data.marketCap >= 1e9
          ? `${Math.round(data.marketCap / 1e9)}B`
          : `${Math.round(data.marketCap / 1e6)}M`;
  }
  if (data.peRatio !== undefined) tickerData.pe = Math.round(data.peRatio);

  // Analyst ratings (compact)
  if (data.analystRatings?.bullishPercent !== undefined) {
    tickerData.analysts = {
      bullish: `${data.analystRatings.bullishPercent}%`,
      sb: data.analystRatings.strongBuy ?? 0,
      b: data.analystRatings.buy ?? 0,
      h: data.analystRatings.hold ?? 0,
      s: data.analystRatings.sell ?? 0,
    };
  }

  // Target prices (compact)
  if (data.targetPrices?.mean !== undefined) {
    tickerData.targets = {
      low: `$${Math.round(data.targetPrices.low ?? 0)}`,
      mean: `$${Math.round(data.targetPrices.mean)}`,
      high: `$${Math.round(data.targetPrices.high ?? 0)}`,
      upside:
        data.targetPrices.upside !== undefined
          ? `${data.targetPrices.upside > 0 ? '+' : ''}${data.targetPrices.upside.toFixed(
              0
            )}%`
          : null,
    };
  }

  // Performance (compact)
  if (data.performance) {
    const perf: Record<string, string | null> = {};
    if (data.performance.day5 !== undefined) {
      perf.d5 = `${data.performance.day5 > 0 ? '+' : ''}${data.performance.day5.toFixed(
        1
      )}%`;
    }
    if (data.performance.month1 !== undefined) {
      perf.m1 = `${data.performance.month1 > 0 ? '+' : ''}${data.performance.month1.toFixed(
        1
      )}%`;
    }
    if (data.performance.ytd !== undefined) {
      perf.ytd = `${data.performance.ytd > 0 ? '+' : ''}${data.performance.ytd.toFixed(
        1
      )}%`;
    }
    if (Object.keys(perf).length > 0) {
      tickerData.perf = perf;
    }
  }

  // Short interest (compact)
  if (
    data.shortInterest?.shortPct !== undefined &&
    data.shortInterest.shortPct > 0
  ) {
    tickerData.shorts = {
      pct: `${data.shortInterest.shortPct.toFixed(1)}%`,
      days: data.shortInterest.shortRatio?.toFixed(1) ?? null,
    };
  }

  // Options flow (NEW - put/call ratio)
  if (data.optionsFlow) {
    tickerData.flow = {
      pcOI: data.optionsFlow.pcRatioOI,
      pcVol: data.optionsFlow.pcRatioVol,
      sentiment: data.optionsFlow.sentiment,
    };
  }

  // Relative strength vs SPY (NEW)
  if (data.relativeStrength) {
    tickerData.rs = {
      vsSPY: `${data.relativeStrength.vsSPY > 0 ? '+' : ''}${
        data.relativeStrength.vsSPY
      }%`,
      trend: data.relativeStrength.trend,
    };
  }

  // Earnings history (NEW - beat/miss streak)
  if (data.earnings) {
    tickerData.earningsHist = {
      date: data.earnings.date ?? null,
      days: data.earnings.daysUntil ?? null,
      streak: data.earnings.streak ?? null, // +4 = 4 beats, -2 = 2 misses
      lastSurprise: data.earnings.lastSurprise
        ? `${data.earnings.lastSurprise > 0 ? '+' : ''}${
            data.earnings.lastSurprise
          }%`
        : null,
    };
  }

  // Sector P/E comparison (NEW)
  if (data.sectorContext?.vsAvg !== undefined) {
    tickerData.sector = {
      name: data.sectorContext.name,
      vsPE: `${data.sectorContext.vsAvg > 0 ? '+' : ''}${
        data.sectorContext.vsAvg
      }%`,
    };
  }

  // PFV (Psychological Fair Value)
  if (data.pfv) {
    tickerData.pfv = {
      fair: `$${data.pfv.fairValue.toFixed(0)}`,
      bias: data.pfv.bias.toLowerCase(),
      conf: data.pfv.confidence.toLowerCase(),
      dev: `${data.pfv.deviationPercent > 0 ? '+' : ''}${data.pfv.deviationPercent.toFixed(
        1
      )}%`,
    };
  }

  // News headlines (just titles, compact)
  if (data.news && data.news.length > 0) {
    tickerData.news = data.news.slice(0, 3).map((n) => n.title);
  }

  return encode(tickerData);
}

/**
 * Encode search results to TOON format
 * Produces compact search summary
 */
export function encodeSearchToTOON(
  results: Array<{ title: string; url: string; snippet: string }>
): string {
  const data = {
    searchResults: results.map((r) => ({
      title: r.title,
      snippet: r.snippet,
      source: new URL(r.url).hostname.replace('www.', ''),
    })),
  };
  return encode(data);
}

/**
 * Encode multiple tickers to compact TOON format
 */
export function encodeTickersToTOON(tickers: TickerData[]): string {
  const data = tickers.map((t) => ({
    ticker: t.ticker.toUpperCase(),
    price: Number(t.price.toFixed(2)),
    change: `${(t.changePct ?? 0) >= 0 ? '+' : ''}${(t.changePct ?? 0).toFixed(1)}%`,
    rsi: t.rsi ? Math.round(t.rsi) : null,
    ma200: t.ma200 ? Math.round(t.ma200) : null,
    aboveMA200: t.aboveMA200 ?? null,
    grade: t.grade?.grade ?? null,
  }));
  return encode({ tickers: data });
}

// ============================================================================
// MARKET REGIME TOON ENCODING
// ============================================================================

/**
 * Encode market regime to TOON format
 * Compact format for market conditions
 */
export function encodeMarketRegimeToTOON(regime: MarketRegime): string {
  const data = {
    regime: regime.regime,
    vix: {
      current: regime.vix.current,
      level: regime.vix.level.toLowerCase(),
      change: `${regime.vix.changePct >= 0 ? '+' : ''}${regime.vix.changePct}%`,
    },
    spy: {
      price: `$${regime.spy.price}`,
      trend: regime.spy.trend.toLowerCase(),
      aboveMA200: regime.spy.aboveMA200,
      aboveMA50: regime.spy.aboveMA50,
    },
    recommendation: regime.tradingRecommendation,
  };

  // Add top 3 sectors if available
  if (regime.sectors.length > 0) {
    const sectorsData = regime.sectors.slice(0, 3).map((s) => ({
      name: s.name,
      change: `${s.changePct >= 0 ? '+' : ''}${s.changePct}%`,
      momentum: s.momentum.toLowerCase(),
    }));
    Object.assign(data, { sectors: sectorsData });
  }

  return encode(data);
}

/**
 * Encode multiple tickers as a TOON table (most efficient format)
 * Uses TOON's tabular format: array[N]{fields}: followed by rows
 */
export function encodeTickerTableToTOON(tickers: TickerData[]): string {
  // Build uniform array for maximum TOON efficiency
  const rows = tickers.map((t) => ({
    ticker: t.ticker,
    price: Number(t.price.toFixed(2)),
    changePct: Number((t.changePct ?? 0).toFixed(1)),
    rsi: t.rsi ? Math.round(t.rsi) : null,
    adx: t.adx ? Math.round(t.adx) : null,
    aboveMA200: t.aboveMA200 ?? null,
    iv: t.iv?.currentIV ? Math.round(t.iv.currentIV) : null,
    cushion: t.spread?.cushion ? Number(t.spread.cushion.toFixed(1)) : null,
    grade: t.grade?.grade ?? null,
    earningsDays: t.earningsDays ?? null,
    flowSentiment: t.optionsFlow?.sentiment ?? null,
    vsSPY: t.relativeStrength?.vsSPY ?? null,
  }));

  return encode({ tickers: rows });
}

/**
 * Encode scan results to TOON format
 * Optimized for scanner output
 */
export function encodeScanResultsToTOON(
  results: Array<{
    ticker: string;
    price: number;
    grade: string;
    score: number;
    riskScore: number;
    cushion?: number;
    strikes?: string;
    debit?: number;
    reasons: string[];
  }>
): string {
  const data = results.map((r) => ({
    ticker: r.ticker,
    price: Number(r.price.toFixed(2)),
    grade: r.grade,
    score: r.score,
    risk: r.riskScore,
    spread:
      r.strikes && r.debit
        ? {
            strikes: r.strikes,
            debit: Number(r.debit.toFixed(2)),
            cushion: r.cushion ? `${r.cushion.toFixed(1)}%` : null,
          }
        : null,
    reasons: r.reasons.slice(0, 3),
  }));

  return encode({ scanResults: data });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { encode as encodeTOON };
