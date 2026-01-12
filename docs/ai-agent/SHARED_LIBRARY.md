# AI Agent Shared Library

**Location**: `lib/ai-agent/`  
**Status**: Active  
**Updated**: January 8, 2026

## Overview

The AI Agent shared library provides common components for building AI
trading assistants that work across different runtime environments. Both
the CLI (ai-analyst) and Frontend (portfolio website) use this library
to ensure consistent behavior and reduce code duplication.

## Directory Structure

```
lib/ai-agent/
├── index.ts              # Main exports
├── classification.ts     # Question classification
├── package.json          # Dependencies (yahoo-finance2, @toon-format/toon)
├── cache/
│   └── index.ts          # Session-level caching with TTL
├── prompts/
│   ├── index.ts          # Prompt exports
│   └── victor.ts         # Victor Chen persona
├── tools/
│   ├── index.ts          # Tool exports
│   └── definitions.ts    # Tool schemas
├── data/
│   ├── index.ts          # Data exports
│   ├── types.ts          # TickerData interface
│   ├── yahoo.ts          # Yahoo Finance fetching
│   ├── yahoo-proxy.ts    # Cloudflare Worker proxy integration
│   └── formatters.ts     # AI-friendly formatting
├── handlers/
│   └── index.ts          # Tool execution handlers
├── market/
│   ├── index.ts          # Market regime detection (VIX, SPY, sectors)
│   ├── chop-index.ts     # Chop/ATR/ADX indicators
│   ├── no-trade-regime.ts # Trading regime analysis
│   └── market-breadth.ts # Market breadth indicators
├── pfv/
│   └── index.ts          # Psychological Fair Value calculation
├── options/
│   ├── spreads.ts        # Spread recommendations
│   └── types.ts          # Options-related types
└── toon/
    └── index.ts          # TOON encoding for token efficiency
```

## Components

### 1. Victor Prompts (`prompts/`)

Victor Chen is our AI trading analyst persona - a 67-year-old Wall
Street veteran with 45 years of experience. The prompts module provides
different versions for different use cases:

#### `buildVictorSystemPrompt(config)`

Full system prompt with all context. Used by CLI for comprehensive
analysis.

```typescript
import { buildVictorSystemPrompt } from 'lib/ai-agent';

const prompt = buildVictorSystemPrompt({
  accountSize: 1750,
  context: '... TOON data and calendar ...',
  includeToonSpec: true,
});
```

#### `buildVictorLitePrompt(config?)`

Lightweight prompt for frontend chat. Same persona, less context
overhead.

```typescript
import { buildVictorLitePrompt } from 'lib/ai-agent';

const prompt = buildVictorLitePrompt({ accountSize: 1500 });
```

#### `buildVictorMinimalPrompt()`

Ultra-minimal prompt for quick responses.

```typescript
import { buildVictorMinimalPrompt } from 'lib/ai-agent';

const prompt = buildVictorMinimalPrompt();
```

### 2. Tool Definitions (`tools/`)

SDK-agnostic tool schemas that can be converted to different formats.

#### Tool Collections

```typescript
import { AGENT_TOOLS, RESEARCH_TOOLS, BASIC_TOOLS } from 'lib/ai-agent';

// All tools
AGENT_TOOLS; // web_search, get_ticker_data, scan, analyze_position

// For research queries
RESEARCH_TOOLS; // web_search, get_ticker_data, analyze_position

// For basic queries
BASIC_TOOLS; // web_search, get_ticker_data
```

#### Ollama Conversion

```typescript
import { AGENT_TOOLS, toOllamaTools } from 'lib/ai-agent';

const ollamaTools = toOllamaTools(AGENT_TOOLS);
// Use with Ollama SDK
```

#### Individual Tools

```typescript
import {
  WEB_SEARCH_TOOL,
  GET_TICKER_DATA_TOOL,
  SCAN_OPPORTUNITIES_TOOL,
  ANALYZE_POSITION_TOOL,
} from 'lib/ai-agent';
```

### 3. Data Fetching (`data/`)

