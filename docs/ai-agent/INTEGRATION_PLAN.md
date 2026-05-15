# AI Agent Integration Plan

**Status**: Complete ✅  
**Started**: December 27, 2025  
**Updated**: December 31, 2025  
**Goal**: Share AI agent logic between CLI and Frontend

## Overview

This integration creates a shared library (`lib/ai-agent/`) that both the CLI
(ai-analyst) and Frontend (portfolio website) import directly. The goal is to:

1. **Single Source of Truth**: Xylo's personality and trading rules in one place
2. **CLI as Testing Ground**: Rapid iteration with immediate feedback
3. **Progressive Enhancement**: Frontend adopts features incrementally
4. **No Duplication**: Write once, use in both environments

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              lib/ai-agent/ (Source of Truth)                    │
│  • System prompts (Xylo persona)                              │
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
(e.g., `from './xylo'` not `from './xylo.js'`). This ensures compatibility
with both Bun (CLI) and Turbopack/Webpack (Frontend).

## Completed Phases

### Phase 1: Extract Core Prompts ✅

Created `lib/ai-agent/prompts/xylo.ts`:

- `buildXyloSystemPrompt()` - Full prompt with context (CLI)
- `buildXyloLitePrompt()` - Lightweight prompt (Frontend)
- `buildXyloMinimalPrompt()` - Ultra-minimal for quick queries
- Exported building blocks for customization

### Phase 2: Extract Tool Definitions ✅

Created `lib/ai-agent/tools/definitions.ts`:

- `AGENT_TOOLS` - All available tools
- `RESEARCH_TOOLS` - Subset for research queries
- `BASIC_TOOLS` - Minimal set for simple queries
- `toOllamaTools()` - Convert to Ollama SDK format

**Available Tools (Updated Dec 31, 2025)**:
| Tool | Description |
|------|-------------|
| `web_search` | Search web for news/analysis |
| `get_ticker_data` | Real-time price, IV, technicals, news |
| `get_financials_deep` | Income statement, balance sheet, cash flow |
| `get_institutional_holdings` | 13F ownership data, top holders |
| `get_unusual_options_activity` | Signals from Supabase (sweeps, blocks) |

### Phase 3: Extract Question Classification ✅

Created `lib/ai-agent/classification.ts`:

- `classifyQuestion()` - Determine question type
- `extractTickers()` - Find ticker symbols in text
- Smart context loading based on question type

### Phase 4: Update CLI ✅

Updated `ai-analyst/src/commands/chat.ts`:

- Imports `buildXyloSystemPrompt` from lib/ai-agent
- Uses shared `toOllamaTools(AGENT_TOOLS)` for tool definitions
- Removed 80+ lines of inline prompt code

### Phase 5: Update Frontend ✅

Updated `frontend/src/app/api/chat/route.ts`:

- Direct import from `@lib/ai-agent` (no local copy needed)
- Uses `buildXyloLitePrompt()` for Xylo personality
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
│   └── xylo.ts                # Xylo persona & prompt builders
├── tools/
│   ├── index.ts
│   └── definitions.ts           # Tool schemas (5 tools)
├── data/
│   ├── index.ts
│   ├── types.ts                 # TickerData, Financials, Holdings types
│   ├── yahoo.ts                 # Yahoo Finance fetching
│   └── formatters.ts            # AI-friendly formatting
├── handlers/
│   └── index.ts                 # Tool execution handlers (5 handlers)
├── options/
│   ├── chain.ts                 # Options chain fetching
│   ├── iv.ts                    # IV analysis
│   ├── spreads.ts               # Spread recommendations
│   └── types.ts                 # Options types
├── pfv/
│   └── index.ts                 # Psychological Fair Value
├── market/
│   └── index.ts                 # Market regime detection
└── toon/
    └── index.ts                 # TOON encoding for reduced tokens
```

## Development Workflow

When updating Xylo's behavior:

```bash
# 1. Edit source of truth
vim lib/ai-agent/prompts/xylo.ts

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
- `handleGetFinancialsDeep()` - Detailed financial statements
- `handleGetInstitutionalHoldings()` - 13F ownership data
- `handleGetUnusualOptionsActivity()` - Supabase signals query
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

