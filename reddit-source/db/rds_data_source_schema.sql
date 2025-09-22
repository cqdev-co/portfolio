-- Reddit Data Source (RDS) - Simplified Single Table Schema
-- This replaces the complex multi-table schema with one comprehensive table

-- Drop existing tables if they exist
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS image_extractions CASCADE;
DROP TABLE IF EXISTS text_extractions CASCADE;
DROP TABLE IF EXISTS post_deduplications CASCADE;
DROP TABLE IF EXISTS post_quality_scores CASCADE;
DROP TABLE IF EXISTS market_data_enrichments CASCADE;
DROP TABLE IF EXISTS reddit_features CASCADE;

-- Create the main RDS data source table
CREATE TABLE rds_data_source (
    -- Primary identifiers
    id BIGSERIAL PRIMARY KEY,
    post_id TEXT UNIQUE NOT NULL,
    
    -- Reddit post metadata
    subreddit TEXT NOT NULL,
    author TEXT,
    created_utc BIGINT NOT NULL,
    created_datetime TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    selftext TEXT DEFAULT '',
    permalink TEXT NOT NULL,
    url TEXT,
    
    -- Post metrics
    score INTEGER DEFAULT 0,
    upvote_ratio REAL DEFAULT 0.0,
    num_comments INTEGER DEFAULT 0,
    flair TEXT,
    
    -- Content classification
    is_image BOOLEAN DEFAULT FALSE,
    is_video BOOLEAN DEFAULT FALSE,
    is_self BOOLEAN DEFAULT FALSE,
    image_path TEXT,
    
    -- Extracted data (JSON fields for flexibility)
    tickers JSONB DEFAULT '[]'::jsonb,  -- Array of ticker symbols found
    sentiment TEXT,  -- 'bull', 'bear', 'neutral'
    horizon TEXT,    -- 'intraday', 'swing', 'long'
    claims JSONB DEFAULT '[]'::jsonb,   -- Array of claims/predictions
    numeric_data JSONB DEFAULT '{}'::jsonb,  -- entry/stop/target prices, etc.
    
    -- Image analysis (if applicable)
    image_type TEXT,  -- 'chart', 'pnl', 'slide', 'meme', 'other'
    ocr_text TEXT,    -- Extracted text from images
    
    -- Quality and confidence scores
    confidence_score REAL DEFAULT 0.0,
    quality_tier TEXT DEFAULT 'unprocessed',  -- 'valuable', 'soft_quarantine', 'quarantine', 'unprocessed'
    
    -- Market data enrichment
    market_data JSONB DEFAULT '{}'::jsonb,  -- Price data, volume, etc.
    
    -- Processing status
    processed_at TIMESTAMPTZ,
    processing_status TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    
    -- Metadata
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_rds_post_id ON rds_data_source(post_id);
CREATE INDEX idx_rds_subreddit ON rds_data_source(subreddit);
CREATE INDEX idx_rds_created_datetime ON rds_data_source(created_datetime);
CREATE INDEX idx_rds_tickers ON rds_data_source USING GIN(tickers);
CREATE INDEX idx_rds_sentiment ON rds_data_source(sentiment);
CREATE INDEX idx_rds_quality_tier ON rds_data_source(quality_tier);
CREATE INDEX idx_rds_processing_status ON rds_data_source(processing_status);
CREATE INDEX idx_rds_ingested_at ON rds_data_source(ingested_at);

-- Create a composite index for common queries
CREATE INDEX idx_rds_subreddit_created ON rds_data_source(subreddit, created_datetime DESC);
CREATE INDEX idx_rds_tickers_created ON rds_data_source USING GIN(tickers) WHERE tickers != '[]'::jsonb;

-- Enable Row Level Security (RLS)
ALTER TABLE rds_data_source ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON rds_data_source
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON rds_data_source
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON rds_data_source
    FOR UPDATE USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_rds_data_source_updated_at
    BEFORE UPDATE ON rds_data_source
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a materialized view for analytics
CREATE MATERIALIZED VIEW rds_analytics AS
WITH ticker_expanded AS (
    SELECT 
        subreddit,
        DATE(created_datetime) as date,
        score,
        num_comments,
        sentiment,
        quality_tier,
        is_image,
        jsonb_array_elements_text(tickers) as ticker
    FROM rds_data_source
    WHERE tickers != '[]'::jsonb
),
daily_stats AS (
    SELECT 
        subreddit,
        DATE(created_datetime) as date,
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE tickers != '[]'::jsonb) as posts_with_tickers,
        COUNT(*) FILTER (WHERE sentiment IS NOT NULL) as posts_with_sentiment,
        COUNT(*) FILTER (WHERE quality_tier = 'valuable') as valuable_posts,
        COUNT(*) FILTER (WHERE is_image = true) as image_posts,
        AVG(score) as avg_score,
        AVG(num_comments) as avg_comments
    FROM rds_data_source
    GROUP BY subreddit, DATE(created_datetime)
),
unique_tickers_per_day AS (
    SELECT 
        subreddit,
        date,
        JSONB_AGG(DISTINCT ticker) as unique_tickers
    FROM ticker_expanded
    GROUP BY subreddit, date
)
SELECT 
    ds.subreddit,
    ds.date,
    ds.total_posts,
    ds.posts_with_tickers,
    ds.posts_with_sentiment,
    ds.valuable_posts,
    ds.image_posts,
    ds.avg_score,
    ds.avg_comments,
    COALESCE(ut.unique_tickers, '[]'::jsonb) as unique_tickers
FROM daily_stats ds
LEFT JOIN unique_tickers_per_day ut ON ds.subreddit = ut.subreddit AND ds.date = ut.date
ORDER BY ds.subreddit, ds.date DESC;

-- Create index on the materialized view
CREATE INDEX idx_rds_analytics_subreddit_date ON rds_analytics(subreddit, date);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_rds_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY rds_analytics;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON rds_data_source TO authenticated;
GRANT ALL ON rds_analytics TO authenticated;
GRANT USAGE ON SEQUENCE rds_data_source_id_seq TO authenticated;