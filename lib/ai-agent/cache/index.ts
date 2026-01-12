/**
 * Session Cache Module
 *
 * Provides TTL-based caching for expensive data fetches:
 * - Ticker data (60s TTL)
 * - Market regime (5min TTL)
 * - PFV calculations (5min TTL)
 * - Options chains (2min TTL)
 *
 * @example
 * ```typescript
 * import { sessionCache, CACHE_TTL } from '@lib/ai-agent/cache';
 *
 * // Get or fetch ticker data
 * const data = await sessionCache.getOrFetch(
 *   `ticker:${symbol}`,
 *   () => fetchTickerData(symbol),
 *   CACHE_TTL.TICKER
 * );
 * ```
 */

// ============================================================================
// CACHE TTL CONSTANTS
// ============================================================================

/**
 * Cache TTL values in milliseconds
 */
export const CACHE_TTL = {
  /** Ticker data: 60 seconds (price can change) */
  TICKER: 60 * 1000,
  /** Market regime: 5 minutes (VIX/SPY don't change rapidly) */
  REGIME: 5 * 60 * 1000,
  /** PFV calculations: 5 minutes (options data relatively stable) */
  PFV: 5 * 60 * 1000,
  /** Options chains: 2 minutes (more volatile) */
  OPTIONS: 2 * 60 * 1000,
  /** Trade history: 30 minutes (rarely changes) */
  TRADES: 30 * 60 * 1000,
  /** Web search: 10 minutes */
  WEB_SEARCH: 10 * 60 * 1000,
} as const;

// ============================================================================
// CACHE ENTRY TYPE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// SESSION CACHE CLASS
// ============================================================================

/**
 * Generic TTL-based cache for session data
 *
 * Features:
 * - Automatic expiration based on TTL
 * - getOrFetch pattern for lazy loading
 * - Manual invalidation support
 * - Stats tracking for debugging
 */
export class SessionCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  /**
   * Get cached value if valid, otherwise return undefined
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      this.stats.evictions++;
      return undefined;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set a value in the cache with TTL
   */
  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get cached value or fetch and cache it
   * This is the primary method for cache usage
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    this.stats.misses++;
    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix
   * Useful for clearing all ticker data: invalidatePrefix('ticker:')
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    size: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
    };
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Get the age of a cache entry in milliseconds
   * Returns undefined if entry doesn't exist
   */
  getAge(key: string): number | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    return Date.now() - entry.timestamp;
  }

  /**
   * Get remaining TTL for a cache entry
   * Returns undefined if entry doesn't exist or is expired
   */
  getRemainingTTL(key: string): number | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return remaining > 0 ? remaining : undefined;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global session cache instance
 * Use this for all caching needs within a session
 */
export const sessionCache = new SessionCache();

// ============================================================================
// CACHE KEY BUILDERS
// ============================================================================

/**
 * Build standardized cache keys
 * Ensures consistent key format across the codebase
 */
export const CacheKeys = {
  ticker: (symbol: string) => `ticker:${symbol.toUpperCase()}`,
  tickerLite: (symbol: string) => `ticker-lite:${symbol.toUpperCase()}`,
  regime: () => 'market:regime',
  tradingRegime: (ticker?: string) =>
    ticker ? `trading-regime:${ticker.toUpperCase()}` : 'trading-regime:market',
  pfv: (symbol: string) => `pfv:${symbol.toUpperCase()}`,
  options: (symbol: string, dte?: number) =>
    dte ? `options:${symbol.toUpperCase()}:${dte}` : 
          `options:${symbol.toUpperCase()}`,
  spread: (symbol: string, dte: number) =>
    `spread:${symbol.toUpperCase()}:${dte}`,
  trades: (ticker?: string) =>
    ticker ? `trades:${ticker.toUpperCase()}` : 'trades:all',
  webSearch: (query: string) =>
    `web:${query.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}`,
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export default sessionCache;
