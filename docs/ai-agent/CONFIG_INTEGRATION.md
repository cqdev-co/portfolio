# Strategy Config Integration

The `lib/ai-agent` package now uses `strategy.config.yaml` as a single source of truth for trading rules. This ensures consistency across all services and allows rules to evolve as lessons are learned.

## Overview

Previously, trading rules (RSI thresholds, cushion requirements, exit rules) were hardcoded throughout the codebase. After Lesson 001 (AVGO), we centralized all rules in `strategy.config.yaml` and updated `lib/ai-agent` to read from it.

## Architecture

```
strategy.config.yaml          (Single source of truth)
        │
        ▼
lib/ai-agent/config/index.ts  (Config loader + helpers)
        │
        ├── scanner/index.ts  (Uses config for grading)
        ├── prompts/victor.ts (Uses config for system prompts)
        └── options/spreads.ts (Uses config for spread params)
```

## Usage

### Loading the Config

```typescript
import {
  getStrategyConfig,
  getEntryConfig,
  getExitConfig,
} from '@lib/ai-agent';

// Get full config
const config = getStrategyConfig();

// Get specific sections
const entry = getEntryConfig();
const exit = getExitConfig();
```

### Exit Rule Helpers

The config module provides helpers for exit decisions based on Lesson 001:

```typescript
import {
  shouldCloseOnProfit,
  shouldCloseOnDTE,
  checkPinRisk,
  getExitRecommendation,
} from '@lib/ai-agent';

// Check if profit target reached
const { shouldClose, reason } = shouldCloseOnProfit(75); // 75% profit captured
// { shouldClose: true, reason: "Profit 75% >= target 75% - recommend closing" }

// Check if DTE is in danger zone
const dteCheck = shouldCloseOnDTE(4);
// { shouldClose: true, urgency: 'FORCED', reason: "4 DTE <= forced exit threshold (5)" }

// Check for pin risk
const pinCheck = checkPinRisk(2.5, 3); // 2.5% cushion, 3 DTE
// { hasRisk: true, urgency: 'EXIT', reason: "Cushion 2.5% <= 2% with 3 DTE - EXIT" }

// Get comprehensive recommendation
const rec = getExitRecommendation(profitPct, dte, cushionPct);
// { action: 'CLOSE' | 'HOLD' | 'MONITOR', urgency: 'IMMEDIATE' | 'SOON' | 'NORMAL', reasons: [...] }
```

### Entry Validation Helpers

```typescript
import { isRSIValid, isCushionValid, isEarningsSafe } from '@lib/ai-agent';

// Check RSI (with optional ADX for trend exception)
const rsiCheck = isRSIValid(52, 45); // RSI 52, ADX 45
// { valid: true, reason: "RSI 52 in ideal range (35-50)" }

// Check cushion
const cushionCheck = isCushionValid(8.5);
// { valid: true, quality: 'MINIMUM', reason: "8.5% cushion at minimum (7%)" }

// Check earnings
const earningsCheck = isEarningsSafe(21);
// { safe: true, reason: "Earnings 21 days out >= preferred (21)" }
```

### Position Sizing

```typescript
import { getMaxPositionSize, getSpreadWidth } from '@lib/ai-agent';

// Get max position for account size
const maxPos = getMaxPositionSize(5000); // $5,000 account
// Returns based on scaling tiers in config

// Get appropriate spread width
const width = getSpreadWidth(5000); // $5,000 account
// Returns 5 or 7.5 based on account tier
```

## Config Sections

### Entry Config

Controls when to enter trades:

```yaml
entry:
  momentum:
    rsi_min: 30
    rsi_max: 55
    rsi_ideal_min: 35
    rsi_ideal_max: 50
  cushion:
    minimum_pct: 7.0
    preferred_pct: 10.0
    excellent_pct: 15.0
  earnings:
    min_days_until: 14
    preferred_days_until: 21
```

### Exit Config (Lesson 001)

Controls when to exit trades - heavily influenced by Lesson 001:

```yaml
exit:
  profit:
    min_acceptable_pct: 50 # Floor
    target_pct: 75 # Target
    greed_limit_pct: 80 # Hard ceiling
  time:
    gamma_risk_zone_dte: 7 # Warning zone
    forced_exit_dte: 5 # MUST close
  pin_risk:
    cushion_exit_pct: 2 # Emergency exit
    dte_threshold: 3 # Only within final 3 days
```

### Lessons Tracking

The config tracks which lessons influenced which rules:

```yaml
lessons:
  - id: '001'
    title: "Don't Hold Spreads to Expiration for Max Profit"
    rules_changed:
      - 'exit.profit.target_pct: 35 → 75'
      - 'exit.time.forced_exit_dte: NEW at 5 DTE'
```

## How Components Use Config

### Scanner (`scanner/index.ts`)

The grading function now uses config values:

```typescript
// Before (hardcoded)
if (input.rsi >= 35 && input.rsi <= 55) { ... }

// After (config-based)
const { rsi_ideal_min, rsi_ideal_max } = entry.momentum;
if (input.rsi >= rsi_ideal_min && input.rsi <= rsi_ideal_max) { ... }
```

### Prompts (`prompts/victor.ts`)

System prompts dynamically include config values:

```typescript
export function buildTradingStrategy(): string {
  const entry = getEntryConfig();
  const spread = getSpreadParamsConfig();

  return `## Strategy: Deep ITM Call Debit Spreads
Target ${spread.dte.min}-${spread.dte.max} DTE.
RSI ${entry.momentum.rsi_ideal_min}-${entry.momentum.rsi_ideal_max} = ideal entry zone`;
}
```

### Key Rules now include exit rules:

```typescript
export function buildKeyRules(accountSize: number): string {
  const exit = getExitConfig();

  return `## Exit Rules (from strategy.config.yaml)
• Target: ${exit.profit.target_pct}% of max profit
• Greed Limit: ${exit.profit.greed_limit_pct}% - NEVER hold past this
• Forced Exit: ${exit.time.forced_exit_dte} DTE - close regardless of P&L`;
}
```

## Benefits

1. **Single Source of Truth**: Change rules in one place, affects all services
2. **Lessons → Rules Pipeline**: Document lesson, update config, code reflects it
3. **Audit Trail**: `lessons` section tracks why rules changed
4. **Type Safety**: Full TypeScript types for config structure
5. **Helper Functions**: Pre-built logic for common exit/entry decisions

## Testing

```typescript
import { setConfigPath, clearConfigCache } from '@lib/ai-agent';

// Use test config
setConfigPath('./test/fixtures/test-strategy.config.yaml');

// Clear cache between tests
beforeEach(() => clearConfigCache());
```

## Future Improvements

1. **Live Reload**: Watch config file for changes in development
2. **Validation**: JSON Schema validation of config
3. **CLI Override**: Allow `--config` flag to use different config
4. **Per-Ticker Overrides**: Allow ticker-specific rule adjustments

---

_Last Updated: January 2026_
_Related: [Lesson 001](../lessons/001-holding-till-max-profit.md)_