| Component | File         | Description                                                    |
| --------- | ------------ | -------------------------------------------------------------- |
| Types     | `types.ts`   | OptionContract, OptionsChain, SpreadRecommendation, IVAnalysis |
| Chain     | `chain.ts`   | `getOptionsChain()` - fetches real options data                |
| IV        | `iv.ts`      | `getIVAnalysis()` - calculates IV from ATM options             |
| Spreads   | `spreads.ts` | `findOptimalSpread()` - real bid/ask spreads                   |

**Data Parity Achieved**:

- CLI and Frontend now use the SAME options functions
- IV is from real ATM options (not HV approximation)
- Spread cushion is from real option prices (not guessed)
- Falls back to HV-based estimate only if options unavailable

**See**: `docs/ai-agent/DATA_PARITY.md` for full analysis.

## Future Enhancements

### Phase 11: Real Options Data ✅ (Completed)

Moved CLI's options functions to `lib/ai-agent/options/`:

- `getOptionsChain()` - Fetch real options data
- `getIVAnalysis()` - Calculate real IV from ATM options
- `findSpreadWithAlternatives()` - Real spread recommendations

### Phase 12: Financial Tools ✅ (Completed Dec 31, 2025)

Added new fundamental analysis tools:

- `get_financials_deep` - Income statement, balance sheet, cash flow
- `get_institutional_holdings` - 13F data from Yahoo Finance
- `get_unusual_options_activity` - Signals from Supabase database

**Removed Tools**:

- `analyze_position` - Removed (too specific to spread strategy)
- `scan_for_opportunities` - Removed (not generally useful)

### Phase 12b: Rate Limiting & Architecture Optimization ✅ (Dec 31, 2025)

**Rate Limiting**:

- `rateLimitedRequest()` - Wrapper with exponential backoff (4 retries)
- 1.5s minimum delay between API requests
- 3s/6s/12s/24s backoff on rate limit errors
- Sequential execution instead of `Promise.all` for multiple calls
- Singleton Yahoo Finance instance to reuse auth cookies
- `clearYahooCache()` - Function to reset if persistently rate limited

**Architecture Optimization** - Reduced API calls from 15+ to ~6-7 per ticker:

| Before                                            | After                                     |
| ------------------------------------------------- | ----------------------------------------- |
| Options chain fetched 4x (IV, spreads, PFV, flow) | Options chain fetched **once** and shared |
| ~15+ API calls per ticker                         | ~6-7 API calls per ticker                 |

Key changes:

- `getIVFromChain()` - Extract IV from pre-fetched chain (no API call)
- `findSpreadWithAlternatives()` - Accepts optional `preloadedChain` param
- Options flow calculated from existing chain data
- `fetchTickerData()` fetches chain once and passes to all analyzers

**API Call Breakdown** (per ticker):

1. `quote` - Price, basic info
2. `quoteSummary` - Fundamentals, analyst ratings, earnings
3. `chart` - Historical data for RSI/ADX
4. `search` - News
5. `chart` (SPY) - Relative strength comparison
6. `options` - Chain for IV, flow, spreads (fetched ONCE)

### Phase 12c: Polygon.io Fallback ✅ (Dec 31, 2025)

Added Polygon.io as fallback when Yahoo Finance rate limits:

- Auto-detects 429 errors and switches to Polygon
- 5 minute cooldown before retrying Yahoo
- Free tier: 5 calls/min, EOD data, 2 years history

**Environment Variable**: `POLYGON_API_TOKEN` (in root `.env`)

**Polygon Data** (free tier limitations):

- End of day prices (not real-time)
- Historical data for RSI, support/resistance
- News headlines
- Market cap, sector info
- NO options data (Yahoo-only feature)

### Phase 12d: Cloudflare Worker Proxy ✅ (Jan 2, 2026)

Added Cloudflare Worker to proxy Yahoo Finance requests, bypassing IP-based
rate limiting. Yahoo aggressively blocks residential IPs and cloud provider
IPs (Vercel, AWS, etc.) after heavy usage.

**Solution**: Route Yahoo Finance requests through Cloudflare's massive IP pool.
The worker uses the `yahoo-finance2` library directly, which handles all the
complex cookie/crumb authentication that Yahoo requires.

