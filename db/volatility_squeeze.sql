-- Volatility Squeeze Scanner Database Schema
-- This schema stores all volatility squeeze signals and related data for visualization

-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create the main signals table
CREATE TABLE IF NOT EXISTS volatility_squeeze_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic Signal Info
    symbol VARCHAR(10) NOT NULL,
    scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Price Data
    close_price DECIMAL(12,4) NOT NULL,
    open_price DECIMAL(12,4),
    high_price DECIMAL(12,4),
    low_price DECIMAL(12,4),
    volume BIGINT,
    
    -- Position Analysis
    price_vs_20d_high DECIMAL(8,4),
    price_vs_20d_low DECIMAL(8,4),
    
    -- Volatility Squeeze Metrics
    bb_width DECIMAL(10,6) NOT NULL,
    bb_width_percentile DECIMAL(8,4) NOT NULL,
    bb_width_change DECIMAL(8,4),
    is_squeeze BOOLEAN NOT NULL,
    is_expansion BOOLEAN NOT NULL,
    
    -- Bollinger Bands
    bb_upper DECIMAL(12,4),
    bb_middle DECIMAL(12,4),
    bb_lower DECIMAL(12,4),
    
    -- Keltner Channels
    kc_upper DECIMAL(12,4),
    kc_middle DECIMAL(12,4),
    kc_lower DECIMAL(12,4),
    
    -- Range & Volatility
    true_range DECIMAL(12,4),
    atr_20 DECIMAL(12,4),
    range_vs_atr DECIMAL(8,4),
    
    -- Trend Analysis
    trend_direction VARCHAR(10) CHECK (trend_direction IN ('bullish', 'bearish', 'sideways')),
    ema_short DECIMAL(12,4), -- 20-day EMA
    ema_long DECIMAL(12,4),  -- 50-day EMA
    
    -- Volume Analysis
    volume_ratio DECIMAL(8,4),
    avg_volume BIGINT,
    
    -- Technical Indicators
    rsi DECIMAL(8,4),
    macd DECIMAL(10,6),
    macd_signal DECIMAL(10,6),
    adx DECIMAL(8,4),
    di_plus DECIMAL(8,4),
    di_minus DECIMAL(8,4),
    
    -- Signal Scoring
    signal_strength DECIMAL(6,4) NOT NULL,
    technical_score DECIMAL(6,4) NOT NULL,
    overall_score DECIMAL(6,4) NOT NULL,
    
    -- Recommendations
    recommendation VARCHAR(20) CHECK (recommendation IN ('STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL', 'WATCH', 'PASS')),
    
    -- Risk Management
    stop_loss_price DECIMAL(12,4),
    position_size_pct DECIMAL(6,4),
    
    -- Market Regime
    market_regime VARCHAR(20),
    market_volatility DECIMAL(8,4),
    
    -- AI Analysis (optional)
    ai_analysis TEXT,
    ai_confidence DECIMAL(6,4),
    
    -- Metadata
    is_actionable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON volatility_squeeze_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_scan_date ON volatility_squeeze_signals(scan_date);
CREATE INDEX IF NOT EXISTS idx_signals_overall_score ON volatility_squeeze_signals(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_recommendation ON volatility_squeeze_signals(recommendation);
CREATE INDEX IF NOT EXISTS idx_signals_is_actionable ON volatility_squeeze_signals(is_actionable);
CREATE INDEX IF NOT EXISTS idx_signals_bb_width_percentile ON volatility_squeeze_signals(bb_width_percentile);
CREATE INDEX IF NOT EXISTS idx_signals_trend ON volatility_squeeze_signals(trend_direction);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_signals_composite ON volatility_squeeze_signals(
    scan_date DESC, 
    overall_score DESC, 
    is_actionable
);

-- Create a table for scan summaries
CREATE TABLE IF NOT EXISTS scan_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Scan Metrics
    total_symbols_scanned INTEGER NOT NULL,
    symbols_with_data INTEGER NOT NULL,
    total_signals_found INTEGER NOT NULL,
    actionable_signals INTEGER NOT NULL,
    
    -- Quality Metrics
    signal_rate DECIMAL(6,4) NOT NULL, -- percentage
    average_signal_score DECIMAL(6,4) NOT NULL,
    strong_signals_count INTEGER NOT NULL, -- score >= 0.9
    
    -- Performance Metrics
    scan_duration_seconds INTEGER,
    data_success_rate DECIMAL(6,4) NOT NULL,
    
    -- Filters Applied
    min_score_threshold DECIMAL(6,4),
    max_symbols_limit INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for scan summaries
CREATE INDEX IF NOT EXISTS idx_scan_summaries_date ON scan_summaries(scan_date DESC);

-- Create a view for easy signal analysis
CREATE OR REPLACE VIEW signal_analysis AS
SELECT 
    s.*,
    -- Calculate days since scan
    CURRENT_DATE - s.scan_date as days_since_scan,
    
    -- Risk/Reward Analysis
    CASE 
        WHEN s.stop_loss_price IS NOT NULL AND s.close_price > s.stop_loss_price 
        THEN (s.close_price - s.stop_loss_price) / s.stop_loss_price * 100
        ELSE NULL 
    END as stop_loss_distance_pct,
    
    -- Squeeze Tightness Categories
    CASE 
        WHEN s.bb_width_percentile <= 5 THEN 'Extremely Tight'
        WHEN s.bb_width_percentile <= 15 THEN 'Very Tight' 
        WHEN s.bb_width_percentile <= 30 THEN 'Tight'
        ELSE 'Normal'
    END as squeeze_category,
    
    -- Signal Quality Tiers
    CASE 
        WHEN s.overall_score >= 0.95 THEN 'Exceptional'
        WHEN s.overall_score >= 0.9 THEN 'Excellent'
        WHEN s.overall_score >= 0.8 THEN 'Very Good'
        WHEN s.overall_score >= 0.7 THEN 'Good'
        ELSE 'Fair'
    END as signal_quality
    
FROM volatility_squeeze_signals s;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_signals_updated_at 
    BEFORE UPDATE ON volatility_squeeze_signals
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE volatility_squeeze_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication needs)
-- For now, allow all operations (you can restrict later)
CREATE POLICY "Allow all operations on signals" ON volatility_squeeze_signals
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on scan summaries" ON scan_summaries
    FOR ALL USING (true) WITH CHECK (true);

-- Create useful queries as comments for reference
/*
-- Top signals from latest scan
SELECT symbol, overall_score, recommendation, bb_width_percentile, signal_quality
FROM signal_analysis 
WHERE scan_date = CURRENT_DATE 
ORDER BY overall_score DESC 
LIMIT 20;

-- Signals by recommendation type
SELECT recommendation, COUNT(*) as count, AVG(overall_score) as avg_score
FROM volatility_squeeze_signals 
WHERE scan_date = CURRENT_DATE
GROUP BY recommendation 
ORDER BY avg_score DESC;

-- Tightest squeezes (most explosive potential)
SELECT symbol, bb_width_percentile, overall_score, recommendation
FROM volatility_squeeze_signals 
WHERE scan_date = CURRENT_DATE AND bb_width_percentile <= 10
ORDER BY bb_width_percentile ASC;

-- Historical signal performance by symbol
SELECT symbol, COUNT(*) as signal_count, AVG(overall_score) as avg_score
FROM volatility_squeeze_signals 
WHERE scan_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY symbol 
HAVING COUNT(*) >= 3
ORDER BY avg_score DESC;
*/