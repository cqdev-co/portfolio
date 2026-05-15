/**
 * Preflight types
 *
 * Shared types for the deterministic context fan-out used by every
 * Xylo turn. The runner produces a `PreflightResult` whose
 * `coverage` field is what gets surfaced in the chat UI and persisted
 * to `agent_decisions.coverage_report`.
 */

import type { QuestionClassification, SignalKey } from '../classification';

/**
 * One row in `coverage.errors` — preserves which signal failed and why
 * so the UI / decision log can show the failure mode without leaking
 * stack traces.
 */
export interface CoverageError {
  signal: SignalKey;
  message: string;
}

/**
 * Per-signal latency record, used both for per-row diagnostics and for
 * the eventual Phase 2 confidence score (slow signals can degrade
 * confidence even when they succeed).
 */
export interface SignalLatency {
  signal: SignalKey;
  latency_ms: number;
  ok: boolean;
}

/**
 * Per-signal compact digest. Phase 1C: each digest is the structured
 * compression of a fetched signal's raw payload, suitable for the UI
 * strip and for downstream Phase 2 confidence scoring. Only signals
 * with a real extractor produce a digest entry.
 *
 * Untyped here (an `unknown` variant per signal) to keep the
 * `preflight/` module from importing the entire extractor type tree.
 */
export type CoverageDigests = Partial<Record<SignalKey, unknown>>;

/**
 * Coverage report shape (also the JSONB shape persisted to
 * `agent_decisions.coverage_report` per
 * `db/schema/08_agent_decisions.sql`).
 *
 * - `checked` : signals that were required AND fetched successfully.
 * - `skipped` : signals not required by the classifier for this turn.
 * - `stale`   : signals fetched but flagged as older than freshness threshold.
 * - `errors`  : signals required but failed to fetch.
 * - `digests` : Phase 1C — per-signal compact digest from extractors.
 *
 * The current shape is forward-compatible — additional fields can be
 * appended without a schema change.
 */
export interface CoverageReport {
  checked: SignalKey[];
  skipped: SignalKey[];
  stale: SignalKey[];
  errors: CoverageError[];
  /** Per-signal timings for observability. */
  latencies?: SignalLatency[];
  /** Phase 1C: structured digests for signals that have an extractor. */
  digests?: CoverageDigests;
}

/**
 * Result of one preflight run.
 *
 * `signals` carries the raw fetched payload per signal. PR C will
 * replace consumers' use of this with extractor digests, but the raw
 * blobs remain available so model tool-calls can drill into them.
 *
 * `formattedContext` is the assembled `LIVE DATA` block, ready to
 * concatenate onto the system prompt.
 */
export interface PreflightResult {
  classification: QuestionClassification;
  signals: Partial<Record<SignalKey, unknown>>;
  formattedContext: string;
  coverage: CoverageReport;
  total_latency_ms: number;
}

/** Options accepted by `runPreflight`. */
export interface PreflightOptions {
  /** Use TOON for ticker / regime / calendar formatting (default true). */
  useTOON?: boolean;
  /** Optional override for tickers (skips re-extraction). */
  tickers?: string[];
  /**
   * If provided, bypass classification and force a specific
   * `signalRequirements` bundle. Useful for tests.
   */
  forceSignals?: import('../classification').SignalRequirements;
}
