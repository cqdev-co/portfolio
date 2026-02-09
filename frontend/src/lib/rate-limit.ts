/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window approach with automatic cleanup.
 * Suitable for single-instance deployments (Vercel serverless
 * may not share memory across invocations, but this still
 * protects against rapid bursts within the same instance).
 *
 * For production multi-instance rate limiting, consider
 * @upstash/ratelimit with Redis.
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *
 * export async function POST(req: Request) {
 *   const ip = req.headers.get('x-forwarded-for') || 'unknown';
 *   const { allowed, remaining } = limiter.check(ip);
 *   if (!allowed) {
 *     return new Response('Too many requests', { status: 429 });
 *   }
 *   // ... handle request
 * }
 * ```
 */

interface RateLimiterOptions {
  /** Maximum requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Timestamp when the window resets (ms since epoch) */
  resetAt: number;
}

interface RateLimiterEntry {
  timestamps: number[];
}

/**
 * Create a rate limiter instance.
 *
 * Each instance maintains its own in-memory store of request timestamps
 * per key (typically user email or IP address).
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimiterEntry>();

  // Periodic cleanup to prevent memory leaks
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
      // Remove entries with no recent timestamps
      const recent = entry.timestamps.filter((t) => now - t < options.windowMs);
      if (recent.length === 0) {
        store.delete(key);
      } else {
        entry.timestamps = recent;
      }
    }
  }

  function check(key: string): RateLimitResult {
    cleanup();

    const now = Date.now();
    const windowStart = now - options.windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= options.maxRequests) {
      // Rate limited
      const oldestInWindow = entry.timestamps[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + options.windowMs,
      };
    }

    // Allow and record
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: options.maxRequests - entry.timestamps.length,
      resetAt: now + options.windowMs,
    };
  }

  return { check };
}

/**
 * Pre-configured rate limiter for the AI chat endpoint.
 * Default: 20 requests per 60 seconds per user.
 */
export const chatRateLimiter = createRateLimiter({
  maxRequests: parseInt(process.env.AI_CHAT_RATE_LIMIT || '20', 10),
  windowMs: parseInt(process.env.AI_CHAT_RATE_WINDOW_MS || '60000', 10),
});

/**
 * Pre-configured rate limiter for general API endpoints.
 * Default: 60 requests per 60 seconds per IP.
 */
export const apiRateLimiter = createRateLimiter({
  maxRequests: 60,
  windowMs: 60_000,
});
