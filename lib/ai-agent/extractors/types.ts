/**
 * Extractor types
 *
 * Phase 1C: each preflight signal goes through an extractor that
 * compresses raw payload into a structured digest the model reasons
 * over. The point is to keep the system prompt small and avoid
 * dumping firehoses of raw articles or financials.
 *
 * Extractors are pure deterministic functions today; Phase 3 will swap
 * in model-driven extraction for the harder ones (news, sentiment),
 * but the function shape stays the same.
 */

export interface NewsCatalystDigest {
  /** Catalyst type tag (earnings / regulatory / macro / etc.). */
  type:
    | 'EARNINGS'
    | 'REGULATORY'
    | 'MACRO'
    | 'COMPETITIVE'
    | 'LEGAL'
    | 'GUIDANCE'
    | 'ANALYST'
    | 'UNKNOWN';
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface NewsRiskFlag {
  kind: string;
  detail: string;
}

export interface NewsDigest {
  /** Overall sentiment (-1..1). */
  sentiment: { score: number; label: string };
  /** Detected catalysts. */
  catalysts: NewsCatalystDigest[];
  /** Risk flags worth surfacing in the prompt. */
  risk_flags: NewsRiskFlag[];
  /** Echo for transparency. */
  article_count: number;
}

export interface SentimentDigest {
  score: number;
  label: string;
  /** Trailing-24h vs preceding-24h delta. `null` if too few articles. */
  momentum: number | null;
  /**
   * Divergences between sentiment direction and price direction. Phase
   * 1 keeps this an empty array — populating it requires combining
   * sentiment with the ticker's recent return, which the preflight
   * passes through as a separate signal.
   */
  divergences: { kind: string; detail: string }[];
  article_count: number;
}

export interface FundamentalsDigest {
  /** Overall strength bucket. */
  strength: 'STRONG' | 'NEUTRAL' | 'WEAK';
  /** Notable green flags. */
  positives: string[];
  /** Concrete red flags worth raising in the response. */
  red_flags: string[];
  /** Compact peer-comparison verdict. Phase 1 leaves null. */
  comparison: string | null;
}
