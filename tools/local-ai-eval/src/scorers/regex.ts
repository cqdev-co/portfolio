import type { CheckResult, ContentCheck, Task } from '../types.ts';

function runCheck(output: string, check: ContentCheck): CheckResult {
  switch (check.kind) {
    case 'contains': {
      const hay = check.caseInsensitive ? output.toLowerCase() : output;
      const needle = check.caseInsensitive
        ? check.value.toLowerCase()
        : check.value;
      const passed = hay.includes(needle);
      return {
        kind: `content.contains`,
        passed,
        detail: passed ? undefined : `Missing: ${JSON.stringify(check.value)}`,
      };
    }
    case 'notContains': {
      const hay = check.caseInsensitive ? output.toLowerCase() : output;
      const needle = check.caseInsensitive
        ? check.value.toLowerCase()
        : check.value;
      const passed = !hay.includes(needle);
      return {
        kind: `content.notContains`,
        passed,
        detail: passed
          ? undefined
          : `Unexpectedly present: ${JSON.stringify(check.value)}`,
      };
    }
    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(check.pattern, check.flags);
      } catch (err) {
        return {
          kind: 'content.regex',
          passed: false,
          detail: `Invalid regex: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      const passed = re.test(output);
      return {
        kind: 'content.regex',
        passed,
        detail: passed
          ? undefined
          : `Pattern did not match: /${check.pattern}/`,
      };
    }
    case 'maxLength': {
      const passed = output.length <= check.chars;
      return {
        kind: 'content.maxLength',
        passed,
        detail: passed
          ? undefined
          : `Output length ${output.length} > ${check.chars}`,
      };
    }
    case 'minLength': {
      const passed = output.length >= check.chars;
      return {
        kind: 'content.minLength',
        passed,
        detail: passed
          ? undefined
          : `Output length ${output.length} < ${check.chars}`,
      };
    }
  }
}

export function scoreContent(task: Task, output: string): CheckResult[] {
  if (!task.contentChecks || task.contentChecks.length === 0) return [];
  return task.contentChecks.map((c) => runCheck(output, c));
}
