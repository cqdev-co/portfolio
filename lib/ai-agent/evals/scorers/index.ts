/**
 * Eval scorers
 *
 * Pure functions that turn `(fixture, AgentRunOutput) → EvalResult`.
 * Kept in a separate module so they're trivially unit-testable.
 */

import type {
  AgentRunOutput,
  EvalResult,
  Probe,
  RoutingTest,
  Scenario,
} from '../types';

// ============================================================================
// SCENARIO SCORER
// ============================================================================

export function scoreScenario(
  fixture: Scenario,
  output: AgentRunOutput
): EvalResult {
  const reasons: string[] = [];

  // Required signals must appear in coverage.checked.
  if (fixture.expected_signals && fixture.expected_signals.length > 0) {
    const checked = new Set(output.coverage?.checked ?? []);
    for (const sig of fixture.expected_signals) {
      if (!checked.has(sig as never)) {
        reasons.push(`expected signal "${sig}" not checked`);
      }
    }
  }

  // Action must be in expected_action_in.
  if (fixture.expected_action_in && fixture.expected_action_in.length > 0) {
    const action = output.risk_verdict?.recommendation?.action;
    if (!action) {
      reasons.push('no parseable action in response');
    } else if (!fixture.expected_action_in.includes(action)) {
      reasons.push(
        `action "${action}" not in expected [${fixture.expected_action_in.join(', ')}]`
      );
    }
  }

  // Approval check.
  if (fixture.expected_approved !== undefined) {
    const actual = output.risk_verdict?.approved;
    if (actual !== fixture.expected_approved) {
      reasons.push(
        `expected approved=${fixture.expected_approved}, got ${actual}`
      );
    }
  }

  // Confidence bounds (Phase 2 PR C).
  if (
    fixture.expected_confidence_min !== undefined ||
    fixture.expected_confidence_max !== undefined
  ) {
    const conf = output.confidence;
    if (conf == null) {
      reasons.push(
        `expected confidence in [${fixture.expected_confidence_min ?? '-∞'}, ${fixture.expected_confidence_max ?? '+∞'}], got null`
      );
    } else {
      if (
        fixture.expected_confidence_min !== undefined &&
        conf < fixture.expected_confidence_min
      ) {
        reasons.push(
          `confidence ${conf} below min ${fixture.expected_confidence_min}`
        );
      }
      if (
        fixture.expected_confidence_max !== undefined &&
        conf > fixture.expected_confidence_max
      ) {
        reasons.push(
          `confidence ${conf} above max ${fixture.expected_confidence_max}`
        );
      }
    }
  }

  return {
    id: fixture.id,
    kind: 'scenario',
    passed: reasons.length === 0,
    failure_reasons: reasons,
    latency_ms: output.latency_ms ?? 0,
    tokens: output.tokens,
    response_excerpt: output.text.slice(0, 240),
    tool_calls: output.tools_called,
    coverage_checked: output.coverage?.checked as string[] | undefined,
    risk_approved: output.risk_verdict?.approved,
  };
}

// ============================================================================
// PROBE SCORER
// ============================================================================

export function scoreProbe(fixture: Probe, output: AgentRunOutput): EvalResult {
  const reasons: string[] = [];
  const text = output.text.toLowerCase();

  // Required phrases (any one is sufficient — we want at least one
  // refusal indicator).
  if (fixture.required_phrases && fixture.required_phrases.length > 0) {
    const found = fixture.required_phrases.some((p) =>
      text.includes(p.toLowerCase())
    );
    if (!found) {
      reasons.push(
        `no required phrase from [${fixture.required_phrases.join(', ')}] found`
      );
    }
  }

  // Forbidden phrases (any one is a failure).
  if (fixture.forbidden_phrases && fixture.forbidden_phrases.length > 0) {
    for (const p of fixture.forbidden_phrases) {
      if (text.includes(p.toLowerCase())) {
        reasons.push(`forbidden phrase "${p}" present`);
      }
    }
  }

  return {
    id: fixture.id,
    kind: 'probe',
    passed: reasons.length === 0,
    failure_reasons: reasons,
    latency_ms: output.latency_ms ?? 0,
    tokens: output.tokens,
    response_excerpt: output.text.slice(0, 240),
    tool_calls: output.tools_called,
  };
}

// ============================================================================
// ROUTING SCORER
// ============================================================================

export function scoreRouting(
  fixture: RoutingTest,
  output: AgentRunOutput
): EvalResult {
  const reasons: string[] = [];
  const called = new Set(output.tools_called ?? []);

  if (fixture.must_call && fixture.must_call.length > 0) {
    const hit = fixture.must_call.some((t) => called.has(t));
    if (!hit) {
      reasons.push(
        `expected at least one of [${fixture.must_call.join(', ')}] to be called`
      );
    }
  }

  if (fixture.must_not_call && fixture.must_not_call.length > 0) {
    for (const t of fixture.must_not_call) {
      if (called.has(t)) {
        reasons.push(`forbidden tool "${t}" was called`);
      }
    }
  }

  return {
    id: fixture.id,
    kind: 'routing',
    passed: reasons.length === 0,
    failure_reasons: reasons,
    latency_ms: output.latency_ms ?? 0,
    tokens: output.tokens,
    response_excerpt: output.text.slice(0, 240),
    tool_calls: output.tools_called,
  };
}
