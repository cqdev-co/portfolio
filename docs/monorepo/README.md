# Monorepo Architecture

This document describes the portfolio monorepo structure and conventions.

## Monorepo status and signal registry

Use this as the **single cross-repo index** for (1) what CI and Turborepo actually run per component, and (2) where **trading-style signals** land in Postgres—including whether each source [dual-writes into the unified `signals` table](../db/README.md#unified-signals-table).

### Legend

| Column                | Meaning                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Turbo**             | Scripts defined in that package’s `package.json` that participate in `turbo run` (`tc` = typecheck, `lint`, `test`, `build`). Packages with no matching scripts are skipped for that task.              |
| **Python CI**         | Root workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): `ruff` = format + lint step paths; `pytest` = `test-python` job.                                                            |
| **Signal tables**     | Tables where scanner or engine output is persisted (not an exhaustive schema list).                                                                                                                     |
| **Unified `signals`** | Whether the engine is designed to [dual-write](../db/README.md#dual-write-flow) into the cross-strategy `signals` feed (`db/schema/03_signals.sql`). Unusual Options stays on its own tables by design. |

### Registry (one table)

| Component           | Path                               | `@portfolio/*`        | Turbo                                 | Python CI                                                 | Signal tables                                                            | Unified `signals`                |
| ------------------- | ---------------------------------- | --------------------- | ------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------- |
| Frontend            | `frontend/`                        | `web`                 | tc · lint · test · build              | —                                                         | Reads `signals`, positions, spreads, UO tables (UI)                      | Consumes (read)                  |
| AI Analyst CLI      | `ai-analyst/`                      | `ai-analyst`          | tc · lint · test                      | —                                                         | —                                                                        | —                                |
| CDS engine          | `cds-engine-strategy/`             | `cds-engine-strategy` | tc · lint · test                      | —                                                         | `cds_signals`, `cds_signal_outcomes`, `stock_opportunities`              | Yes (`cds`)                      |
| PCS engine          | `pcs-engine-strategy/`             | `pcs-engine-strategy` | tc                                    | —                                                         | `pcs_signals` (see [db docs](../db/README.md); not deployed in prod yet) | Yes (when writing `pcs_signals`) |
| Cloudflare proxy    | `cloudflare/`                      | `cloudflare-proxy`    | tc · lint · test · build              | —                                                         | —                                                                        | —                                |
| AI agent lib        | `lib/ai-agent/`                    | `ai-agent`            | tc · lint                             | —                                                         | —                                                                        | —                                |
| Core lib            | `lib/core/`                        | `core`                | tc · test                             | —                                                         | —                                                                        | —                                |
| Types lib           | `lib/types/`                       | `types`               | tc · lint                             | —                                                         | —                                                                        | —                                |
| Utils lib           | `lib/utils/`                       | `utils`               | tc · lint                             | —                                                         | —                                                                        | —                                |
| Providers lib       | `lib/providers/`                   | `providers`           | _(no turbo scripts; dependency-only)_ | —                                                         | —                                                                        | —                                |
| Unusual Options     | `unusual-options-service/`         | —                     | —                                     | ruff · pytest                                             | `unusual_options_signals`, continuity tables                             | No (by design)                   |
| Penny scanner       | `penny-stock-scanner/`             | —                     | —                                     | ruff · pytest                                             | `penny_stock_signals`, `penny_signal_performance`                        | Yes (`penny`)                    |
| Wallpaper service   | `wp-service/`                      | —                     | —                                     | ruff                                                      | —                                                                        | —                                |
| Strategy config     | `strategy.config.yaml` (repo root) | —                     | —                                     | —                                                         | —                                                                        | —                                |
| Music Health (tool) | `music-health/`                    | —                     | —                                     | —                                                         | —                                                                        | —                                |
| MIDI lib (tool)     | `midi-lib/`                        | —                     | —                                     | —                                                         | —                                                                        | —                                |
| Py shared lib       | `lib/py-core/`                     | —                     | —                                     | _(not in root `ruff` paths; consumed by Poetry services)_ | —                                                                        | —                                |

Repo-wide checks not tied to one row: **`validate-config`** (Zod schema for `strategy.config.yaml`), **`format:check`** (inside the `lint` job), and **`bun audit`** (manual / policy; not a dedicated CI job in the snippet above).

### CI jobs (blocking) — quick map

| GitHub Actions job | What it validates                                                      |
| ------------------ | ---------------------------------------------------------------------- |
| `typecheck`        | All packages with a `typecheck` script                                 |
| `lint`             | ESLint + Prettier on TS/JS workspaces                                  |
| `lint-python`      | Ruff on `unusual-options-service`, `penny-stock-scanner`, `wp-service` |
| `validate-config`  | `lib/ai-agent/config/schema.test.ts`                                   |
| `test`             | All packages with a `test` script                                      |
| `test-python`      | pytest in unusual-options + penny-scanner                              |
| `build`            | Needs typecheck + lint + lint-python + validate-config                 |

## Build System

The monorepo uses **Turborepo** for build orchestration:

- **Parallel builds**: Tasks run concurrently with dependency awareness
- **Caching**: Local cache for faster rebuilds (remote caching available)
- **Incremental**: Only rebuild what changed

### Core Commands

```bash
# Build all packages (with caching)
bun run build

# Type-check all packages
bun run typecheck

# Run all tests
bun run test

# Lint all packages
bun run lint

# Format all files
bun run format

# Check formatting
bun run format:check

# Security audit (all workspaces via shared lockfile)
bun audit

# Auto-fix vulnerabilities
bun run audit:fix
```

## CI/CD

GitHub Actions runs on every push and PR to `main`:

| Job               | Description                                      | Blocking |
| ----------------- | ------------------------------------------------ | -------- |
| `typecheck`       | Type-check all TypeScript packages               | Yes      |
| `lint`            | Lint all packages with ESLint + check formatting | Yes      |
| `lint-python`     | Lint Python services with ruff                   | Yes      |
| `validate-config` | Validate strategy.config.yaml with Zod schema    | Yes      |
| `test`            | Run all TypeScript test suites                   | Yes      |
| `test-python`     | Run Python test suites with pytest               | Yes      |
| `build`           | Build all packages (after lint + validation)     | Yes      |

Configuration: `.github/workflows/ci.yml`

### CI Job Dependencies

```
typecheck ──────┐
                │
lint ───────────┤
                ├──> build
lint-python ────┤
                │
validate-config ┘

test ──────────> (independent)
test-python ───> (independent)
```

### Turborepo Remote Caching

For faster CI builds, remote caching can be enabled:

```bash
# Link to Vercel (one-time setup)
bunx turbo link
```

Set these secrets in GitHub:

- `TURBO_TOKEN`: Your Turborepo token
- `TURBO_TEAM`: Your team name (set as variable, not secret)

## Code Quality

### Pre-commit Hooks

The monorepo uses two complementary hook systems:

**1. Husky + lint-staged** (TypeScript/JS - auto-installed):

```bash
# Setup hooks (runs automatically on install via "prepare" script)
bun run prepare
```

Hooks run on staged files:

- **TypeScript/JavaScript**: ESLint fix + Prettier format
- **JSON/Markdown/YAML**: Prettier format

**2. pre-commit** (Python - optional):

```bash
# Install pre-commit hooks (for Python linting)
pip install pre-commit
pre-commit install
```

Configuration: `.pre-commit-config.yaml`

**Note**: Husky handles TypeScript/JS automatically. The `pre-commit` tool
is optional and only needed if you want local Python linting before commits
(CI will catch Python issues regardless).

### ESLint

Shared ESLint configuration at root (`eslint.config.mjs`):

- TypeScript-ESLint for type-aware linting
- Consistent rules across all packages
- Each package has a `lint` script

### Prettier

Shared Prettier configuration at root (`.prettierrc`):

- Consistent code formatting
- 80 character line width
- Single quotes, trailing commas

```bash
# Format all files
bun run format

# Check formatting (CI)
bun run format:check
```

### Ruff (Python)

All Python services use **ruff** for linting and formatting:

```bash
# Lint Python code
bun run lint:py

# Auto-fix Python lint issues
bun run lint:py:fix

# Format Python code
bun run format:py

# Check Python formatting
bun run format:py:check
```

## Package Naming Convention

All TypeScript packages use the `@portfolio/` scope:

| Package                          | Location               | Purpose                                    |
| -------------------------------- | ---------------------- | ------------------------------------------ |
| `@portfolio/web`                 | `frontend/`            | Next.js portfolio website + fund dashboard |
| `@portfolio/ai-analyst`          | `ai-analyst/`          | AI ticker analysis CLI                     |
| `@portfolio/cds-engine-strategy` | `cds-engine-strategy/` | Call Debit Spread trading engine           |
| `@portfolio/pcs-engine-strategy` | `pcs-engine-strategy/` | Put Credit Spread trading engine           |
| `@portfolio/cloudflare-proxy`    | `cloudflare/`          | Yahoo Finance API proxy                    |
| `@portfolio/ai-agent`            | `lib/ai-agent/`        | Shared AI agent logic                      |
| `@portfolio/core`                | `lib/core/`            | Shared trading infrastructure              |
| `@portfolio/providers`           | `lib/providers/`       | Shared data providers (signals, tickers)   |
| `@portfolio/types`               | `lib/types/`           | Shared type definitions                    |
| `@portfolio/utils`               | `lib/utils/`           | Shared utility functions                   |

## Workspaces

The monorepo uses Bun workspaces defined in the root `package.json`:

```json
{
  "workspaces": [
    "frontend",
    "lib/*",
    "cds-engine-strategy",
    "pcs-engine-strategy",
    "ai-analyst",
    "cloudflare",
    "tools/local-ai-eval"
  ]
}
```

### Benefits

- **Shared dependencies**: Common packages installed once at root
- **Cross-package imports**: Import from `@portfolio/ai-agent` directly
- **Unified scripts**: Run commands across all packages from root
- **Turborepo integration**: Parallel builds with caching
- **Single lockfile**: Only `bun.lock` at root (workspace packages don't have lockfiles)

## Directory Structure

```
portfolio/
├── .github/workflows/         # CI/CD configuration
├── .husky/                    # Git hooks (pre-commit)
├── frontend/                  # @portfolio/web
├── ai-analyst/                # @portfolio/ai-analyst
├── cds-engine-strategy/       # @portfolio/cds-engine-strategy
├── cloudflare/                # @portfolio/cloudflare-proxy
├── unusual-options-service/   # Python (Poetry)
├── penny-stock-scanner/       # Python (Poetry)
├── wp-service/                # Python (Poetry)
├── lib/                       # Shared TypeScript libraries
│   ├── ai-agent/             # @portfolio/ai-agent
│   ├── core/                 # @portfolio/core
│   ├── types/                # @portfolio/types
│   └── utils/                # @portfolio/utils
├── db/                        # Database schemas & migrations
├── docs/                      # Documentation
├── scripts/                   # Standalone scripts
├── data/                      # Data exports
├── strategy.config.yaml       # Centralized strategy rules (SSOT)
├── turbo.json                 # Turborepo configuration
├── tsconfig.json              # Root TypeScript config
├── eslint.config.mjs          # Shared ESLint config
├── .prettierrc                # Shared Prettier config
└── .pre-commit-config.yaml    # Pre-commit hooks config
```

## Root Scripts

Run from the repository root:

### TypeScript

| Script                   | Description                                |
| ------------------------ | ------------------------------------------ |
| `bun run dev`            | Start frontend dev server (webpack mode)\* |
| `bun run build`          | Build all packages (Turbo)                 |
| `bun run build:frontend` | Build frontend only                        |
| `bun run test`           | Run all tests (Turbo)                      |
| `bun run typecheck`      | Type-check all packages (Turbo)            |
| `bun run lint`           | Lint all packages (Turbo)                  |
| `bun run format`         | Format all files (Prettier)                |
| `bun run format:check`   | Check formatting (CI)                      |
| `bun run dev:analyst`    | Run AI analyst CLI                         |
| `bun run dev:scanner`    | Run stock scanner                          |
| `bun run dev:cloudflare` | Start Cloudflare worker locally            |
| `bun run clean`          | Remove all node_modules                    |
| `bun run clean:turbo`    | Clear Turbo cache                          |
| `bun run audit`          | Security audit (all workspaces)            |
| `bun run audit:fix`      | Auto-fix security vulnerabilities          |

\*Frontend uses `--webpack` flag for dev mode due to Turbopack limitations
with monorepo imports. Use `cd frontend && bun run dev:turbo` for Turbopack
(faster HMR but may have import issues with `@lib/*` paths).

### Python

| Script                       | Description                     |
| ---------------------------- | ------------------------------- |
| `bun run lint:py`            | Lint Python with ruff           |
| `bun run lint:py:fix`        | Auto-fix Python lint issues     |
| `bun run format:py`          | Format Python with ruff         |
| `bun run format:py:check`    | Check Python formatting         |
| `bun run py:install`         | Install all Python dependencies |
| `bun run py:unusual-options` | Run unusual options CLI         |
| `bun run py:penny-scanner`   | Run penny scanner CLI           |
| `bun run py:wp-service`      | Run wallpaper service           |

## Turborepo Configuration

The `turbo.json` defines task pipelines:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": ["tsconfig.tsbuildinfo"],
      "cache": true
    },
    "lint": {
      "dependsOn": [],
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": false
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    }
  }
}
```

- **`^build`**: Build dependencies first (topological order)
- **outputs**: Cached build artifacts (`!` prefix excludes)
- **cache**: Enable/disable caching per task
- **persistent**: For long-running dev servers (prevents caching)

## Shared Libraries

### @portfolio/ai-agent

Shared AI agent logic used by both CLI and frontend:

```typescript
import {
  buildXyloSystemPrompt,
  AGENT_TOOLS,
  classifyQuestion,
} from '@portfolio/ai-agent';
```

**Canonical modules:**

- `config/` — Strategy config loader and types (single source of truth)
- `market/` — Market regime detection (VIX, SPY, sectors) with caching
- `tools/` — Agent tool definitions and handler execution
- `session/` — Unified API for CLI and Frontend
- `toon/` — TOON token encoding (40% fewer tokens)

### @portfolio/core

Shared trading infrastructure for strategy engines:

```typescript
import { detectMarketRegime } from '@portfolio/core/regime';
import { calculateRisk } from '@portfolio/core/risk';
```

### @portfolio/types

Shared TypeScript type definitions:

```typescript
import type { Ticker, Position } from '@portfolio/types';
```

### @portfolio/utils

Shared utility functions. Re-exports strategy config from `@portfolio/ai-agent`
for convenience:

```typescript
import { calculateEntryGrade } from '@portfolio/utils/entry-grade';
import { calculatePFV } from '@portfolio/utils/pfv';
import { validateEntry } from '@portfolio/utils/strategy-config';
```

## Strategy Config Architecture

All trading strategy rules live in `strategy.config.yaml` at the repo root.
This is the **single source of truth** for entry criteria, exit rules, position
sizing, spread parameters, risk management, and market regime adjustments.

**Canonical loader:** `@portfolio/ai-agent/config`

```typescript
import { getStrategyConfig, isRSIValid } from '@portfolio/ai-agent/config';
```

The `@portfolio/utils/strategy-config` module re-exports everything from the
canonical source and adds a comprehensive `validateEntry()` helper.

## Market Regime Architecture

Two regime systems serve different purposes, unified by a bridge layer:

| System                       | Types                                        | Purpose                                |
| ---------------------------- | -------------------------------------------- | -------------------------------------- |
| `@portfolio/core/regime`     | `bull`, `neutral`, `bear`, `caution`         | Strategy adjustments (config-driven)   |
| `@portfolio/ai-agent/market` | `RISK_ON`, `RISK_OFF`, `NEUTRAL`, `HIGH_VOL` | Real-time AI context (VIX/SPY/sectors) |

- **Strategy regime** drives position sizing and score thresholds from `strategy.config.yaml`
- **Market regime** provides live market context for AI chat and analyst tools
- **Bridge layer** (`mapToStrategyRegime`, `mapToAIRegime`) in `@portfolio/core/regime`
  converts between the two systems for consistent behavior

```typescript
import { mapToStrategyRegime } from '@portfolio/core/regime';

