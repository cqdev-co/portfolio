/**
 * `bun run xylo:eval` — run the Xylo eval harness.
 *
 * Phase 2 of the Xylo roadmap. Runs scenarios + hallucination probes
 * + tool-routing tests against a configured Ollama model, prints a
 * Markdown summary, and persists one row to `agent_eval_runs` for
 * trend tracking.
 *
 * The agent invoker uses `runPreflight` (Phase 1) + a single-turn
 * Ollama call with the same `AGENT_TOOLS` schema the production
 * chat route registers. We intentionally don't run the full
 * recursive tool loop here — keeping evals to one model turn keeps
 * latency + cost bounded and makes failure modes easier to attribute.
 *
 * Usage:
 *   bun run xylo:eval                       # full suite
 *   bun run xylo:eval -- --suite probes
 *   bun run xylo:eval -- --suite routing
 *   bun run xylo:eval -- --model llama3.3:70b-cloud
 *   bun run xylo:eval -- --no-persist       # don't write to agent_eval_runs
 *   bun run xylo:eval -- --concurrency 1
 *
 * Exit code:
 *   0 — all `must_pass` fixtures passed.
 *   1 — at least one `must_pass` fixture failed (suitable for CI).
 *   2 — runner error (config / network / etc.).
 */

import { execSync } from 'node:child_process';
import {
  AGENT_TOOLS,
  computeConfidence,
  hashPrompt,
  parseRecommendation,
  runEvalSuite,
  runPreflight,
  skipGate,
  toOllamaTools,
  validateRecommendation,
  type AgentInvoker,
  type EvalKind,
  type EvalRun,
  type RiskVerdict,
} from '../../lib/ai-agent/index.ts';
import { resolveAI } from '../../lib/ai-config/src/index.ts';
import { buildXyloLitePrompt } from '../../lib/ai-agent/prompts/index.ts';

interface CLIArgs {
  suite?: 'scenarios' | 'probes' | 'routing';
  modelOverride?: string;
  persist: boolean;
  concurrency: number;
}

function parseArgs(argv: string[]): CLIArgs {
  const out: CLIArgs = { persist: true, concurrency: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--suite' && argv[i + 1]) {
      const v = argv[++i];
      if (v === 'scenarios' || v === 'probes' || v === 'routing') {
        out.suite = v;
      }
    } else if (argv[i] === '--model' && argv[i + 1]) {
      out.modelOverride = argv[++i];
    } else if (argv[i] === '--no-persist') {
      out.persist = false;
    } else if (argv[i] === '--concurrency' && argv[i + 1]) {
      out.concurrency = Math.max(1, Number.parseInt(argv[++i], 10) || 1);
    }
  }
  return out;
}

function gitSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

// ============================================================================
// AGENT INVOKER
// ============================================================================

interface InvokerConfig {
  modelOverride?: string;
}

