-- ============================================================================
-- Migration: Create agent_decisions table (Xylo decision log)
-- Source of truth: db/schema/08_agent_decisions.sql
-- See docs/ai-agent/PHASE_0_PLAN.md for context.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT NOT NULL
    CHECK (source IN ('frontend', 'ai-analyst', 'discord-bot')),
  user_id         TEXT,
  user_question   TEXT NOT NULL,
  conversation_id TEXT,
  model_id        TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,
  prompt_variant  TEXT,
  tool_calls      JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_response  TEXT NOT NULL,
  total_latency_ms INTEGER,
  total_tokens    INTEGER,
  question_class  TEXT,
  ticker          TEXT,
  recommendation_type TEXT,
  coverage_report JSONB,
  confidence      NUMERIC,
  risk_violations JSONB,
  outcome_1d      JSONB,
  outcome_7d      JSONB,
  outcome_30d     JSONB
);

CREATE INDEX IF NOT EXISTS agent_decisions_created_at_idx
  ON public.agent_decisions (created_at DESC);

CREATE INDEX IF NOT EXISTS agent_decisions_ticker_idx
  ON public.agent_decisions (ticker)
  WHERE ticker IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_decisions_class_idx
  ON public.agent_decisions (question_class);

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_decisions'
      AND policyname = 'Allow insert for service role on agent_decisions'
  ) THEN
    CREATE POLICY "Allow insert for service role on agent_decisions"
      ON public.agent_decisions
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_decisions'
      AND policyname = 'Allow authenticated read on agent_decisions'
  ) THEN
    CREATE POLICY "Allow authenticated read on agent_decisions"
      ON public.agent_decisions
      FOR SELECT
      USING (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;

COMMENT ON TABLE public.agent_decisions IS
  'Xylo decision log: one row per agent turn across every surface (frontend chat, ai-analyst CLI, discord bot). Foundation for evals + outcome tracking.';
