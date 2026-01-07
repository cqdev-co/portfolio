# Shared Libraries

Shared TypeScript packages for the portfolio monorepo.

## Packages

| Package     | Scope                 | Description              |
| ----------- | --------------------- | ------------------------ |
| `ai-agent/` | `@portfolio/ai-agent` | Shared AI agent logic    |
| `types/`    | `@portfolio/types`    | Shared type definitions  |
| `utils/`    | `@portfolio/utils`    | Shared utility functions |

All packages are part of the Bun workspace and can be imported directly.

## @portfolio/ai-agent

Shared AI agent logic for CLI and Frontend.

```typescript
import {
  buildVictorSystemPrompt,
  buildVictorLitePrompt,
  AGENT_TOOLS,
  classifyQuestion,
} from '@portfolio/ai-agent';
```

**Contents**:

- `prompts/` - Victor Chen system prompts
- `tools/` - Tool definitions (web_search, get_ticker_data, etc.)
- `handlers/` - Tool execution handlers
- `data/` - Yahoo Finance fetching, Polygon fallback
- `options/` - Options chain, IV analysis, spreads
- `market/` - Market regime and no-trade detection
- `classification.ts` - Question classification for smart context

See [Integration Plan](../docs/ai-agent/INTEGRATION_PLAN.md) for details.

## @portfolio/types

Shared TypeScript type definitions.

```typescript
import type { TickerInfo, Position } from '@portfolio/types';
```

**Contents**:

- `ticker.ts` - Ticker information types
- `positions.ts` - Position and trade types

## @portfolio/utils

Shared utility functions.

```typescript
// Entry grade calculator
import { calculateEntryGrade } from '@portfolio/utils/entry-grade';

// Psychological Fair Value
import { calculatePsychologicalFairValue } from '@portfolio/utils/pfv';

// Ticker fetching
import { getAllTickers, searchTickers } from '@portfolio/utils';
```

**Contents**:

- `ts/entry-grade/` - Entry quality scoring
- `ts/psychological-fair-value/` - PFV calculator with max pain, gamma walls
- `strategy_config.py` - Python strategy config loader
- `get_tickers.ts` - Ticker fetching utilities
- `get_tickers.py` - Python version

See [Library Docs](../docs/lib/README.md) for full documentation.

---

**Last Updated**: 2026-01-06
