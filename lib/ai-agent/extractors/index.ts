/**
 * Extractors barrel — `lib/ai-agent/extractors/`
 *
 * Phase 1C: pure deterministic extractors that compress raw signal
 * payloads into structured digests for the system prompt + the
 * `coverage_report.digests` field.
 */

export { extractNews } from './news';
export { extractSentiment } from './sentiment';
export { extractFundamentals } from './fundamentals';

export type {
  NewsDigest,
  NewsCatalystDigest,
  NewsRiskFlag,
  SentimentDigest,
  FundamentalsDigest,
} from './types';
