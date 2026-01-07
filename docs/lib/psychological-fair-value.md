# Psychological Fair Value (PFV) Utility

> **Location:** `lib/utils/ts/psychological-fair-value/`

Calculates where stock price gravitates based on **behavioral biases** and
**market mechanics** rather than traditional fundamental analysis.

## Concept Overview

Traditional "fair value" comes from fundamentals (DCF, P/E, book value).
**Psychological Fair Value** is where price _gravitates toward_ based on:

- **Options mechanics** (max pain, gamma hedging)
- **Technical psychology** (MAs, support/resistance)
- **Human cognitive bias** (round numbers)
- **Volume anchoring** (VWAP, high volume nodes)

This is useful for:

- Understanding price magnetism before major expirations
- Identifying mean reversion opportunities
- Setting realistic price targets
- Contextualizing AI analyst recommendations

---

## Quick Start

```typescript
import {
  calculatePsychologicalFairValue,
  formatPFVResult,
} from '@lib/utils/ts/psychological-fair-value';

const result = calculatePsychologicalFairValue({
  ticker: 'AAPL',
  technicalData: {
    currentPrice: 178.50,
    ma200: 175.00,
    ma50: 177.20,
    fiftyTwoWeekHigh: 199.62,
    fiftyTwoWeekLow: 164.08,
    vwap: 177.80,
  },
  expirations: [
    {
      expiration: new Date('2024-01-19'),
      dte: 12,
      calls: [...], // OptionContract[]
      puts: [...],
      totalCallOI: 150000,
      totalPutOI: 120000,
    },
  ],
});

console.log(formatPFVResult(result));
// Output:
// ══════════════════════════════════════════════════
// 📊 PSYCHOLOGICAL FAIR VALUE: AAPL
// ══════════════════════════════════════════════════
//
// Current Price:  $178.50
// Fair Value:     $175.00
// Deviation:      -1.96% (BEARISH)
// Confidence:     HIGH
// ...
```

---

## Components

### 1. Max Pain (Default: 30% weight)

The strike price where **most options expire worthless**.

Market makers profit from theta decay, so they have an incentive to
"pin" price near max pain as expiration approaches.

```typescript
import { calculateMaxPain } from '@lib/utils/ts/psychological-fair-value';

const maxPain = calculateMaxPain(optionsExpiration, currentPrice);
// Returns: { price: 175, confidence: 0.82, ... }
```

**When it's strongest:**

- 0-7 days to expiration
- Monthly OPEX (3rd Friday)
- High total open interest

### 2. Gamma Walls (Default: 10% weight)

Strikes with **abnormally high open interest** where market maker
delta-hedging creates support/resistance.

```typescript
import { detectGammaWalls } from '@lib/utils/ts/psychological-fair-value';

const walls = detectGammaWalls(expiration, currentPrice);
// Returns: {
//   walls: [...],
//   strongestSupport: { strike: 170, ... },
//   strongestResistance: { strike: 180, ... },
//   center: 175.5
// }
```

**Types:**

- **Call walls** (above price) → Resistance
- **Put walls** (below price) → Support
- **Combined walls** → Very strong levels

### 3. Technical Levels (Default: 25% weight)

Classic support/resistance from technical analysis:

- Moving averages (MA20, MA50, MA200)
- 52-week high/low
- Recent swing points
- VWAP
- Previous close

```typescript
import { analyzeTechnicalLevels } from '@lib/utils/ts/psychological-fair-value';

const levels = analyzeTechnicalLevels(technicalData);
// Returns weighted center and all identified levels
```

### 4. Volume Anchor (Default: 20% weight)

Where the most money has changed hands:

- **VWAP** - Institutional benchmark
- **Volume Profile POC** - Point of Control

### 5. Round Numbers (Default: 15% weight)

Human cognitive bias toward round prices:

- **Major:** $100, $50 intervals
- **Moderate:** $25, $10 intervals
- **Minor:** $5 intervals

```typescript
import { analyzeRoundNumbers } from '@lib/utils/ts/psychological-fair-value';

const rounds = analyzeRoundNumbers(178.5);
// Finds $180 as nearest major level with magnetic pull
```

---

## Ticker Profiles

Different stocks have different "psychological profiles":

| Profile       | Best For          | Key Characteristics                  |
| ------------- | ----------------- | ------------------------------------ |
| `BLUE_CHIP`   | AAPL, MSFT, GOOGL | Institutional-driven, MAs respected  |
| `MEME_RETAIL` | GME, AMC, PLTR    | Round numbers strong, gamma squeezes |
| `ETF`         | SPY, QQQ, IWM     | Max pain very reliable, OPEX pinning |
| `LOW_FLOAT`   | Small caps        | Exaggerated gamma effects            |
| `DEFAULT`     | Unknown           | Balanced weighting                   |

### Auto-Detection

Profiles are auto-detected based on:

1. Known ticker lists
2. Price volatility
3. Options OI concentration

### Custom Profiles

```typescript
import { createCustomProfile } from '@lib/utils/ts/psychological-fair-value';

const myProfile = createCustomProfile('DEFAULT', {
  maxPain: 0.4, // Boost max pain weight
  roundNumber: 0.2, // Boost round number weight
});
```

