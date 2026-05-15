-- ============================================================================
-- AGENT DECISIONS TABLE (Xylo decision log)
-- ============================================================================
-- One row per Xylo "turn" across every surface (frontend chat, ai-analyst CLI,
-- discord bot). Phase 0 of the Xylo roadmap: persist what was asked, what
-- model + prompt was used, what tools were called, and what the agent said.
--
-- Later phases populate additional columns:
--   Phase 1 -> coverage_report
--   Phase 2 -> confidence, risk_violations
--   Phase 4 -> outcome_1d, outcome_7d, outcome_30d
--
-- See docs/ai-agent/XYLO_ROADMAP.md and docs/ai-agent/PHASE_0_PLAN.md.
--
-- Tables: agent_decisions
-- ============================================================================

-- ============================================================================
-- 1. AGENT_DECISIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Request
  source          TEXT NOT NULL
    CHECK (source IN ('frontend', 'ai-analyst', 'discord-bot')),
  user_id         TEXT,                   -- supabase user id / email; nullable for CLI
  user_question   TEXT NOT NULL,
  conversation_id TEXT,                   -- group multi-turn conversations

  -- Model + prompt
  model_id        TEXT NOT NULL,
  prompt_hash     TEXT NOT NULL,          -- hash of system prompt for drift tracking
  prompt_variant  TEXT,                   -- 'lite' | 'full' | 'minimal'

  -- Behavior
  tool_calls      JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ name, args, latency_ms, ok }]
  final_response  TEXT NOT NULL,
  total_latency_ms INTEGER,
  total_tokens    INTEGER,

  -- Classification (best-effort; may be null in Phase 0)
  question_class  TEXT,                   -- 'chat' | 'trade-call' | 'position-review' | 'general'
  ticker          TEXT,
  recommendation_type TEXT,               -- 'cds' | 'pcs' | 'hold' | 'avoid' | null

  -- Placeholders for later phases
  coverage_report JSONB,                  -- Phase 1
  confidence      NUMERIC,                -- Phase 2
  risk_violations JSONB,                  -- Phase 2
  outcome_1d      JSONB,                  -- Phase 4
  outcome_7d      JSONB,                  -- Phase 4
  outcome_30d     JSONB                   -- Phase 4
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Recent decisions feed: "what has Xylo said today?"
CREATE INDEX IF NOT EXISTS agent_decisions_created_at_idx
  ON public.agent_decisions (created_at DESC);

-- Ticker history: "all decisions about NVDA"
CREATE INDEX IF NOT EXISTS agent_decisions_ticker_idx
  ON public.agent_decisions (ticker)
  WHERE ticker IS NOT NULL;

-- Filter by question class: "all trade-call answers"
CREATE INDEX IF NOT EXISTS agent_decisions_class_idx
  ON public.agent_decisions (question_class);

-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

-- Service role write access (lib/ai-agent/logging fire-and-forget writer)
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
END $$;

-- Read access for authenticated users (the /decisions viewer queries with
-- the service role anyway, but allow authenticated reads so SQL editor
-- works without elevation).
DO $$
BEGIN
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

-- ============================================================================
-- 4. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.agent_decisions IS
  'Xylo decision log: one row per agent turn across every surface (frontend chat, ai-analyst CLI, discord bot). Foundation for evals + outcome tracking.';

COMMENT ON COLUMN public.agent_decisions.source IS
  'Surface that produced the turn: frontend (web chat), ai-analyst (CLI), or discord-bot.';
COMMENT ON COLUMN public.agent_decisions.prompt_hash IS
  'Hash of the system prompt used; lets us detect prompt drift between turns.';
COMMENT ON COLUMN public.agent_decisions.tool_calls IS
  'Array of { name, args, latency_ms, ok } objects describing tool invocations during the turn.';
COMMENT ON COLUMN public.agent_decisions.coverage_report IS
  'Phase 1: signals checked / skipped / stale for this answer.';
COMMENT ON COLUMN public.agent_decisions.confidence IS
  'Phase 2: numeric confidence score derived from coverage + risk-gate.';
COMMENT ON COLUMN public.agent_decisions.risk_violations IS
  'Phase 2: rules from strategy.config.yaml that the recommendation violated, if any.';
COMMENT ON COLUMN public.agent_decisions.outcome_1d IS
  'Phase 4: 1-day post-decision outcome (price move, regime change).';
COMMENT ON COLUMN public.agent_decisions.outcome_7d IS
  'Phase 4: 7-day post-decision outcome.';
COMMENT ON COLUMN public.agent_decisions.outcome_30d IS
  'Phase 4: 30-day post-decision outcome.';
