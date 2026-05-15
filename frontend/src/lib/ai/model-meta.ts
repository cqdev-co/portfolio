import { getProviderId, type ProviderId } from './providers';

// ============================================================================
// Model metadata parser
// ============================================================================
//
// Ollama Cloud's `/api/tags` only returns a small set of fields per model
// (name, size in bytes, modified_at, digest). The richer per-model
// `details.{family,parameter_size,...}` block comes back empty for cloud
// models, so we derive the same information by parsing the model
// identifier ourselves.
//
// The model id follows the loose convention `family[-variant][:tag]`,
// where `tag` typically encodes either the parameter size (`70b`, `1t`)
// or a deployment hint (`cloud`, `instruct`). Examples:
//
//   llama3.3:70b-cloud   → Llama 3.3 · 70B · Cloud
//   gpt-oss:120b         → GPT-OSS · 120B
//   deepseek-v3.2:cloud  → DeepSeek V3.2 · Cloud
//   qwen3-coder:480b     → Qwen3 Coder · 480B
//   gemma4:31b           → Gemma4 · 31B
//   kimi-k2-thinking     → Kimi K2 Thinking
//   glm-5.1              → GLM 5.1
// ============================================================================

export type ModelMeta = {
  /** Original Ollama model id (used when invoking the model). */
  id: string;
  /** Pretty display name, e.g. "Llama 3.3" or "Qwen3 Coder". */
  displayName: string;
  /** Provider id (resolved via the providers registry). */
  provider: ProviderId;
  /** Parameter count, normalised: "70B", "120B", "1T", or undefined. */
  parameterSize?: string;
  /** Extra capability/deployment tags such as "Cloud", "Reasoning", "Coder". */
  tags: string[];
  /** Ollama family slug (everything before the first ':'). */
  family: string;
};

// Brand-correct capitalisations. Anything not listed falls back to
// title-cased segments separated by spaces.
const BRAND_CAPS: Record<string, string> = {
  'gpt-oss': 'GPT-OSS',
  llama: 'Llama',
  codellama: 'CodeLlama',
  gemma: 'Gemma',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  ministral: 'Ministral',
  mixtral: 'Mixtral',
  kimi: 'Kimi',
  glm: 'GLM',
  chatglm: 'ChatGLM',
  minimax: 'MiniMax',
  nemotron: 'Nemotron',
  cogito: 'Cogito',
  phi: 'Phi',
  claude: 'Claude',
};

const KNOWN_VARIANT_LABELS: Record<string, string> = {
  coder: 'Coder',
  thinking: 'Thinking',
  instruct: 'Instruct',
  vision: 'Vision',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  super: 'Super',
  next: 'Next',
};

// Brands that conventionally write the version attached to the family
// name (e.g. "Qwen3" rather than "Qwen 3"). Default is "spaced".
const NUMBER_STYLE: Record<string, 'attached' | 'spaced'> = {
  qwen: 'attached',
};

const TAG_LABELS: Record<string, string> = {
  cloud: 'Cloud',
  thinking: 'Reasoning',
  instruct: 'Instruct',
  coder: 'Coder',
  preview: 'Preview',
  experimental: 'Experimental',
};

/**
 * Pretty-prints a family/variant slug. Recognises known brand names and
 * variant words; everything else falls back to title case.
 */
