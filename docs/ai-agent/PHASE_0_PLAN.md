# Xylo Phase 0 Plan — Foundations

**Status**: ✅ Complete (April 26, 2026)
**Updated**: April 26, 2026
**Parent**: [`XYLO_ROADMAP.md`](./XYLO_ROADMAP.md)

> Phase 0 is the rename + decision-log + observability foundation. It
> unblocks every later phase. Estimated total effort: **2-4 working
> days**. Can ship as 2 PRs (rename, then decision log + viewer).

---

## Outcomes

When Phase 0 is done:

1. Every chat turn (frontend `/api/chat` and `ai-analyst` CLI) writes a
   structured decision row to Supabase.
2. The operator can answer "what has Xylo said this week, with what
   tools, on what model?" via a `/decisions` page in <5 seconds.
3. The agent is named **Xylo** consistently across the codebase, docs,
   and UI.
4. Prompt drift is fixed: no references to tools that don't exist;
   lite prompt is honest about the full toolset.

---

## PR 1 — Rename Victor → Xylo

**Scope:** name change only. No behavior change.

### Files to edit

- `lib/ai-agent/prompts/victor.ts` → rename file to `xylo.ts`.
  - Update all `VICTOR_*` exports to `XYLO_*` (e.g. `VICTOR_PERSONA` →
    `XYLO_PERSONA`).
  - Update `buildVictorSystemPrompt` → `buildXyloSystemPrompt`.
  - Update `buildVictorLitePrompt` → `buildXyloLitePrompt`.
  - Update `buildVictorMinimalPrompt` → `buildXyloMinimalPrompt`.
  - Persona retains the human name "Victor Chen" if desired (the agent
    _role_ is Xylo; the persona's character can still be a 67-year-old
    Wall Street veteran). Final call: rewrite persona to use "Xylo"
    throughout for consistency. **Decision: persona name = Xylo.**
- `lib/ai-agent/prompts/index.ts` — update re-exports.
- `lib/ai-agent/index.ts` — update public surface.
- `lib/ai-agent/prompts/positions.ts` — update any references.
- `frontend/src/app/api/chat/route.ts` — `buildVictorLitePrompt`
  call site.
- `frontend/src/app/api/dashboard/briefing/route.ts` — inline prompt
  string ("You are Victor…") becomes "You are Xylo…".
- `frontend/src/app/chat/page.tsx` — UI metadata and copy.
- `frontend/src/app/chat/chat-experience.tsx` — UI copy.
- `frontend/src/components/chat/*` — any "Victor" labels in tool-call
  cards, headers, placeholder text.
- `ai-analyst/src/commands/chat.ts` — `buildVictorSystemPrompt` call site.
- `ai-analyst/src/agent/briefing.ts` and other agent files —
  inline "Victor" strings.
- `ai-discord-bot/src/ai_discord_bot/agents/system_prompts.py` —
  `ORCHESTRATOR_PROMPT` "You are Victor's orchestrator…" becomes "You
  are Xylo's orchestrator…" (or revise to fit; Xylo _is_ the
  orchestrator concept here).
- `docs/ai-agent/*.md` — update references to Victor.
- `docs/README.md` — update AI Analyst entry name.
- `docs/ai-analyst/README.md` — update.

### Sub-tasks while we're touching the prompts

- [ ] **Remove `analyze_position` references** from `xylo.ts`
      (`TOOL_INSTRUCTIONS` mentions it; the tool is no longer in
      `AGENT_TOOLS`).
- [ ] **Align `buildXyloLitePrompt({ withTools: true })`** with the
      actual `AGENT_TOOLS` set. Currently only describes 2 tools while the
      route registers all 8.

### Acceptance

- [ ] `rg -i 'victor' --type ts --type py --type md` returns only
      intentional historical references (e.g. inside `XYLO_ROADMAP.md`
      citing the prior name).
- [ ] All TypeScript builds pass; `bun run lint` clean.
- [ ] `ai-analyst chat` and frontend `/chat` work end-to-end (manual
      smoke test).

### Docs to update in this PR

- `docs/ai-agent/SHARED_LIBRARY.md` — Victor section becomes Xylo.
- `docs/README.md` — AI Analyst entry.
- `docs/ai-analyst/README.md`.

---

## PR 2 — Decision log + viewer

**Scope:** persist every Xylo turn; build a minimal viewer.

### Schema (`agent_decisions`)

