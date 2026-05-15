import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Provider registry
// ============================================================================
//
// Each model returned by the Ollama tags API is matched to a "provider"
// (the org that publishes the weights). We use this metadata to:
//
//   1. Render the official-style monochrome mark next to each model.
//   2. Show a human-readable provider label (e.g. "Meta", "Alibaba").
//   3. Group models by provider in the dropdown.
//
// All marks render in `currentColor` so they inherit the surrounding
// text color and stay uniform across the chat surface.
//
// Icon provenance (sourced verbatim from each org's press kit via
// simple-icons.org / lobehub's curated AI-icon pack):
//   ✓ Official       — OpenAI · Meta · Google · DeepSeek · NVIDIA ·
//                      Mistral AI · Qwen · MiniMax · Anthropic ·
//                      Kimi (Moonshot) · Zhipu (GLM)
//   ✕ Custom mark    — DeepCogito · Microsoft · Generic fallback
//
// "Custom mark" means we authored a clean monochrome shape that
// evokes the brand without copying it; replace these with the
// official press-kit SVG the moment the org publishes one.
// ============================================================================

export type ProviderId =
  | 'openai'
  | 'meta'
  | 'google'
  | 'alibaba'
  | 'deepseek'
  | 'mistral'
  | 'moonshot'
  | 'zhipu'
  | 'minimax'
  | 'nvidia'
  | 'cogito'
  | 'microsoft'
  | 'anthropic'
  | 'unknown';

export type Provider = {
  id: ProviderId;
  /** Short, branded label shown in the UI. */
  label: string;
  /** Long-form description used in tooltips / docs. */
  description?: string;
  /**
   * Marks that we ship verbatim from each org's official press kit
   * (or simple-icons, which mirrors them). Useful for documentation
   * and surface-level transparency about brand fidelity.
   */
  iconProvenance: 'official' | 'custom';
  /**
   * Brand accent hex used by `<ProviderIcon colored />`. Sourced from
   * simple-icons.org wherever the SVG itself is — when no official
   * brand colour exists we leave this undefined and the icon falls
   * back to `currentColor`, inheriting the surrounding text colour.
   */
  accent?: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'Open-weight GPT-OSS models from OpenAI.',
    iconProvenance: 'official',
    // OpenAI's brand mark is intentionally monochrome (black / white).
    // We leave the accent unset so the icon adapts to the active theme.
  },
  meta: {
    id: 'meta',
    label: 'Meta',
    description: 'Llama family (Meta AI).',
    iconProvenance: 'official',
    accent: '#0467DF',
  },
  google: {
    id: 'google',
    label: 'Google',
    description: 'Gemma open-weight models from Google DeepMind.',
    iconProvenance: 'official',
    accent: '#4285F4',
  },
  alibaba: {
    id: 'alibaba',
    label: 'Alibaba',
    description: 'Qwen models from Alibaba Cloud.',
    iconProvenance: 'official',
    accent: '#615CED',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek AI research models.',
    iconProvenance: 'official',
    accent: '#4D6BFE',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Mistral, Mixtral & Ministral family.',
    iconProvenance: 'official',
    accent: '#FA520F',
  },
  moonshot: {
    id: 'moonshot',
    // Moonshot AI's only public model family is Kimi, so the brand
    // most users recognise (and the mark we ship below) is Kimi's,
    // not the corporate "Moonshot" wordmark.
    label: 'Kimi',
    description: 'Kimi models from Moonshot AI.',
    iconProvenance: 'official',
    accent: '#1F58FF',
  },
  zhipu: {
    id: 'zhipu',
    label: 'Zhipu AI',
    description: 'GLM family from Zhipu AI / THUDM.',
    iconProvenance: 'official',
    accent: '#6E37FF',
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    description: 'MiniMax-M family.',
    iconProvenance: 'official',
    accent: '#F23F5D',
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA',
    description: 'Nemotron family from NVIDIA.',
    iconProvenance: 'official',
    accent: '#76B900',
  },
  cogito: {
    id: 'cogito',
    label: 'DeepCogito',
    description: 'Cogito reasoning models.',
    iconProvenance: 'custom',
    accent: '#3B82F6',
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    description: 'Phi family from Microsoft Research.',
    iconProvenance: 'custom',
    // Microsoft's mark is multicoloured; we stay monochrome so the
    // single-path SVG doesn't misrepresent the brand identity.
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models.',
    iconProvenance: 'official',
    accent: '#D97757',
  },
  unknown: {
    id: 'unknown',
    label: 'Open Source',
    description: 'Community / open-source model.',
    iconProvenance: 'custom',
  },
};

// ============================================================================
// Pattern matching: model id → provider
// ============================================================================

type Pattern = { test: RegExp; provider: ProviderId };

