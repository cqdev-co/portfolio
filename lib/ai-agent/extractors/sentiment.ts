/**
 * Sentiment extractor
 *
 * Phase 1C: thin wrapper that converts a `SentimentScore` (already
 * lexicon-derived) into the canonical `SentimentDigest` shape used in
 * `coverage_report.digests`.
 *
 * Divergence detection is intentionally Phase 2-shaped: the function
 * accepts an optional `priceChangePct` so the caller can flag
 * sentiment-vs-price disagreement when both are available.
 */

import type { SentimentScore } from '../sentiment';
import type { SentimentDigest } from './types';

export function extractSentiment(
  input: SentimentScore,
  context?: { priceChangePct?: number }
): SentimentDigest {
  const divergences: SentimentDigest['divergences'] = [];

  // Sentiment-vs-price divergence: bearish news + rising price (or
  // bullish news + falling price). Threshold chosen to avoid noise.
  if (
    typeof context?.priceChangePct === 'number' &&
    Math.abs(input.score) >= 0.15
  ) {
    const sentimentDir = Math.sign(input.score);
    const priceDir = Math.sign(context.priceChangePct);
    if (sentimentDir !== 0 && priceDir !== 0 && sentimentDir !== priceDir) {
      divergences.push({
        kind: 'sentiment_vs_price',
        detail: `News sentiment ${sentimentDir > 0 ? 'bullish' : 'bearish'} (${input.score.toFixed(
          2
        )}) but price ${priceDir > 0 ? 'up' : 'down'} ${context.priceChangePct.toFixed(2)}%`,
      });
    }
  }

  return {
    score: input.score,
    label: input.label,
    momentum: input.momentum,
    divergences,
    article_count: input.article_count,
  };
}