Add to Supabase via existing migration mechanism (see `docs/db/README.md`).

```sql
create table public.agent_decisions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- request
  source          text not null,        -- 'frontend' | 'ai-analyst' | 'discord-bot'
  user_id         text,                 -- supabase user id, nullable for cli
  user_question   text not null,
  conversation_id text,                 -- group multi-turn conversations

  -- model + prompt
  model_id        text not null,
  prompt_hash     text not null,        -- hash of system prompt for drift tracking
  prompt_variant  text,                 -- 'lite' | 'full' | 'minimal'

  -- behavior
  tool_calls      jsonb not null default '[]'::jsonb, -- [{ name, args, latency_ms, ok }]
  final_response  text not null,
  total_latency_ms integer,
  total_tokens    integer,

  -- classification (best-effort, may be null)
  question_class  text,                 -- 'chat' | 'trade-call' | 'position-review' | 'general'
  ticker          text,
  recommendation_type text,             -- 'cds' | 'pcs' | 'hold' | 'avoid' | null

  -- placeholders for later phases
  coverage_report jsonb,                -- Phase 1
  confidence      numeric,              -- Phase 2
  risk_violations jsonb,                -- Phase 2
  outcome_1d      jsonb,                -- Phase 4
  outcome_7d      jsonb,                -- Phase 4
  outcome_30d     jsonb                 -- Phase 4
);

create index agent_decisions_created_at_idx on public.agent_decisions (created_at desc);
create index agent_decisions_ticker_idx on public.agent_decisions (ticker) where ticker is not null;
create index agent_decisions_class_idx on public.agent_decisions (question_class);
```

### Code changes

- `lib/ai-agent/logging/decisions.ts` (new) —
  `logDecision({ ... })` writer + `prompt_hash` helper. Designed to be
  cheap and fire-and-forget (do not block the response if logging
  fails; emit a warning).
- `lib/ai-agent/index.ts` — export `logDecision`.
- `frontend/src/app/api/chat/route.ts` — write a row at end of each
  request (success or error). Capture: question, prompt hash, model,
  tool calls, response, latency.
- `ai-analyst/src/commands/chat.ts` — same hook on each chat turn.
- `frontend/src/app/decisions/page.tsx` (new) — server component table
  view, filters by source / model / question_class / ticker.
- `frontend/src/app/api/decisions/route.ts` (new, optional) — paged
  query endpoint if the page does client-side filtering.

### Auth

- `/decisions` page reuses the existing email whitelist auth used for
  `/chat`.

### Acceptance

- [ ] Send a chat in `/chat`. A row appears in `agent_decisions` with
      every field populated (except Phase 1+ placeholders).
- [ ] Run `ai-analyst chat`. A row appears with `source = 'ai-analyst'`.
- [ ] `/decisions` page loads, shows the most recent 50 rows, supports
      filtering by source.
- [ ] If Supabase is unreachable, chat still completes; a warning is
      logged but the user sees no error.

### Docs to update in this PR

- `docs/db/README.md` — document the new table and indexes.
- `docs/ai-agent/SHARED_LIBRARY.md` — add `logging/` to directory
  structure.
- `docs/frontend/AI_CHAT.md` — note the decision logging behavior and
  the `/decisions` viewer.
- `docs/ai-agent/XYLO_ROADMAP.md` — check off Phase 0 items as they
  land.

---

## Out of scope for Phase 0

The following are deliberately deferred to keep Phase 0 small and
shippable:

- New tools (`get_recent_news`, `get_sentiment`, etc.) → Phase 1.
- Coverage report generation → Phase 1.
- Risk gate enforcement → Phase 2.
- Eval harness → Phase 2.
- Multi-agent trade-call flow → Phase 3.
- Reflection agent / lessons table → Phase 4.

If scope creep tempts a deviation, link back to
[`XYLO_ROADMAP.md`](./XYLO_ROADMAP.md) and verify the deviation is
worth blocking the foundation.

---

## Suggested commit / PR structure

1. **PR A** — `chore(ai-agent): rename Victor → Xylo` — files-only
   rename + import updates + prompt-drift cleanup. No DB changes.
2. **PR B** — `feat(ai-agent): persistent decision log + /decisions
viewer` — Supabase migration + `logDecision` + chat route hooks +
   viewer page.

Each PR should pass typecheck, lint, and a manual smoke test of the
`/chat` and `ai-analyst chat` paths before merge.
