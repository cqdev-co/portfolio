/**
 * Unified recent-news fetcher
 *
 * Phase 1B: extends the per-ticker `news` field on `TickerData` (which
 * is currently only 3 Yahoo headlines) into a deeper, multi-source,
 * deduplicated feed used by both `get_recent_news` (model tool) and
 * `runPreflight` when `signalRequirements.news` is set.
 *
 * Sources (in parallel):
 *   - Yahoo Finance via `yahoo-finance2` (already present in the repo).
 *   - Polygon `/v2/reference/news` (already wired in `data/polygon.ts`).
 *   - FMP `/stable/news/stock` (added by `data/fmp.ts`).
 *
 * Dedupe: by normalized URL (canonical-ish — drops fragment + lowercases
 * host + strips trailing slash).
 *
 * Cache: routed through `sessionCache` so chained calls in one chat
 * turn don't multi-fetch.
 */

import YahooFinance from 'yahoo-finance2';
import { polygonFetch } from './polygon';
import { fetchFmpStockNews } from './fmp';
import { fetchNewsViaProxy, isProxyConfigured } from './yahoo-proxy';
import { sessionCache } from '../cache';
import { log } from '../utils';

// ============================================================================
// TYPES
// ============================================================================

export interface RecentNewsArticle {
  title: string;
  url: string;
  source: string | null;
  published_at: string | null;
  snippet?: string | null;
  /** Provider that produced this article (yahoo / polygon / fmp). */
  origin: 'yahoo' | 'polygon' | 'fmp';
}

export interface RecentNewsResult {
  ticker: string;
  hours: number;
  articles: RecentNewsArticle[];
  /** Number of duplicates removed during merge. */
  dedupe_count: number;
  /** Per-provider article counts before dedupe (diagnostic). */
  source_counts: { yahoo: number; polygon: number; fmp: number };
}

// ============================================================================
// HELPERS
// ============================================================================

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    let path = u.pathname.replace(/\/+$/, '');
    if (!path) path = '/';
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url;
  }
}

function withinWindow(published_at: string | null, hours: number): boolean {
  if (!published_at) return true; // keep if we can't tell
  const t = Date.parse(published_at);
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= hours * 3600_000;
}

// ============================================================================
// PER-PROVIDER FETCHERS (each returns [] on failure; never throws)
// ============================================================================

/**
 * Yahoo Finance regularly 429s our direct search endpoint, so the
 * preferred path is the Cloudflare Worker proxy
 * (`YAHOO_PROXY_URL`) which carries a residential IP pool and
 * caches responses upstream. When the proxy isn't configured (e.g.
 * local dev without the worker URL set) we fall back to the
 * `yahoo-finance2` library directly and apply a 60s cool-down on
 * any 429 so we don't hammer the rate-limited endpoint.
 */
let yahooCoolDownUntil = 0;
const YAHOO_COOLDOWN_MS = 60_000;

async function fetchYahooNews(
  ticker: string,
  limit = 10
): Promise<RecentNewsArticle[]> {
  // Preferred path: proxy. The worker handles rate-limit avoidance
  // upstream and returns the same `news[]` shape we'd otherwise get
  // from `yahoo-finance2` search.
  if (isProxyConfigured()) {
    try {
      const items = await fetchNewsViaProxy(ticker, limit);
      return items.map((n) => ({
        title: n.title || '(untitled)',
        url: n.url || '',
        source: n.source || null,
        published_at: n.date ?? null,
        snippet: null,
        origin: 'yahoo' as const,
      }));
    } catch (err) {
      // Don't fall back to the direct lib here — if the proxy is
      // misconfigured we want to know via this single warn rather
      // than transparently leaking traffic to the rate-limited
      // endpoint.
      log.warn(`[news] yahoo proxy failed for ${ticker}: ${asMessage(err)}`);
      return [];
    }
  }

  // Fallback: direct yahoo-finance2 with a process-wide cool-down on 429.
  if (Date.now() < yahooCoolDownUntil) {
    return [];
  }
  try {
    const search = await yahoo.search(ticker, { newsCount: limit });
    const news = search?.news ?? [];
    return news.map((n) => ({
      title: n.title || '(untitled)',
      url: n.link || '',
      source: n.publisher || null,
      published_at:
        typeof n.providerPublishTime === 'number'
          ? new Date(n.providerPublishTime * 1000).toISOString()
          : null,
      snippet: null,
      origin: 'yahoo' as const,
    }));
  } catch (err) {
    const msg = asMessage(err);
    if (/429|too many requests/i.test(msg)) {
      yahooCoolDownUntil = Date.now() + YAHOO_COOLDOWN_MS;
      log.warn(
        `[news] yahoo rate-limited (429); cooling down for ${
          YAHOO_COOLDOWN_MS / 1000
        }s. (Tip: set YAHOO_PROXY_URL to bypass.)`
      );
    } else {
      log.warn(`[news] yahoo failed for ${ticker}: ${msg}`);
    }
    return [];
  }
}

