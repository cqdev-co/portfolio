/**
 * Retry utilities with exponential backoff
 */

import { CONFIG } from '../config';
import { logger } from './logger';

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry on rate limit errors
 *
 * Uses exponential backoff for 429 errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= CONFIG.retry.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMsg = String(error);

      // Check if it's a rate limit error
      const isRateLimit =
        errorMsg.includes('429') || errorMsg.includes('Too Many');

      // Don't retry non-rate-limit errors or on last attempt
      if (!isRateLimit || attempt === CONFIG.retry.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1),
        CONFIG.retry.maxDelayMs
      );

      logger.warn(
        `[Retry] ${label} attempt ${attempt}/${CONFIG.retry.maxAttempts}, ` +
          `waiting ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}
