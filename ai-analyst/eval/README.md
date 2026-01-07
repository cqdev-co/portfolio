# AI Analyst Evaluation Framework

A comprehensive testing framework to ensure calculation accuracy, tool usage, and recommendation quality.

## Current Coverage

| Phase                      | Tests | Status      |
| -------------------------- | ----- | ----------- |
| Phase 1: Calculation Tests | 38    | ✅ Complete |
| Phase 2: Tool Usage Tests  | 17    | ✅ Complete |
| Phase 3: Response Quality  | 30    | ✅ Complete |
| Phase 4: Backtesting       | 28    | ✅ Complete |

**Total: 113 tests**

## Quick Start

```bash
# Run all eval tests
bun run eval

# Run with verbose output
bun run eval:verbose

# Run specific test file
bun test eval/position-analysis.test.ts

# Run tests matching pattern
bun test eval/ --test-name-pattern "Position"
```

## Structure

```
eval/
├── README.md                         # This file
├── lib/
│   ├── test-harness.ts               # Tool usage test infrastructure
│   ├── response-quality.ts           # Response quality scoring framework
│   └── backtest.ts                   # Backtesting framework
├── backtests/                        # Recommendation data storage
│   └── recommendations.json          # Persisted recommendations & outcomes
├── position-analysis.test.ts         # P&L, cushion, breakeven calculations
├── spread-recommendations.test.ts    # Spread metrics, PoP, R/R calculations
├── tool-usage.test.ts                # Tool selection scenarios
├── response-quality.test.ts          # Response quality evaluation
└── backtest.test.ts                  # Backtesting framework tests
```

## Test Categories

### Phase 1: Calculation Accuracy (38 tests)

| Test File                        | What It Tests                                          |
| -------------------------------- | ------------------------------------------------------ |
| `position-analysis.test.ts`      | P&L calculations, profit capture %, cushion, breakeven |
| `spread-recommendations.test.ts` | Spread math, PoP calculation, R/R ratios               |

**Position Analysis Tests:**

- P&L calculations (max profit, current profit, profit captured %)
- Cushion calculations (above/below short strike)
- Breakeven calculations
- Value capture vs profit capture (prevents the original bug)
- Edge cases (zero cost, max cost, small spreads)

**Spread Recommendation Tests:**

- Basic spread math (width, debit, max profit)
- Cushion calculations
- Return on risk validation
- Probability of Profit (PoP) formula verification
- IV and DTE impact on PoP
- Real-world scenarios (NVDA, AVGO)

### Phase 2: Tool Usage (17 tests)

| Scenario Type     | What It Tests                                      |
| ----------------- | -------------------------------------------------- |
| Position Analysis | Triggers `analyze_position` for existing positions |
| Ticker Data       | Triggers `get_ticker_data` for new inquiries       |
| Spread Requests   | Triggers `find_spread` for trade recommendations   |
| News Requests     | Triggers `get_news` for news inquiries             |
| Efficiency        | Avoids unnecessary tool calls when data exists     |

### Phase 3: Response Quality (30 tests)

**Quality Dimensions** (`response-quality.test.ts`)

- Structure scoring (ticker, price, recommendations, data references)
- Reasoning scoring (cause-effect, multi-factor, quantitative, scenarios)
- Risk management scoring (warnings, exits, sizing, cushion, breakeven)
- Actionability scoring (clear actions, specific levels, timing, confidence)

**Validators**

- Hallucination detection (wrong tickers, unrealistic prices)
- Position response validation (tool usage, correct calculations)

**Grading**
| Grade | Score |
|-------|-------|
| A | 90-100 |
| B | 80-89 |
| C | 70-79 |
| D | 60-69 |
| F | <60 |

### Phase 4: Backtesting (28 tests)

**Recommendation Tracking** (`backtest.test.ts`)

- Log recommendations with full context (ticker, price, spread, confidence)
- Track pending vs closed recommendations
- Auto-calculate days held

**Outcome Evaluation**

- Price target / stop loss checking
- Call debit spread evaluation at expiration
- Partial profit/loss scenarios
- Auto-detect win/loss/breakeven

**Performance Metrics**

- Win rate, profit factor, total P&L
- Average win/loss amounts
- Average holding period
- Per-ticker breakdown
- Monthly performance tracking
- Sharpe ratio calculation

**Usage Example:**

```typescript
import {
  logRecommendation,
  recordOutcome,
  calculateMetrics,
  formatMetricsReport,
} from './lib/backtest.ts';

// Log a recommendation
const rec = logRecommendation({
  ticker: 'NVDA',
  priceAtRecommendation: 188.61,
  recommendation: 'BULLISH',
  spread: {
    type: 'CALL_DEBIT',
    longStrike: 185,
    shortStrike: 190,
    expiration: '2024-02-16',
    estimatedDebit: 3.8,
    estimatedMaxProfit: 1.2,
    breakeven: 188.8,
    pop: 65,
  },
  confidence: 75,
});

// Later, record the outcome
recordOutcome(rec.id, {
  status: 'WIN',
  closedAt: new Date().toISOString(),
  priceAtClose: 195,
  actualProfit: 1.2,
});

// Generate performance report
const metrics = calculateMetrics();
console.log(formatMetricsReport(metrics));
```

**Sample Report Output:**

```
📊 BACKTEST PERFORMANCE REPORT
══════════════════════════════════════════════════

OVERVIEW
──────────────────────────────
Total Recommendations: 50
Closed Trades:         45
Pending Trades:        5

PERFORMANCE
──────────────────────────────
Win Rate:        62.2%
Wins / Losses:   28 / 17
Avg Win:         $142.50
Avg Loss:        $85.30
Profit Factor:   1.95
Total Profit:    $2,547.00
Avg Hold Period: 12.3 days

BY TICKER
──────────────────────────────
NVDA   8W/3L (73%) $892.00
AAPL   5W/4L (56%) $245.00
...
```

## Key Metrics

### Position Analysis Accuracy

The position analyzer must correctly calculate:

- **Profit Captured %**: `(currentValue - costBasis) / (spreadWidth - costBasis) * 100`
- **Remaining Profit**: `(spreadWidth - costBasis) - (currentValue - costBasis)`
- **Cushion %**: `(currentPrice - shortStrike) / currentPrice * 100`
- **Breakeven**: `longStrike + costBasis`

### Common Pitfall: Value vs Profit Confusion

```
WRONG: "80% profit captured" when position is worth $4.00 / $5.00 max
RIGHT: "27.5% profit captured" when profit is $0.38 / $1.38 max

Position Value Capture ≠ Profit Capture
```

### Tool Usage Scoring

- **Pass Rate**: % of scenarios where correct tools were selected
- **Avg Score**: 0-100 score with penalties for wrong/extra tool calls
- **By Tag**: Breakdown by test category (position, efficiency, etc.)

## Adding New Tests

### Calculation Tests

```typescript
test('New calculation scenario', () => {
  const result = calculateMetrics({
    // ... input params
  });
  expect(result.someValue).toBeCloseTo(expected, precision);
});
```

### Tool Usage Tests

Add scenarios to `tool-usage.test.ts`:

```typescript
{
  id: "unique-id",
  description: "What this tests",
  userMessage: "User's input message",
  existingContext: "Optional context already provided",
  expectedToolCalls: [
    { toolName: "tool_name", expectedParams: { key: "value" } },
    // Or for tools that should NOT be called:
    { toolName: "tool_name", shouldNotCall: true },
  ],
  tags: ["category"],
}
```

## CI Integration

```yaml
- name: Run AI Analyst Evaluation
  run: bun run eval
```
