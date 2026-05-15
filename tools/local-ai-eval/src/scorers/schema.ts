import type { CheckResult, Task } from '../types.ts';

/**
 * Strip markdown fences, think tags, and leading prose; return the first balanced
 * JSON object found. Mirrors the tolerant parsing done in
 * frontend/src/app/api/dashboard/briefing/route.ts.
 */
export function extractJsonObject(raw: string): string | null {
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  if (cleaned.includes('<think>')) {
    const idx = cleaned.indexOf('<think>');
    cleaned = cleaned.slice(0, idx).trim();
  }

  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }
  return null;
}

function typeMatches(expected: string, actual: unknown): boolean {
  switch (expected) {
    case 'string':
      return typeof actual === 'string';
    case 'number':
      return typeof actual === 'number' && !Number.isNaN(actual);
    case 'boolean':
      return typeof actual === 'boolean';
    case 'array':
      return Array.isArray(actual);
    case 'object':
      return (
        typeof actual === 'object' && actual !== null && !Array.isArray(actual)
      );
    case 'null':
      return actual === null;
    default:
      return true;
  }
}

export function scoreSchema(task: Task, output: string): CheckResult[] {
  if (!task.expectedSchema) return [];
  const results: CheckResult[] = [];

  const jsonStr = extractJsonObject(output);
  if (!jsonStr) {
    results.push({
      kind: 'schema.extract',
      passed: false,
      detail: 'No balanced JSON object found in output.',
    });
    return results;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    results.push({
      kind: 'schema.parse',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return results;
  }

  results.push({ kind: 'schema.parse', passed: true });

  if (!typeMatches(task.expectedSchema.type, parsed)) {
    results.push({
      kind: 'schema.rootType',
      passed: false,
      detail: `Expected root type ${task.expectedSchema.type}`,
    });
    return results;
  }

  const obj = parsed as Record<string, unknown>;
  const required = task.expectedSchema.required ?? [];
  const missing = required.filter((k) => !(k in obj));
  results.push({
    kind: 'schema.required',
    passed: missing.length === 0,
    detail:
      missing.length === 0 ? undefined : `Missing keys: ${missing.join(', ')}`,
  });

  for (const [key, spec] of Object.entries(task.expectedSchema.properties)) {
    if (!(key in obj)) continue;
    const ok = typeMatches(spec.type, obj[key]);
    results.push({
      kind: `schema.prop.${key}`,
      passed: ok,
      detail: ok ? undefined : `Expected ${spec.type} for "${key}"`,
    });
  }

  return results;
}
