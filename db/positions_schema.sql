-- ============================================================================
-- AI ANALYST - OPEN POSITIONS TABLE
-- ============================================================================
-- Tracks current open positions so the AI knows what you're holding.
-- Run this in Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analyst_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Position identification
  ticker TEXT NOT NULL,
  position_type TEXT NOT NULL CHECK (position_type IN (
    'call_debit_spread',   -- Our primary strategy
    'put_credit_spread',
    'stock',
    'call_long',
    'put_long'
  )),
  
  -- Spread details (for spreads)
  long_strike DECIMAL(10, 2),
  short_strike DECIMAL(10, 2),
  expiration DATE,
  
  -- Position size
  quantity INTEGER DEFAULT 1,
  
  -- Entry details
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_price DECIMAL(10, 4) NOT NULL,  -- Price per share or debit per contract
  entry_underlying DECIMAL(10, 2),       -- Underlying price at entry
  
  -- Current status
  current_value DECIMAL(10, 4),          -- Updated manually or via refresh
  unrealized_pnl DECIMAL(10, 4),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Risk management
  stop_loss DECIMAL(10, 4),              -- Price to exit at loss
  profit_target DECIMAL(10, 4),          -- Price to take profit
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(ticker, position_type, long_strike, short_strike, expiration)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyst_positions_ticker 
  ON analyst_positions(ticker);
CREATE INDEX IF NOT EXISTS idx_analyst_positions_expiration 
  ON analyst_positions(expiration);

-- View for easy display
CREATE OR REPLACE VIEW analyst_open_positions AS
SELECT 
  id,
  ticker,
  position_type,
  CASE 
    WHEN long_strike IS NOT NULL AND short_strike IS NOT NULL 
    THEN '$' || long_strike || '/$' || short_strike 
    ELSE NULL 
  END AS strikes,
  expiration,
  CASE 
    WHEN expiration IS NOT NULL 
    THEN expiration - CURRENT_DATE 
    ELSE NULL 
  END AS dte,
  quantity,
  entry_date,
  entry_price,
  entry_underlying,
  current_value,
  unrealized_pnl,
  notes
FROM analyst_positions
ORDER BY expiration ASC NULLS LAST, ticker;

-- Grants
GRANT ALL ON analyst_positions TO service_role;
GRANT ALL ON analyst_open_positions TO service_role;

-- Enable RLS
ALTER TABLE analyst_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON analyst_positions
  FOR ALL USING (true);

