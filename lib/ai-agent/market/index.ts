/**
 * Market Regime Service
 *
 * Shared market regime detection for CLI and Frontend.
 * Provides VIX awareness, SPY trend analysis, and sector rotation tracking.
 *
 * This is the SAME logic used by the CLI - single source of truth.
 *
 * CACHING: Uses SessionCache for 5-minute TTL caching of market regime data.
 * VIX and SPY don't change rapidly, so caching saves significant API calls.
 */

import { sessionCache, CacheKeys, CACHE_TTL } from '../cache';
import { log } from '../utils';

// ============================================================================
// TYPES
// ============================================================================

export type MarketRegimeType =
  | 'RISK_ON' // Bullish conditions, low VIX, above MA200
  | 'RISK_OFF' // Bearish conditions, high VIX, below MA200
  | 'NEUTRAL' // Mixed signals
  | 'HIGH_VOL'; // Elevated volatility regardless of direction

export type VIXLevel =
  | 'CALM' // VIX < 15
  | 'NORMAL' // VIX 15-20
  | 'ELEVATED' // VIX 20-30
  | 'HIGH' // VIX 30-40
  | 'EXTREME'; // VIX > 40

export interface VIXData {
  current: number;
  change: number;
  changePct: number;
  level: VIXLevel;
  description: string;
}

