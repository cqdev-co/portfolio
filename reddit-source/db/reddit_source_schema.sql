-- Reddit Source Database Schema for Supabase
-- Enterprise-grade schema for Reddit financial data processing

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create custom types
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE image_type AS ENUM ('chart', 'pnl', 'slide', 'meme', 'other');
CREATE TYPE timeframe AS ENUM ('1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M');
CREATE TYPE stance AS ENUM ('bull', 'bear', 'neutral');
CREATE TYPE horizon AS ENUM ('intraday', 'swing', 'long');
CREATE TYPE quality_tier AS ENUM ('valuable', 'soft_quarantine', 'hard_drop');
CREATE TYPE job_type AS ENUM ('ingest', 'ocr', 'vlm', 'enrich', 'aggregate');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- Core posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT UNIQUE NOT NULL,
    subreddit TEXT NOT NULL,
    author TEXT,
    created_utc BIGINT NOT NULL,
    created_datetime TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    selftext TEXT DEFAULT '',
    permalink TEXT NOT NULL,
    url TEXT,
    score INTEGER DEFAULT 0,
    upvote_ratio REAL DEFAULT 0.0,
    num_comments INTEGER DEFAULT 0,
    flair TEXT,
    is_image BOOLEAN DEFAULT FALSE,
    is_video BOOLEAN DEFAULT FALSE,
    is_self BOOLEAN DEFAULT FALSE,
    is_nsfw BOOLEAN DEFAULT FALSE,
    is_spoiler BOOLEAN DEFAULT FALSE,
    image_path TEXT,
    image_hash TEXT,
    
    -- Processing metadata
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_status processing_status DEFAULT 'pending',
    processing_error TEXT,
    
    -- Indexes
    CONSTRAINT posts_created_utc_check CHECK (created_utc > 0),
    CONSTRAINT posts_score_check CHECK (score >= -1000000),
    CONSTRAINT posts_upvote_ratio_check CHECK (upvote_ratio >= 0.0 AND upvote_ratio <= 1.0)
);

-- Image extractions table
CREATE TABLE image_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    image_type image_type,
    primary_ticker TEXT,
    tickers TEXT[] DEFAULT '{}',
    timeframe timeframe,
    stance stance,
    horizon horizon,
    claims TEXT[] DEFAULT '{}',
    numeric JSONB DEFAULT '{}',
    platform TEXT,
    field_confidence JSONB DEFAULT '{}',
    
    -- Processing metadata
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    model_used TEXT,
    processing_time_ms REAL,
    
    UNIQUE(post_id)
);

-- Text extractions table
CREATE TABLE text_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    tickers TEXT[] DEFAULT '{}',
    stance stance,
    horizon horizon,
    claims TEXT[] DEFAULT '{}',
    confidence REAL DEFAULT 0.0,
    sentiment_score REAL DEFAULT 0.0,
    entities JSONB DEFAULT '{}',
    
    -- Processing metadata
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(post_id),
    CONSTRAINT text_extractions_confidence_check CHECK (confidence >= 0.0 AND confidence <= 1.0),
    CONSTRAINT text_extractions_sentiment_check CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0)
);

-- Market enrichment table
CREATE TABLE market_enrichment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    price_at_post REAL,
    volume_at_post REAL,
    market_cap REAL,
    iv_rank_at_post REAL,
    earnings_window INTEGER,
    
    -- Forward returns (computed nightly)
    fwd_1d_ret REAL,
    fwd_5d_ret REAL,
    fwd_10d_ret REAL,
    fwd_30d_ret REAL,
    
    -- Processing metadata
    enriched_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(post_id, ticker),
    CONSTRAINT market_enrichment_price_check CHECK (price_at_post > 0 OR price_at_post IS NULL),
    CONSTRAINT market_enrichment_volume_check CHECK (volume_at_post >= 0 OR volume_at_post IS NULL)
);

