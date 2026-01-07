# Strategy Configuration Reference

> **Centralized configuration for the Deep ITM Call Debit Spread strategy**

The `strategy.config.yaml` file in the repository root defines all entry/exit
criteria, position sizing rules, and risk management parameters.

## File Location

```
/portfolio/strategy.config.yaml
```

## How It's Used

The strategy config is used by:

1. **screen-ticker `scan` command** - Decision engine checks criteria
2. **Python `spread_quant_analysis.py`** - Validates historical trades
3. **Human reference** - Checklist for manual trade evaluation

### Python Usage

```python
from lib.utils.strategy_config import (
    validate_entry,
    get_position_sizing,
    is_ticker_allowed,
    get_ticker_tier,
)

# Validate a potential trade
result = validate_entry(
    price=188.61,
    ma200=175.00,
    rsi=42,
    cushion_pct=8.5,
    iv=35,
    days_to_earnings=25,
    analyst_bullish_pct=85,
)

if result.passed:
    print(f"✅ ENTER (Score: {result.score})")
else:
    print(f"❌ PASS: {', '.join(result.failures)}")

# Get position sizing
sizing = get_position_sizing(5000)
print(f"Max position: ${sizing.max_position_dollars:.0f}")
```

---

## Configuration Sections

### Entry Criteria

All criteria must be satisfied for a valid entry signal.

```yaml
entry:
  trend:
    above_ma200: true # REQUIRED: Price > 200-day MA
    above_ma50: true # PREFERRED: Price > 50-day MA

  momentum:
    rsi_min: 30 # Not oversold (catching knives)
    rsi_max: 55 # Not overbought (chasing)
    rsi_ideal_min: 35 # Sweet spot lower
    rsi_ideal_max: 50 # Sweet spot upper

  cushion:
    minimum_pct: 7.0 # HARD FLOOR - never below
    preferred_pct: 10.0 # Ideal cushion
    excellent_pct: 15.0 # Strong conviction

  volatility:
    iv_max_pct: 50 # Max implied volatility
    avoid_if_iv_above: 60 # HARD CEILING

  earnings:
    min_days_until: 14 # Minimum buffer
    never_hold_through: true

  sentiment:
    analyst_bullish_min_pct: 70 # Min bullish %
```

### Exit Rules

```yaml
exit:
  profit:
    target_pct: 35 # Take profits at +35%

  stop_loss:
    max_loss_pct: 40 # Cut losses at -40%

  time:
    max_hold_days: 30 # Reassess after 30 days
    exit_before_expiry_days: 7 # Never hold to expiration
```

### Position Sizing

```yaml
position_sizing:
  max_single_position_pct: 20 # Max per position
  max_total_deployed_pct: 65 # Max capital deployed

  scaling:
    - account_min: 0
      account_max: 5000
      max_position_pct: 20
      max_positions: 4
    - account_min: 5000
      account_max: 10000
      max_position_pct: 15
      max_positions: 6
    # ... scales with account size
```

### Risk Management

```yaml
risk_management:
  circuit_breakers:
    consecutive_losses_pause: 3 # Pause after 3 losses
    pause_duration_hours: 48
    monthly_drawdown_stop_pct: 30 # Stop if -30% monthly

  blacklist:
    tickers:
      - CRWD # Tickers to never trade
    sectors: []
```

### Ticker Universe

```yaml
universe:
  tier1: # Primary focus (trade frequently)
    - AAPL
    - MSFT
    - GOOGL
    # ...

  tier2: # Secondary (trade selectively)
    - NVDA
    - AMD
    # ...

  tier3: # Opportunistic (strong signals only)
    - TSLA
    - JPM
    # ...
```

---

## Validation Scoring

The validation function returns a score from 0-100 based on how well the
entry matches the criteria:

| Score  | Strength | Action                   |
| ------ | -------- | ------------------------ |
| 85-100 | STRONG   | Enter with full position |
| 70-84  | MODERATE | Enter with reduced size  |
| 55-69  | WEAK     | Wait for better setup    |
| 0-54   | INVALID  | Do not trade             |

### Scoring Breakdown

```
Base Score: 100

Deductions:
- Price below MA200: -25
- RSI outside range: -15 to -20
- Cushion below minimum: -20
- IV above hard limit: -25
- Earnings too close: -20
- Analyst below minimum: -15

Bonuses:
- RSI in ideal zone: +5
- Excellent cushion: +10
- Low IV: +5
- Strong analyst support: +5
```

---

## CLI Integration

### Screen Ticker

The `scan` command automatically validates against strategy criteria through
its decision engine:

```bash
cd screen-ticker
bun run scan              # Scan with decision engine
bun run scan:sp500        # Scan S&P 500 (min score 80)
bun run scan-spreads      # Find viable spreads
```

The decision engine evaluates:

- Technical score (RSI, MA200, MA50, support levels)
- Fundamental score (analyst ratings, earnings)
- Market regime (bull/neutral/bear)
- Spread quality (cushion, delta, DTE)

Output shows **ENTER / WAIT / PASS** decisions based on the strategy rules.

### Spread Quant Analysis

```bash
# Show trade database
python scripts/spread_quant_analysis.py show

# Check data coverage
python scripts/spread_quant_analysis.py coverage
```

---

## Adding/Modifying Rules

To change the strategy:

1. Edit `strategy.config.yaml` in repository root
2. Update documentation in `docs/strategy/README.md`
3. Services automatically pick up changes (they read the config file)

**Important**: All changes should go through the config file, not hardcoded
in individual services. This ensures consistency across the monorepo.

---

## Related Documentation

- [Strategy Overview](../strategy/README.md)
- [AI Analyst Integration](../ai-analyst/README.md)
- [Screen Ticker Usage](../screen-ticker/README.md)

---

**Last Updated**: 2026-01-06
