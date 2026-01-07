# Yahoo Finance Proxy Worker v4.2

Cloudflare Worker that proxies Yahoo Finance API requests using a custom
crumb authentication flow. Returns data format expected by `lib/ai-agent`.

**No external libraries** - pure fetch implementation (58 KiB bundle).

## Features

- **Modular architecture** - Clean separation of concerns
- **Manual crumb auth** - Bypasses library issues with Yahoo's consent flow
- **Response caching** - Cloudflare Cache API
- **Retry with backoff** - Handles 429 errors gracefully
- **All Yahoo data** - Quotes, charts, options, earnings, analysts, financials
- **v4.1: Expanded fundamentals** - FCF, PEG, margins, EPS trends, insider activity
- **v4.2: Rate limiting** - Serial Yahoo requests with 100ms delays to prevent 429s

## Endpoints

| Endpoint                  | Auth | Description                   |
| ------------------------- | ---- | ----------------------------- |
| `GET /ticker/:symbol`     | Yes  | All data (recommended)        |
| `GET /quote/:ticker`      | Yes  | Stock quote with fundamentals |
| `GET /chart/:ticker`      | No   | Historical OHLCV data         |
| `GET /options/:ticker`    | Yes  | Options chain summary         |
| `GET /financials/:ticker` | Yes  | Income, balance, cash flow    |
| `GET /holdings/:ticker`   | Yes  | Institutional ownership       |
| `GET /health`             | No   | Health check                  |

## Project Structure

```
cloudflare/src/
├── index.ts              # Router only (~130 lines)
├── config.ts             # Configuration constants
├── types/
│   └── index.ts          # TypeScript interfaces
├── utils/
│   ├── response.ts       # CORS & JSON helpers
│   ├── cache.ts          # Cloudflare Cache API wrapper
│   ├── retry.ts          # Retry with exponential backoff
│   └── rate-limiter.ts   # v4.2: Yahoo rate limit queue
├── auth/
│   └── crumb.ts          # Yahoo crumb authentication
├── fetchers/
│   ├── quote.ts          # Stock quote fetcher
│   ├── chart.ts          # Historical data fetcher
│   ├── summary.ts        # Earnings, analysts, short interest
│   ├── options.ts        # Options chain fetcher
│   ├── news.ts           # News headlines fetcher
│   └── index.ts          # Barrel export
└── handlers/
    ├── ticker.ts         # Main combined endpoint (serial w/ rate limit)
    ├── quote.ts          # Quote-only endpoint
    ├── chart.ts          # Chart-only endpoint
    ├── options.ts        # Options-only endpoint
    ├── financials.ts     # Deep financials endpoint
    ├── holdings.ts       # Institutional holdings endpoint
    └── index.ts          # Barrel export
```

## Rate Limiting (v4.2)

Yahoo Finance allows ~10-20 requests/second per IP. The proxy now uses **serial requests** with delays:

```
/ticker/:symbol request flow:
1. waitForRateLimit() → 100ms min between Yahoo calls
2. fetchQuote()       → Wait 100ms
3. fetchChart()       → Wait 100ms
4. fetchSummary()     → Wait 100ms
5. fetchOptions()     → Wait 100ms
6. fetchNews()        → Done

Total: ~500ms per ticker (5 requests × 100ms delay)
```

This prevents 429 errors when scanning many tickers concurrently.

## Response Format

The `/ticker/:symbol` endpoint returns data matching `lib/ai-agent` format:

```json
{
  "ticker": "AAPL",
  "timestamp": "2026-01-05T...",
  "elapsed_ms": 572,

  "quote": {
    "price": 271.01,
    "change": -0.31,
    "changePct": -0.11,
    "volume": 37838054,
    "avgVolume": 45105998,
    "marketCap": 4021894250496,
    "peRatio": 36.37,        // null for loss-making companies
    "forwardPE": 32.5,       // null if unavailable
    "eps": 7.45,             // negative for loss-making companies
    "beta": 1.25,            // null if unavailable
    "dividendYield": 0.44,
    "fiftyDayAverage": 272.83,
    "twoHundredDayAverage": 232.04,
    "fiftyTwoWeekLow": 169.21,
    "fiftyTwoWeekHigh": 288.62
  },

  "chart": {
    "dataPoints": 63,
    "quotes": [
      {"date": "...", "open": 272.26, "high": 277.84, ...}
    ]
  },

  "earnings": { "date": "2026-01-29", "daysUntil": 25 },

  "analysts": {
    "strongBuy": 5, "buy": 24, "hold": 16,
    "sell": 1, "strongSell": 3,
    "total": 49, "bullishPct": 59
  },

  "shortInterest": { "shortRatio": 2.83, "shortPctFloat": 0.83 },

  // v4.1: Expanded fundamental data
  "fundamentals": {
    "pegRatio": 1.5,
    "priceToBook": 52.65,
    "evToEbitda": 27.68,
    "freeCashFlow": 78862254080,
    "revenueGrowth": 7.9,
    "earningsGrowth": 91.2,
    "profitMargins": 26.9,
    "operatingMargins": 31.6,
    "returnOnEquity": 171.4,
    "debtToEquity": 152.4,
    "currentRatio": 0.893,
    "totalCash": 54697000960,
    "totalDebt": 112377004032,
    "targetMeanPrice": 287.71,
    "recommendationMean": 2,
    "numberOfAnalystOpinions": 41
  },

  "epsTrend": {
    "current": 2.67,
    "sevenDaysAgo": 2.67,
    "thirtyDaysAgo": 2.66,
    "ninetyDaysAgo": 2.48,
    "upLast7days": 2,
    "upLast30days": 3,
    "downLast7days": 0,
    "downLast30days": 0
  },

  "earningsHistory": {
    "quarters": [
      {"quarter": "4Q2024", "epsActual": 2.4, "epsEstimate": 2.34, "surprise": 0.03, "beat": true}
    ],
    "beatCount": 4,
    "missCount": 0
  },

  "insiderActivity": {
    "buyCount": 8,
    "buyShares": 582428,
    "sellCount": 7,
    "sellShares": 352873,
    "netShares": 229555,
    "period": "6m"
  },

  "profile": {
    "sector": "Technology",
    "industry": "Consumer Electronics",
    "country": "United States",
    "employees": 166000
  },

  "options": {
    "expirations": 20, "nearestExpiry": "2026-01-10",
    "atmIV": 31.36, "callVolume": 12345, "putVolume": 6789,
    "pcRatioVol": 0.5, "pcRatioOI": 0.55
  },

  "news": [{"title": "...", "source": "...", "link": "..."}]
}
```

