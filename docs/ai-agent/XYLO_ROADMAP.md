# Xylo Roadmap

**Location**: `lib/ai-agent/` (and dependents: `frontend/`, `ai-analyst/`, `ai-discord-bot/`)
**Status**: Planning → Active
**Updated**: April 26, 2026

> Xylo (formerly "Victor Chen") is the personal market analyst agent.
> This document captures the long-term direction, the maturity model the
> system is being built against, and the phased plan to get there.
> **Read this before re-litigating architecture decisions.**

---

## Vision

Build Xylo into a market analyst that the operator can trust with real
trade decisions over $1,000 — not because Xylo is "all-knowing," but
because it is **honestly calibrated**: it always reports what it
checked, what it skipped, what it could not verify, and how confident
it is. Over time, Xylo identifies its own weaknesses through a closed
feedback loop on past decisions and outcomes.

Four user-facing properties define "done":

1. **Coverage** — every trade-call answer references a complete bundle
   of signals: fundamentals, technicals, market regime, news,
   sentiment, options flow, earnings calendar, and macro/geopolitical
   context.
2. **Discipline** — risk rules from `strategy.config.yaml` are enforced
   in code, not in prompt text. The model cannot be talked out of them.
3. **Calibration** — every recommendation carries a confidence score
   and a coverage report. The operator can decide to trust based on
   what was actually checked, not on tone.
4. **Self-improvement** — Xylo cites lessons from its own track record.
   Past wrong calls are stored and surfaced when similar setups recur.

---

## Maturity Model

Xylo is built on five layers. Each layer must be real before the next
delivers value.

```text
┌─────────────────────────────────────────────────────┐
│ 5. Architecture (single vs multi, debate, critic)   │
├─────────────────────────────────────────────────────┤
│ 4. Risk gates enforced in code (not prompts)        │
├─────────────────────────────────────────────────────┤
│ 3. Evaluation harness (regression + scenarios)      │
├─────────────────────────────────────────────────────┤
│ 2. Decision log + observability                     │
├─────────────────────────────────────────────────────┤
│ 1. Data foundation (sources, freshness, history)    │
└─────────────────────────────────────────────────────┘
```

Rule: you cannot fix layer N without layers 1..N-1. Multi-agent at
layer 5 with no decision log at layer 2 produces a more elaborate way
to be wrong.

### Current State Scorecard (April 2026)

| Layer                           | Grade | Detail                                                                                                                                                   |
| ------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Data                         | B-    | Yahoo + Supabase + Ollama web search + market regime. Missing persistent news/sentiment store, earnings calendar, geopolitical events, intraday history. |
| 2. Decision log + observability | D     | Tool-call cards render in UI; nothing is persisted. No way to ask "what has Xylo said this week?"                                                        |
| 3. Evaluation                   | F     | No eval set, no regression tests on prompts or tools. Prompt drift already happened (`analyze_position` ghost in `victor.ts`).                           |
| 4. Risk gates in code           | C     | `strategy.config.yaml` rules exist but are advisory — they live inside the prompt. Model can be argued out of them.                                      |
| 5. Architecture                 | B     | Single-agent + tool loop. Fine for chat. Not yet structured for breadth-first trade analysis.                                                            |

The lowest grades are at layers 2-3. Investment focus belongs there
first, regardless of how exciting layer 5 architecture changes look.

---

## Architecture Decision (locked)

> **Chat is single-agent. Trade calls are multi-agent in the
> TradingAgents shape. Briefs stay multi-agent. Agent-to-agent
> communication is structured, not free chat. Models are tiered by task,
> not uniform.**

### Why this, grounded in current research

