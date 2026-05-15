/**
 * Eval harness barrel — `lib/ai-agent/evals/`
 *
 * Phase 2 of the Xylo roadmap. See `runner.ts` for `runEvalSuite`,
 * `scorers/index.ts` for the per-kind scoring functions, and the
 * sibling `scenarios/`, `probes/`, `routing/` directories for the
 * JSON fixtures.
 */

export {
  runEvalSuite,
  loadScenarios,
  loadProbes,
  loadRoutingTests,
} from './runner';
export { scoreScenario, scoreProbe, scoreRouting } from './scorers';
export type {
  AgentInvoker,
  AgentRunOutput,
  EvalFixture,
  EvalKind,
  EvalResult,
  EvalRun,
  Probe,
  RoutingTest,
  Scenario,
} from './types';
