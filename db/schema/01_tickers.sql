-- ============================================================================
-- TICKERS - Global Market Ticker Registry
-- ============================================================================
-- Two ticker tables:
--   tickers       - Full market tickers (~2,306 rows in prod, 2.1 MB)
--   penny_tickers - Sub-$5 tickers (~2,020 rows in prod, 792 KB)
--
-- Both are maintained by automated GitHub Actions workflows.
--
-- NOTE: Production has extra quality-scoring columns and indexes
-- (quality_score, quality_tier, is_high_quality, avg_volume, market_cap)
-- that were added directly in the DB. These are reflected below.
-- ============================================================================

-- ============================================================================
-- 1. TICKERS (full market)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tickers (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  exchange VARCHAR(50),
  country VARCHAR(50),
  currency VARCHAR(10),
  sector VARCHAR(100),
  industry VARCHAR(100),
  market_cap BIGINT,
  is_active BOOLEAN DEFAULT TRUE,
  ticker_type VARCHAR(20) DEFAULT 'stock',

  -- Quality scoring (added for ticker filtering)
  quality_score DECIMAL(5, 2),
  quality_tier VARCHAR(10),
  is_high_quality BOOLEAN DEFAULT FALSE,
  avg_volume BIGINT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickers_symbol ON tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_tickers_exchange ON tickers(exchange);
CREATE INDEX IF NOT EXISTS idx_tickers_country ON tickers(country);
CREATE INDEX IF NOT EXISTS idx_tickers_sector ON tickers(sector);
CREATE INDEX IF NOT EXISTS idx_tickers_is_active ON tickers(is_active);
CREATE INDEX IF NOT EXISTS idx_tickers_ticker_type ON tickers(ticker_type);
CREATE INDEX IF NOT EXISTS idx_tickers_market_cap ON tickers(market_cap);
CREATE INDEX IF NOT EXISTS idx_tickers_avg_volume ON tickers(avg_volume);
CREATE INDEX IF NOT EXISTS idx_tickers_quality_score ON tickers(quality_score);
CREATE INDEX IF NOT EXISTS idx_tickers_quality_tier ON tickers(quality_tier);
CREATE INDEX IF NOT EXISTS idx_tickers_is_high_quality ON tickers(is_high_quality) WHERE is_high_quality = TRUE;

CREATE TRIGGER update_tickers_updated_at
  BEFORE UPDATE ON tickers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to tickers" ON tickers
  FOR SELECT USING (true);

CREATE POLICY "Allow insert/update for service role" ON tickers
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. PENNY TICKERS (sub-$5 stocks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS penny_tickers (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  exchange VARCHAR(50),
  country VARCHAR(50),
  currency VARCHAR(10),
  sector VARCHAR(100),
  industry VARCHAR(100),
  market_cap BIGINT,
  is_active BOOLEAN DEFAULT TRUE,
  ticker_type VARCHAR(20) DEFAULT 'stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_penny_tickers_symbol ON penny_tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_penny_tickers_exchange ON penny_tickers(exchange);
CREATE INDEX IF NOT EXISTS idx_penny_tickers_country ON penny_tickers(country);
CREATE INDEX IF NOT EXISTS idx_penny_tickers_sector ON penny_tickers(sector);
CREATE INDEX IF NOT EXISTS idx_penny_tickers_is_active ON penny_tickers(is_active);
CREATE INDEX IF NOT EXISTS idx_penny_tickers_ticker_type ON penny_tickers(ticker_type);

CREATE TRIGGER update_penny_tickers_updated_at
  BEFORE UPDATE ON penny_tickers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE penny_tickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to penny_tickers" ON penny_tickers
  FOR SELECT USING (true);

CREATE POLICY "Allow insert/update for service role" ON penny_tickers
  FOR ALL USING (auth.role() = 'service_role');
