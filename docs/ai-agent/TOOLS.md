# AI Agent Tools

**Status**: Active ✅  
**Last Updated**: January 2026

## Overview

Xylo (the AI trading analyst) has access to a suite of tools that allow him
to fetch real-time market data, analyze conditions, and make informed trading
recommendations.

## Available Tools

### 1. `get_ticker_data`

Fetches real-time stock data including price, technicals, IV, and options flow.

**Parameters**:

- `ticker` (required): Stock symbol (e.g., "NVDA", "AAPL")

**Returns**:

- Price and change percentage
- RSI, ADX, and trend strength
- Moving averages (MA20, MA50, MA200)
- Market cap, P/E ratio, beta
- IV analysis and percentile
- Options flow (put/call ratio)
- Short interest data
- Analyst ratings
- Recent news headlines

### 2. `web_search`

Searches the web for current news, market analysis, or any information not in
the provided data.

**Parameters**:

- `query` (required): Search query string

**Returns**:

- Up to 3 search results with titles and snippets
- HTML entities are automatically cleaned for readability
- Results are truncated to save tokens

**Improvements (Jan 2026)**:

- Added HTML entity decoding (`&#x28;` → `(`, etc.)
- Removes HTML tags and markdown formatting
- Truncates snippets intelligently

### 3. `get_financials_deep`

Fetches detailed financial statements for fundamental analysis.

**Parameters**:

- `ticker` (required): Stock symbol

**Returns**:

- Income statement (revenue, margins, EPS)
- Balance sheet (assets, debt, ratios)
- Cash flow (FCF, CapEx, dividends)
- Valuation metrics (P/E, PEG, EV/EBITDA)

### 4. `get_institutional_holdings`

Fetches 13F institutional ownership data.

**Parameters**:

- `ticker` (required): Stock symbol

**Returns**:

- Institutional ownership percentage
- Insider ownership percentage
- Number of institutional holders
- Top 5 holders with values and changes

### 5. `get_unusual_options_activity`

Fetches unusual options activity signals from the database.

**Parameters**:

- `ticker` (optional): Filter to specific ticker
- `minGrade` (optional): Minimum signal grade (S, A, B, C, D)
- `limit` (optional): Max signals to return (default: 10)

**Returns**:

- Signal grade and score
- Option details (strike, expiry, type)
- Volume metrics and premium flow
- Signal flags (sweep, block trade, new)
- Sentiment (bullish/bearish/neutral)

### 6. `get_trading_regime`

Analyzes current market conditions to determine if trading is advisable.

**Parameters**:

- `ticker` (optional): Include ticker-specific data in analysis

**Returns**:

- Regime: `GO` (🟢), `CAUTION` (🟡), or `NO_TRADE` (🔴)
- Confidence percentage
- Primary reason for regime classification
- Detailed metrics:
  - Trend strength (WEAK/MODERATE/STRONG)
  - Conflict score (signal alignment)
  - VIX level and classification
  - SPY trend direction
  - ADX value and trend
  - Market breadth score
- Contributing factors
- Actionable recommendation

### 7. `get_iv_by_strike`

Fetches implied volatility for a specific strike and target DTE.

**Parameters**:

- `ticker` (required): Stock symbol
- `strike` (required): Strike price to check
- `targetDTE` (optional): Target days to expiration (default: 30)

**Returns**:

- Call IV at strike
- Put IV at strike
- Actual DTE of nearest expiration
- Expiration date

### 8. `calculate_spread`

Calculate exact pricing for a user-specified call debit spread.

**Parameters**:

- `ticker` (required): Stock symbol
- `longStrike` (required): Long call strike (lower, bought)
- `shortStrike` (required): Short call strike (higher, sold)
- `targetDTE` (optional): Target days to expiration (default: 30)

**Returns**:

- Real bid/ask for both legs
- Estimated debit
- Max profit and return on risk
- Breakeven and cushion percentage
- IV for both legs
- Open interest for liquidity assessment

### 9. `get_sector_flow` (Phase 1)

Returns the current sector-rotation tone (`risk-on` / `risk-off` / `mixed`)
plus the leading and lagging sector ETFs.

**Parameters**: none.

**Returns**:

- `rotation`: `risk-on` if all of XLK, XLF, XLY are LEADING; `risk-off`
  if all of XLP, XLU, XLV are LEADING; otherwise `mixed`.
- `leaders`: sector ETFs with `momentum: 'LEADING'`, sorted by `changePct`.
- `laggers`: sector ETFs with `momentum: 'LAGGING'`.
- `raw`: full per-sector array.

Implementation: pure glue over `getSectorPerformance()` in
`lib/ai-agent/market/`. No new provider — the data is already part of
the regime fetch.

### 10. `get_recent_news` (Phase 1)

Fetches recent news for a ticker from Yahoo + Polygon + FMP in parallel
and dedupes by URL.

**Parameters**:

- `ticker` (required): Stock symbol.
- `hours` (optional): Look-back window. Default 48, capped at 168 (7 days).

**Returns**:

- `articles`: up to 15 entries `{ title, source, url, published_at, snippet, origin }`.
- `dedupe_count`: duplicates removed during merge.
- `source_counts`: per-provider counts before dedupe (diagnostic).

Provider notes:

- Yahoo via `yahoo-finance2` (existing). Rate-limited; failures are
  swallowed and the merge proceeds.
- Polygon via `lib/ai-agent/data/polygon.ts` (existing); requires
  `POLYGON_API_TOKEN`.
