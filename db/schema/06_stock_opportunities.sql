-- ============================================================================
-- STOCK OPPORTUNITIES (CDS Scanner Results)
-- ============================================================================
-- Daily scan results with technical, fundamental, and analyst scores.
--
-- Tables: stock_opportunities
-- Funcs: get_top_opportunities(), get_improving_stocks()
-- ============================================================================

-- ============================================================================
-- 1. STOCK OPPORTUNITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  price DECIMAL(10, 2),
  technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 50),
  fundamental_score INTEGER CHECK (fundamental_score >= 0 AND fundamental_score <= 30),
  analyst_score INTEGER CHECK (analyst_score >= 0 AND analyst_score <= 20),
  total_score INTEGER CHECK (total_score >= 0 AND total_score <= 100),
  upside_potential DECIMAL(5, 4),
  signals JSONB NOT NULL DEFAULT '[]',
  scan_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ticker, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_opportunities_ticker ON stock_opportunities(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_opportunities_scan_date ON stock_opportunities(scan_date);
CREATE INDEX IF NOT EXISTS idx_stock_opportunities_total_score ON stock_opportunities(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_stock_opportunities_ticker_date ON stock_opportunities(ticker, scan_date);
CREATE INDEX IF NOT EXISTS idx_stock_opportunities_high_score
  ON stock_opportunities(scan_date, total_score DESC) WHERE total_score >= 70;
CREATE INDEX IF NOT EXISTS idx_stock_opportunities_signals ON stock_opportunities USING GIN (signals);

-- RLS
ALTER TABLE stock_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to stock_opportunities" ON stock_opportunities
  FOR SELECT USING (true);
CREATE POLICY "Allow insert/update for service role" ON stock_opportunities
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_top_opportunities(
  target_date DATE DEFAULT CURRENT_DATE,
  min_score INTEGER DEFAULT 70,
  limit_count INTEGER DEFAULT 20
) RETURNS TABLE (
  ticker VARCHAR(10),
  price DECIMAL(10, 2),
  total_score INTEGER,
  upside_potential DECIMAL(5, 4),
  signals JSONB,
  scan_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT so.ticker, so.price, so.total_score, so.upside_potential, so.signals, so.scan_date
  FROM stock_opportunities so
  WHERE so.scan_date = target_date AND so.total_score >= min_score
  ORDER BY so.total_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_improving_stocks(
  min_delta INTEGER DEFAULT 10,
  days_back INTEGER DEFAULT 7
) RETURNS TABLE (
  ticker VARCHAR(10),
  current_score INTEGER,
  previous_score INTEGER,
  score_delta INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH current_scores AS (
    SELECT so.ticker, so.total_score FROM stock_opportunities so WHERE so.scan_date = CURRENT_DATE
  ),
  previous_scores AS (
    SELECT so.ticker, so.total_score FROM stock_opportunities so WHERE so.scan_date = CURRENT_DATE - days_back
  )
  SELECT c.ticker, c.total_score, p.total_score, c.total_score - p.total_score
  FROM current_scores c
  JOIN previous_scores p ON c.ticker = p.ticker
  WHERE c.total_score - p.total_score >= min_delta
  ORDER BY c.total_score - p.total_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Grants
GRANT SELECT ON stock_opportunities TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_improving_stocks TO anon, authenticated;

-- Comments
COMMENT ON TABLE stock_opportunities IS 'Daily stock screening results with technical, fundamental, and analyst scores';
