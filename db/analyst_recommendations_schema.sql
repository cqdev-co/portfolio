-- ============================================================================
-- AI ANALYST - RECOMMENDATION TRACKING SCHEMA
-- ============================================================================
-- 
-- Tracks Victor's recommendations and their outcomes for accountability.
-- Enables confidence calibration based on historical accuracy.
--
-- Run this in Supabase SQL Editor after analyst_schema.sql
-- ============================================================================

-- ============================================================================
-- RECOMMENDATIONS TABLE
-- ============================================================================
-- Every recommendation Victor makes, tracked for accuracy.

CREATE TABLE IF NOT EXISTS analyst_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was recommended
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'BUY', 'WAIT', 'AVOID', 'SELL', 'HOLD'
  )),
  
  -- Victor's confidence at time of recommendation
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  confidence_factors TEXT[] DEFAULT '{}',
  
  -- Context at recommendation time
  price_at_recommendation DECIMAL(12, 2) NOT NULL,
  target_price DECIMAL(12, 2),
  stop_price DECIMAL(12, 2),
  target_timeframe_days INTEGER DEFAULT 45,  -- Default to spread expiration
  
  -- The thesis - why this recommendation
  thesis TEXT NOT NULL,
  key_factors JSONB DEFAULT '{}',  -- RSI, IV, earnings, etc.
  
  -- Spread details if applicable
  spread_long_strike DECIMAL(12, 2),
  spread_short_strike DECIMAL(12, 2),
  spread_debit DECIMAL(10, 4),
  spread_expiration DATE,
  
  -- Market context
  market_regime TEXT CHECK (market_regime IN ('bull', 'neutral', 'bear')),
  vix_at_recommendation DECIMAL(6, 2),
  spy_at_recommendation DECIMAL(12, 2),
  
  -- Outcome tracking
  status TEXT DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',      -- Still within timeframe
    'VALIDATED',    -- Target hit or thesis confirmed
    'INVALIDATED',  -- Stop hit or thesis wrong
    'EXPIRED',      -- Timeframe passed, neutral outcome
    'SUPERSEDED'    -- New recommendation replaced this one
  )),
  
  outcome_price DECIMAL(12, 2),
  outcome_return_pct DECIMAL(8, 2),
  outcome_notes TEXT,
  outcome_date DATE,
  
  -- Was Victor right?
  was_correct BOOLEAN,
  
  -- Metadata
  conversation_id TEXT,  -- Link to chat session if any
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recommendations_ticker 
  ON analyst_recommendations(ticker);
CREATE INDEX IF NOT EXISTS idx_recommendations_action 
  ON analyst_recommendations(action);
CREATE INDEX IF NOT EXISTS idx_recommendations_confidence 
  ON analyst_recommendations(confidence);
CREATE INDEX IF NOT EXISTS idx_recommendations_status 
  ON analyst_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_created 
  ON analyst_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_was_correct 
  ON analyst_recommendations(was_correct) WHERE was_correct IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recommendations_updated_at
  BEFORE UPDATE ON analyst_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_recommendations_updated_at();

-- ============================================================================
-- CONFIDENCE CALIBRATION TABLE
-- ============================================================================
-- Aggregated stats on Victor's accuracy by confidence level.
-- Updated periodically by a function.

CREATE TABLE IF NOT EXISTS analyst_confidence_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Confidence level being tracked
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  action TEXT NOT NULL CHECK (action IN (
    'BUY', 'WAIT', 'AVOID', 'SELL', 'HOLD', 'ALL'
  )),
  
  -- Stats
  total_recommendations INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  
  -- Calculated accuracy
  accuracy_pct DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE WHEN (correct_count + incorrect_count) > 0 
      THEN ROUND(100.0 * correct_count / (correct_count + incorrect_count), 2)
      ELSE NULL 
    END
  ) STORED,
  
  -- Time period
  period_start DATE,
  period_end DATE,
  
  -- Metadata
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(confidence, action, period_start, period_end)
);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Victor's hit rate by confidence level
CREATE OR REPLACE VIEW analyst_confidence_stats AS
SELECT 
  confidence,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE was_correct = true) AS correct,
  COUNT(*) FILTER (WHERE was_correct = false) AS incorrect,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE was_correct = true) / 
    NULLIF(COUNT(*) FILTER (WHERE was_correct IS NOT NULL), 0), 
    1
  ) AS accuracy_pct
FROM analyst_recommendations
GROUP BY confidence
ORDER BY 
  CASE confidence 
    WHEN 'HIGH' THEN 1 
    WHEN 'MEDIUM' THEN 2 
    WHEN 'LOW' THEN 3 
  END;

-- Victor's hit rate by action type
CREATE OR REPLACE VIEW analyst_action_stats AS
SELECT 
  action,
  confidence,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE was_correct = true) AS correct,
  COUNT(*) FILTER (WHERE was_correct = false) AS incorrect,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE was_correct = true) / 
    NULLIF(COUNT(*) FILTER (WHERE was_correct IS NOT NULL), 0), 
    1
  ) AS accuracy_pct,
  ROUND(AVG(outcome_return_pct) FILTER (WHERE was_correct = true), 2) AS avg_win_pct,
  ROUND(AVG(outcome_return_pct) FILTER (WHERE was_correct = false), 2) AS avg_loss_pct
FROM analyst_recommendations
WHERE status != 'PENDING'
GROUP BY action, confidence
ORDER BY action, confidence;

