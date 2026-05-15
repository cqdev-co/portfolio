/**
 * GET /api/decisions
 *
 * Read-only feed of `agent_decisions` rows for the `/decisions` viewer.
 * Gated by the same email whitelist used for `/api/chat`.
 *
 * Query params (all optional):
 *   - source         : 'frontend' | 'ai-analyst' | 'discord-bot'
 *   - model_id       : exact match
 *   - question_class : exact match
 *   - ticker         : exact match (case-insensitive on insert)
 *   - limit          : default 50, max 200
 *   - offset         : default 0
 *
 * Reads via Supabase REST using the service role key. RLS already
 * permits authenticated reads, but we go through the service role
 * for parity with the writer (`logDecision`) and so the page works
 * without separately wiring RLS-auth in the SQL editor.
 */

import { isUserAuthorized } from '@/lib/auth/whitelist';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSupabaseEnv(): { url?: string; key?: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    key:
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export async function GET(req: Request): Promise<Response> {
  const auth = await isUserAuthorized();
  if (!auth.authorized) {
    return jsonResponse({ error: 'Unauthorized', message: auth.error }, 401);
  }

  const { url, key } = getSupabaseEnv();
  if (!url || !key) {
    return jsonResponse(
      {
        error: 'Supabase not configured',
        message:
          'Set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_* equivalents) to enable the decision viewer.',
      },
      500
    );
  }

  const params = new URL(req.url).searchParams;
  const filters: string[] = [];

  for (const field of [
    'source',
    'model_id',
    'question_class',
    'ticker',
  ] as const) {
    const value = params.get(field);
    if (value) {
      filters.push(`${field}=eq.${encodeURIComponent(value)}`);
    }
  }

  const limitParam = Number.parseInt(params.get('limit') ?? '', 10);
  const offsetParam = Number.parseInt(params.get('offset') ?? '', 10);
  const limit = Math.min(
    Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
    MAX_LIMIT
  );
  const offset =
    Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  filters.push(`limit=${limit}`);
  filters.push(`offset=${offset}`);
  filters.push(`order=created_at.desc`);

  const select = [
    'id',
    'created_at',
    'source',
    'user_id',
    'user_question',
    'conversation_id',
    'model_id',
    'prompt_hash',
    'prompt_variant',
    'tool_calls',
    'final_response',
    'total_latency_ms',
    'total_tokens',
    'question_class',
    'ticker',
    'recommendation_type',
    'coverage_report',
    'risk_violations',
    'confidence',
  ].join(',');
  filters.unshift(`select=${select}`);

  const upstream = `${url}/rest/v1/agent_decisions?${filters.join('&')}`;

  try {
    const response = await fetch(upstream, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return jsonResponse(
        {
          error: 'Supabase read failed',
          status: response.status,
          message: text,
        },
        502
      );
    }

    const rows = await response.json();
    return jsonResponse({ rows, limit, offset, count: rows.length }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: 'Decisions fetch error', message }, 500);
  }
}
