-- ============================================================================
-- CDS (Call Debit Spread) SIGNAL TRACKING
-- ============================================================================
-- Stores scanner signals and outcomes for the CDS strategy.
-- Includes target tracking fields and outcome verification.
--
-- Tables: cds_signals, cds_signal_outcomes
-- Views:  cds_signal_performance, cds_signal_accuracy
-- Funcs:  upsert_cds_signal(), update_signal_outcome()
-- ============================================================================

-- ============================================================================
-- 1. CDS SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cds_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Signal identification (unique per ticker per day)
  ticker VARCHAR(10) NOT NULL,
  signal_date DATE NOT NULL,

  -- Score and grade
  signal_score INTEGER NOT NULL,
  signal_grade VARCHAR(1) GENERATED ALWAYS AS (
    CASE
      WHEN signal_score >= 80 THEN 'A'
      WHEN signal_score >= 70 THEN 'B'
      WHEN signal_score >= 60 THEN 'C'
      ELSE 'D'
    END
  ) STORED,

  -- Market context at time of signal
  regime VARCHAR(20),
  regime_confidence DECIMAL(5, 4),
  sector VARCHAR(50),

  -- Signal details
  signals JSONB NOT NULL DEFAULT '[]',
  top_signals VARCHAR(100),

  -- Price data at signal time
  price_at_signal DECIMAL(12, 2) NOT NULL,
  ma50_at_signal DECIMAL(12, 2),
  ma200_at_signal DECIMAL(12, 2),
  rsi_at_signal DECIMAL(5, 2),

  -- Spread analysis
  spread_viable BOOLEAN DEFAULT FALSE,
  spread_strikes VARCHAR(20),
  spread_debit DECIMAL(10, 2),
  spread_cushion DECIMAL(5, 2),
  spread_pop DECIMAL(5, 2),
  spread_return DECIMAL(5, 2),

  -- Target tracking (for automatic outcome verification)
  upside_potential DECIMAL(8, 4),
  target_price DECIMAL(12, 2),
  outcome_status VARCHAR(20) DEFAULT 'pending',
  outcome_date DATE,
  outcome_price DECIMAL(12, 2),
  days_to_outcome INTEGER,
  max_price_seen DECIMAL(12, 2),
  max_gain_pct DECIMAL(8, 4),

  -- Scan tracking
  scan_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_ticker_date UNIQUE (ticker, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_cds_signals_date ON cds_signals(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_cds_signals_ticker ON cds_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_cds_signals_score ON cds_signals(signal_score DESC);
CREATE INDEX IF NOT EXISTS idx_cds_signals_grade ON cds_signals(signal_grade);
CREATE INDEX IF NOT EXISTS idx_cds_signals_outcome_status ON cds_signals(outcome_status);
CREATE INDEX IF NOT EXISTS idx_cds_signals_pending_outcomes
  ON cds_signals(signal_date, outcome_status) WHERE outcome_status = 'pending';

-- RLS
ALTER TABLE cds_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to cds_signals"
  ON cds_signals FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. CDS SIGNAL OUTCOMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cds_signal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES cds_signals(id) ON DELETE CASCADE,

  -- Entry details
  entry_date DATE,
  entry_price DECIMAL(12, 2),
  entry_debit DECIMAL(10, 2),
  entry_spread VARCHAR(20),
  entry_quantity INTEGER DEFAULT 1,

  -- Exit details
  exit_date DATE,
  exit_price DECIMAL(12, 2),
  exit_credit DECIMAL(10, 2),
  exit_reason VARCHAR(20),

  -- Performance metrics
  pnl_dollars DECIMAL(12, 2),
  pnl_percent DECIMAL(8, 4),
  days_held INTEGER,

  -- Intraday tracking
  max_gain_percent DECIMAL(8, 4),
  max_drawdown_percent DECIMAL(8, 4),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_signal_outcome UNIQUE (signal_id)
);

CREATE INDEX IF NOT EXISTS idx_cds_outcomes_entry_date ON cds_signal_outcomes(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cds_outcomes_exit_reason ON cds_signal_outcomes(exit_reason);

-- RLS
ALTER TABLE cds_signal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to cds_outcomes"
  ON cds_signal_outcomes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW cds_signal_performance AS
SELECT
  s.id, s.ticker, s.signal_date, s.signal_score, s.signal_grade,
  s.regime, s.price_at_signal, s.top_signals, s.spread_viable,
  CASE
    WHEN o.id IS NULL THEN 'no_trade'
    WHEN o.exit_date IS NULL THEN 'open'
    ELSE 'closed'
  END AS status,
  o.entry_date, o.entry_debit, o.exit_date, o.exit_credit,
  o.exit_reason, o.pnl_dollars, o.pnl_percent, o.days_held,
  CASE
    WHEN o.pnl_percent IS NULL THEN NULL
    WHEN o.pnl_percent > 0 THEN 'win'
    ELSE 'loss'
  END AS result
FROM cds_signals s
LEFT JOIN cds_signal_outcomes o ON s.id = o.signal_id
ORDER BY s.signal_date DESC, s.signal_score DESC;

CREATE OR REPLACE VIEW cds_signal_accuracy AS
SELECT
  signal_grade, regime,
  COUNT(*) AS total_signals,
  SUM(CASE WHEN outcome_status = 'target_hit' THEN 1 ELSE 0 END) AS hits,
  SUM(CASE WHEN outcome_status = 'target_missed' THEN 1 ELSE 0 END) AS misses,
  SUM(CASE WHEN outcome_status = 'pending' THEN 1 ELSE 0 END) AS pending,
  ROUND(
    100.0 * SUM(CASE WHEN outcome_status = 'target_hit' THEN 1 ELSE 0 END) /
    NULLIF(SUM(CASE WHEN outcome_status IN ('target_hit', 'target_missed') THEN 1 ELSE 0 END), 0),
    1
  ) AS accuracy_pct,
  ROUND(AVG(days_to_outcome) FILTER (WHERE outcome_status = 'target_hit'), 1) AS avg_days_to_target,
  ROUND(AVG(max_gain_pct) FILTER (WHERE outcome_status != 'pending') * 100, 1) AS avg_max_gain_pct
FROM cds_signals
WHERE target_price IS NOT NULL
GROUP BY signal_grade, regime
ORDER BY signal_grade, regime;

-- ============================================================================
-- 4. FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION upsert_cds_signal(
  p_ticker VARCHAR(10),
  p_signal_date DATE,
  p_signal_score INTEGER,
  p_regime VARCHAR(20),
  p_regime_confidence DECIMAL(5, 4),
  p_signals JSONB,
  p_top_signals VARCHAR(100),
  p_price DECIMAL(12, 2),
  p_ma50 DECIMAL(12, 2),
  p_ma200 DECIMAL(12, 2),
  p_rsi DECIMAL(5, 2),
  p_spread_viable BOOLEAN,
  p_spread_strikes VARCHAR(20),
  p_spread_debit DECIMAL(10, 2),
  p_spread_cushion DECIMAL(5, 2),
  p_spread_pop DECIMAL(5, 2),
  p_spread_return DECIMAL(5, 2),
  p_sector VARCHAR(50),
  p_upside_potential DECIMAL(8, 4) DEFAULT NULL,
  p_target_price DECIMAL(12, 2) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cds_signals (
    ticker, signal_date, signal_score, regime, regime_confidence,
    signals, top_signals, price_at_signal, ma50_at_signal,
    ma200_at_signal, rsi_at_signal, spread_viable, spread_strikes,
    spread_debit, spread_cushion, spread_pop, spread_return, sector,
    upside_potential, target_price
  ) VALUES (
    p_ticker, p_signal_date, p_signal_score, p_regime, p_regime_confidence,
    p_signals, p_top_signals, p_price, p_ma50, p_ma200, p_rsi,
    p_spread_viable, p_spread_strikes, p_spread_debit, p_spread_cushion,
    p_spread_pop, p_spread_return, p_sector,
    p_upside_potential, p_target_price
  )
  ON CONFLICT (ticker, signal_date) DO UPDATE SET
    signal_score = GREATEST(cds_signals.signal_score, EXCLUDED.signal_score),
    signals = CASE
      WHEN EXCLUDED.signal_score > cds_signals.signal_score THEN EXCLUDED.signals
      ELSE cds_signals.signals
    END,
    top_signals = CASE
      WHEN EXCLUDED.signal_score > cds_signals.signal_score THEN EXCLUDED.top_signals
      ELSE cds_signals.top_signals
    END,
    price_at_signal = EXCLUDED.price_at_signal,
    regime = COALESCE(EXCLUDED.regime, cds_signals.regime),
    regime_confidence = COALESCE(EXCLUDED.regime_confidence, cds_signals.regime_confidence),
    spread_viable = EXCLUDED.spread_viable OR cds_signals.spread_viable,
    spread_strikes = COALESCE(EXCLUDED.spread_strikes, cds_signals.spread_strikes),
    spread_debit = COALESCE(EXCLUDED.spread_debit, cds_signals.spread_debit),
    spread_cushion = COALESCE(EXCLUDED.spread_cushion, cds_signals.spread_cushion),
    spread_pop = COALESCE(EXCLUDED.spread_pop, cds_signals.spread_pop),
    spread_return = COALESCE(EXCLUDED.spread_return, cds_signals.spread_return),
    upside_potential = COALESCE(EXCLUDED.upside_potential, cds_signals.upside_potential),
    target_price = COALESCE(EXCLUDED.target_price, cds_signals.target_price),
    scan_count = cds_signals.scan_count + 1,
    last_updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_signal_outcome(
  p_signal_id UUID,
  p_outcome_status VARCHAR(20),
  p_outcome_date DATE,
  p_outcome_price DECIMAL(12, 2),
  p_max_price_seen DECIMAL(12, 2),
  p_max_gain_pct DECIMAL(8, 4)
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cds_signals
  SET
    outcome_status = p_outcome_status,
    outcome_date = p_outcome_date,
    outcome_price = p_outcome_price,
    days_to_outcome = p_outcome_date - signal_date,
    max_price_seen = GREATEST(COALESCE(max_price_seen, 0), p_max_price_seen),
    max_gain_pct = GREATEST(COALESCE(max_gain_pct, 0), p_max_gain_pct),
    last_updated_at = NOW()
  WHERE id = p_signal_id
    AND outcome_status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
