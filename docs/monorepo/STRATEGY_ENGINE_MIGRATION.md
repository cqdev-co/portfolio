# Strategy Engine Migration Plan

> **Goal**: Transform the monorepo from a flat scanner structure to a
> modular strategy engine platform.

## Overview

### Current State

```
portfolio/
├── screen-ticker/          # Everything in one place
├── lib/
│   ├── ai-agent/
│   ├── types/
│   └── utils/
├── frontend/
├── ai-analyst/
└── cloudflare/
```

### Target State

```
portfolio/
├── lib/
│   ├── ai-agent/           # AI logic, prompts
│   ├── types/              # Shared types
│   ├── utils/              # Strategy config, utilities
│   └── core/               # NEW: Shared trading infrastructure
│       ├── regime/         # Market regime detection
│       ├── positions/      # Position tracking
│       ├── risk/           # Circuit breakers, sizing
│       ├── earnings/       # Earnings calendar
│       ├── sectors/        # Sector rotation
│       └── market-data/    # Yahoo provider, proxy client
│
├── cds-engine-strategy/    # Call Debit Spread engine
├── pds-engine-strategy/    # 🔒 Future: Put Debit Spread
├── ic-engine-strategy/     # 🔒 Future: Iron Condor
│
├── frontend/
├── ai-analyst/
└── cloudflare/
```

---

## Migration Phases

### Phase 1: Rename & Restructure

- [ ] Rename `screen-ticker/` → `cds-engine-strategy/`
- [ ] Update root `package.json` workspaces
- [ ] Update all import paths
- [ ] Update documentation references
- [ ] Verify builds pass

### Phase 2: Create lib/core

- [ ] Create `lib/core/` package structure
- [ ] Add package.json with proper exports
- [ ] Set up TypeScript config

### Phase 3: Extract Shared Code

- [ ] Move regime detection to `lib/core/regime/`
- [ ] Move sector rotation to `lib/core/sectors/`
- [ ] Move earnings calendar to `lib/core/earnings/`
- [ ] Move market data providers to `lib/core/market-data/`
- [ ] Create position tracking in `lib/core/positions/`
- [ ] Create risk management in `lib/core/risk/`

### Phase 4: Update Imports

- [ ] Update `cds-engine-strategy` to import from `@portfolio/core`
- [ ] Remove duplicated code from strategy
- [ ] Verify all functionality works

### Phase 5: Documentation

- [ ] Update README files
- [ ] Update process flow docs
- [ ] Create strategy-specific docs

---

## Detailed Steps

### Step 1: Rename screen-ticker

```bash
# Rename directory
mv screen-ticker cds-engine-strategy

# Update package.json name
# "name": "@portfolio/screen-ticker" → "@portfolio/cds-engine-strategy"
```

### Step 2: Update Root package.json

```json
{
  "workspaces": [
    "frontend",
    "lib/*",
    "cds-engine-strategy",
    "ai-analyst",
    "cloudflare"
  ],
  "scripts": {
    "cds": "bun run --cwd cds-engine-strategy scan-all",
    "cds:scan": "bun run --cwd cds-engine-strategy scan",
    "cds:spreads": "bun run --cwd cds-engine-strategy scan-spreads",
    "cds:regime": "bun run --cwd cds-engine-strategy regime",
    "cds:sectors": "bun run --cwd cds-engine-strategy sectors",
    "cds:earnings": "bun run --cwd cds-engine-strategy earnings",
    "cds:watchlist": "bun run --cwd cds-engine-strategy watchlist"
  }
}
```

### Step 3: Create lib/core Structure

```
lib/core/
├── src/
│   ├── index.ts              # Main exports
│   ├── regime/
│   │   ├── index.ts
│   │   ├── detector.ts       # Market regime detection
│   │   └── types.ts
│   ├── positions/
│   │   ├── index.ts
│   │   ├── tracker.ts        # Position tracking
│   │   └── types.ts
│   ├── risk/
│   │   ├── index.ts
│   │   ├── circuit-breakers.ts
│   │   ├── position-sizing.ts
│   │   └── types.ts
│   ├── earnings/
│   │   ├── index.ts
│   │   └── calendar.ts
│   ├── sectors/
│   │   ├── index.ts
│   │   └── rotation.ts
│   └── market-data/
│       ├── index.ts
│       ├── yahoo-provider.ts
│       ├── proxy-client.ts
│       └── types.ts
├── package.json
└── tsconfig.json
```

### Step 4: lib/core/package.json

