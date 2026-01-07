# 🤖 Agentic Victor - Project Roadmap

> **Vision:** Transform Victor from a reactive analyst into a proactive trading
> assistant that autonomously monitors markets, identifies opportunities, and
> alerts you to high-conviction setups.

---

## 📋 Project Overview

| Attribute             | Value                                                    |
| --------------------- | -------------------------------------------------------- |
| **Project Name**      | Agentic Victor                                           |
| **Start Date**        | TBD                                                      |
| **Target Completion** | ~4-6 weeks                                               |
| **Stack**             | TypeScript, Bun, Supabase, Discord Webhooks, DeepSeek-v3 |
| **Priority**          | High                                                     |

---

## 🎯 Goals

1. **Proactive Opportunity Detection** - Victor scans markets without prompting
2. **Real-Time Alerts** - Discord notifications for high-conviction setups
3. **Morning Briefings** - Daily market summary with actionable insights
4. **Watchlist Monitoring** - Track specific tickers for entry signals
5. **Position Management** - Alerts for held positions (roll, exit, risk)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENTIC VICTOR SYSTEM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Market    │  │    News     │  │  Economic   │  │  Position │ │
│  │   Scanner   │  │   Monitor   │  │  Calendar   │  │  Tracker  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │                │                │       │
│         └────────────────┼────────────────┼────────────────┘       │
│                          ▼                                         │
│                 ┌─────────────────┐                                │
│                 │   Data Layer    │                                │
│                 │   (Supabase)    │                                │
│                 └────────┬────────┘                                │
│                          ▼                                         │
│                 ┌─────────────────┐                                │
│                 │  AI Reasoning   │                                │
│                 │ (DeepSeek-v3.1) │                                │
│                 └────────┬────────┘                                │
│                          ▼                                         │
│                 ┌─────────────────┐                                │
│                 │ Alert Decision  │                                │
│                 │    Engine       │                                │
│                 └────────┬────────┘                                │
│                          ▼                                         │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │   Discord   │  │    CLI      │  │  Dashboard  │                │
│  │   Webhook   │  │   Alerts    │  │   (Future)  │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Supabase Schema

### Tables