## Setup

```bash
cd cloudflare
bun install
npx wrangler login
bun run deploy
```

## Cache Configuration

| Data Type  | TTL    | Notes              |
| ---------- | ------ | ------------------ |
| Crumb      | 1 hour | Auth token         |
| Quote      | 1 min  | Real-time price    |
| Chart      | 5 min  | Historical data    |
| Summary    | 5 min  | Earnings, analysts |
| Options    | 2 min  | Options chain      |
| News       | 10 min | Headlines          |
| Financials | 1 hour | Deep financials    |
| Holdings   | 1 hour | Institutional data |

## Architecture

```
lib/ai-agent Request
       ↓
   Cloudflare Worker (Router)
       ↓
   Handler (ticker/quote/chart/...)
       ↓
   Check cache → HIT → Return cached
       ↓ MISS
   Auth (get/refresh crumb)
       ↓
   Fetcher (fetch from Yahoo)
       ↓
   Cache response
       ↓
   Return formatted data
```

### Yahoo APIs Used

| Endpoint                    | Auth  | Data                |
| --------------------------- | ----- | ------------------- |
| `/v7/finance/quote`         | Crumb | Price, fundamentals |
| `/v8/finance/chart`         | None  | OHLCV history       |
| `/v10/finance/quoteSummary` | Crumb | Earnings, analysts  |
| `/v7/finance/options`       | Crumb | Options chain       |
| `/v1/finance/search`        | Crumb | News                |

## Logging & Observability

The worker uses a **log-level system** to minimize observability event costs
while keeping observability enabled. Log levels (in order of verbosity):

| Level   | What's logged                   | Default      |
| ------- | ------------------------------- | ------------ |
| `error` | Critical errors only            | ✓ Production |
| `warn`  | Errors + retry warnings         |              |
| `info`  | + Important events              |              |
| `debug` | Everything (cache hits, timing) |              |

### Cost Impact

In production (`error` level by default):

- **~1 event per request** (only on errors)
- vs. **10+ events per request** with verbose logging

### Enabling Debug Logging

To enable verbose logging for debugging, set the `LOG_LEVEL` global in
`src/utils/logger.ts`:

```typescript
// Change 'error' to 'debug' for verbose logging
const currentLevel: LogLevel =
  ((globalThis as any).LOG_LEVEL as LogLevel) || 'debug';
```

Then redeploy. Remember to revert after debugging.

## Changelog

### v4.2.1 (January 2026)

- **Log-level system** - Reduces observability events from 10+/request to ~1/request
  in production. Only errors are logged by default; use `debug` level for verbose
  logging during development.

### v4.1.0 (January 2026)

- **Expanded fundamentals** - `/ticker/:symbol` now returns:
  - `fundamentals`: FCF, PEG, P/B, EV/EBITDA, margins, ROE, debt metrics
  - `epsTrend`: Current EPS estimate + 7/30/60/90 day history & revisions
  - `earningsHistory`: Last 4 quarters with beat/miss and surprise %
  - `insiderActivity`: Buy/sell counts and net share change (6 months)
  - `profile`: Sector, industry, country, employee count
- Summary fetcher now requests 8 Yahoo modules (was 4)
- Bundle: 57 KiB

### v4.0.0 (January 2026)

- **Modular architecture** - Split 1,276-line monolith into modules
- `index.ts` now router only (~130 lines)
- Separate modules: config, types, utils, auth, fetchers, handlers
- Better maintainability and testability
- Bundle: 47 KiB

### v3.3.0

- **Fixed P/E handling**: Now returns `null` for loss-making companies
- peRatio, forwardPE, eps, beta properly preserve `null` values
- Bundle: 46 KiB

### v3.2.0

- Added `/financials/:ticker` endpoint
- Added `/holdings/:ticker` endpoint
- Fixed beta/eps from quoteSummary when quote returns null

### v3.1.0

- Added earnings, analysts, shortInterest, news
- Fixed field names to match lib/ai-agent format

### v3.0.0

- Removed yahoo-finance2 library
- Implemented manual crumb auth

### v2.0.0

- Added caching and retry logic

### v1.0.0

- Initial release with yahoo-finance2
