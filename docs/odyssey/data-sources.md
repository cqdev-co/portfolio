# Odyssey Data Sources Documentation

## Overview

Odyssey currently uses yfinance as its primary data source through Next.js API routes. This document explains the data integration, limitations, and potential alternatives.

## Current Implementation: yahoo-finance2 (v2.11.3)

### Why yahoo-finance2 v2?

- **Free**: No API key or subscription required
- **Easy Integration**: Simple TypeScript/JavaScript library for Node.js
- **Direct API**: v2 provides a simpler, direct API without need for instantiation
- **Comprehensive**: Stocks, options, indices, sectors
- **Historical Data**: Access to historical price data
- **No Rate Limits**: Reasonable usage is generally allowed
- **TypeScript Support**: First-class TypeScript support with full type definitions

**Note**: We use v2.11.3 instead of v3+ because v3 requires instantiation and has a more complex API. v2 provides a cleaner, more direct approach for our use case.

### Data Endpoints

#### 1. Market Data (`/api/odyssey/market-data`)

**Purpose**: Fetch major indices and VIX

**Symbols**:
- SPY (S&P 500 ETF)
- QQQ (Nasdaq 100 ETF)
- DIA (Dow Jones ETF)
- IWM (Russell 2000 ETF)
- ^VIX (CBOE Volatility Index)

**Response Format**:
```typescript
{
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}
```

**Cache**: 5 minutes

#### 2. Sector Data (`/api/odyssey/sector-data`)

**Purpose**: Fetch sector ETF performance

**Sectors** (11 S&P sectors):
- XLK (Technology)
- XLF (Financials)
- XLE (Energy)
- XLV (Healthcare)
- XLY (Consumer Discretionary)
- XLP (Consumer Staples)
- XLI (Industrials)
- XLB (Materials)
- XLU (Utilities)
- XLRE (Real Estate)
- XLC (Communication Services)

**Response Format**:
```typescript
{
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  relativeStrength: number;
}
```

**Cache**: 5 minutes

#### 3. Options Chain (`/api/odyssey/options-chain`)

**Purpose**: Fetch options data for strategy analysis

**Query Parameters**:
- `symbol`: Ticker symbol (required)
- `minDte`: Minimum days to expiration (default: 7)
- `maxDte`: Maximum days to expiration (default: 45)

**Response Format**:
```typescript
{
  symbol: string;
  expiration: string;
  strike: number;
  type: "call" | "put";
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}
```

**Cache**: 5 minutes

## Limitations

### yahoo-finance2 Limitations

1. **Rate Limiting**: While yahoo-finance2 doesn't have strict rate limits, excessive requests may be throttled
2. **Data Delays**: Market data may be delayed by 15-20 minutes
3. **Reliability**: Occasional API failures or changes to Yahoo Finance
4. **Greeks Availability**: Greeks are not provided by yahoo-finance2 (calculated client-side if needed)
5. **Options Chain**: Limited historical options data

### Current Workarounds

1. **Caching**: 5-minute cache reduces API calls
2. **Mock Data**: Fallback mock data for development
3. **Error Handling**: Graceful degradation on API failures
4. **Batch Requests**: Minimize number of API calls

## Alternative Data Sources

### 1. Alpaca Markets (Recommended for Production)

**Pros**:
- Real-time market data
- Free tier available
- Paper trading API
- Excellent documentation
- WebSocket support

**Cons**:
- Requires API key
- Free tier has limitations
- No options data in free tier

**Migration Path**:
```typescript
// Replace yfinance endpoint with Alpaca
const response = await fetch(
  `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
  {
    headers: {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
    },
  }
);
```

### 2. Polygon.io

**Pros**:
- High-quality, real-time data
- Options data included
- Excellent API
- WebSocket support
- Historical data access

**Cons**:
- Paid service ($99+/month)
- Requires API key
- More complex integration

**Use Case**: Professional-grade applications requiring real-time options data

### 3. TD Ameritrade API

**Pros**:
- Free with TD Ameritrade account
- Real-time data
- Options chains included
- Comprehensive market data

**Cons**:
- Requires brokerage account
- OAuth2 authentication
- More complex setup

**Use Case**: Users with TD Ameritrade accounts wanting real-time data

### 4. Interactive Brokers (IBKR) API

**Pros**:
- Professional-grade data
- Real-time options data
- Trading integration
- Global markets

**Cons**:
- Complex setup
- Requires IBKR account
- Learning curve

**Use Case**: Advanced traders needing trading integration

## Migration Guide

### Switching Data Providers

1. **Update API Routes**: Modify `/api/odyssey/*` endpoints
2. **Update Types**: Ensure data structure matches
3. **Update Cache Logic**: Adjust TTL based on provider
4. **Add Authentication**: Implement API key management
5. **Test Thoroughly**: Verify all features work with new provider

### Example: Migrating to Alpaca

```typescript
// Before (yahoo-finance2)
const response = await fetch(`/api/odyssey/market-data`);

// After (Alpaca)
const response = await fetch(
  `/api/odyssey/market-data?provider=alpaca`
);

// API Route changes
// /api/odyssey/market-data/route.ts
const provider = searchParams.get('provider') || 'yahoo-finance2';

if (provider === 'alpaca') {
  // Alpaca logic
} else {
  // yahoo-finance2 logic (default)
}
```

## Best Practices

### 1. Respect Rate Limits

- Use caching aggressively
- Batch requests when possible
- Implement exponential backoff
- Monitor API usage

### 2. Handle Failures Gracefully

```typescript
try {
  const data = await fetchMarketData();
  return data;
} catch (error) {
  console.error('Data fetch failed:', error);
  // Return cached data or empty state
  return getCachedDataOrEmpty();
}
```

### 3. Validate Data

```typescript
function validateMarketData(data: any): MarketData | null {
  if (!data.symbol || typeof data.price !== 'number') {
    return null;
  }
  return data as MarketData;
}
```

### 4. Monitor Performance

- Log API response times
- Track cache hit rates
- Monitor error rates
- Set up alerts for failures

## Data Quality Considerations

### yahoo-finance2 Data Quality

- **Price Data**: Generally accurate but may have delays
- **Volume**: Accurate for major symbols
- **Options Data**: Comprehensive options chain data without Greeks
- **Historical Data**: Reliable for most symbols

### Improving Data Quality

1. **Use Multiple Sources**: Compare data from different providers
2. **Implement Validation**: Check for outliers and anomalies
3. **Monitor Accuracy**: Track data quality metrics
4. **Fallback Logic**: Use backup data sources

## Future Enhancements

- [ ] Support multiple data providers
- [ ] Real-time WebSocket integration
- [ ] Historical data caching
- [ ] Data quality monitoring
- [ ] Automatic failover between providers
- [ ] User-selectable data sources

## Additional Resources

- [yahoo-finance2 GitHub](https://github.com/gadicc/node-yahoo-finance2)
- [yahoo-finance2 Docs](https://github.com/gadicc/node-yahoo-finance2/blob/devel/docs/README.md)
- [Alpaca Docs](https://alpaca.markets/docs/)
- [Polygon.io Docs](https://polygon.io/docs/)
- [TD Ameritrade API](https://developer.tdameritrade.com/)

## Getting Help

If you encounter data issues:

1. Check API status pages
2. Verify cache configuration
3. Review error logs
4. Test with different symbols
5. Report persistent issues