- FMP via `lib/ai-agent/data/fmp.ts` (new); requires `FMP_API_KEY`.

### 11. `get_sentiment` (Phase 1)

Composite sentiment score for a ticker, derived from headline lexicon
(`lib/ai-agent/sentiment/`).

**Parameters**:

- `ticker` (required): Stock symbol.
- `hours` (optional): Look-back window for the headline pool. Default 48.

**Returns**:

- `score`: clamped to `[-1, 1]`.
- `label`: `VERY_BEARISH | BEARISH | NEUTRAL | BULLISH | VERY_BULLISH`.
- `article_count`.
- `momentum`: trailing-24h mean minus preceding-24h mean. `null` when
  there isn't enough data on each side.
- `signal_counts`: aggregate bullish / bearish word hits.

The handler reuses the cached news bundle from `get_recent_news` to
avoid double-fetching when both tools fire on the same turn.

### 12. `get_earnings_calendar` (Phase 1)

Multi-ticker upcoming earnings via the FMP `/stable/earnings-calendar`
endpoint.

**Parameters**:

- `tickers` (optional): comma-separated ticker list (e.g. `"NVDA,AAPL"`).
- `days` (optional): look-ahead window. Default 7, capped at 30.

**Returns**:

- `upcoming`: array of `{ symbol, date, epsActual, epsEstimated, revenueActual, revenueEstimated, lastUpdated }`.
- `window_days`: echo of the window used.

Requires `FMP_API_KEY`. Without the key the handler returns
`{ success: false, error: 'Earnings calendar unavailable...' }`.

### 13. `get_geopolitical_events` (Phase 1)

Curated upcoming macro / geopolitical events from
`lib/ai-agent/calendar/index.ts:GEOPOLITICAL_EVENTS_2026`.

**Parameters**:

- `days` (optional): look-ahead window. Default 14, capped at 60.

**Returns**:

- `events`: array of `MarketEvent` with `type: 'GEOPOLITICAL'`,
  `impact: high|medium|low`, and a description.
- `data_freshness`: explicit disclaimer (`'curated through 2026-12-31'`).

This is intentionally a **curated static list**, not a live feed. The
disclaimer is exposed to the model so it doesn't claim coverage we
don't actually have. Replace with a real macro feed in Phase 2+.

## Tool Integration

### CLI (ai-analyst)

Tools are executed via the `executeToolCall` function in `chat.ts`:

```typescript
const result = await executeToolCall(toolCall, showStatus);
```

Results are displayed inline in the chat with formatted output.

### Frontend (Portfolio)

Tools can be executed via the shared handlers in `lib/ai-agent/handlers`:

```typescript
import {
  handleGetTickerData,
  handleGetTradingRegime,
  handleWebSearch,
} from '@lib/ai-agent';

const result = await handleGetTradingRegime({ ticker: 'NVDA' });
```

### Shared Library

All tool definitions are in `lib/ai-agent/tools/definitions.ts`:

```typescript
import { AGENT_TOOLS, toOllamaTools } from '@lib/ai-agent';

// Convert to Ollama format
const ollamaTools = toOllamaTools(AGENT_TOOLS);
```

## Web Search Improvements

The web search tool now properly cleans HTML content:

### Before (Raw HTML entities):

```
CrowdStrike &#x28;CRWD&#x29; &#x7c; Trefis
[![Trefis]()](https://www.trefis.com/data/home?from=icon)
&times;
```

### After (Cleaned):

```
CrowdStrike (CRWD) | Trefis - Stock analysis and valuation models...
```

### HTML Cleaning Features:

- Decodes numeric entities (`&#x28;` → `(`)
- Replaces named entities (`&amp;` → `&`)
- Removes HTML tags
- Strips markdown links (keeps text)
- Removes image markdown
- Collapses whitespace

## Best Practices

1. **Always check trading regime before suggesting entries**
   - Xylo should call `get_trading_regime` to validate conditions
   - If `NO_TRADE`, recommend waiting

2. **Use web search for recent news**
   - When user asks "why is X moving?"
   - For FOMC, earnings, or macro events

3. **Combine tools for complete analysis**
   - `get_ticker_data` for technicals
   - `get_financials_deep` for fundamentals
   - `get_institutional_holdings` for ownership
   - `get_unusual_options_activity` for smart money signals

## Smart Context Loading

The system classifies questions to avoid unnecessary API calls:

| Question Type    | Fetches Ticker? | Web Search? | Example                      |
| ---------------- | --------------- | ----------- | ---------------------------- |
| `trade_analysis` | ✅ Yes          | No          | "What do you think of NVDA?" |
| `research`       | ❌ No (cached)  | ✅ Yes      | "Why did NVDA fall today?"   |
| `price_check`    | ✅ Yes          | No          | "What's the price of AAPL?"  |
| `scan`           | ✅ Yes (bulk)   | No          | "Find me some setups"        |
| `general`        | ❌ No           | No          | "What's your strategy?"      |

**Research questions** (why did, why is, what happened, etc.) skip ticker
re-fetch because the AI already has context from the conversation. This
reduces latency and token usage.

## Future Enhancements

- [ ] Real-time streaming of tool results
- [ ] Tool result caching with TTL for repeated queries
- [ ] Custom tool definitions per user
- [ ] Tool call rate limiting and quotas
- [ ] Scanner with custom criteria builder
- [ ] Watchlist management tool
