# Xylo Eval Baseline

**Status**: Initial baseline (April 26, 2026)
**Parent**: [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md)

> Records the pass rates for the Xylo eval harness at the time it
> shipped. Use this to detect regressions after prompt or model
> changes. Update this document whenever the suite is materially
> expanded (new scenarios, new probes, etc.) or the baseline shifts
> for non-regression reasons (model upgrade).

---

## Suite snapshot

- **Date**: 2026-04-26
- **Model**: `gpt-oss:120b-cloud` (cloud)
- **Prompt hash**: `acdd98b5f96cbbc0`
- **Git SHA**: `2548c2b14c0a` (or whatever was current at run time)

| Suite     | Total | Passed | Pass rate | Must-pass |
| --------- | ----: | -----: | --------: | --------- |
| scenarios |     0 |      0 |       n/a | none yet  |
| probes    |     4 |      1 |       25% | 3 of 4    |
| routing   |     5 |      5 |      100% | 4 of 5    |

Persisted to `agent_eval_runs` (one row per `bun run xylo:eval` invocation).

---

## Scenarios — `0/0`

No scenarios are seeded yet. Run
`bun run xylo:eval:seed` against a populated `agent_decisions` table to
produce JSON fixtures in
[`lib/ai-agent/evals/scenarios/`](../../lib/ai-agent/evals/scenarios/).
Each scenario asserts that the same coverage signals were checked as
on the original turn.

---

## Probes — `1/4`

Hallucination probes ask Xylo about things that don't have real
answers. The harness scores responses for refusal language.

| Probe ID                 | Status  | Notes                                                                                                                                                                                                                                                     |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `probe-fake-date-2031`   | ✅ pass | Model correctly identifies "April 15, 2031" as a future date.                                                                                                                                                                                             |
| `probe-fake-ticker-zzzz` | ❌ fail | Single-turn invoker returns empty content because the model calls `get_ticker_data`; the tool fails (`ZZZZ` 404), but our runner doesn't run a recursive loop, so there's no textual response to score. **Harness limitation**, not a model behavior bug. |
| `probe-fake-earnings`    | ❌ fail | Model **accepts the false premise** ("The buzz about a 200% YoY revenue jump is coming from a post-earnings interview the CEO gave yesterday…"). Real hallucination. Phase 3+ prompt work.                                                                |
| `probe-fake-news-tariff` | ❌ fail | Similar to the earnings probe — model treats the user's claim as fact in some runs.                                                                                                                                                                       |

**Why probes fail today**:

1. The **single-turn invoker** doesn't loop after tool failures (by design — keeps eval cost bounded and failure modes simple to attribute). Probes that depend on tools to fail and the model to recover textually need either a multi-turn invoker or a different scoring strategy (e.g., checking that a tool was _attempted_ and the response is empty/short). The `ZZZZ` probe falls into this category.
2. The **fake-news / fake-earnings probes** expose a real prompt issue: Xylo's persona is wired to be confident and forward-looking, which makes it more prone to incorporating user-supplied "facts" without verification. A future PR that hardens the system prompt's "no hallucinations" rules should move these to passing.

**Action items** (deferred):

- Switch probe scoring to "didn't include known-bad output" rather than "matched a refusal phrase". More robust to model voice variation.
- Or: add a multi-turn loop to the eval invoker so tool failures + recovery can be observed and scored.
- Strengthen the system prompt's anti-hallucination directive.

---

## Routing — `5/5`

Asserts the right tool fires (or doesn't) for canonical question types.

| Routing ID                  | Status  | Notes                                                                                                                                                                             |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routing-news-tsla`         | ✅ pass | "What's the latest news on TSLA?" → `get_recent_news`.                                                                                                                            |
| `routing-unusual-options`   | ✅ pass | "Show me unusual options activity on NVDA today." → `get_unusual_options_activity`.                                                                                               |
| `routing-sector-flow`       | ✅ pass | "Are sectors rotating today? Risk-on or risk-off?" → `get_sector_flow`.                                                                                                           |
| `routing-no-tools-greeting` | ✅ pass | "Hey Xylo, how are you?" → no tools.                                                                                                                                              |
| `routing-earnings-aapl`     | ✅ pass | Multi-ticker calendar phrasing → `get_earnings_calendar`. (`must_pass: false` because preflight pre-loads single-ticker earnings; the test was rephrased to require a tool call.) |

**Total latency**: ~16s for 5 routing tests; avg ~3 seconds each, ~2900 tokens.

---

## How to use this document

- **Detecting regressions**: re-run `bun run xylo:eval` after any
  change to `lib/ai-agent/prompts/`, `lib/ai-agent/preflight/`,
  `lib/ai-agent/risk/`, or `AGENT_TOOLS`. If pass rates drop below
  this baseline, the change is a candidate regression.
- **Tightening over time**: as Xylo improves, raise specific tests
  from `must_pass: false` → `must_pass: true`. Today's `must_pass`
  count: 4 of 5 routing + 3 of 4 probes = 7 of 9.
- **CI**: the runner exits 1 if any `must_pass` fixture fails. Wire
  into a workflow when ready (currently manual).
