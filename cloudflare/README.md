# Yahoo Finance Proxy Worker

Cloudflare Worker that proxies Yahoo Finance API requests using Cloudflare's
IP pool to bypass rate limiting on blocked IPs.

## Setup

1. Install dependencies:
```bash
cd yahoo-proxy-worker
npm install
```

2. Login to Cloudflare:
```bash
npx wrangler login
```

3. Deploy:
```bash
npm run deploy
```

4. Add the worker URL to your `.env`:
```bash
YAHOO_PROXY_URL=https://yahoo-proxy.<your-subdomain>.workers.dev
```

## Endpoints

### Combined (Recommended)

| Endpoint | Requests | Description |
|----------|----------|-------------|
| `GET /ticker/:symbol` | **1** | All data in ONE request (5x more efficient) |

### Individual (for debugging)

| Endpoint | Requests | Description |
|----------|----------|-------------|
| `GET /quote/:ticker` | 1 | Stock quote only |
| `GET /chart/:ticker` | 1 | Historical OHLCV only |
| `GET /options/:ticker` | 1 | Options chain only |
| `GET /summary/:ticker` | 1 | Detailed summary only |
| `GET /search?q=TICKER` | 1 | Search/news only |
| `GET /health` | 1 | Health check |

**Request Efficiency**:
- 200k free requests/day from Cloudflare
- Combined endpoint: 200k ticker lookups/day
- Individual endpoints: 40k ticker lookups/day (5 requests each)

## Examples

```bash
# RECOMMENDED: All data in one request
curl https://yahoo-proxy.xxx.workers.dev/ticker/AAPL

# Individual endpoints (for debugging)
curl https://yahoo-proxy.xxx.workers.dev/quote/AAPL
curl "https://yahoo-proxy.xxx.workers.dev/chart/AAPL?range=1mo&interval=1d"
curl https://yahoo-proxy.xxx.workers.dev/options/AAPL
curl "https://yahoo-proxy.xxx.workers.dev/summary/AAPL?modules=price,summaryDetail"
curl "https://yahoo-proxy.xxx.workers.dev/search?q=AAPL&newsCount=5"
```

## Testing

```bash
# Run unit tests (uses vitest + Cloudflare workers pool)
npm test

# Run integration tests against local dev server
npm run dev &
node tests/integration.mjs

# Run integration tests against deployed worker
WORKER_URL=https://yahoo-proxy.xxx.workers.dev node tests/integration.mjs
```

### Test Coverage

| Endpoint | Tests |
|----------|-------|
| `/health` | Health check, service name |
| `/quote/:ticker` | Valid ticker, lowercase, invalid ticker |
| `/chart/:ticker` | Historical data, default params |
| `/options/:ticker` | Options chain, calls/puts |
| `/summary/:ticker` | Quote summary, modules |
| `/search` | News search, missing query error |
| Error handling | 404, 405, CORS |

## Development

**Note**: Local dev (`bun run dev`) doesn't work due to `yahoo-finance2` 
compatibility issues with Wrangler's local environment. Deploy to test:

```bash
# Deploy to production
bun run deploy

# View live logs
bun run tail

# Run tests (unit tests only)
bun run test
```

## Debug Tool

Print raw data from any endpoint (requires `YAHOO_PROXY_URL` env var):

```bash
# Combined endpoint (default, most efficient)
bun run debug AAPL

# Specific endpoint
bun run debug TSLA ticker    # Same as default
bun run debug NVDA quote     # Quote only
bun run debug RIVN options   # Options only
```

**Output includes:**
- Raw JSON response
- Response time
- Quick stats summary (price, market cap, etc.)
- Options/chart/news summaries

**Note**: Local development not supported. Always test against production.

## Why This Exists

Yahoo Finance aggressively rate limits IPs, especially:
- Residential IPs after heavy usage
- Cloud provider IPs (Vercel, AWS, etc.)

This worker routes requests through Cloudflare's massive IP pool,
effectively bypassing Yahoo's IP-based rate limiting.

## Data Availability

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/quote/:ticker` | ✅ Full | Real-time price, P/E, market cap, etc. |
| `/chart/:ticker` | ✅ Full | Historical OHLCV data |
| `/options/:ticker` | ✅ Full | Options chain with IV, Greeks |
| `/summary/:ticker` | ✅ Full | Financials, earnings, recommendations |
| `/search` | ✅ Full | News and search results |

**How it works:** The worker uses the `yahoo-finance2` library which handles 
all the cookie/crumb authentication automatically. Running through Cloudflare's 
IP pool bypasses Yahoo's rate limits on blocked IPs.

## Free Tier Limits

Cloudflare Workers free tier:
- 100,000 requests/day
- 10ms CPU time per request
- No credit card required

