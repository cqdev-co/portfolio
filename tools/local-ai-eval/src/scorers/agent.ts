import type {
  AgentConfig,
  AgentTrace,
  CheckResult,
  ExpectedToolStep,
  Task,
} from '../types.ts';
import { scoreContent } from './regex.ts';

export interface AgentScoreInput {
  task: Task;
  trace: AgentTrace;
}

/**
 * Walk the expected tool sequence over the actual tool calls made. Optional
 * steps may be skipped. Extra (unexpected) tool calls do NOT fail the sequence
 * but are counted separately.
 */
function scoreToolSequence(
  config: AgentConfig,
  trace: AgentTrace
): CheckResult[] {
  const expected: ExpectedToolStep[] = config.expectedToolSequence ?? [];
  if (expected.length === 0) return [];

  const actual = trace.turns.flatMap((t) => t.toolCalls);
  const results: CheckResult[] = [];

  let actualIdx = 0;
  for (const step of expected) {
    const allowed = step.tool.split('|').map((s) => s.trim());
    let found = -1;
    for (let i = actualIdx; i < actual.length; i++) {
      if (allowed.includes(actual[i].name)) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      results.push({
        kind: `agent.sequence.${step.tool}`,
        passed: step.optional === true,
        detail: step.optional
          ? 'Optional step skipped (ok)'
          : `Expected tool call to "${step.tool}" not found after index ${actualIdx}`,
      });
      continue;
    }
    // Required arg check
    const call = actual[found];
    const missing = (step.requiredArgs ?? []).filter(
      (k) =>
        !(k in call.arguments) ||
        call.arguments[k] === undefined ||
        call.arguments[k] === null ||
        call.arguments[k] === ''
    );
    results.push({
      kind: `agent.sequence.${step.tool}`,
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? `Matched at call index ${found}`
          : `Missing required args: ${missing.join(', ')}`,
    });
    actualIdx = found + 1;
  }

  return results;
}

export function scoreAgentRun(input: AgentScoreInput): CheckResult[] {
  const { task, trace } = input;
  const config = task.agent;
  if (!config) return [];

  const checks: CheckResult[] = [];

  // Terminated cleanly on a final answer, not truncated
  checks.push({
    kind: 'agent.terminated',
    passed: trace.terminatedReason === 'final-answer',
    detail:
      trace.terminatedReason === 'final-answer'
        ? undefined
        : `Terminated as: ${trace.terminatedReason ?? 'unknown'}`,
  });

  // Under turn budget
  checks.push({
    kind: 'agent.turnBudget',
    passed: trace.turns.length <= config.maxTurns,
    detail: `Used ${trace.turns.length} / ${config.maxTurns} turns`,
  });

  // Under tool-call budget
  if (config.maxToolCalls !== undefined) {
    checks.push({
      kind: 'agent.toolCallBudget',
      passed: trace.totalToolCalls <= config.maxToolCalls,
      detail: `Made ${trace.totalToolCalls} / ${config.maxToolCalls} tool calls`,
    });
  }

  // Tool sequence
  checks.push(...scoreToolSequence(config, trace));

  // Final content checks
  if (config.finalContentChecks && config.finalContentChecks.length > 0) {
    // Build a synthetic Task-shaped object for scoreContent
    checks.push(
      ...scoreContent(
        { ...task, contentChecks: config.finalContentChecks },
        trace.finalContent
      )
    );
  }

  return checks;
}
