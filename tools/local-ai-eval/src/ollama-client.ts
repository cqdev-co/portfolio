import { Ollama } from 'ollama';
import type { ModelEntry, Task } from './types.ts';
import type { CapturedToolCall } from './scorers/index.ts';

export interface OllamaCallResult {
  content: string;
  toolCalls?: CapturedToolCall[];
  firstTokenMs?: number;
  totalMs: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSec?: number;
}

export function createClient(baseUrl: string): Ollama {
  return new Ollama({ host: baseUrl });
}

interface StreamChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Call Ollama chat with streaming so we can capture first-token latency.
 * Tool calls, when present, typically arrive in a single chunk and are forwarded
 * as-is to the scorer.
 */
export async function callOllama(
  client: Ollama,
  model: ModelEntry,
  task: Task,
  timeoutMs: number
): Promise<OllamaCallResult> {
  const start = performance.now();
  let firstTokenMs: number | undefined;
  let content = '';
  const toolCalls: CapturedToolCall[] = [];
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  const messages = [
    { role: 'system' as const, content: task.system },
    { role: 'user' as const, content: task.user },
  ];

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Ollama request timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );

  const run = (async () => {
    const response = await client.chat({
      model: model.id,
      messages,
      stream: true,
      options: model.options,
      ...(model.think !== undefined ? { think: model.think } : {}),
      ...(task.tools && task.tools.length > 0 ? { tools: task.tools } : {}),
    });
    for await (const raw of response as unknown as AsyncIterable<StreamChunk>) {
      const chunk = raw;
      if (chunk.message?.content) {
        if (firstTokenMs === undefined) {
          firstTokenMs = performance.now() - start;
        }
        content += chunk.message.content;
      }
      if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
        if (firstTokenMs === undefined) {
          firstTokenMs = performance.now() - start;
        }
        for (const tc of chunk.message.tool_calls) {
          toolCalls.push({
            name: tc.function.name,
            arguments: tc.function.arguments ?? {},
          });
        }
      }
      if (chunk.done) {
        promptTokens = chunk.prompt_eval_count;
        completionTokens = chunk.eval_count;
      }
    }
  })();

  await Promise.race([run, timeout]);

  const totalMs = performance.now() - start;
  const tokensPerSec =
    completionTokens && totalMs > 0
      ? (completionTokens / totalMs) * 1000
      : undefined;

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    firstTokenMs,
    totalMs,
    promptTokens,
    completionTokens,
    tokensPerSec,
  };
}

export async function isModelAvailable(
  client: Ollama,
  modelId: string
): Promise<boolean> {
  try {
    const list = await client.list();
    return list.models.some(
      (m) =>
        m.name === modelId ||
        m.model === modelId ||
        m.name.startsWith(`${modelId}:`)
    );
  } catch {
    return false;
  }
}
