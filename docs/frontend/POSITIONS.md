# Positions Feature

Track and manage your stock, options, and **spreads** with live market data and AI-powered analysis.

## Overview

The Positions feature allows authenticated users to:

- Track stocks, single options, and **multi-leg spreads**
- View live P&L with the Refresh button
- Get AI-powered position analysis (coming soon)
- Track overall portfolio performance

## Architecture

### Database Schema

Two tables work together to support all position types:

#### `user_spreads` - Parent table for multi-leg positions

```sql
CREATE TABLE user_spreads (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  symbol VARCHAR(10) NOT NULL,
  spread_type VARCHAR(20) NOT NULL,  -- 'call_debit_spread', 'put_credit_spread', etc.
  net_debit_credit DECIMAL(12,4),    -- Positive = debit, Negative = credit
  quantity INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  -- Risk metrics
  max_profit DECIMAL(12,4),
  max_loss DECIMAL(12,4),
  breakeven_lower DECIMAL(12,4),
  breakeven_upper DECIMAL(12,4),
  width DECIMAL(12,4),
  notes TEXT,
  ...
);
```

#### `user_positions` - Individual positions or spread legs

```sql
CREATE TABLE user_positions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  spread_id UUID REFERENCES user_spreads(id),  -- NULL for standalone
  symbol VARCHAR(10) NOT NULL,
  position_type VARCHAR(10) NOT NULL,  -- 'stock' | 'option'
  quantity DECIMAL(12,4) NOT NULL,     -- Positive = long, Negative = short
  entry_price DECIMAL(12,4) NOT NULL,
  entry_date DATE NOT NULL,
  option_type VARCHAR(4),              -- 'call' | 'put'
  strike_price DECIMAL(12,4),
  expiration_date DATE,
  leg_label VARCHAR(20),               -- 'long_call', 'short_put', etc.
  notes TEXT,
  ...
);
```

### Supported Spread Types