- **Single-agent wins** at sequential reasoning, contexts under ~30K
  tokens, and fewer than ~10 tool calls per turn. (Stanford-style
  result, [arXiv:2604.02460](https://arxiv.org/abs/2604.02460v1).) Xylo's chat workload sits firmly in
  this regime.
- **Multi-agent wins** at breadth-first parallel research, tool-heavy
  workflows (~30+ tool calls), and adversarial verification. Anthropic's
  production research system reports +90.2% over single-agent for
  breadth-first queries, at ~15× token cost. ([Anthropic engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system).)
- **TradingAgents** ([Xiao et al., arXiv:2412.20138](https://arxiv.org/html/2412.20138v5),
  Tauric Research) demonstrates measurable improvements on cumulative
  return, Sharpe ratio, and max drawdown using a multi-agent shape:
  parallel analyst layer (Fundamental, Sentiment, News, Technical) →
  Bull/Bear researcher debate → Trader → Risk Management → Fund
  Manager. **Critical:** agents communicate via structured documents,
  not free natural language. Free chat between agents was explicitly
  identified as causing a "telephone effect" of information loss.
- **Mixed model tiers** in TradingAgents: cheap fast models
  (`gpt-4o-mini` class) for summarization and retrieval; deep-thinking
  models (`o1`/`gpt-5` class) for decisions and report writing. This
  maps onto the existing `@portfolio/ai-config` workload resolver.

### Workload mapping

| Workload                                                        | Architecture                             | Notes                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Interactive chat (`/api/chat`)                                  | Single-agent + pre-flight context bundle | Sequential reasoning, low latency required, <10 tools per turn typically.                               |
| Trade-call analysis (e.g. "should I take a CDS on NVDA?")       | TradingAgents-shaped multi-agent         | Parallel extractors → optional Bull/Bear → Xylo as Trader → TradeCritic against `strategy.config.yaml`. |
| Scheduled briefs (`ai-discord-bot`, premarket, position review) | Multi-agent (already in place)           | Latency-tolerant, breadth-first.                                                                        |

### Extractor vs Reasoner discipline

Most "agents" in Xylo's architecture are **extractors**, not reasoners:

- **Extractor**: stateless, single-pass, structured JSON out, runs on
  small/fast model via `resolveAI('extraction')`. Examples: NewsExtractor,
  SentimentExtractor, FundamentalsExtractor.
- **Reasoner**: full system prompt, tool loop, makes recommendations.
  Runs on deep model. Examples: Xylo (Trader role), TradeCritic,
  weekly Reflection agent.

This split avoids the "committee of confident hallucinators" failure
mode of naive multi-agent systems while preserving the compression
benefit (Xylo reasons over digested signals, not raw firehose).

---

## Phased Plan

Each phase is independently shippable and useful on its own.

### Phase 0 — Foundations (Week 1-2) ✅ COMPLETE

**Goal:** rename, log every decision, prove observability works.

- [x] Rename Victor → Xylo across `lib/ai-agent/prompts/`, all
      `VICTOR_*` exports, `frontend/src/app/api/dashboard/briefing/route.ts`
      inline prompt, `ai-discord-bot/.../system_prompts.py`
      `ORCHESTRATOR_PROMPT`, UI copy in `frontend/src/app/chat/page.tsx`,
      and `docs/ai-agent/*`.
- [x] Create Supabase table `agent_decisions` (schema in
      `PHASE_0_PLAN.md` / `db/schema/08_agent_decisions.sql`).
- [x] Hook every `/api/chat` turn to write a decision row.
- [x] Hook `ai-analyst` chat command to write a decision row.
- [x] Add `/decisions` viewer page in frontend (table, filters).
- [x] Fix prompt drift: remove `analyze_position` references from
      `victor.ts` (renamed `xylo.ts`), align `buildXyloLitePrompt` with
      full `AGENT_TOOLS`.

**Deliverable:** answer to "what has Xylo said this week, with what
tools, on what model?" in <5 seconds.

### Phase 1 — Coverage (Week 3-5) ✅ COMPLETE

**Goal:** close the data gaps that make Xylo currently incomplete.

- [x] Add tools to `AGENT_TOOLS`:
  - [x] `get_recent_news` (multi-source, last 24-72h, deduplicated).
  - [x] `get_sentiment` (composite score across sources).
  - [x] `get_earnings_calendar` (upcoming earnings + estimates).
  - [x] `get_geopolitical_events` (macro events feed).
  - [x] `get_sector_flow` (sector rotation signals).
- [x] Build `lib/ai-agent/preflight/` — deterministic context fan-out.
      `classifyQuestion()` extended with question classes that map to
      required signal bundles.
- [x] Add coverage report to every chat response payload:
      `{ checked: [...], skipped: [...], stale: [...] }`. Surface in UI.
- [x] Build extractors in `lib/ai-agent/extractors/`:
  - [x] `news.ts` — raw articles → `{ sentiment, catalysts, risk_flags }`.
  - [x] `sentiment.ts` — raw posts → `{ score, momentum, divergences }`.
  - [x] `fundamentals.ts` — raw financials → `{ strength, red_flags, comparison }`.

**Deliverable:** every trade-call answer ships with a visible "I
checked these 7 things" coverage report.

### Phase 2 — Trust (Week 6-7) ✅ COMPLETE

**Goal:** make confidence scores mean something. Make risk rules
non-negotiable.

- [x] Build `lib/ai-agent/risk/gate.ts`:
  - [x] `validateRecommendation(rec, account, positions) → { approved, violations }`.
  - [x] Wired into `/api/chat` after the model produces a trade call.
  - [x] Blocks or annotates the response when violated.
  - [x] `strategy.config.yaml` becomes runtime validation, not prompt suggestion.
- [x] Build `lib/ai-agent/evals/`:
  - [x] Historical scenarios scaffolded; seed via `bun run xylo:eval:seed` once `agent_decisions` has trade-call rows worth replaying.
  - [x] 4 hallucination probes (fake ticker, fake date, fake earnings, fake news).
  - [x] 5 tool-routing tests (news, earnings, unusual options, sector flow, no-tools-greeting).
  - [x] Cost and latency tracking per scenario.
- [x] Confidence scoring formula for each recommendation
      (function of coverage completeness, signal agreement, and risk-rule pass).

**Deliverable:** each trade-call answer comes with a confidence score
and a risk-gate verdict. The "trust over $1,000" question becomes
operationally answerable: "8/10 + full coverage + risk gate green."

### Phase 3 — Synthesis Upgrade (Week 8-9)

**Goal:** adopt TradingAgents-shaped flow for the workload that
genuinely benefits.

- [ ] Implement multi-agent flow **only** for trade-call question
      class:
  - Parallel extractor agents (Fundamentals, Sentiment, News, Technical, Macro).
  - Optional Bull/Bear debate (1-2 rounds, structured output, mid-tier model).
  - Xylo as Trader: deep model, sees all extractor outputs + debate result.
  - TradeCritic: validates against `strategy.config.yaml` via the Phase 2 risk gate.
- [ ] Communication via shared structured state (Supabase scratch table
      or in-memory state object). No free chat between agents.
- [ ] Chat workload remains single-agent.
- [ ] Eval set demonstrates measurable improvement over single-agent
      baseline on trade-call scenarios.

**Deliverable:** breadth-first trade analyses are demonstrably better,
with eval evidence rather than vibes.

### Phase 4 — Self-Improvement Loop (Week 10-12+)

**Goal:** Xylo identifies its own weaknesses. Real, mechanical, not
magical.

- [ ] Outcome tracking: scheduled job links `agent_decisions` to actual
      price/regime outcomes at 1d / 7d / 30d horizons.
- [ ] Weekly reflection agent: reads last week's decisions + outcomes,
      produces structured `agent_lessons` entries (what was missed, what
      pattern recurred, what dimension was wrong).
- [ ] Lesson injection: relevant lessons surfaced into Xylo's system
      prompt by question class (e.g., "you have called this kind of setup
      wrong N times because…").
- [ ] Eval scores tracked over time; alert on regression after prompt or
      model changes.
- [ ] (Optional, later) Tool-routing calibration: which tools, when
      called, correlate with correct calls? Adjust tool descriptions and
      classification heuristics.

**Deliverable:** Xylo cites past lessons in its responses. "Last time I
called this kind of setup, I was wrong because…"

---

## Anti-goals

What this roadmap explicitly is **not**:

- A multi-agent rewrite of the chat workload. Research shows
  single-agent wins at chat-scale workloads.
- A move toward fine-tuning. Volume of decisions is too small for one
  user; not worth the complexity.
- A claim of "self-improving AI" in the marketing sense. Self-
  improvement here is a closed feedback loop you build, not an
  emergent property.
- A green light to add more tools before the decision log exists. Tools
  without observability compound rather than reduce uncertainty.

---

## Cross-references

- `docs/ai-agent/PHASE_0_PLAN.md` — Phase 0 (foundations) plan.
  Status: complete.
- `docs/ai-agent/PHASE_2_PLAN.md` — Phase 2 (trust) plan: risk gate +
  evals + confidence scoring.
- `docs/ai-agent/SHARED_LIBRARY.md` — current `lib/ai-agent/` structure.
- `docs/ai-agent/TOOLS.md` — current tool inventory.
- `docs/ai-agent/INTEGRATION_PLAN.md` — historical integration steps.
- `docs/ai-discord-bot/` — existing multi-agent reference implementation.
- `docs/db/README.md` — Supabase schema (will add `agent_decisions`,
  `agent_lessons` in Phase 0 / 4).

---

**Owner**: Conor Quinlan
**Last reviewed**: April 26, 2026
