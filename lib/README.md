# Shared Library

Global utility functions and modules shared across the monorepo.

## Modules

### ai-agent/

Shared AI agent logic for CLI and Frontend.

```typescript
import { 
  buildVictorSystemPrompt,
  buildVictorLitePrompt,
  AGENT_TOOLS,
  classifyQuestion 
} from './ai-agent';
```

**Contents**:
- `prompts/` - Victor Chen system prompts
- `tools/` - Tool definitions (web_search, get_ticker_data, etc.)
- `classification.ts` - Question classification for smart context loading

See [Integration Plan](../docs/ai-agent/INTEGRATION_PLAN.md) for details.

### utils/ts/psychological-fair-value/

Calculates psychological fair value for stocks based on options data,
technical levels, and behavioral biases.

```typescript
import { 
  calculatePsychologicalFairValue,
  formatPFVResult,
} from './utils/ts/psychological-fair-value';
```

### types/

Shared TypeScript types.

```typescript
import type { TickerInfo } from './types/ticker';
```

### utils/

Utility functions for Python and TypeScript.

- `get_tickers.ts` - Fetch ticker lists
- `get_tickers.py` - Python version
