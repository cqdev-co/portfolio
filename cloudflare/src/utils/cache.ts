/**
 * Cloudflare Cache API wrapper
 */

import { logger } from './logger';

const CACHE_PREFIX = 'https://yahoo-cache.internal';

/**
 * Generate a cache key for a specific type and optional ticker
 */
export function getCacheKey(type: string, ticker?: string): string {
  if (ticker) {
    return `${CACHE_PREFIX}/${type}/${ticker.toUpperCase()}`;
  }
  return `${CACHE_PREFIX}/${type}`;
}

/**
 * Get data from cache with age information
 */
export async function getFromCache<T>(cacheKey: string): Promise<{
  data: T;
  age: number;
} | null> {
  try {
    const cache = caches.default;
    const response = await cache.match(new Request(cacheKey));

    if (!response) return null;

    const data = (await response.json()) as T;
    const cachedAt = response.headers.get('X-Cached-At');
    const age = cachedAt
      ? Math.floor((Date.now() - parseInt(cachedAt)) / 1000)
      : 0;

    return { data, age };
  } catch {
    return null;
  }
}

/**
 * Store data in cache with TTL
 */
export async function storeInCache(
  cacheKey: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const cache = caches.default;
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'X-Cached-At': Date.now().toString(),
        'Cache-Control': `max-age=${ttlSeconds}`,
      },
    });
    await cache.put(new Request(cacheKey), response);
  } catch (e) {
    logger.error('[Cache] Store failed:', e);
  }
}

/**
 * Delete from cache
 */
export async function deleteFromCache(cacheKey: string): Promise<boolean> {
  try {
    const cache = caches.default;
    return await cache.delete(new Request(cacheKey));
  } catch {
    return false;
  }
}
