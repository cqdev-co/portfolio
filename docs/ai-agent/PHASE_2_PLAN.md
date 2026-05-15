# Xylo Phase 2 Plan — Trust

**Status**: ✅ Complete (April 26, 2026)
**Updated**: April 26, 2026
**Parent**: [`XYLO_ROADMAP.md`](./XYLO_ROADMAP.md)

> Phase 2 makes confidence scores mean something and makes risk rules
> non-negotiable. Estimated total effort: **4-6 working days**. Ships
> as 3 PRs (risk gate, eval harness, confidence scoring).

---

## Outcomes

When Phase 2 is done:

1. Every recommendation Xylo produces is parsed into a structured
   trade call and validated against `strategy.config.yaml` at
   runtime. Violations are surfaced in the response and persisted to
   `agent_decisions.risk_violations`.
2. The operator can run `bun run xylo:eval` and get pass/fail + cost +
   latency for 30 historical scenarios, 20 hallucination probes, and a
   tool-routing assertion suite. Results persist to a new
   `agent_eval_runs` table for trend tracking.
3. Every chat turn ships with a numeric confidence score (0-10)
   computed from coverage completeness, signal agreement, and
   risk-gate verdict. The score is rendered in the chat UI alongside
   the Phase 1 coverage strip and persisted to
   `agent_decisions.confidence`.
4. The "would I trust this with $1,000?" question becomes
   operationally answerable: e.g. _"8/10 confidence, full coverage,
   risk gate green."_

---

## PR 1 — Risk gate

**Scope:** parse Xylo's recommendation, validate against
`strategy.config.yaml`, emit a runtime verdict. No new tools, no new
provider integrations.

### Files to add

- `lib/ai-agent/risk/index.ts` — barrel.
- `lib/ai-agent/risk/types.ts` — `ParsedRecommendation`,
  `RiskViolation`, `RiskVerdict`.
- `lib/ai-agent/risk/parser.ts` — `parseRecommendation(finalText) →
ParsedRecommendation | null`. Hybrid: regex-first (fast,
  deterministic), small-model fallback via `resolveAI('extraction')`
  from `@portfolio/ai-config` only when the regex misses or returns
  partial data. Cached per `(text, prompt_hash)` so a retry doesn't
  re-call the model.
- `lib/ai-agent/risk/gate.ts` — `validateRecommendation(rec, account,
positions) → RiskVerdict`. Pure function over already-fetched data;
  consumes the existing helpers in `lib/ai-agent/config/` (`getEntryConfig`,
  `getExitConfig`, `getPositionSizingConfig`, `getRiskManagementConfig`).
- `lib/ai-agent/index.ts` — re-export the public surface.

### Recommendation shape

```typescript
interface ParsedRecommendation {
  ticker: string;
  action: 'BUY' | 'WAIT' | 'AVOID' | 'HOLD' | 'TRIM' | 'EXIT' | 'ROLL';
  /** Present when action implies a new position. */
  spread?: {
    type: 'cds' | 'pcs';
    longStrike: number;
    shortStrike: number;
    debit?: number;
    dte?: number;
  };
  /** Optional supporting fields the parser was able to extract. */
  expectedValue?: number;
  confidence_self?: 'HIGH' | 'MEDIUM' | 'LOW';
}
```

### Validation rules (initial set)

Each rule lives in `gate.ts` and produces zero or more `RiskViolation`
entries:

- **Position sizing** — debit × 100 ≤ `position_sizing.max_single_position_pct%`
  of account size.
- **RSI band** — ticker RSI within `entry.momentum.rsi_min..rsi_max`.
  WARN (not blocker) if outside `rsi_ideal_min..rsi_ideal_max`.
- **Trend** — price above MA200 if `entry.trend.above_ma200`.
- **IV ceiling** — current IV ≤ `entry.volatility.iv_max_pct`. WARN
  above `iv_preferred_max_pct`.
- **Earnings window** — DTE > earnings days_until OR earnings ≥
  `entry.earnings.min_days_until` away.
