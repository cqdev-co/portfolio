-- ============================================================================
-- USER POSITIONS & SPREADS
-- ============================================================================
-- User portfolio positions including stocks, options, and multi-leg spreads.
-- Uses proper RLS with auth.uid() for multi-user support.
--
-- Tables: user_spreads, user_positions
-- ============================================================================

-- ============================================================================
-- 1. SPREADS (parent for multi-leg positions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_spreads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Spread identification
  symbol VARCHAR(10) NOT NULL,
  spread_type VARCHAR(20) NOT NULL CHECK (spread_type IN (
    'call_debit_spread', 'call_credit_spread',
    'put_debit_spread', 'put_credit_spread',
    'iron_condor', 'iron_butterfly',
    'straddle', 'strangle',
    'calendar_spread', 'diagonal_spread',
    'custom'
  )),

  -- Entry details
  net_debit_credit DECIMAL(12, 4) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  entry_date DATE NOT NULL,
  expiration_date DATE NOT NULL,

  -- Calculated risk metrics
  max_profit DECIMAL(12, 4),
  max_loss DECIMAL(12, 4),
  breakeven_lower DECIMAL(12, 4),
  breakeven_upper DECIMAL(12, 4),
  width DECIMAL(12, 4),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_spreads_user_id ON user_spreads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_spreads_symbol ON user_spreads(symbol);
CREATE INDEX IF NOT EXISTS idx_user_spreads_expiration ON user_spreads(expiration_date);

CREATE TRIGGER trigger_update_spreads_updated_at
  BEFORE UPDATE ON user_spreads
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE user_spreads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spreads"
  ON user_spreads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spreads"
  ON user_spreads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spreads"
  ON user_spreads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own spreads"
  ON user_spreads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 2. POSITIONS (individual legs or standalone)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spread_id UUID REFERENCES user_spreads(id) ON DELETE CASCADE,

  -- Position details
  symbol VARCHAR(10) NOT NULL,
  position_type VARCHAR(10) NOT NULL DEFAULT 'stock'
    CHECK (position_type IN ('stock', 'option')),
  quantity DECIMAL(12, 4) NOT NULL CHECK (quantity != 0),
  entry_price DECIMAL(12, 4) NOT NULL CHECK (entry_price > 0),
  entry_date DATE NOT NULL,

  -- Option-specific fields
  option_type VARCHAR(4) CHECK (option_type IN ('call', 'put', NULL)),
  strike_price DECIMAL(12, 4) CHECK (strike_price > 0 OR strike_price IS NULL),
  expiration_date DATE,
  leg_label VARCHAR(20),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_option_fields CHECK (
    (position_type = 'stock' AND option_type IS NULL
      AND strike_price IS NULL AND expiration_date IS NULL)
    OR
    (position_type = 'option' AND option_type IS NOT NULL
      AND strike_price IS NOT NULL AND expiration_date IS NOT NULL)
  ),
  CONSTRAINT valid_spread_leg CHECK (
    leg_label IS NULL OR spread_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_user_positions_user_id ON user_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_positions_symbol ON user_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_user_positions_user_symbol ON user_positions(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_user_positions_spread_id ON user_positions(spread_id) WHERE spread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_positions_expiration ON user_positions(expiration_date) WHERE position_type = 'option';

CREATE TRIGGER trigger_update_positions_updated_at
  BEFORE UPDATE ON user_positions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON user_positions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions"
  ON user_positions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions"
  ON user_positions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own positions"
  ON user_positions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE user_spreads IS 'Multi-leg option spreads (parent table for linked positions)';
COMMENT ON COLUMN user_spreads.net_debit_credit IS 'Net cost: positive = paid (debit), negative = received (credit)';
COMMENT ON TABLE user_positions IS 'Individual positions: stocks, single options, or spread legs';
COMMENT ON COLUMN user_positions.quantity IS 'Positive = long, Negative = short';
COMMENT ON COLUMN user_positions.leg_label IS 'Identifies the leg role (e.g., long_call, short_put)';
