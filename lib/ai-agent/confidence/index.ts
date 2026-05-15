/**
 * Confidence barrel — `lib/ai-agent/confidence/`
 *
 * Phase 2 PR C: deterministic confidence score over coverage +
 * risk-gate verdict + signal agreement. See `score.ts`.
 */

export {
  computeConfidence,
  type ConfidenceComponents,
  type ConfidenceScore,
  type ComputeConfidenceInput,
} from './score';