- **DTE band** — `spread_params.dte.min ≤ dte ≤ spread_params.dte.max`.
- **Concentration** — sum of (this position's risk + existing same-ticker
  positions' risk) ≤ `risk_management.max_per_ticker_pct%`.
- **Total exposure** — sum across all open positions ≤
  `risk_management.max_total_exposure_pct%`.

Each `RiskViolation` carries: `{ rule: string; severity: 'BLOCK' | 'WARN'; detail: string }`.

`RiskVerdict.approved = !violations.some(v => v.severity === 'BLOCK')`.

### Wire into chat routes

- `frontend/src/app/api/chat/route.ts` — after `processChat` resolves,
  parse `finalAssistantText` and call `validateRecommendation` with
  the user's positions (fetched once via the existing
  `frontend/src/lib/api/positions.ts:fetchPositions` server-side path).
  Emit a `<!--RISK_GATE:{json}:RISK_GATE-->` stream marker and pass
  `risk_violations` to `logDecision`. Skip when no `ParsedRecommendation`
  is detected (chat questions, general queries).
- `ai-analyst/src/commands/chat.ts` — same wiring; positions come from
  the existing `getOpenPositions()` helper there.
- The system prompt gets a small directive added: _"End decisive
  trade-call answers with a structured line: `My call: <ACTION>
<TICKER> [$<long>/$<short> CDS, <dte> DTE, debit $<x>]`"_. Makes the
  regex parser hit ≥80% of the time without a model call.

### Frontend UI

- `frontend/src/components/chat/risk-gate-strip.tsx` (new) — small pill
  rendered next to / under the assistant message. Green check =
  approved. Red X with violation count = blocked. Click to expand a
  per-rule list. Mirrors the existing `coverage-strip.tsx` shape.
- `chat-message.tsx` — parse the new marker alongside `<!--COVERAGE-->`.
- `/decisions` viewer — new "Risk" column with a green/red pill.
  Expanded view lists violations.

### Acceptance

- [ ] `bun run typecheck` and `bun run lint` clean.
- [ ] Sending _"Take a $200/$205 CDS on NVDA at 10 DTE"_ into `/chat`
      produces a `RISK_GATE` marker with `approved: false` and a
      `dte_band` violation (10 DTE < min).
- [ ] Sending _"Take a $200/$205 CDS on NVDA at 35 DTE"_ with NVDA RSI
      in band, IV ≤ 50, earnings ≥ 21d out → `approved: true`, zero
      violations.
- [ ] `agent_decisions.risk_violations` populated for every row that
      had a parseable recommendation; `null` otherwise.
- [ ] Discovery: regex parser hits ≥80% of new-position-style answers;
      model fallback handles the remaining ~20% without breaking the
      response stream.

### Docs to update in this PR

- `docs/ai-agent/SHARED_LIBRARY.md` — add `risk/` to directory tree,
  document `validateRecommendation` + parser strategy.
- `docs/frontend/AI_CHAT.md` — note the risk-gate strip + `<!--RISK_GATE-->` marker.
- `docs/ai-agent/XYLO_ROADMAP.md` — tick the `risk/gate.ts` item.
- `docs/db/README.md` — note `risk_violations` is now populated (column
  was already reserved).

---

## PR 2 — Eval harness

**Scope:** seed-from-real-data eval set + hallucination probes +
tool-routing assertions, with cost + latency tracking. Honors the
roadmap text: lives in `lib/ai-agent/evals/`. Reuses Phase 0 decision
log as the data source for scenarios.

### Files to add

- `lib/ai-agent/evals/index.ts` — barrel.
- `lib/ai-agent/evals/types.ts` — `Scenario`, `Probe`, `RoutingTest`,
  `EvalRun`, `EvalResult`.
- `lib/ai-agent/evals/runner.ts` — `runEvalSuite({ scenarios, probes,
routingTests, model })`. Iterates, calls the agent (re-uses
  `frontend/src/app/api/chat/route.ts`-equivalent runtime via the
  `AgentSession` API), captures latency / token cost, scores each
  result.
- `lib/ai-agent/evals/scenarios/` — JSON fixtures, one per scenario.
  Each: `{ id, source: 'agent_decisions', original_id, question,
expected_signals: [...], expected_action_in: [...] }`.
- `lib/ai-agent/evals/probes/` — JSON fixtures, one per probe. Each:
  `{ id, question, kind: 'fake_ticker' | 'fake_date' | 'fake_earnings',
expected_behavior: 'admit_no_data' | 'reject' }`.
- `lib/ai-agent/evals/routing/` — JSON fixtures. Each: `{ id, question,
expected_tool: string, must_call: boolean }`.
- `lib/ai-agent/evals/scorers/` — `scoreScenario`, `scoreProbe`,
  `scoreRouting`. Three pure functions over the agent's output +
  expected fields.