-- Quality scores table
CREATE TABLE quality_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    
    -- Component scores (0-1)
    content_score REAL DEFAULT 0.0,
    image_signal_score REAL DEFAULT 0.0,
    evidence_score REAL DEFAULT 0.0,
    crosscheck_score REAL DEFAULT 0.0,
    engagement_score REAL DEFAULT 0.0,
    
    -- Overall scores
    value_score REAL DEFAULT 0.0,
    quality_tier quality_tier DEFAULT 'hard_drop',
    
    -- Flags
    is_duplicate BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    has_ticker_verified BOOLEAN DEFAULT FALSE,
    has_market_sanity BOOLEAN DEFAULT FALSE,
    
    -- Processing metadata
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(post_id),
    CONSTRAINT quality_scores_content_check CHECK (content_score >= 0.0 AND content_score <= 1.0),
    CONSTRAINT quality_scores_image_check CHECK (image_signal_score >= 0.0 AND image_signal_score <= 1.0),
    CONSTRAINT quality_scores_evidence_check CHECK (evidence_score >= 0.0 AND evidence_score <= 1.0),
    CONSTRAINT quality_scores_crosscheck_check CHECK (crosscheck_score >= 0.0 AND crosscheck_score <= 1.0),
    CONSTRAINT quality_scores_engagement_check CHECK (engagement_score >= 0.0 AND engagement_score <= 1.0),
    CONSTRAINT quality_scores_value_check CHECK (value_score >= 0.0 AND value_score <= 1.0)
);

-- Reddit features aggregation table
CREATE TABLE reddit_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL,
    bucket_2h TIMESTAMPTZ NOT NULL,
    
    -- Volume metrics
    post_count INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    
    -- Sentiment metrics
    bull_count INTEGER DEFAULT 0,
    bear_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    bull_pct REAL DEFAULT 0.0,
    avg_sentiment REAL DEFAULT 0.0,
    
    -- Quality metrics
    valuable_count INTEGER DEFAULT 0,
    has_tradeplan BOOLEAN DEFAULT FALSE,
    has_chart BOOLEAN DEFAULT FALSE,
    has_pnl BOOLEAN DEFAULT FALSE,
    
    -- Buzz metrics
    buzz_score REAL DEFAULT 0.0,
    buzz_z REAL DEFAULT 0.0,
    
    -- Processing metadata
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ticker, bucket_2h),
    CONSTRAINT reddit_features_counts_check CHECK (
        post_count >= 0 AND unique_authors >= 0 AND 
        bull_count >= 0 AND bear_count >= 0 AND neutral_count >= 0 AND
        valuable_count >= 0
    ),
    CONSTRAINT reddit_features_bull_pct_check CHECK (bull_pct >= 0.0 AND bull_pct <= 1.0),
    CONSTRAINT reddit_features_sentiment_check CHECK (avg_sentiment >= -1.0 AND avg_sentiment <= 1.0)
);

-- Processing jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type job_type NOT NULL,
    status job_status DEFAULT 'pending',
    post_ids TEXT[] DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    progress REAL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT processing_jobs_progress_check CHECK (progress >= 0.0 AND progress <= 100.0)
);

-- Create indexes for performance
CREATE INDEX idx_posts_subreddit ON posts(subreddit);
CREATE INDEX idx_posts_created_datetime ON posts(created_datetime);
CREATE INDEX idx_posts_created_utc ON posts(created_utc);
CREATE INDEX idx_posts_score ON posts(score);
CREATE INDEX idx_posts_processing_status ON posts(processing_status);
CREATE INDEX idx_posts_is_image ON posts(is_image);
CREATE INDEX idx_posts_author ON posts(author) WHERE author IS NOT NULL;
CREATE INDEX idx_posts_title_gin ON posts USING gin(title gin_trgm_ops);
CREATE INDEX idx_posts_selftext_gin ON posts USING gin(selftext gin_trgm_ops);

CREATE INDEX idx_image_extractions_post_id ON image_extractions(post_id);
CREATE INDEX idx_image_extractions_primary_ticker ON image_extractions(primary_ticker) WHERE primary_ticker IS NOT NULL;
CREATE INDEX idx_image_extractions_tickers_gin ON image_extractions USING gin(tickers);
CREATE INDEX idx_image_extractions_image_type ON image_extractions(image_type);
CREATE INDEX idx_image_extractions_stance ON image_extractions(stance);