| Type                 | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `call_debit_spread`  | Buy lower strike call, sell higher (Victor's favorite!) |
| `call_credit_spread` | Sell lower strike call, buy higher                      |
| `put_debit_spread`   | Buy higher strike put, sell lower                       |
| `put_credit_spread`  | Sell higher strike put, buy lower                       |
| `iron_condor`        | Put credit spread + call credit spread                  |
| `iron_butterfly`     | Sell ATM straddle + buy OTM strangle                    |
| `straddle`           | Buy/sell ATM call + put (same strike)                   |
| `strangle`           | Buy/sell OTM call + put (different strikes)             |
| `calendar_spread`    | Same strike, different expirations                      |
| `diagonal_spread`    | Different strikes, different expirations                |
| `custom`             | Any other multi-leg strategy                            |

Run `db/positions.sql` in Supabase SQL Editor to create both tables.

### API Endpoints

| Method | Endpoint                                   | Description                             |
| ------ | ------------------------------------------ | --------------------------------------- |
| GET    | `/api/positions`                           | List user's positions                   |
| POST   | `/api/positions`                           | Create new position                     |
| GET    | `/api/positions/[id]`                      | Get single position                     |
| PUT    | `/api/positions/[id]`                      | Update position                         |
| DELETE | `/api/positions/[id]`                      | Delete position                         |
| GET    | `/api/positions/spreads`                   | List user's spreads                     |
| POST   | `/api/positions/spreads`                   | Create new spread                       |
| GET    | `/api/positions/prices?symbols=`           | Get live stock prices (via Yahoo proxy) |
| GET    | `/api/positions/options-prices?contracts=` | Get live option contract prices         |

All endpoints require authentication via `Authorization: Bearer <token>` header.

### File Structure

```
frontend/src/
├── app/
│   ├── positions/
│   │   └── page.tsx              # Positions page
│   └── api/
│       └── positions/
│           ├── route.ts          # GET/POST handlers
│           ├── [id]/
│           │   └── route.ts      # GET/PUT/DELETE handlers
│           ├── spreads/
│           │   └── route.ts      # GET/POST spread handlers
│           └── prices/
│               └── route.ts      # Live price fetcher (Yahoo proxy)
├── components/
│   └── chat/
│       └── chat-context.tsx      # Global chat state & prompt builders
├── components/
│   └── positions/
│       ├── index.ts              # Barrel exports
│       ├── positions-page-client.tsx
│       ├── positions-table.tsx
│       └── add-position-dialog.tsx
└── lib/
    ├── api/
    │   └── positions.ts          # API client
    └── types/
        └── positions.ts          # Type definitions

lib/types/
└── positions.ts                  # Shared types (monorepo)
```

## Usage

### Adding a Position

The Add Position dialog has three tabs for different position types:

**Stock Tab**

1. Enter symbol (e.g., AAPL)
2. Select Long/Short direction
3. Enter shares and entry price
4. Set entry date and optional notes

**Option Tab**

1. Enter symbol
2. Select Call/Put type
3. Select Buy/Sell (long/short) direction
4. Enter strike price and expiration date
5. Enter number of contracts and premium per contract
6. Preview shows position in options notation (e.g., +1 AAPL $155 CALL Jan 17)

**Spread Tab**

1. Select a strategy template:
   - **CDS** - Call Debit Spread (bullish)
   - **PCS** - Put Credit Spread (bullish)
   - **PDS** - Put Debit Spread (bearish)
   - **CCS** - Call Credit Spread (bearish)
2. Enter symbol and number of contracts
3. Enter lower and upper strikes
4. Enter net debit/credit
5. Set expiration date
6. Preview shows max risk and max profit

### Refreshing Market Data

Click the "Refresh" button to fetch live prices for all positions. This will:

- Fetch current stock prices via Cloudflare Yahoo Finance proxy
- Calculate P&L for each position (handles both long and short)
- Show day change and percent change
- Update portfolio summary cards

**Stock Positions**: Live prices from Yahoo Finance quote API
**Option/Spread Positions**: Live prices from Yahoo Finance options chain
**Option Underlying**: Shows current stock price for reference (e.g., "AAPL @ $195.50")

**Option Contract Pricing**: The refresh now fetches actual option contract prices:

- Calls `/api/positions/options-prices` with contract details
- Fetches Yahoo Finance options chain for each symbol/expiration
- Returns mid price `(bid + ask) / 2` or last price
- Includes implied volatility for each contract

**Architecture**: The refresh flow uses:

1. `/api/positions/prices?symbols=AAPL,TSLA,NVDA` - Frontend API route
2. Cloudflare Worker at `yahoo-proxy.conorquinlan.workers.dev/quote/:symbol`
3. Yahoo Finance v7 quote API with retry and caching

**Note**: The Cloudflare proxy has built-in caching (60s for quotes) and rate limiting protection.

### Spread Natural Pricing

For spreads, we use **natural pricing** to calculate the current value - what you'd actually receive if you closed the position:

- **To close a debit spread**: Sell the long leg (at bid), buy back the short leg (at ask)
- **Natural value** = `long_bid - short_ask`

This is more accurate than using mid-prices, which can sometimes exceed the theoretical maximum spread width due to bid-ask spreads on individual legs.

Example for TSLA $410/$415 call debit spread:

- Long $410 call: bid=$40.90
- Short $415 call: ask=$37.20
- Natural spread value = $40.90 - $37.20 = **$3.70**

If mid-prices were used: ($41.05 - $37.05) = $4.00 (overestimates value)

### AI Analysis

The AI button opens the global chat panel with a beautiful context card showing your position data:

**Position Analysis** - Click ✨ on any position row:

- Shows a context card with position details (symbol, entry, current, P&L)
- Victor analyzes your position immediately
- Hold/Trim/Exit recommendations with key levels

**Spread Analysis** - Click ✨ on any spread row:

- Context card displays spread details (strikes, entry, current, P&L)
- Shows underlying price for reference
- Roll/Close/Hold recommendations based on position

**Portfolio Review** - Click "AI" button in header:

- Context card shows portfolio summary (value, P&L, win rate)
- Overall assessment from Victor Chen
- Action items for the portfolio

The context card appears at the top of the chat, making it clear that Victor has all the information needed to analyze your position.

## Types

### Position

```typescript
interface Position {
  id: string;
  user_id: string;
  symbol: string;
  position_type: 'stock' | 'option';
  quantity: number;
  entry_price: number;
  entry_date: string;
  option_type?: 'call' | 'put';
  strike_price?: number;
  expiration_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### PositionWithMarketData

```typescript
interface PositionWithMarketData extends Position {
  current_price: number;
  pnl: number;
  pnl_percent: number;
  day_change?: number;
  day_change_percent?: number;
  // For options: underlying stock price
  underlying_price?: number;
}
```

### PositionSummary

```typescript
interface PositionSummary {
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions_count: number;
  winners: number;
  losers: number;
}
```

## AI Integration

The Positions feature uses a global chat context to integrate with the main AI chat panel, providing a consistent chat experience across the app.

### Global Chat Context

The `ChatProvider` manages chat state globally:

```typescript
import { useGlobalChat, buildPositionPrompt } from '@/components/chat';

// In any component
const { openChat } = useGlobalChat();

// Open chat with a pre-built prompt
const handleAIClick = (position) => {
  const prompt = buildPositionPrompt(position);
  openChat(prompt); // Opens main chat with this prompt
};
```

### Position-Specific Analysis

Click the sparkle (✨) icon on any position row:

```typescript
import { buildPositionPrompt } from '@/components/chat';

const prompt = buildPositionPrompt({
  symbol: 'AAPL',
  position_type: 'stock',
  entry_price: 185.0,
  current_price: 192.5,
  quantity: 10,
  pnl: 75.0,
  pnl_percent: 4.05,
  entry_date: '2024-01-01',
});
// "Analyze my long position in AAPL: Entry: $185.00, Current: $192.50..."
```

### Portfolio Review

Click the "AI" button in the header:

```typescript
import { buildPortfolioPrompt } from '@/components/chat';

const prompt = buildPortfolioPrompt({
  totalValue: 5000,
  totalPnl: 250,
  totalPnlPercent: 5.0,
  positionsCount: 8,
  winners: 5,
  losers: 3,
});
// "Review my portfolio: Total Value: $5,000, P&L: +$250..."
```

### Spread Analysis

Click the sparkle (✨) icon on any spread row:

```typescript
import { buildSpreadPrompt } from '@/components/chat';

const prompt = buildSpreadPrompt({
  symbol: 'AAPL',
  spreadType: 'call_debit_spread',
  lowerStrike: 185,
  upperStrike: 190,
  netEntryPrice: 2.5,
  netCurrentPrice: 3.2,
  pnl: 70,
  pnl_percent: 28,
  expiration_date: '2024-02-16',
});
// "Analyze my AAPL call debit spread: Strikes: $185 / $190..."
```

## Security

- **Row Level Security (RLS)**: Users can only access their own positions
- **Authentication Required**: All API endpoints require valid JWT
- **Input Validation**: Server-side validation on all writes

## Future Enhancements

- [x] Position AI chat integration (global chat panel)
- [x] Portfolio advisor panel (merged into global chat)
- [x] Spread support (CDS, PCS, PDS, CCS)
- [x] Live market data via Cloudflare Yahoo proxy (stocks)
- [x] Separate spreads display (not shown as individual legs)
- [x] Spreads table view with P&L
- [x] AI analysis for spreads
- [ ] Live options pricing (requires options chain parsing)
- [ ] Historical performance tracking
- [ ] Export/import positions
- [ ] Position alerts (price targets, stop losses)
- [ ] Options Greeks display
- [ ] Sector allocation chart
- [ ] Iron Condor & advanced spread templates
