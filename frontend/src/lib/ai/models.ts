// Ollama Cloud models available at https://ollama.com/search?c=cloud
export const DEFAULT_CHAT_MODEL = "gpt-oss:120b";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "gpt-oss:120b",
    name: "GPT-OSS 120B",
    description: "Most capable open-source model",
  },
  {
    id: "llama3.3:70b-cloud",
    name: "Llama 3.3 70B",
    description: "Fast and capable Meta model",
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

