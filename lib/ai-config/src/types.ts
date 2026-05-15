/**
 * Shared types for the AI config resolver.
 *
 * Workloads are derived from the evaluation harness at tools/local-ai-eval.
 * See docs/local-ai-eval/README.md for why each workload maps to the model it
 * does in local/cloud modes.
 */

export type AIMode = 'local' | 'cloud';

export type Workload =
  | 'chat' // Tool-using streaming chat (e.g. frontend/api/chat)
  | 'briefing' // Structured JSON briefing (e.g. dashboard briefing, CDS UNIFIED)
  | 'narrative' // Short analyst prose
  | 'tool-call' // Single-turn tool selection
  | 'agent-multi-turn' // Multi-turn tool loops (ai-analyst chatWithTools)
  | 'extraction'; // Phase 2: structured-data extraction (risk-gate parser fallback)

export interface ResolvedAIConfig {
  /** local = Ollama on localhost. cloud = ollama.com API. */
  mode: AIMode;
  /** Ollama base URL. localhost for local, ollama.com/api for cloud. */
  baseUrl: string;
  /** Exact Ollama tag to pass as `model` in chat requests. */
  model: string;
  /**
   * Ollama `think` override. Set to `false` for qwen3.6:35b in local mode to
   * avoid ~80s of hidden chain-of-thought latency. Leave `undefined` to let
   * the model decide.
   */
  think?: boolean;
  /**
   * Ollama `options` payload (temperature, num_ctx, top_p, etc.). Spread
   * directly into the chat request.
   */
  options: Record<string, unknown>;
  /**
   * Headers to merge into the fetch/Ollama client. In cloud mode this holds
   * the Bearer token from OLLAMA_API_KEY.
   */
  headers: Record<string, string>;
  /**
   * Which workload this config was resolved for. Useful for logging.
   */
  workload: Workload;
  /**
   * Which ENV was observed at resolve time (for logs).
   */
  envObserved: 'dev' | 'prod' | 'unset';
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}
