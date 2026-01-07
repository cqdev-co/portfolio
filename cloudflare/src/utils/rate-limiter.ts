/**
 * Rate Limiter for Yahoo Finance API
 *
 * Yahoo allows ~10-20 requests/second per IP.
 * This queue ensures we don't exceed limits.
 */

import { logger } from './logger';

// Request queue state (in-memory, per worker instance)
let lastRequestTime = 0;
const MIN_DELAY_MS = 100; // 100ms between requests = 10 req/sec max

/**
 * Wait for rate limit slot
 * Ensures minimum delay between Yahoo requests
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Execute a function with rate limiting
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  await waitForRateLimit();
  logger.debug(`[RateLimit] Executing: ${label}`);
  return fn();
}