// Order matters — first match wins. More specific patterns first.
const PATTERNS: Pattern[] = [
  { test: /^gpt-?(oss|4|3|5|o)/i, provider: 'openai' },
  { test: /^(open(ai)?)/i, provider: 'openai' },
  { test: /^llama/i, provider: 'meta' },
  { test: /^codellama/i, provider: 'meta' },
  { test: /^gemma/i, provider: 'google' },
  { test: /^gemini/i, provider: 'google' },
  { test: /^qwen/i, provider: 'alibaba' },
  { test: /^deepseek/i, provider: 'deepseek' },
  { test: /^mixtral/i, provider: 'mistral' },
  { test: /^ministral/i, provider: 'mistral' },
  { test: /^mistral/i, provider: 'mistral' },
  { test: /^kimi/i, provider: 'moonshot' },
  { test: /^moonshot/i, provider: 'moonshot' },
  { test: /^glm/i, provider: 'zhipu' },
  { test: /^chatglm/i, provider: 'zhipu' },
  { test: /^minimax/i, provider: 'minimax' },
  { test: /^nemotron/i, provider: 'nvidia' },
  { test: /^cogito/i, provider: 'cogito' },
  { test: /^phi/i, provider: 'microsoft' },
  { test: /^claude/i, provider: 'anthropic' },
];

/**
 * Returns the provider id for a given model identifier. Falls back to
 * `'unknown'` if no pattern matches — the UI then renders a neutral
 * "Open Source" mark.
 */
export function getProviderId(modelName: string): ProviderId {
  if (!modelName) return 'unknown';
  for (const { test, provider } of PATTERNS) {
    if (test.test(modelName)) return provider;
  }
  return 'unknown';
}

// ============================================================================
// Icons
// ============================================================================
//
// Icons either come verbatim from simple-icons.org (which mirrors each
// org's press kit) or are minimal monochrome shapes we drew where no
// official mark is available. They're 24×24 viewbox SVGs that render
// in `currentColor`, so the consumer styles them by sizing the parent
// and setting a text color.

type IconProps = SVGProps<SVGSVGElement>;

// `block` prevents inline-baseline whitespace under the svg.
// `size-full` makes each icon stretch to its parent — every consumer
// wraps the icon in a sized box (size-3, size-4, size-7, …).
const baseProps = (props: IconProps): IconProps => ({
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
  ...props,
  className: cn('block size-full', props.className),
});

// ──────────────────────────────────────────────────────────────────────────
// Official marks (from simple-icons.org / each org's press kit)
// ──────────────────────────────────────────────────────────────────────────

function OpenAIIcon(props: IconProps) {
  // OpenAI 2022 brand mark.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.354-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v3l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function MetaIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
  );
}

function GoogleIcon(props: IconProps) {
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

function MistralIcon(props: IconProps) {
  // simple-icons "mistralai" — Mistral AI's stair-step mark.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M17.143 3.429v3.428h-3.429v3.429h-3.428V6.857H6.857V3.43H3.43v13.714H0v3.428h10.286v-3.428H6.857v-3.429h3.429v3.429h3.429v-3.429h3.428v3.429h-3.428v3.428H24v-3.428h-3.43V3.429z" />
    </svg>
  );
}

function NvidiaIcon(props: IconProps) {
  // simple-icons "nvidia" — official wordmark eye.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z" />
    </svg>
  );
}

function AnthropicIcon(props: IconProps) {
  // simple-icons "anthropic" — Claude wordmark "A".
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function QwenIcon(props: IconProps) {
  // simple-icons "qwen" — official Qwen geometric mark.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z" />
    </svg>
  );
}

function DeepSeekIcon(props: IconProps) {
  // simple-icons "deepseek" — official whale mark.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45" />
    </svg>
  );
}

function MiniMaxIcon(props: IconProps) {
  // simple-icons "minimax" — official wave wordmark.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M11.43 3.92a.86.86 0 1 0-1.718 0v14.236a1.999 1.999 0 0 1-3.997 0V9.022a.86.86 0 1 0-1.718 0v3.87a1.999 1.999 0 0 1-3.997 0V11.49a.57.57 0 0 1 1.139 0v1.404a.86.86 0 0 0 1.719 0V9.022a1.999 1.999 0 0 1 3.997 0v9.134a.86.86 0 0 0 1.719 0V3.92a1.998 1.998 0 1 1 3.996 0v11.788a.57.57 0 1 1-1.139 0zm10.572 3.105a2 2 0 0 0-1.999 1.997v7.63a.86.86 0 0 1-1.718 0V3.923a1.999 1.999 0 0 0-3.997 0v16.16a.86.86 0 0 1-1.719 0V18.08a.57.57 0 1 0-1.138 0v2a1.998 1.998 0 0 0 3.996 0V3.92a.86.86 0 0 1 1.719 0v12.73a1.999 1.999 0 0 0 3.996 0V9.023a.86.86 0 1 1 1.72 0v6.686a.57.57 0 0 0 1.138 0V9.022a2 2 0 0 0-1.998-1.997" />
    </svg>
  );
}

