# Database Schema - Unusual Options Service

## Overview

This document describes the Supabase database schema for the Unusual Options Activity Scanner. The schema is designed for:

- Fast signal storage and retrieval
- Historical performance tracking
- Backtest analysis
- User configuration management

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────┐
│          unusual_options_signals            │
│  - signal_id (PK)                          │
│  - ticker                                   │
│  - option_symbol                           │
│  - detection_timestamp                     │
│  - overall_score                           │
│  - grade                                    │
│  - ... (metrics)                           │
└──────────────┬──────────────────────────────┘
               │
               │ 1:N
               │
┌──────────────▼──────────────────────────────┐
│        signal_performance                   │
│  - performance_id (PK)                     │
│  - signal_id (FK)                          │
│  - ticker                                   │
│  - entry_price                             │
│  - forward_return_1d                       │
│  - forward_return_5d                       │
│  - forward_return_30d                      │
│  - win                                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        options_flow_history                 │
│  - flow_id (PK)                            │
│  - ticker                                   │
│  - option_symbol                           │
│  - trade_timestamp                         │
│  - volume                                   │
│  - premium                                  │
│  - ... (trade details)                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          scanner_config                     │
│  - config_id (PK)                          │
│  - user_id                                  │
│  - watchlists                              │
│  - alert_preferences                       │
│  - detection_thresholds                    │
└─────────────────────────────────────────────┘
```

## Table Definitions

### 1. unusual_options_signals

Primary table for storing detected unusual options activity signals.

```sql
CREATE TABLE unusual_options_signals (
    -- Identity
    signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    option_symbol TEXT NOT NULL,
    detection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Option Details
    strike NUMERIC(10, 2) NOT NULL,
    expiry DATE NOT NULL,
    option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
    days_to_expiry INTEGER NOT NULL,
    moneyness TEXT CHECK (moneyness IN ('ITM', 'ATM', 'OTM')),

    -- Volume Metrics
    current_volume INTEGER NOT NULL DEFAULT 0,
    average_volume NUMERIC(10, 2) NOT NULL DEFAULT 0,
    volume_ratio NUMERIC(6, 2),

    -- Open Interest Metrics
    current_oi INTEGER NOT NULL DEFAULT 0,
    previous_oi INTEGER NOT NULL DEFAULT 0,
    oi_change_pct NUMERIC(6, 4),

    -- Premium Metrics
    premium_flow NUMERIC(12, 2) NOT NULL DEFAULT 0,
    aggressive_order_pct NUMERIC(4, 2),

    -- Detection Flags
    has_volume_anomaly BOOLEAN DEFAULT FALSE,
    has_oi_spike BOOLEAN DEFAULT FALSE,
    has_premium_flow BOOLEAN DEFAULT FALSE,
    has_sweep BOOLEAN DEFAULT FALSE,
    has_block_trade BOOLEAN DEFAULT FALSE,

    -- Scoring
    overall_score NUMERIC(4, 3) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
    grade TEXT NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')),
    confidence NUMERIC(4, 3) CHECK (confidence >= 0 AND confidence <= 1),

    -- Risk Assessment
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
    risk_factors JSONB DEFAULT '[]'::jsonb,

    -- Market Context
    underlying_price NUMERIC(10, 2) NOT NULL,
    implied_volatility NUMERIC(6, 4),
    iv_rank NUMERIC(4, 2),
    market_cap BIGINT,
    avg_daily_volume BIGINT,

    -- Directional Bias
    sentiment TEXT CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    put_call_ratio NUMERIC(6, 4),

    -- Additional Context
    days_to_earnings INTEGER,
    has_upcoming_catalyst BOOLEAN DEFAULT FALSE,
    catalyst_description TEXT,

    -- Metadata
    data_provider TEXT,
    detection_version TEXT,
    raw_detection_data JSONB,

    -- Indexes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_signals_ticker ON unusual_options_signals(ticker);
CREATE INDEX idx_signals_detection_ts ON unusual_options_signals(detection_timestamp DESC);
CREATE INDEX idx_signals_grade ON unusual_options_signals(grade);
CREATE INDEX idx_signals_ticker_grade ON unusual_options_signals(ticker, grade);
CREATE INDEX idx_signals_expiry ON unusual_options_signals(expiry);
CREATE INDEX idx_signals_score ON unusual_options_signals(overall_score DESC);

-- Composite index for common queries
CREATE INDEX idx_signals_recent_high_grade
ON unusual_options_signals(detection_timestamp DESC, grade)
WHERE grade IN ('S', 'A', 'B');
```

### 2. signal_performance

Tracks forward returns and win/loss outcomes for backtesting and algorithm improvement.

```sql
CREATE TABLE signal_performance (
    -- Identity
    performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES unusual_options_signals(signal_id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,

    -- Entry Context
    entry_timestamp TIMESTAMPTZ NOT NULL,
    entry_price NUMERIC(10, 2) NOT NULL,
    option_symbol TEXT NOT NULL,
    signal_grade TEXT NOT NULL,
    signal_sentiment TEXT,

    -- Price Tracking
    price_1d_later NUMERIC(10, 2),
    price_5d_later NUMERIC(10, 2),
    price_30d_later NUMERIC(10, 2),
    current_price NUMERIC(10, 2),

    -- Forward Returns
    forward_return_1d NUMERIC(6, 4),
    forward_return_5d NUMERIC(6, 4),
    forward_return_30d NUMERIC(6, 4),

    -- Win/Loss Classification
    win_1d BOOLEAN,
    win_5d BOOLEAN,
    win_30d BOOLEAN,
    overall_win BOOLEAN,

    -- Performance Metrics
    max_favorable_move NUMERIC(6, 4),  -- Best price reached
    max_adverse_move NUMERIC(6, 4),     -- Worst price reached
    volatility_realized NUMERIC(6, 4),

    -- Option Outcome (if tracked)
    option_entry_price NUMERIC(10, 2),
    option_exit_price NUMERIC(10, 2),
    option_return_pct NUMERIC(6, 4),

    -- Notes
    trade_notes TEXT,
    exit_reason TEXT,

    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_performance_signal_id ON signal_performance(signal_id);
CREATE INDEX idx_performance_ticker ON signal_performance(ticker);
CREATE INDEX idx_performance_grade ON signal_performance(signal_grade);
CREATE INDEX idx_performance_win ON signal_performance(overall_win);
CREATE INDEX idx_performance_entry_ts ON signal_performance(entry_timestamp DESC);
```

### 3. options_flow_history

Raw historical options flow data for pattern analysis and research.

```sql
CREATE TABLE options_flow_history (
    -- Identity
    flow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker TEXT NOT NULL,
    option_symbol TEXT NOT NULL,

    -- Trade Details
    trade_timestamp TIMESTAMPTZ NOT NULL,
    trade_price NUMERIC(10, 4) NOT NULL,
    trade_size INTEGER NOT NULL,
    trade_premium NUMERIC(12, 2) NOT NULL,

    -- Option Details
    strike NUMERIC(10, 2) NOT NULL,
    expiry DATE NOT NULL,
    option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),

    -- Trade Classification
    trade_type TEXT CHECK (trade_type IN ('buy', 'sell', 'sweep', 'block')),
    execution_style TEXT CHECK (execution_style IN ('aggressive', 'passive', 'neutral')),
    exchange TEXT,

    -- Market Context at Time of Trade
    underlying_price NUMERIC(10, 2),
    bid_price NUMERIC(10, 4),
    ask_price NUMERIC(10, 4),
    mid_price NUMERIC(10, 4),
    implied_volatility NUMERIC(6, 4),

    -- Volume and OI at Time
    contract_volume INTEGER,
    contract_oi INTEGER,

    -- Metadata
    data_provider TEXT NOT NULL,
    is_sweep_leg BOOLEAN DEFAULT FALSE,
    sweep_id UUID,  -- Groups sweep trades together

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flow_ticker ON options_flow_history(ticker);
CREATE INDEX idx_flow_timestamp ON options_flow_history(trade_timestamp DESC);
CREATE INDEX idx_flow_option_symbol ON options_flow_history(option_symbol);
CREATE INDEX idx_flow_sweep ON options_flow_history(sweep_id) WHERE sweep_id IS NOT NULL;

-- Composite index for ticker + time range queries
CREATE INDEX idx_flow_ticker_time ON options_flow_history(ticker, trade_timestamp DESC);
```

### 4. scanner_config

User configuration for watchlists, alerts, and detection thresholds.

```sql
CREATE TABLE scanner_config (
    -- Identity
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- Optional: for multi-user support
    config_name TEXT NOT NULL,

    -- Watchlists
    watchlists JSONB DEFAULT '[]'::jsonb,
    -- Example: [{"name": "tech", "tickers": ["AAPL", "MSFT", "GOOGL"]}, ...]

    -- Alert Preferences
    alert_preferences JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "enabled": true,
    --   "min_grade": "B",
    --   "channels": ["discord"],
    --   "discord_webhook": "https://...",
    --   "quiet_hours": {"start": "22:00", "end": "06:00"}
    -- }

    -- Detection Thresholds
    detection_thresholds JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "volume_multiplier": 3.0,
    --   "oi_change_threshold": 0.20,
    --   "min_premium_flow": 100000,
    --   "min_avg_volume": 1000000
    -- }

    -- Scanning Preferences
    scan_preferences JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "min_market_cap": 1000000000,
    --   "min_option_volume": 100,
    --   "dte_min": 7,
    --   "dte_max": 90,
    --   "exclude_tickers": ["TSLA", "GME"]
    -- }

    -- Active Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_config_user_id ON scanner_config(user_id);
CREATE INDEX idx_config_active ON scanner_config(is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX idx_config_default ON scanner_config(is_default) WHERE is_default = TRUE;
```

### 5. backtest_results

Store backtest run results for algorithm validation.

```sql
CREATE TABLE backtest_results (
    -- Identity
    backtest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backtest_name TEXT NOT NULL,

    -- Test Parameters
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    tickers_tested TEXT[],
    detection_version TEXT NOT NULL,

    -- Overall Performance
    total_signals INTEGER NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    win_rate NUMERIC(5, 4),
    avg_winner_pct NUMERIC(6, 4),
    avg_loser_pct NUMERIC(6, 4),
    sharpe_ratio NUMERIC(6, 4),
    max_drawdown NUMERIC(6, 4),

    -- Performance by Grade
    grade_breakdown JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "S": {"count": 10, "win_rate": 0.80, "avg_return": 0.15},
    --   "A": {"count": 45, "win_rate": 0.67, "avg_return": 0.08},
    --   ...
    -- }

    -- Performance by Timeframe
    timeframe_breakdown JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "1d": {"win_rate": 0.55, "avg_return": 0.03},
    --   "5d": {"win_rate": 0.60, "avg_return": 0.08},
    --   "30d": {"win_rate": 0.62, "avg_return": 0.12}
    -- }

    -- Additional Metrics
    best_trade_return NUMERIC(6, 4),
    worst_trade_return NUMERIC(6, 4),
    avg_days_in_trade NUMERIC(5, 2),

    -- Configuration Used
    thresholds_used JSONB,
    filters_applied JSONB,

    -- Execution Metadata
    execution_time_seconds INTEGER,
    signals_per_day NUMERIC(6, 2),

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_backtest_name ON backtest_results(backtest_name);
CREATE INDEX idx_backtest_date_range ON backtest_results(start_date, end_date);
CREATE INDEX idx_backtest_created ON backtest_results(created_at DESC);
```

## Views for Common Queries

### Recent High-Grade Signals

```sql
CREATE OR REPLACE VIEW v_recent_high_grade_signals AS
SELECT
    signal_id,
    ticker,
    option_symbol,
    detection_timestamp,
    grade,
    overall_score,
    sentiment,
    premium_flow,
    volume_ratio,
    risk_level,
    underlying_price
FROM unusual_options_signals
WHERE
    detection_timestamp > NOW() - INTERVAL '7 days'
    AND grade IN ('S', 'A', 'B')
ORDER BY detection_timestamp DESC;
```

### Signal Performance Summary

```sql
CREATE OR REPLACE VIEW v_signal_performance_summary AS
SELECT
    s.ticker,
    s.grade,
    COUNT(*) as total_signals,
    AVG(p.forward_return_5d) as avg_return_5d,
    SUM(CASE WHEN p.win_5d THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate_5d,
    AVG(s.premium_flow) as avg_premium,
    AVG(s.volume_ratio) as avg_volume_ratio
FROM unusual_options_signals s
JOIN signal_performance p ON s.signal_id = p.signal_id
WHERE p.forward_return_5d IS NOT NULL
GROUP BY s.ticker, s.grade
HAVING COUNT(*) >= 5
ORDER BY win_rate_5d DESC;
```

### Daily Activity Summary

```sql
CREATE OR REPLACE VIEW v_daily_activity_summary AS
SELECT
    DATE(detection_timestamp) as signal_date,
    COUNT(*) as total_signals,
    COUNT(DISTINCT ticker) as unique_tickers,
    SUM(CASE WHEN grade IN ('S', 'A') THEN 1 ELSE 0 END) as high_grade_signals,
    AVG(premium_flow) as avg_premium_flow,
    SUM(premium_flow) as total_premium_flow
FROM unusual_options_signals
WHERE detection_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(detection_timestamp)
ORDER BY signal_date DESC;
```

## Row Level Security (RLS)

For multi-user support (optional):

```sql
-- Enable RLS on tables
ALTER TABLE unusual_options_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all signals
CREATE POLICY "Anyone can read signals"
ON unusual_options_signals FOR SELECT
USING (true);

-- Policy: Users can only modify their own config
CREATE POLICY "Users can manage own config"
ON scanner_config FOR ALL
USING (auth.uid() = user_id);
```

## Functions and Triggers

### Auto-update timestamp trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_signals_updated_at
BEFORE UPDATE ON unusual_options_signals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_updated_at
BEFORE UPDATE ON scanner_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Calculate win/loss based on sentiment

```sql
CREATE OR REPLACE FUNCTION calculate_win_status(
    entry_price NUMERIC,
    exit_price NUMERIC,
    sentiment TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF sentiment = 'BULLISH' THEN
        RETURN exit_price > entry_price * 1.02;  -- > 2% gain
    ELSIF sentiment = 'BEARISH' THEN
        RETURN exit_price < entry_price * 0.98;  -- > 2% decline
    ELSE
        RETURN ABS(exit_price - entry_price) / entry_price > 0.02;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Get similar signal performance

```sql
CREATE OR REPLACE FUNCTION get_similar_signal_performance(
    p_ticker TEXT,
    p_grade TEXT,
    p_sentiment TEXT,
    p_days_back INTEGER DEFAULT 90
) RETURNS TABLE (
    avg_return NUMERIC,
    win_rate NUMERIC,
    signal_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        AVG(p.forward_return_5d) as avg_return,
        SUM(CASE WHEN p.win_5d THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) as win_rate,
        COUNT(*)::INTEGER as signal_count
    FROM unusual_options_signals s
    JOIN signal_performance p ON s.signal_id = p.signal_id
    WHERE
        s.ticker = p_ticker
        AND s.grade = p_grade
        AND s.sentiment = p_sentiment
        AND s.detection_timestamp > NOW() - (p_days_back || ' days')::INTERVAL
        AND p.forward_return_5d IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
```

## Sample Queries

### Find all S-grade signals from last 24 hours

```sql
SELECT
    ticker,
    option_symbol,
    detection_timestamp,
    overall_score,
    premium_flow,
    volume_ratio,
    sentiment
FROM unusual_options_signals
WHERE
    grade = 'S'
    AND detection_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY overall_score DESC;
```

### Get performance for all AAPL signals

```sql
SELECT
    s.detection_timestamp,
    s.option_symbol,
    s.grade,
    s.sentiment,
    p.forward_return_5d,
    p.win_5d
FROM unusual_options_signals s
LEFT JOIN signal_performance p ON s.signal_id = p.signal_id
WHERE s.ticker = 'AAPL'
ORDER BY s.detection_timestamp DESC
LIMIT 50;
```

### Find best performing signal types

```sql
SELECT
    s.grade,
    s.sentiment,
    COUNT(*) as count,
    AVG(p.forward_return_5d) as avg_return,
    SUM(CASE WHEN p.win_5d THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as win_rate
FROM unusual_options_signals s
JOIN signal_performance p ON s.signal_id = p.signal_id
WHERE
    p.forward_return_5d IS NOT NULL
    AND s.detection_timestamp > NOW() - INTERVAL '90 days'
GROUP BY s.grade, s.sentiment
HAVING COUNT(*) >= 10
ORDER BY win_rate DESC;
```

### Get daily signal volume and quality

```sql
SELECT
    DATE(detection_timestamp) as date,
    COUNT(*) as total_signals,
    COUNT(DISTINCT ticker) as unique_tickers,
    AVG(overall_score) as avg_score,
    SUM(CASE WHEN grade IN ('S', 'A') THEN 1 ELSE 0 END) as premium_signals
FROM unusual_options_signals
WHERE detection_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(detection_timestamp)
ORDER BY date DESC;
```

## Maintenance

### Data Retention Policy

```sql
-- Delete old flow history (keep 90 days)
DELETE FROM options_flow_history
WHERE trade_timestamp < NOW() - INTERVAL '90 days';

-- Archive old signals (keep 1 year in main table)
-- Move older signals to archive table
INSERT INTO unusual_options_signals_archive
SELECT * FROM unusual_options_signals
WHERE detection_timestamp < NOW() - INTERVAL '1 year';

DELETE FROM unusual_options_signals
WHERE detection_timestamp < NOW() - INTERVAL '1 year';
```

### Vacuum and Analyze

```sql
-- Regular maintenance
VACUUM ANALYZE unusual_options_signals;
VACUUM ANALYZE signal_performance;
VACUUM ANALYZE options_flow_history;
```

## Migration Script

To deploy this schema to your Supabase instance:

1. Copy the SQL from above sections
2. Open Supabase Dashboard → SQL Editor
3. Paste and execute table creation statements
4. Create indexes
5. Create views
6. Create functions and triggers
7. Test with sample data

See `db/unusual_options_schema.sql` for the complete deployment script.

---

**Next**: [CLI Reference](cli-reference.md) | [Back to Overview](system-overview.md)
