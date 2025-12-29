-- Penny Stock Signals Table Schema
-- Stores explosion setup signals for penny stocks

CREATE TABLE IF NOT EXISTS penny_stock_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    scan_date DATE NOT NULL,
    
    -- Price data
    close_price DECIMAL(10,4) NOT NULL,
    
    -- Overall assessment
    overall_score DECIMAL(5,4) NOT NULL,
    opportunity_rank VARCHAR(1) NOT NULL,
    recommendation VARCHAR(20) NOT NULL,
    
    -- Component scores
    volume_score DECIMAL(5,4) NOT NULL,
    momentum_score DECIMAL(5,4) NOT NULL,
    relative_strength_score DECIMAL(5,4) NOT NULL,
    risk_score DECIMAL(5,4) NOT NULL,
    
    -- Volume metrics (50% weight)
    volume BIGINT NOT NULL,
    avg_volume_20d DECIMAL(15,2),
    volume_ratio DECIMAL(12,2),
    volume_spike_factor DECIMAL(12,2),
    volume_acceleration_2d DECIMAL(12,2),
    volume_acceleration_5d DECIMAL(12,2),
    volume_consistency_score DECIMAL(5,4),
    dollar_volume DECIMAL(15,2),
    
    -- Price momentum & consolidation (30% weight)
    is_consolidating BOOLEAN,
    consolidation_days INT,
    consolidation_range_pct DECIMAL(12,2),
    is_breakout BOOLEAN,
    price_change_5d DECIMAL(12,2),
    price_change_10d DECIMAL(12,2),
    price_change_20d DECIMAL(12,2),
    higher_lows_detected BOOLEAN,
    consecutive_green_days INT,
    
    -- Moving averages
    ema_20 DECIMAL(10,4),
    ema_50 DECIMAL(10,4),
    price_vs_ema20 DECIMAL(12,2),
    price_vs_ema50 DECIMAL(12,2),
    ema_crossover_signal BOOLEAN,
    
    -- Relative strength (15% weight)
    market_outperformance DECIMAL(12,2),
    sector_outperformance DECIMAL(12,2),
    distance_from_52w_low DECIMAL(12,2),
    distance_from_52w_high DECIMAL(12,2),
    breaking_resistance BOOLEAN,
    
    -- Risk & liquidity (5% weight)
    bid_ask_spread_pct DECIMAL(6,2),
    avg_spread_5d DECIMAL(6,2),
    float_shares BIGINT,
    is_low_float BOOLEAN,
    daily_volatility DECIMAL(12,2),
    atr_20 DECIMAL(10,4),
    pump_dump_risk VARCHAR(10),
    
    -- Country risk (added Dec 2024)
    country VARCHAR(50),
    is_high_risk_country BOOLEAN DEFAULT FALSE,
    pump_dump_warning BOOLEAN DEFAULT FALSE,
    
    -- Trend context
    trend_direction VARCHAR(10),
    
    -- Signal metadata
    signal_status VARCHAR(15) DEFAULT 'NEW',
    days_active INT DEFAULT 0,
    
    -- Risk management
    stop_loss_level DECIMAL(10,4),
    position_size_pct DECIMAL(5,2),
    
    -- Data quality
    data_quality_score DECIMAL(5,4),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one signal per symbol per day
    CONSTRAINT unique_signal_per_day UNIQUE (symbol, scan_date)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_penny_signals_symbol ON penny_stock_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_penny_signals_scan_date ON penny_stock_signals(scan_date);
CREATE INDEX IF NOT EXISTS idx_penny_signals_overall_score ON penny_stock_signals(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_penny_signals_opportunity_rank ON penny_stock_signals(opportunity_rank);
CREATE INDEX IF NOT EXISTS idx_penny_signals_recommendation ON penny_stock_signals(recommendation);
CREATE INDEX IF NOT EXISTS idx_penny_signals_volume_score ON penny_stock_signals(volume_score DESC);
CREATE INDEX IF NOT EXISTS idx_penny_signals_is_breakout ON penny_stock_signals(is_breakout) WHERE is_breakout = true;
CREATE INDEX IF NOT EXISTS idx_penny_signals_symbol_date ON penny_stock_signals(symbol, scan_date DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_penny_signals_score_date ON penny_stock_signals(overall_score DESC, scan_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE penny_stock_signals ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access to all users
CREATE POLICY "Allow read access to penny_stock_signals" ON penny_stock_signals
    FOR SELECT USING (true);

-- Create a policy to allow insert/update for service role only
CREATE POLICY "Allow insert/update for service role" ON penny_stock_signals
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_penny_signals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_penny_signals_updated_at_trigger
    BEFORE UPDATE ON penny_stock_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_penny_signals_updated_at();

-- Create view for actionable signals
CREATE OR REPLACE VIEW actionable_penny_signals AS
SELECT 
    *,
    (overall_score >= 0.60 AND 
     dollar_volume >= 100000 AND 
     volume_ratio >= 1.5 AND 
     data_quality_score >= 0.7) AS is_actionable
FROM penny_stock_signals
WHERE scan_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY overall_score DESC, volume_score DESC;

-- Create view for top opportunities
CREATE OR REPLACE VIEW top_penny_opportunities AS
SELECT 
    symbol,
    scan_date,
    close_price,
    overall_score,
    opportunity_rank,
    recommendation,
    volume_ratio,
    volume_spike_factor,
    is_breakout,
    is_consolidating,
    trend_direction,
    stop_loss_level,
    position_size_pct
FROM penny_stock_signals
WHERE overall_score >= 0.70
  AND scan_date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY overall_score DESC
LIMIT 50;

-- Comments for documentation
COMMENT ON TABLE penny_stock_signals IS 'Stores penny stock explosion setup signals with volume-focused analysis';
COMMENT ON COLUMN penny_stock_signals.overall_score IS 'Combined score (0-1): Volume 50%, Momentum 30%, Strength 15%, Risk 5%';
COMMENT ON COLUMN penny_stock_signals.opportunity_rank IS 'S/A/B/C/D tier ranking';
COMMENT ON COLUMN penny_stock_signals.volume_score IS 'Volume analysis component (up to 0.50)';
COMMENT ON COLUMN penny_stock_signals.momentum_score IS 'Price momentum component (up to 0.30)';
COMMENT ON COLUMN penny_stock_signals.relative_strength_score IS 'Relative strength component (up to 0.15)';
COMMENT ON COLUMN penny_stock_signals.risk_score IS 'Risk & liquidity component (up to 0.05)';

