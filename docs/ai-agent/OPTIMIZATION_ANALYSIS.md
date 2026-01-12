# AI Agent CLI - Optimization Analysis

**Status**: Implementation Complete ✅  
**Last Updated**: January 8, 2026

## Latest Updates (Jan 8, 2026)

### Streaming Responses

- Added `-s, --stream` flag to chat command
- Final synthesis responses can now stream for better UX
- Word-wrapping applied during streaming for clean output

### Quality Metrics Display

After each response, the CLI now shows:

- Token efficiency (output/input ratio)
- Cache hit rate (from `sessionCache.getStats()`)
- Tool execution time breakdown
- AI inference time (separate from tool time)

### Debug Mode Logging

- Added `DEBUG=true` environment variable support
- Verbose logs (cache misses, proxy calls, etc.) only show in debug mode
- New logger utility: `lib/ai-agent/utils/logger.ts`
- All operational logs converted from `console.log` to `log.debug`

### TOON Encoding for All Tool Responses (Jan 8, 2026)

Tool responses now use TOON format for ~40% token reduction:

- `web_search` → `libEncodeSearchToTOON()`
- `get_ticker_data` → `libEncodeTickerToTOON()` (shared lib)
- `get_trading_regime` → `formatTradingRegimeTOON()`

**Still using verbose format** (structured data that doesn't fit TOON):

- `get_financials_deep` - Income/Balance/Cash flow statements
- `get_institutional_holdings` - Top holders list
- `get_unusual_options_activity` - Options signals table

### News Skip for Simple Questions

- `needsNews` classification flag already prevents news in context
- Simple price checks skip news entirely (via `classification.needsNews`)

---

### Previous: VIX Proxy URL Decoding

- Fixed `decodeURIComponent` in Cloudflare worker to handle `%5EVIX` → `^VIX`
- All market data (VIX, SPY, sectors) now fetches via proxy successfully

### Previous: Options Chain Caching (Jan 8, 2026)

- Added 2-minute TTL caching to `getOptionsChain()` in `lib/ai-agent/options/chain.ts`
- Eliminates duplicate options fetches when both PFV and spreads need chain data
- Cache key format: `options:{SYMBOL}:{DTE}` (e.g., `options:AMD:30`)

### Startup Regime Passthrough (Jan 8, 2026)

- **BOTH** `getMarketRegime()` AND `analyzeTradingRegime()` fetched at startup
- Full trading regime (GO/CAUTION/NO_TRADE with breadth, confidence) in AI context
- Context includes: `=== TRADING REGIME (pre-loaded - DO NOT call get_trading_regime) ===`
- AI no longer needs to call `get_trading_regime` tool
- Saves 1 tool call + 3 API requests (VIX, SPY, sectors) per question

### Additional Optimizations (Jan 8, 2026)

**1. Sequential Startup Fetches**

- Changed from `Promise.all([fetchMarketRegime, analyzeTradingRegime])` to sequential
- First call populates cache, second uses it
- Eliminates duplicate VIX/SPY/sector fetches at startup

**2. Batch Sector Endpoint**

- Added `/batch-quotes?symbols=XLK,XLF,...` to Cloudflare proxy
- `getSectorPerformance()` now fetches all 8 sectors in 1 request
- Reduces startup latency by ~500ms

**3. Question Classification Extensions**

- Added `needsPFV`, `needsSpread`, `minimalTools` flags
- Different question types get optimized context/tools:
  - `price_check`: minimal tools, TOON regime format
  - `research`: web_search only, skip ticker data
  - `trade_analysis`: full tools and context
  - `general`: minimal tools

**4. TOON Regime Format**

- Created `formatTradingRegimeTOON()` for ~80% token reduction
- Format: `REGIME:GO|80%|VIX:15.45:N|SPY:B|BR:85%|STR:STRONG|→Risk-On`
- Used for simple questions, verbose format for trade analysis

**5. Dynamic Tool Selection**

- `FULL_TOOLS`: All 6 tools for trade analysis
- `MINIMAL_TOOLS`: Just `web_search` + `get_ticker_data` for simple queries
- Saves ~500 tokens per request for price checks

**6. PFV in Tool Response (Jan 8, 2026)**

- Fixed `formatTickerDataForAI()` to properly format PFV data
- Now shows: Fair Value, deviation %, bias, and confidence level
- PFV was showing in card but `undefined` in tool response

## Overview

This document identifies performance inefficiencies and quality improvements for
the AI Agent CLI (`ai-analyst`). The analysis covers data fetching, context
building, token usage, and the agent loop.

## ✅ Implemented Optimizations

### Session Cache System (`lib/ai-agent/cache/index.ts`)

A new TTL-based caching system has been implemented:

```typescript
import { sessionCache, CacheKeys, CACHE_TTL } from '@lib/ai-agent/cache';

// Get or fetch with automatic caching
const data = await sessionCache.getOrFetch(
  CacheKeys.ticker('NVDA'),
  () => fetchTickerData('NVDA'),
  CACHE_TTL.TICKER
);
```

**Cache TTLs:**

- `TICKER`: 60 seconds (price changes)
- `REGIME`: 5 minutes (VIX/SPY stable)
- `PFV`: 5 minutes (expensive calculation)
- `OPTIONS`: 2 minutes (more volatile)
- `TRADES`: 30 minutes (rarely changes)
- `WEB_SEARCH`: 10 minutes

**What's Cached:**

1. ✅ Ticker data (`fetchTickerData`) - 60s TTL
2. ✅ Market regime (`getMarketRegime`) - 5min TTL
3. ✅ PFV calculations (`getPsychologicalFairValue`) - 5min TTL

---

---

## 🔴 Critical Inefficiencies

### 1. **Duplicate Market Regime Fetching**

The market regime is fetched multiple times per session:

```
Location 1: startChat() header display
Location 2: buildContextForAI() for system prompt
Location 3: get_trading_regime tool call
```

**Impact**: 3 redundant API calls to Yahoo Finance for SPY/VIX data.

**Fix**: Implement session-level cache with 5-minute TTL.

---

### 2. **Full Context Rebuilt Every Turn**

`buildContextForAI()` runs on EVERY user message:

```typescript
// Lines 451-555 of chat.ts
async function buildContextForAI(accountSize: number): Promise<string> {
  // Fetches ALL of this every single turn:
  // - Date/time (fine)
  // - Market status (redundant)
  // - Market regime (API call)
  // - Calendar context (fine)
  // - ALL trades from database (expensive!)
  // - Pattern detection on all trades (CPU)
  // - TOON context building (CPU)
}
```

**Impact**: ~100-500ms latency per turn, unnecessary database queries.

**Fix**:

- Cache trade history once at session start
- Only rebuild if user mentions journal/history
- Use delta updates for changing data

---

### 3. **No Ticker Data Caching**

Every ticker lookup triggers 6+ API calls:

```
fetchTickerData(ticker):
├── sharedFetchTickerData() - quote, fundamentals, options
├── getEarningsInfo() - earnings calendar
├── getIVAnalysis() - options chain (redundant with above!)
├── calculateSupportResistance() - 1 year historical data
├── findOptimalSpread() - options chain (another fetch!)
└── getPsychologicalFairValue() - options chain x4 expirations!
```

**Impact**: A single ticker fetch can take 2-5 seconds and hit rate limits.

**Fix**:

- Implement 60-second in-memory cache per ticker
- Deduplicate options chain fetches
- Pass shared data between functions

---

### 4. **PFV Over-Calculation**

`getPsychologicalFairValue()` fetches 4 options expirations and does heavy
computation. It's called:

1. In `fetchTickerData()` for context
2. Potentially again via tool calls
3. Multiple times if same ticker mentioned twice

**Impact**: ~1-2 seconds per PFV calculation, multiple API calls.

**Fix**: Cache PFV results for 5 minutes (options data doesn't change rapidly).

---

### 5. **Scanner Sequential Processing**

The scanner processes tickers one-by-one with artificial delays:

```typescript
// Lines 310-338 of scanner.ts
for (let i = 0; i < tickers.length; i++) {
  const result = await scanTicker(ticker); // Wait for each
  await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay
}
```

**Impact**: 35 tickers × (200ms + fetch time) = ~20-40 seconds.

**Fix**:

- Use batched fetching (5-10 concurrent)
- Use `Promise.all` with concurrency limiter
- Rate limit at API level, not per-ticker

---

## 🟡 Moderate Inefficiencies

### 6. **Tool Calls Don't Use Prepared Context**

When prepareContext fetches ticker data, it's stored in `tickersFetched`.
But if the AI then calls `get_ticker_data` tool, it re-fetches everything.

**Impact**: Redundant API calls when AI decides to use tools.

**Fix**: Pass fetched data to tool executor, check cache first.

---

### 7. **System Prompt Size Grows Unbounded**

The system prompt includes:

- Victor persona (~500 tokens) - static
- Trading strategy (~200 tokens) - static
- Key rules (~100 tokens) - static
- TOON spec (~100 tokens) - static
- Calendar warnings (~50-200 tokens) - changes daily
- Full trade history (~200-2000 tokens) - rarely changes
- Ticker data (~300-1000 tokens per ticker) - per request

**Impact**: 2000-5000 tokens per request, mostly redundant.

**Fix**:

- Use conversation-level system prompt for static content
- Add dynamic content as user context, not system
- Compress trade history to rolling 10-day summary

---

### 8. **Web Search Returns Too Much Noise**

Current implementation returns up to 5 results with 300-char snippets each.
Results often include:

- Duplicate content from same source
- Irrelevant tangential matches
- Old/outdated information

**Impact**: 500-1500 tokens of potentially low-quality context.

**Fix**:

- Deduplicate by domain
- Rank by recency and relevance
- Summarize multiple results into single paragraph
- Limit to 2-3 high-quality results

---

### 9. **Conversation History Inefficient**

Current approach:

```typescript
// Summarize older turns (good)
if (conversationHistory.length > 4) {
  const olderHistory = conversationHistory.slice(0, -4);
  conversationContext = summarizeConversation(toonHistory);
}
// Keep last 4 full (can be large)
const recentHistory = conversationHistory.slice(-4);
```

**Problem**: If recent messages include full ticker data dumps, they're kept
verbatim even when stale.

**Fix**:

- Summarize assistant responses too (keep recommendation, drop data)
- Use sliding window with smart truncation
- Extract key facts, not full responses

---

### 10. **ADX/RSI Calculated Separately from Quote**

Technical indicators are calculated using separate historical data fetch:

```typescript
// In scanner.ts
const rsi = await calculateRSI(symbol); // Fetches 30d history

// But quote already has some technical data available
const quote = await yahooFinance.quote(symbol);
// quote.fiftyDayAverage, quote.twoHundredDayAverage exist
```

**Impact**: Redundant API call for historical data.

**Fix**: Use `quoteSummary` with modules: `['price', 'summaryDetail', 'financialData']`
to get everything in one call.

---

## 🟢 Quality Improvements

### 11. **Add Response Quality Scoring**

Currently no feedback loop on response quality. AI can hallucinate or give
vague answers without detection.

**Improvement**:

- Track if ticker data was in context when cited
- Detect if response cites numbers not in data
- Log quality metrics for iteration

---

### 12. **Smarter Question Classification**

Current regex-based classification misses nuanced cases:

- "What about NVDA?" (should use cached context)
- "Compare AAPL to MSFT" (needs both, but might skip cache)
- "Same for GOOGL" (reference to previous ticker)

**Improvement**:

- Track conversation context (previous tickers discussed)
- Use semantic similarity for ambiguous queries
- Support comparative analysis without double-fetch

---

### 13. **Add Data Freshness Indicators**

Users don't know if data is real-time or cached. Important during market hours.

**Improvement**:

- Show "data as of X" timestamp
- Warn if data >5 min old during market hours
- Option to force-refresh

---

### 14. **Streaming Response Metrics**

Current streaming doesn't show useful metrics during generation.

**Improvement**:

- Show tokens/sec during streaming
- Display thinking phase separately
- Show tool call latency breakdown

---

## Implementation Priority

| Priority | Item                              | Impact | Effort |
| -------- | --------------------------------- | ------ | ------ |
| 🔴 P0    | Ticker data cache                 | High   | Medium |
| 🔴 P0    | Deduplicate options chain fetches | High   | Low    |
| 🔴 P0    | Market regime session cache       | Medium | Low    |
| 🟡 P1    | Lazy context building             | High   | Medium |
| 🟡 P1    | Parallel scanner                  | Medium | Medium |
| 🟡 P1    | Tool/context cache sharing        | Medium | Medium |
| 🟢 P2    | Conversation summarization v2     | Low    | Medium |
| 🟢 P2    | Web search quality                | Low    | Medium |
| 🟢 P2    | Response quality scoring          | Low    | High   |

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Session Manager                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cache Layer (TTL-based)                                   │  │
│  │  • tickerCache: Map<ticker, {data, timestamp}> (60s TTL)  │  │
│  │  • regimeCache: {data, timestamp} (5min TTL)              │  │
│  │  • pfvCache: Map<ticker, {data, timestamp}> (5min TTL)    │  │
│  │  • tradeHistory: {data, timestamp} (session-level)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Data Fetcher (unified)                                    │  │
│  │  • fetchTickerData(ticker) → checks cache first           │  │
│  │  • fetchMarketRegime() → checks cache first               │  │
│  │  • Batched API calls with rate limiting                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Context Builder (incremental)                             │  │
│  │  • Static context (built once)                            │  │
│  │  • Dynamic context (per-request, uses cache)              │  │
│  │  • Conversation context (sliding window + summaries)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Tool Executor (cache-aware)                               │  │
│  │  • Checks session cache before API calls                  │  │
│  │  • Updates cache after fetches                            │  │
│  │  • Shares data with context builder                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estimated Impact

With implemented P0 optimizations:

| Metric                       | Before | After      | Improvement    |
| ---------------------------- | ------ | ---------- | -------------- |
| First ticker fetch           | 3-5s   | 2-3s       | 40% faster     |
| **Follow-up on same ticker** | 3-5s   | **<100ms** | **98% faster** |
| Market regime (cached)       | 2-3s   | <50ms      | 98% faster     |
| PFV calculation (cached)     | 2-4s   | <50ms      | 98% faster     |
| API calls per turn           | 6-12   | 1-4        | 70% fewer      |

**Key Win**: Follow-up questions about the same ticker now use cache.

---

## Remaining Optimizations (P1/P2)

Already implemented:

- ✅ `SessionCache` class with TTL support
- ✅ Ticker data caching (60s TTL)
- ✅ Market regime caching (5min TTL)
- ✅ PFV caching (5min TTL)
- ✅ CLI uses shared market regime library (`lib/ai-agent/market`)
- ✅ PFV + Spread calculation integrated into proxy path
- ✅ Financials handler uses multiple data sources (annual/quarterly/financialData)
- ✅ VIX/SPY/Sectors fetch via proxy first (avoids 429 rate limits)
- ✅ PFV options/chart fetch via proxy first (avoids 429 rate limits)

Still to do:

- [ ] Add cache check to tool executor (share prepared context)
- [ ] Split `buildContextForAI` into static/dynamic parts
- [ ] Update scanner to use parallel fetching
- [ ] Add metrics logging for performance tracking
- [ ] Implement conversation summarization v2

## Usage

### CLI Options

```bash
# Basic chat
bun run chat

# With streaming responses
bun run chat --stream

# With debug logging
DEBUG=true bun run chat

# Full options
bun run chat --ai-mode cloud --account 2000 --stream
```

### Logger Utility

```typescript
import { log } from '@lib/ai-agent';

// Debug logs only show when DEBUG=true
log.debug('[Module]', 'Cache miss, fetching...');

// Info/warn/error always show
log.info('[Module]', 'Operation complete');
log.warn('[Module]', 'Using stale data');
log.error('[Module]', 'Failed to fetch');

// Check debug mode
if (log.isDebug()) {
  // Do expensive debug operations
}
```

### Cache Utilities

```typescript
import {
  sessionCache,
  CacheKeys,
  CACHE_TTL,
  SessionCache,
} from '@lib/ai-agent';

// Check cache stats (displayed after responses)
const stats = sessionCache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);

// Manual invalidation if needed
sessionCache.invalidate(CacheKeys.ticker('NVDA'));
sessionCache.invalidatePrefix('ticker:'); // Clear all tickers
sessionCache.clear(); // Nuclear option
```

### Response Metrics Example

After a response with tool calls:

```
  ─ deepseek-r1 · 2145→856 tokens (39.9% eff) · 4.2s
    2 tools (1.8s) · cache: 67% hit · AI: 2.4s
```

Breakdown:

- `2145→856 tokens`: input → output token counts
- `39.9% eff`: output/input efficiency ratio
- `4.2s`: total response time
- `2 tools (1.8s)`: number of tool calls and their total time
- `cache: 67% hit`: session cache hit rate
- `AI: 2.4s`: pure inference time (total - tool time)
