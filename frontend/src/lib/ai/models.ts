// ============================================================================
// Chat-model metadata (legacy)
// ============================================================================
//
// The user's active model is now persisted in a cookie via
// `lib/ai/chat-model-store.ts`, and the *list* of available models is
// fetched from `/api/chat/models` (see `chat-model-selector.tsx`). We no
// longer need a hard-coded `DEFAULT_CHAT_MODEL` constant or a
// `NEXT_PUBLIC_OLLAMA_MODEL` env override here — the first model
// returned by the API is used as the default when no preference is
// stored, and any user-driven change is persisted for next time.
//
// This file remains for the legacy `ChatModel`/`chatModels` shape used
// by older callers; remove once nothing imports them.

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: 'llama3.3:70b-cloud',
    name: 'Llama 3.3 70B',
    description: 'Fast and capable Meta model',
  },
  {
    id: 'gpt-oss:120b',
    name: 'GPT-OSS 120B',
    description: 'Most capable open-source model',
  },
  {
    id: 'qwen3:235b-cloud',
    name: 'Qwen 3 235B',
    description: 'Large reasoning model',
  },
  {
    id: 'deepseek-r1:671b-cloud',
    name: 'DeepSeek R1 671B',
    description: 'Advanced reasoning model',
  },
  {
    id: 'llama3.1:405b-cloud',
    name: 'Llama 3.1 405B',
    description: 'Largest Llama model',
  },
];