---

## Multi-Expiration Analysis

For 30+ day holdings, the utility considers **multiple expirations**:

```typescript
// Automatically weights expirations by:
// - Time proximity (closer = more gravity)
// - Open interest (higher = more hedging)
// - OPEX significance (monthly > weekly)

const result = calculatePsychologicalFairValue({
  ticker: 'AAPL',
  technicalData: {...},
  expirations: [
    { dte: 5, ...weeklyExpiry },
    { dte: 12, ...monthlyOPEX },  // Gets 1.5x boost
    { dte: 40, ...nextMonth },
  ],
});
```

---

## Output Structure

```typescript
interface PsychologicalFairValue {
  // Core
  ticker: string;
  fairValue: number;
  currentPrice: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // Deviation
  deviationPercent: number;
  deviationDollars: number;
  bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH';

  // Profile used
  profile: TickerProfile;

  // Component breakdown
  components: PFVComponentBreakdown[];

  // Expirations analyzed
  expirationAnalysis: ExpirationAnalysis[];

  // Key price levels
  magneticLevels: MagneticLevel[];
  supportZone: { low: number; high: number } | null;
  resistanceZone: { low: number; high: number } | null;

  // AI-ready context
  aiContext: string;
  interpretation: string;
}
```

---

## AI Analyst Integration

The `aiContext` string is formatted for LLM consumption:

```typescript
const result = calculatePsychologicalFairValue({...});

// Pass to AI analyst
const analysis = await aiAnalyst.analyze(ticker, {
  additionalContext: result.aiContext,
});
```

Example context output:

```
=== PSYCHOLOGICAL FAIR VALUE: AAPL ===

Current Price: $178.50
Fair Value: $175.00
Deviation: -1.96%
Bias: BEARISH
Confidence: HIGH

COMPONENT BREAKDOWN:
  Max Pain: $175.00 (30% weight)
  Gamma Walls: $174.50 (10% weight)
  Technical Levels: $176.20 (25% weight)
  Volume Anchor: $177.80 (20% weight)
  Round Numbers: $175.00 (15% weight)

KEY MAGNETIC LEVELS:
  $175.00 - MAX_PAIN (-1.96%)
  $180.00 - ROUND_MAJOR (+0.84%)
  $170.00 - PUT_WALL (-4.76%)
  ...

=== END PFV ===
```

---

## Confidence Levels

| Level    | Description                                             |
| -------- | ------------------------------------------------------- |
| `HIGH`   | Components converge, good OI data, reasonable deviation |
| `MEDIUM` | Some divergence or limited data                         |
| `LOW`    | Significant divergence or sparse options data           |

---

## Usage Tips

### When PFV is Most Useful

1. **Pre-OPEX positioning** - Max pain magnetism strongest 0-7 days out
2. **Mean reversion plays** - When price deviates significantly from PFV
3. **Setting stop losses** - Use support/resistance zones
4. **Understanding price "stickiness"** - Why price consolidates at levels

### When to Be Cautious

1. **During earnings** - Volatility can overwhelm options mechanics
2. **Black swan events** - All bets are off during market shocks
3. **Low OI stocks** - Options mechanics less reliable
4. **Very far expirations** - Max pain gravitational pull weakens

---

## File Structure

```
lib/utils/ts/psychological-fair-value/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── profiles.ts           # Ticker profile definitions
├── max-pain.ts           # Max pain calculation
├── gamma-walls.ts        # Gamma wall detection
├── technical-levels.ts   # MA/S&R analysis
├── round-numbers.ts      # Psychological levels
├── multi-expiry.ts       # Multi-expiration weighting
└── calculator.ts         # Main PFV calculator
```

---

## Shared Library Usage

The PFV module is a **shared library** used by multiple packages:

### Import Paths

```typescript
// From ai-analyst (CLI)
import { getPsychologicalFairValue } from '../services/psychological-fair-value';
import type { PsychologicalFairValue } from '../../../lib/utils/ts/psychological-fair-value/types';

// From lib/ai-agent (shared tools)
import type { PsychologicalFairValue, PFVSummary } from '@lib/ai-agent';

// From frontend
import type { PFVSummary, ConfidenceLevel, BiasSentiment } from '@lib/ai-agent';
```

### Types for Display vs Full Analysis

| Type                     | Use Case                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `PFVSummary`             | Simplified type for TickerData display (fairValue, bias, confidence, deviationPercent) |
| `PsychologicalFairValue` | Full analysis with components, magnetic levels, zones, aiContext                       |

### Frontend Integration

The frontend receives PFV data via the chat API through `TickerData.pfv`:

```typescript
// In ticker-data-card.tsx
{pfv && (
  <div>
    <span>${pfv.value.toFixed(2)}</span>
    <span>{pfv.divergence.toFixed(1)}%</span>
    <span>{pfv.bias}</span>
  </div>
)}
```

---

## Future Enhancements

- [x] ~~Frontend visualization component~~ ✅ Implemented in chat cards
- [x] ~~Shared types with frontend~~ ✅ Via @lib/ai-agent
- [ ] Historical validation script (backtest PFV accuracy)
- [ ] Real-time OI updates integration
- [ ] Volume profile integration
- [ ] Python port for scanner integration