function KimiIcon(props: IconProps) {
  // Official Kimi mark (lobehub `kimi` — mirrors Kimi's brand assets).
  // Two paths: the dot above and the angular "K" shape.
  return (
    <svg {...baseProps(props)} fill="currentColor" fillRule="evenodd">
      <path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" />
      <path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" />
    </svg>
  );
}

function ZhipuIcon(props: IconProps) {
  // Official Zhipu / GLM mark (lobehub `zhipu`).
  return (
    <svg {...baseProps(props)} fill="currentColor" fillRule="evenodd">
      <path d="M11.991 23.503a.24.24 0 00-.244.248.24.24 0 00.244.249.24.24 0 00.245-.249.24.24 0 00-.22-.247l-.025-.001zM9.671 5.365a1.697 1.697 0 011.099 2.132l-.071.172-.016.04-.018.054c-.07.16-.104.32-.104.498-.035.71.47 1.279 1.186 1.314h.366c1.309.053 2.338 1.173 2.286 2.523-.052 1.332-1.152 2.38-2.478 2.327h-.174c-.715.018-1.274.64-1.239 1.368 0 .124.018.23.053.337.209.373.54.658.96.8.75.23 1.517-.125 1.9-.782l.018-.035c.402-.64 1.17-.96 1.92-.711.854.284 1.378 1.226 1.099 2.167a1.661 1.661 0 01-2.077 1.102 1.711 1.711 0 01-.907-.711l-.017-.035c-.2-.323-.463-.58-.851-.711l-.056-.018a1.646 1.646 0 00-1.954.746 1.66 1.66 0 01-1.065.764 1.677 1.677 0 01-1.989-1.279c-.209-.906.332-1.83 1.257-2.043a1.51 1.51 0 01.296-.035h.018c.68-.071 1.151-.622 1.116-1.333a1.307 1.307 0 00-.227-.693 2.515 2.515 0 01-.366-1.403 2.39 2.39 0 01.366-1.208c.14-.195.21-.444.227-.693.018-.71-.506-1.261-1.186-1.332l-.07-.018a1.43 1.43 0 01-.299-.07l-.05-.019a1.7 1.7 0 01-1.047-2.114 1.68 1.68 0 012.094-1.101zm-5.575 10.11c.26-.264.639-.367.994-.27.355.096.633.379.728.74.095.362-.007.748-.267 1.013-.402.41-1.053.41-1.455 0a1.062 1.062 0 010-1.482zm14.845-.294c.359-.09.738.024.992.297.254.274.344.665.237 1.025-.107.36-.396.634-.756.718-.551.128-1.1-.22-1.23-.781a1.05 1.05 0 01.757-1.26zm-.064-4.39c.314.32.49.753.49 1.206 0 .452-.176.886-.49 1.206-.315.32-.74.5-1.185.5-.444 0-.87-.18-1.184-.5a1.727 1.727 0 010-2.412 1.654 1.654 0 012.369 0zm-11.243.163c.364.484.447 1.128.218 1.691a1.665 1.665 0 01-2.188.923c-.855-.36-1.26-1.358-.907-2.228a1.68 1.68 0 011.33-1.038c.593-.08 1.183.169 1.547.652zm11.545-4.221c.368 0 .708.2.892.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.892.524c-.568 0-1.03-.47-1.03-1.048 0-.579.462-1.048 1.03-1.048zm-14.358 0c.368 0 .707.2.891.524.184.324.184.724 0 1.048a1.026 1.026 0 01-.891.524c-.569 0-1.03-.47-1.03-1.048 0-.579.461-1.048 1.03-1.048zm10.031-1.475c.925 0 1.675.764 1.675 1.706s-.75 1.705-1.675 1.705-1.674-.763-1.674-1.705c0-.942.75-1.706 1.674-1.706zm-2.626-.684c.362-.082.653-.356.761-.718a1.062 1.062 0 00-.238-1.028 1.017 1.017 0 00-.996-.294c-.547.14-.881.7-.752 1.257.13.558.675.907 1.225.783zm0 16.876c.359-.087.644-.36.75-.72a1.062 1.062 0 00-.237-1.019 1.018 1.018 0 00-.985-.301 1.037 1.037 0 00-.762.717c-.108.361-.017.754.239 1.028.245.263.606.377.953.305l.043-.01zM17.19 3.5a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64a.631.631 0 00-.628.64c0 .355.28.64.628.64zm-10.38 0a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64a.631.631 0 00-.628.64c0 .355.279.64.628.64zm-5.182 7.852a.631.631 0 00-.628.64c0 .354.28.639.628.639a.63.63 0 00.627-.606l.001-.034a.62.62 0 00-.628-.64zm5.182 9.13a.631.631 0 00-.628.64c0 .355.279.64.628.64a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm10.38.018a.631.631 0 00-.628.64c0 .355.28.64.628.64a.631.631 0 00.628-.64c0-.355-.279-.64-.628-.64zm5.182-9.148a.631.631 0 00-.628.64c0 .354.279.639.628.639a.631.631 0 00.628-.64c0-.355-.28-.64-.628-.64zm-.384-4.992a.24.24 0 00.244-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249c0 .142.122.249.244.249zM11.991.497a.24.24 0 00.245-.248A.24.24 0 0011.99 0a.24.24 0 00-.244.249c0 .133.108.236.223.247l.021.001zM2.011 6.36a.24.24 0 00.245-.249.24.24 0 00-.244-.249.24.24 0 00-.244.249.24.24 0 00.244.249zm0 11.263a.24.24 0 00-.243.248.24.24 0 00.244.249.24.24 0 00.244-.249.252.252 0 00-.244-.248zm19.995-.018a.24.24 0 00-.245.248.24.24 0 00.245.25.24.24 0 00.244-.25.252.252 0 00-.244-.248z" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Custom marks (no official press-kit SVG available)
// ──────────────────────────────────────────────────────────────────────────

function CogitoIcon(props: IconProps) {
  // Diamond — DeepCogito.
  return (
    <svg
      {...baseProps(props)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M12 3 22 12 12 21 2 12 12 3Z" />
      <path d="M7 12h10M12 7v10" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

function MicrosoftIcon(props: IconProps) {
  // Four-square mark — Microsoft.
  return (
    <svg {...baseProps(props)} fill="currentColor">
      <path d="M3 3h8.5v8.5H3V3Zm9.5 0H21v8.5h-8.5V3ZM3 12.5h8.5V21H3v-8.5Zm9.5 0H21V21h-8.5v-8.5Z" />
    </svg>
  );
}

function GenericIcon(props: IconProps) {
  // Neutral cube — fallback for unknown providers.
  return (
    <svg
      {...baseProps(props)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="M12 3.2 4.5 7.5v9L12 20.8 19.5 16.5v-9L12 3.2Z" />
      <path
        d="M4.5 7.5 12 11.8m0 0 7.5-4.3M12 11.8V20.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS: Record<ProviderId, (props: IconProps) => React.JSX.Element> = {
  openai: OpenAIIcon,
  meta: MetaIcon,
  google: GoogleIcon,
  alibaba: QwenIcon,
  deepseek: DeepSeekIcon,
  mistral: MistralIcon,
  moonshot: KimiIcon,
  zhipu: ZhipuIcon,
  minimax: MiniMaxIcon,
  nvidia: NvidiaIcon,
  cogito: CogitoIcon,
  microsoft: MicrosoftIcon,
  anthropic: AnthropicIcon,
  unknown: GenericIcon,
};

// ============================================================================
// Public component
// ============================================================================

type ProviderIconProps = {
  provider: ProviderId;
  className?: string;
  /** Optional accessible label. Falls back to the provider's display name. */
  title?: string;
  /**
   * Render in the provider's brand accent colour (sets `currentColor`
   * on the SVG via inline style). Defaults to `false`, in which case
   * the icon inherits the surrounding text colour for a monochrome
   * look. Toggle this on for the trigger pill and dropdown rows
   * where brand recognition is the point.
   */
  colored?: boolean;
};

/**
 * Renders the official-style mark for a given provider. Sized by its
 * container (use `size-4`, `size-5`, etc. on the wrapper). Inherits
 * the surrounding text colour via `currentColor` unless `colored` is
 * passed, in which case the registered brand accent is applied.
 *
 * The SVG is rendered directly (no extra wrapper element) so `size-full`
 * resolves against whatever ancestor has explicit dimensions — typically
 * the `size-4` / `size-7` flex span the consumer wraps the icon in.
 */
export function ProviderIcon({
  provider,
  className,
  title,
  colored,
}: ProviderIconProps) {
  const Icon = ICONS[provider] ?? GenericIcon;
  const meta = PROVIDERS[provider];
  const label = title ?? meta?.label ?? 'Model provider';
  // Inline `color` re-targets `currentColor` everywhere inside the SVG,
  // including the `fill` / `stroke` declarations on the paths. Falling
  // back to `undefined` (rather than e.g. an empty string) means we
  // emit no inline style at all when the icon should stay monochrome.
  const style = colored && meta?.accent ? { color: meta.accent } : undefined;
  return (
    <Icon
      role="img"
      aria-label={label}
      style={style}
      className={cn('shrink-0', className)}
    />
  );
}

export function getProvider(modelName: string): Provider {
  return PROVIDERS[getProviderId(modelName)];
}