**Environment Variable**: `YAHOO_PROXY_URL`

**Required Setup for both CLI and Frontend**:

- CLI: Add to root `.env`: `YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev`
- Frontend: Add to `frontend/.env.local`: `YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev`

**New Files**:

- `cloudflare/` - Cloudflare Worker project
  - `src/index.ts` - Worker code (uses `yahoo-finance2` library)
  - `wrangler.toml` - Cloudflare config with `nodejs_compat` flag
  - `package.json` - Dependencies including `yahoo-finance2`
  - `README.md` - Setup instructions
  - `tests/` - Integration tests
- `lib/ai-agent/data/yahoo-proxy.ts` - Proxy client (handles `yahoo-finance2` response format)

**Data Flow (Priority Order)**:

```
fetchTickerData(ticker)
├── 1. if YAHOO_PROXY_URL set → use Cloudflare Worker proxy
├── 2. if yahooRateLimited → use Polygon fallback
├── 3. try direct Yahoo Finance
│      └── on 429 → fall back to Polygon
└── return data (from whichever source succeeds)
```

**Worker Endpoints**:
| Endpoint | Requests | Description |
|----------|----------|-------------|
| `GET /ticker/:symbol` | **1** | **RECOMMENDED** - All data in one request |
| `GET /quote/:ticker` | 1 | Stock quote only |
| `GET /chart/:ticker` | 1 | Historical OHLCV only |
| `GET /options/:ticker` | 1 | Options chain only |
| `GET /summary/:ticker` | 1 | Detailed summary only |
| `GET /search?q=TICKER` | 1 | Search/news only |
| `GET /health` | 1 | Health check |

**Request Efficiency**:

- Old approach: 5 requests per ticker (quote + chart + summary + options + search)
- New approach: 1 request per ticker via `/ticker/:symbol`
- **5x improvement** in Cloudflare request usage

**Clean Response Format** (Jan 2, 2026):
The combined endpoint returns focused data for AI analysis - no noise:

```json
{
  "ticker": "AAPL",
  "elapsed_ms": 233,
  "quote": { "price", "change", "changePct", "marketCap", "peRatio", ... },
  "chart": { "dataPoints": 64, "quotes": [{ "date", "close", ... }] },
  "earnings": { "date": "2026-01-30", "daysUntil": 28 },
  "analysts": { "strongBuy", "buy", "hold", "sell", "total", "bullishPct" },
  "shortInterest": { "shortRatio", "shortPctFloat" },
  "options": { "atmIV", "pcRatioVol", "pcRatioOI", "callVolume", ... },
  "news": [{ "title", "source", "link", "date" }]
}
```

Removed: thumbnails, uuids, widths/heights, individual contract details, etc.

**Setup**:

```bash
cd cloudflare
bun install
npx wrangler login
bun run deploy
# Returns URL like: https://yahoo-proxy.your-subdomain.workers.dev
```

**Post-Deploy Configuration**:

```bash
# For CLI (ai-analyst)
echo "YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev" >> ../.env

# For Frontend
echo "YAHOO_PROXY_URL=https://yahoo-proxy.xxx.workers.dev" >> ../frontend/.env.local
```

**Benefits**:

- Free tier: 100k requests/day
- Cloudflare's IP pool rarely blocked by Yahoo
- Works for both CLI and Frontend
- Uses `yahoo-finance2` library for proper auth handling
- Falls back to Polygon if proxy fails

**Important**: Both CLI and Frontend need `YAHOO_PROXY_URL` in their respective env files:

- CLI: Root `.env`
- Frontend: `frontend/.env.local`

### Phase 12e: Response Format Compatibility ✅ (Jan 2, 2026)

Fixed parsing issues between raw Yahoo API format and `yahoo-finance2` library format:

| Field         | Raw API Format                | yahoo-finance2 Format     |
| ------------- | ----------------------------- | ------------------------- |
| Earnings Date | `{ raw: unixTimestamp }`      | Date object or ISO string |
| Short Ratio   | `{ raw: number }`             | Direct number             |
| Chart Data    | `indicators.quote[0].close[]` | `quotes[].close`          |
| News Date     | Unix timestamp (seconds)      | Date object or string     |

