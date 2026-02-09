-- ============================================================================
-- PENNY STOCK SIGNALS & PERFORMANCE
-- ============================================================================
-- Explosion setup signals for penny stocks with volume-focused analysis,
-- plus real-world performance tracking.
--
-- Tables: penny_stock_signals, penny_signal_performance
-- Views:  actionable_penny_signals, top_penny_opportunities,
--         penny_performance_summary, penny_performance_by_rank
-- ============================================================================

-- ============================================================================
-- 1. PENNY STOCK SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS penny_stock_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL,
  scan_date DATE NOT NULL,

  -- Price data
  close_price DECIMAL(10, 4) NOT NULL,

  -- Overall assessment
  overall_score DECIMAL(5, 4) NOT NULL,
  opportunity_rank VARCHAR(1) NOT NULL,
  recommendation VARCHAR(20) NOT NULL,

  -- Component scores
  volume_score DECIMAL(5, 4) NOT NULL,
  momentum_score DECIMAL(5, 4) NOT NULL,
  relative_strength_score DECIMAL(5, 4) NOT NULL,
  risk_score DECIMAL(5, 4) NOT NULL,

  -- Volume metrics (50% weight)
  volume BIGINT NOT NULL,
  avg_volume_20d DECIMAL(15, 2),
  volume_ratio DECIMAL(12, 2),
  volume_spike_factor DECIMAL(12, 2),
  volume_acceleration_2d DECIMAL(12, 2),
  volume_acceleration_5d DECIMAL(12, 2),
  volume_consistency_score DECIMAL(5, 4),
  dollar_volume DECIMAL(15, 2),

  -- Price momentum & consolidation (30% weight)
  is_consolidating BOOLEAN,
  consolidation_days INT,
  consolidation_range_pct DECIMAL(12, 2),
  is_breakout BOOLEAN,
  price_change_5d DECIMAL(12, 2),
  price_change_10d DECIMAL(12, 2),
  price_change_20d DECIMAL(12, 2),
  higher_lows_detected BOOLEAN,
  consecutive_green_days INT,

  -- Moving averages
  ema_20 DECIMAL(10, 4),
  ema_50 DECIMAL(10, 4),
  price_vs_ema20 DECIMAL(12, 2),
  price_vs_ema50 DECIMAL(12, 2),
  ema_crossover_signal BOOLEAN,

  -- Relative strength (15% weight)
  market_outperformance DECIMAL(12, 2),
  sector_outperformance DECIMAL(12, 2),
  distance_from_52w_low DECIMAL(12, 2),
  distance_from_52w_high DECIMAL(12, 2),
  breaking_resistance BOOLEAN,

  -- Risk & liquidity (5% weight)
  bid_ask_spread_pct DECIMAL(6, 2),
  avg_spread_5d DECIMAL(6, 2),
  float_shares BIGINT,
  is_low_float BOOLEAN,
  daily_volatility DECIMAL(12, 2),
  atr_20 DECIMAL(10, 4),
  pump_dump_risk VARCHAR(10),

  -- Country risk
  country VARCHAR(50),
  is_high_risk_country BOOLEAN DEFAULT FALSE,
  pump_dump_warning BOOLEAN DEFAULT FALSE,

  -- Trend context
  trend_direction VARCHAR(10),

  -- Signal metadata
  signal_status VARCHAR(15) DEFAULT 'NEW',
  days_active INT DEFAULT 0,

  -- Risk management
  stop_loss_level DECIMAL(10, 4),
  position_size_pct DECIMAL(5, 2),

  -- Data quality
  data_quality_score DECIMAL(5, 4),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_signal_per_day UNIQUE (symbol, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_penny_signals_symbol ON penny_stock_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_penny_signals_scan_date ON penny_stock_signals(scan_date);
CREATE INDEX IF NOT EXISTS idx_penny_signals_overall_score ON penny_stock_signals(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_penny_signals_opportunity_rank ON penny_stock_signals(opportunity_rank);
CREATE INDEX IF NOT EXISTS idx_penny_signals_recommendation ON penny_stock_signals(recommendation);
CREATE INDEX IF NOT EXISTS idx_penny_signals_volume_score ON penny_stock_signals(volume_score DESC);
CREATE INDEX IF NOT EXISTS idx_penny_signals_is_breakout ON penny_stock_signals(is_breakout) WHERE is_breakout = TRUE;
CREATE INDEX IF NOT EXISTS idx_penny_signals_symbol_date ON penny_stock_signals(symbol, scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_penny_signals_score_date ON penny_stock_signals(overall_score DESC, scan_date DESC);

CREATE TRIGGER update_penny_signals_updated_at
  BEFORE UPDATE ON penny_stock_signals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE penny_stock_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to penny_stock_signals" ON penny_stock_signals
  FOR SELECT USING (true);
CREATE POLICY "Allow insert/update for service role" ON penny_stock_signals
  FOR ALL USING (auth.role() = 'service_role');

-- Table comments
COMMENT ON TABLE penny_stock_signals IS 'Penny stock explosion setup signals with volume-focused analysis';
COMMENT ON COLUMN penny_stock_signals.overall_score IS 'Combined score (0-1): Volume 50%, Momentum 30%, Strength 15%, Risk 5%';
COMMENT ON COLUMN penny_stock_signals.opportunity_rank IS 'S/A/B/C/D tier ranking';

-- ============================================================================
-- 2. PENNY SIGNAL PERFORMANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS penny_signal_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  signal_id UUID REFERENCES penny_stock_signals(id),
  symbol VARCHAR(10) NOT NULL,

  -- Entry information
  entry_date DATE NOT NULL,
  entry_price DECIMAL(10, 4) NOT NULL,
  entry_score DECIMAL(5, 4),
  opportunity_rank VARCHAR(1),

  -- Stop loss and targets
  stop_loss_price DECIMAL(10, 4),
  profit_target_price DECIMAL(10, 4),
  target_1_price DECIMAL(10, 4),
  target_2_price DECIMAL(10, 4),
  target_3_price DECIMAL(10, 4),

  -- Exit information
  exit_date DATE,
  exit_price DECIMAL(10, 4),
  exit_reason VARCHAR(20),

  -- Performance metrics
  return_pct DECIMAL(10, 4),
  return_absolute DECIMAL(15, 4),
  days_held INT,
  is_winner BOOLEAN,

  -- Maximum reached during trade
  max_price_reached DECIMAL(10, 4),
  max_gain_pct DECIMAL(10, 4),

  -- Profit target tracking
  hit_target_10pct BOOLEAN DEFAULT FALSE,
  hit_target_20pct BOOLEAN DEFAULT FALSE,
  hit_target_30pct BOOLEAN DEFAULT FALSE,
  targets_hit_count INT DEFAULT 0,
  first_target_hit_date DATE,

  -- Additional signal context
  volume_spike_factor DECIMAL(10, 2),
  is_breakout BOOLEAN,

  -- Status
  status VARCHAR(10) DEFAULT 'ACTIVE',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penny_perf_symbol ON penny_signal_performance(symbol);
CREATE INDEX IF NOT EXISTS idx_penny_perf_entry_date ON penny_signal_performance(entry_date);
CREATE INDEX IF NOT EXISTS idx_penny_perf_status ON penny_signal_performance(status);
CREATE INDEX IF NOT EXISTS idx_penny_perf_rank ON penny_signal_performance(opportunity_rank);
CREATE INDEX IF NOT EXISTS idx_penny_perf_winner ON penny_signal_performance(is_winner) WHERE status = 'CLOSED';
CREATE INDEX IF NOT EXISTS idx_penny_perf_return ON penny_signal_performance(return_pct DESC) WHERE status = 'CLOSED';
CREATE INDEX IF NOT EXISTS idx_penny_perf_symbol_status ON penny_signal_performance(symbol, status);
CREATE INDEX IF NOT EXISTS idx_penny_perf_date_status ON penny_signal_performance(entry_date DESC, status);

CREATE TRIGGER update_penny_perf_updated_at
  BEFORE UPDATE ON penny_signal_performance
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE penny_signal_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to penny_signal_performance" ON penny_signal_performance
  FOR SELECT USING (true);
CREATE POLICY "Allow insert/update for service role on penny_signal_performance" ON penny_signal_performance
  FOR ALL USING (auth.role() = 'service_role');

-- Table comments
COMMENT ON TABLE penny_signal_performance IS 'Tracks real-world performance of penny stock signals';
COMMENT ON COLUMN penny_signal_performance.exit_reason IS 'STOP_LOSS, SIGNAL_ENDED, TARGET_HIT, or MANUAL';

-- ============================================================================
-- 3. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW actionable_penny_signals AS
SELECT
  *,
  (overall_score >= 0.60
    AND dollar_volume >= 100000
    AND volume_ratio >= 1.5
    AND data_quality_score >= 0.7) AS is_actionable
FROM penny_stock_signals
WHERE scan_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY overall_score DESC, volume_score DESC;

CREATE OR REPLACE VIEW top_penny_opportunities AS
SELECT
  symbol, scan_date, close_price, overall_score, opportunity_rank,
  recommendation, volume_ratio, volume_spike_factor, is_breakout,
  is_consolidating, trend_direction, stop_loss_level, position_size_pct
FROM penny_stock_signals
WHERE overall_score >= 0.70
  AND scan_date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY overall_score DESC
LIMIT 50;

CREATE OR REPLACE VIEW penny_performance_summary AS
SELECT
  COUNT(*) AS total_signals,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_signals,
  COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_signals,
  COUNT(*) FILTER (WHERE is_winner = TRUE AND status = 'CLOSED') AS winning_trades,
  COUNT(*) FILTER (WHERE is_winner = FALSE AND status = 'CLOSED') AS losing_trades,
  ROUND(
    COUNT(*) FILTER (WHERE is_winner = TRUE AND status = 'CLOSED')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100, 2
  ) AS win_rate_pct,
  ROUND(AVG(return_pct) FILTER (WHERE status = 'CLOSED'), 2) AS avg_return_pct,
  ROUND(AVG(return_pct) FILTER (WHERE is_winner = TRUE AND status = 'CLOSED'), 2) AS avg_winner_pct,
  ROUND(AVG(return_pct) FILTER (WHERE is_winner = FALSE AND status = 'CLOSED'), 2) AS avg_loser_pct,
  ROUND(AVG(days_held) FILTER (WHERE status = 'CLOSED'), 1) AS avg_days_held,
  ROUND(AVG(max_gain_pct) FILTER (WHERE status = 'CLOSED'), 2) AS avg_max_gain_pct,
  COUNT(*) FILTER (WHERE hit_target_10pct = TRUE AND status = 'CLOSED') AS hit_10pct_count,
  COUNT(*) FILTER (WHERE hit_target_20pct = TRUE AND status = 'CLOSED') AS hit_20pct_count,
  COUNT(*) FILTER (WHERE hit_target_30pct = TRUE AND status = 'CLOSED') AS hit_30pct_count,
  COUNT(*) FILTER (WHERE exit_reason = 'STOP_LOSS' AND status = 'CLOSED') AS stop_loss_exits
FROM penny_signal_performance;

CREATE OR REPLACE VIEW penny_performance_by_rank AS
SELECT
  opportunity_rank,
  COUNT(*) AS trade_count,
  COUNT(*) FILTER (WHERE is_winner = TRUE) AS wins,
  COUNT(*) FILTER (WHERE is_winner = FALSE) AS losses,
  ROUND(
    COUNT(*) FILTER (WHERE is_winner = TRUE)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  ) AS win_rate_pct,
  ROUND(AVG(return_pct), 2) AS avg_return_pct,
  ROUND(AVG(max_gain_pct), 2) AS avg_max_gain_pct,
  ROUND(AVG(days_held), 1) AS avg_days_held
FROM penny_signal_performance
WHERE status = 'CLOSED'
GROUP BY opportunity_rank
ORDER BY opportunity_rank;
