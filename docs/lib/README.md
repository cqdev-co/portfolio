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
| `toon/`             | TOON encoding (40% fewer tokens vs JSON)             |
| `classification.ts` | Question type classification                         |

### TOON Encoding

Token-Oriented Object Notation for efficient AI data transfer:

```typescript
import {
  encodeTickerToTOON,
  encodeSearchToTOON,
  encodeUnusualOptionsToTOON,
  encodeScanResultsToTOON,
  encodeCalendarToTOON,
} from '@portfolio/ai-agent';

// Produces compact YAML-like output
const toon = encodeTickerToTOON(tickerData);
// ticker: AMD
// price: 220.97
// change: +6.4%
// rsi: 55
// grade: B+

// Calendar context encoding
const calToon = encodeCalendarToTOON();
// Returns market status, warnings, upcoming events
```

| Tool                  | Uses TOON |
| --------------------- | --------- |
| `get_ticker_data`     | ✅        |
| `web_search`          | ✅        |
| `scan_opportunities`  | ✅        |
| `get_unusual_options` | ✅        |
| `get_market_regime`   | ✅        |
| `get_financials_deep` | ❌ text   |
| `get_institutional`   | ❌ text   |

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

## Recent Changes (2026-01-14)

### Lint Warning Cleanup

Cleaned up ~100 lint warnings across all packages:

- **@portfolio/ai-agent** (28 warnings): Removed unused imports and type
  exports. Prefixed intentionally unused variables with `_`. Changed unused
  catch parameters to empty catch blocks.

- **@portfolio/ai-analyst** (50 warnings): Removed unused imports from
  commands/chat.ts, services/yahoo.ts, and other files. Cleaned up unused
  type imports and re-exports.

- **@portfolio/utils** (7 warnings): Fixed unused imports in
  psychological-fair-value module. Re-exported functions from calculator.ts
  for external use.

- **@portfolio/web** (8 warnings): Fixed unused eslint-disable directives,
  added missing React hook dependencies with eslint-disable comments, typed
  options-chain API response properly.

- **@portfolio/cloudflare-proxy** (2 warnings): Replaced `any` types with
  proper Record types or typed function parameters.

- **@portfolio/cds-engine-strategy** (1 warning): Fixed Wikipedia fetch
  response typing.

### Type Safety Improvements

- **TimeRange Types**: Fixed type mismatch between `FinanceChart` component
  (`TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'`) and the
  stock-prices API (`TimeRange = '1D' | ... | '5Y' | 'MAX'`). Use
  `ApiTimeRange` alias when calling API functions.

- **Recharts Typing**: Fixed `activePayload` type errors in chart `onMouseMove`
  handlers by casting the state parameter to the proper type.

- **Framer Motion**: Fixed `whileTap` animation typing by using `as const`
  for the ease property.

- **TOON Calendar**: Replaced `require()` import with proper ES module import
  for `getCalendarContext` from the calendar module.

### React Best Practices

- **TypewriterText**: Refactored to avoid synchronous `setState` calls in
  effects. Now uses `requestAnimationFrame` callbacks for all state updates.

- **useScrollToBottom**: Fixed impure function call (`Date.now()`) during
  render by initializing ref to `0`.

---

**Last Updated**: 2026-01-14
