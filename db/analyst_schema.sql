-- ============================================================================
-- AI ANALYST AGENT - DATABASE SCHEMA
-- ============================================================================
-- 
-- Memory system for the AI analyst agent. Stores:
-- - Trade journal (all spread trades from Robinhood exports)
-- - Market observations (patterns noticed over time)
-- - Performance snapshots (weekly summaries)
--
-- Run this in Supabase SQL Editor to set up the tables.
-- ============================================================================

-- ============================================================================
-- TRADE JOURNAL
-- ============================================================================
-- Every spread trade, imported from Robinhood CSV or logged manually.
-- This is the primary source of truth for past performance.

CREATE TABLE IF NOT EXISTS analyst_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trade identification
  ticker TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN (
    'call_debit', 'put_credit', 'call_credit', 'put_debit'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'bearish')),
  
  -- Spread details
  long_strike DECIMAL(10, 2) NOT NULL,
  short_strike DECIMAL(10, 2) NOT NULL,
  expiration DATE NOT NULL,
  quantity INTEGER DEFAULT 1,
  
  -- Timing
  open_date DATE NOT NULL,
  close_date DATE,
  days_held INTEGER GENERATED ALWAYS AS (
    CASE WHEN close_date IS NOT NULL 
      THEN close_date - open_date 
      ELSE NULL 
    END
  ) STORED,
  
  -- Financials (per contract, multiply by quantity * 100 for total)
  open_premium DECIMAL(10, 4) NOT NULL,  -- Net debit/credit to open
  close_premium DECIMAL(10, 4),           -- Net debit/credit to close
  max_profit DECIMAL(10, 4),              -- Spread width - premium (for debit)
  max_loss DECIMAL(10, 4),                -- Premium paid (for debit)
  realized_pnl DECIMAL(10, 4),            -- Actual P&L
  return_pct DECIMAL(6, 2),               -- Return as percentage
  
  -- Outcome
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'closed', 'expired', 'assigned'
  )),
  outcome TEXT CHECK (outcome IN (
    'win', 'loss', 'breakeven', 'max_profit', 'max_loss'
  )),
  close_reason TEXT CHECK (close_reason IN (
    'manual', 'expiration', 'assignment', 'stop_loss', 'target_hit'
  )),
  
  -- Analysis context at entry
  thesis TEXT,                            -- Why you entered
  lessons_learned TEXT,                   -- What you learned after
  entry_score INTEGER,                    -- Stock score at entry (0-100)
  entry_rsi DECIMAL(5, 2),                -- RSI at entry
  market_regime TEXT CHECK (market_regime IN ('bull', 'neutral', 'bear')),
  
  -- Metadata
  source TEXT DEFAULT 'csv_import' CHECK (source IN (
    'csv_import', 'manual', 'api'
  )),
  tags TEXT[] DEFAULT '{}',
  raw_transactions JSONB,                 -- Original CSV rows for reference
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analyst_trades_ticker 
  ON analyst_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_analyst_trades_open_date 
  ON analyst_trades(open_date DESC);
CREATE INDEX IF NOT EXISTS idx_analyst_trades_status 
  ON analyst_trades(status);
CREATE INDEX IF NOT EXISTS idx_analyst_trades_outcome 
  ON analyst_trades(outcome);
CREATE INDEX IF NOT EXISTS idx_analyst_trades_type 
  ON analyst_trades(trade_type);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_analyst_trades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analyst_trades_updated_at
  BEFORE UPDATE ON analyst_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_analyst_trades_updated_at();

-- ============================================================================
-- MARKET OBSERVATIONS
-- ============================================================================
-- Patterns and rules you notice over time. AI can reference these.

CREATE TABLE IF NOT EXISTS analyst_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The observation itself
  observation TEXT NOT NULL,
  
  -- Context when the observation was made
  context JSONB DEFAULT '{}',  -- Market conditions, etc.
  
  -- Confidence level
  confidence TEXT DEFAULT 'hypothesis' CHECK (confidence IN (
    'hypothesis',   -- Just noticed, needs validation
    'pattern',      -- Seen multiple times
    'rule'          -- Proven reliable
  )),
  
  -- Validation
  validated BOOLEAN DEFAULT FALSE,
  validation_notes TEXT,
  
  -- Supporting evidence
  supporting_trades UUID[] DEFAULT '{}',  -- Trade IDs that support this
  contradicting_trades UUID[] DEFAULT '{}',  -- Trade IDs that contradict
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_observations_confidence 
  ON analyst_observations(confidence);
