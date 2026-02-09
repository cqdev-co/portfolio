-- ============================================================================
-- UNUSUAL OPTIONS ACTIVITY SCANNER
-- ============================================================================
-- Signal detection and continuity tracking for unusual options.
-- Includes spread detection fields and expiry-based lifecycle management.
--
-- Tables: unusual_options_signals (~1,367 rows in prod)
--         unusual_options_signal_continuity (~12,008 rows in prod)
-- Funcs:  find_existing_signal(), update_signal_continuity(),
--         mark_stale_signals_inactive()
-- ============================================================================

-- ============================================================================
-- 1. MAIN SIGNALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS unusual_options_signals (
  signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  option_symbol TEXT NOT NULL,
  detection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Option details
  strike NUMERIC(10, 2) NOT NULL,
  expiry DATE NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
  days_to_expiry INTEGER NOT NULL,
  moneyness TEXT CHECK (moneyness IN ('ITM', 'ATM', 'OTM')),

  -- Volume metrics
  current_volume INTEGER NOT NULL DEFAULT 0,
  average_volume NUMERIC(10, 2) NOT NULL DEFAULT 0,
  volume_ratio NUMERIC(6, 2),

  -- Open interest metrics
  current_oi INTEGER NOT NULL DEFAULT 0,
  previous_oi INTEGER NOT NULL DEFAULT 0,
  oi_change_pct NUMERIC(6, 4),

  -- Premium metrics
  premium_flow NUMERIC(12, 2) NOT NULL DEFAULT 0,
  aggressive_order_pct NUMERIC(4, 2),

  -- Detection flags
  has_volume_anomaly BOOLEAN DEFAULT FALSE,
  has_oi_spike BOOLEAN DEFAULT FALSE,
  has_premium_flow BOOLEAN DEFAULT FALSE,
  has_sweep BOOLEAN DEFAULT FALSE,
  has_block_trade BOOLEAN DEFAULT FALSE,

  -- Scoring
  overall_score NUMERIC(4, 3) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 1),
  grade TEXT NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'F')),
  confidence NUMERIC(4, 3) CHECK (confidence >= 0 AND confidence <= 1),

  -- Risk assessment
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')),
  risk_factors JSONB DEFAULT '[]'::JSONB,

  -- Market context
  underlying_price NUMERIC(10, 2) NOT NULL,
  implied_volatility NUMERIC(6, 4),
  iv_rank NUMERIC(4, 2),
  market_cap BIGINT,
  avg_daily_volume BIGINT,

  -- Directional bias
  sentiment TEXT CHECK (sentiment IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  put_call_ratio NUMERIC(6, 4),

  -- Additional context
  days_to_earnings INTEGER,
  has_upcoming_catalyst BOOLEAN DEFAULT FALSE,
  catalyst_description TEXT,

  -- Metadata
  data_provider TEXT,
  detection_version TEXT,
  raw_detection_data JSONB,

  -- Signal continuity (deduplication and tracking)
  is_new_signal BOOLEAN DEFAULT TRUE,
  signal_group_id UUID,
  first_detected_at TIMESTAMPTZ,
  last_detected_at TIMESTAMPTZ,
  detection_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  -- Signal classification (for win/loss tracking)
  classification TEXT,
  classification_date DATE,
  classification_win BOOLEAN,

  -- Spread detection (high-confidence only, >= 80%)
  is_likely_spread BOOLEAN DEFAULT FALSE,
  spread_confidence NUMERIC(4, 3) CHECK (spread_confidence >= 0 AND spread_confidence <= 1),
  spread_type TEXT CHECK (spread_type IN (
    'VERTICAL_CALL_SPREAD', 'VERTICAL_PUT_SPREAD', 'CALENDAR_SPREAD',
    'IRON_CONDOR', 'STRADDLE', 'STRANGLE', 'POSSIBLE_SPREAD'
  )),
  matched_leg_symbols TEXT[],
  spread_strike_width NUMERIC(10, 2),
  spread_detection_reason TEXT,
  spread_net_premium NUMERIC(12, 2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary indexes
CREATE INDEX IF NOT EXISTS idx_uo_signals_ticker ON unusual_options_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_uo_signals_detection_ts ON unusual_options_signals(detection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_uo_signals_grade ON unusual_options_signals(grade);
CREATE INDEX IF NOT EXISTS idx_uo_signals_ticker_grade ON unusual_options_signals(ticker, grade);
CREATE INDEX IF NOT EXISTS idx_uo_signals_expiry ON unusual_options_signals(expiry);
CREATE INDEX IF NOT EXISTS idx_uo_signals_score ON unusual_options_signals(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_uo_signals_recent_high_grade
  ON unusual_options_signals(detection_timestamp DESC, grade) WHERE grade IN ('S', 'A', 'B');

-- Continuity tracking indexes
CREATE INDEX IF NOT EXISTS idx_uo_signals_option_symbol ON unusual_options_signals(option_symbol);
CREATE INDEX IF NOT EXISTS idx_uo_signals_group_id ON unusual_options_signals(signal_group_id);
CREATE INDEX IF NOT EXISTS idx_uo_signals_is_active ON unusual_options_signals(is_active);
CREATE INDEX IF NOT EXISTS idx_uo_signals_ticker_option_active ON unusual_options_signals(ticker, option_symbol, is_active);
CREATE INDEX IF NOT EXISTS idx_uo_signals_last_detected ON unusual_options_signals(last_detected_at DESC);

-- Classification indexes
CREATE INDEX IF NOT EXISTS idx_classification_date ON unusual_options_signals(classification_date);
CREATE INDEX IF NOT EXISTS idx_signal_classification ON unusual_options_signals(classification);
CREATE INDEX IF NOT EXISTS idx_signals_classification_win ON unusual_options_signals(classification_win);
CREATE INDEX IF NOT EXISTS idx_signals_type_classification_win ON unusual_options_signals(option_type, classification, classification_win);
CREATE INDEX IF NOT EXISTS idx_signals_win ON unusual_options_signals(classification_win) WHERE classification_win IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_high_conviction_signals ON unusual_options_signals(overall_score DESC) WHERE confidence >= 0.8;

-- Spread detection indexes
CREATE INDEX IF NOT EXISTS idx_uo_signals_is_spread ON unusual_options_signals(is_likely_spread);
CREATE INDEX IF NOT EXISTS idx_uo_signals_spread_confidence
  ON unusual_options_signals(spread_confidence DESC) WHERE spread_confidence IS NOT NULL;

CREATE TRIGGER update_uo_signals_updated_at
  BEFORE UPDATE ON unusual_options_signals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Column comments
COMMENT ON COLUMN unusual_options_signals.is_likely_spread IS
  'TRUE if signal is part of a detected spread pattern (>= 80% confidence)';
COMMENT ON COLUMN unusual_options_signals.spread_confidence IS
  'Confidence score for spread detection (0.0-1.0). Only set when >= 60%';

-- RLS
ALTER TABLE unusual_options_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to uo_signals"
  ON unusual_options_signals FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on uo_signals"
  ON unusual_options_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on uo_signals"
  ON unusual_options_signals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on uo_signals"
  ON unusual_options_signals FOR DELETE USING (true);

-- ============================================================================
-- 2. SIGNAL CONTINUITY HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS unusual_options_signal_continuity (
  continuity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES unusual_options_signals(signal_id) ON DELETE CASCADE,
  signal_group_id UUID NOT NULL,

  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_run_id UUID,

  -- Metrics at detection time
  current_volume INTEGER NOT NULL,
  current_oi INTEGER NOT NULL,
  premium_flow NUMERIC(12, 2),
  underlying_price NUMERIC(10, 2) NOT NULL,
  overall_score NUMERIC(4, 3) NOT NULL,
  grade TEXT NOT NULL,

  -- Changes since last detection
  volume_delta INTEGER,
  oi_delta INTEGER,
  premium_flow_delta NUMERIC(12, 2),
  score_delta NUMERIC(4, 3),
  grade_change TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uo_continuity_signal_id ON unusual_options_signal_continuity(signal_id);
CREATE INDEX IF NOT EXISTS idx_uo_continuity_group_id ON unusual_options_signal_continuity(signal_group_id);
CREATE INDEX IF NOT EXISTS idx_uo_continuity_detected_at ON unusual_options_signal_continuity(detected_at DESC);

-- RLS
ALTER TABLE unusual_options_signal_continuity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to uo_continuity"
  ON unusual_options_signal_continuity FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert on uo_continuity"
  ON unusual_options_signal_continuity FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on uo_continuity"
  ON unusual_options_signal_continuity FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on uo_continuity"
  ON unusual_options_signal_continuity FOR DELETE USING (true);

-- ============================================================================
-- 3. FUNCTIONS
-- ============================================================================

-- Find existing signal for deduplication
CREATE OR REPLACE FUNCTION find_existing_signal(
  p_ticker TEXT,
  p_option_symbol TEXT,
  p_strike NUMERIC,
  p_expiry DATE,
  p_option_type TEXT
) RETURNS UUID AS $$
DECLARE
  v_signal_id UUID;
BEGIN
  SELECT signal_id INTO v_signal_id
  FROM unusual_options_signals
  WHERE ticker = p_ticker
    AND option_symbol = p_option_symbol
    AND strike = p_strike
    AND expiry = p_expiry
    AND option_type = p_option_type
    AND is_active = TRUE
    AND last_detected_at > NOW() - INTERVAL '24 hours'
  ORDER BY last_detected_at DESC
  LIMIT 1;

  RETURN v_signal_id;
END;
$$ LANGUAGE plpgsql;

-- Update signal continuity when re-detected
CREATE OR REPLACE FUNCTION update_signal_continuity(
  p_signal_id UUID,
  p_new_volume INTEGER,
  p_new_oi INTEGER,
  p_new_premium_flow NUMERIC,
  p_new_price NUMERIC,
  p_new_score NUMERIC,
  p_new_grade TEXT
) RETURNS VOID AS $$
DECLARE
  v_old_volume INTEGER;
  v_old_oi INTEGER;
  v_old_premium_flow NUMERIC;
  v_old_score NUMERIC;
  v_old_grade TEXT;
  v_group_id UUID;
  v_grade_change TEXT;
BEGIN
  SELECT current_volume, current_oi, premium_flow, overall_score,
         grade, signal_group_id
  INTO v_old_volume, v_old_oi, v_old_premium_flow, v_old_score,
       v_old_grade, v_group_id
  FROM unusual_options_signals
  WHERE signal_id = p_signal_id;

  IF p_new_grade > v_old_grade THEN
    v_grade_change := 'UPGRADED';
  ELSIF p_new_grade < v_old_grade THEN
    v_grade_change := 'DOWNGRADED';
  ELSE
    v_grade_change := 'UNCHANGED';
  END IF;

  INSERT INTO unusual_options_signal_continuity (
    signal_id, signal_group_id, detected_at,
    current_volume, current_oi, premium_flow,
    underlying_price, overall_score, grade,
    volume_delta, oi_delta, premium_flow_delta,
    score_delta, grade_change
  ) VALUES (
    p_signal_id, v_group_id, NOW(),
    p_new_volume, p_new_oi, p_new_premium_flow,
    p_new_price, p_new_score, p_new_grade,
    p_new_volume - v_old_volume,
    p_new_oi - v_old_oi,
    p_new_premium_flow - COALESCE(v_old_premium_flow, 0),
    p_new_score - v_old_score,
    v_grade_change
  );

  UPDATE unusual_options_signals
  SET
    current_volume = p_new_volume,
    current_oi = p_new_oi,
    premium_flow = p_new_premium_flow,
    underlying_price = p_new_price,
    overall_score = p_new_score,
    grade = p_new_grade,
    last_detected_at = NOW(),
    detection_count = detection_count + 1,
    is_new_signal = FALSE,
    updated_at = NOW()
  WHERE signal_id = p_signal_id;
END;
$$ LANGUAGE plpgsql;

-- Mark signals as inactive when option contracts expire
CREATE OR REPLACE FUNCTION mark_stale_signals_inactive(
  p_hours_threshold INTEGER DEFAULT 3  -- Kept for backwards compat, unused
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE unusual_options_signals
  SET is_active = FALSE, updated_at = NOW()
  WHERE is_active = TRUE
    AND expiry < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

