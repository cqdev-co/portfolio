/**
 * Market Breadth Indicators
 *
 * Measures the overall health of the market by analyzing the
 * participation of stocks in a move. Narrow breadth (few stocks
 * participating) often precedes market weakness.
 *
 * Key Indicators:
 * - % of stocks above MA50/MA200
 * - Advance/Decline ratio
 * - New Highs vs New Lows
 * - Sector participation
 */

import { log } from '../utils';

// ============================================================================
// TYPES
// ============================================================================

export interface BreadthAnalysis {
  /** Overall breadth health score (0-100) */
  score: number;
  /** Interpretation */
  level: 'HEALTHY' | 'NARROWING' | 'WEAK' | 'DIVERGENT';
  /** Detailed metrics */
  metrics: BreadthMetrics;
  /** Warning signals */
  warnings: string[];
  /** Human-readable summary */
  summary: string;
  /** Whether breadth supports the current trend */
  supportsTrend: boolean;
}

export interface BreadthMetrics {
  /** % of stocks above 50-day MA (healthy > 60%) */
  pctAboveMA50?: number;
  /** % of stocks above 200-day MA (healthy > 50%) */
  pctAboveMA200?: number;
  /** Advance/Decline ratio (healthy > 1.0) */
  advanceDeclineRatio?: number;
  /** New 52-week highs count */
  newHighs?: number;
  /** New 52-week lows count */
  newLows?: number;
  /** New Highs - New Lows (healthy > 0) */
  highLowDiff?: number;
  /** Number of sectors advancing */
  sectorsAdvancing?: number;
  /** Number of sectors declining */
  sectorsDeclining?: number;
}

export interface SectorBreadth {
  ticker: string;
  name: string;
  aboveMA50: boolean;
  aboveMA200: boolean;
  changePct: number;
  trend: 'UP' | 'DOWN' | 'FLAT';
}

// ============================================================================
// SECTOR ETF DEFINITIONS
// ============================================================================

/**
 * Major sector ETFs for breadth analysis
 */
export const SECTOR_ETFS = [
  { ticker: 'XLK', name: 'Technology' },
  { ticker: 'XLF', name: 'Financials' },
  { ticker: 'XLE', name: 'Energy' },
  { ticker: 'XLV', name: 'Healthcare' },
  { ticker: 'XLY', name: 'Consumer Discretionary' },
  { ticker: 'XLP', name: 'Consumer Staples' },
  { ticker: 'XLI', name: 'Industrials' },
  { ticker: 'XLU', name: 'Utilities' },
  { ticker: 'XLB', name: 'Materials' },
  { ticker: 'XLRE', name: 'Real Estate' },
  { ticker: 'XLC', name: 'Communication Services' },
] as const;

/**
 * Market-wide breadth proxy tickers
 * These track market breadth without needing individual stock data
 */
export const BREADTH_PROXIES = {
  // % above MA proxies (approximations)
  spyMA50Proxy: 'RSP', // Equal-weight S&P 500
  spyMA200Proxy: 'RSP',

  // Small cap health (often leads)
  smallCap: 'IWM', // Russell 2000

  // Mid cap health
  midCap: 'IJH', // S&P 400 Mid Cap

  // Volatility
  vix: '^VIX',
} as const;

// ============================================================================
// BREADTH CALCULATION
// ============================================================================

/**
 * Calculate sector breadth from sector ETF data
 *
 * @param sectorData - Array of sector quote data
 */
