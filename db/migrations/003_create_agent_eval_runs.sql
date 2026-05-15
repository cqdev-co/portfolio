-- ============================================================================
-- Migration: Create agent_eval_runs table (Xylo eval harness)
-- ============================================================================
-- Run via:
--   supabase db execute --linked < db/migrations/003_create_agent_eval_runs.sql
-- Or paste into the Supabase SQL editor.
--
-- Safe to re-run. Source of truth: db/schema/09_agent_eval_runs.sql.
-- See docs/ai-agent/PHASE_2_PLAN.md for context.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_eval_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_id        TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,
  git_sha         TEXT,
  scenarios_total      INTEGER NOT NULL,
  scenarios_passed     INTEGER NOT NULL,
  probes_total         INTEGER NOT NULL,
  probes_passed        INTEGER NOT NULL,
  routing_total        INTEGER NOT NULL,
  routing_passed       INTEGER NOT NULL,
  total_latency_ms     INTEGER NOT NULL,
  total_cost_estimate  NUMERIC,
  avg_tokens           INTEGER,
  results              JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_eval_runs_created_at_idx
  ON public.agent_eval_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS agent_eval_runs_model_idx
  ON public.agent_eval_runs (model_id);

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

COMMENT ON TABLE public.agent_eval_runs IS
  'Xylo eval harness output: one row per `bun run xylo:eval` invocation.';
