# Signal Performance Tracking System

> **Goal**: Track and validate CDS engine signals to measure accuracy over time

## Overview

When the scanner identifies an opportunity (e.g., MSFT 73pts), we need to track:

1. Did entering at that signal result in profit?
2. What was the optimal entry timing?
3. Which signal types (RSI entry zone, pullback, etc.) perform best?

This data validates and improves the scoring system.

---

## Data Model

### Signal Table (`cds_signals`)

```sql
CREATE TABLE cds_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Signal identification
  ticker VARCHAR(10) NOT NULL,
  signal_date DATE NOT NULL,
  signal_score INTEGER NOT NULL,
  signal_grade VARCHAR(1), -- A, B, C based on score

  -- Market context
  regime VARCHAR(20), -- bull, neutral, bear, caution
  sector VARCHAR(50),

  -- Signal details (JSONB for flexibility)
  signals JSONB, -- Array of individual signals
  price_at_signal DECIMAL(12, 2),
  ma50_at_signal DECIMAL(12, 2),
  ma200_at_signal DECIMAL(12, 2),
  rsi_at_signal DECIMAL(5, 2),

  -- Spread info (if found)
  spread_viable BOOLEAN DEFAULT FALSE,
  spread_strikes VARCHAR(20),
  spread_debit DECIMAL(10, 2),
  spread_cushion DECIMAL(5, 2),
  spread_pop DECIMAL(5, 2),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ticker, signal_date)
);
```

### Outcome Table (`cds_signal_outcomes`)

```sql
CREATE TABLE cds_signal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES cds_signals(id),

  -- Entry tracking
  entry_date DATE,
  entry_price DECIMAL(12, 2),
  entry_decision VARCHAR(20), -- entered, skipped, missed

  -- Exit tracking
  exit_date DATE,
  exit_price DECIMAL(12, 2),
  exit_reason VARCHAR(20), -- target, stop, time, earnings, manual

  -- Performance
  pnl_dollars DECIMAL(12, 2),
  pnl_percent DECIMAL(8, 4),
  days_held INTEGER,
  max_gain_percent DECIMAL(8, 4),
  max_drawdown_percent DECIMAL(8, 4),

  -- Post-analysis
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Workflow

### 1. Signal Capture (Automatic)

When `bun run cds:scan` runs:

```
Scanner finds MSFT @ 73pts
  ↓
Log to cds_signals table:
  - ticker: MSFT
  - signal_date: 2026-01-07
  - signal_score: 73
  - regime: caution
  - signals: ["RSI Entry Zone", "Near MA50 Support"]
  - price_at_signal: 483.47
```

### 2. Entry Tracking (Semi-automatic)

When you enter a trade:

```bash
bun run cds:track enter MSFT --price 482.50
```

Or mark as skipped:

```bash
bun run cds:track skip MSFT --reason "no viable spread"
```

### 3. Exit Tracking (Semi-automatic)

When you exit:

```bash
bun run cds:track exit MSFT --price 495.00 --reason target
```

### 4. Performance Analysis (Automatic)

```bash
bun run cds:performance
```

```
Signal Performance (Last 30 Days)
═════════════════════════════════════════

Overall:
  Signals Generated: 45
  Trades Entered: 12
  Win Rate: 75%
  Avg Return: +18.5%
  Profit Factor: 2.1

By Grade:
  Grade A (≥80): 3 signals, 100% win rate, +28% avg
  Grade B (70-79): 22 signals, 78% win rate, +19% avg
  Grade C (60-69): 20 signals, 65% win rate, +12% avg

By Signal Type:
  RSI Entry Zone: 85% correlation with wins
  Pullback to MA50: 72% correlation
  Volume Surge: 68% correlation

By Regime:
  Bull: 88% win rate
  Caution: 71% win rate
  Bear: 45% win rate (sample size: 2)
```

---

## Implementation Phases

### Phase 1: Signal Capture (Week 1)

- [ ] Create Supabase table `cds_signals`
- [ ] Modify scanner to log signals automatically
- [ ] Add `--track` flag to scan command

### Phase 2: Entry/Exit Tracking (Week 2)

- [ ] Create `cds_signal_outcomes` table
- [ ] Add `cds:track` command with enter/exit/skip subcommands
- [ ] Integrate with watchlist for auto-tracking

### Phase 3: Analysis Dashboard (Week 3)

- [ ] Add `cds:performance` command
- [ ] Calculate win rate, profit factor, correlation
- [ ] Identify best/worst performing signal types

### Phase 4: Frontend Integration (Week 4)

- [ ] Display signal history in frontend
- [ ] Show performance metrics
- [ ] Visualize signal accuracy over time

---

## Commands Reference

```bash
# Automatic signal logging (enhanced scan)
bun run cds:scan --track

# Manual entry tracking
bun run cds:track enter MSFT --price 482.50 --spread "470/480"
bun run cds:track skip MSFT --reason "IV too high"
bun run cds:track exit MSFT --price 495.00 --reason target

# Performance analysis
bun run cds:performance              # Last 30 days
bun run cds:performance --days 90    # Last 90 days
bun run cds:performance --ticker MSFT # Single ticker history

# List recent signals
bun run cds:signals                  # Recent signals
bun run cds:signals --pending        # Signals without outcomes
```

---

## Success Metrics

After 3 months of data:

| Metric              | Target |
| ------------------- | ------ |
| Grade A win rate    | ≥80%   |
| Grade B win rate    | ≥70%   |
| Profit factor       | ≥1.5   |
| Avg days held       | 10-20  |
| Signal → Entry rate | ≥30%   |

---

## Integration Points

- **Scanner**: Auto-log signals when found
- **Watchlist**: Track which signals are being watched
- **Briefing**: Show pending signals and recent performance
- **Frontend**: Display historical performance charts

---

**Status**: Planning  
**Priority**: High (validates the entire system)  
**Estimated Effort**: 2-3 weeks