export function calculateSectorBreadth(
  sectorData: Array<{
    ticker: string;
    name: string;
    price: number;
    ma50?: number;
    ma200?: number;
    changePct: number;
  }>
): {
  sectorsAdvancing: number;
  sectorsDeclining: number;
  sectorsAboveMA50: number;
  sectorsAboveMA200: number;
  sectorBreadth: SectorBreadth[];
} {
  let sectorsAdvancing = 0;
  let sectorsDeclining = 0;
  let sectorsAboveMA50 = 0;
  let sectorsAboveMA200 = 0;

  const sectorBreadth: SectorBreadth[] = [];

  for (const sector of sectorData) {
    const aboveMA50 = sector.ma50 ? sector.price > sector.ma50 : true;
    const aboveMA200 = sector.ma200 ? sector.price > sector.ma200 : true;

    let trend: SectorBreadth['trend'];
    if (sector.changePct > 0.3) {
      trend = 'UP';
      sectorsAdvancing++;
    } else if (sector.changePct < -0.3) {
      trend = 'DOWN';
      sectorsDeclining++;
    } else {
      trend = 'FLAT';
    }

    if (aboveMA50) sectorsAboveMA50++;
    if (aboveMA200) sectorsAboveMA200++;

    sectorBreadth.push({
      ticker: sector.ticker,
      name: sector.name,
      aboveMA50,
      aboveMA200,
      changePct: sector.changePct,
      trend,
    });
  }

  return {
    sectorsAdvancing,
    sectorsDeclining,
    sectorsAboveMA50,
    sectorsAboveMA200,
    sectorBreadth,
  };
}

/**
 * Estimate market breadth from proxy ETFs
 *
 * Uses equal-weight vs cap-weight divergence as a breadth proxy:
 * - RSP (equal-weight) outperforming SPY = healthy breadth
 * - SPY outperforming RSP = narrow leadership
 *
 * @param spyPrice - SPY current price
 * @param spyMA50 - SPY 50-day MA
 * @param spyMA200 - SPY 200-day MA
 * @param rspPrice - RSP current price
 * @param rspMA50 - RSP 50-day MA
 * @param iwmPrice - IWM current price
 * @param iwmMA50 - IWM 50-day MA
 */
export function estimateBreadthFromProxies(
  spyData: { price: number; ma50?: number; ma200?: number; changePct: number },
  rspData?: { price: number; ma50?: number; changePct: number },
  iwmData?: { price: number; ma50?: number; changePct: number }
): BreadthMetrics {
  const metrics: BreadthMetrics = {};

  // Estimate % above MA from SPY position
  // If SPY is X% above its MA, estimate similar for market
  if (spyData.ma50) {
    const spyAboveMA50Pct =
      ((spyData.price - spyData.ma50) / spyData.ma50) * 100;
    // Rough estimate: if SPY 2% above MA50, ~65% of stocks above MA50
    // This is an approximation - real breadth data would be better
    metrics.pctAboveMA50 = Math.max(
      20,
      Math.min(90, 50 + spyAboveMA50Pct * 7.5)
    );
  }

  if (spyData.ma200) {
    const spyAboveMA200Pct =
      ((spyData.price - spyData.ma200) / spyData.ma200) * 100;
    metrics.pctAboveMA200 = Math.max(
      15,
      Math.min(85, 45 + spyAboveMA200Pct * 5)
    );
  }

  // RSP vs SPY divergence indicates breadth quality
  if (rspData) {
    const rspVsSpy = rspData.changePct - spyData.changePct;
    // RSP outperforming = broad participation
    // SPY outperforming = narrow mega-cap leadership
    if (rspVsSpy > 0.2) {
      // Healthy breadth - adjust estimates upward
      if (metrics.pctAboveMA50) metrics.pctAboveMA50 += 5;
      if (metrics.pctAboveMA200) metrics.pctAboveMA200 += 3;
    } else if (rspVsSpy < -0.3) {
      // Narrow breadth - adjust estimates downward
      if (metrics.pctAboveMA50) metrics.pctAboveMA50 -= 10;
      if (metrics.pctAboveMA200) metrics.pctAboveMA200 -= 5;
    }
  }

  // IWM (small caps) often leads market health
  if (iwmData) {
    const iwmVsSpy = iwmData.changePct - spyData.changePct;
    // Small caps outperforming = risk-on, healthy
    // Small caps underperforming = risk-off, caution
    if (iwmVsSpy > 0.5) {
      if (metrics.pctAboveMA50) metrics.pctAboveMA50 += 5;
    } else if (iwmVsSpy < -0.5) {
      if (metrics.pctAboveMA50) metrics.pctAboveMA50 -= 5;
    }
  }

  // Clamp values
  if (metrics.pctAboveMA50) {
    metrics.pctAboveMA50 = Math.round(
      Math.max(10, Math.min(95, metrics.pctAboveMA50))
    );
  }
  if (metrics.pctAboveMA200) {
    metrics.pctAboveMA200 = Math.round(
      Math.max(10, Math.min(90, metrics.pctAboveMA200))
    );
  }

  return metrics;
}

