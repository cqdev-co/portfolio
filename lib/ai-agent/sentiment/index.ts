/**
 * Sentiment module
 *
 * Phase 1 — `scoreHeadline()` and `scoreHeadlines()` produce a
 * composite sentiment number derived from a curated lexicon (see
 * `./lexicon.ts`). Used by:
 *   - `get_sentiment` tool handler
 *   - `runPreflight` when `signalRequirements.sentiment` is set
 *
 * Phase 3+ replaces the lexicon with model-driven extraction; the
 * function shape is forward-compatible.
 */

import { BULLISH_SIGNALS, BEARISH_SIGNALS } from './lexicon';

export type SentimentLabel =
  | 'VERY_BEARISH'
  | 'BEARISH'
  | 'NEUTRAL'
  | 'BULLISH'
  | 'VERY_BULLISH';

export interface HeadlineScore {
  /** Raw lexicon score (positive = bullish). NOT clamped to [-1, 1]. */
  score: number;
  /** Bullish signal words found. */
  bullish: string[];
  /** Bearish signal words found. */
  bearish: string[];
}

export interface HeadlineInput {
  title: string;
  /** Optional ISO timestamp; used by `scoreHeadlines()` for momentum. */
  published_at?: string | null;
}

export interface SentimentScore {
  /** Mean per-headline score, clamped to [-1, 1]. */
  score: number;
  label: SentimentLabel;
  /** Number of headlines scored. */
  article_count: number;
  /**
   * Momentum: mean score of trailing-`window`-hours minus mean score
   * of preceding `window` hours. `null` if there isn't enough data.
   */
  momentum: number | null;
  /** Aggregate signal counts for transparency. */
  signal_counts: { bullish: number; bearish: number };
}

// ============================================================================
// CORE SCORING
// ============================================================================

/**
 * Score a single headline using the lexicon. Returns the raw weighted
 * sum (positive = bullish, negative = bearish) plus the words that
 * contributed.
 */
export function scoreHeadline(headline: string): HeadlineScore {
  const lower = headline.toLowerCase();
  let score = 0;
  const bullish: string[] = [];
  const bearish: string[] = [];

  for (const [word, weight] of Object.entries(BULLISH_SIGNALS)) {
    if (lower.includes(word)) {
      score += weight;
      bullish.push(word);
    }
  }
  for (const [word, weight] of Object.entries(BEARISH_SIGNALS)) {
    if (lower.includes(word)) {
      score -= weight;
      bearish.push(word);
    }
  }
  return { score, bullish, bearish };
}

/**
 * Score a batch of headlines into a composite `SentimentScore` with
 * momentum (trailing 24h vs preceding 24h, by default).
 */
export function scoreHeadlines(
  headlines: HeadlineInput[],
  options?: { momentumWindowHours?: number }
): SentimentScore {
  const windowHours = options?.momentumWindowHours ?? 24;
  let totalBullish = 0;
  let totalBearish = 0;
  let total = 0;
  const scoredArticles: { score: number; ts: number | null }[] = [];

  for (const h of headlines) {
    const r = scoreHeadline(h.title);
    total += r.score;
    totalBullish += r.bullish.length;
    totalBearish += r.bearish.length;
    scoredArticles.push({
      score: r.score,
      ts: h.published_at ? Date.parse(h.published_at) : null,
    });
  }

  const article_count = headlines.length;
  const mean = article_count > 0 ? total / article_count : 0;
  const score = clamp(mean, -1, 1);

  // Momentum: split by `now - windowHours`.
  let momentum: number | null = null;
  const cutoff = Date.now() - windowHours * 3600_000;
  const recent = scoredArticles.filter((a) => a.ts !== null && a.ts >= cutoff);
  const older = scoredArticles.filter((a) => a.ts !== null && a.ts < cutoff);
  if (recent.length >= 2 && older.length >= 2) {
    const recentMean = mean_(recent.map((a) => a.score));
    const olderMean = mean_(older.map((a) => a.score));
    momentum = clamp(recentMean - olderMean, -1, 1);
  }

  return {
    score,
    label: labelFor(score),
    article_count,
    momentum,
    signal_counts: { bullish: totalBullish, bearish: totalBearish },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mean_(arr: number[]): number {
  if (arr.length === 0) return 0;
  let total = 0;
  for (const v of arr) total += v;
  return total / arr.length;
}

function labelFor(score: number): SentimentLabel {
  if (score >= 0.5) return 'VERY_BULLISH';
  if (score >= 0.15) return 'BULLISH';
  if (score <= -0.5) return 'VERY_BEARISH';
  if (score <= -0.15) return 'BEARISH';
  return 'NEUTRAL';
}

export { BULLISH_SIGNALS, BEARISH_SIGNALS } from './lexicon';
