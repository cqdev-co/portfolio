/**
 * News extractor
 *
 * Phase 1C: compress a `RecentNewsResult` (raw articles array) into a
 * `NewsDigest` (sentiment + catalysts + risk flags). Pure
 * deterministic — uses the lexicon-based scorer + a small regex map for
 * catalyst classification.
 */

import { scoreHeadline } from '../sentiment';
import type { RecentNewsResult } from '../data/news';
import type { NewsCatalystDigest, NewsDigest, NewsRiskFlag } from './types';

interface CatalystPattern {
  pattern: RegExp;
  type: NewsCatalystDigest['type'];
  detail: string;
}

const CATALYST_PATTERNS: CatalystPattern[] = [
  {
    pattern: /\bearnings|quarterly|q[1-4]\s|fiscal/i,
    type: 'EARNINGS',
    detail: 'earnings-related headline',
  },
  {
    pattern: /\b(fda|sec|ftc|doj|antitrust|regulator)\b/i,
    type: 'REGULATORY',
    detail: 'regulatory-action headline',
  },
  {
    pattern: /\b(fed|fomc|rate|cpi|ppi|inflation|gdp|jobs)\b/i,
    type: 'MACRO',
    detail: 'macro-event headline',
  },
  {
    pattern: /\b(compet|rival|market\s+share|disrupt)/i,
    type: 'COMPETITIVE',
    detail: 'competitive-pressure headline',
  },
  {
    pattern: /\b(lawsuit|legal|court|settlement|litigation)\b/i,
    type: 'LEGAL',
    detail: 'legal headline',
  },
  {
    pattern: /\b(guidance|outlook|forecast|raises|cuts|warns)\b/i,
    type: 'GUIDANCE',
    detail: 'guidance / outlook headline',
  },
  {
    pattern: /\b(upgrade|downgrade|price\s+target|analyst)\b/i,
    type: 'ANALYST',
    detail: 'analyst-action headline',
  },
];

const RISK_PATTERNS: { pattern: RegExp; kind: string; detail: string }[] = [
  {
    pattern: /\b(layoff|restructur|bankrupt)\b/i,
    kind: 'restructuring',
    detail: 'layoff / restructuring language detected',
  },
  {
    pattern: /\b(probe|investigat|fraud|sec\s+charge)\b/i,
    kind: 'investigation',
    detail: 'investigation / fraud language detected',
  },
  {
    pattern: /\b(recall|defect)\b/i,
    kind: 'recall',
    detail: 'product recall / defect language detected',
  },
  {
    pattern: /\b(tariff|sanction|ban)\b/i,
    kind: 'policy',
    detail: 'tariff / sanction / ban language detected',
  },
];

/**
 * Compress a recent-news bundle into a structured digest.
 *
 * - `sentiment` is the mean per-headline score, clamped to [-1, 1].
 * - `catalysts` are the first matching catalyst pattern per article
 *   (one tag per article max), deduped by `(type, detail)`.
 * - `risk_flags` are pattern-driven and capped at 5 to keep the prompt
 *   compact.
 */
export function extractNews(input: RecentNewsResult): NewsDigest {
  const articles = input.articles ?? [];
  let total = 0;
  const catalysts: NewsCatalystDigest[] = [];
  const seenCatalysts = new Set<string>();
  const risk_flags: NewsRiskFlag[] = [];
  const seenRisks = new Set<string>();

  for (const a of articles) {
    const r = scoreHeadline(a.title);
    total += r.score;

    for (const p of CATALYST_PATTERNS) {
      if (p.pattern.test(a.title)) {
        const key = `${p.type}:${p.detail}`;
        if (!seenCatalysts.has(key)) {
          seenCatalysts.add(key);
          catalysts.push({
            type: p.type,
            detail: a.title,
            // High confidence if multiple words match; low otherwise.
            // For Phase 1 we keep this binary — high if catalyst pattern
            // hits AND headline has at least one strong-sentiment word.
            confidence:
              Math.abs(r.score) >= 0.6
                ? 'high'
                : Math.abs(r.score) >= 0.3
                  ? 'medium'
                  : 'low',
          });
        }
        break; // first match wins per article
      }
    }

    for (const p of RISK_PATTERNS) {
      if (p.pattern.test(a.title) && !seenRisks.has(p.kind)) {
        seenRisks.add(p.kind);
        risk_flags.push({ kind: p.kind, detail: p.detail });
        if (risk_flags.length >= 5) break;
      }
    }
  }

  const mean = articles.length > 0 ? total / articles.length : 0;
  const score = clamp(mean, -1, 1);

  return {
    sentiment: { score, label: labelFor(score) },
    catalysts: catalysts.slice(0, 5),
    risk_flags,
    article_count: articles.length,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function labelFor(score: number): string {
  if (score >= 0.5) return 'very_bullish';
  if (score >= 0.15) return 'bullish';
  if (score <= -0.5) return 'very_bearish';
  if (score <= -0.15) return 'bearish';
  return 'neutral';
}