CREATE INDEX idx_text_extractions_post_id ON text_extractions(post_id);
CREATE INDEX idx_text_extractions_tickers_gin ON text_extractions USING gin(tickers);
CREATE INDEX idx_text_extractions_stance ON text_extractions(stance);
CREATE INDEX idx_text_extractions_sentiment ON text_extractions(sentiment_score);

CREATE INDEX idx_market_enrichment_post_id ON market_enrichment(post_id);
CREATE INDEX idx_market_enrichment_ticker ON market_enrichment(ticker);
CREATE INDEX idx_market_enrichment_price ON market_enrichment(price_at_post);
CREATE INDEX idx_market_enrichment_fwd_returns ON market_enrichment(fwd_1d_ret, fwd_5d_ret);

CREATE INDEX idx_quality_scores_post_id ON quality_scores(post_id);
CREATE INDEX idx_quality_scores_value_score ON quality_scores(value_score);
CREATE INDEX idx_quality_scores_quality_tier ON quality_scores(quality_tier);
CREATE INDEX idx_quality_scores_flags ON quality_scores(is_duplicate, is_spam, has_ticker_verified);

CREATE INDEX idx_reddit_features_ticker ON reddit_features(ticker);
CREATE INDEX idx_reddit_features_bucket ON reddit_features(bucket_2h);
CREATE INDEX idx_reddit_features_buzz_z ON reddit_features(buzz_z);
CREATE INDEX idx_reddit_features_composite ON reddit_features(ticker, bucket_2h, buzz_z);

CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(job_type);
CREATE INDEX idx_processing_jobs_created ON processing_jobs(created_at);

-- Create materialized view for scanner integration
CREATE MATERIALIZED VIEW scanner_ready_signals AS
SELECT 
    p.post_id,
    p.subreddit,
    p.created_datetime,
    p.title,
    p.score,
    p.num_comments,
    ie.primary_ticker,
    ie.tickers,
    ie.image_type,
    ie.stance,
    ie.horizon,
    ie.timeframe,
    ie.claims,
    ie.numeric,
    te.sentiment_score,
    me.price_at_post,
    me.fwd_1d_ret,
    me.fwd_5d_ret,
    qs.value_score,
    qs.quality_tier,
    rf.buzz_z,
    rf.bull_pct
FROM posts p
LEFT JOIN image_extractions ie ON p.post_id = ie.post_id
LEFT JOIN text_extractions te ON p.post_id = te.post_id
LEFT JOIN market_enrichment me ON p.post_id = me.post_id
LEFT JOIN quality_scores qs ON p.post_id = qs.post_id
LEFT JOIN reddit_features rf ON (
    ie.primary_ticker = rf.ticker AND 
    date_trunc('hour', p.created_datetime) + 
    (EXTRACT(hour FROM p.created_datetime)::int % 2) * interval '1 hour' = rf.bucket_2h
)
WHERE qs.quality_tier IN ('valuable', 'soft_quarantine')
    AND p.processing_status = 'completed';

CREATE UNIQUE INDEX idx_scanner_ready_signals_post_id ON scanner_ready_signals(post_id);

-- Row Level Security (RLS) policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access" ON posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON image_extractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON text_extractions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON market_enrichment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON quality_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON reddit_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON processing_jobs FOR SELECT TO authenticated USING (true);

-- Allow service role to perform all operations
CREATE POLICY "Allow service role full access" ON posts FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON image_extractions FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON text_extractions FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON market_enrichment FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON quality_scores FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON reddit_features FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role full access" ON processing_jobs FOR ALL TO service_role USING (true);

