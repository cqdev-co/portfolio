/**
 * Options Chain Fetching
 *
 * Fetches REAL options data from Yahoo Finance.
 * This is the same logic used by the CLI (ai-analyst).
 */

import type { OptionsChain, OptionContract } from './types';

// ============================================================================
// RATE LIMITING
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestTime = 0;
const MIN_REQUEST_DELAY_MS = 1500; // 1.5s between requests

async function rateLimitedRequest<T>(
  fn: () => Promise<T>,
  retries = 4,
  baseDelay = 3000 // Start with 3s delay
): Promise<T> {
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < MIN_REQUEST_DELAY_MS) {
    await sleep(MIN_REQUEST_DELAY_MS - timeSince);
  }
  lastRequestTime = Date.now();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message.toLowerCase();
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('too many requests') ||
        msg.includes('crumb');

      if (isRateLimit && attempt < retries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `[Options] Rate limited, waiting ${Math.round(delay / 1000)}s...`
        );
        await sleep(delay);
        lastRequestTime = Date.now();
      } else if (!isRateLimit) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Unknown error after retries');
}

// ============================================================================
// OPTIONS CHAIN FETCHING
// ============================================================================

/**
 * Fetch options chain for a symbol
 *
 * @param symbol - Ticker symbol
 * @param targetDTE - Target days to expiration (default 30)
 * @returns Options chain with calls and puts, or null if unavailable
 */
export async function getOptionsChain(
  symbol: string,
  targetDTE: number = 30
): Promise<OptionsChain | null> {
  try {
    // Dynamic import for yahoo-finance2
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    // Get quote for underlying price (with rate limiting)
    const quote = await rateLimitedRequest(() => yahooFinance.quote(symbol));
    const underlyingPrice = quote?.regularMarketPrice;
    if (!underlyingPrice) return null;

    // Get available expiration dates (with rate limiting)
    const expirations = await rateLimitedRequest(() =>
      yahooFinance.options(symbol)
    );
    if (!expirations?.expirationDates?.length) return null;

    // Find expiration closest to target DTE
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + targetDTE);

    let closestExp = expirations.expirationDates[0];
    let closestDiff = Math.abs(closestExp.getTime() - targetDate.getTime());

    for (const exp of expirations.expirationDates) {
      const diff = Math.abs(exp.getTime() - targetDate.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closestExp = exp;
      }
    }

    // Fetch options for that expiration (with rate limiting)
    const chain = await rateLimitedRequest(() =>
      yahooFinance.options(symbol, { date: closestExp })
    );
    if (!chain?.options?.[0]) return null;

    const opts = chain.options[0];
    const dte = Math.ceil(
      (closestExp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const calls: OptionContract[] = (opts.calls ?? []).map(
      (c: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }) => ({
        strike: c.strike,
        expiration: closestExp,
        bid: c.bid ?? 0,
        ask: c.ask ?? 0,
        mid: ((c.bid ?? 0) + (c.ask ?? 0)) / 2,
        openInterest: c.openInterest ?? 0,
        volume: c.volume ?? 0,
        impliedVolatility: c.impliedVolatility ?? 0,
        inTheMoney: c.inTheMoney ?? c.strike < underlyingPrice,
      })
    );

    const puts: OptionContract[] = (opts.puts ?? []).map(
      (p: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }) => ({
        strike: p.strike,
        expiration: closestExp,
        bid: p.bid ?? 0,
        ask: p.ask ?? 0,
        mid: ((p.bid ?? 0) + (p.ask ?? 0)) / 2,
        openInterest: p.openInterest ?? 0,
        volume: p.volume ?? 0,
        impliedVolatility: p.impliedVolatility ?? 0,
        inTheMoney: p.inTheMoney ?? p.strike > underlyingPrice,
      })
    );

    return {
      calls,
      puts,
      expiration: closestExp,
      dte,
      underlyingPrice,
    };
  } catch (error) {
    console.error(`[Options] Failed to fetch chain for ${symbol}:`, error);
    return null;
  }
}