The proxy client (`yahoo-proxy.ts`) now handles all formats gracefully with fallbacks.

Also fixed `optionsFlow` field naming to use consistent `pcRatioOI`/`pcRatioVol`
structure across both proxy and direct Yahoo paths.

**Debug Tool**: Added `cloudflare/scripts/debug-endpoint.mjs` for printing raw
worker responses (requires `YAHOO_PROXY_URL` environment variable):

```bash
cd cloudflare
bun run debug AAPL           # Combined endpoint (default, most efficient)
bun run debug TSLA ticker    # Same as above (explicit)
bun run debug NVDA quote     # Quote only
bun run debug RIVN options   # Options only
```

**Note**: Local development not supported due to `yahoo-finance2` compatibility
issues with Wrangler's local environment. Always test against production worker.

### Phase 13: TOON Context Builder (Optional)

Move `ai-analyst/src/context/toon.ts` to `lib/ai-agent/context/`:

- TOON encoding functions
- Context building utilities
- History summarization

**Note**: Has CLI-specific dependencies. Consider only if
frontend needs full context building.

## Benefits Achieved

| Benefit              | Description                                     |
| -------------------- | ----------------------------------------------- |
| **Consistency**      | Same Xylo personality across platforms          |
| **Iteration Speed**  | Test in CLI, changes auto-available in frontend |
| **Type Safety**      | Shared TypeScript interfaces                    |
| **Maintainability**  | One source of truth in lib/ai-agent             |
| **No Sync Required** | Direct imports with turbopack.root              |

## Files Changed

### New Files

- `lib/ai-agent/index.ts`
- `lib/ai-agent/classification.ts`
- `lib/ai-agent/package.json` - Dependencies for shared lib
- `lib/ai-agent/prompts/index.ts`
- `lib/ai-agent/prompts/xylo.ts`
- `lib/ai-agent/tools/index.ts`
- `lib/ai-agent/tools/definitions.ts`
- `lib/ai-agent/data/index.ts`
- `lib/ai-agent/data/types.ts` - TickerData interface
- `lib/ai-agent/data/yahoo.ts` - Yahoo Finance data fetching
- `lib/ai-agent/data/yahoo-proxy.ts` - Cloudflare Worker proxy client
- `lib/ai-agent/data/polygon.ts` - Polygon.io fallback
- `lib/ai-agent/data/formatters.ts` - AI formatting
- `lib/ai-agent/handlers/index.ts` - Tool execution
- `lib/ai-agent/toon/index.ts` - TOON encoding for ticker data
- `cloudflare/` - Cloudflare Worker for Yahoo proxy (uses yahoo-finance2)
- `docs/ai-agent/INTEGRATION_PLAN.md`
- `docs/ai-agent/SHARED_LIBRARY.md`
- `docs/ai-agent/DATA_PARITY.md` - CLI vs Frontend data analysis

### Modified Files

- `ai-analyst/src/commands/chat.ts` - Uses shared lib
- `frontend/src/app/api/chat/route.ts` - Uses shared lib + tool calling
- `frontend/src/components/chat/chat-panel.tsx` - Passes tool data
- `frontend/src/components/chat/chat-messages.tsx` - Renders tool cards
- `frontend/next.config.js` - Added turbopack.root
- `frontend/tsconfig.json` - Added @lib/\* path alias
- `frontend/package.json` - Added yahoo-finance2 dep
- `lib/README.md` - Added ai-agent docs
- `docs/README.md` - Added shared library section

### New Frontend Components

- `frontend/src/components/chat/ticker-data-card.tsx` - Data card UI

## AI SDK 3.x Migration Notes

The frontend uses `@ai-sdk/react` v3.x which has a different API than earlier versions:

### Transport-Based Configuration

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const transport = useMemo(
  () =>
    new DefaultChatTransport({
      api: '/api/chat',
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
sendMessage({ text: input }); // ✅ Correct
sendMessage({ content: input }); // ❌ Old API
```

### Data Streaming

The `data` prop is no longer available directly from `useChat`.
To display tool calls, use the `onData` callback or inspect message parts:

```typescript
useChat({
  onData: (data) => {
    // Handle tool events
  },
});
```
