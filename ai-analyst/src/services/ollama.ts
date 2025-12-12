/**
 * Ollama Service
 * AI integration for analyst recommendations
 * Supports tool calling and thinking mode per Ollama docs
 */

import { Ollama } from "ollama";

export type OllamaMode = "local" | "cloud";

export interface OllamaConfig {
  mode: OllamaMode;
  model?: string;
}

export interface OllamaResponse {
  content: string;
  thinking?: string;
  model: string;
  mode: OllamaMode;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
}

// Tool calling types
export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      required?: string[];
      properties: Record<string, { type: string; description: string }>;
    };
  };
}

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinking?: string;
  tool_calls?: ToolCall[];
  tool_name?: string;
}

const DEFAULT_MODELS: Record<OllamaMode, string> = {
  local: "llama3.2",
  cloud: "deepseek-v3.1:671b",
};

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

  return new Ollama({
    host: "http://localhost:11434",
  });
}

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
    promptTokens: response.prompt_eval_count,
    completionTokens: response.eval_count,
  };
}

/**
 * Streaming response interface
 */
export interface StreamingResponse {
  content: string;
  model: string;
  mode: OllamaMode;
  promptTokens: number;
  completionTokens: number;
  duration: number;
}

/**
 * Generate completion with streaming - yields chunks as they arrive
 */
export async function* generateStreamingCompletion(
  config: OllamaConfig,
  systemPrompt: string,
  userPrompt: string
): AsyncGenerator<string, StreamingResponse, unknown> {
  const client = createClient(config.mode);
  const model = config.model ?? DEFAULT_MODELS[config.mode];
  const startTime = Date.now();

  const response = await client.chat({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });

  let fullContent = "";
  let promptTokens = 0;
  let completionTokens = 0;

  for await (const chunk of response) {
    if (chunk.message?.content) {
      fullContent += chunk.message.content;
      yield chunk.message.content;
    }
    
    // Capture token counts from final chunk
    if (chunk.done) {
      promptTokens = chunk.prompt_eval_count ?? 0;
      completionTokens = chunk.eval_count ?? 0;
    }
  }

  const duration = Date.now() - startTime;

  return {
    content: fullContent,
    model,
    mode: config.mode,
    promptTokens,
    completionTokens,
    duration,
  };
}

export interface AIValidationResult {
  available: boolean;
  error?: string;
  suggestion?: string;
}

export async function validateAIRequirement(
  mode: OllamaMode
): Promise<AIValidationResult> {
  if (mode === "cloud") {
    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey) {
      return {
        available: false,
        error: "OLLAMA_API_KEY environment variable not set",
        suggestion: 
          "Add OLLAMA_API_KEY to your .env file or export it:\n" +
          "  export OLLAMA_API_KEY=your-api-key\n" +
          "  Or use local mode: --ai-mode local",
      };
    }
  }

  try {
    const isAvailable = await checkOllamaAvailability(mode);
    if (!isAvailable) {
      if (mode === "local") {
        return {
          available: false,
          error: "Cannot connect to local Ollama instance",
          suggestion: 
            "Start Ollama locally:\n" +
            "  ollama serve\n" +
            "  Or use cloud mode: --ai-mode cloud",
        };
      } else {
        return {
          available: false,
          error: "Cannot connect to Ollama cloud API",
          suggestion: 
            "Check your OLLAMA_API_KEY is valid\n" +
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

export function getDefaultModel(mode: OllamaMode): string {
  return DEFAULT_MODELS[mode];
}

// ============================================================================
// TOOL CALLING & AGENT LOOP
// ============================================================================

/**
 * Agent response with tool calls and thinking
 */
export interface AgentResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  model: string;
  mode: OllamaMode;
  promptTokens: number;
  completionTokens: number;
  duration: number;
}

/**
 * Run a single chat turn with tool support and thinking
 */
export async function chatWithTools(
  config: OllamaConfig,
  messages: AgentMessage[],
  tools?: ToolDefinition[],
  enableThinking: boolean = true
): Promise<AgentResponse> {
  const client = createClient(config.mode);
  const model = config.model ?? DEFAULT_MODELS[config.mode];
  const startTime = Date.now();

  const response = await client.chat({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      thinking: m.thinking,
      tool_calls: m.tool_calls,
      tool_name: m.tool_name,
    })),
    tools,
    think: enableThinking,
    stream: false,
  });

  const duration = Date.now() - startTime;

  return {
    content: response.message.content ?? "",
    thinking: (response.message as { thinking?: string }).thinking,
    toolCalls: (response.message as { tool_calls?: ToolCall[] }).tool_calls,
    model,
    mode: config.mode,
    promptTokens: response.prompt_eval_count ?? 0,
    completionTokens: response.eval_count ?? 0,
    duration,
  };
}

/**
 * Streaming agent response with tool calls and thinking
 */
export interface StreamingAgentChunk {
  type: "thinking" | "content" | "tool_call";
  text?: string;
  toolCall?: ToolCall;
}

export interface StreamingAgentResult {
  content: string;
  thinking: string;
  toolCalls: ToolCall[];
  model: string;
  mode: OllamaMode;
  promptTokens: number;
  completionTokens: number;
  duration: number;
}

/**
 * Stream a chat turn with tool support and thinking
 * Yields chunks as they arrive, returns final result
 */
export async function* streamChatWithTools(
  config: OllamaConfig,
  messages: AgentMessage[],
  tools?: ToolDefinition[],
  enableThinking: boolean = true
): AsyncGenerator<StreamingAgentChunk, StreamingAgentResult, unknown> {
  const client = createClient(config.mode);
  const model = config.model ?? DEFAULT_MODELS[config.mode];
  const startTime = Date.now();

  const response = await client.chat({
    model,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      thinking: m.thinking,
      tool_calls: m.tool_calls,
      tool_name: m.tool_name,
    })),
    tools,
    think: enableThinking,
    stream: true,
  });

  let fullContent = "";
  let fullThinking = "";
  const toolCalls: ToolCall[] = [];
  let promptTokens = 0;
  let completionTokens = 0;

  for await (const chunk of response) {
    
    // Cast message to include optional thinking field
    const message = chunk.message as {
      content?: string;
      thinking?: string;
      tool_calls?: ToolCall[];
    };
    
    // Also check chunk-level thinking (some models put it there)
    const chunkThinking = (chunk as { thinking?: string }).thinking;
    
    // Handle thinking chunks (comes before content in thinking-enabled models)
    if (message.thinking) {
      fullThinking += message.thinking;
      yield { type: "thinking", text: message.thinking };
    } else if (chunkThinking) {
      // Fallback: check chunk-level thinking
      fullThinking += chunkThinking;
      yield { type: "thinking", text: chunkThinking };
    }
    
    // Handle content chunks
    if (message.content) {
      fullContent += message.content;
      yield { type: "content", text: message.content };
    }
    
    // Handle tool calls
    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        toolCalls.push(call);
        yield { type: "tool_call", toolCall: call };
      }
    }
    
    // Capture token counts from final chunk
    if (chunk.done) {
      promptTokens = chunk.prompt_eval_count ?? 0;
      completionTokens = chunk.eval_count ?? 0;
    }
  }

  const duration = Date.now() - startTime;

  return {
    content: fullContent,
    thinking: fullThinking,
    toolCalls,
    model,
    mode: config.mode,
    promptTokens,
    completionTokens,
    duration,
  };
}

