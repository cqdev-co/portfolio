/**
 * Preflight barrel — `lib/ai-agent/preflight/`
 *
 * Phase 1 deterministic context fan-out. See `runner.ts` for the
 * `runPreflight` entry point and `types.ts` for the shapes.
 */

export { runPreflight, serializeCoverage } from './runner';
export type {
  PreflightOptions,
  PreflightResult,
  CoverageReport,
  CoverageError,
  SignalLatency,
} from './types';