// RISK_ON → bull, RISK_OFF → bear, HIGH_VOL → caution, NEUTRAL → neutral
const strategyRegime = mapToStrategyRegime(aiRegime);
```

## Python Services

All Python services use **Poetry** for dependency management and **ruff**
for linting/formatting:

| Service                   | Description                                                 | CI Tests |
| ------------------------- | ----------------------------------------------------------- | -------- |
| `unusual-options-service` | Unusual options activity detection                          | Yes      |
| `penny-stock-scanner`     | Penny stock breakout scanner                                | Yes      |
| `wp-service`              | Wallpaper/gradient generation                               | No\*     |
| `ai-discord-bot`          | Local-only Discord bot, multi-agent Q&A over financial data | No       |

\*`wp-service` is linted in CI but tests are not run (no test suite yet).

### Installation

```bash
# Install all Python dependencies
bun run py:install

# Or individually:
cd unusual-options-service && poetry install
cd penny-stock-scanner && poetry install
cd wp-service && poetry install
```

### Running

```bash
# Via root scripts
bun run py:unusual-options scan
bun run py:penny-scanner scan

# Or directly
cd unusual-options-service && poetry run unusual-options scan
```

## Local AI

The repo has AI operations wired through the [`ollama`](https://ollama.com) npm client in
[ai-analyst/src/services/ollama.ts](../../ai-analyst/src/services/ollama.ts),
[cds-engine-strategy/src/services/ollama.ts](../../cds-engine-strategy/src/services/ollama.ts),
[frontend/src/app/api/chat/route.ts](../../frontend/src/app/api/chat/route.ts), and
[frontend/src/app/api/dashboard/briefing/route.ts](../../frontend/src/app/api/dashboard/briefing/route.ts).
Each supports both a **local** (`http://localhost:11434`) and a **cloud** (`https://ollama.com`)
mode via `OLLAMA_API_KEY`.