function prettifySlug(slug: string): string {
  if (!slug) return '';

  const lower = slug.toLowerCase();
  if (BRAND_CAPS[lower]) return BRAND_CAPS[lower];

  return slug
    .split('-')
    .map((segment) => {
      const lowerSeg = segment.toLowerCase();

      if (BRAND_CAPS[lowerSeg]) return BRAND_CAPS[lowerSeg];
      if (KNOWN_VARIANT_LABELS[lowerSeg]) return KNOWN_VARIANT_LABELS[lowerSeg];

      // Trailing `3.3`, `4`, `v2.5` etc → keep the numeric portion as-is,
      // but title-case the leading letters. Single-letter prefixes
      // (e.g. "v3.1", "k2") are kept attached so "kimi-k2" reads as
      // "Kimi K2" not "Kimi K 2". Brand-specific overrides win.
      const numberMatch = segment.match(/^([a-zA-Z]+)([\d.]+)$/);
      if (numberMatch) {
        const [, letters, num] = numberMatch;
        const lettersLower = letters.toLowerCase();
        const labelled =
          BRAND_CAPS[lettersLower] ??
          letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();

        const style: 'attached' | 'spaced' =
          NUMBER_STYLE[lettersLower] ??
          (letters.length === 1 ? 'attached' : 'spaced');

        return style === 'attached'
          ? `${labelled}${num}`
          : `${labelled} ${num}`;
      }

      // Standalone numbers / version tags pass through verbatim.
      if (/^[\d.]+$/.test(segment)) return segment;

      // Pure letters: capitalise.
      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a parameter count (e.g. "70b", "1t") from a string, returning
 * the normalised label like "70B" or "1T". Accepts decimals ("3.5b").
 */
function extractParameterSize(input: string): string | undefined {
  const match = input.match(/(\d+(?:\.\d+)?)\s*([bBtTmM])\b/);
  if (!match) return undefined;
  const [, num, unit] = match;
  return `${num}${unit.toUpperCase()}`;
}

/**
 * Parses an Ollama model id into rich metadata used by the chat selector.
 *
 * @example
 *   parseModelMeta('llama3.3:70b-cloud')
 *   // → { displayName: 'Llama 3.3', parameterSize: '70B', tags: ['Cloud'], ... }
 */
export function parseModelMeta(id: string): ModelMeta {
  const [familyRaw, tagRaw = ''] = id.split(':');
  const family = familyRaw.toLowerCase();

  // Parameter size lives in either part: `:70b-cloud` or `qwen3-30b`.
  const parameterSize =
    extractParameterSize(tagRaw) ?? extractParameterSize(familyRaw);

  // Build human-readable tags from the colon suffix, stripping out any
  // segment that we already used as the parameter size.
  const tags: string[] = [];
  if (tagRaw) {
    for (const segment of tagRaw.toLowerCase().split('-')) {
      if (!segment) continue;
      if (extractParameterSize(segment)) continue;
      const label = TAG_LABELS[segment];
      if (label && !tags.includes(label)) tags.push(label);
    }
  }

  // Capability hints from the family slug ("kimi-k2-thinking", "qwen3-coder").
  for (const segment of family.split('-')) {
    const label = TAG_LABELS[segment];
    if (label && !tags.includes(label)) tags.push(label);
  }

  // For the display name we pretty-print the family but DROP the trailing
  // `-thinking` / `-coder` / `-instruct` segment if we've already lifted it
  // into `tags`, so we don't render it twice ("Qwen3 Coder · Coder").
  const displayName = prettifySlug(
    family
      .split('-')
      .filter((seg) => !TAG_LABELS[seg] || !tags.includes(TAG_LABELS[seg]))
      .join('-')
  );

  return {
    id,
    displayName: displayName || familyRaw,
    provider: getProviderId(id),
    parameterSize,
    tags,
    family,
  };
}

// ============================================================================
// Formatters used by both server (API route) and client (selector)
// ============================================================================

/**
 * Formats a number of bytes as a friendly human-readable label. Returns
 * "Cloud" when the size is zero (Ollama Cloud sometimes reports 0 for
 * hosted-only models).
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Cloud';
  const gb = bytes / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)}TB`;
  if (gb >= 10) return `${gb.toFixed(0)}GB`;
  return `${gb.toFixed(1)}GB`;
}

/**
 * Formats an ISO timestamp as a compact "released" label. Returns
 * "today", "Xd ago", "Xw ago", or "Mmm YYYY" for older dates. We use
 * this in the dropdown to surface freshness without taking up much room.
 */
export function formatReleased(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const day = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor(diffMs / day);

  if (diffDays < 1) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}
