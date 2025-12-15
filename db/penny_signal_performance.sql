-- Penny Signal Performance Tracking Table Schema
-- Tracks real-world performance of penny stock signals

CREATE TABLE IF NOT EXISTS penny_signal_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to the original signal
    signal_id UUID REFERENCES penny_stock_signals(id),
    symbol VARCHAR(10) NOT NULL,
    
    -- Entry information
    entry_date DATE NOT NULL,
    entry_price DECIMAL(10,4) NOT NULL,
    entry_score DECIMAL(5,4),
    opportunity_rank VARCHAR(1),
    
    -- Stop loss and targets
    stop_loss_price DECIMAL(10,4),
    profit_target_price DECIMAL(10,4),  -- Primary target (20%)
    
    -- Dynamic targets based on signal quality
    target_1_price DECIMAL(10,4),  -- First target (10%)
    target_2_price DECIMAL(10,4),  -- Second target (20%)
    target_3_price DECIMAL(10,4),  -- Third target (30%)
    
    -- Exit information
    exit_date DATE,
    exit_price DECIMAL(10,4),
    exit_reason VARCHAR(20),  -- STOP_LOSS, SIGNAL_ENDED, TARGET_HIT, MANUAL
    
    -- Performance metrics
    return_pct DECIMAL(10,4),
    return_absolute DECIMAL(15,4),
    days_held INT,
    is_winner BOOLEAN,
    
    -- Maximum reached during trade
    max_price_reached DECIMAL(10,4),
    max_gain_pct DECIMAL(10,4),
    
    -- Profit target tracking
    hit_target_10pct BOOLEAN DEFAULT FALSE,
    hit_target_20pct BOOLEAN DEFAULT FALSE,
    hit_target_30pct BOOLEAN DEFAULT FALSE,
    targets_hit_count INT DEFAULT 0,
    first_target_hit_date DATE,
    
    -- Additional signal context
    volume_spike_factor DECIMAL(10,2),
    is_breakout BOOLEAN,
    
    -- Status
    status VARCHAR(10) DEFAULT 'ACTIVE',  -- ACTIVE, CLOSED
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_penny_perf_symbol ON penny_signal_performance(symbol);
CREATE INDEX IF NOT EXISTS idx_penny_perf_entry_date ON penny_signal_performance(entry_date);
CREATE INDEX IF NOT EXISTS idx_penny_perf_status ON penny_signal_performance(status);
CREATE INDEX IF NOT EXISTS idx_penny_perf_rank ON penny_signal_performance(opportunity_rank);
CREATE INDEX IF NOT EXISTS idx_penny_perf_winner ON penny_signal_performance(is_winner) WHERE status = 'CLOSED';
CREATE INDEX IF NOT EXISTS idx_penny_perf_return ON penny_signal_performance(return_pct DESC) WHERE status = 'CLOSED';

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_penny_perf_symbol_status ON penny_signal_performance(symbol, status);
CREATE INDEX IF NOT EXISTS idx_penny_perf_date_status ON penny_signal_performance(entry_date DESC, status);

-- Enable Row Level Security (RLS)
ALTER TABLE penny_signal_performance ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access to all users
CREATE POLICY "Allow read access to penny_signal_performance" ON penny_signal_performance
    FOR SELECT USING (true);

-- Create a policy to allow insert/update for service role only
CREATE POLICY "Allow insert/update for service role on penny_signal_performance" ON penny_signal_performance
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_penny_perf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_penny_perf_updated_at_trigger ON penny_signal_performance;
CREATE TRIGGER update_penny_perf_updated_at_trigger
    BEFORE UPDATE ON penny_signal_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_penny_perf_updated_at();

-- Create view for performance summary
CREATE OR REPLACE VIEW penny_performance_summary AS
SELECT 
    COUNT(*) as total_signals,
    COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_signals,
    COUNT(*) FILTER (WHERE status = 'CLOSED') as closed_signals,
    COUNT(*) FILTER (WHERE is_winner = true AND status = 'CLOSED') as winning_trades,
    COUNT(*) FILTER (WHERE is_winner = false AND status = 'CLOSED') as losing_trades,
    ROUND(
        COUNT(*) FILTER (WHERE is_winner = true AND status = 'CLOSED')::numeric / 
        NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100, 
        2
    ) as win_rate_pct,
    ROUND(AVG(return_pct) FILTER (WHERE status = 'CLOSED'), 2) as avg_return_pct,
    ROUND(AVG(return_pct) FILTER (WHERE is_winner = true AND status = 'CLOSED'), 2) as avg_winner_pct,
    ROUND(AVG(return_pct) FILTER (WHERE is_winner = false AND status = 'CLOSED'), 2) as avg_loser_pct,
    ROUND(AVG(days_held) FILTER (WHERE status = 'CLOSED'), 1) as avg_days_held,
    ROUND(AVG(max_gain_pct) FILTER (WHERE status = 'CLOSED'), 2) as avg_max_gain_pct,
    COUNT(*) FILTER (WHERE hit_target_10pct = true AND status = 'CLOSED') as hit_10pct_count,
    COUNT(*) FILTER (WHERE hit_target_20pct = true AND status = 'CLOSED') as hit_20pct_count,
    COUNT(*) FILTER (WHERE hit_target_30pct = true AND status = 'CLOSED') as hit_30pct_count,
    COUNT(*) FILTER (WHERE exit_reason = 'STOP_LOSS' AND status = 'CLOSED') as stop_loss_exits
FROM penny_signal_performance;

-- Create view for performance by rank
CREATE OR REPLACE VIEW penny_performance_by_rank AS
SELECT 
    opportunity_rank,
    COUNT(*) as trade_count,
    COUNT(*) FILTER (WHERE is_winner = true) as wins,
    COUNT(*) FILTER (WHERE is_winner = false) as losses,
    ROUND(
        COUNT(*) FILTER (WHERE is_winner = true)::numeric / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as win_rate_pct,
    ROUND(AVG(return_pct), 2) as avg_return_pct,
    ROUND(AVG(max_gain_pct), 2) as avg_max_gain_pct,
    ROUND(AVG(days_held), 1) as avg_days_held
FROM penny_signal_performance
WHERE status = 'CLOSED'
GROUP BY opportunity_rank
ORDER BY opportunity_rank;

-- Comments for documentation
COMMENT ON TABLE penny_signal_performance IS 'Tracks real-world performance of penny stock signals';
COMMENT ON COLUMN penny_signal_performance.max_price_reached IS 'Maximum price reached during holding period';
COMMENT ON COLUMN penny_signal_performance.max_gain_pct IS 'Maximum gain percentage achieved during trade';
COMMENT ON COLUMN penny_signal_performance.hit_target_10pct IS 'Whether 10% profit target was hit';
COMMENT ON COLUMN penny_signal_performance.hit_target_20pct IS 'Whether 20% profit target was hit';
COMMENT ON COLUMN penny_signal_performance.hit_target_30pct IS 'Whether 30% profit target was hit';
COMMENT ON COLUMN penny_signal_performance.exit_reason IS 'STOP_LOSS, SIGNAL_ENDED, TARGET_HIT, or MANUAL';
