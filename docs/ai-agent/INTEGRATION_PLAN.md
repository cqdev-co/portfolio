# AI Agent Integration Plan

**Status**: Complete ✅  
**Started**: December 27, 2025  
**Updated**: December 27, 2025  
**Goal**: Share AI agent logic between CLI and Frontend

## Overview

This integration creates a shared library (`lib/ai-agent/`) that both the CLI 
(ai-analyst) and Frontend (portfolio website) import directly. The goal is to:

1. **Single Source of Truth**: Victor's personality and trading rules in one place
2. **CLI as Testing Ground**: Rapid iteration with immediate feedback
3. **Progressive Enhancement**: Frontend adopts features incrementally
4. **No Duplication**: Write once, use in both environments

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              lib/ai-agent/ (Source of Truth)                    │
│  • System prompts (Victor persona)                              │
│  • Tool definitions (web_search, get_ticker_data, etc.)         │
│  • Question classification                                      │
│  • Shared types                                                 │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                │ (direct import)              │ (direct import)
                ▼                              ▼
┌──────────────────────┐      ┌──────────────────────────────────┐
│   CLI (ai-analyst)   │      │   Frontend (portfolio)           │
│                      │      │                                  │
│  • Full lib import   │      │  • Direct lib import             │
│  • Commander CLI     │      │  • Next.js API Routes            │
│  • Tool calling      │      │  • Streaming responses           │
│  • Local testing     │      │  • Production deployment         │
└──────────────────────┘      └──────────────────────────────────┘
```

## Monorepo Configuration

Next.js 16 uses Turbopack by default, which has strict module resolution. 
To enable imports from `lib/ai-agent/`, we use a dual configuration:

- **Build** (Turbopack): Uses `turbopack.root` set to monorepo root
- **Dev** (Webpack): Uses webpack alias for `@lib/*` path

This is because Turbopack's `root` option affects `node_modules` resolution, 
causing issues in dev mode but not in production builds.

**`frontend/next.config.js`**:
```javascript
const path = require('path');

module.exports = {
  turbopack: {
    // For build: set root to monorepo root
    root: path.resolve(__dirname, '..'),
  },
  webpack: (config) => {
    // For dev: use webpack alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@lib': path.resolve(__dirname, '../lib'),
    };
    return config;
  },
};
```

**`frontend/package.json`** scripts:
```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "dev:turbo": "next dev",
    "build": "next build"
  }
}
```

**`frontend/tsconfig.json`** (path alias):
```json
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["../lib/*"]
    }
  }
}
```

**Important**: The lib/ai-agent files must NOT use `.js` extensions in imports 
(e.g., `from './victor'` not `from './victor.js'`). This ensures compatibility 
with both Bun (CLI) and Turbopack/Webpack (Frontend).

## Completed Phases

### Phase 1: Extract Core Prompts ✅

Created `lib/ai-agent/prompts/victor.ts`:
- `buildVictorSystemPrompt()` - Full prompt with context (CLI)
- `buildVictorLitePrompt()` - Lightweight prompt (Frontend)
- `buildVictorMinimalPrompt()` - Ultra-minimal for quick queries
- Exported building blocks for customization

### Phase 2: Extract Tool Definitions ✅

Created `lib/ai-agent/tools/definitions.ts`:
- `AGENT_TOOLS` - All available tools
- `RESEARCH_TOOLS` - Subset for research queries
- `BASIC_TOOLS` - Minimal set for simple queries
- `toOllamaTools()` - Convert to Ollama SDK format

### Phase 3: Extract Question Classification ✅

Created `lib/ai-agent/classification.ts`:
- `classifyQuestion()` - Determine question type
- `extractTickers()` - Find ticker symbols in text
- Smart context loading based on question type

### Phase 4: Update CLI ✅

Updated `ai-analyst/src/commands/chat.ts`:
- Imports `buildVictorSystemPrompt` from lib/ai-agent
- Uses shared `toOllamaTools(AGENT_TOOLS)` for tool definitions
- Removed 80+ lines of inline prompt code

### Phase 5: Update Frontend ✅

Updated `frontend/src/app/api/chat/route.ts`:
- Direct import from `@lib/ai-agent` (no local copy needed)
- Uses `buildVictorLitePrompt()` for Victor personality
- Turbopack configured for monorepo imports

### Phase 6: Turbopack Root Fix ✅

Configured `turbopack.root` in next.config.js:
- Set root to monorepo root (`..`)
- Removed `.js` extensions from lib imports
- Direct imports work in both CLI and Frontend

## File Structure

```
lib/ai-agent/                    # Source of truth
├── index.ts                     # Main exports
├── classification.ts            # Question classification
├── package.json                 # Dependencies (yahoo-finance2, @toon-format/toon)
├── prompts/
│   ├── index.ts
│   └── victor.ts                # Victor persona & prompt builders
├── tools/
│   ├── index.ts
│   └── definitions.ts           # Tool schemas
├── data/
│   ├── index.ts
│   ├── types.ts                 # TickerData interface
│   ├── yahoo.ts                 # Yahoo Finance fetching
│   └── formatters.ts            # AI-friendly formatting
├── handlers/
│   └── index.ts                 # Tool execution handlers
└── toon/
    └── index.ts                 # TOON encoding for reduced tokens
```

## Development Workflow

When updating Victor's behavior:

```bash
# 1. Edit source of truth
vim lib/ai-agent/prompts/victor.ts

# 2. Test with CLI
cd ai-analyst && bun run chat

# 3. Changes are immediately available in Frontend!
# (no sync needed - direct import)

# 4. Test frontend
cd frontend && bun run build

# 5. Deploy
```

### Phase 7: Shared Data Layer & Tool Handlers ✅

Created shared data layer in `lib/ai-agent/data/`:
- `types.ts` - Shared TickerData interface and related types
- `yahoo.ts` - Yahoo Finance data fetching with RSI/ADX calculations
- `formatters.ts` - AI-friendly formatting functions
- `index.ts` - Module exports

Created shared tool handlers in `lib/ai-agent/handlers/`:
- `handleGetTickerData()` - Fetch and format ticker data
- `handleWebSearch()` - Web search (requires search function injection)
- `handleAnalyzePosition()` - Position analysis calculations
- `executeToolCall()` - Unified tool executor

### Phase 8: Frontend Tool Calling ✅

Updated `frontend/src/app/api/chat/route.ts`:
- Added tool definitions from shared library
- Implemented streaming tool call handling
- Tool status displayed in chat ("🔧 Using tool: get_ticker_data...")
- Tool results sent back to AI for final response
- Recursive handling for multi-tool conversations

### Phase 9: Tool Data Cards UI ✅

Added visual tool call display in the frontend:
- `ToolCallCard` component - collapsible card showing tool status & data
- `TickerDataCard` component for rich ticker data display
- `ToolStatusIndicator` for simple status badges
- Real-time streaming display of fetched data similar to CLI

**Streaming Architecture**:

Since AI SDK 3.x has strict type validation, custom data events are embedded 
as HTML comment markers in the text stream:

```
<!--TOOL_START:get_ticker_data:{"ticker":"NVDA"}:START-->  (tool running)
<!--TOOL:get_ticker_data:{...data...}:TOOL-->              (tool complete)
<!--TOOL_ERROR:get_ticker_data:{"error":"..."}:ERROR-->    (tool failed)
```

The frontend parses these markers to:
1. Show `ToolCallCard` with "running" spinner while tool executes
2. Transition to "complete" with data preview when result arrives
3. Transition to "error" with error message if tool fails
4. Allow expanding to view full data (for debugging)
5. Strip markers from visible text content

**UX Features**:
- Tools show status: pending → running → complete/error
- Completed tools show data preview (e.g., "$221.27 | RSI 50")
- Failed tools show error message with red indicator
- Click to expand and view raw data for debugging
- Color-coded borders (blue=running, green=complete, red=error)

### Phase 10: Shared Options Module ✅

Created `lib/ai-agent/options/` with REAL options chain logic:

| Component | File | Description |
|-----------|------|-------------|
| Types | `types.ts` | OptionContract, OptionsChain, SpreadRecommendation, IVAnalysis |
| Chain | `chain.ts` | `getOptionsChain()` - fetches real options data |
| IV | `iv.ts` | `getIVAnalysis()` - calculates IV from ATM options |
| Spreads | `spreads.ts` | `findOptimalSpread()` - real bid/ask spreads |

**Data Parity Achieved**:
- CLI and Frontend now use the SAME options functions
- IV is from real ATM options (not HV approximation)
- Spread cushion is from real option prices (not guessed)
- Falls back to HV-based estimate only if options unavailable

**See**: `docs/ai-agent/DATA_PARITY.md` for full analysis.

## Future Enhancements

### Phase 11: Real Options Data (Optional)

Move CLI's options functions to `lib/ai-agent/options/`:
- `getOptionsChain()` - Fetch real options data
- `getIVAnalysis()` - Calculate real IV from ATM options
- `findSpreadWithAlternatives()` - Real spread recommendations

**Challenges**:
- Yahoo Finance options API has rate limits
- Requires proper error handling for illiquid options
- May need caching strategy for frontend

### Phase 12: TOON Context Builder (Optional)

Move `ai-analyst/src/context/toon.ts` to `lib/ai-agent/context/`:
- TOON encoding functions
- Context building utilities
- History summarization

**Note**: Has CLI-specific dependencies. Consider only if 
frontend needs full context building.

## Benefits Achieved

| Benefit | Description |
|---------|-------------|
| **Consistency** | Same Victor personality across platforms |
| **Iteration Speed** | Test in CLI, changes auto-available in frontend |
| **Type Safety** | Shared TypeScript interfaces |
| **Maintainability** | One source of truth in lib/ai-agent |
| **No Sync Required** | Direct imports with turbopack.root |

## Files Changed

### New Files
- `lib/ai-agent/index.ts`
- `lib/ai-agent/classification.ts`
- `lib/ai-agent/package.json` - Dependencies for shared lib
- `lib/ai-agent/prompts/index.ts`
- `lib/ai-agent/prompts/victor.ts`
- `lib/ai-agent/tools/index.ts`
- `lib/ai-agent/tools/definitions.ts`
- `lib/ai-agent/data/index.ts`
- `lib/ai-agent/data/types.ts` - TickerData interface
- `lib/ai-agent/data/yahoo.ts` - Yahoo Finance data fetching
- `lib/ai-agent/data/formatters.ts` - AI formatting
- `lib/ai-agent/handlers/index.ts` - Tool execution
- `lib/ai-agent/toon/index.ts` - TOON encoding for ticker data
- `docs/ai-agent/INTEGRATION_PLAN.md`
- `docs/ai-agent/SHARED_LIBRARY.md`
- `docs/ai-agent/DATA_PARITY.md` - CLI vs Frontend data analysis

### Modified Files
- `ai-analyst/src/commands/chat.ts` - Uses shared lib
- `frontend/src/app/api/chat/route.ts` - Uses shared lib + tool calling
- `frontend/src/components/chat/chat-panel.tsx` - Passes tool data
- `frontend/src/components/chat/chat-messages.tsx` - Renders tool cards
- `frontend/next.config.js` - Added turbopack.root
- `frontend/tsconfig.json` - Added @lib/* path alias
- `frontend/package.json` - Added yahoo-finance2 dep
- `lib/README.md` - Added ai-agent docs
- `docs/README.md` - Added shared library section

### New Frontend Components
- `frontend/src/components/chat/ticker-data-card.tsx` - Data card UI

## AI SDK 3.x Migration Notes

The frontend uses `@ai-sdk/react` v3.x which has a different API than earlier versions:

### Transport-Based Configuration
```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const transport = useMemo(
  () => new DefaultChatTransport({
    api: "/api/chat",
    body: { model: selectedModel },
  }),
  [selectedModel]
);

const { messages, sendMessage, status, stop } = useChat({
  id: `chat-${chatKey}`,
  transport,
});
```

### sendMessage Format
The `sendMessage` function expects `{ text: string }`:
```typescript
sendMessage({ text: input });  // ✅ Correct
sendMessage({ content: input });  // ❌ Old API
```

### Data Streaming
The `data` prop is no longer available directly from `useChat`. 
To display tool calls, use the `onData` callback or inspect message parts:
```typescript
useChat({
  onData: (data) => {
    // Handle tool events
  }
});
```
