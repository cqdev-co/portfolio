# AI Agent Tools

**Status**: Active ✅  
**Last Updated**: January 2026

## Overview

Victor (the AI trading analyst) has access to a suite of tools that allow him
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

### 6. `get_trading_regime` ✨ NEW

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

**Example Output**:

```
=== TRADING REGIME ANALYSIS ===
🟡 REGIME: CAUTION
Confidence: 72%
Primary Reason: SIGNAL CONFLICT

📊 METRICS
• Trend Strength: MODERATE
• Conflict Score: 45%
• VIX: 18.5 (NORMAL)
• SPY: BULLISH
• ADX: 22.3 (MODERATE)
• Breadth: 52% (NARROWING)

🎯 FACTORS
• VIX 18.5 (NORMAL) - Standard volatility
• ADX 22.3 - moderate trend strength
• Market breadth 52% - narrowing participation

💡 RECOMMENDATION
Proceed with caution. Net bullish bias detected. Reduce position
sizes by 50%. Only take Grade A setups. Use tighter stops.
```

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
   - Victor should call `get_trading_regime` to validate conditions
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
