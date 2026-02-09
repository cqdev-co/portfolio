-- ============================================================================
-- UNIFIED SIGNALS TABLE
-- ============================================================================
-- Master registry of actionable, ticker-level daily signals across all
-- strategy engines. Each engine writes to BOTH its own detail table and
-- this master table (dual-write pattern).
--
-- Strategies:
--   cds   -> cds_signals (Call Debit Spread)
--   pcs   -> pcs_signals (Put Credit Spread, not yet deployed)
--   penny -> penny_stock_signals (Penny Stock Explosion)
--
-- Unusual Options is intentionally excluded — it produces noisy,
-- contract-level flow observations, not actionable trade signals.
--
-- Tables: signals
-- ============================================================================

-- ============================================================================
-- 1. SIGNALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which engine produced this
  strategy TEXT NOT NULL CHECK (strategy IN ('cds', 'pcs', 'penny')),

  -- Common fields (every signal has these)
  ticker VARCHAR(10) NOT NULL,
  signal_date DATE NOT NULL,
  score_normalized NUMERIC(5, 2) NOT NULL,  -- 0-100 scale for all strategies
  grade VARCHAR(2) NOT NULL,                 -- S/A/B/C/D
  direction TEXT DEFAULT 'bullish'
    CHECK (direction IN ('bullish', 'bearish', 'neutral')),

  -- Market context at signal time
  price NUMERIC(12, 2) NOT NULL,
  regime TEXT,                               -- bull/neutral/bear
  sector TEXT,

  -- Strategy-specific detail reference
  detail_id UUID NOT NULL,                   -- PK from the detail table
  detail_table TEXT NOT NULL,                -- 'cds_signals', 'penny_stock_signals', etc.

  -- Signal summary (human-readable, for dashboards)
  headline TEXT,                              -- e.g. "NVDA: Grade A CDS (score 85)"
  top_signals TEXT[],                         -- Top 3 signal contributors

  -- Flexible metadata (anything strategy-specific worth surfacing)
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One signal per strategy per ticker per day
  CONSTRAINT unique_strategy_ticker_date UNIQUE (strategy, ticker, signal_date)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Daily leaderboard: "top signals today across all strategies"
CREATE INDEX IF NOT EXISTS idx_signals_date_score
  ON signals(signal_date DESC, score_normalized DESC);

-- Per-strategy feed: "all CDS signals today"
CREATE INDEX IF NOT EXISTS idx_signals_strategy_date
  ON signals(strategy, signal_date DESC);

-- Ticker history: "all signals for NVDA across strategies"
CREATE INDEX IF NOT EXISTS idx_signals_ticker_date
  ON signals(ticker, signal_date DESC);

-- Filter by grade: "show me only A-grade signals"
CREATE INDEX IF NOT EXISTS idx_signals_grade
  ON signals(grade);

-- Cross-strategy: "tickers with signals from multiple strategies today"
CREATE INDEX IF NOT EXISTS idx_signals_date_ticker
  ON signals(signal_date, ticker);

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

CREATE TRIGGER update_signals_updated_at
  BEFORE UPDATE ON signals
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Public read access (dashboard queries)
CREATE POLICY "Allow read access to signals" ON signals
  FOR SELECT USING (true);

-- Service role write access (engine dual-writes)
CREATE POLICY "Allow insert/update for service role on signals" ON signals
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE signals IS 'Unified registry of actionable signals across CDS, PCS, and Penny Stock strategies';
COMMENT ON COLUMN signals.strategy IS 'Engine that produced this signal: cds, pcs, or penny';
COMMENT ON COLUMN signals.score_normalized IS 'Score normalized to 0-100 scale (CDS/PCS native, Penny * 100)';
COMMENT ON COLUMN signals.grade IS 'Signal grade: S (>=85), A (>=70/80), B (>=55/70), C (>=40/60), D (<40/60)';
COMMENT ON COLUMN signals.detail_id IS 'Primary key of the row in the strategy-specific detail table';
COMMENT ON COLUMN signals.detail_table IS 'Name of the strategy-specific detail table (cds_signals, penny_stock_signals, etc.)';
COMMENT ON COLUMN signals.metadata IS 'Strategy-specific fields surfaced for dashboard display (JSONB)';