### ENV-driven mode selection

A shared resolver at [lib/ai-config/](../../lib/ai-config/) picks the mode and model
from an `ENV` environment variable, so services do not hardcode `'local'` or
`'cloud'` defaults:

- `ENV=dev` → local Ollama on `localhost:11434`
- `ENV=prod` → Ollama cloud (requires `OLLAMA_API_KEY`)
- unset → cloud (safe default for Vercel deploys)
- `AI_MODE=local|cloud` overrides ENV for one-off debugging.

The resolver returns a per-workload model, backed by eval findings in
[docs/local-ai-eval/README.md](../local-ai-eval/README.md). Example:

| Workload           | `ENV=dev` (local)         | `ENV=prod` (cloud)    |
| ------------------ | ------------------------- | --------------------- |
| `chat`             | `qwen3.6:35b` (think off) | `llama3.3:70b-cloud`  |
| `briefing`         | `qwen3.6:35b` (think off) | `deepseek-v3.2:cloud` |
| `narrative`        | `qwen3.6:35b` (think off) | `deepseek-v3.2:cloud` |
| `tool-call`        | `qwen3.6:35b` (think off) | `llama3.3:70b-cloud`  |
| `agent-multi-turn` | `gemma4:26b`              | `llama3.3:70b-cloud`  |