Shared data fetching and formatting for ticker analysis. Works in both
CLI and Frontend environments.

#### Fetch Ticker Data

```typescript
import { fetchTickerData } from 'lib/ai-agent';

const data = await fetchTickerData('AAPL');
// Returns TickerData with price, RSI, ADX, MAs, fundamentals, etc.
```

#### Format for AI

```typescript
import {
  formatTickerDataForAI,
  formatSearchResultsForAI,
  formatTickerSummary,
} from 'lib/ai-agent';

// Full format for AI context
const formatted = formatTickerDataForAI(tickerData);
// Returns:
// === AAPL DATA ===
// Price: $150.00 (+1.5%)
// RSI: 55.2
// MA200: $145.00 (ABOVE ✓)
// ...

// One-line summary
const summary = formatTickerSummary(tickerData);
// "AAPL · $150.00 · +1.5% · RSI 55 · ↑MA200 · Grade: B+"
```

### 4. Tool Handlers (`handlers/`)

Shared tool execution logic for CLI and Frontend.

#### Execute Tool Calls

```typescript
import { executeToolCall } from 'lib/ai-agent';

const result = await executeToolCall({
  name: 'get_ticker_data',
  arguments: { ticker: 'NVDA' },
});

// Returns:
// {
//   success: true,
//   data: { ticker: 'NVDA', price: 130.50, ... },
//   formatted: '=== NVDA DATA ===\nPrice: $130.50 ...'
// }
```

#### Individual Handlers

```typescript
import {
  handleGetTickerData,
  handleWebSearch,
  handleAnalyzePosition,
} from 'lib/ai-agent';

// Ticker data
const tickerResult = await handleGetTickerData({ ticker: 'MSFT' });

// Web search (requires search function injection)
const searchResult = await handleWebSearch(
  { query: 'NVDA AI chip news' },
  mySearchFunction
);

// Position analysis
const positionResult = await handleAnalyzePosition({
  ticker: 'AMD',
  longStrike: 120,
  shortStrike: 130,
  costBasis: 2.5,
  dte: 14,
});
```

### 5. Question Classification (`classification.ts`)

Smart classification to optimize context loading and reduce
unnecessary API calls.

```typescript
import { classifyQuestion, extractTickers } from 'lib/ai-agent';

const result = classifyQuestion('How does NVDA look for a trade?');
// {
//   type: 'trade_analysis',
//   needsOptions: true,
//   needsNews: true,
//   needsWebSearch: false,
//   needsCalendar: true,
//   needsHistory: true,
//   tickers: ['NVDA']
// }

const tickers = extractTickers('Looking at AAPL and MSFT today');
// ['AAPL', 'MSFT']
```

#### Question Types

| Type             | Description               | Context Needed          |
| ---------------- | ------------------------- | ----------------------- |
| `price_check`    | Simple price queries      | Minimal                 |
| `trade_analysis` | Full trade evaluation     | Options, News, Calendar |
| `research`       | News/why questions        | Web Search              |
| `scan`           | Market scanning           | Full scanner            |
| `position`       | Existing position queries | Position tool           |
| `general`        | Conversation              | Calendar only           |

## Usage Examples

### CLI (ai-analyst)

```typescript
// ai-analyst/src/commands/chat.ts
import {
  buildVictorSystemPrompt,
  AGENT_TOOLS,
  toOllamaTools,
  classifyQuestion,
} from '../../../lib/ai-agent';

// Classify question to optimize data fetching
const classification = classifyQuestion(userMessage);

// Build context based on classification
const context = await buildContext(classification);

// Create system prompt
const systemPrompt = buildVictorSystemPrompt({
  accountSize: 1750,
  context,
  includeToonSpec: true,
});

// Get tools in Ollama format
const tools = toOllamaTools(AGENT_TOOLS);

// Use with Ollama
const response = await ollama.chat({
  model: 'deepseek-r1:32b',
  messages: [{ role: 'system', content: systemPrompt }, ...messages],
  tools,
});
```

