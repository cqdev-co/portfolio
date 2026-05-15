# Local AI Eval Harness

A standalone workspace that measures the **quality** and **runtime** of candidate
Ollama models against realistic prompts captured from this monorepo. The intent is
data-driven model selection **before** rewiring any existing service
(`ai-analyst`, `cds-engine-strategy`, frontend `api/chat`, `api/dashboard/briefing`) to
a specific local model.

- Code: [tools/local-ai-eval/](../../tools/local-ai-eval/)
- Plan origin: Local AI Eval Harness plan
- Related: [docs/monorepo/README.md](../monorepo/README.md#local-ai)

## What it does

- Loads a set of tasks from `tools/local-ai-eval/tasks/*.json`. Each task targets one of
  four workloads: `chat`, `briefing`, `narrative`, `tool-call`.
- Loads a set of candidate models from `tools/local-ai-eval/models.config.json`.
- For each `(model, task)` pair, runs the task `runsPerTask` times against the local
  Ollama server and records timing + output.
- Scores each run with deterministic scorers (no LLM-as-judge in V1):
  - **Schema**: parse output as JSON, validate required keys/types.
  - **Content**: regex / contains / length bounds.
  - **Tool call**: exactly-one tool call, expected name, required args.
- Writes `reports/{timestamp}/raw.json` and `reports/{timestamp}/report.md`. Reports are
  gitignored.

There is also a **soak** command that hammers a single model at a cadence for a duration
and reports latency drift (watches for thermal throttling on a Mac).

## Requirements

- [Ollama](https://ollama.com) running locally on `http://localhost:11434`.
- Candidate models pulled via `ollama pull`. Tags in `models.config.json` are
  **placeholders**; replace them with the exact tags you see in `ollama list`.
- Bun (see root `package.json` `engines`).

## Usage

From the repo root:

```bash
# Install (root-level; the workspace is included in bun workspaces).
bun install

# Full matrix (all models in models.config.json × all tasks in tasks/).
bun run ai:eval

# One model only.
bun run ai:eval --model qwen3.6-35b-a3b-q4_k_m

# One workload only.
bun run ai:eval --workload briefing

# One task only.
bun run ai:eval --task briefing-01

# Sustained load (watch for thermal throttling / drift).
bun run ai:soak --model qwen3.6-35b-a3b-q4_k_m --duration 30m --interval 30s
```

Or from inside the workspace:

```bash
cd tools/local-ai-eval
bun run eval
bun run soak --model qwen3.6-35b-a3b-q4_k_m --duration 30m
```

Models that are listed in `models.config.json` but not pulled locally are **skipped**
with a hint to `ollama pull`; the run does not fail.

## Model matrix (tuned for a 36 GB unified-memory Mac)

`models.config.json` lists the models evaluated against this harness. Usable RAM budget
after macOS overhead is roughly 22–28 GB.

Models currently on disk (three total, ~45 GB):

- **Qwen3.6 35B A3B (Q4_K_M, think off)** — `qwen3.6:35b`, 23 GB MoE, 3B active per
  token. **PRIMARY for single-shot workloads** (briefing, narrative, chat, tool-call).
- **Gemma 4 26B A4B** — `gemma4:26b`, 17 GB MoE, 3.8B active. **PRIMARY for multi-turn
  agent loops.** Times out on one-shot long prompts; use Qwen3.6 there.
- **Qwen3 8B dense** — `qwen3:8b`, 5.2 GB. Fast fallback when RAM or latency is tight.

Previously evaluated and since removed to reclaim disk:

- `qwen3:30b` (18 GB, prior-generation MoE baseline) — removed after the two primary
  candidates were validated. Re-pull with `ollama pull qwen3:30b` if you want the
  three-way comparison back.

**Explicitly excluded on 36 GB with Homebrew Ollama** (can be enabled on different
setups):

- `qwen3.6:35b-a3b-*-nvfp4` (base and coding variants) — 21-22 GB weights, would fit,
  but **Homebrew Ollama 0.21.0 ships without the MLX dynamic library** required to
  run NVFP4 on Apple Silicon. Tested 2026-04-18: model pulls fine, but load fails
  with `mlx runner failed: MLX not available`. To enable, install Ollama from the
  official macOS app installer (https://ollama.com/download) which bundles MLX.
  See [the Ollama MLX blog post](https://ollama.com/blog/mlx) for context.
- `qwen3.6:35b-a3b-mlx-bf16` — ~70 GB weights; requires 128 GB+ Mac.
- `qwen3.6:35b-a3b-coding-mxfp8` / `:35b-a3b-mxfp8` — ~38 GB weights; will not fit in
  36 GB alongside KV cache and macOS.

### Picking the right Ollama install on Mac

- **Homebrew `brew install ollama`** (what we used): minimal server binary only.
  Loads GGUF (Q4_K_M / Q5_K_M) variants. **Does NOT load NVFP4 / MXFP8 / MLX-BF16.**
- **Official macOS app from ollama.com**: includes MLX runtime. Loads MLX and NVFP4
  variants. Uses ~200-300 MB more disk but unlocks the newer quantization paths.

For the current workload (Q4_K_M models), the brew install is fine. Swap to the
official app only if you want to experiment with NVFP4 / MLX-specific builds.

## Agent eval (multi-turn tool loops)

See [tools/local-ai-eval/src/agent.ts](../../tools/local-ai-eval/src/agent.ts).
Agent scenarios are JSON tasks with `workload: "agent-multi-turn"` that define mock
tool responses, an expected tool-call sequence, a turn budget, and final-answer
content checks. The runner plays the model forward turn by turn, injecting mock
results when the model calls a tool, and scores whether the model:

- Actually calls required tools (vs answering from memory / hallucinating)
- Calls tools in the expected order
- Stays under the turn and tool-call budget
- Terminates cleanly on a final answer
- Produces a final answer that references tool-provided data

Run with:

```bash
bun run ai:agent                    # all models, all agent tasks
bun run ai:agent --model qwen3.6:35b --runs 3
bun run ai:agent --tag agent-multi-turn --model gemma4:26b
```

Three seed scenarios ship with the repo (in [tools/local-ai-eval/tasks/](../../tools/local-ai-eval/tasks/)):

- `agent-entry-decision-aapl` — user proposes a specific spread. Model should call
  `get_trading_regime` → `get_ticker_data` → `calculate_spread` → final verdict.
- `agent-entry-decision-aapl-strict` — same scenario with a stricter system prompt
  that explicitly forbids answering without tools. Diagnostic for prompt sensitivity.
- `agent-ambiguous-dont-fabricate` — user asks about a ticker with no data.
  Model must NOT fabricate prices; should return "insufficient data".

Tool shapes mirror the real tool registry in
[lib/ai-agent/tools/definitions.ts](../../lib/ai-agent/tools/definitions.ts).

### Agent findings (2026-04-18)

| Model                                         | PASS / 6  | Notes                                                                                                                             |
| --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **gemma4:26b**                                | **6 / 6** | Perfect. Always uses tools, correct sequence, grounded final answers.                                                             |
| qwen3:30b                                     | 4 / 6     | Called tools correctly; 1 minor content-check false negative, 1 no-matching-mock (model explored a ticker the mock didn't cover). |
| **qwen3.6:35b (think off)**                   | **2 / 6** | **Skipped tool calls on AAPL entry decision (0 tool calls both runs), fabricating verdicts from training knowledge.**             |
| qwen3.6:35b (think off, STRICT system prompt) | **3 / 3** | Same model + stricter prompt: perfect. Tool-skipping is prompt-sensitive, not a capability limit.                                 |

**Headline finding:** Qwen3.6 is capable as an agent but **requires explicit MUST/MUST
NOT language** in the system prompt. With a permissive "use tools when appropriate"
prompt, it answers from memory and fabricates numbers. With an explicit "ANY answer
given WITHOUT tool calls is automatically WRONG" prompt, it behaves reliably. Gemma 4
does not need this spoon-feeding — it uses tools correctly from softer prompts.

**Implication:** If you want Qwen3.6 as the primary agent brain for speed, your
production system prompts must be defensively written. Otherwise use Gemma 4 26B for
short agent loops (where its long-prompt verbosity issue doesn't matter).

### Real service integration

The `ai-analyst` CLI supports pointing at a local model out of the box:

```bash
bun run --cwd ai-analyst analyst analyze AAPL --ai-mode local --ai-model qwen3.6:35b
```

No code changes needed. Verified that flags are accepted; end-to-end run was blocked
on an unrelated Yahoo Finance rate limit (429), not on model or Ollama issues.

## Findings from the 2026-04-18 eval run

### Qwen3.6 35B A3B with `think: false` is the primary production candidate

- **17-18 / 18 correct verdicts** across the 6-task financial judgment set (3 runs each).
- **4 / 4 PASS on real cds-engine prompts** captured from
  [cds-engine-strategy/src/utils/ai-narrative.ts](../../cds-engine-strategy/src/utils/ai-narrative.ts)
  (`UNIFIED_SYSTEM_PROMPT` and `POSITION_MANAGEMENT_PROMPT`).
- Correctly reads position state: _"NVDA at $144.80, just $0.20 below the short strike
  of $145"_ — critical for position-management narration.
- Correctly identifies gamma risk on 5-DTE profitable spreads and recommends CLOSE.
- **Critical caveat: thinking mode is ON by default.** With thinking on, briefing
  latency is ~108s vs ~15s with `think: false`. **Always set `think: false` in
  production code.**
- One-shot hallucination observed in the first eval run ("safely outside short
  strikes") did NOT reproduce across 3-run verification. Keep schema-level constraints
  and `notContains` guards in place to catch any regression.

### Gemma 4 26B A4B is NOT viable for real production prompts on this hardware

- Excellent on **short synthetic judgment tasks**: 6/6 correct verdicts with the best
  confidence calibration of any model tested (e.g. conf=3 on genuinely ambiguous
  overextended-breakout).
- **But on real cds-engine prompts, timed out 4/4** runs at the 180s budget with
  uncapped output.
- Naively capping `num_predict` to 1024 produced **empty output (0 chars)** — likely
  truncates mid-thinking-preamble. Gemma 4 docs note that even with thinking disabled,
  the model still emits thought tags.
- At its recommended sampling params (`temperature=1.0, top_p=0.95, top_k=64`) it
  produces ~3000+ tokens per answer on real prompts, vs Qwen3.6 think-off's ~500 tokens.
- Not safe for: real production prompts from cds-engine, dashboard briefing, or
  ai-analyst narrative generation.
- Safe for: short synthetic reasoning tasks (judgment-style verdicts) where output
  length stays bounded.

### Why the original naive pass rates were misleading

Initial judgment eval showed 4/6 PASS for Qwen3.6 and 4/6 PASS for Gemma 4. Every
failure traced to a single overly-literal content check — e.g. requiring the literal
string `TSLA` when models correctly reasoned about TSLA using its specific price levels
instead. After replacing ticker regex with numeric/concept anchors (prices, strikes,
DTE, 50DMA, etc.), pass rates became meaningful.

**Lesson:** content checks for reasoning quality are hard. Use the harness mainly for
**schema compliance + latency + tool-call correctness**; manual reading of outputs
remains necessary for **judgment quality** evaluation.

## Adding a new model

Append one entry to `tools/local-ai-eval/models.config.json`:

```json
{
  "id": "exact-ollama-tag-from-ollama-list",
  "label": "Human readable label",
  "options": { "temperature": 0.3, "num_ctx": 8192 },
  "note": "Optional rationale shown in the report"
}
```

No code changes needed.

## Adding a new task

Drop a new JSON file into `tools/local-ai-eval/tasks/`. Schema (see
[src/types.ts](../../tools/local-ai-eval/src/types.ts) for the authoritative type):

````json
{
  "id": "briefing-02",
  "workload": "briefing",
  "description": "Optional note for the reader.",
  "system": "System prompt...",
  "user": "User prompt...",
  "tools": [],
  "expectedSchema": {
    "type": "object",
    "required": ["summary"],
    "properties": { "summary": { "type": "string" } }
  },
  "contentChecks": [
    { "kind": "contains", "value": "VIX" },
    { "kind": "notContains", "value": "```" },
    { "kind": "regex", "pattern": "^\\{", "flags": "s" },
    { "kind": "minLength", "chars": 50 },
    { "kind": "maxLength", "chars": 4000 }
  ],
  "expectedTool": { "name": "get_quote", "requiredArgs": ["symbol"] },
  "tags": ["placeholder"]
}
````

Fields are all optional except `id`, `workload`, `system`, `user`. Use `expectedSchema`
for JSON-structured workloads; use `expectedTool` for `tool-call` workloads.

### Task tags convention

Filter tasks via `bun run ai:eval --tag <name>`. Tags currently in use:

- `placeholder` — seed tasks modeled after service prompts; low fidelity.
- `financial-reasoning` — the 6-task judgment pack (Act/Watch/Ignore verdicts on
  synthetic-but-realistic scenarios).
- `real-prompt` — prompts captured verbatim from production services, e.g. the two
  cds-engine real prompts at
  [tools/local-ai-eval/tasks/real-cds-\*.json](../../tools/local-ai-eval/tasks/).
  These are the highest-fidelity tasks; more should be added over time.

### Writing content checks that do not lie

The single biggest lesson from the 2026-04-18 eval: **overly literal regex checks
produce false negatives that look like model failures.** Specifically:

- Do NOT require literal ticker strings (`NVDA`, `TSLA`) — models often use company
  names (`Nvidia`, `Tesla`) which is arguably better. If you must test ticker
  grounding, use `{ "kind": "regex", "pattern": "(NVDA|Nvidia)" }`.
- DO require specific numeric anchors from the prompt (strike prices, DTEs, RSI
  values, VIX levels) — these are unambiguous and a model that references them is
  genuinely grounded in the data.
- DO use `notContains` to catch known hallucination phrases specific to a workload
  (e.g. `"outside the short strike"` for iv-crush tasks, since the prompt explicitly
  states the position is inside strikes).

Recommended V1 task set: **10–20 real prompts** captured from the services above.
The harness seeds 4 placeholder tasks (one per workload), 6 financial-reasoning
tasks, and 2 real cds-engine prompts for 12 tasks total.

## Reading a report

Each run produces a folder `tools/local-ai-eval/reports/{YYYYMMDD-HHMMSS}/`:

- `report.md` — human-readable summary:
  - Aggregate table: pass rate, p50/p95 total latency, mean time-to-first-token (TTFT),
    mean tokens/sec per `(model, workload)`.
  - Sample outputs: up to 3 failures and 2 passes per model.
- `raw.json` — complete record of every run (prompt, output, checks, timings).

Soak reports include an ASCII latency sparkline and a first-half vs second-half drift
percentage (positive = slower over time; watch for thermal throttling).

## What is **out of scope** (V1)

- Changing any existing service's default model or env wiring.
- Fine-tuning, judge-model scoring, quantization sweeps.
- Python service evals. Prompts captured from Python services can be copied into
  `tasks/*.json` as-is; no Python code required here.

## Consumers of these findings

- [ai-discord-bot/](../../ai-discord-bot/) - the first production consumer.
  Applies the `STRICT_TOOL_USE` rule verbatim across all four specialist agents,
  uses `qwen3.6:35b` with `think: false` as the single model, and treats
  `calculate_spread` as a deterministic tool so the model never does P&L math.
  See [docs/ai-discord-bot/README.md](../ai-discord-bot/README.md).

## File layout

```
tools/local-ai-eval/
  package.json
  tsconfig.json
  models.config.json
  tasks/*.json
  src/
    runner.ts
    soak.ts
    config.ts
    types.ts
    ollama-client.ts
    scorers/
      schema.ts
      regex.ts
      tool-call.ts
      index.ts
    report/
      json.ts
      markdown.ts
  reports/             # gitignored
```
