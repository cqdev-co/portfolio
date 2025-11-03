-- ================================================
-- Unusual Options Activity Scanner - Database Schema
-- ================================================
-- Description: Schema for storing unusual options signals with continuity 
--              tracking for hourly cron job execution
-- Version: 1.2.0
-- Created: October 2025
-- Updated: Added signal continuity tracking for deduplication
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
    
    -- Signal Continuity (for deduplication and tracking)
    is_new_signal BOOLEAN DEFAULT TRUE,
    signal_group_id UUID,  -- Links related signals together
    first_detected_at TIMESTAMPTZ,  -- When signal first appeared
    last_detected_at TIMESTAMPTZ,  -- Most recent detection
    detection_count INTEGER DEFAULT 1,  -- How many times detected
    is_active BOOLEAN DEFAULT TRUE,  -- Still appearing in scans
    
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

-- Continuity tracking indexes
CREATE INDEX IF NOT EXISTS idx_signals_option_symbol ON unusual_options_signals(option_symbol);
CREATE INDEX IF NOT EXISTS idx_signals_group_id ON unusual_options_signals(signal_group_id);
CREATE INDEX IF NOT EXISTS idx_signals_is_active ON unusual_options_signals(is_active);
CREATE INDEX IF NOT EXISTS idx_signals_ticker_option_active ON unusual_options_signals(ticker, option_symbol, is_active);
CREATE INDEX IF NOT EXISTS idx_signals_last_detected ON unusual_options_signals(last_detected_at DESC);

-- ================================================
-- 2. SIGNAL CONTINUITY HISTORY TABLE
-- ================================================
-- Tracks each detection of a signal over time for analysis

