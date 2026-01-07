/**
 * Yahoo Finance Authentication (Crumb Flow)
 *
 * Yahoo requires a crumb token for API requests.
 * This module handles fetching and caching the crumb.
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { logger } from '../utils/logger';
import type { YahooAuth } from '../types';

/**
 * Get Yahoo auth credentials (cookies + crumb)
 *
 * Returns cached credentials if available, otherwise fetches new ones.
 */
export async function getYahooAuth(): Promise<YahooAuth> {
  const cacheKey = getCacheKey('auth');
  const cached = await getFromCache<YahooAuth>(cacheKey);

  if (cached) {
    logger.debug(`[Auth] Using cached crumb (age: ${cached.age}s)`);
    return cached.data;
  }

  logger.debug('[Auth] Fetching new crumb...');

  // Step 1: Get cookies from Yahoo
  const cookieResponse = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': CONFIG.userAgent },
    redirect: 'manual',
  });

  // Extract cookies from response
  // Note: getSetCookie is available in Workers runtime but not in DOM types
  const headers = cookieResponse.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    headers.getSetCookie?.() ||
    [cookieResponse.headers.get('set-cookie')].filter(Boolean);

  const cookies = setCookies
    .map((c: string | null | undefined) => c?.split(';')[0])
    .filter(Boolean)
    .join('; ');

  if (!cookies) {
    throw new Error('Failed to get cookies from Yahoo');
  }

  // Step 2: Get crumb using cookies
  const crumbResponse = await fetch(
    'https://query1.finance.yahoo.com/v1/test/getcrumb',
    {
      headers: {
        'User-Agent': CONFIG.userAgent,
        Cookie: cookies,
      },
    }
  );

  if (!crumbResponse.ok) {
    throw new Error(`Crumb request failed: ${crumbResponse.status}`);
  }

  const crumb = await crumbResponse.text();

  if (!crumb || crumb.includes('Too Many')) {
    throw new Error('Failed to get crumb: ' + crumb);
  }

  // Cache the auth for future requests
  const auth: YahooAuth = { cookies, crumb };
  await storeInCache(cacheKey, auth, CONFIG.cache.crumb);
  logger.debug('[Auth] Cached new crumb');

  return auth;
}

/**
 * Fetch from Yahoo API with authentication
 */
export async function fetchYahooAPI<T>(
  endpoint: string,
  auth: YahooAuth
): Promise<T> {
  // Add crumb to URL
  const url = endpoint.includes('?')
    ? `${endpoint}&crumb=${encodeURIComponent(auth.crumb)}`
    : `${endpoint}?crumb=${encodeURIComponent(auth.crumb)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': CONFIG.userAgent,
      Cookie: auth.cookies,
    },
  });

  const text = await response.text();

  // Check for rate limiting
  if (text.includes('Too Many Requests')) {
    throw new Error('429 Too Many Requests');
  }

  if (!response.ok) {
    throw new Error(`Yahoo API error ${response.status}: ${text}`);
  }

  return JSON.parse(text) as T;
}
