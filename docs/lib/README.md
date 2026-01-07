# Shared Libraries Documentation

Documentation for the shared TypeScript libraries in `lib/`.

## Packages

| Package         | Name                  | Description              |
| --------------- | --------------------- | ------------------------ |
| `lib/ai-agent/` | `@portfolio/ai-agent` | Shared AI agent logic    |
| `lib/types/`    | `@portfolio/types`    | Shared type definitions  |
| `lib/utils/`    | `@portfolio/utils`    | Shared utility functions |

## @portfolio/ai-agent

Shared AI agent logic for CLI (ai-analyst) and Frontend chat.

**See**: [AI Agent Integration Plan](../ai-agent/INTEGRATION_PLAN.md)

```typescript
import {
  buildVictorSystemPrompt,
  buildVictorLitePrompt,
  AGENT_TOOLS,
  classifyQuestion,
  executeToolCall,
} from '@portfolio/ai-agent';
```

### Modules

| Module              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `prompts/`          | Victor Chen system prompts                           |
| `tools/`            | Tool definitions (web_search, get_ticker_data, etc.) |
| `handlers/`         | Tool execution handlers                              |
| `data/`             | Yahoo Finance fetching, formatters                   |
| `options/`          | Options chain, IV analysis, spreads                  |
| `market/`           | Market regime detection, no-trade logic              |
| `classification.ts` | Question type classification                         |

## @portfolio/types

Shared TypeScript type definitions.

```typescript
import type { TickerInfo, Position } from '@portfolio/types';
```

### Available Types

| Type         | File           | Description              |
| ------------ | -------------- | ------------------------ |
| `TickerInfo` | `ticker.ts`    | Basic ticker information |
| `Position`   | `positions.ts` | Trading position data    |

## @portfolio/utils

Shared utility functions.

```typescript
// Entry grade calculator
import { calculateEntryGrade } from '@portfolio/utils/entry-grade';

// Psychological Fair Value
import {
  calculatePsychologicalFairValue,
  formatPFVResult,
} from '@portfolio/utils/pfv';
```

### Modules

| Module                      | Description               | Docs                                      |
| --------------------------- | ------------------------- | ----------------------------------------- |
| `entry-grade/`              | Entry quality scoring     | -                                         |
| `psychological-fair-value/` | PFV calculator            | [PFV Docs](./psychological-fair-value.md) |
| `get_tickers.ts`            | Ticker fetching utilities | -                                         |

## Psychological Fair Value (PFV)

Calculates where stock price gravitates based on behavioral biases
and market mechanics.

**Documentation**: [psychological-fair-value.md](./psychological-fair-value.md)

**Key Features**:

- Max pain calculation
- Gamma wall detection
- Multi-expiration analysis
- Ticker profile auto-detection
- AI-ready context output

## Usage in Packages

### Import from CLI (ai-analyst)

```typescript
import { buildVictorSystemPrompt } from '@portfolio/ai-agent';
import type { TickerInfo } from '@portfolio/types';
```

### Import from Frontend

```typescript
import { buildVictorLitePrompt, AGENT_TOOLS } from '@lib/ai-agent';
```

Note: Frontend uses `@lib/*` path alias due to Next.js configuration.

---

**Last Updated**: 2026-01-06