-- Recent recommendations with outcomes
CREATE OR REPLACE VIEW analyst_recent_recommendations AS
SELECT 
  id,
  ticker,
  action,
  confidence,
  price_at_recommendation,
  target_price,
  thesis,
  status,
  was_correct,
  outcome_return_pct,
  created_at
FROM analyst_recommendations
ORDER BY created_at DESC
LIMIT 50;

-- Ticker-specific recommendation history
CREATE OR REPLACE VIEW analyst_ticker_recommendations AS
SELECT 
  ticker,
  COUNT(*) AS total_recommendations,
  COUNT(*) FILTER (WHERE action = 'BUY') AS buy_calls,
  COUNT(*) FILTER (WHERE action IN ('WAIT', 'AVOID')) AS pass_calls,
  COUNT(*) FILTER (WHERE was_correct = true) AS correct,
  COUNT(*) FILTER (WHERE was_correct = false) AS incorrect,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE was_correct = true) / 
    NULLIF(COUNT(*) FILTER (WHERE was_correct IS NOT NULL), 0), 
    1
  ) AS accuracy_pct,
  MAX(created_at) AS last_recommendation
FROM analyst_recommendations
GROUP BY ticker
ORDER BY total_recommendations DESC;

-- ============================================================================
-- FUNCTION: Update recommendation outcome
-- ============================================================================
-- Call this to mark a recommendation as validated/invalidated

CREATE OR REPLACE FUNCTION update_recommendation_outcome(
  p_recommendation_id UUID,
  p_current_price DECIMAL(12, 2),
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_rec RECORD;
  v_return_pct DECIMAL(8, 2);
  v_was_correct BOOLEAN;
  v_status TEXT;
BEGIN
  -- Get the recommendation
  SELECT * INTO v_rec 
  FROM analyst_recommendations 
  WHERE id = p_recommendation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recommendation not found: %', p_recommendation_id;
  END IF;
  
  -- Calculate return
  v_return_pct := ROUND(
    100.0 * (p_current_price - v_rec.price_at_recommendation) / 
    v_rec.price_at_recommendation, 
    2
  );
  
  -- Determine if Victor was correct based on action
  CASE v_rec.action
    WHEN 'BUY' THEN
      -- BUY is correct if price went up meaningfully (>2%)
      v_was_correct := v_return_pct > 2;
      v_status := CASE WHEN v_was_correct THEN 'VALIDATED' ELSE 'INVALIDATED' END;
      
    WHEN 'WAIT' THEN
      -- WAIT is correct if price went down or we avoided a drawdown
      v_was_correct := v_return_pct < 0;
      v_status := CASE WHEN v_was_correct THEN 'VALIDATED' ELSE 'INVALIDATED' END;
      
    WHEN 'AVOID' THEN
      -- AVOID is correct if price went down significantly (>5%)
      v_was_correct := v_return_pct < -5;
      v_status := CASE WHEN v_was_correct THEN 'VALIDATED' ELSE 'INVALIDATED' END;
      
    WHEN 'SELL' THEN
      -- SELL is correct if price went down
      v_was_correct := v_return_pct < 0;
      v_status := CASE WHEN v_was_correct THEN 'VALIDATED' ELSE 'INVALIDATED' END;
      
    WHEN 'HOLD' THEN
      -- HOLD is correct if price stayed within reasonable range (-5% to +10%)
      v_was_correct := v_return_pct BETWEEN -5 AND 10;
      v_status := CASE WHEN v_was_correct THEN 'VALIDATED' ELSE 'INVALIDATED' END;
      
    ELSE
      v_was_correct := NULL;
      v_status := 'EXPIRED';
  END CASE;
  
  -- Update the recommendation
  UPDATE analyst_recommendations
  SET 
    outcome_price = p_current_price,
    outcome_return_pct = v_return_pct,
    outcome_notes = p_notes,
    outcome_date = CURRENT_DATE,
    was_correct = v_was_correct,
    status = v_status,
    updated_at = NOW()
  WHERE id = p_recommendation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Victor's calibrated confidence
-- ============================================================================
-- Returns expected accuracy for a given confidence level

CREATE OR REPLACE FUNCTION get_calibrated_accuracy(p_confidence TEXT)
RETURNS TABLE(
  confidence TEXT,
  sample_size INTEGER,
  accuracy_pct DECIMAL(5, 2),
  is_reliable BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.confidence,
    COUNT(*)::INTEGER AS sample_size,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE r.was_correct = true) / 
      NULLIF(COUNT(*) FILTER (WHERE r.was_correct IS NOT NULL), 0), 
      2
    ) AS accuracy_pct,
    COUNT(*) FILTER (WHERE r.was_correct IS NOT NULL) >= 10 AS is_reliable
  FROM analyst_recommendations r
  WHERE r.confidence = p_confidence
  GROUP BY r.confidence;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE analyst_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_confidence_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON analyst_recommendations
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON analyst_confidence_calibration
  FOR ALL USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON analyst_recommendations TO service_role;
GRANT ALL ON analyst_confidence_calibration TO service_role;
GRANT ALL ON analyst_confidence_stats TO service_role;
GRANT ALL ON analyst_action_stats TO service_role;
GRANT ALL ON analyst_recent_recommendations TO service_role;
GRANT ALL ON analyst_ticker_recommendations TO service_role;
