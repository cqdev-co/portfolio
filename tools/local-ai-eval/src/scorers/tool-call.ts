import type { CheckResult, Task } from '../types.ts';

export interface CapturedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export function scoreToolCall(
  task: Task,
  toolCalls: CapturedToolCall[] | undefined
): CheckResult[] {
  if (!task.expectedTool) return [];
  const results: CheckResult[] = [];
  const calls = toolCalls ?? [];

  results.push({
    kind: 'tool.calledOnce',
    passed: calls.length === 1,
    detail:
      calls.length === 1
        ? undefined
        : `Expected exactly 1 tool call, got ${calls.length}`,
  });

  if (calls.length === 0) {
    results.push({
      kind: 'tool.name',
      passed: false,
      detail: 'No tool call emitted',
    });
    return results;
  }

  const first = calls[0];
  const nameOk = first.name === task.expectedTool.name;
  results.push({
    kind: 'tool.name',
    passed: nameOk,
    detail: nameOk
      ? undefined
      : `Expected ${task.expectedTool.name}, got ${first.name}`,
  });

  const required = task.expectedTool.requiredArgs ?? [];
  const args = first.arguments ?? {};
  const missing = required.filter(
    (k) => !(k in args) || args[k] === undefined || args[k] === null
  );
  results.push({
    kind: 'tool.args',
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? undefined
        : `Missing required args: ${missing.join(', ')}`,
  });

  return results;
}
