-- ============================================================================
-- AGENT EVAL RUNS TABLE (Xylo evaluation harness)
-- ============================================================================
-- One row per `bun run xylo:eval` invocation. Persists the aggregate
-- pass/fail counts and per-test results so we can detect regressions
-- across model + prompt changes.
--
-- See docs/ai-agent/PHASE_2_PLAN.md for context.
--
-- Tables: agent_eval_runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_eval_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  model_id        TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,
  -- Best-effort: captured from `git rev-parse HEAD` at run time, null
  -- if the runner can't shell out (e.g. inside a Vercel deploy).
  git_sha         TEXT,

  -- Suite totals (separate counters per kind so we can track each).
  scenarios_total      INTEGER NOT NULL,
  scenarios_passed     INTEGER NOT NULL,
  probes_total         INTEGER NOT NULL,
  probes_passed        INTEGER NOT NULL,
  routing_total        INTEGER NOT NULL,
  routing_passed       INTEGER NOT NULL,

  -- Aggregates
  total_latency_ms     INTEGER NOT NULL,
  total_cost_estimate  NUMERIC,
  avg_tokens           INTEGER,

  -- Per-test results: jsonb array of
  --   { id, kind: 'scenario'|'probe'|'routing', passed, latency_ms,
  --     cost?, error?, details? }
  results              JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS agent_eval_runs_created_at_idx
  ON public.agent_eval_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS agent_eval_runs_model_idx
  ON public.agent_eval_runs (model_id);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.agent_eval_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_eval_runs'
      AND policyname = 'Allow all for service role on agent_eval_runs'
  ) THEN
    CREATE POLICY "Allow all for service role on agent_eval_runs"
      ON public.agent_eval_runs
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_eval_runs'
      AND policyname = 'Allow authenticated read on agent_eval_runs'
  ) THEN
    CREATE POLICY "Allow authenticated read on agent_eval_runs"
      ON public.agent_eval_runs
      FOR SELECT
      USING (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.agent_eval_runs IS
  'Xylo eval harness output: one row per `bun run xylo:eval` invocation. Tracks pass/fail across scenarios, hallucination probes, and tool-routing tests.';

COMMENT ON COLUMN public.agent_eval_runs.results IS
  'Per-test results JSONB array. Each item: { id, kind, passed, latency_ms, cost?, error? }.';
