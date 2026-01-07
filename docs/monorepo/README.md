# Monorepo Architecture

This document describes the portfolio monorepo structure and conventions.

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
```

## CI/CD

GitHub Actions runs on every push and PR to `main`:

| Job           | Description                                      | Blocking |
| ------------- | ------------------------------------------------ | -------- |
| `typecheck`   | Type-check all TypeScript packages               | Yes      |
| `lint`        | Lint all packages with ESLint + check formatting | Yes      |
| `lint-python` | Lint Python services with ruff                   | Yes      |
| `test`        | Run all TypeScript test suites                   | Yes      |
| `test-python` | Run Python test suites with pytest               | No\*     |
| `build`       | Build all packages (after lint jobs pass)        | Yes      |

\*Python tests are currently non-blocking (`|| true`) to allow gradual test coverage improvements.

Configuration: `.github/workflows/ci.yml`

### CI Job Dependencies

```
typecheck ──┐
            ├──> build
lint ───────┤
            │
lint-python ┘

test ──────────> (independent)
test-python ───> (independent, non-blocking)
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

| Package                       | Location         | Purpose                   |
| ----------------------------- | ---------------- | ------------------------- |
| `@portfolio/web`              | `frontend/`      | Next.js portfolio website |
| `@portfolio/ai-analyst`       | `ai-analyst/`    | AI ticker analysis CLI    |
| `@portfolio/screen-ticker`    | `screen-ticker/` | Stock opportunity scanner |
| `@portfolio/cloudflare-proxy` | `cloudflare/`    | Yahoo Finance API proxy   |
| `@portfolio/ai-agent`         | `lib/ai-agent/`  | Shared AI agent logic     |
| `@portfolio/types`            | `lib/types/`     | Shared type definitions   |
| `@portfolio/utils`            | `lib/utils/`     | Shared utility functions  |

## Workspaces

The monorepo uses Bun workspaces defined in the root `package.json`:

```json
{
  "workspaces": [
    "frontend",
    "lib/*",
    "screen-ticker",
    "ai-analyst",
    "cloudflare"
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
├── .github/workflows/     # CI/CD configuration
├── .husky/                # Git hooks (pre-commit)
├── frontend/              # @portfolio/web
├── ai-analyst/            # @portfolio/ai-analyst
├── screen-ticker/         # @portfolio/screen-ticker
├── cloudflare/            # @portfolio/cloudflare-proxy
├── unusual-options-service/  # Python (Poetry)
├── penny-stock-scanner/   # Python (Poetry)
├── wp-service/            # Python (Poetry)
├── lib/                   # Shared TypeScript libraries
│   ├── ai-agent/         # @portfolio/ai-agent
│   ├── types/            # @portfolio/types
│   └── utils/            # @portfolio/utils
├── db/                    # Database schemas
├── docs/                  # Documentation
├── scripts/               # Standalone scripts
├── data/                  # Data exports
├── turbo.json            # Turborepo configuration
├── tsconfig.json         # Root TypeScript config
├── eslint.config.mjs     # Shared ESLint config
├── .prettierrc           # Shared Prettier config
└── .pre-commit-config.yaml  # Pre-commit hooks config
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
  buildVictorSystemPrompt,
  AGENT_TOOLS,
  classifyQuestion,
} from '@portfolio/ai-agent';
```

### @portfolio/types

Shared TypeScript type definitions:

```typescript
import type { TickerInfo, Position } from '@portfolio/types';
```

### @portfolio/utils

Shared utility functions:

```typescript
import { calculateEntryGrade } from '@portfolio/utils/entry-grade';
import { calculatePFV } from '@portfolio/utils/pfv';
```

## Python Services

All Python services use **Poetry** for dependency management and **ruff**
for linting/formatting:

| Service                   | Description                        | CI Tests |
| ------------------------- | ---------------------------------- | -------- |
| `unusual-options-service` | Unusual options activity detection | Yes      |
| `penny-stock-scanner`     | Penny stock breakout scanner       | Yes      |
| `wp-service`              | Wallpaper/gradient generation      | No\*     |

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

TypeScript packages can import from each other:

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
import { buildVictorSystemPrompt } from '@portfolio/ai-agent';
```

## Environment Variables

Each service may require different environment variables.
Create `.env` files per service (not committed to git):

| Service       | Env File               | Description                     |
| ------------- | ---------------------- | ------------------------------- |
| Frontend      | `frontend/.env.local`  | Next.js environment vars        |
| AI Analyst    | `ai-analyst/.env`      | CLI environment                 |
| Screen Ticker | `screen-ticker/.env`   | Scanner environment             |
| Cloudflare    | `cloudflare/.dev.vars` | Worker secrets (local dev)      |
| Root (shared) | `.env`                 | Shared across multiple services |

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

---

**Last Updated**: 2026-01-06
