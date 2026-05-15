/**
 * Eval harness types
 *
 * Phase 2: shared shapes for scenarios, probes, tool-routing tests,
 * runner outputs, and the persisted `agent_eval_runs` row.
 */

import type { CoverageReport } from '../preflight';
import type { RiskVerdict } from '../risk';

// ============================================================================
// FIXTURES
// ============================================================================

export type EvalKind = 'scenario' | 'probe' | 'routing';

/**
 * Historical scenario seeded from `agent_decisions`. Asserts that
 * Xylo's behavior matches a known-good baseline.
 */
export interface Scenario {
  id: string;
  kind: 'scenario';
  source: 'agent_decisions' | 'manual';
  /** Original `agent_decisions.id` if source = 'agent_decisions'. */
  original_id?: string;
  question: string;
  /**
   * Set of signals that MUST appear in `coverage.checked` for the
   * scenario to pass.
   */
  expected_signals?: string[];
  /**
   * If present, the recommendation parsed from the new run must have
   * one of these actions. Use to assert "must be a BUY" or "any of
   * BUY|HOLD".
   */
  expected_action_in?: string[];
  /** If true, the gate must approve the recommendation. */
  expected_approved?: boolean;
  /** Inclusive lower bound for the computed confidence score (0-10). */
  expected_confidence_min?: number;
  /** Inclusive upper bound for the computed confidence score (0-10). */
  expected_confidence_max?: number;
  /**
   * If true, the scenario is considered a regression-blocker; failure
   * causes `xylo:eval` to exit with code 1 (suitable for CI).
   */
  must_pass?: boolean;
}

/**
 * Hallucination probe. Asks something that doesn't have a real
 * answer (fake ticker, fake date) and asserts Xylo refuses to confirm.
 */
export interface Probe {
  id: string;
  kind: 'probe';
  hallucination_kind:
    | 'fake_ticker'
    | 'fake_date'
    | 'fake_earnings'
    | 'fake_news';
  question: string;
  /** Phrases whose presence in the response indicates correct refusal. */
  required_phrases?: string[];
  /** Phrases whose presence indicates a hallucination. */
  forbidden_phrases?: string[];
  must_pass?: boolean;
}

/**
 * Tool-routing assertion. Asks a question that should result in a
 * specific tool call (or no tool calls).
 */
export interface RoutingTest {
  id: string;
  kind: 'routing';
  question: string;
  /** Tools the model MUST call (any of). */
  must_call?: string[];
  /** Tools the model MUST NOT call. */
  must_not_call?: string[];
  must_pass?: boolean;
}

export type EvalFixture = Scenario | Probe | RoutingTest;

// ============================================================================
// RUN OUTPUT
// ============================================================================

/**
 * Result of running one fixture through the agent.
 */
export interface EvalResult {
  id: string;
  kind: EvalKind;
  passed: boolean;
  /**
   * Per-test breakdown of why the assertion held / failed. Empty when
   * passed. One entry per failed assertion.
   */
  failure_reasons: string[];
  /** Wall-clock time spent on this fixture. */
  latency_ms: number;
  /** Tokens charged on this turn (prompt + completion). 0 if unknown. */
  tokens?: number;
  /** Estimated cost in USD if the runner had a price table. */
  cost?: number;
  /** Captured agent output for diagnostics (truncated). */
  response_excerpt?: string;
  /** Tool names that fired during the run. */
  tool_calls?: string[];
  /** Coverage signals checked, when applicable (scenarios). */
  coverage_checked?: string[];
  /** Risk verdict from the gate, when applicable (scenarios). */
  risk_approved?: boolean;
}

/**
 * Aggregate result of one suite run. Mirrors the persisted
 * `agent_eval_runs` row.
 */
export interface EvalRun {
  model_id: string;
  prompt_hash: string;
  git_sha: string | null;

  scenarios_total: number;
  scenarios_passed: number;
  probes_total: number;
  probes_passed: number;
  routing_total: number;
  routing_passed: number;

  total_latency_ms: number;
  total_cost_estimate: number | null;
  avg_tokens: number | null;

  results: EvalResult[];

  /** Whether any `must_pass` fixture failed (drives runner exit code). */
  blocker_failed: boolean;
}

/**
 * Optional captured agent output the runner can pass back from a
 * scenario invocation. Lets scorers reason over the same payload the
 * chat route surfaces (coverage report + risk verdict).
 */
export interface AgentRunOutput {
  text: string;
  coverage?: CoverageReport;
  risk_verdict?: RiskVerdict;
  tools_called?: string[];
  tokens?: number;
  latency_ms?: number;
  /** Phase 2 PR C: 0-10 confidence score, when computed by the invoker. */
  confidence?: number | null;
}

/**
 * Pluggable interface so the runner doesn't depend on a specific
 * client. Tests pass a mock; production passes a real Ollama-backed
 * adapter.
 */
export type AgentInvoker = (
  question: string,
  context: { kind: EvalKind; fixtureId: string }
) => Promise<AgentRunOutput>;
