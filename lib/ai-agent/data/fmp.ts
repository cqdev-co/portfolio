/**
 * Financial Modeling Prep (FMP) wrapper
 *
 * Phase 1B provider used by:
 *   - `get_earnings_calendar` (multi-ticker upcoming earnings)
 *   - `get_recent_news` (one of three news sources, deduped)
 *
 * Auth: `FMP_API_KEY` from env. We use the current `/stable/`
 * endpoints (v3 endpoints were retired and now return HTTP 403):
 *   - GET https://financialmodelingprep.com/stable/earnings-calendar?from=...&to=...
 *   - GET https://financialmodelingprep.com/stable/earnings?symbol=AAPL
 *   - GET https://financialmodelingprep.com/stable/news/stock?symbols=NVDA&limit=20
 *
 * Calls go through `sessionCache` so chained handlers (preflight +
 * model tool calls in the same turn) only hit the API once.
 */

import { sessionCache } from '../cache';
import { log } from '../utils';

const FMP_BASE = 'https://financialmodelingprep.com/stable';

function getApiKey(): string | null {
  return process.env.FMP_API_KEY ?? null;
}

/**
 * Module-level flag so the "FMP_API_KEY missing" warning fires
 * **once per process** rather than on every preflight that touches
 * an FMP-backed signal. The behaviour (skip the fetch + return
 * null) is unchanged; this just keeps the dev console quiet.
 */
let warnedMissingFmpKey = false;

async function fmpFetch<T>(
  path: string,
  query: Record<string, string | number | undefined>,
  cacheKey: string,
  cacheTtlMs: number
): Promise<T | null> {
  const key = getApiKey();
  if (!key) {
    if (!warnedMissingFmpKey) {
      warnedMissingFmpKey = true;
      log.warn(
        '[fmp] FMP_API_KEY missing; skipping fetch. (Logged once per process.)'
      );
    }
    return null;
  }

  return sessionCache.getOrFetch<T | null>(
    cacheKey,
    async () => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          params.set(k, String(v));
        }
      }
      params.set('apikey', key);
      const url = `${FMP_BASE}${path}?${params.toString()}`;

      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          log.warn(`[fmp] ${path} HTTP ${res.status}: ${text.slice(0, 120)}`);
          return null;
        }
        return (await res.json()) as T;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn(`[fmp] ${path} error: ${message}`);
        return null;
      }
    },
    cacheTtlMs
  );
}

// ============================================================================
// EARNINGS CALENDAR
// ============================================================================

export interface FmpEarningsRow {
  date: string;
  symbol: string;
  /** Reported EPS, null if not yet reported. */
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  lastUpdated?: string;
}

/**
 * Fetch the global earnings calendar for [today, today+days].
 * Returns null on configuration / network failure.
 *
 * Optionally narrows to specific tickers in-process (the FMP endpoint
 * returns the global calendar; we filter client-side).
 */
export async function fetchFmpEarningsCalendar(options?: {
  days?: number;
  tickers?: string[];
}): Promise<FmpEarningsRow[] | null> {
  const days = clamp(options?.days ?? 7, 1, 30);
  const from = todayIso();
  const to = isoDaysFromNow(days);
  const all = await fmpFetch<FmpEarningsRow[]>(
    '/earnings-calendar',
    { from, to },
    `fmp:earnings:${from}:${to}`,
    5 * 60 * 1000
  );
  if (!all) return null;
  if (!options?.tickers || options.tickers.length === 0) return all;
  const allow = new Set(options.tickers.map((t) => t.toUpperCase()));
  return all.filter((row) => allow.has(row.symbol.toUpperCase()));
}

// ============================================================================
// STOCK NEWS
// ============================================================================

export interface FmpNewsRow {
  symbol: string | null;
  publishedDate: string;
  publisher?: string | null;
  title: string;
  image?: string | null;
  /** Some endpoints return `site`, others `publisher` — prefer publisher. */
  site?: string;
  text?: string;
  url: string;
}

export async function fetchFmpStockNews(options: {
  ticker: string;
  limit?: number;
}): Promise<FmpNewsRow[] | null> {
  const { ticker, limit = 20 } = options;
  const cacheKey = `fmp:news:${ticker.toUpperCase()}:${limit}`;
  return fmpFetch<FmpNewsRow[]>(
    '/news/stock',
    { symbols: ticker.toUpperCase(), limit },
    cacheKey,
    5 * 60 * 1000
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Diagnostics: returns whether FMP is configured (used by docs / health). */
export function isFmpConfigured(): boolean {
  return getApiKey() !== null;
}