Services opt in by importing `resolveAI(workload)` from `@portfolio/ai-config`, or
by passing `--ai-mode env` to CLIs that expose it (currently `ai-analyst chat`;
more commands to follow). Services that still construct
`{ mode: 'cloud', model: 'deepseek-v3.2:cloud' }` by hand continue to work
unchanged — the resolver is additive.

Finance-adjacent packages (`ai-analyst`, `cds-engine-strategy`, `pcs-engine-strategy`) are
expected to run with `ENV=dev` locally so private financial data never transits cloud
inference. The portfolio frontend may continue to use cloud in production for public
features.

### Local AI Eval Harness

Before swapping defaults to any specific local model, run a **quality + runtime eval**
on candidate Ollama models. The harness is a standalone workspace at
[tools/local-ai-eval/](../../tools/local-ai-eval/). See
[docs/local-ai-eval/README.md](../local-ai-eval/README.md) for usage.

```bash
# Full matrix across all candidates and tasks
bun run ai:eval

# Sustained-load test for thermal / drift behavior
bun run ai:soak --model <model-id> --duration 30m --interval 30s
```

### Local Discord bot (multi-agent)

The Python workspace [ai-discord-bot/](../../ai-discord-bot/) runs locally on your
Mac and exposes your private financial data through two Discord slash commands
(`/brief`, `/ask`). Multi-agent (orchestrator + 4 specialists over A2A), all
backed by local `qwen3.6:35b`. Full writeup in
[docs/ai-discord-bot/README.md](../ai-discord-bot/README.md).