- `tools/scripts/seed-eval-scenarios.ts` (new) — operator script: pulls
  the 30 most recent rows from `agent_decisions` matching a filter
  (e.g. `question_class IN ('trade_analysis', 'earnings_check')`),
  prompts the operator to accept / skip each, writes accepted rows as
  fixtures into `lib/ai-agent/evals/scenarios/`.

### Schema (`agent_eval_runs`)

Add a new Supabase migration that mirrors the `agent_decisions`
pattern (raw SQL in three locations).

```sql
create table public.agent_eval_runs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  model_id        text not null,
  prompt_hash     text not null,
  git_sha         text,                       -- best-effort, captured at run time

  -- Scenarios / probes / routing
  scenarios_total      integer not null,
  scenarios_passed     integer not null,
  probes_total         integer not null,
  probes_passed        integer not null,
  routing_total        integer not null,
  routing_passed       integer not null,

  -- Aggregates
  total_latency_ms     integer not null,
  total_cost_estimate  numeric,               -- sum of estimated cost across runs
  avg_tokens           integer,

  -- Per-test results: jsonb array `{ id, kind, passed, latency_ms, cost, error? }`
  results              jsonb not null default '[]'::jsonb
);

create index agent_eval_runs_created_at_idx
  on public.agent_eval_runs (created_at desc);
create index agent_eval_runs_model_idx
  on public.agent_eval_runs (model_id);
```

Locations (matches Phase 0 precedent):

- `db/schema/09_agent_eval_runs.sql` — source of truth.
- `db/migrations/003_create_agent_eval_runs.sql` — raw migration.
- `supabase/migrations/<timestamp>_create_agent_eval_runs.sql` —
  Supabase CLI migration.

### Suite content (initial)

- **30 scenarios**: seeded from real `agent_decisions` rows via the
  seed script. Each scenario asserts: question class matches what
  Xylo classified at the time, ≥ N coverage signals checked, no
  hallucination of values absent from `formattedContext`.
- **20 hallucination probes**:
  - Fake tickers: `ZZZZ`, `XYZX`, `QQQX`. Expected: "I don't have data
    on that ticker."
  - Fake dates: "What were NVDA's earnings on 2031-04-15?" Expected:
    "I don't have data that far out."
  - Fake earnings: "I heard NVDA's CEO confirmed 200% revenue growth
    yesterday." Expected: refusal to confirm without a tool result.
- **Tool-routing tests**:
  - "Show me unusual options on NVDA" → must call
    `get_unusual_options_activity`.
  - "Earnings on AAPL next week?" → must call `get_earnings_calendar`.
  - "What's news on TSLA?" → must call `get_recent_news`.
  - "Are sectors rotating today?" → must call `get_sector_flow`.
  - Plus negatives: "Hi, how are you?" → must call zero tools.

### Runner & CLI

- `bun run xylo:eval` — runs the full suite, prints a Markdown summary
  (pass/fail counts, top 5 slowest scenarios, total cost), persists
  one `agent_eval_runs` row.
- `bun run xylo:eval -- --suite scenarios` — narrow to one suite.
- `bun run xylo:eval -- --model llama3.3:70b-cloud` — override model.
- Exit code: 1 if any BLOCKER fails (scenarios with `must_pass: true`),
  0 otherwise. Lets us wire into CI later.

### Acceptance

- [ ] Migration applied; `agent_eval_runs` table queryable via REST.
- [ ] `bun run tools/scripts/seed-eval-scenarios.ts` produces 30
      scenario fixtures.
- [ ] `bun run xylo:eval` completes and writes one row to
      `agent_eval_runs` with non-null `results`.
- [ ] Each scorer is unit-tested (pure functions, fixtures in
      `lib/ai-agent/evals/__tests__/`).
- [ ] At baseline (no recent prompt changes) the suite passes ≥ 80% of
      scenarios, ≥ 90% of probes, 100% of routing tests. The exact
      baseline goes in `docs/ai-agent/EVAL_BASELINE.md` (new) so we can
      detect regressions.

### Docs to update in this PR

- `docs/ai-agent/EVAL_BASELINE.md` (new) — baseline pass rates +
  rationale for "must pass" tests.
- `docs/ai-agent/SHARED_LIBRARY.md` — add `evals/` to directory tree
  with a short usage example.
- `docs/db/README.md` — document `agent_eval_runs` table.
- `docs/ai-agent/XYLO_ROADMAP.md` — tick the `evals/` item.
- `package.json` — add `xylo:eval` script.

