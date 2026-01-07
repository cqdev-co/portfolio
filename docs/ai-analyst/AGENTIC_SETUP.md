# Agentic Victor - Setup Guide

This guide walks you through setting up Agentic Victor for autonomous market monitoring and Discord alerts.

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Supabase account with project created
- Discord server with webhook access

## 1. Database Setup

Run the agent schema in your Supabase SQL Editor:

```bash
# The schema file is at:
db/agent_schema.sql
```

This creates the following tables:

- `agent_watchlist` - Tickers to monitor
- `agent_alerts` - Alert history
- `agent_scan_history` - Scan analytics
- `agent_briefings` - Morning briefings archive
- `agent_config` - System configuration
- `agent_alert_cooldowns` - Rate limiting per ticker

## 2. Discord Webhook Setup

### Create a Discord Webhook

1. Open Discord and go to your server
2. Right-click the channel where you want alerts → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Name it "Victor" (or anything you prefer)
6. Copy the webhook URL

### Configure Environment

Add the webhook URL to your `.env` file in the repository root:

```bash
# .env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### Test the Connection

```bash
cd ai-analyst
bun run analyst agent test-discord
```

You should see a test message in your Discord channel.

## 3. Watchlist Configuration

### Add Tickers to Watch

```bash
# Add multiple tickers
bun run analyst watch add NVDA AAPL GOOGL TSM AMD

# Add with custom thresholds
bun run analyst watch add META --rsi-low 30 --rsi-high 50 --cushion 10
```

### View Your Watchlist

```bash
bun run analyst watch list
```

### Configure Individual Tickers

```bash
# Adjust thresholds for a specific ticker
bun run analyst watch configure NVDA --rsi-low 30 --cushion 10 --grade A

# Add notes
bun run analyst watch configure AAPL --notes "Watch for earnings Q1"

# Disable monitoring (without removing)
bun run analyst watch configure MSFT --inactive
```

### Remove from Watchlist

```bash
bun run analyst watch remove NVDA
```

## 4. Alert Configuration

Alerts can be configured via the `agent_config` table or CLI:

| Config Key          | Default | Description                                  |
| ------------------- | ------- | -------------------------------------------- |
| `scan_interval_ms`  | 1800000 | Scan interval (30 min)                       |
| `briefing_time`     | "09:00" | Morning briefing time (ET)                   |
| `alert_cooldown_ms` | 7200000 | Cooldown between alerts per ticker (2 hours) |
| `discord_enabled`   | true    | Enable Discord notifications                 |
| `ai_review_enabled` | true    | AI validates alerts before sending           |
| `min_conviction`    | 6       | Minimum AI conviction score (1-10)           |

## 5. Running the Agent

### Start the Background Monitor

```bash
# Start the agent daemon
bun run analyst agent start

# Start with debug mode (shows why each ticker is rejected)
bun run analyst agent start --debug

# Scan 24/7 instead of just market hours
bun run analyst agent start --extended-hours

# Check agent status
bun run analyst agent status

# Stop the agent
bun run analyst agent stop
```

### Debug: Single Scan with Full Output

Run a one-time scan to see exactly why tickers are being filtered:

```bash
bun run analyst agent dry-run
```

This shows:

- ✅ Tickers that **would** trigger alerts (and why)
- ❌ Tickers that were **filtered out** (with detailed rejection reasons)
- Each criteria check (RSI, IV, cushion, grade) with ✓ or ✗

### Generate a Briefing On-Demand

```bash
# Generate and display morning briefing
bun run analyst briefing

# View past briefings
bun run analyst briefing history
```

### View Alerts

```bash
# View recent alerts
bun run analyst alerts