export interface SPYTrend {
  price: number;
  changePct: number;
  aboveMA50: boolean;
  aboveMA200: boolean;
  ma50: number;
  ma200: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface SectorPerformance {
  ticker: string;
  name: string;
  changePct: number;
  momentum: 'LEADING' | 'LAGGING' | 'NEUTRAL';
}

export interface MarketRegime {
  regime: MarketRegimeType;
  vix: VIXData;
  spy: SPYTrend;
  sectors: SectorPerformance[];
  summary: string;
  tradingRecommendation: string;
  timestamp: Date;
}

// ============================================================================
// SECTOR ETFS
// ============================================================================

const SECTOR_ETFS = [
  { ticker: 'XLK', name: 'Technology' },
  { ticker: 'XLF', name: 'Financials' },
  { ticker: 'XLE', name: 'Energy' },
  { ticker: 'XLV', name: 'Healthcare' },
  { ticker: 'XLY', name: 'Consumer Disc.' },
  { ticker: 'XLP', name: 'Consumer Staples' },
  { ticker: 'XLI', name: 'Industrials' },
  { ticker: 'XLU', name: 'Utilities' },
];

// ============================================================================
// VIX ANALYSIS
// ============================================================================

/**
 * Classify VIX level
 */
function classifyVIX(vixValue: number): VIXLevel {
  if (vixValue < 15) return 'CALM';
  if (vixValue < 20) return 'NORMAL';
  if (vixValue < 30) return 'ELEVATED';
  if (vixValue < 40) return 'HIGH';
  return 'EXTREME';
}

/**
 * Get VIX description based on level
 */
function getVIXDescription(level: VIXLevel): string {
  switch (level) {
    case 'CALM':
      return 'Low fear - favorable for buying spreads';
    case 'NORMAL':
      return 'Standard volatility - normal trading conditions';
    case 'ELEVATED':
      return 'Elevated fear - consider smaller positions';
    case 'HIGH':
      return 'High fear - wait for stabilization';
    case 'EXTREME':
      return 'Panic levels - extreme caution advised';
  }
}

/**
 * Fetch VIX data
 *
 * Uses proxy first (avoids rate limiting), falls back to direct yahoo-finance2
 */
export async function getVIXData(): Promise<VIXData | null> {
  // Try proxy first - use /ticker/ endpoint which handles ^VIX better
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (proxyUrl) {
    try {
      // Use /ticker/ endpoint with URL-encoded ^VIX
      const url = `${proxyUrl}/ticker/%5EVIX`;
      log.debug(`[Market] Fetching VIX via proxy: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        // /ticker/ returns { quote: { price, change, changePct, ... }, ... }
        const data = (await response.json()) as {
          quote?: {
            price?: number;
            change?: number;
            changePct?: number;
          };
        };
        if (data.quote?.price) {
          const current = data.quote.price;
          const change = data.quote.change ?? 0;
          const changePct = data.quote.changePct ?? 0;
          const level = classifyVIX(current);
          log.debug(`[Market] VIX from proxy: ${current}`);
          return {
            current: Math.round(current * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePct: Math.round(changePct * 100) / 100,
            level,
            description: getVIXDescription(level),
          };
        } else {
          log.debug(`[Market] VIX proxy returned no price:`, data);
        }
      } else {
        log.debug(`[Market] VIX proxy returned ${response.status}`);
      }
    } catch (e) {
      log.debug(`[Market] VIX proxy failed, trying direct:`, e);
    }
  } else {
    log.debug(`[Market] No YAHOO_PROXY_URL set for VIX`);
  }

  // Fallback to direct yahoo-finance2
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    const quote = await yahooFinance.quote('^VIX');
    if (!quote?.regularMarketPrice) return null;

    const current = quote.regularMarketPrice;
    const change = quote.regularMarketChange ?? 0;
    const changePct = quote.regularMarketChangePercent ?? 0;
    const level = classifyVIX(current);

    return {
      current: Math.round(current * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      level,
      description: getVIXDescription(level),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SPY TREND ANALYSIS
// ============================================================================

/**
 * Fetch SPY trend data
 *
 * Uses proxy first (avoids rate limiting), falls back to direct yahoo-finance2
 */
export async function getSPYTrend(): Promise<SPYTrend | null> {
  // Try proxy first
  const proxyUrl = process.env.YAHOO_PROXY_URL;
  if (proxyUrl) {
    try {
      const url = `${proxyUrl}/quote/SPY`;
      log.debug(`[Market] Fetching SPY via proxy: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        // Proxy returns cleaned QuoteData directly (not wrapped)
        const quote = (await response.json()) as {
          price?: number;
          changePct?: number;
          fiftyDayAverage?: number;
          twoHundredDayAverage?: number;
        };
        if (quote?.price) {
          const price = quote.price;
          const changePct = quote.changePct ?? 0;
          const ma50 = quote.fiftyDayAverage ?? price;
          const ma200 = quote.twoHundredDayAverage ?? price;
          const aboveMA50 = price > ma50;
          const aboveMA200 = price > ma200;
          let trend: SPYTrend['trend'] = 'NEUTRAL';
          if (aboveMA50 && aboveMA200) trend = 'BULLISH';
          else if (!aboveMA50 && !aboveMA200) trend = 'BEARISH';
          log.debug(`[Market] SPY from proxy: $${price} ${trend}`);
          return {
            price: Math.round(price * 100) / 100,
            changePct: Math.round(changePct * 100) / 100,
            aboveMA50,
            aboveMA200,
            ma50: Math.round(ma50 * 100) / 100,
            ma200: Math.round(ma200 * 100) / 100,
            trend,
          };
        } else {
          log.debug(`[Market] SPY proxy returned no price:`, quote);
        }
      } else {
        log.debug(`[Market] SPY proxy returned ${response.status}`);
      }
    } catch (e) {
      log.debug(`[Market] SPY proxy failed, trying direct:`, e);
    }
  } else {
    log.debug(`[Market] No YAHOO_PROXY_URL set for SPY`);
  }

  // Fallback to direct yahoo-finance2
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    const quote = await yahooFinance.quote('SPY');
    if (!quote?.regularMarketPrice) return null;

    const price = quote.regularMarketPrice;
    const changePct = quote.regularMarketChangePercent ?? 0;
    const ma50 = quote.fiftyDayAverage ?? price;
    const ma200 = quote.twoHundredDayAverage ?? price;

    const aboveMA50 = price > ma50;
    const aboveMA200 = price > ma200;

    // Determine trend
    let trend: SPYTrend['trend'] = 'NEUTRAL';
    if (aboveMA50 && aboveMA200) {
      trend = 'BULLISH';
    } else if (!aboveMA50 && !aboveMA200) {
      trend = 'BEARISH';
    }

    return {
      price: Math.round(price * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      aboveMA50,
      aboveMA200,
      ma50: Math.round(ma50 * 100) / 100,
      ma200: Math.round(ma200 * 100) / 100,
      trend,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SECTOR ROTATION
// ============================================================================

/**
 * Fetch sector performance data
 *
 * Uses proxy first (avoids rate limiting), falls back to direct yahoo-finance2
 */
export async function getSectorPerformance(): Promise<SectorPerformance[]> {
  const sectors: SectorPerformance[] = [];
  const proxyUrl = process.env.YAHOO_PROXY_URL;

  // Try proxy batch endpoint first (single request for all 8 sectors)
  if (proxyUrl) {
    try {
      const symbols = SECTOR_ETFS.map((s) => s.ticker).join(',');
      log.debug(`[Market] Fetching sectors via batch proxy...`);
      const response = await fetch(
        `${proxyUrl}/batch-quotes?symbols=${symbols}`
      );

      if (response.ok) {
        const data = (await response.json()) as {
          quotes: Record<string, { changePct?: number } | null>;
          elapsed_ms?: number;
        };

        for (const sector of SECTOR_ETFS) {
          const quote = data.quotes[sector.ticker];
          if (quote?.changePct !== undefined) {
            const changePct = quote.changePct;
            let momentum: SectorPerformance['momentum'] = 'NEUTRAL';
            if (changePct > 1) momentum = 'LEADING';
            else if (changePct < -1) momentum = 'LAGGING';
            sectors.push({
              ticker: sector.ticker,
              name: sector.name,
              changePct: Math.round(changePct * 100) / 100,
              momentum,
            });
          }
        }

        if (sectors.length > 0) {
          sectors.sort((a, b) => b.changePct - a.changePct);
          log.debug(
            `[Market] Got ${sectors.length} sectors from batch proxy ` +
              `(${data.elapsed_ms}ms)`
          );
          return sectors;
        }
      }
    } catch (e) {
      log.debug(`[Market] Sectors batch proxy failed, trying direct:`, e);
    }
  }

  // Fallback to direct yahoo-finance2
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    // Fetch all sector ETFs in parallel
    const quotes = await Promise.all(
      SECTOR_ETFS.map((s) => yahooFinance.quote(s.ticker).catch(() => null))
    );

    for (let i = 0; i < SECTOR_ETFS.length; i++) {
      const quote = quotes[i];
      const sector = SECTOR_ETFS[i];

      if (quote?.regularMarketChangePercent !== undefined) {
        const changePct = quote.regularMarketChangePercent;

        // Classify momentum
        let momentum: SectorPerformance['momentum'] = 'NEUTRAL';
        if (changePct > 1) momentum = 'LEADING';
        else if (changePct < -1) momentum = 'LAGGING';

        if (sector) {
          sectors.push({
            ticker: sector.ticker,
            name: sector.name,
            changePct: Math.round(changePct * 100) / 100,
            momentum,
          });
        }
      }
    }

    // Sort by performance (best first)
    sectors.sort((a, b) => b.changePct - a.changePct);
  } catch {
    // Return empty array on error
  }

  return sectors;
}

// ============================================================================
// REGIME DETECTION
// ============================================================================

/**
 * Determine overall market regime
 */
function determineRegime(
  vix: VIXData | null,
  spy: SPYTrend | null
): MarketRegimeType {
  // If we have no data, return neutral
  if (!vix && !spy) return 'NEUTRAL';

  // High VIX = HIGH_VOL regime regardless of trend
  if (vix && (vix.level === 'HIGH' || vix.level === 'EXTREME')) {
    return 'HIGH_VOL';
  }

  // Check SPY trend
  if (spy) {
    if (
      spy.trend === 'BULLISH' &&
      (!vix || vix.level === 'CALM' || vix.level === 'NORMAL')
    ) {
      return 'RISK_ON';
    }
    if (spy.trend === 'BEARISH') {
      return 'RISK_OFF';
    }
  }

  // Elevated VIX with neutral SPY trend
  if (vix && vix.level === 'ELEVATED') {
    return 'HIGH_VOL';
  }

  return 'NEUTRAL';
}

/**
 * Generate regime summary
 */
function generateSummary(
  regime: MarketRegimeType,
  vix: VIXData | null,
  spy: SPYTrend | null,
  sectors: SectorPerformance[]
): string {
  const parts: string[] = [];

  // Regime description
  switch (regime) {
    case 'RISK_ON':
      parts.push('Risk-On environment');
      break;
    case 'RISK_OFF':
      parts.push('Risk-Off environment');
      break;
    case 'HIGH_VOL':
      parts.push('High Volatility regime');
      break;
    case 'NEUTRAL':
      parts.push('Neutral/Mixed regime');
      break;
  }

  // VIX context
  if (vix) {
    parts.push(`VIX ${vix.current} (${vix.level})`);
  }

  // SPY context
  if (spy) {
    const maStatus = spy.aboveMA200 ? '↑MA200' : '↓MA200';
    parts.push(`SPY ${spy.trend} ${maStatus}`);
  }

  // Leading sector
  if (sectors.length > 0) {
    const leader = sectors[0];
    if (leader) {
      parts.push(`${leader.name} leading (+${leader.changePct}%)`);
    }
  }

  return parts.join(' | ');
}

/**
 * Generate trading recommendation based on regime
 */
function generateRecommendation(
  regime: MarketRegimeType,
  vix: VIXData | null
): string {
  switch (regime) {
    case 'RISK_ON':
      return (
        'Favorable for CDS entries. Normal position sizing. ' +
        'Look for pullbacks to MA20.'
      );
    case 'RISK_OFF':
      return (
        'Reduce exposure. Wait for trend reversal signals. ' +
        'Consider defensive sectors.'
      );
    case 'HIGH_VOL':
      if (vix && vix.level === 'EXTREME') {
        return (
          'Avoid new entries. Wait for VIX to drop below 30 ' +
          'before trading.'
        );
      }
      return (
        'Reduce position sizes by 50%. Wider stops required. ' +
        'Consider waiting.'
      );
    case 'NEUTRAL':
      return (
        'Proceed with caution. Focus on Grade A setups only. ' +
        'Normal position sizing.'
      );
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get full market regime analysis
 *
 * Uses 5-minute caching since VIX/SPY don't change rapidly.
 * This saves ~10 API calls per session for repeated regime checks.
 */
export async function getMarketRegime(): Promise<MarketRegime> {
  const cacheKey = CacheKeys.regime();

  // CHECK CACHE FIRST - regime data is stable for minutes
  const cached = sessionCache.get<MarketRegime>(cacheKey);
  if (cached) {
    const age = sessionCache.getAge(cacheKey);
    log.debug(
      `[Market] Regime cache HIT (age: ${age ? Math.round(age / 1000) : 0}s)`
    );
    return cached;
  }

  log.debug(`[Market] Regime cache MISS, fetching VIX/SPY/Sectors...`);

  // Fetch all data in parallel
  const [vix, spy, sectors] = await Promise.all([
    getVIXData(),
    getSPYTrend(),
    getSectorPerformance(),
  ]);

  const regime = determineRegime(vix, spy);
  const summary = generateSummary(regime, vix, spy, sectors);
  const tradingRecommendation = generateRecommendation(regime, vix);

  const result: MarketRegime = {
    regime,
    vix: vix ?? {
      current: 0,
      change: 0,
      changePct: 0,
      level: 'NORMAL',
      description: 'VIX data unavailable',
    },
    spy: spy ?? {
      price: 0,
      changePct: 0,
      aboveMA50: true,
      aboveMA200: true,
      ma50: 0,
      ma200: 0,
      trend: 'NEUTRAL',
    },
    sectors,
    summary,
    tradingRecommendation,
    timestamp: new Date(),
  };

  // Cache the result
  sessionCache.set(cacheKey, result, CACHE_TTL.REGIME);
  log.debug(
    `[Market] Cached regime data (TTL: ${CACHE_TTL.REGIME / 1000 / 60} min)`
  );

  return result;
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format market regime for AI context (compact)
 */
export function formatRegimeForAI(regime: MarketRegime): string {
  const lines: string[] = [];

  lines.push(`REGIME: ${regime.regime}`);
  lines.push(`VIX: ${regime.vix.current} (${regime.vix.level})`);
  lines.push(
    `SPY: $${regime.spy.price} ${regime.spy.trend} ${
      regime.spy.aboveMA200 ? '↑MA200' : '↓MA200'
    }`
  );

  if (regime.sectors.length > 0) {
    const top3 = regime.sectors.slice(0, 3);
    const leaders = top3.map(
      (s) => `${s.name}:${s.changePct > 0 ? '+' : ''}${s.changePct}%`
    );
    lines.push(`SECTORS: ${leaders.join(' | ')}`);
  }

  lines.push(`→ ${regime.tradingRecommendation}`);

  return lines.join('\n');
}

/**
 * Get regime badge for display (very compact)
 */
export function getRegimeBadge(regime: MarketRegime): string {
  const vixEmoji =
    regime.vix.level === 'CALM'
      ? '🟢'
      : regime.vix.level === 'NORMAL'
        ? '🟡'
        : regime.vix.level === 'ELEVATED'
          ? '🟠'
          : '🔴';

  const trendEmoji =
    regime.spy.trend === 'BULLISH'
      ? '📈'
      : regime.spy.trend === 'BEARISH'
        ? '📉'
        : '➡️';

  return `${vixEmoji} VIX ${regime.vix.current} ${trendEmoji} ${regime.regime}`;
}

// ============================================================================
// RE-EXPORTS FROM SUBMODULES
// ============================================================================

// Chop Index / ATR / ADX calculations
export {
  calculateATR,
  getATRAnalysis,
  calculateChopIndex,
  getChopAnalysis,
  countDirectionReversals,
  isWhipsawCondition,
  calculateADX,
  getADXAnalysis,
  type ChopAnalysis,
  type ATRData,
  type ADXAnalysis,
} from './chop-index';

// Signal conflict detection
export {
  analyzeSignalConflicts,
  type Signal,
  type SignalDirection,
  type ConflictAnalysis,
  type ConflictPair,
  type SignalInputs,
} from './signal-conflicts';

// No-Trade Regime detection (Cash-Preserving Strategy)
export {
  analyzeTradingRegime,
  getRegimeEmoji,
  formatRegimeBadge,
  formatRegimeForAI as formatTradingRegimeForAI,
  formatRegimeTOON as formatTradingRegimeTOON,
  formatWeeklySummary,
  detectRegimeTransition,
  formatTransitionWarning,
  type TradingRegime,
  type TradingRegimeAnalysis,
  type RegimeReason,
  type PriceHistory,
  type RegimeTransition,
  type RegimeMetricsSnapshot,
} from './no-trade-regime';

// Market Breadth indicators
export {
  SECTOR_ETFS,
  BREADTH_PROXIES,
  calculateSectorBreadth,
  estimateBreadthFromProxies,
  analyzeBreadth,
  fetchBreadthViaProxy,
  fetchSectorBreadthViaProxy,
  type BreadthAnalysis,
  type BreadthMetrics,
  type SectorBreadth,
} from './market-breadth';