```json
{
  "name": "@portfolio/core",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./regime": "./src/regime/index.ts",
    "./positions": "./src/positions/index.ts",
    "./risk": "./src/risk/index.ts",
    "./earnings": "./src/earnings/index.ts",
    "./sectors": "./src/sectors/index.ts",
    "./market-data": "./src/market-data/index.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.86.0",
    "yahoo-finance2": "^3.10.2",
    "technicalindicators": "^3.1.0"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

---

## Code Movement Map

| From (cds-engine-strategy)        | To (lib/core)                   |
| --------------------------------- | ------------------------------- |
| `src/commands/regime.ts`          | `regime/detector.ts`            |
| `src/commands/sector-rotation.ts` | `sectors/rotation.ts`           |
| `src/commands/earnings.ts`        | `earnings/calendar.ts`          |
| `src/commands/watchlist.ts`       | `positions/` (partial)          |
| `src/providers/yahoo.ts`          | `market-data/yahoo-provider.ts` |
| `src/providers/shared-yahoo.ts`   | `market-data/proxy-client.ts`   |

**Keep in cds-engine-strategy:**

- `src/signals/` — CDS-specific signal logic
- `src/engine/` — CDS-specific decision engine
- `src/commands/scan.ts` — CDS scanning
- `src/commands/scan-spreads.ts` — CDS spread finding
- `src/config/strategy.ts` — CDS strategy config

---

## Import Updates Example

### Before

```typescript
// cds-engine-strategy/src/commands/scan.ts
import { getMarketRegime } from '../providers/yahoo';
import { analyzeSectorRotation } from './sector-rotation';
```

### After

```typescript
// cds-engine-strategy/src/commands/scan.ts
import { getMarketRegime } from '@portfolio/core/regime';
import { analyzeSectorRotation } from '@portfolio/core/sectors';
```

---

## Testing Checklist

After migration, verify:

- [ ] `bun run cds:regime` — Shows market regime
- [ ] `bun run cds:sectors` — Shows sector rotation
- [ ] `bun run cds:scan --list mega` — Scans stocks
- [ ] `bun run cds:spreads --from-scan` — Finds spreads
- [ ] `bun run cds:earnings --tickers AAPL` — Shows earnings
- [ ] `bun run cds:watchlist` — Shows watchlist
- [ ] `bun run build` — Turbo build passes
- [ ] `bun run typecheck` — No type errors

---

## Future Strategy Template

When adding `pds-engine-strategy`:

1. Create directory structure
2. Add to workspaces in root package.json
3. Import shared code from `@portfolio/core`
4. Implement PDS-specific:
   - Signal detection (bearish signals)
   - Spread finding (put spreads)
   - Strategy config

---

## Rollback Plan

If issues arise:

```bash
# Revert rename
mv cds-engine-strategy screen-ticker

# Revert package.json changes
git checkout package.json

# Remove lib/core if created
rm -rf lib/core
```

---

## Timeline Estimate

| Phase                    | Estimated Time |
| ------------------------ | -------------- |
| Phase 1: Rename          | 30 minutes     |
| Phase 2: Create lib/core | 30 minutes     |
| Phase 3: Extract code    | 1-2 hours      |
| Phase 4: Update imports  | 30 minutes     |
| Phase 5: Documentation   | 30 minutes     |
| **Total**                | **3-4 hours**  |

---

## Status

| Phase   | Status      | Notes                             |
| ------- | ----------- | --------------------------------- |
| Phase 1 | ✅ Complete | Renamed to cds-engine-strategy    |
| Phase 2 | ✅ Complete | lib/core created with all modules |
| Phase 3 | ✅ Complete | Core logic extracted              |
| Phase 4 | ✅ Complete | Imports working                   |
| Phase 5 | ✅ Complete | Docs updated                      |

## What Was Built

### lib/core Modules

| Module                        | Description              | Status                  |
| ----------------------------- | ------------------------ | ----------------------- |
| `@portfolio/core/sectors`     | Sector rotation analysis | ✅ Full impl            |
| `@portfolio/core/earnings`    | Earnings calendar        | ✅ Full impl            |
| `@portfolio/core/regime`      | Market regime detection  | 🔲 Stub (uses existing) |
| `@portfolio/core/positions`   | Position tracking        | ✅ Full impl            |
| `@portfolio/core/risk`        | Circuit breakers         | ✅ Full impl            |
| `@portfolio/core/market-data` | Provider interfaces      | ✅ Types only           |

### Root Commands

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `bun run cds`           | Full CDS engine briefing |
| `bun run cds:scan`      | Scan for opportunities   |
| `bun run cds:scan-all`  | Scan + find spreads      |
| `bun run cds:spreads`   | Find spreads from scan   |
| `bun run cds:regime`    | Check market regime      |
| `bun run cds:sectors`   | Sector rotation analysis |
| `bun run cds:earnings`  | Earnings calendar        |
| `bun run cds:watchlist` | Manage watchlist         |

---

**Last Updated**: 2026-01-07
