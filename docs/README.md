# Portfolio Documentation

Comprehensive documentation for all services in the portfolio monorepo.

## 🎯 Trading Strategy

### [Deep ITM Call Debit Spread Strategy](strategy/)

The core business strategy for small account trading with defined risk.

- **Strategy**: Deep In-The-Money Call Debit Spreads
- **Goal**: $100k account generating $1k/month income
- **Key Docs**:
  - [Strategy Overview](strategy/README.md)
  - [Config Reference](lib/strategy-config.md)
- **Status**: Production-ready

---

## 📚 Services Documentation

### TypeScript Services

#### [AI Analyst "Victor Chen"](ai-analyst/)

AI "Employee" - a 67-year-old veteran Wall Street analyst with 45 years experience.

- **Strategy**: Deep ITM Call Debit Spreads with strict entry criteria
- **Personality**: Direct, decisive, protective of capital
- **Key Features**: Thinking mode, agent loop, tool calling, trade grading
- **Status**: Production-ready
- [README](ai-analyst/README.md)

#### [CDS Engine Strategy](cds-engine-strategy/)

Call Debit Spread trading engine - finds optimal entry opportunities.

- **Strategy**: Technical + Fundamental + Analyst confluence scoring
- **Key Features**: Market regime awareness, sector rotation, spread finding
- **Status**: Production-ready
- [README](cds-engine-strategy/README.md) | [Process Flow](cds-engine-strategy/PROCESS_FLOW.md)

#### [Cloudflare Yahoo Proxy](../cloudflare/README.md)

Cloudflare Worker proxy for Yahoo Finance API.

- **Purpose**: Bypass rate limiting via Cloudflare's IP pool
- **Key Features**: Combined endpoint, clean response format
- **Status**: Production-ready

#### [Frontend Portfolio](frontend/)

Next.js-based portfolio website with AI chat.

- **Features**: Dashboard, AI chat with Victor, positions tracking
- **Tech**: Next.js 16, Tailwind, Shadcn/UI
- [README](frontend/README.md) | [AI Chat](frontend/AI_CHAT.md)

### Python Services

#### [Unusual Options Service](unusual-options-service/)

Real-time unusual options activity tracker.

- **Strategy**: Volume, OI, and premium analysis
- **Key Features**: Signal expiration, performance tracking, spread detection
- **Status**: Production-ready
- [Quick Start](unusual-options-service/quick-start.md) | [Overview](unusual-options-service/system-overview.md)

#### [Penny Stock Scanner](penny-stock-scanner/)

Scanner for identifying penny stocks before breakouts.

- **Strategy**: Volume-focused explosion setup detection
- **Key Features**: Consolidation detection, volume spike analysis
- **Status**: Production-ready
- [Overview](penny-stock-scanner/system-overview.md) | [User Guide](penny-stock-scanner/user-guide.md)

#### [Wallpaper Service](wp-service/)

Gradient wallpaper generation service.

- **Features**: Glossy glass-like gradients with grain effects
- **Status**: Production-ready
- [README](wp-service/README.md)

### Shared Libraries

#### [AI Agent Library](ai-agent/)

Shared AI agent logic for CLI and Frontend.

- **Components**: Victor prompts, tool definitions, question classification
- **Benefits**: Single source of truth, CLI testing → Frontend deployment
- [Integration Plan](ai-agent/INTEGRATION_PLAN.md) | [Library Guide](ai-agent/SHARED_LIBRARY.md)

#### [Shared Types](../lib/types/)

Shared TypeScript type definitions (`@portfolio/types`).

#### [Shared Utils](../lib/utils/)

Shared utility functions (`@portfolio/utils`).

- **Modules**: Entry grade calculator, Psychological Fair Value
- [PFV Docs](lib/psychological-fair-value.md)

### Supporting

#### [Database](db/)

Centralized database schemas and migrations.

- **Tables**: Tickers, signals, options activity, positions
- [README](db/README.md) | [Penny Tickers](db/penny-tickers.md)

#### [Monorepo](monorepo/)

Monorepo architecture and Turborepo configuration.

- [README](monorepo/README.md)

## 🔍 Service Comparison

| Service             | Focus             | Language   | Update Frequency |
| ------------------- | ----------------- | ---------- | ---------------- |
| AI Analyst          | Entry decisions   | TypeScript | On-demand        |
| CDS Engine Strategy | CDS opportunities | TypeScript | Daily            |
| Unusual Options     | Options flow      | Python     | Real-time        |
| Penny Scanner       | Penny breakouts   | Python     | Daily            |
| Frontend            | Web interface     | TypeScript | -                |

## 🚀 Quick Start by Use Case

### "I want AI-powered analysis"

→ Use **[AI Analyst](ai-analyst/)**

```bash
cd ai-analyst && bun run chat
```

### "I want to find CDS opportunities"

→ Use **[CDS Engine Strategy](cds-engine-strategy/)**

```bash
bun run cds              # Full engine briefing
bun run cds:scan-all     # Scan + find spreads
```

### "I want to track unusual options"

→ Use **[Unusual Options Service](unusual-options-service/)**

```bash
cd unusual-options-service && poetry run unusual-options scan
```

### "I want to find penny stock breakouts"

→ Use **[Penny Stock Scanner](penny-stock-scanner/)**

```bash
cd penny-stock-scanner && poetry run penny-scanner scan-all
```

## 📊 Data Architecture

```
External APIs (Yahoo Finance, Reddit)
    ↓
Services (Scanners, AI Analyst)
    ↓
Supabase Database (Signals, Positions)
    ↓
Frontend Dashboard
```

## 🛠️ Development

See [Monorepo Documentation](monorepo/README.md) for:

- Turborepo build system
- Workspace configuration
- Adding new packages
- Environment variables

## 📝 Documentation Standards

All service documentation includes:

- ✅ README.md (quick start, features)
- ✅ System overview (architecture)
- ✅ User guide (CLI usage)

---

**Last Updated**: 2026-01-07