interface PolygonNewsResponse {
  results?: Array<{
    title: string;
    article_url: string;
    published_utc?: string;
    description?: string;
    publisher?: { name?: string };
  }>;
}

async function fetchPolygonNews(
  ticker: string,
  limit = 10
): Promise<RecentNewsArticle[]> {
  if (!process.env.POLYGON_API_TOKEN) return [];
  try {
    const r = await polygonFetch<PolygonNewsResponse>(
      `/v2/reference/news?ticker=${encodeURIComponent(ticker)}&limit=${limit}`
    );
    return (r.results ?? []).map((n) => ({
      title: n.title,
      url: n.article_url,
      source: n.publisher?.name ?? null,
      published_at: n.published_utc ?? null,
      snippet: n.description ?? null,
      origin: 'polygon' as const,
    }));
  } catch (err) {
    log.warn(`[news] polygon failed for ${ticker}: ${asMessage(err)}`);
    return [];
  }
}

async function fetchFmpNewsArticles(
  ticker: string,
  limit = 10
): Promise<RecentNewsArticle[]> {
  const rows = await fetchFmpStockNews({ ticker, limit });
  if (!rows) return [];
  return rows.map((n) => ({
    title: n.title,
    url: n.url,
    source: n.publisher ?? n.site ?? null,
    // FMP returns "YYYY-MM-DD HH:MM:SS" without TZ; treat as UTC.
    published_at: n.publishedDate
      ? new Date(`${n.publishedDate.replace(' ', 'T')}Z`).toISOString()
      : null,
    snippet: n.text ?? null,
    origin: 'fmp' as const,
  }));
}

// ============================================================================
// PUBLIC ENTRY
// ============================================================================

/**
 * Fetch recent news from all configured providers, deduped + sorted
 * desc by published_at. Returns up to 15 articles per call.
 *
 * Cached per (ticker, hours) for 5 minutes via `sessionCache`.
 */
export async function fetchRecentNews(
  ticker: string,
  options?: { hours?: number; limit?: number }
): Promise<RecentNewsResult> {
  const symbol = ticker.toUpperCase();
  const hours = clamp(options?.hours ?? 48, 1, 168);
  const limit = clamp(options?.limit ?? 15, 1, 30);
  const cacheKey = `news:recent:${symbol}:${hours}:${limit}`;

  return sessionCache.getOrFetch<RecentNewsResult>(
    cacheKey,
    async () => {
      const [yahooArr, polygonArr, fmpArr] = await Promise.all([
        fetchYahooNews(symbol, limit),
        fetchPolygonNews(symbol, limit),
        fetchFmpNewsArticles(symbol, limit),
      ]);

      const merged: RecentNewsArticle[] = [];
      const seen = new Set<string>();
      let dedupeCount = 0;

      for (const arr of [fmpArr, polygonArr, yahooArr]) {
        // Iterate FMP first because it usually has snippets; we still
        // dedupe so duplicate URLs from another provider get dropped
        // (which is a desirable property — first-seen wins).
        for (const a of arr) {
          if (!withinWindow(a.published_at, hours)) continue;
          const k = normalizeUrl(a.url);
          if (!k) continue;
          if (seen.has(k)) {
            dedupeCount++;
            continue;
          }
          seen.add(k);
          merged.push(a);
        }
      }

      merged.sort((a, b) => {
        const ta = a.published_at ? Date.parse(a.published_at) : 0;
        const tb = b.published_at ? Date.parse(b.published_at) : 0;
        return tb - ta;
      });

      return {
        ticker: symbol,
        hours,
        articles: merged.slice(0, limit),
        dedupe_count: dedupeCount,
        source_counts: {
          yahoo: yahooArr.length,
          polygon: polygonArr.length,
          fmp: fmpArr.length,
        },
      };
    },
    5 * 60 * 1000
  );
}

// ============================================================================
// MISC
// ============================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