### Frontend (portfolio)

Direct imports work thanks to `turbopack.root` configuration in Next.js 16.

```typescript
// frontend/src/app/api/chat/route.ts
import {
  buildVictorLitePrompt,
  BASIC_TOOLS,
  toOllamaTools,
  executeToolCall,
} from '@lib/ai-agent';

// System prompt
const systemPrompt = buildVictorLitePrompt({ accountSize: 1500 });

// Tool definitions
const ollamaTools = toOllamaTools(BASIC_TOOLS);

// In streaming handler - execute tool calls
if (pendingToolCalls.length > 0) {
  for (const tc of pendingToolCalls) {
    const result = await executeToolCall({
      name: tc.function.name,
      arguments: tc.function.arguments,
    });

    // Add result to conversation
    messages.push({
      role: 'tool',
      content: result.formatted || result.error,
    });
  }
}
```

**Configuration**:

- Build uses `turbopack.root` in `next.config.js`
- Dev uses `--webpack` flag with webpack alias
- See `frontend/next.config.js` for dual configuration

## Data Module (`lib/ai-agent/data/`)

**Important**: All formatters use `safeFixed()` helper to prevent `.toFixed()`
errors on undefined values. This ensures robust handling of partial data.

The data module provides comprehensive ticker data fetching with Yahoo Finance:

### fetchTickerData(ticker)

Returns a `TickerData` object with:

| Field                               | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `price`, `change`, `changePct`      | Current price and movement               |
| `rsi`, `adx`, `trendStrength`       | Technical indicators                     |
| `ma20`, `ma50`, `ma200`             | Moving averages                          |
| `aboveMA200`                        | Trend direction                          |
| `marketCap`, `peRatio`, `forwardPE` | Fundamentals                             |
| `analystRatings`                    | Bullish %, breakdown by rating           |
| `targetPrices`                      | Low/mean/high targets, upside %          |
| `earningsDays`, `earningsWarning`   | Earnings calendar                        |
| `iv`                                | IV, HV20, premium assessment             |
| `shortInterest`                     | Short %, days to cover                   |
| `support`, `resistance`             | S/R from recent lows/highs               |
| `performance`                       | 1d, 5d, 1m returns                       |
| `news`                              | Recent headlines (3 max)                 |
| `spread`                            | Suggested spread, cushion, PoP           |
| `grade`                             | Trade grade (A-D), score, recommendation |
| `dataQuality`                       | Staleness warning                        |

```typescript
import { fetchTickerData, formatTickerDataForAI } from '@lib/ai-agent';

const data = await fetchTickerData('NVDA');
const formatted = formatTickerDataForAI(data); // AI-friendly string
```

## Building Blocks

For advanced customization, individual prompt components are exported:

```typescript
import {
  VICTOR_PERSONA,
  TRADING_STRATEGY,
  TOON_DECODER_SPEC,
  TOOL_INSTRUCTIONS,
  POSITION_ANALYSIS_INSTRUCTIONS,
  DATA_RULES,
  RESPONSE_STYLE,
  buildKeyRules,
} from 'lib/ai-agent';

// Custom prompt with selected components
const customPrompt = `${VICTOR_PERSONA}
${TRADING_STRATEGY}
${buildKeyRules(2000)}
${RESPONSE_STYLE}`;
```

## Development Workflow

1. **Edit** `lib/ai-agent/prompts/victor.ts` to update Victor's behavior
2. **Test** locally using CLI: `cd ai-analyst && bun run chat`
3. **Changes** automatically available in Frontend (same import)
4. **Deploy** frontend to see changes in production

## Type Safety

Full TypeScript support with exported types:

```typescript
import type {
  // Prompt types
  VictorPromptConfig,
  VictorLiteConfig,

  // Tool types
  AgentTool,
  OllamaTool,
  ToolParameter,
  ToolCall,
  ToolExecutorOptions,
  ToolResult,
  TickerToolResult,
  SearchToolResult,

  // Data types
  TickerData,
  SpreadRecommendation,
  IVAnalysis,
  TradeGrade,
  NewsItem,
  AnalystRatings,
  TargetPrices,
  SearchResult,

  // Classification types
  QuestionType,
  QuestionClassification,
} from 'lib/ai-agent';
```

