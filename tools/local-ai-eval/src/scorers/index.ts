import type { CheckResult, ScoreResult, Task } from '../types.ts';
import { scoreContent } from './regex.ts';
import { scoreSchema } from './schema.ts';
import { scoreToolCall, type CapturedToolCall } from './tool-call.ts';

export interface ScoreInput {
  task: Task;
  output: string;
  toolCalls?: CapturedToolCall[];
}

/**
 * Dispatch scorers by workload and merge results into a single ScoreResult.
 * V1 has no LLM-as-judge. The interface here is shaped so a judge scorer can
 * be slotted in later without changing the runner.
 */
export function scoreRun(input: ScoreInput): ScoreResult {
  const { task, output, toolCalls } = input;
  const checks: CheckResult[] = [];

  switch (task.workload) {
    case 'briefing':
      checks.push(...scoreSchema(task, output));
      checks.push(...scoreContent(task, output));
      break;
    case 'narrative':
      if (task.expectedSchema) checks.push(...scoreSchema(task, output));
      checks.push(...scoreContent(task, output));
      break;
    case 'chat':
      checks.push(...scoreContent(task, output));
      break;
    case 'tool-call':
      checks.push(...scoreToolCall(task, toolCalls));
      // Content checks are optional for tool-call tasks.
      if (task.contentChecks?.length) {
        checks.push(...scoreContent(task, output));
      }
      break;
  }

  const passed = checks.length > 0 && checks.every((c) => c.passed);

  return {
    workload: task.workload,
    passed,
    checks,
  };
}

export { scoreContent, scoreSchema, scoreToolCall };
export type { CapturedToolCall };