function buildInvoker(config: InvokerConfig): {
  invoker: AgentInvoker;
  modelId: string;
  promptHash: string;
} {
  const cfg = resolveAI('chat');
  const modelId = config.modelOverride ?? cfg.model;
  const baseUrl = cfg.baseUrl.endsWith('/api')
    ? cfg.baseUrl
    : `${cfg.baseUrl}/api`;
  const headers = cfg.headers;
  const ollamaTools = toOllamaTools(AGENT_TOOLS);
  const litePrompt = buildXyloLitePrompt({
    accountSize: 1750,
    withTools: true,
  });
  const promptHash = hashPrompt(litePrompt);

  const invoker: AgentInvoker = async (question) => {
    const start = Date.now();
    let preflight;
    try {
      preflight = await runPreflight(question);
    } catch {
      preflight = null;
    }
    const systemPrompt = preflight?.formattedContext
      ? `${litePrompt}\n\n=== CURRENT MARKET CONTEXT ===\n${preflight.formattedContext}\n=== END CONTEXT ===`
      : litePrompt;

    const body = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      tools: ollamaTools,
      stream: false,
      options: cfg.options,
      ...(cfg.think !== undefined ? { think: cfg.think } : {}),
    };

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(
        `Ollama fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      message?: {
        content?: string;
        tool_calls?: Array<{ function?: { name?: string } }>;
      };
      eval_count?: number;
      prompt_eval_count?: number;
    };
    const text = json.message?.content ?? '';
    const tools_called = (json.message?.tool_calls ?? [])
      .map((tc) => tc.function?.name)
      .filter((n): n is string => typeof n === 'string');
    const tokens =
      (json.eval_count ?? 0) + (json.prompt_eval_count ?? 0) || undefined;

    // Phase 2 PR A + C: parse the recommendation and validate against
    // strategy.config.yaml so scenarios can assert on the gate verdict
    // and confidence score. Non-actionable answers leave the gate
    // skipped (and confidence null).
    let risk_verdict: RiskVerdict | undefined;
    let confidence: number | null = null;
    try {
      const rec = await parseRecommendation(text, {
        enableModelFallback: false,
      });
      if (rec) {
        const tickerData = (preflight?.signals.ticker_data ?? []) as Array<
          Record<string, unknown>
        >;
        const ctx = tickerData.find(
          (t) =>
            String(t?.ticker ?? '').toUpperCase() === rec.ticker.toUpperCase()
        );
        risk_verdict = validateRecommendation({
          recommendation: rec,
          account: { sizeUSD: 1750 },
          positions: [],
          tickerContext: ctx
            ? {
                rsi: ctx.rsi as number | undefined,
                iv_pct: (ctx.iv as Record<string, number> | undefined)
                  ?.currentIV,
                aboveMA200: ctx.aboveMA200 as boolean | undefined,
                daysUntilEarnings:
                  (ctx.earnings as Record<string, number> | undefined)
                    ?.daysUntil ?? null,
              }
            : undefined,
        });
        const conf = computeConfidence({
          coverage: preflight?.coverage ?? null,
          riskVerdict: risk_verdict.gate_skipped ? null : risk_verdict,
          action: risk_verdict.recommendation?.action ?? null,
        });
        confidence = conf?.score ?? null;
      } else {
        risk_verdict = skipGate('no parseable recommendation in eval response');
      }
    } catch {
      // Swallow gate errors: scenarios that don't assert on
      // verdict/confidence still pass.
    }

    return {
      text,
      tools_called,
      latency_ms: Date.now() - start,
      tokens,
      coverage: preflight?.coverage,
      risk_verdict,
      confidence,
    };
  };

  return { invoker, modelId, promptHash };
}

// ============================================================================
// PERSISTENCE
// ============================================================================

async function persistRun(run: EvalRun): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn(
      '[xylo:eval] SUPABASE_URL or service key missing; skipping persist.'
    );
    return;
  }
  const res = await fetch(`${url}/rest/v1/agent_eval_runs`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      model_id: run.model_id,
      prompt_hash: run.prompt_hash,
      git_sha: run.git_sha,
      scenarios_total: run.scenarios_total,
      scenarios_passed: run.scenarios_passed,
      probes_total: run.probes_total,
      probes_passed: run.probes_passed,
      routing_total: run.routing_total,
      routing_passed: run.routing_passed,
      total_latency_ms: run.total_latency_ms,
      total_cost_estimate: run.total_cost_estimate,
      avg_tokens: run.avg_tokens,
      results: run.results,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(
      `[xylo:eval] persist failed: HTTP ${res.status} ${text.slice(0, 200)}`
    );
  }
}

// ============================================================================
// REPORT
// ============================================================================

function printReport(run: EvalRun): void {
  console.log('');
  console.log('# Xylo eval run');
  console.log('');
  console.log(`- Model: \`${run.model_id}\``);
  console.log(`- Prompt hash: \`${run.prompt_hash}\``);
  if (run.git_sha) console.log(`- Git SHA: \`${run.git_sha.slice(0, 12)}\``);
  console.log(`- Total latency: ${(run.total_latency_ms / 1000).toFixed(1)}s`);
  if (run.avg_tokens != null) console.log(`- Avg tokens: ${run.avg_tokens}`);
  console.log('');
  console.log('## Suite totals');
  console.log('');
  console.log(`- scenarios: ${run.scenarios_passed}/${run.scenarios_total}`);
  console.log(`- probes: ${run.probes_passed}/${run.probes_total}`);
  console.log(`- routing: ${run.routing_passed}/${run.routing_total}`);
  console.log('');
  const failures = run.results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log('## Failures');
    console.log('');
    for (const f of failures) {
      console.log(`- **${f.id}** (${f.kind})`);
      for (const reason of f.failure_reasons) {
        console.log(`  - ${reason}`);
      }
      if (f.response_excerpt) {
        console.log(
          `  - response: \`${f.response_excerpt.replace(/\n/g, ' ')}\``
        );
      }
    }
    console.log('');
  }
  // Slowest 5
  const slow = [...run.results]
    .sort((a, b) => b.latency_ms - a.latency_ms)
    .slice(0, 5);
  if (slow.length > 0) {
    console.log('## Slowest 5');
    console.log('');
    for (const r of slow) {
      console.log(
        `- ${r.id} (${r.kind}): ${(r.latency_ms / 1000).toFixed(1)}s${r.tokens ? ` · ${r.tokens} tokens` : ''}`
      );
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { invoker, modelId, promptHash } = buildInvoker({
    modelOverride: args.modelOverride,
  });

  const kinds: EvalKind[] | undefined = args.suite
    ? args.suite === 'scenarios'
      ? ['scenario']
      : args.suite === 'probes'
        ? ['probe']
        : ['routing']
    : undefined;

  console.log(
    `[xylo:eval] model=${modelId} suite=${args.suite ?? 'all'} concurrency=${args.concurrency}`
  );
  const run = await runEvalSuite({
    invoke: invoker,
    modelId,
    promptHash,
    gitSha: gitSha(),
    concurrency: args.concurrency,
    filter: kinds ? { kinds } : undefined,
  });

  printReport(run);

  if (args.persist) {
    await persistRun(run);
  }

  process.exit(run.blocker_failed ? 1 : 0);
}

void main().catch((err) => {
  console.error('[xylo:eval] fatal:', err);
  process.exit(2);
});
