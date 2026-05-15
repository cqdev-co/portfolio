/**
 * Xylo Decision Log Writer
 *
 * Persists every Xylo "turn" to Supabase `agent_decisions`. Designed to be
 * fire-and-forget: callers do NOT await this, and a Supabase outage MUST
 * NOT break the user-facing chat path. On any failure we emit a warning
 * via `log.warn` and return.
 *
 * Schema source of truth: `db/schema/08_agent_decisions.sql`.
 * See `docs/ai-agent/PHASE_0_PLAN.md` for the rationale.
 *
 * @example
 * ```typescript
 * import { logDecision, hashPrompt } from '@lib/ai-agent';
 *
 * void logDecision({
 *   source: 'frontend',
 *   user_id: authResult.email,
 *   user_question: 'Should I take a CDS on NVDA?',
 *   model_id: 'gpt-oss:120b-cloud',
 *   prompt_hash: hashPrompt(systemPrompt),
 *   prompt_variant: 'lite',
 *   tool_calls: [{ name: 'get_ticker_data', args: { ticker: 'NVDA' }, latency_ms: 312, ok: true }],
 *   final_response: assistantText,
 *   total_latency_ms: 4821,
 * });
 * ```
 */

import { createHash } from 'node:crypto';
import { log } from '../utils';

// ============================================================================
// TYPES
// ============================================================================

export type DecisionSource = 'frontend' | 'ai-analyst' | 'discord-bot';
export type PromptVariant = 'lite' | 'full' | 'minimal';

/**
 * Recorded tool invocation inside a turn.
 */
export interface DecisionToolCall {
  name: string;
  args?: unknown;
  latency_ms?: number;
  ok: boolean;
  error?: string;
}

/**
 * Inputs accepted by `logDecision`. Everything not marked NOT NULL in the
 * schema is optional; later phases populate the placeholder fields.
 */
export interface LogDecisionInput {
  source: DecisionSource;
  user_id?: string | null;
  user_question: string;
  conversation_id?: string | null;

  model_id: string;
  prompt_hash: string;
  prompt_variant?: PromptVariant | null;

  tool_calls?: DecisionToolCall[];
  final_response: string;
  total_latency_ms?: number | null;
  total_tokens?: number | null;

  question_class?: string | null;
  ticker?: string | null;
  recommendation_type?: string | null;

  /**
   * Phase 1 coverage report (signals checked / skipped / stale / errors).
   * Stored in `agent_decisions.coverage_report` JSONB column.
   * Untyped here to keep this module decoupled from `preflight/`.
   */
  coverage_report?: unknown;

  /**
   * Phase 2 risk-gate output (violations array). Stored in
   * `agent_decisions.risk_violations` JSONB column. Untyped here to
   * keep this module decoupled from `risk/`.
   */
  risk_violations?: unknown;

  /**
   * Phase 2 confidence score (0-10 integer). Stored in
   * `agent_decisions.confidence`. Null when the turn isn't an
   * actionable trade call.
   */
  confidence?: number | null;
}

export interface LogDecisionOptions {
  /** Override env-derived Supabase URL (mirrors handlers/index.ts) */
  supabaseUrl?: string;
  /** Override env-derived Supabase key (mirrors handlers/index.ts) */
  supabaseKey?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Stable, short hash of a system prompt. Used to detect prompt drift
 * across decisions ("did this answer come from the same prompt as
 * yesterday's?"). Truncated to keep storage small.
 */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

/**
 * Resolves Supabase credentials. We *deliberately* do NOT fall back to
 * the anon/public key: the `agent_decisions` RLS policy only allows
 * inserts from the `service_role`, so every write attempted with the
 * anon key fails with `42501` (RLS violation) and adds noise to the
 * logs. If the service-role key is missing we log a single warning
 * (see `warnedMissingServiceKey` below) and skip writes entirely.
 */
function resolveSupabase(options?: LogDecisionOptions): {
  url?: string;
  key?: string;
} {
  const url =
    options?.supabaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const key = options?.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, key };
}

/**
 * Module-level flag so the "missing service-role key" warning fires
 * **once per process** instead of on every chat turn. The behaviour
 * (skip writes) is unchanged; this just keeps the dev console quiet.
 */
let warnedMissingServiceKey = false;

// ============================================================================
// MAIN ENTRYPOINT
// ============================================================================

/**
 * Fire-and-forget writer for `agent_decisions`. Callers SHOULD NOT await
 * this; if they do, this still resolves to `void` and never throws.
 *
 * Any failure (missing env, network error, non-2xx response) is logged
 * via `log.warn` and swallowed.
 */
export async function logDecision(
  input: LogDecisionInput,
  options?: LogDecisionOptions
): Promise<void> {
  try {
    const { url, key } = resolveSupabase(options);

    if (!url || !key) {
      if (!warnedMissingServiceKey) {
        warnedMissingServiceKey = true;
        log.warn(
          '[logDecision] Skipping writes: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. ' +
            'Set both in `.env.local` to enable decision logging. ' +
            '(NEXT_PUBLIC_SUPABASE_ANON_KEY does NOT work — RLS blocks anon inserts.)'
        );
      }
      return;
    }

    const row = {
      source: input.source,
      user_id: input.user_id ?? null,
      user_question: input.user_question,
      conversation_id: input.conversation_id ?? null,
      model_id: input.model_id,
      prompt_hash: input.prompt_hash,
      prompt_variant: input.prompt_variant ?? null,
      tool_calls: input.tool_calls ?? [],
      final_response: input.final_response,
      coverage_report: input.coverage_report ?? null,
      risk_violations: input.risk_violations ?? null,
      confidence: input.confidence ?? null,
      total_latency_ms: input.total_latency_ms ?? null,
      total_tokens: input.total_tokens ?? null,
      question_class: input.question_class ?? null,
      ticker: input.ticker ?? null,
      recommendation_type: input.recommendation_type ?? null,
    };

    const response = await fetch(`${url}/rest/v1/agent_decisions`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      log.warn(
        `[logDecision] Supabase rejected write (${response.status}): ${text}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(`[logDecision] Failed to log decision: ${message}`);
  }
}
