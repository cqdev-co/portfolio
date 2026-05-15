import {
  AIConfigError,
  type AIMode,
  type ResolvedAIConfig,
  type Workload,
} from './types';

/**
 * ENV-driven mode selection.
 *
 * Rule:
 *   - `ENV=dev`   -> local  (laptop with Ollama on localhost:11434)
 *   - `ENV=prod`  -> cloud  (Ollama cloud via OLLAMA_API_KEY)
 *   - unset       -> cloud  (safe default; matches Vercel deploys that forget
 *                            to set ENV)
 *   - anything else -> error
 *
 * Override:
 *   - `AI_MODE=local|cloud` overrides ENV entirely. Useful for CI or
 *     debugging when you want to force a mode without touching ENV.
 */
export function resolveMode(env: NodeJS.ProcessEnv = process.env): {
  mode: AIMode;
  envObserved: 'dev' | 'prod' | 'unset';
} {
  const override = env.AI_MODE?.toLowerCase();
  if (override === 'local' || override === 'cloud') {
    // Still report what ENV said so logs show the difference.
    const envStr = env.ENV?.toLowerCase();
    const envObserved: 'dev' | 'prod' | 'unset' =
      envStr === 'dev' ? 'dev' : envStr === 'prod' ? 'prod' : 'unset';
    return { mode: override, envObserved };
  }

  const envStr = env.ENV?.toLowerCase();
  if (envStr === 'dev') return { mode: 'local', envObserved: 'dev' };
  if (envStr === 'prod') return { mode: 'cloud', envObserved: 'prod' };
  if (envStr === undefined || envStr === '') {
    return { mode: 'cloud', envObserved: 'unset' };
  }

  throw new AIConfigError(
    `Invalid ENV value: "${envStr}". Expected "dev", "prod", or unset (defaults to cloud).`
  );
}

/**
 * Local-mode model selection, per workload.
 *
 * Backed by findings documented in docs/local-ai-eval/README.md.
 * See also tools/local-ai-eval/models.config.json for the canonical config.
 */
const LOCAL_MODELS: Record<
  Workload,
  { model: string; think?: boolean; options: Record<string, unknown> }
> = {
  chat: {
    model: 'qwen3.6:35b',
    think: false,
    options: { temperature: 0.3, num_ctx: 8192 },
  },
  briefing: {
    model: 'qwen3.6:35b',
    think: false,
    options: { temperature: 0.3, num_ctx: 8192 },
  },
  narrative: {
    model: 'qwen3.6:35b',
    think: false,
    options: { temperature: 0.3, num_ctx: 8192 },
  },
  'tool-call': {
    model: 'qwen3.6:35b',
    think: false,
    options: { temperature: 0.3, num_ctx: 8192 },
  },
  'agent-multi-turn': {
    // Gemma 4 is strictly better on multi-turn tool loops: 6/6 PASS vs
    // Qwen3.6's 2/6 (with permissive prompts). See the agent eval report.
    model: 'gemma4:26b',
    options: { temperature: 1.0, top_p: 0.95, top_k: 64, num_ctx: 8192 },
  },
  // Single-pass structured extraction (e.g. risk-gate parser fallback,
  // catalysts/red-flags extraction in Phase 3). Low temperature, small
  // context, no tools — we just want JSON or a regex-friendly line.
  extraction: {
    model: 'qwen3.6:35b',
    think: false,
    options: { temperature: 0, num_ctx: 4096 },
  },
};

/**
 * Cloud-mode model selection, per workload.
 *
 * Tags are from ollama.com's cloud library. Kept close to what the existing
 * services already use (see frontend/src/lib/ai/models.ts and
 * cds-engine-strategy/src/services/ollama.ts) so this change does not move
 * the production cloud behavior; it only adds per-workload selection.
 */
const CLOUD_MODELS: Record<
  Workload,
  { model: string; think?: boolean; options: Record<string, unknown> }
> = {
  chat: {
    model: 'llama3.3:70b-cloud',
    options: { temperature: 0.3 },
  },
  briefing: {
    model: 'deepseek-v3.2:cloud',
    options: { temperature: 0.3, num_predict: 1024 },
  },
  narrative: {
    model: 'deepseek-v3.2:cloud',
    options: { temperature: 0.3 },
  },
  'tool-call': {
    model: 'llama3.3:70b-cloud',
    options: { temperature: 0.3 },
  },
  'agent-multi-turn': {
    model: 'llama3.3:70b-cloud',
    options: { temperature: 0.3 },
  },
  extraction: {
    // Cheap, fast, deterministic extraction. gpt-oss:20b-cloud is the
    // smallest non-thinking cloud model in our typical roster.
    model: 'gpt-oss:20b-cloud',
    options: { temperature: 0 },
  },
};

const LOCAL_BASE_URL = 'http://localhost:11434';
const CLOUD_BASE_URL = 'https://ollama.com';

/**
 * Resolve the AI config for a given workload based on current environment.
 *
 * @throws AIConfigError if ENV is set to an invalid value, or if cloud mode is
 *   selected but OLLAMA_API_KEY is missing.
 */
export function resolveAI(
  workload: Workload,
  env: NodeJS.ProcessEnv = process.env
): ResolvedAIConfig {
  const { mode, envObserved } = resolveMode(env);

  if (mode === 'local') {
    const m = LOCAL_MODELS[workload];
    return {
      mode,
      baseUrl: env.OLLAMA_BASE_URL ?? LOCAL_BASE_URL,
      model: env.OLLAMA_LOCAL_MODEL_OVERRIDE ?? m.model,
      think: m.think,
      options: m.options,
      headers: {},
      workload,
      envObserved,
    };
  }

  // Cloud mode
  const apiKey = env.OLLAMA_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      'Cloud mode requires OLLAMA_API_KEY. Set it in your environment, or set ENV=dev to use the local Ollama instance instead.'
    );
  }

  const m = CLOUD_MODELS[workload];
  return {
    mode,
    baseUrl: env.OLLAMA_CLOUD_BASE_URL ?? CLOUD_BASE_URL,
    model: env.OLLAMA_CLOUD_MODEL_OVERRIDE ?? m.model,
    think: m.think,
    options: m.options,
    headers: { Authorization: `Bearer ${apiKey}` },
    workload,
    envObserved,
  };
}

/**
 * Same as resolveAI but never throws: returns null on error.
 * Handy for code paths that want to log and fall back.
 */
export function tryResolveAI(
  workload: Workload,
  env: NodeJS.ProcessEnv = process.env
): ResolvedAIConfig | { error: string } {
  try {
    return resolveAI(workload, env);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
