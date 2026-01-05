# Yahoo Finance Proxy Worker v4.0

Cloudflare Worker that proxies Yahoo Finance API requests using a custom
crumb authentication flow. Returns data format expected by `lib/ai-agent`.

**No external libraries** - pure fetch implementation (47 KiB bundle).

## Features

- **Modular architecture** - Clean separation of concerns
- **Manual crumb auth** - Bypasses library issues with Yahoo's consent flow
- **Response caching** - Cloudflare Cache API
- **Retry with backoff** - Handles 429 errors gracefully
- **All Yahoo data** - Quotes, charts, options, earnings, analysts, financials

## Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /ticker/:symbol` | Yes | All data (recommended) |
| `GET /quote/:ticker` | Yes | Stock quote with fundamentals |
| `GET /chart/:ticker` | No | Historical OHLCV data |
| `GET /options/:ticker` | Yes | Options chain summary |
| `GET /financials/:ticker` | Yes | Income, balance, cash flow |
| `GET /holdings/:ticker` | Yes | Institutional ownership |
| `GET /health` | No | Health check |

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
│   └── retry.ts          # Retry with exponential backoff
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
    ├── ticker.ts         # Main combined endpoint
    ├── quote.ts          # Quote-only endpoint
    ├── chart.ts          # Chart-only endpoint
    ├── options.ts        # Options-only endpoint
    ├── financials.ts     # Deep financials endpoint
    ├── holdings.ts       # Institutional holdings endpoint
    └── index.ts          # Barrel export
```

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

| Data Type | TTL | Notes |
|-----------|-----|-------|
| Crumb | 1 hour | Auth token |
| Quote | 1 min | Real-time price |
| Chart | 5 min | Historical data |
| Summary | 5 min | Earnings, analysts |
| Options | 2 min | Options chain |
| News | 10 min | Headlines |
| Financials | 1 hour | Deep financials |
| Holdings | 1 hour | Institutional data |

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

| Endpoint | Auth | Data |
|----------|------|------|
| `/v7/finance/quote` | Crumb | Price, fundamentals |
| `/v8/finance/chart` | None | OHLCV history |
| `/v10/finance/quoteSummary` | Crumb | Earnings, analysts |
| `/v7/finance/options` | Crumb | Options chain |
| `/v1/finance/search` | Crumb | News |

## Changelog

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