CREATE INDEX IF NOT EXISTS idx_analyst_observations_validated 
  ON analyst_observations(validated);

-- ============================================================================
-- PERFORMANCE SNAPSHOTS
-- ============================================================================
-- Weekly/monthly performance summaries for tracking progress.

CREATE TABLE IF NOT EXISTS analyst_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Period
  period_type TEXT NOT NULL CHECK (period_type IN ('week', 'month', 'quarter')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Trade counts
  total_trades INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  breakeven INTEGER DEFAULT 0,
  
  -- Performance metrics
  win_rate DECIMAL(5, 2),           -- Percentage
  total_pnl DECIMAL(12, 2),         -- Dollars
  avg_win DECIMAL(10, 2),
  avg_loss DECIMAL(10, 2),
  profit_factor DECIMAL(6, 2),      -- Total wins / Total losses
  largest_win DECIMAL(10, 2),
  largest_loss DECIMAL(10, 2),
  
  -- Best/worst
  best_ticker TEXT,
  best_ticker_pnl DECIMAL(10, 2),
  worst_ticker TEXT,
  worst_ticker_pnl DECIMAL(10, 2),
  
  -- Notes
  notes TEXT,
  market_regime TEXT,               -- Predominant regime during period
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate periods
  UNIQUE(period_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_analyst_performance_period 
  ON analyst_performance(period_start DESC);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Recent trades with outcomes
CREATE OR REPLACE VIEW analyst_recent_trades AS
SELECT 
  id,
  ticker,
  trade_type,
  direction,
  long_strike || '/' || short_strike AS strikes,
  expiration,
  open_date,
  close_date,
  days_held,
  open_premium,
  realized_pnl,
  return_pct,
  status,
  outcome,
  thesis
FROM analyst_trades
ORDER BY open_date DESC
LIMIT 50;

-- Performance by ticker
CREATE OR REPLACE VIEW analyst_ticker_performance AS
SELECT 
  ticker,
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
  COUNT(*) FILTER (WHERE outcome = 'loss') AS losses,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE outcome = 'win') / NULLIF(COUNT(*), 0), 
    1
  ) AS win_rate,
  SUM(realized_pnl) AS total_pnl,
  ROUND(AVG(realized_pnl) FILTER (WHERE outcome = 'win'), 2) AS avg_win,
  ROUND(AVG(realized_pnl) FILTER (WHERE outcome = 'loss'), 2) AS avg_loss,
  ROUND(AVG(days_held), 1) AS avg_days_held
FROM analyst_trades
WHERE status != 'open'
GROUP BY ticker
ORDER BY total_trades DESC;

-- Monthly summary
CREATE OR REPLACE VIEW analyst_monthly_summary AS
SELECT 
  DATE_TRUNC('month', open_date) AS month,
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
  COUNT(*) FILTER (WHERE outcome = 'loss') AS losses,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE outcome = 'win') / NULLIF(COUNT(*), 0), 
    1
  ) AS win_rate,
  SUM(realized_pnl) AS total_pnl
FROM analyst_trades
WHERE status != 'open'
GROUP BY DATE_TRUNC('month', open_date)
ORDER BY month DESC;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS for multi-user support in the future

ALTER TABLE analyst_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_performance ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated users (single user system)
-- Adjust these policies if you add multi-user support

CREATE POLICY "Allow all for authenticated users" ON analyst_trades
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON analyst_observations
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON analyst_performance
  FOR ALL USING (true);

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to insert sample data

/*
INSERT INTO analyst_observations (observation, confidence, tags) VALUES
  ('RSI < 55 at entry correlates with higher win rate', 'pattern', 
   ARRAY['entry_timing', 'rsi']),
  ('NVDA spreads perform best on pullbacks to MA20', 'hypothesis', 
   ARRAY['nvda', 'ma20']),
  ('Weekly expirations have higher win rate than monthlies', 'hypothesis', 
   ARRAY['expiration', 'timing']);
*/

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Grant access to the service role (for backend operations)

GRANT ALL ON analyst_trades TO service_role;
GRANT ALL ON analyst_observations TO service_role;
GRANT ALL ON analyst_performance TO service_role;
GRANT ALL ON analyst_recent_trades TO service_role;
GRANT ALL ON analyst_ticker_performance TO service_role;
GRANT ALL ON analyst_monthly_summary TO service_role;

