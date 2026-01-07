# Portfolio Monorepo

A monorepo containing a portfolio website, trading analysis tools,
and supporting services. Powered by **Turborepo** for fast, cached builds.

## Structure

```
portfolio/
├── frontend/              # Next.js portfolio website
├── ai-analyst/            # AI-powered ticker analysis CLI
├── screen-ticker/         # Stock opportunity scanner CLI
├── cloudflare/            # Yahoo Finance proxy worker
├── unusual-options-service/  # Unusual options activity detector (Python)
├── penny-stock-scanner/   # Penny stock breakout scanner (Python)
├── wp-service/            # Wallpaper generation service (Python)
├── lib/                   # Shared TypeScript libraries
│   ├── ai-agent/         # Shared AI agent logic
│   ├── types/            # Shared type definitions
│   └── utils/            # Shared utilities
├── db/                    # Database schemas and migrations
├── docs/                  # Project documentation
├── scripts/               # Standalone analysis scripts
├── turbo.json            # Turborepo configuration
└── data/                  # Data exports and templates
```

## TypeScript Projects

| Package                       | Description               | Tech Stack                        |
| ----------------------------- | ------------------------- | --------------------------------- |
| `@portfolio/web`              | Modern portfolio website  | Next.js 16\*, Tailwind, Shadcn/UI |
| `@portfolio/ai-analyst`       | AI ticker analysis CLI    | Bun, Ollama, Commander            |
| `@portfolio/screen-ticker`    | Stock opportunity scanner | Bun, Yahoo Finance, Zod           |
| `@portfolio/cloudflare-proxy` | Yahoo Finance API proxy   | Cloudflare Workers                |
| `@portfolio/ai-agent`         | Shared AI agent logic     | TypeScript, yahoo-finance2        |
| `@portfolio/types`            | Shared type definitions   | TypeScript                        |
| `@portfolio/utils`            | Shared utilities          | TypeScript                        |

\*Next.js 16 is used for Turbopack build support with monorepo imports.

## Python Services

| Service                   | Description                        | Tech Stack                   |
| ------------------------- | ---------------------------------- | ---------------------------- |
| `unusual-options-service` | Unusual options activity detection | Poetry, Click, Pandas, Ruff  |
| `penny-stock-scanner`     | Penny stock breakout scanner       | Poetry, FastAPI, Typer, Ruff |
| `wp-service`              | Wallpaper/gradient generation      | Poetry, PIL, NumPy, Ruff     |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0 (for TypeScript projects)
- [Poetry](https://python-poetry.org) (for Python services)
- Node.js >= 20 (for compatibility)

### Install Dependencies

```bash
# Install all TypeScript workspace dependencies
bun install

# Install all Python dependencies
bun run py:install

# Or individually:
cd unusual-options-service && poetry install
cd penny-stock-scanner && poetry install
cd wp-service && poetry install
```

### Development

```bash
# Frontend development
bun run dev

# AI Analyst CLI
bun run dev:analyst

# Stock Scanner
bun run dev:scanner

# Cloudflare Worker
bun run dev:cloudflare
```

### Available Scripts

| Script                   | Description                             |
| ------------------------ | --------------------------------------- |
| `bun run dev`            | Start frontend dev server               |
| `bun run dev:analyst`    | Run AI analyst CLI                      |
| `bun run dev:scanner`    | Run stock scanner                       |
| `bun run dev:cloudflare` | Start Cloudflare worker locally         |
| `bun run build`          | Build all packages (Turbo, cached)      |
| `bun run build:frontend` | Build frontend only                     |
| `bun run test`           | Run all tests (Turbo)                   |
| `bun run typecheck`      | Type-check all packages (Turbo, cached) |
| `bun run lint`           | Lint all packages (Turbo)               |
| `bun run lint:py`        | Lint Python services with ruff          |
| `bun run format:py`      | Format Python services with ruff        |
| `bun run py:install`     | Install all Python dependencies         |
| `bun run clean`          | Remove all node_modules                 |
| `bun run clean:turbo`    | Clear Turbo cache                       |

## Documentation

- [Monorepo Architecture](./docs/monorepo/README.md) - Full monorepo docs
- [Frontend](./docs/frontend/README.md) - Portfolio website docs
- [AI Analyst](./docs/ai-analyst/README.md) - AI analysis CLI docs
- [Screen Ticker](./docs/screen-ticker/) - Stock scanner docs
- [Unusual Options](./docs/unusual-options-service/) - Options service docs
- [Penny Scanner](./docs/penny-stock-scanner/) - Penny stock docs
- [Database](./docs/db/README.md) - Schema documentation
- [Shared Lib](./lib/README.md) - Shared library docs

## Deployment

### Frontend (Vercel)

The frontend auto-deploys to Vercel. Configuration in `vercel.json`.

### Cloudflare Worker

```bash
cd cloudflare && bun run deploy
```

### Python Services

Each Python service can be deployed independently as a
containerized service or serverless function.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes in the appropriate directory
4. Update documentation in `docs/`
5. Submit a pull request

## License

MIT License - see individual directories for specific licensing.
