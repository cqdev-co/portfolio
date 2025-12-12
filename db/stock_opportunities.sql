-- Stock Opportunities Table Schema
-- Stores daily scan results for buy opportunity signals

-- Drop existing objects if they exist (for fresh setup)
DROP MATERIALIZED VIEW IF EXISTS stock_score_trends CASCADE;
DROP TABLE IF EXISTS stock_opportunities CASCADE;

-- Main opportunities table (keeps full history)
CREATE TABLE stock_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    price DECIMAL(10,2),
    technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 50),
    fundamental_score INTEGER CHECK (fundamental_score >= 0 AND fundamental_score <= 30),
    analyst_score INTEGER CHECK (analyst_score >= 0 AND analyst_score <= 20),
    total_score INTEGER CHECK (total_score >= 0 AND total_score <= 100),
    upside_potential DECIMAL(5,4),  -- Stored as decimal (0.25 = 25%)
    signals JSONB NOT NULL DEFAULT '[]',
    scan_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint for upsert
    UNIQUE(ticker, scan_date)
);

-- Create indexes for common queries
CREATE INDEX idx_stock_opportunities_ticker ON stock_opportunities(ticker);
CREATE INDEX idx_stock_opportunities_scan_date ON stock_opportunities(scan_date);
CREATE INDEX idx_stock_opportunities_total_score ON stock_opportunities(total_score DESC);
CREATE INDEX idx_stock_opportunities_ticker_date ON stock_opportunities(ticker, scan_date);

-- Index for finding high-scoring opportunities
CREATE INDEX idx_stock_opportunities_high_score 
    ON stock_opportunities(scan_date, total_score DESC) 
    WHERE total_score >= 70;

-- GIN index for signal queries
CREATE INDEX idx_stock_opportunities_signals ON stock_opportunities USING GIN (signals);

-- Materialized view for score trends (7-day momentum)
CREATE MATERIALIZED VIEW stock_score_trends AS
WITH daily_scores AS (
    SELECT 
        ticker,
        scan_date,
        total_score,
        LAG(total_score, 7) OVER (
            PARTITION BY ticker ORDER BY scan_date
        ) as score_7d_ago
    FROM stock_opportunities
    WHERE scan_date >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT 
    ticker,
    scan_date,
    total_score as current_score,
    score_7d_ago,
    total_score - COALESCE(score_7d_ago, total_score) as score_delta_7d
FROM daily_scores
WHERE scan_date = CURRENT_DATE;

-- Index on materialized view
CREATE UNIQUE INDEX idx_score_trends_ticker ON stock_score_trends(ticker);
CREATE INDEX idx_score_trends_delta ON stock_score_trends(score_delta_7d DESC);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_stock_score_trends()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY stock_score_trends;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh view after inserts/updates
CREATE TRIGGER trigger_refresh_score_trends
    AFTER INSERT OR UPDATE ON stock_opportunities
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_stock_score_trends();

-- Enable Row Level Security
ALTER TABLE stock_opportunities ENABLE ROW LEVEL SECURITY;

-- Policy for read access (public)
CREATE POLICY "Allow read access to stock_opportunities" 
    ON stock_opportunities
    FOR SELECT USING (true);

-- Policy for service role to insert/update
CREATE POLICY "Allow insert/update for service role" 
    ON stock_opportunities
    FOR ALL USING (auth.role() = 'service_role');

-- Helper function to get top opportunities for a date
CREATE OR REPLACE FUNCTION get_top_opportunities(
    target_date DATE DEFAULT CURRENT_DATE,
    min_score INTEGER DEFAULT 70,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    ticker VARCHAR(10),
    price DECIMAL(10,2),
    total_score INTEGER,
    upside_potential DECIMAL(5,4),
    signals JSONB,
    scan_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        so.ticker,
        so.price,
        so.total_score,
        so.upside_potential,
        so.signals,
        so.scan_date
    FROM stock_opportunities so
    WHERE so.scan_date = target_date
      AND so.total_score >= min_score
    ORDER BY so.total_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get improving stocks
CREATE OR REPLACE FUNCTION get_improving_stocks(
    min_delta INTEGER DEFAULT 10,
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    ticker VARCHAR(10),
    current_score INTEGER,
    previous_score INTEGER,
    score_delta INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH current_scores AS (
        SELECT 
            so.ticker,
            so.total_score
        FROM stock_opportunities so
        WHERE so.scan_date = CURRENT_DATE
    ),
    previous_scores AS (
        SELECT 
            so.ticker,
            so.total_score
        FROM stock_opportunities so
        WHERE so.scan_date = CURRENT_DATE - days_back
    )
    SELECT 
        c.ticker,
        c.total_score as current_score,
        p.total_score as previous_score,
        c.total_score - p.total_score as score_delta
    FROM current_scores c
    JOIN previous_scores p ON c.ticker = p.ticker
    WHERE c.total_score - p.total_score >= min_delta
    ORDER BY score_delta DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON stock_opportunities TO anon, authenticated;
GRANT SELECT ON stock_score_trends TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_opportunities TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_improving_stocks TO anon, authenticated;

-- Comment on table
COMMENT ON TABLE stock_opportunities IS 
    'Daily stock screening results with technical, fundamental, and analyst scores';
COMMENT ON MATERIALIZED VIEW stock_score_trends IS 
    'Pre-computed 7-day score momentum for quick trend queries';

