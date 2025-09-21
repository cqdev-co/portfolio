-- Signal Performance Tracking System
-- This schema tracks the real-world performance of volatility squeeze signals
-- to build credibility and demonstrate strategy effectiveness

-- Create the signal performance tracking table
CREATE TABLE IF NOT EXISTS signal_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to original signal
    signal_id UUID NOT NULL REFERENCES volatility_squeeze_signals(id),
    symbol VARCHAR(10) NOT NULL,
    
    -- Entry data
    entry_date DATE NOT NULL,
    entry_price DECIMAL(12,4) NOT NULL,
    entry_score DECIMAL(6,4) NOT NULL,
    entry_recommendation VARCHAR(20) NOT NULL,
    
    -- Exit data (filled when signal resolves)
    exit_date DATE,
    exit_price DECIMAL(12,4),
    exit_reason VARCHAR(20) CHECK (exit_reason IN ('STOP_LOSS', 'PROFIT_TARGET', 'EXPANSION', 'TIME_LIMIT', 'MANUAL')),
    
    -- Performance metrics
    return_pct DECIMAL(8,4), -- Percentage return
    return_absolute DECIMAL(12,4), -- Absolute dollar return (for $1000 position)
    days_held INTEGER,
    max_favorable_excursion_pct DECIMAL(8,4), -- Best unrealized gain
    max_adverse_excursion_pct DECIMAL(8,4), -- Worst unrealized loss
    
    -- Risk metrics
    stop_loss_price DECIMAL(12,4),
    profit_target_price DECIMAL(12,4),
    initial_risk_pct DECIMAL(8,4),
    
    -- Signal context
    bb_width_percentile DECIMAL(8,4),
    squeeze_category VARCHAR(20),
    trend_direction VARCHAR(10),
    market_regime VARCHAR(20),
    
    -- Performance status
    status VARCHAR(20) CHECK (status IN ('ACTIVE', 'CLOSED', 'EXPIRED')) DEFAULT 'ACTIVE',
    is_winner BOOLEAN, -- TRUE if profitable, FALSE if loss
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_performance_symbol ON signal_performance(symbol);
CREATE INDEX IF NOT EXISTS idx_performance_entry_date ON signal_performance(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_exit_date ON signal_performance(exit_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_status ON signal_performance(status);
CREATE INDEX IF NOT EXISTS idx_performance_is_winner ON signal_performance(is_winner);
CREATE INDEX IF NOT EXISTS idx_performance_return_pct ON signal_performance(return_pct DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_performance_composite ON signal_performance(
    entry_date DESC,
    status,
    return_pct DESC
);

-- Create strategy performance summary table
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time'
    
    -- Basic metrics
    total_signals INTEGER NOT NULL DEFAULT 0,
    active_signals INTEGER NOT NULL DEFAULT 0,
    closed_signals INTEGER NOT NULL DEFAULT 0,
    
    -- Win/Loss metrics
    winning_signals INTEGER NOT NULL DEFAULT 0,
    losing_signals INTEGER NOT NULL DEFAULT 0,
    win_rate DECIMAL(6,4) NOT NULL DEFAULT 0, -- As percentage
    
    -- Return metrics
    total_return_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    average_return_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    best_return_pct DECIMAL(8,4) DEFAULT 0,
    worst_return_pct DECIMAL(8,4) DEFAULT 0,
    
    -- Risk metrics
    max_drawdown_pct DECIMAL(8,4) DEFAULT 0,
    average_days_held DECIMAL(6,2) DEFAULT 0,
    sharpe_ratio DECIMAL(6,4) DEFAULT 0,
    profit_factor DECIMAL(6,4) DEFAULT 0, -- Gross profit / Gross loss
    
    -- Strategy-specific metrics
    average_bb_width_percentile DECIMAL(8,4),
    squeeze_breakout_success_rate DECIMAL(6,4), -- % that broke out favorably
    
    -- Benchmark comparison
    spy_return_pct DECIMAL(8,4), -- S&P 500 return for same period
    alpha DECIMAL(8,4), -- Strategy return - benchmark return
    
    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for strategy performance
CREATE INDEX IF NOT EXISTS idx_strategy_performance_period ON strategy_performance(period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_type ON strategy_performance(period_type);

-- Create daily performance snapshots table
CREATE TABLE IF NOT EXISTS daily_performance_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Portfolio value simulation (assuming $10,000 starting capital)
    portfolio_value DECIMAL(12,2) NOT NULL,
    daily_return_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    cumulative_return_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    
    -- Active positions
    active_positions INTEGER NOT NULL DEFAULT 0,
    total_exposure_pct DECIMAL(6,4) NOT NULL DEFAULT 0,
    
    -- New signals today
    new_signals_today INTEGER NOT NULL DEFAULT 0,
    signals_closed_today INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    unrealized_pnl_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    realized_pnl_today_pct DECIMAL(8,4) NOT NULL DEFAULT 0,
    
    -- Market context
    vix_level DECIMAL(8,4),
    spy_return_pct DECIMAL(8,4),
    market_regime VARCHAR(20),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for daily snapshots
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_performance_snapshots(snapshot_date DESC);

-- Create a view for comprehensive performance analysis
CREATE OR REPLACE VIEW performance_dashboard AS
SELECT 
    -- Current period metrics (last 30 days)
    (SELECT COUNT(*) FROM signal_performance 
     WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days') as signals_30d,
    
    (SELECT COUNT(*) FROM signal_performance 
     WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days' AND status = 'CLOSED') as closed_30d,
    
    (SELECT ROUND(AVG(return_pct), 2) FROM signal_performance 
     WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days' AND status = 'CLOSED') as avg_return_30d,
    
    (SELECT ROUND(COUNT(CASE WHEN is_winner = true THEN 1 END) * 100.0 / COUNT(*), 1) 
     FROM signal_performance 
     WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days' AND status = 'CLOSED') as win_rate_30d,
    
    -- All-time metrics
    (SELECT COUNT(*) FROM signal_performance) as total_signals,
    (SELECT COUNT(*) FROM signal_performance WHERE status = 'CLOSED') as total_closed,
    (SELECT COUNT(*) FROM signal_performance WHERE status = 'ACTIVE') as total_active,
    
    (SELECT ROUND(AVG(return_pct), 2) FROM signal_performance WHERE status = 'CLOSED') as avg_return_all,
    (SELECT ROUND(MAX(return_pct), 2) FROM signal_performance WHERE status = 'CLOSED') as best_return,
    (SELECT ROUND(MIN(return_pct), 2) FROM signal_performance WHERE status = 'CLOSED') as worst_return,
    
    (SELECT ROUND(COUNT(CASE WHEN is_winner = true THEN 1 END) * 100.0 / COUNT(*), 1) 
     FROM signal_performance WHERE status = 'CLOSED') as win_rate_all,
    
    -- Current month
    (SELECT ROUND(SUM(return_pct), 2) FROM signal_performance 
     WHERE exit_date >= date_trunc('month', CURRENT_DATE) AND status = 'CLOSED') as month_return,
    
    -- Current year  
    (SELECT ROUND(SUM(return_pct), 2) FROM signal_performance 
     WHERE exit_date >= date_trunc('year', CURRENT_DATE) AND status = 'CLOSED') as year_return;

-- Create a view for signal leaderboard
CREATE OR REPLACE VIEW signal_leaderboard AS
SELECT 
    symbol,
    COUNT(*) as total_signals,
    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closed_signals,
    ROUND(AVG(return_pct), 2) as avg_return_pct,
    ROUND(MAX(return_pct), 2) as best_return_pct,
    ROUND(MIN(return_pct), 2) as worst_return_pct,
    ROUND(COUNT(CASE WHEN is_winner = true THEN 1 END) * 100.0 / 
          COUNT(CASE WHEN status = 'CLOSED' THEN 1 END), 1) as win_rate,
    ROUND(AVG(days_held), 1) as avg_days_held,
    MAX(entry_date) as last_signal_date
FROM signal_performance
WHERE status = 'CLOSED'
GROUP BY symbol
HAVING COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) >= 3  -- At least 3 closed signals
ORDER BY avg_return_pct DESC, win_rate DESC;

-- Create function to automatically track new signals
CREATE OR REPLACE FUNCTION track_new_signal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track signals that are actionable and have recommendations
    IF NEW.is_actionable = true AND NEW.recommendation IN ('STRONG_BUY', 'BUY', 'WATCH') THEN
        INSERT INTO signal_performance (
            signal_id,
            symbol,
            entry_date,
            entry_price,
            entry_score,
            entry_recommendation,
            stop_loss_price,
            bb_width_percentile,
            squeeze_category,
            trend_direction,
            market_regime,
            initial_risk_pct,
            status
        ) VALUES (
            NEW.id,
            NEW.symbol,
            NEW.scan_date,
            NEW.close_price,
            NEW.overall_score,
            NEW.recommendation,
            NEW.stop_loss_price,
            NEW.bb_width_percentile,
            CASE 
                WHEN NEW.bb_width_percentile <= 5 THEN 'Extremely Tight'
                WHEN NEW.bb_width_percentile <= 15 THEN 'Very Tight' 
                WHEN NEW.bb_width_percentile <= 30 THEN 'Tight'
                ELSE 'Normal'
            END,
            NEW.trend_direction,
            NEW.market_regime,
            CASE 
                WHEN NEW.stop_loss_price IS NOT NULL AND NEW.close_price > NEW.stop_loss_price 
                THEN (NEW.close_price - NEW.stop_loss_price) / NEW.close_price * 100
                ELSE NULL 
            END,
            'ACTIVE'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track new actionable signals
CREATE TRIGGER track_new_signal_trigger
    AFTER INSERT ON volatility_squeeze_signals
    FOR EACH ROW
    EXECUTE FUNCTION track_new_signal();

-- Create function to update performance when signals are updated
CREATE OR REPLACE FUNCTION update_signal_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- If signal status changed to ENDED, close the performance tracking
    IF OLD.signal_status != 'ENDED' AND NEW.signal_status = 'ENDED' THEN
        UPDATE signal_performance 
        SET 
            exit_date = CURRENT_DATE,
            exit_price = NEW.close_price,
            exit_reason = 'EXPANSION',
            return_pct = (NEW.close_price - entry_price) / entry_price * 100,
            return_absolute = (NEW.close_price - entry_price) * 10, -- Assuming $1000 position
            days_held = CURRENT_DATE - entry_date,
            is_winner = (NEW.close_price > entry_price),
            status = 'CLOSED',
            updated_at = NOW()
        WHERE signal_id = NEW.id AND status = 'ACTIVE';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for signal updates
CREATE TRIGGER update_signal_performance_trigger
    AFTER UPDATE ON volatility_squeeze_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_signal_performance();

-- Create function to calculate daily performance snapshots
CREATE OR REPLACE FUNCTION create_daily_snapshot()
RETURNS void AS $$
DECLARE
    portfolio_val DECIMAL(12,2);
    daily_ret DECIMAL(8,4);
    cumulative_ret DECIMAL(8,4);
    active_pos INTEGER;
    new_sigs INTEGER;
    closed_sigs INTEGER;
    unrealized_pnl DECIMAL(8,4);
    realized_pnl DECIMAL(8,4);
BEGIN
    -- Calculate portfolio value (simulate $10,000 starting capital)
    SELECT 
        10000 + COALESCE(SUM(return_absolute), 0)
    INTO portfolio_val
    FROM signal_performance 
    WHERE status = 'CLOSED';
    
    -- Calculate daily return
    SELECT 
        COALESCE(SUM(return_pct), 0)
    INTO daily_ret
    FROM signal_performance 
    WHERE exit_date = CURRENT_DATE;
    
    -- Calculate cumulative return
    SELECT 
        (portfolio_val - 10000) / 10000 * 100
    INTO cumulative_ret;
    
    -- Count active positions
    SELECT COUNT(*) INTO active_pos
    FROM signal_performance 
    WHERE status = 'ACTIVE';
    
    -- Count new signals today
    SELECT COUNT(*) INTO new_sigs
    FROM signal_performance 
    WHERE entry_date = CURRENT_DATE;
    
    -- Count signals closed today
    SELECT COUNT(*) INTO closed_sigs
    FROM signal_performance 
    WHERE exit_date = CURRENT_DATE;
    
    -- Calculate unrealized P&L (would need current prices - simplified for now)
    unrealized_pnl := 0;
    
    -- Calculate realized P&L today
    SELECT COALESCE(SUM(return_pct), 0) INTO realized_pnl
    FROM signal_performance 
    WHERE exit_date = CURRENT_DATE;
    
    -- Insert daily snapshot
    INSERT INTO daily_performance_snapshots (
        snapshot_date,
        portfolio_value,
        daily_return_pct,
        cumulative_return_pct,
        active_positions,
        new_signals_today,
        signals_closed_today,
        unrealized_pnl_pct,
        realized_pnl_today_pct
    ) VALUES (
        CURRENT_DATE,
        portfolio_val,
        daily_ret,
        cumulative_ret,
        active_pos,
        new_sigs,
        closed_sigs,
        unrealized_pnl,
        realized_pnl
    )
    ON CONFLICT (snapshot_date) DO UPDATE SET
        portfolio_value = EXCLUDED.portfolio_value,
        daily_return_pct = EXCLUDED.daily_return_pct,
        cumulative_return_pct = EXCLUDED.cumulative_return_pct,
        active_positions = EXCLUDED.active_positions,
        new_signals_today = EXCLUDED.new_signals_today,
        signals_closed_today = EXCLUDED.signals_closed_today,
        unrealized_pnl_pct = EXCLUDED.unrealized_pnl_pct,
        realized_pnl_today_pct = EXCLUDED.realized_pnl_today_pct;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to daily snapshots
ALTER TABLE daily_performance_snapshots 
ADD CONSTRAINT unique_snapshot_date UNIQUE (snapshot_date);

-- Enable RLS on new tables
ALTER TABLE signal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow all operations on signal_performance" ON signal_performance
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on strategy_performance" ON strategy_performance
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on daily_snapshots" ON daily_performance_snapshots
    FOR ALL USING (true) WITH CHECK (true);

-- Create useful performance queries as comments
/*
-- Current performance dashboard
SELECT * FROM performance_dashboard;

-- Top performing symbols
SELECT * FROM signal_leaderboard LIMIT 10;

-- Recent performance (last 30 days)
SELECT 
    symbol,
    entry_date,
    return_pct,
    days_held,
    exit_reason
FROM signal_performance 
WHERE entry_date >= CURRENT_DATE - INTERVAL '30 days'
    AND status = 'CLOSED'
ORDER BY return_pct DESC;

-- Monthly performance summary
SELECT 
    date_trunc('month', exit_date) as month,
    COUNT(*) as signals,
    ROUND(AVG(return_pct), 2) as avg_return,
    ROUND(SUM(return_pct), 2) as total_return,
    ROUND(COUNT(CASE WHEN is_winner = true THEN 1 END) * 100.0 / COUNT(*), 1) as win_rate
FROM signal_performance 
WHERE status = 'CLOSED' AND exit_date IS NOT NULL
GROUP BY date_trunc('month', exit_date)
ORDER BY month DESC;

-- Performance by squeeze tightness
SELECT 
    squeeze_category,
    COUNT(*) as signals,
    ROUND(AVG(return_pct), 2) as avg_return,
    ROUND(COUNT(CASE WHEN is_winner = true THEN 1 END) * 100.0 / COUNT(*), 1) as win_rate
FROM signal_performance 
WHERE status = 'CLOSED'
GROUP BY squeeze_category
ORDER BY avg_return DESC;

-- Create daily snapshot (run this daily)
SELECT create_daily_snapshot();

-- Portfolio value over time
SELECT 
    snapshot_date,
    portfolio_value,
    cumulative_return_pct,
    active_positions
FROM daily_performance_snapshots 
ORDER BY snapshot_date DESC 
LIMIT 30;
*/