```sql
-- User watchlist
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  target_rsi_low DECIMAL DEFAULT 35,
  target_rsi_high DECIMAL DEFAULT 55,
  target_iv_percentile DECIMAL DEFAULT 50,
  active BOOLEAN DEFAULT TRUE
);

-- Triggered alerts history
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  -- Types: ENTRY_SIGNAL, EXIT_SIGNAL, NEWS_EVENT,
  --        EARNINGS_WARNING, POSITION_RISK, MACRO_EVENT
  priority VARCHAR(20) NOT NULL,
  -- Priority: HIGH, MEDIUM, LOW
  headline TEXT NOT NULL,
  analysis TEXT,
  data JSONB,
  -- Full ticker data, spread recommendation, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ
);

-- Scan history (for analytics and avoiding duplicate alerts)
CREATE TABLE scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type VARCHAR(50) NOT NULL,
  -- Types: WATCHLIST, SECTOR, FULL_MARKET, POSITION_CHECK
  tickers_scanned INTEGER,
  opportunities_found INTEGER,
  alerts_triggered INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Morning briefings archive
CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  market_summary TEXT,
  watchlist_alerts JSONB,
  position_updates JSONB,
  calendar_events JSONB,
  ai_commentary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration
CREATE TABLE config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚀 Roadmap

### Phase 1: Foundation (Week 1-2)

> **Goal:** Core infrastructure and basic scanning

| Task | Description                               | Priority  |
| ---- | ----------------------------------------- | --------- |
| 1.1  | Set up Supabase tables and RLS policies   | 🔴 High   |
| 1.2  | Create `src/services/supabase.ts` client  | 🔴 High   |
| 1.3  | Implement watchlist CRUD operations       | 🔴 High   |
| 1.4  | Build basic market scanner service        | 🔴 High   |
| 1.5  | Add CLI commands: `watch add/remove/list` | 🟡 Medium |

**Deliverables:**

- [ ] Supabase integration working
- [ ] Can add/remove tickers from watchlist
- [ ] Basic scanner runs on-demand

---

### Phase 2: Discord Integration (Week 2)

> **Goal:** Real-time notifications via Discord

| Task | Description                            | Priority  |
| ---- | -------------------------------------- | --------- |
| 2.1  | Create Discord webhook service         | 🔴 High   |
| 2.2  | Design rich embed templates for alerts | 🔴 High   |
| 2.3  | Implement alert priority system        | 🟡 Medium |
| 2.4  | Add rate limiting (avoid spam)         | 🟡 Medium |
| 2.5  | Test webhook reliability               | 🟢 Low    |

**Discord Alert Format:**

```
┌─────────────────────────────────────────┐
│ 🎯 ENTRY SIGNAL: NVDA                   │
├─────────────────────────────────────────┤
│ Price: $142.50 (-1.2%)                  │
│ RSI: 42 (in buy zone ✅)                │
│ IV: 35% (52nd percentile)               │
│                                         │
│ Spread: $130/$135 CDS                   │
│ Debit: $420 | Cushion: 8.5%            │
│ Grade: A- | Risk: 3/10                  │
│                                         │
│ Victor's Take:                          │
│ "Clean pullback to support with IV      │
│ compression. This is the setup we wait  │
│ for. 35d to earnings gives runway."     │
├─────────────────────────────────────────┤
│ [View Full Analysis] [Dismiss]          │
└─────────────────────────────────────────┘
```

**Deliverables:**

- [ ] Discord webhook sending alerts
- [ ] Rich embeds with all relevant data
- [ ] Alert deduplication (no spam)

---

### Phase 3: Morning Briefing (Week 3)

> **Goal:** Daily automated market summary

| Task | Description                          | Priority  |
| ---- | ------------------------------------ | --------- |
| 3.1  | Create briefing generation service   | 🔴 High   |
| 3.2  | Implement market regime detection    | 🔴 High   |
| 3.3  | Add watchlist overnight analysis     | 🟡 Medium |
| 3.4  | Position status checks               | 🟡 Medium |
| 3.5  | Economic calendar integration        | 🟡 Medium |
| 3.6  | Schedule daily briefing (9:00 AM ET) | 🔴 High   |

**Morning Briefing Format:**

```
┌─────────────────────────────────────────┐
│ ☀️ VICTOR'S MORNING BRIEFING            │
│ Thursday, December 12, 2024             │
├─────────────────────────────────────────┤
│ 📊 MARKET PULSE                         │
│ SPY: +0.3% pre-market                   │
│ VIX: 14.2 (Risk-On)                     │
│ Regime: BULLISH                         │
│                                         │
│ 📅 TODAY'S CALENDAR                     │
│ • 8:30 AM: CPI Data Release             │
│ • 2:00 PM: FOMC Minutes                 │
│                                         │
│ 🎯 WATCHLIST ALERTS                     │
│ • NVDA: RSI dropped to 48 overnight     │
│ • GOOGL: Testing $178 support           │
│                                         │
│ 💼 POSITION CHECK                       │
│ • AAPL 180/185 CDS: 8 DTE, +12% cushion │
│   → Consider rolling if > $3 profit     │
│                                         │
│ 💭 VICTOR'S TAKE                        │
│ "CPI is the main event. If inflation    │
│ comes in cool, risk assets rally. Stay  │
│ nimble until 8:30."                     │
└─────────────────────────────────────────┘
```

**Deliverables:**

- [ ] Automated morning briefing at 9 AM ET
- [ ] Briefings stored in Supabase
- [ ] Discord delivery working

---

### Phase 4: Background Agent (Week 4)

> **Goal:** Continuous monitoring during market hours

| Task | Description                                     | Priority  |
| ---- | ----------------------------------------------- | --------- |
| 4.1  | Create background worker process                | 🔴 High   |
| 4.2  | Implement scan scheduling (every 15-30 min)     | 🔴 High   |
| 4.3  | Build opportunity detection logic               | 🔴 High   |
| 4.4  | Add AI reasoning for alert decisions            | 🔴 High   |
| 4.5  | Implement cooldown system (avoid alert fatigue) | 🟡 Medium |
| 4.6  | Add health monitoring / error recovery          | 🟡 Medium |

**Alert Trigger Criteria:**

```typescript
interface AlertCriteria {
  // Entry Signals
  rsiInBuyZone: boolean; // RSI 35-55
  ivBelow50thPercentile: boolean;
  aboveMA200: boolean;
  cushionAbove8Percent: boolean;
  gradeAOrBetter: boolean;

  // Exit/Risk Signals
  earningsWithin7Days: boolean;
  cushionBelow5Percent: boolean;
  dteBelow5Days: boolean;

  // News Events
  materialNewsDetected: boolean;
  analystUpgradeDowngrade: boolean;
}
```

**Deliverables:**

- [ ] Background process running reliably
- [ ] Scans executing on schedule
- [ ] Alerts triggering correctly

---

### Phase 5: AI Enhancement (Week 5)

> **Goal:** Victor's judgment in the loop

| Task | Description                         | Priority  |
| ---- | ----------------------------------- | --------- |
| 5.1  | Add AI review before sending alerts | 🔴 High   |
| 5.2  | Implement conviction scoring        | 🟡 Medium |
| 5.3  | Add context from recent news        | 🟡 Medium |
| 5.4  | Historical pattern recognition      | 🟢 Low    |
| 5.5  | Sector rotation detection           | 🟢 Low    |

**AI Decision Flow:**

```
Scanner finds potential setup
        │
        ▼
