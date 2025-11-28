# Odyssey Strategy Development Guide

## Overview

The Odyssey strategy framework is designed to be modular and extensible. This guide explains how to create custom trading strategies that integrate seamlessly with the dashboard.

## Strategy Types

Odyssey supports multiple strategy categories:

- **Options Strategies**: Credit spreads, debit spreads, iron condors, etc.
- **Technical Strategies**: Breakouts, reversals, momentum plays
- **Fundamental Strategies**: Value screening, growth plays, earnings opportunities
- **Volatility Strategies**: IV rank plays, volatility crush opportunities
- **Momentum Strategies**: Trend following, relative strength

## Creating a New Strategy

### Step 1: Define Your Strategy Class

All strategies extend the `BaseStrategy` class:

```typescript
import { BaseStrategy } from "@/lib/odyssey/strategies/BaseStrategy";
import { 
  Opportunity, 
  MarketData, 
  OptionsData 
} from "@/lib/odyssey/strategies/types";

export class MyCustomStrategy extends BaseStrategy {
  constructor() {
    super(
      "my-strategy",           // Unique ID
      "My Custom Strategy",    // Display name
      "Strategy description",  // Description
      "technicals",            // Strategy type
      {
        enabled: true,
        minConfidence: 60,
        maxResults: 20,
        // Add custom parameters
      }
    );
  }

  async detect(
    marketData: MarketData[],
    optionsData?: OptionsData[]
  ): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    
    // Your detection logic here
    
    return opportunities;
  }
}
```

### Step 2: Implement Detection Logic

The `detect()` method is where your strategy logic lives:

```typescript
async detect(
  marketData: MarketData[],
  optionsData?: OptionsData[]
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  for (const data of marketData) {
    // Example: Detect oversold conditions
    if (this.isOversold(data)) {
      opportunities.push({
        id: this.generateOpportunityId(data.symbol, "oversold"),
        symbol: data.symbol,
        strategyType: "technicals",
        opportunityType: "reversal",
        title: `Oversold Reversal - ${data.symbol}`,
        description: `${data.symbol} showing oversold conditions`,
        riskReward: 2.5,
        confidence: this.calculateConfidence(data),
        timestamp: new Date(),
        details: {
          currentPrice: data.price,
          // Add more details
        },
      });
    }
  }

  // Apply filters and sorting
  const filtered = this.filterByConfidence(opportunities);
  const sorted = this.sortByConfidence(filtered);
  return this.limitResults(sorted);
}
```

### Step 3: Add Parameter Validation

Override `validateParameters()` for custom validation:

```typescript
validateParameters(parameters: MyStrategyParameters): boolean {
  if (!super.validateParameters(parameters)) {
    return false;
  }
  
  // Add custom validation
  if (parameters.customParam < 0) {
    return false;
  }
  
  return true;
}
```

### Step 4: Register with Strategy Engine

In your main page or hook:

```typescript
import { strategyEngine } from "@/lib/odyssey/strategies/StrategyEngine";
import { MyCustomStrategy } from "@/lib/odyssey/strategies/MyCustomStrategy";

// Register the strategy
const myStrategy = new MyCustomStrategy();
strategyEngine.registerStrategy(myStrategy);
```

## Credit Spread Strategy Example

Here's how the built-in credit spread strategy works:

### Detection Logic

1. **Group options** by symbol and expiration
2. **Filter by DTE** range (7-45 days by default)
3. **Find combinations** with standard spread widths (5, 10, 15, 20)
4. **Calculate metrics**:
   - Premium collected
   - Max risk
   - Max profit
   - Risk/reward ratio
5. **Filter by R:R threshold** (2:1 minimum)
6. **Calculate confidence score** based on:
   - Risk/reward ratio
   - Days to expiration
   - Volume
   - Delta positioning
7. **Rank and return** top opportunities

### Confidence Scoring

The confidence score (0-100) is calculated as:

- Base score: 50
- R:R bonus: up to 25 points
- DTE bonus: up to 15 points (optimized for 21-30 DTE)
- Volume bonus: up to 10 points
- Delta bonus: up to 10 points (prefer 0.15-0.35 delta)

## Best Practices

### 1. Use Meaningful IDs

Strategy IDs should be unique and descriptive:

```typescript
"credit-spread"     // Good
"momentum-breakout" // Good
"strategy1"         // Bad
```

### 2. Provide Clear Descriptions

Help users understand what the strategy detects:

```typescript
description: "Identifies bull put and bear call credit spreads with favorable risk/reward ratios"
```

### 3. Calculate Realistic Confidence Scores

Confidence should reflect true probability of success:

- 80-100: Very high confidence
- 60-79: High confidence
- 40-59: Moderate confidence
- 20-39: Low confidence
- 0-19: Very low confidence

### 4. Handle Errors Gracefully

Use try-catch blocks to prevent one symbol from breaking the entire analysis:

```typescript
for (const data of marketData) {
  try {
    // Analysis logic
  } catch (error) {
    console.error(`Error analyzing ${data.symbol}:`, error);
    continue;
  }
}
```

### 5. Optimize for Performance

- Cache expensive calculations
- Use parallel processing where possible
- Limit API calls
- Filter early to reduce iterations

## Testing Your Strategy

### Unit Testing

Test your strategy in isolation:

```typescript
const strategy = new MyCustomStrategy();
const mockData: MarketData[] = [
  // Mock data
];

const opportunities = await strategy.detect(mockData);
expect(opportunities.length).toBeGreaterThan(0);
```

### Integration Testing

Test with the strategy engine:

```typescript
strategyEngine.registerStrategy(new MyCustomStrategy());
const result = await strategyEngine.executeAll(marketData);
```

### Manual Testing

1. Navigate to `/odyssey`
2. Ensure your strategy is enabled in configuration
3. Add relevant symbols to watchlist
4. Click refresh and verify opportunities appear

## Advanced Features

### Custom Parameters

Add strategy-specific parameters:

```typescript
interface MyStrategyParameters extends BaseStrategyParameters {
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
}
```

### Multi-Timeframe Analysis

Analyze multiple timeframes for confirmation:

```typescript
const shortTerm = await this.analyze(data, "1d");
const longTerm = await this.analyze(data, "1w");

if (shortTerm.signal && longTerm.trend === "bullish") {
  // Higher confidence opportunity
}
```

### Risk Management

Include risk calculations in your opportunities:

```typescript
details: {
  entryPrice: 100,
  targetPrice: 110,
  stopLoss: 95,
  riskAmount: 5,
  rewardAmount: 10,
  positionSize: this.calculatePositionSize(accountSize, 5),
}
```

## Troubleshooting

### Strategy Not Detecting Opportunities

- Verify parameters aren't too restrictive
- Check if watchlist contains appropriate symbols
- Review confidence threshold
- Add console.log statements to debug

### Performance Issues

- Reduce `maxResults` parameter
- Increase `minConfidence` to filter more aggressively
- Optimize loops and calculations
- Use caching for repeated operations

### Type Errors

- Ensure proper TypeScript types are used
- Validate data before processing
- Use type guards for optional fields

## Next Steps

1. Review the CreditSpreadStrategy implementation
2. Create your custom strategy
3. Test thoroughly with different market conditions
4. Share your strategy with the community!

