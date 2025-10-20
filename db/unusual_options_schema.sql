-- ================================================
-- Unusual Options Activity Scanner - Database Schema
-- ================================================
-- Description: Simplified Supabase schema for storing unusual options signals
--              and performance tracking
-- Version: 1.1.0
-- Created: October 2025
-- Updated: Simplified schema, removed views and config tables
-- ================================================

-- ================================================
-- 1. MAIN SIGNALS TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS unusual_options_signals (
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
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_ticker ON unusual_options_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_detection_ts ON unusual_options_signals(detection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_grade ON unusual_options_signals(grade);
CREATE INDEX IF NOT EXISTS idx_signals_ticker_grade ON unusual_options_signals(ticker, grade);
CREATE INDEX IF NOT EXISTS idx_signals_expiry ON unusual_options_signals(expiry);
CREATE INDEX IF NOT EXISTS idx_signals_score ON unusual_options_signals(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_recent_high_grade ON unusual_options_signals(detection_timestamp DESC, grade) WHERE grade IN ('S', 'A', 'B');

-- ================================================
-- 2. SIGNAL PERFORMANCE TRACKING TABLE
-- ================================================

CREATE TABLE IF NOT EXISTS unusual_options_signal_performance (
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
    max_favorable_move NUMERIC(6, 4),
    max_adverse_move NUMERIC(6, 4),
    volatility_realized NUMERIC(6, 4),
    
    -- Option Outcome
    option_entry_price NUMERIC(10, 2),
    option_exit_price NUMERIC(10, 2),
    option_return_pct NUMERIC(6, 4),
    
    -- Notes
    trade_notes TEXT,
    exit_reason TEXT,
    
    -- Timestamps
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_signal_id ON unusual_options_signal_performance(signal_id);
CREATE INDEX IF NOT EXISTS idx_performance_ticker ON unusual_options_signal_performance(ticker);
CREATE INDEX IF NOT EXISTS idx_performance_grade ON unusual_options_signal_performance(signal_grade);
CREATE INDEX IF NOT EXISTS idx_performance_win ON unusual_options_signal_performance(overall_win);
CREATE INDEX IF NOT EXISTS idx_performance_entry_ts ON unusual_options_signal_performance(entry_timestamp DESC);

-- ================================================
-- 3. FUNCTIONS
-- ================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_signals_updated_at ON unusual_options_signals;
CREATE TRIGGER update_signals_updated_at 
BEFORE UPDATE ON unusual_options_signals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate win status
CREATE OR REPLACE FUNCTION calculate_win_status(
    entry_price NUMERIC,
    exit_price NUMERIC,
    sentiment TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    IF sentiment = 'BULLISH' THEN
        RETURN exit_price > entry_price * 1.02;
    ELSIF sentiment = 'BEARISH' THEN
        RETURN exit_price < entry_price * 0.98;
    ELSE
        RETURN ABS(exit_price - entry_price) / entry_price > 0.02;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get similar signal performance
CREATE OR REPLACE FUNCTION get_similar_signal_performance(
    p_ticker TEXT,
    p_grade TEXT,
    p_sentiment TEXT,
    p_days_back INTEGER DEFAULT 90
) RETURNS TABLE (
    avg_return NUMERIC,
    win_rate NUMERIC,
    signal_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(p.forward_return_5d) as avg_return,
        SUM(CASE WHEN p.win_5d THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*), 0) as win_rate,
        COUNT(*) as signal_count
    FROM unusual_options_signals s
    JOIN unusual_options_signal_performance p ON s.signal_id = p.signal_id
    WHERE 
        s.ticker = p_ticker
        AND s.grade = p_grade
        AND s.sentiment = p_sentiment
        AND s.detection_timestamp > NOW() - (p_days_back || ' days')::INTERVAL
        AND p.forward_return_5d IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- SCHEMA COMPLETE
-- ================================================

-- Verify tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
    'unusual_options_signals',
    'unusual_options_signal_performance'
)
ORDER BY table_name;