┌───────────────────┐
│ Victor AI Review  │
│                   │
│ "Is this actually │
│  a good setup?"   │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
  HIGH       LOW/MEDIUM
CONVICTION   CONVICTION
    │           │
    ▼           ▼
  ALERT      LOG ONLY
```

**Deliverables:**

- [ ] AI validates all alerts before sending
- [ ] Conviction scores included in alerts
- [ ] False positive rate < 20%

---

### Phase 6: Polish & Optimization (Week 6)

> **Goal:** Production-ready system

| Task | Description                     | Priority  |
| ---- | ------------------------------- | --------- |
| 6.1  | Performance optimization        | 🟡 Medium |
| 6.2  | Token cost monitoring           | 🟡 Medium |
| 6.3  | Alert analytics dashboard (CLI) | 🟢 Low    |
| 6.4  | Configuration UI                | 🟢 Low    |
| 6.5  | Documentation                   | 🔴 High   |
| 6.6  | Error handling & logging        | 🟡 Medium |

**Deliverables:**

- [ ] System running reliably 24/5
- [ ] Cost < $1/day for monitoring
- [ ] Full documentation

---

## 📁 File Structure

```
ai-analyst/
├── src/
│   ├── agent/
│   │   ├── scanner.ts        # Market scanning logic
│   │   ├── monitor.ts        # Background worker
│   │   ├── briefing.ts       # Morning briefing generator
│   │   └── decision.ts       # Alert decision engine
│   ├── services/
│   │   ├── supabase.ts       # Database client
│   │   ├── discord.ts        # Webhook notifications
│   │   └── scheduler.ts      # Cron job management
│   ├── commands/
│   │   ├── watch.ts          # Watchlist management CLI
│   │   ├── agent.ts          # Start/stop agent CLI
│   │   └── briefing.ts       # Manual briefing trigger
│   └── types/
│       └── agent.ts          # Agent-specific types
├── db/
│   └── agent_schema.sql      # Supabase schema
└── docs/
    └── AGENTIC_VICTOR.md     # This document
```

---

## 🔧 CLI Commands

```bash
# Watchlist Management
bun run analyst watch add NVDA GOOGL TSM
bun run analyst watch remove NVDA
bun run analyst watch list
bun run analyst watch configure NVDA --rsi-low 30 --rsi-high 50

# Agent Control
bun run analyst agent start      # Start background monitoring
bun run analyst agent stop       # Stop monitoring
bun run analyst agent status     # Check agent health

# Briefings
bun run analyst briefing         # Generate morning briefing now
bun run analyst briefing history # View past briefings

# Alerts
bun run analyst alerts           # View recent alerts
bun run analyst alerts ack <id>  # Acknowledge an alert
```

---

## 💰 Cost Estimates

| Component                   | Frequency       | Est. Cost       |
| --------------------------- | --------------- | --------------- |
| Watchlist Scan (10 tickers) | Every 30 min    | ~$0.02/scan     |
| AI Alert Review             | Per opportunity | ~$0.01/review   |
| Morning Briefing            | Daily           | ~$0.05/briefing |
| News Monitoring             | Every 15 min    | ~$0.01/check    |
| **Daily Total**             | —               | **~$0.50-1.00** |
| **Monthly Total**           | —               | **~$15-30**     |

_Assumes TOON encoding and smart caching are used._

---

## ⚠️ Risk Mitigation

| Risk                 | Mitigation                               |
| -------------------- | ---------------------------------------- |
| Alert fatigue        | Cooldown periods, conviction thresholds  |
| API rate limits      | Request batching, caching, backoff       |
| False positives      | AI review layer, historical validation   |
| Missed opportunities | Multiple scan intervals, redundancy      |
| Cost overrun         | Token budgets, TOON encoding, monitoring |

---

## 🎯 Success Metrics

| Metric                  | Target                           |
| ----------------------- | -------------------------------- |
| Alert accuracy          | > 80% actionable                 |
| False positive rate     | < 20%                            |
| Latency (scan to alert) | < 2 minutes                      |
| System uptime           | > 99% during market hours        |
| User satisfaction       | Alerts lead to profitable trades |

---

## 🔮 Future Enhancements

- **Web Dashboard** - Visual interface for watchlist and alerts
- **Telegram Integration** - Alternative notification channel
- **Backtesting** - Validate alert criteria against historical data
- **Multi-Strategy Support** - Beyond Deep ITM CDS
- **Portfolio Optimization** - Suggest position sizing
- **Sentiment Analysis** - Social media monitoring (Reddit, Twitter)

---

## 📝 Notes

- All times in Eastern Time (ET) for market alignment
- Supabase free tier should be sufficient initially
- Discord webhook is free and reliable
- Consider upgrading to Supabase Pro if scan volume increases

---

_Last Updated: December 11, 2024_
