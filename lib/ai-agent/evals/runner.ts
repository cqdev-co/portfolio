/**
 * Eval runner
 *
 * Phase 2: read all scenarios / probes / routing-tests from the
 * `evals/scenarios/`, `evals/probes/`, `evals/routing/` JSON
 * directories, run them through the supplied `AgentInvoker`, score,
 * aggregate, and return an `EvalRun` ready for persistence.
 *
 * The runner is deliberately I/O-light: scenario-loading is a single
 * `Bun.glob` walk and the agent invocation is plug-in. Lets tests run
 * against a deterministic mock invoker.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreProbe, scoreRouting, scoreScenario } from './scorers';
import type {
  AgentInvoker,
  EvalFixture,
  EvalKind,
  EvalResult,
  EvalRun,
  Probe,
  RoutingTest,
  Scenario,
} from './types';

const HERE = dirname(fileURLToPath(import.meta.url));

interface RunnerOptions {
  /**
   * Pluggable agent invocation. Production wires this to a function
   * that calls `runPreflight` + the chat route's `processChat`-like
   * loop; tests can pass a mock.
   */
  invoke: AgentInvoker;
  modelId: string;
  promptHash: string;
  gitSha?: string | null;
  /** Cap on parallel agent calls. Default 1 (sequential, polite to APIs). */
  concurrency?: number;
  /** Optional list of fixture ids to include; empty = all. */
  filter?: { ids?: string[]; kinds?: EvalKind[] };
}

// ============================================================================
// FIXTURE LOADING
// ============================================================================

async function loadFixturesFrom<T extends EvalFixture>(
  subdir: string,
  expectedKind: EvalKind
): Promise<T[]> {
  const dir = join(HERE, subdir);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const raw = await readFile(join(dir, name), 'utf8');
    let parsed: T;
    try {
      parsed = JSON.parse(raw) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse ${subdir}/${name}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    if (parsed.kind !== expectedKind) {
      throw new Error(
        `${subdir}/${name}: expected kind=${expectedKind}, got ${parsed.kind}`
      );
    }
    out.push(parsed);
  }
  return out;
}

export async function loadScenarios(): Promise<Scenario[]> {
  return loadFixturesFrom<Scenario>('scenarios', 'scenario');
}

export async function loadProbes(): Promise<Probe[]> {
  return loadFixturesFrom<Probe>('probes', 'probe');
}

export async function loadRoutingTests(): Promise<RoutingTest[]> {
  return loadFixturesFrom<RoutingTest>('routing', 'routing');
}

// ============================================================================
// RUN
// ============================================================================

/**
 * Run the full eval suite. Returns an `EvalRun` ready to insert into
 * `agent_eval_runs`.
 */
export async function runEvalSuite(options: RunnerOptions): Promise<EvalRun> {
  const start = Date.now();
  const [scenarios, probes, routing] = await Promise.all([
    loadScenarios(),
    loadProbes(),
    loadRoutingTests(),
  ]);

  const filteredScenarios = filterFixtures(scenarios, options.filter);
  const filteredProbes = filterFixtures(probes, options.filter);
  const filteredRouting = filterFixtures(routing, options.filter);

  const results: EvalResult[] = [];
  let blockerFailed = false;

  // Sequential by default. We could pmap with concurrency later.
  await runBatch<Scenario>(
    filteredScenarios,
    options.invoke,
    'scenario',
    (f, o) => scoreScenario(f, o),
    results
  );
  await runBatch<Probe>(
    filteredProbes,
    options.invoke,
    'probe',
    (f, o) => scoreProbe(f, o),
    results
  );
  await runBatch<RoutingTest>(
    filteredRouting,
    options.invoke,
    'routing',
    (f, o) => scoreRouting(f, o),
    results
  );

  const passedFor = (kind: EvalKind) =>
    results.filter((r) => r.kind === kind && r.passed).length;
  const totalFor = (kind: EvalKind) =>
    results.filter((r) => r.kind === kind).length;

  // Track must_pass blockers across all kinds.
  for (const r of results) {
    if (r.passed) continue;
    const fixture = findFixture(r.id, [
      ...filteredScenarios,
      ...filteredProbes,
      ...filteredRouting,
    ]);
    if (fixture?.must_pass) blockerFailed = true;
  }

  const totalLatency = Date.now() - start;
  const tokenSamples = results
    .map((r) => r.tokens)
    .filter((t): t is number => typeof t === 'number' && t > 0);
  const avgTokens = tokenSamples.length
    ? Math.round(tokenSamples.reduce((s, v) => s + v, 0) / tokenSamples.length)
    : null;

  return {
    model_id: options.modelId,
    prompt_hash: options.promptHash,
    git_sha: options.gitSha ?? null,
    scenarios_total: totalFor('scenario'),
    scenarios_passed: passedFor('scenario'),
    probes_total: totalFor('probe'),
    probes_passed: passedFor('probe'),
    routing_total: totalFor('routing'),
    routing_passed: passedFor('routing'),
    total_latency_ms: totalLatency,
    total_cost_estimate: null,
    avg_tokens: avgTokens,
    results,
    blocker_failed: blockerFailed,
  };
}

async function runBatch<T extends EvalFixture>(
  fixtures: T[],
  invoke: AgentInvoker,
  kind: EvalKind,
  score: (f: T, output: Awaited<ReturnType<AgentInvoker>>) => EvalResult,
  out: EvalResult[]
): Promise<void> {
  for (const f of fixtures) {
    let output;
    try {
      output = await invoke((f as { question: string }).question, {
        kind,
        fixtureId: f.id,
      });
    } catch (err) {
      out.push({
        id: f.id,
        kind,
        passed: false,
        failure_reasons: [
          `invoker threw: ${err instanceof Error ? err.message : String(err)}`,
        ],
        latency_ms: 0,
      });
      continue;
    }
    out.push(score(f, output));
  }
}

function filterFixtures<T extends EvalFixture>(
  fixtures: T[],
  filter?: RunnerOptions['filter']
): T[] {
  if (!filter) return fixtures;
  return fixtures.filter((f) => {
    if (
      filter.kinds &&
      filter.kinds.length > 0 &&
      !filter.kinds.includes(f.kind)
    ) {
      return false;
    }
    if (filter.ids && filter.ids.length > 0 && !filter.ids.includes(f.id)) {
      return false;
    }
    return true;
  });
}

function findFixture<T extends EvalFixture>(
  id: string,
  fixtures: T[]
): T | undefined {
  return fixtures.find((f) => f.id === id);
}
