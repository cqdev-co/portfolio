/**
 * Ollama Service
 * v1.6.0: AI-powered narrative generation for stock analysis
 *
 * Supports both local and cloud Ollama modes:
 * - Local: Uses localhost:11434 (M3 Max optimized)
 * - Cloud: Uses ollama.com API with OLLAMA_API_KEY
 */

import { Ollama } from "ollama";

// ============================================================================
// TYPES
// ============================================================================

export type OllamaMode = "local" | "cloud";

export interface OllamaConfig {
  mode: OllamaMode;
  model?: string;
}

export interface OllamaResponse {
  content: string;
  model: string;
  mode: OllamaMode;
  tokensUsed?: number;
}

// ============================================================================
// DEFAULT MODELS
// ============================================================================

const DEFAULT_MODELS: Record<OllamaMode, string> = {
  local: "llama3.2",
  cloud: "deepseek-v3.1:671b",
};

// ============================================================================
// OLLAMA CLIENT
// ============================================================================

/**
 * Create Ollama client based on mode
 */
function createClient(mode: OllamaMode): Ollama {
  if (mode === "cloud") {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OLLAMA_API_KEY environment variable required for cloud mode"
      );
    }

    return new Ollama({
      host: "https://ollama.com",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  // Local mode - default localhost
  return new Ollama({
    host: "http://localhost:11434",
  });
}

/**
 * Check if Ollama is available in the specified mode
 */
export async function checkOllamaAvailability(
  mode: OllamaMode
): Promise<boolean> {
  try {
    const client = createClient(mode);
    await client.list();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a chat completion with Ollama
 */
export async function generateCompletion(
  config: OllamaConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<OllamaResponse> {
  const client = createClient(config.mode);
  const model = config.model ?? DEFAULT_MODELS[config.mode];

  const response = await client.chat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: false,
  });

  return {
    content: response.message.content,
    model,
    mode: config.mode,
    tokensUsed: response.eval_count,
  };
}

/**
 * Generate a streaming chat completion with Ollama
 * Returns an async generator for real-time output
 */
export async function* generateStreamingCompletion(
  config: OllamaConfig,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string, OllamaResponse, unknown> {
  const client = createClient(config.mode);
  const model = config.model ?? DEFAULT_MODELS[config.mode];

  const stream = await client.chat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });

  let fullContent = "";
  let tokensUsed = 0;

  for await (const part of stream) {
    const chunk = part.message.content;
    fullContent += chunk;
    tokensUsed = part.eval_count ?? tokensUsed;
    yield chunk;
  }

  return {
    content: fullContent,
    model,
    mode: config.mode,
    tokensUsed,
  };
}

/**
 * Get available models for a given mode
 */
export async function getAvailableModels(
  mode: OllamaMode
): Promise<string[]> {
  try {
    const client = createClient(mode);
    const response = await client.list();
    return response.models.map((m) => m.name);
  } catch {
    return [];
  }
}

/**
 * Get the default model for a given mode
 */
export function getDefaultModel(mode: OllamaMode): string {
  return DEFAULT_MODELS[mode];
}

/**
 * Validate that a model is available
 */
export async function validateModel(
  mode: OllamaMode,
  model: string
): Promise<boolean> {
  const available = await getAvailableModels(mode);
  return available.includes(model);
}

// ============================================================================
// AI REQUIREMENT VALIDATION
// ============================================================================

export interface AIValidationResult {
  available: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validate AI is properly configured and available
 * Used at startup to ensure AI can run before analysis begins
 */
export async function validateAIRequirement(
  mode: OllamaMode
): Promise<AIValidationResult> {
  // Check API key for cloud mode
  if (mode === "cloud") {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      return {
        available: false,
        error: "OLLAMA_API_KEY environment variable not set",
        suggestion: "Add OLLAMA_API_KEY to your .env file or export it:\n" +
          "  export OLLAMA_API_KEY=your-api-key\n" +
          "  Or use local mode: --ai-mode local",
      };
    }
  }

  // Check connectivity
  try {
    const isAvailable = await checkOllamaAvailability(mode);
    if (!isAvailable) {
      if (mode === "local") {
        return {
          available: false,
          error: "Cannot connect to local Ollama instance",
          suggestion: "Start Ollama locally:\n" +
            "  ollama serve\n" +
            "  Or use cloud mode: --ai-mode cloud",
        };
      } else {
        return {
          available: false,
          error: "Cannot connect to Ollama cloud API",
          suggestion: "Check your OLLAMA_API_KEY is valid\n" +
            "  Or use local mode: --ai-mode local",
        };
      }
    }
    return { available: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      error: `AI service error: ${errorMessage}`,
      suggestion: mode === "cloud" 
        ? "Check your API key and network connection"
        : "Ensure Ollama is running: ollama serve",
    };
  }
}