CREATE TABLE IF NOT EXISTS unusual_options_signal_continuity (
    -- Identity
    continuity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES unusual_options_signals(signal_id) ON DELETE CASCADE,
    signal_group_id UUID NOT NULL,
    
    -- Detection Context
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_run_id UUID,  -- Optional: link to specific scan run
    
    -- Metrics at detection time
    current_volume INTEGER NOT NULL,
    current_oi INTEGER NOT NULL,
    premium_flow NUMERIC(12, 2),
    underlying_price NUMERIC(10, 2) NOT NULL,
    overall_score NUMERIC(4, 3) NOT NULL,
    grade TEXT NOT NULL,
    
    -- Changes since last detection
    volume_delta INTEGER,
    oi_delta INTEGER,
    premium_flow_delta NUMERIC(12, 2),
    score_delta NUMERIC(4, 3),
    grade_change TEXT,  -- 'UPGRADED', 'DOWNGRADED', 'UNCHANGED'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for continuity table
CREATE INDEX IF NOT EXISTS idx_continuity_signal_id ON unusual_options_signal_continuity(signal_id);
CREATE INDEX IF NOT EXISTS idx_continuity_group_id ON unusual_options_signal_continuity(signal_group_id);
CREATE INDEX IF NOT EXISTS idx_continuity_detected_at ON unusual_options_signal_continuity(detected_at DESC);

-- ================================================
-- 3. SIGNAL PERFORMANCE TRACKING TABLE
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
-- 4. FUNCTIONS
-- ================================================

-- Function to find existing signal for deduplication
-- Matches by ticker, option_symbol, and recent detection (within 24 hours)
CREATE OR REPLACE FUNCTION find_existing_signal(
    p_ticker TEXT,
    p_option_symbol TEXT,
    p_strike NUMERIC,
    p_expiry DATE,
    p_option_type TEXT
) RETURNS UUID AS $$
DECLARE
    v_signal_id UUID;
BEGIN
    SELECT signal_id INTO v_signal_id
    FROM unusual_options_signals
    WHERE ticker = p_ticker
        AND option_symbol = p_option_symbol
        AND strike = p_strike
        AND expiry = p_expiry
        AND option_type = p_option_type
        AND is_active = TRUE
        AND last_detected_at > NOW() - INTERVAL '24 hours'
    ORDER BY last_detected_at DESC
    LIMIT 1;
    
    RETURN v_signal_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update signal continuity when re-detected
CREATE OR REPLACE FUNCTION update_signal_continuity(
    p_signal_id UUID,
    p_new_volume INTEGER,
    p_new_oi INTEGER,
    p_new_premium_flow NUMERIC,
    p_new_price NUMERIC,
    p_new_score NUMERIC,
    p_new_grade TEXT
) RETURNS VOID AS $$
DECLARE
    v_old_volume INTEGER;
    v_old_oi INTEGER;
    v_old_premium_flow NUMERIC;
    v_old_score NUMERIC;
    v_old_grade TEXT;
    v_group_id UUID;
    v_grade_change TEXT;
BEGIN
    -- Get current values
    SELECT current_volume, current_oi, premium_flow, overall_score, 
           grade, signal_group_id
    INTO v_old_volume, v_old_oi, v_old_premium_flow, v_old_score, 
         v_old_grade, v_group_id
    FROM unusual_options_signals
    WHERE signal_id = p_signal_id;
    
    -- Determine grade change
    IF p_new_grade > v_old_grade THEN
        v_grade_change := 'UPGRADED';
    ELSIF p_new_grade < v_old_grade THEN
        v_grade_change := 'DOWNGRADED';
    ELSE
        v_grade_change := 'UNCHANGED';
    END IF;
    
    -- Insert continuity record
    INSERT INTO unusual_options_signal_continuity (
        signal_id, signal_group_id, detected_at,
        current_volume, current_oi, premium_flow, 
        underlying_price, overall_score, grade,
        volume_delta, oi_delta, premium_flow_delta, 
        score_delta, grade_change
    ) VALUES (
        p_signal_id, v_group_id, NOW(),
        p_new_volume, p_new_oi, p_new_premium_flow,
        p_new_price, p_new_score, p_new_grade,
        p_new_volume - v_old_volume,
        p_new_oi - v_old_oi,
        p_new_premium_flow - COALESCE(v_old_premium_flow, 0),
        p_new_score - v_old_score,
        v_grade_change
    );
    
    -- Update main signal record
    UPDATE unusual_options_signals
    SET 
        current_volume = p_new_volume,
        current_oi = p_new_oi,
        premium_flow = p_new_premium_flow,
        underlying_price = p_new_price,
        overall_score = p_new_score,
        grade = p_new_grade,
        last_detected_at = NOW(),
        detection_count = detection_count + 1,
        is_new_signal = FALSE,
        updated_at = NOW()
    WHERE signal_id = p_signal_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark signals as inactive if not detected
CREATE OR REPLACE FUNCTION mark_stale_signals_inactive(
    p_hours_threshold INTEGER DEFAULT 3
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE unusual_options_signals
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE is_active = TRUE
        AND last_detected_at < NOW() - (p_hours_threshold || ' hours')::INTERVAL
        AND expiry >= CURRENT_DATE;  -- Don't mark expired options
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

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
    'unusual_options_signal_continuity',
    'unusual_options_signal_performance'
)
ORDER BY table_name;

-- ================================================
-- NOTES FOR CRON JOB EXECUTION
-- ================================================
-- 
-- When running hourly scans:
-- 1. Call find_existing_signal() before inserting new signals
-- 2. If signal exists, call update_signal_continuity()
-- 3. If signal is new, insert with signal_group_id = signal_id
-- 4. After scan completes, call mark_stale_signals_inactive(3)
--    to mark signals not detected in last 3 hours as inactive
-- 
-- Signal lifecycle:
-- - New signal: is_new_signal=true, detection_count=1, is_active=true
-- - Continuing signal: is_new_signal=false, detection_count++, is_active=true
-- - Stale signal: is_active=false (not detected in last 3 hours)
-- 
-- Deduplication strategy:
-- - Match on: ticker + option_symbol + strike + expiry + option_type
-- - Time window: 24 hours (signals detected within last 24h)
-- - Active only: Only match against is_active=true signals
-- 
-- Frontend display:
-- - Show is_new_signal=true with "NEW" badge
-- - Show detection_count for continuity tracking
-- - Filter by is_active=true for current signals
-- - Use last_detected_at for freshness indicators
--