-- Functions for common operations
CREATE OR REPLACE FUNCTION get_posts_for_processing(
    batch_size INTEGER DEFAULT 50,
    processing_type TEXT DEFAULT 'ocr'
)
RETURNS TABLE(post_id TEXT, image_path TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.post_id, p.image_path
    FROM posts p
    WHERE p.processing_status = 'pending'
        AND p.is_image = true
        AND p.image_path IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM image_extractions ie 
            WHERE ie.post_id = p.post_id
        )
    ORDER BY p.created_datetime DESC
    LIMIT batch_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_reddit_features_for_ticker(
    target_ticker TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    bucket_start TIMESTAMPTZ;
    bucket_end TIMESTAMPTZ;
BEGIN
    -- Round to 2-hour boundaries
    bucket_start := date_trunc('hour', start_time) + 
                   (EXTRACT(hour FROM start_time)::int / 2) * interval '2 hours';
    bucket_end := date_trunc('hour', end_time) + 
                 (EXTRACT(hour FROM end_time)::int / 2) * interval '2 hours' + 
                 interval '2 hours';
    
    -- Upsert reddit features for each 2-hour bucket
    INSERT INTO reddit_features (
        ticker, bucket_2h, post_count, unique_authors, total_score, total_comments,
        bull_count, bear_count, neutral_count, bull_pct, avg_sentiment,
        valuable_count, has_tradeplan, has_chart, has_pnl, buzz_score
    )
    SELECT 
        target_ticker,
        bucket,
        COUNT(*) as post_count,
        COUNT(DISTINCT p.author) as unique_authors,
        SUM(p.score) as total_score,
        SUM(p.num_comments) as total_comments,
        SUM(CASE WHEN COALESCE(ie.stance, te.stance) = 'bull' THEN 1 ELSE 0 END) as bull_count,
        SUM(CASE WHEN COALESCE(ie.stance, te.stance) = 'bear' THEN 1 ELSE 0 END) as bear_count,
        SUM(CASE WHEN COALESCE(ie.stance, te.stance) = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
        CASE WHEN COUNT(*) > 0 THEN 
            SUM(CASE WHEN COALESCE(ie.stance, te.stance) = 'bull' THEN 1 ELSE 0 END)::REAL / COUNT(*)
        ELSE 0 END as bull_pct,
        AVG(COALESCE(te.sentiment_score, 0)) as avg_sentiment,
        SUM(CASE WHEN qs.quality_tier = 'valuable' THEN 1 ELSE 0 END) as valuable_count,
        BOOL_OR(ie.numeric ? 'entry' OR ie.numeric ? 'stop' OR ie.numeric ? 'target') as has_tradeplan,
        BOOL_OR(ie.image_type = 'chart') as has_chart,
        BOOL_OR(ie.image_type = 'pnl') as has_pnl,
        COUNT(*) * AVG(p.score) * COUNT(DISTINCT p.author) as buzz_score
    FROM generate_series(bucket_start, bucket_end - interval '2 hours', interval '2 hours') bucket
    LEFT JOIN posts p ON (
        p.created_datetime >= bucket AND 
        p.created_datetime < bucket + interval '2 hours'
    )
    LEFT JOIN image_extractions ie ON p.post_id = ie.post_id
    LEFT JOIN text_extractions te ON p.post_id = te.post_id
    LEFT JOIN quality_scores qs ON p.post_id = qs.post_id
    WHERE (
        target_ticker = ANY(ie.tickers) OR 
        target_ticker = ANY(te.tickers) OR
        ie.primary_ticker = target_ticker
    )
    GROUP BY bucket
    HAVING COUNT(*) > 0
    ON CONFLICT (ticker, bucket_2h) DO UPDATE SET
        post_count = EXCLUDED.post_count,
        unique_authors = EXCLUDED.unique_authors,
        total_score = EXCLUDED.total_score,
        total_comments = EXCLUDED.total_comments,
        bull_count = EXCLUDED.bull_count,
        bear_count = EXCLUDED.bear_count,
        neutral_count = EXCLUDED.neutral_count,
        bull_pct = EXCLUDED.bull_pct,
        avg_sentiment = EXCLUDED.avg_sentiment,
        valuable_count = EXCLUDED.valuable_count,
        has_tradeplan = EXCLUDED.has_tradeplan,
        has_chart = EXCLUDED.has_chart,
        has_pnl = EXCLUDED.has_pnl,
        buzz_score = EXCLUDED.buzz_score,
        computed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_scanner_signals()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY scanner_ready_signals;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role, authenticated;
