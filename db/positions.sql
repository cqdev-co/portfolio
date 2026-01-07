-- ============================================================================
-- User Positions & Spreads Schema
-- ============================================================================
-- Stores user portfolio positions including stocks, options, and spreads.
-- Uses RLS to ensure users can only access their own data.
-- ============================================================================

-- ============================================================================
-- SPREADS TABLE (parent for multi-leg positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_spreads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Spread identification
  symbol VARCHAR(10) NOT NULL,
  spread_type VARCHAR(20) NOT NULL CHECK (spread_type IN (
    'call_debit_spread',    -- Buy lower strike call, sell higher strike call
    'call_credit_spread',   -- Sell lower strike call, buy higher strike call
    'put_debit_spread',     -- Buy higher strike put, sell lower strike put
    'put_credit_spread',    -- Sell higher strike put, buy lower strike put
    'iron_condor',          -- 4 legs: put credit spread + call credit spread
    'iron_butterfly',       -- 4 legs: sell ATM straddle + buy OTM strangle
    'straddle',             -- Buy/sell ATM call + put same strike
    'strangle',             -- Buy/sell OTM call + put different strikes
    'calendar_spread',      -- Same strike, different expirations
    'diagonal_spread',      -- Different strikes, different expirations
    'custom'                -- Any other multi-leg strategy
  )),
  
  -- Entry details
  net_debit_credit DECIMAL(12,4) NOT NULL,  -- Positive = debit, Negative = credit
  quantity INTEGER NOT NULL CHECK (quantity > 0),  -- Number of spread contracts
  entry_date DATE NOT NULL,
  expiration_date DATE NOT NULL,  -- Primary expiration (nearest if calendar)
  
  -- Calculated risk metrics (stored for quick access)
  max_profit DECIMAL(12,4),       -- Maximum possible profit
  max_loss DECIMAL(12,4),         -- Maximum possible loss
  breakeven_lower DECIMAL(12,4),  -- Lower breakeven price
  breakeven_upper DECIMAL(12,4),  -- Upper breakeven price (if applicable)
  width DECIMAL(12,4),            -- Strike width (for vertical spreads)
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- POSITIONS TABLE (individual legs or standalone positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link to spread (NULL for standalone positions)
  spread_id UUID REFERENCES user_spreads(id) ON DELETE CASCADE,
  
  -- Position details
  symbol VARCHAR(10) NOT NULL,
  position_type VARCHAR(10) NOT NULL DEFAULT 'stock' 
    CHECK (position_type IN ('stock', 'option')),
  
  -- Quantity: positive = long, negative = short
  quantity DECIMAL(12,4) NOT NULL CHECK (quantity != 0),
  entry_price DECIMAL(12,4) NOT NULL CHECK (entry_price > 0),
  entry_date DATE NOT NULL,
  
  -- Option-specific fields (nullable for stocks)
  option_type VARCHAR(4) CHECK (option_type IN ('call', 'put', NULL)),
  strike_price DECIMAL(12,4) CHECK (strike_price > 0 OR strike_price IS NULL),
  expiration_date DATE,
  
  -- Leg identifier for spreads (e.g., 'long_call', 'short_call')
  leg_label VARCHAR(20),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_option_fields CHECK (
    (position_type = 'stock' AND option_type IS NULL 
      AND strike_price IS NULL AND expiration_date IS NULL)
    OR
    (position_type = 'option' AND option_type IS NOT NULL 
      AND strike_price IS NOT NULL AND expiration_date IS NOT NULL)
  ),
  
  -- Spread legs must have spread_id
  CONSTRAINT valid_spread_leg CHECK (
    leg_label IS NULL OR spread_id IS NOT NULL
  )
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Spreads indexes
CREATE INDEX IF NOT EXISTS idx_user_spreads_user_id 
  ON user_spreads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_spreads_symbol 
  ON user_spreads(symbol);
CREATE INDEX IF NOT EXISTS idx_user_spreads_expiration 
  ON user_spreads(expiration_date);

-- Positions indexes
CREATE INDEX IF NOT EXISTS idx_user_positions_user_id 
  ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_symbol 
  ON user_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_user_positions_user_symbol 
  ON user_positions(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_user_positions_spread_id 
  ON user_positions(spread_id) 
  WHERE spread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_positions_expiration 
  ON user_positions(expiration_date) 
  WHERE position_type = 'option';

-- ============================================================================
-- Row Level Security (RLS) - Spreads
-- ============================================================================

ALTER TABLE user_spreads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spreads"
  ON user_spreads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spreads"
  ON user_spreads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spreads"
  ON user_spreads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own spreads"
  ON user_spreads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Row Level Security (RLS) - Positions
-- ============================================================================

ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON user_positions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON user_positions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON user_positions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON user_positions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at for spreads
CREATE OR REPLACE FUNCTION update_spreads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_spreads_updated_at
  BEFORE UPDATE ON user_spreads
  FOR EACH ROW
  EXECUTE FUNCTION update_spreads_updated_at();

-- Auto-update updated_at for positions
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_positions_updated_at ON user_positions;
CREATE TRIGGER trigger_update_positions_updated_at
  BEFORE UPDATE ON user_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_positions_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE user_spreads IS 
  'Multi-leg option spreads (parent table for linked positions)';
COMMENT ON COLUMN user_spreads.spread_type IS 
  'Type of spread strategy';
COMMENT ON COLUMN user_spreads.net_debit_credit IS 
  'Net cost: positive = paid (debit), negative = received (credit)';
COMMENT ON COLUMN user_spreads.max_profit IS 
  'Maximum possible profit for this spread';
COMMENT ON COLUMN user_spreads.max_loss IS 
  'Maximum possible loss for this spread';
COMMENT ON COLUMN user_spreads.width IS 
  'Strike width for vertical spreads';

COMMENT ON TABLE user_positions IS 
  'Individual positions: stocks, single options, or spread legs';
COMMENT ON COLUMN user_positions.spread_id IS 
  'Links to parent spread (NULL for standalone positions)';
COMMENT ON COLUMN user_positions.quantity IS 
  'Positive = long, Negative = short';
COMMENT ON COLUMN user_positions.leg_label IS 
  'Identifies the leg role (e.g., long_call, short_put)';

-- ============================================================================
-- Example: Creating a Call Debit Spread (CDS)
-- ============================================================================
-- 
-- 1. Create the spread parent:
--    INSERT INTO user_spreads (
--      user_id, symbol, spread_type, net_debit_credit, quantity,
--      entry_date, expiration_date, max_profit, max_loss, width
--    ) VALUES (
--      'user-uuid', 'AAPL', 'call_debit_spread', 3.50, 1,
--      '2024-01-15', '2024-02-16', 1.50, 3.50, 5.00
--    ) RETURNING id;
--
-- 2. Create the long leg (buy lower strike):
--    INSERT INTO user_positions (
--      user_id, spread_id, symbol, position_type, quantity, entry_price,
--      entry_date, option_type, strike_price, expiration_date, leg_label
--    ) VALUES (
--      'user-uuid', 'spread-uuid', 'AAPL', 'option', 1, 5.00,
--      '2024-01-15', 'call', 180.00, '2024-02-16', 'long_call'
--    );
--
-- 3. Create the short leg (sell higher strike):
--    INSERT INTO user_positions (
--      user_id, spread_id, symbol, position_type, quantity, entry_price,
--      entry_date, option_type, strike_price, expiration_date, leg_label
--    ) VALUES (
--      'user-uuid', 'spread-uuid', 'AAPL', 'option', -1, 1.50,
--      '2024-01-15', 'call', 185.00, '2024-02-16', 'short_call'
--    );
--
-- ============================================================================