```bash
bun run py:bot:install
bun run py:bot
```

Note: the Python bot does NOT use the TS `@portfolio/ai-config` resolver. It
reads its own env (`DISCORD_BOT_TOKEN`, `OLLAMA_MODEL`, etc.) and has its own
strict-tool-use prompts codified in
[ai-discord-bot/src/ai_discord_bot/agents/system_prompts.py](../../ai-discord-bot/src/ai_discord_bot/agents/system_prompts.py).

## Adding New Packages

### TypeScript Package

1. Create directory (e.g., `new-service/` or `lib/new-lib/`)
2. Add `package.json` with `@portfolio/` scoped name
3. Add required scripts: `typecheck`, `lint`, `test`
4. Ensure it matches workspace glob patterns
5. Run `bun install` to link

```json
{
  "name": "@portfolio/new-service",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "...",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "test": "bun test"
  }
}
```

### Python Service

1. Create directory at root
2. Initialize Poetry: `poetry init`
3. Add `pyproject.toml` with CLI script and ruff config
4. Add documentation to `docs/`
5. Update root `package.json` scripts

Standard ruff configuration for new services:

```toml
[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "W", "B", "UP"]
ignore = ["E501"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

## Cross-Package Dependencies

TypeScript packages **must** declare explicit workspace dependencies in their
`package.json`. This enables Turborepo to infer the correct dependency graph
for caching and task ordering.

```json
// ai-analyst/package.json
{
  "dependencies": {
    "@portfolio/ai-agent": "workspace:*"
  }
}
```

Then import:

```typescript
import { buildXyloSystemPrompt } from '@portfolio/ai-agent';
```

### Current Dependency Graph

```
@portfolio/web ──────────> @portfolio/ai-agent
@portfolio/ai-analyst ───> @portfolio/ai-agent
@portfolio/ai-agent ─────> (standalone, no @portfolio/* deps)
@portfolio/core ─────────> (standalone, no @portfolio/* deps)
@portfolio/types ────────> (standalone, no deps)
@portfolio/utils ────────> @portfolio/ai-agent (re-exports config)
@portfolio/cds-engine ───> @portfolio/providers
@portfolio/pcs-engine ───> @portfolio/providers
@portfolio/providers ────> (standalone, no @portfolio/* deps)
@portfolio/cloudflare ───> (standalone, no @portfolio/* deps)
```

### Import Patterns

The frontend uses `@lib/*` path aliases (configured in `tsconfig.json` and
`next.config.js`) alongside the workspace dependency:

```typescript
// frontend imports use @lib/* path alias
import { AGENT_TOOLS } from '@lib/ai-agent';

// ai-analyst uses relative paths (with ../../../lib/)
import { sessionCache } from '../../../lib/ai-agent/cache/index.ts';
```

**Note**: While the codebase uses `@lib/*` path aliases for imports, the
`workspace:*` declarations in `package.json` are still required for
Turborepo's dependency graph.

## Environment Variables

Each service may require different environment variables.
Create `.env` files per service (not committed to git):

| Service       | Env File                   | Description                     |
| ------------- | -------------------------- | ------------------------------- |
| Frontend      | `frontend/.env.local`      | Next.js environment vars        |
| AI Analyst    | `ai-analyst/.env`          | CLI environment                 |
| CDS Engine    | `cds-engine-strategy/.env` | Strategy engine environment     |
| Cloudflare    | `cloudflare/.dev.vars`     | Worker secrets (local dev)      |
| Root (shared) | `.env`                     | Shared across multiple services |

### Required Variables

**Supabase** (Frontend + AI services):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-side only
```

**AI/Data Services** (root `.env` or service-specific):

```bash
# Yahoo Finance proxy (recommended - avoids rate limiting)
YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev

# Polygon.io fallback (free tier: 5 calls/min)
POLYGON_API_TOKEN=xxx

# Ollama (local AI)
OLLAMA_API_KEY=ollama  # or your API key
```

**Note**: `YAHOO_PROXY_URL` should be set in both root `.env` (for CLI)
and `frontend/.env.local` (for Next.js) if using the Cloudflare proxy.

## Testing

### TypeScript

The frontend uses **Vitest** for testing:

```bash
# Run all tests
bun run test

# Run frontend tests only
bun run test:frontend

# Watch mode
cd frontend && bun run test:watch

# Coverage
cd frontend && bun run test:coverage
```

### Python

Python services use **pytest**:

```bash
# Run tests for a service
cd unusual-options-service && poetry run pytest tests/ -v
cd penny-stock-scanner && poetry run pytest tests/ -v
```

**Note**: `wp-service` does not have a test suite yet. CI runs tests for
`unusual-options-service` and `penny-stock-scanner` only.

## Security Audits

The monorepo uses a single `bun.lock` lockfile at the root, which includes all
dependencies from all workspaces. This means:

- **One audit covers everything**: Running `bun audit` from the root checks all
  dependencies across all workspaces in a single command
- **No per-package audits needed**: Unlike npm/yarn workspaces that may have
  separate lockfiles, Bun workspaces are truly unified
- **Consistent versions**: Shared dependencies are deduplicated, reducing the
  attack surface

```bash
# Audit all dependencies (all workspaces)
bun run audit

# Auto-fix vulnerabilities where possible
bun run audit:fix
```

### Handling Transitive Vulnerabilities

When vulnerabilities exist in transitive dependencies (dependencies of your
dependencies), you can use the `overrides` field in the root `package.json` to
force a specific version:

```json
{
  "overrides": {
    "esbuild": "^0.25.0"
  }
}
```

This forces all packages in the monorepo to use the specified version,
regardless of what their `package.json` specifies. Use with caution as it may
cause compatibility issues.

**Note**: The audit commands only cover JavaScript/TypeScript dependencies.
Python services (Poetry) should be audited separately using tools like
`pip-audit` or `safety`:

```bash
# Example: Audit Python dependencies
cd unusual-options-service && poetry run pip-audit
```

### Dependabot Integration

Dependabot is configured in `.github/dependabot.yml` to scan:

| Ecosystem        | Directory                  | Coverage                                 |
| ---------------- | -------------------------- | ---------------------------------------- |
| `npm`            | `/` (root)                 | All Bun workspaces via shared `bun.lock` |
| `pip`            | `/unusual-options-service` | Poetry dependencies                      |
| `pip`            | `/penny-stock-scanner`     | Poetry dependencies                      |
| `pip`            | `/wp-service`              | Poetry dependencies                      |
| `github-actions` | `/`                        | CI workflow actions                      |

**Note**: Since Bun workspaces use a single `bun.lock` at the root, scanning `/`
covers all TypeScript packages (frontend, ai-analyst, cds-engine-strategy,
cloudflare, lib/\*). Individual workspace directories don't need separate entries.

## Strategy Config Validation

The `strategy.config.yaml` is validated at load time using a comprehensive Zod schema
(`lib/ai-agent/config/schema.ts`). This catches misconfigurations before they affect
real trading decisions.

**What it validates:**

- All required fields are present
- Numeric fields are within sane ranges (0-100 for percentages)
- Relational constraints hold (e.g., `rsi_min < rsi_max`, `cushion.minimum < cushion.preferred`)
- Arrays are non-empty where required (scaling tiers, ticker universe)

**CI integration:** The `validate-config` job in `.github/workflows/ci.yml`
runs the schema validation tests on every push and PR. The build job depends on
this validation passing.

```bash
# Run config validation locally
bun test lib/ai-agent/config/schema.test.ts
```

## Error Boundaries

React Error Boundaries prevent runtime errors from crashing the entire page:

| Location                | File                                                 | Purpose                        |
| ----------------------- | ---------------------------------------------------- | ------------------------------ |
| Global                  | `frontend/src/app/error.tsx`                         | Catch-all for unhandled errors |
| Unusual Options Scanner | `frontend/src/app/unusual-options-scanner/error.tsx` | Scanner-specific recovery      |
| Penny Stock Scanner     | `frontend/src/app/penny-stock-scanner/error.tsx`     | Scanner-specific recovery      |
| Position Tracker        | `frontend/src/app/positions/error.tsx`               | Positions-specific recovery    |

A reusable `ErrorBoundary` class component is also available:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';

<ErrorBoundary section="My Feature">
  <MyComponent />
</ErrorBoundary>
```

## Rate Limiting

API route rate limiting is implemented via an in-memory sliding window
(`frontend/src/lib/rate-limit.ts`):

| Route       | Limit      | Key        |
| ----------- | ---------- | ---------- |
| `/api/chat` | 20 req/60s | User email |

Rate limits are configurable via environment variables:

- `AI_CHAT_RATE_LIMIT` — Max requests per window (default: 20)
- `AI_CHAT_RATE_WINDOW_MS` — Window duration in ms (default: 60000)

## Database Migrations

Migration tooling is provided via `db/migrate.sh`:

```bash
# Run pending migrations
bun run db:migrate

# Check migration status
bun run db:migrate:status

# Preview what would run
bun run db:migrate:dry-run

# Create a new migration
bun run db:migrate:new my_description
```

Migrations are tracked in a `_migrations` table in Supabase PostgreSQL.
Migration files live in `db/migrations/` and are executed in lexicographic order.

## Python Shared Library

`lib/py-core/` provides shared Python utilities for all trading services:

```python
from portfolio_core import get_service_client, setup_logging, safe_divide

# Consistent Supabase client
client = get_service_client()

# Standard logging
setup_logging(level="DEBUG", service_name="my-scanner")

# Safe math
result = safe_divide(profit, cost, default=0.0)
```

Install in a service:

```bash
cd unusual-options-service
poetry add portfolio-core --path ../lib/py-core
```

## Best Practices

1. **Keep packages independent**: Each package should work standalone
2. **Share via lib/**: Put reusable code in `lib/` packages
3. **Document everything**: Update `docs/` for any changes
4. **Consistent naming**: Use `@portfolio/` scope for all TS packages
5. **Type safety**: Share types via `@portfolio/types`
6. **Use Turbo**: Run `bun run build` instead of individual builds
7. **Leverage caching**: Turbo caches unchanged packages
8. **Format before commit**: Pre-commit hooks handle this automatically
9. **Pass CI locally**: Run `bun run typecheck && bun run lint` before pushing
10. **Use ruff for Python**: All Python services use ruff for consistency
11. **Audit regularly**: Run `bun run audit` to check for security vulnerabilities
12. **Validate config**: Run `bun test lib/ai-agent/config/schema.test.ts` after editing strategy.config.yaml
13. **Use Python shared lib**: Import from `portfolio_core` instead of duplicating Supabase client setup

## Root Scripts (updated)

New scripts added:

| Script                       | Description                     |
| ---------------------------- | ------------------------------- |
| `bun run db:migrate`         | Run pending database migrations |
| `bun run db:migrate:status`  | Show migration status           |
| `bun run db:migrate:dry-run` | Preview pending migrations      |
| `bun run db:migrate:new`     | Create a new migration file     |

---

**Last Updated**: 2026-04-14
