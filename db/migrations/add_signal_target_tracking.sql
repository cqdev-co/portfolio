-- Migration: Add target tracking fields to cds_signals
-- Purpose: Enable automatic signal outcome tracking by storing target price
-- Run this in Supabase SQL Editor

-- ============================================================
-- Add columns for target tracking
-- ============================================================

-- Add upside_potential (percentage, e.g., 0.15 = 15%)
ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS upside_potential DECIMAL(8, 4);

-- Add target_price (calculated from price_at_signal * (1 + upside_potential))
ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS target_price DECIMAL(12, 2);

-- Add outcome tracking fields (for automatic verification)
ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS outcome_status VARCHAR(20) DEFAULT 'pending';
-- Values: pending, target_hit, target_missed, expired

ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS outcome_date DATE;

ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS outcome_price DECIMAL(12, 2);

ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS days_to_outcome INTEGER;

ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS max_price_seen DECIMAL(12, 2);

ALTER TABLE cds_signals
ADD COLUMN IF NOT EXISTS max_gain_pct DECIMAL(8, 4);

-- ============================================================
-- Index for outcome tracking queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_signals_outcome_status 
ON cds_signals(outcome_status);

CREATE INDEX IF NOT EXISTS idx_signals_pending_outcomes
ON cds_signals(signal_date, outcome_status)
WHERE outcome_status = 'pending';

-- ============================================================
-- Update upsert function to include new fields
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
    upside_potential = COALESCE(EXCLUDED.upside_potential, cds_signals.upside_potential),
    target_price = COALESCE(EXCLUDED.target_price, cds_signals.target_price),
    scan_count = cds_signals.scan_count + 1,
    last_updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- View: Signal Accuracy Report (for automatic outcome tracking)
-- ============================================================

CREATE OR REPLACE VIEW cds_signal_accuracy AS
SELECT 
  signal_grade,
  regime,
  COUNT(*) as total_signals,
  SUM(CASE WHEN outcome_status = 'target_hit' THEN 1 ELSE 0 END) as hits,
  SUM(CASE WHEN outcome_status = 'target_missed' THEN 1 ELSE 0 END) as misses,
  SUM(CASE WHEN outcome_status = 'pending' THEN 1 ELSE 0 END) as pending,
  ROUND(
    100.0 * SUM(CASE WHEN outcome_status = 'target_hit' THEN 1 ELSE 0 END) / 
    NULLIF(SUM(CASE WHEN outcome_status IN ('target_hit', 'target_missed') THEN 1 ELSE 0 END), 0),
    1
  ) as accuracy_pct,
  ROUND(AVG(days_to_outcome) FILTER (WHERE outcome_status = 'target_hit'), 1) as avg_days_to_target,
  ROUND(AVG(max_gain_pct) FILTER (WHERE outcome_status != 'pending') * 100, 1) as avg_max_gain_pct
FROM cds_signals
WHERE target_price IS NOT NULL
GROUP BY signal_grade, regime
ORDER BY signal_grade, regime;

-- ============================================================
-- Function: Update signal outcomes (called by CI/CD)
-- ============================================================

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

-- ============================================================
-- Sample queries for outcome tracking
-- ============================================================

-- Get pending signals older than 7 days (for outcome check)
-- SELECT id, ticker, signal_date, price_at_signal, target_price, upside_potential
-- FROM cds_signals
-- WHERE outcome_status = 'pending'
--   AND signal_date < CURRENT_DATE - INTERVAL '7 days'
--   AND target_price IS NOT NULL;

-- Signal accuracy by grade
-- SELECT * FROM cds_signal_accuracy;

-- Recent outcomes
-- SELECT ticker, signal_date, signal_grade, outcome_status, days_to_outcome, max_gain_pct
-- FROM cds_signals
-- WHERE outcome_status != 'pending'
-- ORDER BY outcome_date DESC
-- LIMIT 20;
