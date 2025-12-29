# Library Documentation

Shared utilities used across the monorepo.

## Structure

```
lib/
├── types/
│   └── ticker.ts           # Shared ticker type definitions
└── utils/
    ├── ts/                  # TypeScript utilities
    │   ├── get_tickers.ts   # Ticker fetching utilities
    │   └── psychological-fair-value/  # PFV calculator
    └── py/                  # Python utilities (future)
        └── get_tickers.py
```

## Utilities

### Psychological Fair Value (PFV)

Calculates where stock price gravitates based on behavioral biases 
and market mechanics.

**Documentation:** [psychological-fair-value.md](./psychological-fair-value.md)

**Key Features:**
- Max pain calculation
- Gamma wall detection  
- Multi-expiration analysis
- Ticker profile auto-detection
- AI-ready context output

### Ticker Utilities

Fetch and search tickers from the database.

```typescript
import { getAllTickers, searchTickers } from '@lib/utils/ts/get_tickers';

const tickers = await getAllTickers({ active_only: true });
const results = await searchTickers('AAPL');
```