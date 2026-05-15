import { NextResponse } from 'next/server';
import {
  formatBytes,
  formatReleased,
  parseModelMeta,
} from '@/lib/ai/model-meta';
import { PROVIDERS } from '@/lib/ai/providers';
import {
  getUnavailableModels,
  isModelUnavailable,
} from '@/lib/ai/model-access';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com/api';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

// ============================================================================
// CACHE STRATEGY
// ============================================================================
//
// Two tiers of cache freshness:
//
//   - `< CACHE_FRESH_MS` → return cached payload, no work.
//   - `< CACHE_STALE_MS` → return cached payload immediately, kick off a
//     background revalidation so the next caller sees fresh data
//     (stale-while-revalidate).
//   - `>= CACHE_STALE_MS` → cold; the request blocks on the probe.

/** Up to this age, the cache is considered "fresh" and served without revalidation. */
const CACHE_FRESH_MS = 5 * 60 * 1000;
/** Beyond `CACHE_FRESH_MS` but under this age, served stale + revalidated in background. */
const CACHE_STALE_MS = 60 * 60 * 1000;
/** Per-model probe timeout — keeps the parallel fan-out bounded. */
const PROBE_TIMEOUT_MS = 5_000;
/**
 * Concurrency cap for `/api/show`. Deliberately conservative —
 * Ollama Cloud's free tier rate-limits hard on bursty traffic and
 * we want plenty of headroom for the user's own chat requests.
 */
const SHOW_PROBE_CONCURRENCY = 3;

type CachedPayload = {
  models: EnrichedModel[];
  unavailable: string[];
};
let payloadCache: { at: number; payload: CachedPayload } | null = null;
let revalidating: Promise<void> | null = null;

export type OllamaTagsModel = {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[] | null;
    parameter_size?: string;
    quantization_level?: string;
  };
};

interface ShowDetails {
  capabilities: string[];
  parameterSize?: string;
  family?: string;
}

/**
 * Shape returned to the client. This is intentionally rich — the chat
 * model selector renders the icon, provider label, parameter size,
 * deployment tags, and a "released X ago" hint per row.
 *
 * Backwards-compatible fields (`id`, `name`, `size`) are preserved so any
 * downstream consumer that hasn't been updated yet keeps working.
 */
export type EnrichedModel = {
  /** Ollama model id (used in the chat API body). */
  id: string;
  /** Backwards-compatible display name (== `displayName`). */
  name: string;
  /** Backwards-compatible size label (== `sizeLabel`). */
  size: string;
  /** Pretty model display name, e.g. "Llama 3.3". */
  displayName: string;
  /** Provider id ("meta", "openai", "alibaba", …). */
  provider: string;
  /** Provider display label, e.g. "Meta". */
  providerLabel: string;
  /** Parameter count, e.g. "70B" — undefined if unknown. */
  parameterSize?: string;
  /** Capability/deployment tags ("Cloud", "Reasoning", "Coder", …). */
  tags: string[];
  /** Raw size in bytes from Ollama. */
  sizeBytes: number;
  /** Pretty size label such as "65GB" or "Cloud". */
  sizeLabel: string;
  /** Raw `modified_at` timestamp from Ollama. */
  modifiedAt: string | null;
  /** Pretty "released X ago" label. */
  releasedLabel: string | null;
};

export async function GET() {
  try {
    const now = Date.now();

    if (payloadCache && now - payloadCache.at < CACHE_FRESH_MS) {
      return jsonResponse(payloadCache.payload);
    }

    if (payloadCache && now - payloadCache.at < CACHE_STALE_MS) {
      kickOffRevalidation();
      return jsonResponse(payloadCache.payload);
    }

    const payload = await buildPayload();
    payloadCache = { at: Date.now(), payload };
    return jsonResponse(payload);
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch models',
        models: getDefaultModels(),
        unavailable: getUnavailableModels(),
      },
      { status: 200 }
    );
  }
}

function jsonResponse(payload: CachedPayload) {
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=3600',
    },
  });
}

function kickOffRevalidation() {
  if (revalidating) return;
  revalidating = (async () => {
    try {
      const fresh = await buildPayload();
      payloadCache = { at: Date.now(), payload: fresh };
    } catch (err) {
      console.warn('[models] background revalidation failed:', err);
    } finally {
      revalidating = null;
    }
  })();
}

/**
 * One-shot pipeline: fetch the catalog, run a `/api/show` details
 * probe (cheap, doesn't burn chat quota), and assemble the enriched
 * payload. We deliberately do NOT run a chat-based access probe at
 * startup — that fires a real `/api/chat` per cataloged model and
 * burns the user's session quota / trips burst-rate limits even
 * when overall usage is well under the cap. Access is instead
 * detected **lazily**: when a real chat 401s, the route adds the
 * model id to the in-process denylist and the client persists it
 * to `localStorage` so the model never reappears in the selector.
 */