## TOON Encoding (`toon/`)

**TOON (Token-Oriented Object Notation)** is a critical shared component.

### Why TOON?

From benchmarks ([toonformat.dev](https://toonformat.dev)):

- **40% fewer tokens** than JSON
- **74% LLM accuracy** vs JSON's 70%
- Perfect for **uniform arrays** (ticker data, scan results)
- YAML-like, self-documenting format

Both CLI and Frontend should use TOON for maximum efficiency.

### Available Encoders

```typescript
import {
  // Single ticker (full details)
  encodeTickerToTOON,

  // Multiple tickers (tabular format - most efficient)
  encodeTickerTableToTOON,

  // Market regime
  encodeMarketRegimeToTOON,

  // Scan results
  encodeScanResultsToTOON,

  // Search results
  encodeSearchToTOON,

  // Generic encoder
  encodeTOON,

  // For system prompts
  getTOONDecoderSpec,
} from 'lib/ai-agent';
```

### Example: Ticker Data

```typescript
const data = await fetchTickerData('NVDA');
const toon = encodeTickerToTOON(data);
```

Output (compact, token-efficient):

```yaml
ticker: NVDA
price: 130.50
change: +2.1%
rsi: 55
mas:
  ma200: 125
  ma50: 128
vol:
  iv: 45%
  hv20: 38%
  premium: fair
flow:
  pcOI: 0.65
  sentiment: bullish
rs:
  vsSPY: +5.2%
  trend: outperforming
```

### Example: Multiple Tickers (Tabular)

For scanning multiple tickers, use the tabular format:

```typescript
const tickers = await Promise.all(
  ['NVDA', 'AAPL', 'MSFT'].map((t) => fetchTickerData(t))
);
const toon = encodeTickerTableToTOON(tickers);
```

Output (TOON's most efficient format):

```yaml
tickers[3]{ticker,price,changePct,rsi,grade,flowSentiment}:
  NVDA,130.50,2.1,55,A,bullish
  AAPL,175.20,0.8,48,B+,neutral
  MSFT,410.30,-0.5,42,B,bearish
```

### Example: Market Regime

```typescript
const regime = await getMarketRegime();
const toon = encodeMarketRegimeToTOON(regime);
```

Output:

```yaml
regime: RISK_ON
vix:
  current: 14.5
  level: calm
  change: -2.1%
spy:
  price: $585
  trend: bullish
  aboveMA200: true
sectors[3]:
  - name: Technology, change: +1.2%, momentum: leading
  - name: Healthcare, change: +0.5%, momentum: neutral
  - name: Energy, change: -0.8%, momentum: lagging
recommendation: Favorable for CDS entries...
```

### System Prompt Integration

Add TOON spec to system prompts (minimal - format is self-documenting):

```typescript
const systemPrompt = `${basePrompt}\n\n${getTOONDecoderSpec()}`;
```

### Output Format Selection

Tool handlers support `'text'` or `'toon'` formats:

```typescript
import { executeToolCall } from 'lib/ai-agent';

// Default: TOON (token-efficient)
const result = await executeToolCall({
  name: 'get_ticker_data',
  arguments: { ticker: 'NVDA' },
});

// Explicit text format (human-readable)
const result = await executeToolCall(
  {
    name: 'get_ticker_data',
    arguments: { ticker: 'NVDA' },
  },
  { format: 'text' }
);
```

## Web Search Integration

The library uses **Ollama's native web search API** for real-time
information retrieval. This requires an `OLLAMA_API_KEY`.

### Token Optimization

Web search results are **limited to save tokens**:

- **Max 3 results** (not 5+)
- **Snippets truncated** to 300 chars
- **Total content capped** at ~2KB

```typescript
import { handleWebSearch, ollamaWebSearch } from 'lib/ai-agent';

// Direct API usage (max 3 results)
const results = await ollamaWebSearch('NVDA latest news', apiKey);

// Via handler (uses OLLAMA_API_KEY env var)
const result = await handleWebSearch(
  { query: 'NVDA latest news' },
  { apiKey: process.env.OLLAMA_API_KEY }
);
```

### API Endpoint

```
POST https://ollama.com/api/web_search
Authorization: Bearer $OLLAMA_API_KEY

{
  "query": "search query",
  "max_results": 3  // Limited for token efficiency
}
```

### Response Format

```typescript
interface SearchResult {
  title: string; // Truncated to 100 chars
  url: string;
  snippet: string; // Truncated to 300 chars
}
```

## Data Cards UI (Frontend)

Tool results are embedded in streamed responses using markers that the
frontend extracts and displays as rich cards.

### How It Works

1. **API Route** embeds tool data in stream:

   ```typescript
   const marker = `<!--TOOL:get_ticker_data:${JSON.stringify(data)}:TOOL-->`;
   writer.write({ type: 'text-delta', delta: marker });
   ```

2. **Chat Message** extracts and renders:

   ```typescript
   const TOOL_MARKER_REGEX = /<!--TOOL:(\w+):(.+?):TOOL-->/g;

   const { cleanContent, tools } = extractToolData(rawContent);
   const tickerCards = tools
     .filter((t) => t.tool === 'get_ticker_data')
     .map((t) => t.data as TickerData);
   ```

3. **TickerDataCard** displays:
   - Price, change, RSI, ADX
   - Moving averages (20/50/200)
   - Market cap, P/E, sector
   - Analyst ratings and targets
   - Earnings countdown
   - Spread recommendations
   - Trade grade

### Component: `TickerDataCard`

```typescript
import { TickerDataCard } from "@/components/chat/ticker-data-card";
import type { TickerData } from "@lib/ai-agent";

<TickerDataCard data={tickerData} />
```

## Market Regime (`market/`)

**NEW - December 28, 2025**

Shared market regime detection providing VIX awareness, SPY trend analysis,
and sector rotation tracking. Same logic as CLI.

### Get Full Market Regime

```typescript
import { getMarketRegime, formatRegimeForAI } from 'lib/ai-agent';

const regime = await getMarketRegime();
// {
//   regime: 'RISK_ON',
//   vix: { current: 14.5, level: 'CALM', ... },
//   spy: { price: 585, trend: 'BULLISH', aboveMA200: true, ... },
//   sectors: [{ name: 'Technology', changePct: 1.2, ... }, ...],
//   tradingRecommendation: 'Favorable for CDS entries...',
// }

const aiContext = formatRegimeForAI(regime);
// "REGIME: RISK_ON\nVIX: 14.5 (CALM)\nSPY: $585 BULLISH ↑MA200\n..."
```

### Individual Data Fetchers

```typescript
import { getVIXData, getSPYTrend, getSectorPerformance } from 'lib/ai-agent';

const vix = await getVIXData();
// { current: 14.5, level: 'CALM', description: 'Low fear...' }

const spy = await getSPYTrend();
// { price: 585, trend: 'BULLISH', aboveMA50: true, aboveMA200: true }

const sectors = await getSectorPerformance();
// [{ ticker: 'XLK', name: 'Technology', changePct: 1.2, momentum: 'LEADING' }]
```

### Regime Types

| Regime     | Condition             | Trading Recommendation |
| ---------- | --------------------- | ---------------------- |
| `RISK_ON`  | Low VIX + Bullish SPY | Favorable for entries  |
| `RISK_OFF` | Bearish SPY           | Reduce exposure        |
| `HIGH_VOL` | VIX > 20              | Smaller positions      |
| `NEUTRAL`  | Mixed signals         | Grade A setups only    |

## Rich Data Fields

**NEW - December 28, 2025**

The `TickerData` object now includes additional fields matching CLI:

### Options Flow

```typescript
data.optionsFlow = {
  pcRatioOI: 0.65, // Put/Call by open interest
  pcRatioVol: 0.58, // Put/Call by volume
  sentiment: 'bullish', // bullish | neutral | bearish
};
```

### Relative Strength

```typescript
data.relativeStrength = {
  vsSPY: 5.2, // % outperformance vs SPY (30d)
  trend: 'outperforming', // outperforming | inline | underperforming
};
```

### Earnings History

```typescript
data.earnings = {
  date: 'Jan 15',
  daysUntil: 18,
  streak: 4, // Positive = consecutive beats
  lastSurprise: 8.5, // Last EPS surprise %
  avgSurprise: 6.2, // Average over 4 quarters
};
```

### Sector Context

```typescript
data.sectorContext = {
  name: 'Technology',
  avgPE: 28, // Sector average P/E
  vsAvg: 15, // Ticker P/E vs sector avg (%)
};
```

## Session Cache (`cache/`)

**NEW - January 8, 2026**

In-memory caching system with TTL support to reduce redundant API calls.

### Usage

```typescript
import { sessionCache, CacheKeys, CACHE_TTL } from 'lib/ai-agent';

// Get or fetch with automatic caching
const data = await sessionCache.getOrFetch(
  CacheKeys.ticker('NVDA'),
  () => fetchTickerData('NVDA'),
  CACHE_TTL.TICKER
);

// Manual cache operations
sessionCache.set('custom:key', value, 60000); // 60 second TTL
const cached = sessionCache.get<MyType>('custom:key');
sessionCache.invalidate('custom:key');

// Stats
const stats = sessionCache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Cache Keys & TTLs

| Key              | TTL    | Description               |
| ---------------- | ------ | ------------------------- |
| `ticker:{NVDA}`  | 60s    | Price/technicals change   |
| `regime`         | 5 min  | VIX/SPY relatively stable |
| `pfv:{NVDA}`     | 5 min  | Expensive calculation     |
| `options:{NVDA}` | 2 min  | More volatile             |
| `trades`         | 30 min | Rarely changes            |
| `web:{query}`    | 10 min | Search results            |

### What's Cached

- ✅ Ticker data (`fetchTickerData`) - 60s TTL
- ✅ Market regime (`getMarketRegime`) - 5 min TTL
- ✅ PFV calculations (`getPsychologicalFairValue`) - 5 min TTL

---

## CLI Uses Shared Library

**IMPORTANT - January 8, 2026**

The CLI (`ai-analyst`) now uses the shared library for market regime detection
instead of its own implementation. This ensures consistent behavior across
CLI and Frontend.

```typescript
// ai-analyst/src/services/market-regime.ts
// Simply re-exports from shared library
export {
  type MarketRegime,
  getMarketRegime,
  formatRegimeForAI,
  getRegimeBadge,
} from '../../../lib/ai-agent/market/index';
```

---

## Future Enhancements

- [x] Move TOON encoder to `lib/ai-agent/toon/` ✅ (December 2025)
- [x] Add tool handlers for frontend ✅ (done via `lib/ai-agent/handlers/`)
- [x] Ollama native web search ✅ (December 2025)
- [x] Data Cards UI ✅ (December 2025)
- [x] Token optimization for web search ✅ (December 2025)
- [x] Market regime service ✅ (December 28, 2025)
- [x] Options flow (P/C ratio) ✅ (December 28, 2025)
- [x] Relative strength vs SPY ✅ (December 28, 2025)
- [x] Earnings beat/miss history ✅ (December 28, 2025)
- [x] Sector P/E comparison ✅ (December 28, 2025)
- [x] Direct monorepo import ✅ (achieved via `turbopack.root`)
- [x] Session cache with TTL ✅ (January 8, 2026)
- [x] CLI uses shared market regime ✅ (January 8, 2026)
- [x] PFV integrated into proxy path ✅ (January 8, 2026)
- [ ] Move full TOON context builder (trade history, patterns)
- [ ] Add conversation summarization
- [ ] Scanner service (quickScan, fullScan)
- [ ] Economic calendar warnings
