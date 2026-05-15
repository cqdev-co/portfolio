/**
 * Confidence scoring
 *
 * Phase 2 PR C: combine PR 1's coverage report and PR A's risk verdict
 * (plus a small "signal agreement" lookup over the digests) into a
 * single 0-10 score that gets persisted to `agent_decisions.confidence`
 * and rendered in the chat UI.
 *
 * Formula (deterministic, pure function — easy to unit test, easy to
 * reason about, easy to inspect when calibration data lands in
 * Phase 4):
 *
 *   coverage_completeness = checked / (checked + skipped_required)
 *   signal_agreement       = direction-alignment over (news, sector, regime)
 *   risk_pass              = 1.0 if approved, 0.5 if WARN-only, 0.0 if BLOCKed
 *
 *   confidence = round(
 *     10 * (
 *       0.4 * coverage_completeness +
 *       0.3 * signal_agreement +
 *       0.3 * risk_pass
 *     )
 *   )
 *
 * Edge cases handled:
 *   - No recommendation parsed → return null (don't compute confidence
 *     for chat / general questions).
 *   - No directional signals available → signal_agreement = 0.5 (neutral).
 *   - No risk verdict (gate skipped) → risk_pass = 0.5 (neutral).
 */

import type { CoverageReport } from '../preflight';
import type { RiskVerdict } from '../risk';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfidenceComponents {
  coverage_completeness: number;
  signal_agreement: number;
  risk_pass: number;
}

export interface ConfidenceScore {
  /** 0-10, integer. */
  score: number;
  /** Each component on 0-1. */
  components: ConfidenceComponents;
}

export interface ComputeConfidenceInput {
  coverage: CoverageReport | null;
  riskVerdict: RiskVerdict | null;
  /**
   * Recommendation action, if available — used to decide whether to
   * compute at all. Pass null/undefined for chat-style turns.
   */
  action?: string | null;
}

// ============================================================================
// MAIN
// ============================================================================

const ACTIONABLE_ACTIONS = new Set([
  'BUY',
  'WAIT',
  'AVOID',
  'HOLD',
  'TRIM',
  'EXIT',
  'ROLL',
  'ADD',
]);

/**
 * Compute the confidence score for a Xylo recommendation. Returns
 * null when the turn isn't an actionable recommendation (general
 * chat, research questions).
 */
export function computeConfidence(
  input: ComputeConfidenceInput
): ConfidenceScore | null {
  if (!input.action || !ACTIONABLE_ACTIONS.has(input.action)) {
    return null;
  }

  const coverage_completeness = computeCoverageCompleteness(input.coverage);
  const signal_agreement = computeSignalAgreement(input.coverage);
  const risk_pass = computeRiskPass(input.riskVerdict);

  const raw =
    0.4 * coverage_completeness + 0.3 * signal_agreement + 0.3 * risk_pass;
  const score = Math.round(10 * clamp(raw, 0, 1));

  return {
    score,
    components: {
      coverage_completeness: round2(coverage_completeness),
      signal_agreement: round2(signal_agreement),
      risk_pass: round2(risk_pass),
    },
  };
}

// ============================================================================
// COMPONENT CALCULATIONS
// ============================================================================

function computeCoverageCompleteness(coverage: CoverageReport | null): number {
  if (!coverage) return 0.5; // unknown → neutral
  const checked = coverage.checked.length;
  // For "completeness", a skipped signal counts against us only if it
  // was REQUIRED. The classifier marks unrequired ones as `skipped` for
  // bookkeeping; an empty errors array means no required signal failed.
  // Treat the checked / (checked + errors) ratio as the floor; bump to
  // 1.0 when there were no errors and at least one signal was checked.
  const errors = coverage.errors.length;
  if (checked === 0 && errors === 0) return 0.5;
  if (checked + errors === 0) return 0.5;
  return checked / (checked + errors);
}

/**
 * Use whichever directional digests are present (news sentiment +
 * sentiment label) to estimate alignment. Returns 0.5 neutral if
 * fewer than 2 directional signals are available.
 *
 * - Bullish news + risk-on regime / leaders → 1.0.
 * - Bearish news + risk-off regime → 1.0 (aligned in disagreement).
 * - Bullish + bearish disagreement → 0.0.
 */
function computeSignalAgreement(coverage: CoverageReport | null): number {
  if (!coverage?.digests) return 0.5;
  const directions: number[] = [];

  const newsDigest = coverage.digests.news as
    | { sentiment?: { score?: number } }
    | undefined;
  if (newsDigest?.sentiment?.score != null) {
    directions.push(Math.sign(newsDigest.sentiment.score));
  }

  const sentimentDigest = coverage.digests.sentiment as
    | { score?: number }
    | undefined;
  if (sentimentDigest?.score != null) {
    directions.push(Math.sign(sentimentDigest.score));
  }

  // Treat fundamentals direction as "STRONG"=+1, "WEAK"=-1, "NEUTRAL"=0.
  const fundDigest = coverage.digests.fundamentals as
    | { strength?: 'STRONG' | 'NEUTRAL' | 'WEAK' }
    | undefined;
  if (fundDigest?.strength === 'STRONG') directions.push(1);
  if (fundDigest?.strength === 'WEAK') directions.push(-1);

  const nonZero = directions.filter((d) => d !== 0);
  if (nonZero.length < 2) return 0.5;

  // Agreement = |sum| / count: 1.0 when all same sign, 0.0 when mixed.
  const sum = nonZero.reduce((a, b) => a + b, 0);
  return Math.abs(sum) / nonZero.length;
}

function computeRiskPass(verdict: RiskVerdict | null): number {
  if (!verdict || verdict.gate_skipped) return 0.5;
  if (verdict.approved) {
    // Approved with WARN-only violations docks half a point so the
    // operator sees that the call wasn't pristine.
    return verdict.violations.length === 0 ? 1 : 0.85;
  }
  return 0;
}

// ============================================================================
// HELPERS
// ============================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