async function buildPayload(): Promise<CachedPayload> {
  const response = await fetch(`${OLLAMA_BASE_URL}/tags`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(OLLAMA_API_KEY && { Authorization: `Bearer ${OLLAMA_API_KEY}` }),
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = await response.json();
  const raw: OllamaTagsModel[] = data.models || [];

  const filtered = raw.filter((m) => !isModelUnavailable(m.name));

  // Phase: enrich the survivors via `/api/show` for proper
  // capability tags + accurate parameter sizes. `/api/show` is a
  // metadata endpoint (no inference), so it doesn't contribute to
  // chat-completion quota; we still throttle it to 3-way concurrency
  // to avoid bursting against Ollama Cloud's edge.
  const detailsMap = await probeModelDetails(filtered.map((m) => m.name));

  const models = filtered.map((m) => enrichModel(m, detailsMap.get(m.name)));
  const unavailable = getUnavailableModels();

  return { models, unavailable };
}

/**
 * Mapping from Ollama capability names (returned by `/api/show`) to
 * the prettier labels we render in the selector. Anything we don't
 * have a label for is title-cased and surfaced as-is so future
 * capabilities (e.g. `audio`) automatically appear.
 */
const CAPABILITY_LABELS: Record<string, string> = {
  completion: 'Chat',
  tools: 'Tools',
  vision: 'Vision',
  thinking: 'Reasoning',
  audio: 'Audio',
  embedding: 'Embeddings',
  insert: 'Fill-in-Middle',
};

function humanizeCapability(cap: string): string {
  return (
    CAPABILITY_LABELS[cap.toLowerCase()] ??
    cap.charAt(0).toUpperCase() + cap.slice(1).toLowerCase()
  );
}

/**
 * Turns a raw Ollama tags entry + optional `/api/show` details into
 * the rich shape consumed by the UI. Capability tags come from the
 * `capabilities[]` array returned by `/api/show` when available; we
 * fall back to `parseModelMeta`'s id-based tag inference when
 * details are missing (e.g. probe disabled or timed out).
 *
 * Note on the "Cloud" tag: Ollama Cloud's `/api/tags` endpoint does
 * NOT return capability/deployment tags — those only live on the
 * catalog website. But every model returned by `https://ollama.com/api/tags`
 * is by definition cloud-hosted (we can't reach a local model
 * through that endpoint), so we always surface the Cloud badge.
 */
function enrichModel(m: OllamaTagsModel, details?: ShowDetails): EnrichedModel {
  const meta = parseModelMeta(m.name);
  const sizeLabel = formatBytes(m.size);
  const provider = PROVIDERS[meta.provider];

  const capabilityTags = details?.capabilities?.length
    ? details.capabilities
        .filter((c) => c.toLowerCase() !== 'completion')
        .map(humanizeCapability)
    : meta.tags;

  const tags = capabilityTags.includes('Cloud')
    ? capabilityTags
    : ['Cloud', ...capabilityTags];

  return {
    id: m.name,
    name: meta.displayName,
    size: sizeLabel,
    displayName: meta.displayName,
    provider: meta.provider,
    providerLabel: provider?.label ?? 'Open Source',
    parameterSize: details?.parameterSize ?? meta.parameterSize,
    tags,
    sizeBytes: m.size ?? 0,
    sizeLabel,
    modifiedAt: m.modified_at ?? null,
    releasedLabel: formatReleased(m.modified_at),
  };
}

function getDefaultModels(): EnrichedModel[] {
  return [
    'gpt-oss:120b',
    'gpt-oss:20b',
    'deepseek-v3.2:cloud',
    'qwen3-coder:480b',
    'gemma3:27b',
    'llama3.3:70b-cloud',
  ].map((id) =>
    enrichModel({
      name: id,
      model: id,
      size: 0,
      modified_at: '',
    })
  );
}

// ============================================================================
// DETAILS PROBE — capability tags + accurate parameter size
// ============================================================================
//
// `/api/show` returns the rich metadata we can't get from `/api/tags`:
//
//   {
//     details:    { family, parameter_size, quantization_level, … },
//     model_info: { … model card … },
//     capabilities: ["completion", "tools", "vision", "thinking", "embedding", "insert"]
//   }
//
// Cheap (no inference), but Ollama Cloud's free tier still
// rate-limits bursty edge traffic — we throttle to 3 concurrent
// requests so the user's own chat completion never has to queue
// behind a wave of probe fan-out.

async function probeModelDetails(
  ids: string[]
): Promise<Map<string, ShowDetails>> {
  const details = new Map<string, ShowDetails>();
  if (!OLLAMA_API_KEY || ids.length === 0) return details;

  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const idx = cursor++;
      const id = ids[idx];
      const showed = await probeShowOne(id);
      if (showed) details.set(id, showed);
    }
  }
  const workers = Array.from(
    { length: Math.min(SHOW_PROBE_CONCURRENCY, ids.length) },
    () => worker()
  );
  await Promise.all(workers);
  return details;
}

interface ShowResponse {
  details?: {
    family?: string;
    parameter_size?: string;
  };
  model_info?: Record<string, unknown>;
  capabilities?: string[];
}

async function probeShowOne(modelId: string): Promise<ShowDetails | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({ model: modelId }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const json = (await res.json()) as ShowResponse;

    let parameterSize = json.details?.parameter_size?.trim() || undefined;
    if (!parameterSize && json.model_info) {
      const raw = json.model_info['general.parameter_count'];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        parameterSize = formatParamCount(raw);
      }
    }

    return {
      capabilities: Array.isArray(json.capabilities) ? json.capabilities : [],
      parameterSize,
      family: json.details?.family,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatParamCount(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${n}`;
}