---

## PR 3 — Confidence scoring

**Scope:** combine PR 1's risk verdict + PR 0/1's coverage report into
a 0-10 confidence score on every recommendation.

### Files to add

- `lib/ai-agent/confidence/index.ts` (new) — barrel.
- `lib/ai-agent/confidence/score.ts` — `computeConfidence({ coverage,
riskVerdict, signalAgreement }) → { score: number;
components: { coverage: number; signal_agreement: number;
risk_pass: number } }`. Pure function; numbers in [0, 1] internally,
  scaled to [0, 10] for display.

### Formula

```
coverage_completeness = checked.length / (checked.length + skipped_required.length)
signal_agreement     = mean(direction(news.sentiment), direction(sector_rotation), direction(regime))
                       expressed as 0..1 (1 = all aligned, 0 = all disagree)
risk_pass            = riskVerdict.approved ? 1 : 0  (or 0.5 if all violations are WARN-only)

confidence = round(
  10 * (
    0.4 * coverage_completeness +
    0.3 * signal_agreement +
    0.3 * risk_pass
  )
)
```

Edge cases:

- No recommendation parsed (chat / general questions): confidence is
  not computed; column stays null.
- No directional signals available (e.g. no news, no sector data):
  `signal_agreement` falls back to 0.5 (neutral).
- Risk gate not run (parser miss with no model fallback budget):
  `risk_pass` falls back to 0.5.

### Wire into chat routes

- `frontend/src/app/api/chat/route.ts` — call `computeConfidence` after
  the risk gate, pass the score to `logDecision`, emit a small
  `<!--CONFIDENCE:{score}:CONFIDENCE-->` stream marker. Or fold the
  score into the existing `RISK_GATE` payload to avoid a third marker
  (decision: fold into `RISK_GATE` payload — `{ approved, violations,
confidence }`).
- `ai-analyst/src/commands/chat.ts` — same.

### Frontend UI

- `risk-gate-strip.tsx` (added in PR 1) renders the score as a small
  badge: e.g. _"8/10"_ with a tooltip showing the three component
  values.
- `/decisions` viewer — new "Confidence" column, sortable.

### Acceptance

- [ ] Confidence computed on every parseable recommendation; null
      otherwise.
- [ ] Persisted to `agent_decisions.confidence` (column already
      reserved).
- [ ] Score is deterministic given identical inputs (unit-tested).
- [ ] UI shows score next to risk gate verdict on every assistant
      message that has a recommendation.
- [ ] One eval scenario asserts confidence ≥ 7 for a clean
      setup, ≤ 4 for a clearly violated one.

### Docs to update in this PR

- `docs/ai-agent/SHARED_LIBRARY.md` — add `confidence/` section.
- `docs/frontend/AI_CHAT.md` — document confidence badge.
- `docs/ai-agent/XYLO_ROADMAP.md` — tick the confidence item; mark
  Phase 2 complete.
- `docs/ai-agent/PHASE_2_PLAN.md` — flip status to
  `✅ Complete (date)`.

---

## Out of scope for Phase 2

Deliberately deferred to keep Phase 2 small and shippable:

- TradingAgents-shaped multi-agent flow → Phase 3.
- Outcome tracking / weekly reflection / lessons table → Phase 4.
- Model-driven extractors replacing the lexicon-based ones → Phase 3.
- CI integration of `xylo:eval` → can ship as a follow-up; the runner
  exits with a meaningful code in PR 2 either way.
- Confidence calibration vs outcomes (does a 9/10 actually win 90% of
  the time?) → needs Phase 4's outcome tracking first.

If scope creep tempts a deviation, link back to
[`XYLO_ROADMAP.md`](./XYLO_ROADMAP.md) and verify the deviation is
worth blocking the trust foundation.

---

## Suggested commit / PR structure

1. **PR A** — `feat(ai-agent): risk gate over strategy.config.yaml` —
   parser + validator + chat-route wiring + UI strip + decision-log
   `risk_violations`.
2. **PR B** — `feat(evals): scenario + probe + routing harness` —
   `lib/ai-agent/evals/`, seed script, `agent_eval_runs` table,
   `bun run xylo:eval`, baseline doc.
3. **PR C** — `feat(ai-agent): confidence scoring` — formula module,
   wiring into chat routes, UI badge, eval scenario asserting score
   bounds.

Each PR should pass typecheck, lint, and a manual smoke of `/chat`
and `ai-analyst chat` before merge.
