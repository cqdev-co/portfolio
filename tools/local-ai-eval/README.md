# @portfolio/local-ai-eval

Standalone harness that measures quality + runtime of candidate Ollama models against
realistic prompts from this monorepo.

Full documentation: [docs/local-ai-eval/README.md](../../docs/local-ai-eval/README.md).

## Quick start

```bash
# From the repo root
bun install
bun run ai:eval
bun run ai:soak --model <model-id> --duration 30m

# Or from this folder
bun run eval
bun run soak --model <model-id> --duration 30m
```

Models referenced in `models.config.json` that are not pulled locally are skipped
with a hint to `ollama pull`.

Reports land in `reports/{timestamp}/` (gitignored).
