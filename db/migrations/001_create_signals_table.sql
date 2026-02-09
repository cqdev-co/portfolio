-- ============================================================================
-- Migration: Create unified signals table + backfill from existing data
-- ============================================================================
-- Run against production via: supabase db execute --linked < db/migrations/001_create_signals_table.sql
-- Or paste into the Supabase SQL editor.
--
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT.
-- ============================================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT NOT NULL CHECK (strategy IN ('cds', 'pcs', 'penny')),
  ticker VARCHAR(10) NOT NULL,
  signal_date DATE NOT NULL,
  score_normalized NUMERIC(5, 2) NOT NULL,
  grade VARCHAR(2) NOT NULL,
  direction TEXT DEFAULT 'bullish' CHECK (direction IN ('bullish', 'bearish', 'neutral')),
  price NUMERIC(12, 2) NOT NULL,
  regime TEXT,
  sector TEXT,
  detail_id UUID NOT NULL,
  detail_table TEXT NOT NULL,
  headline TEXT,
  top_signals TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_strategy_ticker_date UNIQUE (strategy, ticker, signal_date)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_signals_date_score ON signals(signal_date DESC, score_normalized DESC);
CREATE INDEX IF NOT EXISTS idx_signals_strategy_date ON signals(strategy, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_ticker_date ON signals(ticker, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signals_grade ON signals(grade);
CREATE INDEX IF NOT EXISTS idx_signals_date_ticker ON signals(signal_date, ticker);

-- 3. Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_signals_updated_at'
  ) THEN
    CREATE TRIGGER update_signals_updated_at
      BEFORE UPDATE ON signals
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- 4. RLS
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'Allow read access to signals'
  ) THEN
    CREATE POLICY "Allow read access to signals" ON signals FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'signals' AND policyname = 'Allow insert/update for service role on signals'
  ) THEN
    CREATE POLICY "Allow insert/update for service role on signals" ON signals FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 5. Backfill from cds_signals (~116 rows)
INSERT INTO signals (
  strategy, ticker, signal_date, score_normalized, grade, direction,
  price, regime, sector, detail_id, detail_table,
  headline, top_signals, metadata, created_at
)
SELECT
  'cds',
  ticker,
  signal_date,
  signal_score,
  signal_grade,
  'bullish',
  price_at_signal,
  regime,
  sector,
  id,
  'cds_signals',
  ticker || ': Grade ' || signal_grade || ' CDS (score ' || signal_score || ')',
  CASE
    WHEN top_signals IS NOT NULL THEN string_to_array(top_signals, ', ')
    ELSE '{}'::TEXT[]
  END,
  jsonb_build_object(
    'spread_viable', spread_viable,
    'spread_strikes', spread_strikes,
    'spread_return', spread_return,
    'upside_potential', upside_potential
  ),
  first_seen_at
FROM cds_signals
ON CONFLICT (strategy, ticker, signal_date) DO NOTHING;

-- 6. Backfill from penny_stock_signals (last 30 days, score >= 0.40)
INSERT INTO signals (
  strategy, ticker, signal_date, score_normalized, grade, direction,
  price, regime, sector, detail_id, detail_table,
  headline, top_signals, metadata, created_at
)
SELECT
  'penny',
  symbol,
  scan_date,
  ROUND(overall_score * 100, 2),
  CASE
    WHEN overall_score >= 0.85 THEN 'S'
    WHEN overall_score >= 0.70 THEN 'A'
    WHEN overall_score >= 0.55 THEN 'B'
    WHEN overall_score >= 0.40 THEN 'C'
    ELSE 'D'
  END,
  'bullish',
  close_price,
  NULL,
  NULL,
  id,
  'penny_stock_signals',
  symbol || ': Rank ' || opportunity_rank || ' Penny Signal (score ' || ROUND(overall_score * 100, 2) || ')',
  '{}'::TEXT[],
  jsonb_build_object(
    'is_breakout', is_breakout,
    'volume_ratio', volume_ratio,
    'volume_spike_factor', volume_spike_factor,
    'is_consolidating', is_consolidating,
    'recommendation', recommendation
  ),
  created_at
FROM penny_stock_signals
WHERE scan_date >= CURRENT_DATE - INTERVAL '30 days'
  AND overall_score >= 0.40
ON CONFLICT (strategy, ticker, signal_date) DO NOTHING;

-- 7. Comments
COMMENT ON TABLE signals IS 'Unified registry of actionable signals across CDS, PCS, and Penny Stock strategies';
