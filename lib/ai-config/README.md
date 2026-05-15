# @portfolio/ai-config

ENV-driven AI mode + model resolver. Services import `resolveAI(workload)` to get
the right Ollama endpoint and model for local dev vs cloud prod.

Full documentation: [docs/monorepo/README.md#local-ai](../../docs/monorepo/README.md#local-ai)
and [docs/local-ai-eval/README.md](../../docs/local-ai-eval/README.md).

## Why

Before: every service hardcoded `{ mode: 'cloud', model: 'deepseek-v3.2:cloud' }`
or similar, so flipping to local Ollama required code changes in each package.

After: services call `resolveAI('chat' | 'briefing' | 'narrative' | 'tool-call' | 'agent-multi-turn')`
and get a ready-to-use config driven by `ENV=dev|prod`.

## Rule

| `ENV`                | `AI_MODE` | `OLLAMA_API_KEY` | Result                                   |
| -------------------- | --------- | ---------------- | ---------------------------------------- |
| `dev`                | —         | —                | local Ollama on `http://localhost:11434` |
| `prod`               | —         | required         | Ollama cloud on `https://ollama.com`     |
| unset                | —         | required         | cloud (safe default for Vercel)          |
| any                  | `local`   | —                | local (manual override)                  |
| any                  | `cloud`   | required         | cloud (manual override)                  |
| `staging` or similar | —         | —                | throws `AIConfigError`                   |

## Model selection

Per-workload, based on eval findings in
[docs/local-ai-eval/README.md](../../docs/local-ai-eval/README.md):

| Workload           | Local (dev)               | Cloud (prod)          |
| ------------------ | ------------------------- | --------------------- |
| `chat`             | `qwen3.6:35b` (think off) | `llama3.3:70b-cloud`  |
| `briefing`         | `qwen3.6:35b` (think off) | `deepseek-v3.2:cloud` |
| `narrative`        | `qwen3.6:35b` (think off) | `deepseek-v3.2:cloud` |
| `tool-call`        | `qwen3.6:35b` (think off) | `llama3.3:70b-cloud`  |
| `agent-multi-turn` | `gemma4:26b`              | `llama3.3:70b-cloud`  |

To change a per-workload model, edit `src/resolver.ts`. The canonical config with
caveats/notes lives at
[tools/local-ai-eval/models.config.json](../../tools/local-ai-eval/models.config.json).

## Usage

```ts
import { resolveAI } from '@portfolio/ai-config';

const cfg = resolveAI('chat');
// => { mode: 'local', baseUrl: 'http://localhost:11434',
//      model: 'qwen3.6:35b', think: false,
//      options: { temperature: 0.3, num_ctx: 8192 },
//      headers: {}, workload: 'chat', envObserved: 'dev' }

const response = await fetch(`${cfg.baseUrl}/api/chat`, {
  headers: { 'Content-Type': 'application/json', ...cfg.headers },
  body: JSON.stringify({
    model: cfg.model,
    messages,
    think: cfg.think,
    options: cfg.options,
  }),
});
```

Or via the `ollama` npm client:

```ts
import { Ollama } from 'ollama';
import { resolveAI } from '@portfolio/ai-config';

const cfg = resolveAI('agent-multi-turn');
const client = new Ollama({ host: cfg.baseUrl, headers: cfg.headers });
const response = await client.chat({
  model: cfg.model,
  messages,
  tools,
  think: cfg.think,
  options: cfg.options,
  stream: false,
});
```

## Overrides

| Env var                       | Effect                                                    |
| ----------------------------- | --------------------------------------------------------- |
| `AI_MODE=local\|cloud`        | Force a mode regardless of `ENV`.                         |
| `OLLAMA_BASE_URL`             | Override local base URL.                                  |
| `OLLAMA_CLOUD_BASE_URL`       | Override cloud base URL.                                  |
| `OLLAMA_LOCAL_MODEL_OVERRIDE` | Force a single local tag for any workload (testing only). |
| `OLLAMA_CLOUD_MODEL_OVERRIDE` | Force a single cloud tag for any workload (testing only). |