# Acknowledge an alert
bun run analyst alerts ack <alert-id>
```

## 6. Alert Types

Victor monitors for:

| Alert Type         | Description                        | Priority    |
| ------------------ | ---------------------------------- | ----------- |
| `ENTRY_SIGNAL`     | Grade A/B opportunity on watchlist | HIGH/MEDIUM |
| `EXIT_SIGNAL`      | Time to close position             | HIGH        |
| `POSITION_RISK`    | DTE < 5, cushion < 5%, etc.        | HIGH        |
| `EARNINGS_WARNING` | Earnings within 7 days             | MEDIUM      |
| `NEWS_EVENT`       | Material news detected             | MEDIUM      |
| `MACRO_EVENT`      | Fed/CPI/NFP impact                 | MEDIUM      |

## 7. Alert Criteria

Entry signals are triggered when ALL conditions are met:

- RSI in target range (configurable, default: 35-55)
- IV percentile below threshold (configurable via `--iv`, or pass if not set)
- Above 200-day MA
- Cushion above minimum (configurable, default: 8%)
- Grade meets minimum (configurable, default: B)
- No earnings within 7 days

**Note on IV:** The IV check passes if:

- No IV data available (weekend/illiquid options)
- No IV threshold configured (user doesn't care about IV)
- IV percentile is at or below the threshold (lower IV = cheaper spreads)

### Dynamic Threshold Adjustments

Thresholds automatically adjust based on market conditions:

| Condition                       | Adjustment          | Rationale                     |
| ------------------------------- | ------------------- | ----------------------------- |
| **Bull market** (SPY uptrend)   | RSI high +5         | Dips are shallow, widen range |
| **Bear market** (SPY downtrend) | RSI high -5, low -3 | Wait for real capitulation    |
| **High VIX** (>25)              | IV threshold +15%   | Everything is expensive       |
| **Elevated VIX** (20-25)        | IV threshold +8%    | Options moderately expensive  |
| **Low VIX** (<15)               | IV threshold -5%    | Can be stricter on IV         |
| **Ticker pullback** (>3% drop)  | RSI high +8         | Opportunity! Catch the dip    |
| **Ticker dip** (1.5-3% drop)    | RSI high +4         | Minor pullback                |
| **Volatile regime**             | Cushion -1%         | Accept tighter cushions       |

Run `bun run agent dry-run` to see dynamic adjustments in action:

```
🌡️  Market: RISK_ON | SPY 📈 BULLISH | VIX 14.2 (LOW)
Dynamic thresholds will adjust based on these conditions.

✅ WOULD TRIGGER ALERTS (1):
   NVDA [A+] — RSI 52, IV 35%, 8.2% cushion
      ⚡ Dynamic: Bull market: RSI +5 (shallow dips), Low VIX (14): IV -5%
```

## 8. Timezone Handling

All times are in **Eastern Time (ET)** regardless of your local timezone:

- **Market hours:** 9:30 AM - 4:00 PM ET
- **Morning briefing:** 9:00 AM ET (configurable)
- **All log timestamps:** Displayed in ET

The agent uses the `America/New_York` timezone which automatically handles DST.

Position risk alerts trigger when ANY of these occur:

- DTE drops below 5 days
- Cushion drops below 5%
- Earnings approaching within 7 days

## 8. Cost Estimates

| Component                   | Frequency       | Est. Cost       |
| --------------------------- | --------------- | --------------- |
| Watchlist Scan (10 tickers) | Every 30 min    | ~$0.02/scan     |
| AI Alert Review             | Per opportunity | ~$0.01/review   |
| Morning Briefing            | Daily           | ~$0.05/briefing |

**Monthly estimate:** ~$15-30 (with TOON encoding and smart caching)

## Troubleshooting

### Discord Not Receiving Alerts

1. Check `DISCORD_WEBHOOK_URL` is set correctly in `.env`
2. Test webhook: `bun run analyst agent test-discord`
3. Check Discord channel permissions

### Agent Not Scanning

1. Check Supabase connection: ensure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set
2. Check agent status: `bun run analyst agent status`
3. View logs in the terminal where agent is running

### Too Many/Few Alerts

Use the debug tools to diagnose:

```bash
# See exactly why tickers are being filtered
bun run analyst agent dry-run

# Or run the agent with debug logging
bun run analyst agent start --debug
```

Adjust alert criteria:

- **Too many:** Increase `min_conviction`, raise grade threshold
- **Too few:** Lower thresholds (RSI range, cushion minimum, grade)

## Environment Variables Summary

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Required for Discord alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Required for AI analysis
OLLAMA_API_KEY=your-ollama-api-key
```