/**
 * Analyze overall market breadth health
 */
export function analyzeBreadth(
  metrics: BreadthMetrics,
  spyTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
): BreadthAnalysis {
  const warnings: string[] = [];
  let score = 50; // Start neutral

  // Score based on % above MA50
  if (metrics.pctAboveMA50 !== undefined) {
    if (metrics.pctAboveMA50 >= 70) {
      score += 20;
    } else if (metrics.pctAboveMA50 >= 50) {
      score += 10;
    } else if (metrics.pctAboveMA50 >= 30) {
      score -= 10;
      warnings.push(
        `Only ${metrics.pctAboveMA50}% above MA50 - narrow breadth`
      );
    } else {
      score -= 25;
      warnings.push(`Very weak breadth: ${metrics.pctAboveMA50}% above MA50`);
    }
  }

  // Score based on % above MA200
  if (metrics.pctAboveMA200 !== undefined) {
    if (metrics.pctAboveMA200 >= 60) {
      score += 15;
    } else if (metrics.pctAboveMA200 >= 40) {
      score += 5;
    } else if (metrics.pctAboveMA200 < 30) {
      score -= 15;
      warnings.push(
        `Only ${metrics.pctAboveMA200}% above MA200 - bear market breadth`
      );
    }
  }

  // Score based on sector participation
  if (
    metrics.sectorsAdvancing !== undefined &&
    metrics.sectorsDeclining !== undefined
  ) {
    const sectorRatio =
      metrics.sectorsAdvancing /
      (metrics.sectorsAdvancing + metrics.sectorsDeclining || 1);

    if (sectorRatio >= 0.7) {
      score += 10;
    } else if (sectorRatio <= 0.3) {
      score -= 10;
      warnings.push('Most sectors declining');
    }
  }

  // Check for divergence (bearish market but strong breadth or vice versa)
  let isDivergent = false;
  if (
    spyTrend === 'BULLISH' &&
    metrics.pctAboveMA50 &&
    metrics.pctAboveMA50 < 40
  ) {
    isDivergent = true;
    warnings.push(
      '⚠️ DIVERGENCE: SPY rising but breadth weak - potential reversal'
    );
  }
  if (
    spyTrend === 'BEARISH' &&
    metrics.pctAboveMA50 &&
    metrics.pctAboveMA50 > 60
  ) {
    isDivergent = true;
    warnings.push(
      '⚠️ DIVERGENCE: SPY falling but breadth strong - potential bottom'
    );
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: BreadthAnalysis['level'];
  if (isDivergent) {
    level = 'DIVERGENT';
  } else if (score >= 65) {
    level = 'HEALTHY';
  } else if (score >= 45) {
    level = 'NARROWING';
  } else {
    level = 'WEAK';
  }

  // Generate summary
  let summary: string;
  switch (level) {
    case 'HEALTHY':
      summary = 'Broad market participation - healthy breadth supports trend';
      break;
    case 'NARROWING':
      summary = 'Breadth narrowing - fewer stocks participating in move';
      break;
    case 'WEAK':
      summary = 'Weak breadth - majority of stocks not participating';
      break;
    case 'DIVERGENT':
      summary = 'Breadth diverging from price - watch for trend reversal';
      break;
  }

  // Determine if breadth supports the trend
  const supportsTrend =
    (spyTrend === 'BULLISH' && score >= 55) ||
    (spyTrend === 'BEARISH' && score <= 45) ||
    spyTrend === 'NEUTRAL';

  return {
    score,
    level,
    metrics,
    warnings,
    summary,
    supportsTrend,
  };
}

// ============================================================================
// PROXY-BASED BREADTH FETCHER
// ============================================================================

/**
 * Fetch breadth data via proxy
 *
 * @param proxyUrl - Cloudflare Worker proxy URL
 */
export async function fetchBreadthViaProxy(
  proxyUrl: string
): Promise<BreadthAnalysis | null> {
  try {
    // Type for proxy responses
    type ProxyQuote = {
      quote?: {
        price?: number;
        fiftyDayAverage?: number;
        twoHundredDayAverage?: number;
        changePct?: number;
      };
    };

    // Fetch SPY, RSP (equal-weight), and IWM (small cap) in parallel
    const [spyRes, rspRes, iwmRes] = await Promise.all([
      fetch(`${proxyUrl}/ticker/SPY`).then((r) =>
        r.ok ? (r.json() as Promise<ProxyQuote>) : null
      ),
      fetch(`${proxyUrl}/ticker/RSP`).then((r) =>
        r.ok ? (r.json() as Promise<ProxyQuote>) : null
      ),
      fetch(`${proxyUrl}/ticker/IWM`).then((r) =>
        r.ok ? (r.json() as Promise<ProxyQuote>) : null
      ),
    ]);

    if (!spyRes?.quote?.price) {
      log.debug('[Breadth] Could not fetch SPY data');
      return null;
    }

    const spyData = {
      price: spyRes.quote.price,
      ma50: spyRes.quote.fiftyDayAverage,
      ma200: spyRes.quote.twoHundredDayAverage,
      changePct: spyRes.quote.changePct ?? 0,
    };

    const rspData =
      rspRes?.quote?.price !== undefined
        ? {
            price: rspRes.quote.price,
            ma50: rspRes.quote.fiftyDayAverage,
            changePct: rspRes.quote.changePct ?? 0,
          }
        : undefined;

    const iwmData =
      iwmRes?.quote?.price !== undefined
        ? {
            price: iwmRes.quote.price,
            ma50: iwmRes.quote.fiftyDayAverage,
            changePct: iwmRes.quote.changePct ?? 0,
          }
        : undefined;

    // Determine SPY trend
    let spyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (spyData.ma50 && spyData.ma200) {
      const aboveMA50 = spyData.price > spyData.ma50;
      const aboveMA200 = spyData.price > spyData.ma200;
      if (aboveMA50 && aboveMA200) spyTrend = 'BULLISH';
      else if (!aboveMA50 && !aboveMA200) spyTrend = 'BEARISH';
    }

    // Estimate breadth metrics
    const metrics = estimateBreadthFromProxies(spyData, rspData, iwmData);

    // Analyze breadth
    return analyzeBreadth(metrics, spyTrend);
  } catch (error) {
    console.error('[Breadth] Fetch error:', error);
    return null;
  }
}

/**
 * Fetch sector breadth via proxy
 */
export async function fetchSectorBreadthViaProxy(
  proxyUrl: string
): Promise<SectorBreadth[] | null> {
  try {
    // Fetch all sector ETFs in parallel
    type SectorQuote = {
      quote?: {
        price?: number;
        fiftyDayAverage?: number;
        twoHundredDayAverage?: number;
        changePct?: number;
      };
    };

    const responses = await Promise.all(
      SECTOR_ETFS.map((sector) =>
        fetch(`${proxyUrl}/ticker/${sector.ticker}`)
          .then((r) => (r.ok ? (r.json() as Promise<SectorQuote>) : null))
          .then((data) => ({
            ...sector,
            data: data?.quote ?? null,
          }))
      )
    );

    const sectorData = responses
      .filter(
        (r): r is typeof r & { data: NonNullable<typeof r.data> } =>
          r.data !== null && r.data.price !== undefined
      )
      .map((r) => ({
        ticker: r.ticker,
        name: r.name,
        price: r.data.price!,
        ma50: r.data.fiftyDayAverage,
        ma200: r.data.twoHundredDayAverage,
        changePct: r.data.changePct ?? 0,
      }));

    if (sectorData.length < 5) {
      log.debug('[Breadth] Insufficient sector data');
      return null;
    }

    const { sectorBreadth } = calculateSectorBreadth(sectorData);
    return sectorBreadth;
  } catch (error) {
    console.error('[Breadth] Sector fetch error:', error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SECTOR_ETFS,
  BREADTH_PROXIES,
  calculateSectorBreadth,
  estimateBreadthFromProxies,
  analyzeBreadth,
  fetchBreadthViaProxy,
  fetchSectorBreadthViaProxy,
};
