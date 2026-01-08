-- CDS Signal Performance Tracking Schema
-- Run this in Supabase SQL Editor to create the tables
--
-- Purpose: Track scanner signals and their outcomes to validate
-- the scoring system over time.

-- ============================================================
-- Table 1: cds_signals
-- Stores every signal the scanner generates (auto-captured)
-- ============================================================

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
  regime VARCHAR(20), -- bull, neutral, bear, caution
  regime_confidence DECIMAL(5, 4),
  sector VARCHAR(50),
  
  -- Signal details
  signals JSONB NOT NULL DEFAULT '[]', -- Array of signal names
  top_signals VARCHAR(100), -- Comma-separated top 3 for quick view
  
  -- Price data at signal time
  price_at_signal DECIMAL(12, 2) NOT NULL,
  ma50_at_signal DECIMAL(12, 2),
  ma200_at_signal DECIMAL(12, 2),
  rsi_at_signal DECIMAL(5, 2),
  
  -- Spread analysis (if applicable)
  spread_viable BOOLEAN DEFAULT FALSE,
  spread_strikes VARCHAR(20), -- e.g., "470/480"
  spread_debit DECIMAL(10, 2),
  spread_cushion DECIMAL(5, 2),
  spread_pop DECIMAL(5, 2),
  spread_return DECIMAL(5, 2),
  
  -- Scan tracking (for multiple scans per day)
  scan_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_ticker_date UNIQUE (ticker, signal_date)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_signals_date ON cds_signals(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_ticker ON cds_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_score ON cds_signals(signal_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_grade ON cds_signals(signal_grade);

-- ============================================================
-- Table 2: cds_signal_outcomes
-- Stores outcomes for signals that were traded
-- ============================================================

CREATE TABLE IF NOT EXISTS cds_signal_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES cds_signals(id) ON DELETE CASCADE,
  
  -- Entry details
  entry_date DATE,
  entry_price DECIMAL(12, 2), -- Stock price at entry
  entry_debit DECIMAL(10, 2), -- Spread debit paid
  entry_spread VARCHAR(20), -- e.g., "470/480"
  entry_quantity INTEGER DEFAULT 1,
  
  -- Exit details
  exit_date DATE,
  exit_price DECIMAL(12, 2), -- Stock price at exit
  exit_credit DECIMAL(10, 2), -- Spread credit received
  exit_reason VARCHAR(20), -- target, stop, time, earnings, manual
  
  -- Performance metrics (calculated on exit)
  pnl_dollars DECIMAL(12, 2),
  pnl_percent DECIMAL(8, 4),
  days_held INTEGER,
  
  -- Intraday tracking (optional)
  max_gain_percent DECIMAL(8, 4),
  max_drawdown_percent DECIMAL(8, 4),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One outcome per signal
  CONSTRAINT unique_signal_outcome UNIQUE (signal_id)
);

-- Index for performance queries
CREATE INDEX IF NOT EXISTS idx_outcomes_entry_date ON cds_signal_outcomes(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_exit_reason ON cds_signal_outcomes(exit_reason);

-- ============================================================
-- View: Signal Performance Summary
-- Quick access to combined signal + outcome data
-- ============================================================

CREATE OR REPLACE VIEW cds_signal_performance AS
SELECT 
  s.id,
  s.ticker,
  s.signal_date,
  s.signal_score,
  s.signal_grade,
  s.regime,
  s.price_at_signal,
  s.top_signals,
  s.spread_viable,
  
  -- Outcome status
  CASE 
    WHEN o.id IS NULL THEN 'no_trade'
    WHEN o.exit_date IS NULL THEN 'open'
    ELSE 'closed'
  END AS status,
  
  -- Outcome details
  o.entry_date,
  o.entry_debit,
  o.exit_date,
  o.exit_credit,
  o.exit_reason,
  o.pnl_dollars,
  o.pnl_percent,
  o.days_held,
  
  -- Win/Loss classification
  CASE 
    WHEN o.pnl_percent IS NULL THEN NULL
    WHEN o.pnl_percent > 0 THEN 'win'
    ELSE 'loss'
  END AS result

FROM cds_signals s
LEFT JOIN cds_signal_outcomes o ON s.id = o.signal_id
ORDER BY s.signal_date DESC, s.signal_score DESC;

-- ============================================================
-- Function: Upsert signal (handles multiple scans per day)
-- ============================================================

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
  p_sector VARCHAR(50)
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cds_signals (
    ticker, signal_date, signal_score, regime, regime_confidence,
    signals, top_signals, price_at_signal, ma50_at_signal, 
    ma200_at_signal, rsi_at_signal, spread_viable, spread_strikes,
    spread_debit, spread_cushion, spread_pop, spread_return, sector
  ) VALUES (
    p_ticker, p_signal_date, p_signal_score, p_regime, p_regime_confidence,
    p_signals, p_top_signals, p_price, p_ma50, p_ma200, p_rsi,
    p_spread_viable, p_spread_strikes, p_spread_debit, p_spread_cushion,
    p_spread_pop, p_spread_return, p_sector
  )
  ON CONFLICT (ticker, signal_date) DO UPDATE SET
    -- Keep the BEST score of the day
    signal_score = GREATEST(cds_signals.signal_score, EXCLUDED.signal_score),
    -- Update other fields if score improved
    signals = CASE 
      WHEN EXCLUDED.signal_score > cds_signals.signal_score 
      THEN EXCLUDED.signals 
      ELSE cds_signals.signals 
    END,
    top_signals = CASE 
      WHEN EXCLUDED.signal_score > cds_signals.signal_score 
      THEN EXCLUDED.top_signals 
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
    scan_count = cds_signals.scan_count + 1,
    last_updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS Policies (if using Supabase auth)
-- ============================================================

ALTER TABLE cds_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cds_signal_outcomes ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (CLI access)
CREATE POLICY "Service role full access to signals"
  ON cds_signals FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to outcomes"
  ON cds_signal_outcomes FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Sample queries for reference
-- ============================================================

-- Get recent signals
-- SELECT * FROM cds_signals ORDER BY signal_date DESC LIMIT 20;

-- Get signals with outcomes
-- SELECT * FROM cds_signal_performance WHERE status = 'closed';

-- Win rate by grade
-- SELECT 
--   signal_grade,
--   COUNT(*) as trades,
--   SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
--   ROUND(100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
-- FROM cds_signal_performance
-- WHERE status = 'closed'
-- GROUP BY signal_grade
-- ORDER BY signal_grade;

-- Win rate by regime
-- SELECT 
--   regime,
--   COUNT(*) as trades,
--   ROUND(100.0 * SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate,
--   ROUND(AVG(pnl_percent), 2) as avg_return
-- FROM cds_signal_performance
-- WHERE status = 'closed'
-- GROUP BY regime;

