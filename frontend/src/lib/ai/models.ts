// Ollama Cloud models available at https://ollama.com/search?c=cloud
// Default model can be configured via NEXT_PUBLIC_OLLAMA_MODEL env var
export const DEFAULT_CHAT_MODEL = 
  process.env.NEXT_PUBLIC_OLLAMA_MODEL || "deepseek-v3.2:cloud";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "llama3.3:70b-cloud",
    name: "Llama 3.3 70B",
    description: "Fast and capable Meta model (default)",
  },
  {
    id: "gpt-oss:120b",
    name: "GPT-OSS 120B",
    description: "Most capable open-source model",
  },
  {
    id: "qwen3:235b-cloud",
    name: "Qwen 3 235B",
    description: "Large reasoning model",
  },
  {
    id: "deepseek-r1:671b-cloud",
    name: "DeepSeek R1 671B",
    description: "Advanced reasoning model",
  },
  {
    id: "llama3.1:405b-cloud",
    name: "Llama 3.1 405B",
    description: "Largest Llama model",
  },
];

