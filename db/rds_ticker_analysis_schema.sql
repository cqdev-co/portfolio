-- RDS Ticker Analysis Database Schema
-- Comprehensive schema for Reddit-based ticker sentiment analysis system

-- Drop existing tables if they exist (in dependency order)
DROP TABLE IF EXISTS ticker_opportunities CASCADE;
DROP TABLE IF EXISTS analysis_results CASCADE;
DROP TABLE IF EXISTS ai_insights CASCADE;
DROP TABLE IF EXISTS risk_assessments CASCADE;
DROP TABLE IF EXISTS opportunity_scores CASCADE;
DROP TABLE IF EXISTS sentiment_analyses CASCADE;
DROP TABLE IF EXISTS ticker_mentions CASCADE;
DROP TABLE IF EXISTS reddit_comments CASCADE;
DROP TABLE IF EXISTS reddit_posts CASCADE;
DROP TABLE IF EXISTS reddit_users CASCADE;
DROP TABLE IF EXISTS subreddit_metrics CASCADE;
DROP TABLE IF EXISTS market_data CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS technical_indicators CASCADE;
DROP TABLE IF EXISTS ticker_info CASCADE;

-- Create ticker information table
CREATE TABLE ticker_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'USD',
    security_type VARCHAR(20) DEFAULT 'stock',
    sector VARCHAR(100),
    industry VARCHAR(255),
    
    -- Market metrics
    market_cap BIGINT,
    shares_outstanding BIGINT,
    float_shares BIGINT,
    
    -- Financial ratios
    pe_ratio DECIMAL(10,4),
    pb_ratio DECIMAL(10,4),
    dividend_yield DECIMAL(8,4),
    beta DECIMAL(8,4),
    
    -- Trading characteristics
    average_volume BIGINT,
    average_dollar_volume DECIMAL(15,2),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_tradeable BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_source VARCHAR(50) DEFAULT 'yfinance'
);

-- Create technical indicators table
CREATE TABLE technical_indicators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    calculation_date DATE NOT NULL,
    
    -- Moving averages
    sma_20 DECIMAL(12,4),
    sma_50 DECIMAL(12,4),
    sma_200 DECIMAL(12,4),
    ema_12 DECIMAL(12,4),
    ema_26 DECIMAL(12,4),
    
    -- Bollinger Bands
    bb_upper DECIMAL(12,4),
    bb_middle DECIMAL(12,4),
    bb_lower DECIMAL(12,4),
    bb_width DECIMAL(10,6),
    bb_percent DECIMAL(8,4),
    
    -- Volatility
    atr_14 DECIMAL(12,4),
    atr_20 DECIMAL(12,4),
    volatility_20d DECIMAL(8,4),
    
    -- Momentum oscillators
    rsi_14 DECIMAL(8,4),
    stoch_k DECIMAL(8,4),
    stoch_d DECIMAL(8,4),
    
    -- MACD
    macd_line DECIMAL(10,6),
    macd_signal DECIMAL(10,6),
    macd_histogram DECIMAL(10,6),
    
    -- Volume indicators
    volume_sma_20 BIGINT,
    volume_ratio DECIMAL(8,4),
    
    -- Trend indicators
    adx_14 DECIMAL(8,4),
    di_plus DECIMAL(8,4),
    di_minus DECIMAL(8,4),
    
    -- Support/Resistance
    support_level DECIMAL(12,4),
    resistance_level DECIMAL(12,4),
    
    -- Derived signals
    trend_direction VARCHAR(20),
    trend_strength DECIMAL(6,4),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(ticker_symbol, calculation_date)
);

-- Create price history table
CREATE TABLE price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    timeframe VARCHAR(10) NOT NULL DEFAULT '1d',
    
    -- OHLCV data
    open_price DECIMAL(12,4) NOT NULL,
    high_price DECIMAL(12,4) NOT NULL,
    low_price DECIMAL(12,4) NOT NULL,
    close_price DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    
    -- Derived metrics
    dollar_volume DECIMAL(15,2),
    true_range DECIMAL(12,4),
    price_change DECIMAL(12,4),
    price_change_pct DECIMAL(8,4),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(ticker_symbol, date, timeframe)
);

-- Create market data table (current/latest data)
CREATE TABLE market_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL UNIQUE,
    
    -- Current price data
    current_price DECIMAL(12,4) NOT NULL,
    previous_close DECIMAL(12,4) NOT NULL,
    open_price DECIMAL(12,4) NOT NULL,
    day_high DECIMAL(12,4) NOT NULL,
    day_low DECIMAL(12,4) NOT NULL,
    
    -- Volume
    current_volume BIGINT NOT NULL,
    average_volume BIGINT NOT NULL,
    
    -- Changes
    price_change DECIMAL(12,4),
    price_change_pct DECIMAL(8,4),
    
    -- Market metrics
    market_cap BIGINT,
    pe_ratio DECIMAL(10,4),
    
    -- Technical indicators reference
    technical_indicators_id UUID REFERENCES technical_indicators(id),
    
    -- Timestamps
    last_trade_time TIMESTAMPTZ,
    market_hours BOOLEAN DEFAULT FALSE,
    data_age_minutes INTEGER DEFAULT 0,
    is_real_time BOOLEAN DEFAULT TRUE,
    data_source VARCHAR(50) DEFAULT 'yfinance',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create subreddit metrics table
CREATE TABLE subreddit_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subreddit_name VARCHAR(50) NOT NULL,
    metrics_date DATE NOT NULL,
    
    -- Basic stats
    subscriber_count INTEGER,
    active_users INTEGER,
    
    -- Activity metrics
    posts_per_day DECIMAL(8,2),
    comments_per_day DECIMAL(8,2),
    
    -- Quality indicators
    average_post_score DECIMAL(8,2),
    average_comment_score DECIMAL(8,2),
    
    -- Ticker-specific metrics
    ticker_mentions_per_day DECIMAL(8,2),
    unique_tickers_per_day DECIMAL(8,2),
    
    -- Bot activity
    estimated_bot_percentage DECIMAL(6,4),
    
    -- Reputation
    subreddit_quality_score DECIMAL(6,4),
    financial_relevance_score DECIMAL(6,4),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(subreddit_name, metrics_date)
);

-- Create Reddit users table
CREATE TABLE reddit_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    account_created TIMESTAMPTZ,
    
    -- Reputation metrics
    total_karma INTEGER DEFAULT 0,
    post_karma INTEGER DEFAULT 0,
    comment_karma INTEGER DEFAULT 0,
    
    -- Activity metrics
    total_posts INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    avg_posts_per_day DECIMAL(8,4) DEFAULT 0,
    avg_comments_per_day DECIMAL(8,4) DEFAULT 0,
    
    -- Bot detection
    user_type VARCHAR(20) DEFAULT 'likely_human',
    bot_probability DECIMAL(6,4) DEFAULT 0,
    
    -- Account characteristics
    has_verified_email BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    is_moderator BOOLEAN DEFAULT FALSE,
    
    -- Behavioral patterns
    posting_pattern_score DECIMAL(6,4) DEFAULT 0.5,
    content_diversity_score DECIMAL(6,4) DEFAULT 0.5,
    interaction_authenticity_score DECIMAL(6,4) DEFAULT 0.5,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Reddit posts table
CREATE TABLE reddit_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id VARCHAR(20) NOT NULL UNIQUE,
    subreddit VARCHAR(50) NOT NULL,
    author VARCHAR(50),
    author_id UUID REFERENCES reddit_users(id),
    
    -- Content
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    
    -- Metadata
    posted_at TIMESTAMPTZ NOT NULL,
    flair VARCHAR(50),
    is_self_post BOOLEAN DEFAULT FALSE,
    is_nsfw BOOLEAN DEFAULT FALSE,
    is_spoiler BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    
    -- Engagement metrics
    score INTEGER DEFAULT 0,
    upvote_ratio DECIMAL(6,4) DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    num_crossposts INTEGER DEFAULT 0,
    
    -- Awards
    total_awards_received INTEGER DEFAULT 0,
    gilded_count INTEGER DEFAULT 0,
    
    -- Quality indicators
    quality_score DECIMAL(6,4) DEFAULT 0,
    spam_probability DECIMAL(6,4) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Reddit comments table
CREATE TABLE reddit_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id VARCHAR(20) NOT NULL UNIQUE,
    post_id VARCHAR(20) NOT NULL,
    parent_comment_id VARCHAR(20),
    
    subreddit VARCHAR(50) NOT NULL,
    author VARCHAR(50),
    author_id UUID REFERENCES reddit_users(id),
    
    -- Content
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,
    
    -- Threading
    depth INTEGER DEFAULT 0,
    is_top_level BOOLEAN DEFAULT TRUE,
    
    -- Engagement
    score INTEGER DEFAULT 0,
    is_gilded BOOLEAN DEFAULT FALSE,
    
    -- Moderation
    is_removed BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Quality indicators
    quality_score DECIMAL(6,4) DEFAULT 0,
    relevance_score DECIMAL(6,4) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (post_id) REFERENCES reddit_posts(post_id)
);

-- Create ticker mentions table
CREATE TABLE ticker_mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    content_type VARCHAR(20) NOT NULL, -- 'post' or 'comment'
    content_id VARCHAR(20) NOT NULL,
    subreddit VARCHAR(50) NOT NULL,
    author VARCHAR(50),
    
    -- Context
    mention_context TEXT,
    position_in_content INTEGER,
    
    -- Confidence and validation
    confidence_score DECIMAL(6,4) NOT NULL,
    is_ticker_validated BOOLEAN DEFAULT FALSE,
    validation_source VARCHAR(50),
    
    -- Sentiment context
    local_sentiment VARCHAR(20),
    sentiment_confidence DECIMAL(6,4),
    
    -- Temporal data
    mentioned_at TIMESTAMPTZ NOT NULL,
    
    -- Associated data
    post_score INTEGER,
    comment_score INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create sentiment analyses table
CREATE TABLE sentiment_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id VARCHAR(20) NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    ticker_symbol VARCHAR(10) NOT NULL,
    
    -- Content metadata
    analyzed_text TEXT,
    text_length INTEGER,
    language VARCHAR(10) DEFAULT 'en',
    
    -- Sentiment analysis
    sentiment_label VARCHAR(20) NOT NULL,
    sentiment_confidence DECIMAL(6,4) NOT NULL,
    polarity DECIMAL(8,4) NOT NULL,
    subjectivity DECIMAL(6,4) NOT NULL,
    intensity DECIMAL(6,4) NOT NULL,
    vader_compound DECIMAL(8,4),
    textblob_polarity DECIMAL(8,4),
    
    -- Emotion analysis
    primary_emotion VARCHAR(20),
    emotion_confidence DECIMAL(6,4),
    emotion_scores JSONB DEFAULT '{}',
    emotional_intensity DECIMAL(6,4),
    fear_greed_index DECIMAL(6,4),
    fomo_indicator DECIMAL(6,4),
    panic_indicator DECIMAL(6,4),
    
    -- Content classification
    is_due_diligence BOOLEAN DEFAULT FALSE,
    is_technical_analysis BOOLEAN DEFAULT FALSE,
    is_news_discussion BOOLEAN DEFAULT FALSE,
    is_earnings_related BOOLEAN DEFAULT FALSE,
    is_meme_content BOOLEAN DEFAULT FALSE,
    is_pump_attempt BOOLEAN DEFAULT FALSE,
    has_supporting_evidence BOOLEAN DEFAULT FALSE,
    has_financial_data BOOLEAN DEFAULT FALSE,
    has_price_targets BOOLEAN DEFAULT FALSE,
    has_risk_discussion BOOLEAN DEFAULT FALSE,
    investment_horizon VARCHAR(20),
    position_type VARCHAR(20),
    classification_confidence DECIMAL(6,4),
    
    -- Extracted information
    key_phrases JSONB DEFAULT '[]',
    financial_keywords JSONB DEFAULT '[]',
    ticker_context_words JSONB DEFAULT '[]',
    mentioned_price_targets JSONB DEFAULT '[]',
    mentioned_support_levels JSONB DEFAULT '[]',
    mentioned_resistance_levels JSONB DEFAULT '[]',
    
    -- Quality and reliability
    content_quality_score DECIMAL(6,4) NOT NULL,
    reliability_score DECIMAL(6,4) NOT NULL,
    
    -- Processing metadata
    analysis_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version VARCHAR(50) NOT NULL,
    processing_time_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create opportunity scores table
CREATE TABLE opportunity_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    
    -- Component scores
    sentiment_score DECIMAL(6,4) NOT NULL,
    volume_score DECIMAL(6,4) NOT NULL,
    quality_score DECIMAL(6,4) NOT NULL,
    momentum_score DECIMAL(6,4) NOT NULL,
    technical_score DECIMAL(6,4) NOT NULL,
    fundamental_score DECIMAL(6,4) NOT NULL,
    
    -- Composite scores
    reddit_composite_score DECIMAL(6,4) NOT NULL,
    market_composite_score DECIMAL(6,4) NOT NULL,
    overall_score DECIMAL(6,4) NOT NULL,
    
    -- Classification
    opportunity_grade VARCHAR(1) NOT NULL,
    signal_strength VARCHAR(20) NOT NULL,
    
    -- Confidence metrics
    score_confidence DECIMAL(6,4) NOT NULL,
    data_reliability DECIMAL(6,4) NOT NULL,
    
    -- Weights used
    weights JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create risk assessments table
CREATE TABLE risk_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    
    -- Risk categories
    market_risk DECIMAL(6,4) NOT NULL,
    liquidity_risk DECIMAL(6,4) NOT NULL,
    volatility_risk DECIMAL(6,4) NOT NULL,
    sentiment_risk DECIMAL(6,4) NOT NULL,
    manipulation_risk DECIMAL(6,4) NOT NULL,
    
    -- Overall assessment
    overall_risk_score DECIMAL(6,4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    
    -- Risk factors and mitigation
    key_risk_factors JSONB DEFAULT '[]',
    risk_mitigation_suggestions JSONB DEFAULT '[]',
    
    -- Position recommendations
    max_position_size_pct DECIMAL(6,2) NOT NULL,
    recommended_stop_loss_pct DECIMAL(6,2) NOT NULL,
    
    -- Risk-adjusted metrics
    risk_adjusted_score DECIMAL(6,4) NOT NULL,
    sharpe_estimate DECIMAL(8,4),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create AI insights table
CREATE TABLE ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    
    -- Summary insights
    executive_summary TEXT NOT NULL,
    key_bullish_points JSONB DEFAULT '[]',
    key_bearish_points JSONB DEFAULT '[]',
    
    -- Market context
    market_context_analysis TEXT,
    sector_analysis TEXT,
    
    -- Sentiment insights
    sentiment_summary TEXT NOT NULL,
    unusual_activity_notes JSONB DEFAULT '[]',
    
    -- Investment analysis
    investment_thesis TEXT NOT NULL,
    catalyst_identification JSONB DEFAULT '[]',
    
    -- Risk analysis
    risk_analysis TEXT NOT NULL,
    contrarian_viewpoints JSONB DEFAULT '[]',
    
    -- Recommendations
    trading_strategy_suggestions JSONB DEFAULT '[]',
    timeline_expectations TEXT,
    
    -- Confidence and metadata
    analysis_confidence DECIMAL(6,4) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ticker opportunities table (main analysis results)
CREATE TABLE ticker_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    analysis_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Reddit metrics (aggregated)
    total_mentions INTEGER DEFAULT 0,
    unique_posts INTEGER DEFAULT 0,
    unique_comments INTEGER DEFAULT 0,
    unique_authors INTEGER DEFAULT 0,
    total_upvotes INTEGER DEFAULT 0,
    total_downvotes INTEGER DEFAULT 0,
    average_score DECIMAL(8,2) DEFAULT 0,
    high_quality_mentions INTEGER DEFAULT 0,
    bot_filtered_mentions INTEGER DEFAULT 0,
    mentions_last_hour INTEGER DEFAULT 0,
    mentions_last_day INTEGER DEFAULT 0,
    mentions_last_week INTEGER DEFAULT 0,
    subreddit_distribution JSONB DEFAULT '{}',
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    quality_ratio DECIMAL(6,4) DEFAULT 0,
    momentum_score DECIMAL(6,4) DEFAULT 0,
    
    -- Market data
    current_price DECIMAL(12,4),
    market_cap BIGINT,
    daily_volume BIGINT,
    
    -- Scoring references
    opportunity_score_id UUID REFERENCES opportunity_scores(id),
    risk_assessment_id UUID REFERENCES risk_assessments(id),
    ai_insights_id UUID REFERENCES ai_insights(id),
    
    -- Data quality
    data_completeness DECIMAL(6,4) DEFAULT 0,
    data_accuracy DECIMAL(6,4) DEFAULT 0,
    data_freshness DECIMAL(6,4) DEFAULT 0,
    overall_data_quality DECIMAL(6,4) DEFAULT 0,
    
    -- Integration data
    volatility_squeeze_signal JSONB,
    
    -- Analysis period
    analysis_period_start TIMESTAMPTZ NOT NULL,
    analysis_period_end TIMESTAMPTZ NOT NULL,
    
    -- Ranking
    percentile_rank INTEGER,
    
    -- Recommendations
    recommended_action VARCHAR(50),
    conviction_level DECIMAL(6,4),
    
    -- Monitoring
    requires_monitoring BOOLEAN DEFAULT TRUE,
    next_review_date TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create analysis results table (batch analysis runs)
CREATE TABLE analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_run_id VARCHAR(50) NOT NULL UNIQUE,
    
    -- Run metadata
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_seconds INTEGER NOT NULL,
    
    -- Scope
    tickers_analyzed JSONB DEFAULT '[]',
    subreddits_monitored JSONB DEFAULT '[]',
    time_period_hours INTEGER NOT NULL,
    
    -- Results summary
    opportunities_found INTEGER DEFAULT 0,
    high_grade_opportunities INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_reddit_posts_analyzed INTEGER DEFAULT 0,
    total_comments_analyzed INTEGER DEFAULT 0,
    unique_tickers_mentioned INTEGER DEFAULT 0,
    
    -- Data quality
    overall_data_quality DECIMAL(6,4) DEFAULT 0,
    data_completeness_pct DECIMAL(6,2) DEFAULT 0,
    
    -- System performance
    processing_rate_posts_per_second DECIMAL(8,2) DEFAULT 0,
    memory_usage_mb INTEGER,
    
    -- Configuration
    analysis_config JSONB DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance

-- Ticker info indexes
CREATE INDEX idx_ticker_info_symbol ON ticker_info(symbol);
CREATE INDEX idx_ticker_info_sector ON ticker_info(sector);
CREATE INDEX idx_ticker_info_is_active ON ticker_info(is_active);

-- Technical indicators indexes
CREATE INDEX idx_technical_indicators_symbol_date ON technical_indicators(ticker_symbol, calculation_date DESC);

-- Price history indexes
CREATE INDEX idx_price_history_symbol_date ON price_history(ticker_symbol, date DESC);
CREATE INDEX idx_price_history_timeframe ON price_history(timeframe);

-- Market data indexes
CREATE INDEX idx_market_data_symbol ON market_data(ticker_symbol);
CREATE INDEX idx_market_data_updated ON market_data(updated_at DESC);

-- Reddit data indexes
CREATE INDEX idx_reddit_users_username ON reddit_users(username);
CREATE INDEX idx_reddit_users_user_type ON reddit_users(user_type);
CREATE INDEX idx_reddit_posts_subreddit_posted ON reddit_posts(subreddit, posted_at DESC);
CREATE INDEX idx_reddit_posts_author ON reddit_posts(author);
CREATE INDEX idx_reddit_comments_post_id ON reddit_comments(post_id);
CREATE INDEX idx_reddit_comments_author ON reddit_comments(author);

-- Ticker mentions indexes
CREATE INDEX idx_ticker_mentions_symbol ON ticker_mentions(ticker_symbol);
CREATE INDEX idx_ticker_mentions_subreddit ON ticker_mentions(subreddit);
CREATE INDEX idx_ticker_mentions_mentioned_at ON ticker_mentions(mentioned_at DESC);
CREATE INDEX idx_ticker_mentions_confidence ON ticker_mentions(confidence_score DESC);

-- Sentiment analysis indexes
CREATE INDEX idx_sentiment_analyses_ticker ON sentiment_analyses(ticker_symbol);
CREATE INDEX idx_sentiment_analyses_content ON sentiment_analyses(content_id, content_type);
CREATE INDEX idx_sentiment_analyses_timestamp ON sentiment_analyses(analysis_timestamp DESC);
CREATE INDEX idx_sentiment_analyses_sentiment ON sentiment_analyses(sentiment_label);

-- Opportunity indexes
CREATE INDEX idx_ticker_opportunities_symbol ON ticker_opportunities(ticker_symbol);
CREATE INDEX idx_ticker_opportunities_analysis_date ON ticker_opportunities(analysis_date DESC);
CREATE INDEX idx_ticker_opportunities_percentile ON ticker_opportunities(percentile_rank);

-- Analysis results indexes
CREATE INDEX idx_analysis_results_run_id ON analysis_results(analysis_run_id);
CREATE INDEX idx_analysis_results_start_time ON analysis_results(start_time DESC);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ticker_info_updated_at BEFORE UPDATE ON ticker_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON market_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reddit_users_updated_at BEFORE UPDATE ON reddit_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reddit_posts_updated_at BEFORE UPDATE ON reddit_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reddit_comments_updated_at BEFORE UPDATE ON reddit_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ticker_opportunities_updated_at BEFORE UPDATE ON ticker_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for multi-tenant scenarios
ALTER TABLE ticker_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticker_opportunities ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (allow all for now - customize based on requirements)
CREATE POLICY "Allow all access to ticker_info" ON ticker_info FOR ALL USING (true);
CREATE POLICY "Allow all access to market_data" ON market_data FOR ALL USING (true);
CREATE POLICY "Allow all access to ticker_opportunities" ON ticker_opportunities FOR ALL USING (true);

-- Create views for common queries

-- Create view for latest ticker opportunities with scores
CREATE OR REPLACE VIEW latest_ticker_opportunities AS
SELECT 
    to.*,
    os.overall_score,
    os.opportunity_grade,
    os.signal_strength,
    ra.overall_risk_score,
    ra.risk_level,
    ai.executive_summary
FROM ticker_opportunities to
LEFT JOIN opportunity_scores os ON to.opportunity_score_id = os.id
LEFT JOIN risk_assessments ra ON to.risk_assessment_id = ra.id  
LEFT JOIN ai_insights ai ON to.ai_insights_id = ai.id
WHERE to.analysis_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY to.analysis_date DESC, os.overall_score DESC;

-- Create view for top opportunities by grade
CREATE OR REPLACE VIEW top_opportunities AS
SELECT 
    to.ticker_symbol,
    to.company_name,
    to.current_price,
    to.total_mentions,
    os.overall_score,
    os.opportunity_grade,
    ra.risk_level,
    to.analysis_date
FROM ticker_opportunities to
JOIN opportunity_scores os ON to.opportunity_score_id = os.id
JOIN risk_assessments ra ON to.risk_assessment_id = ra.id
WHERE os.opportunity_grade IN ('S', 'A', 'B')
  AND to.analysis_date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY os.overall_score DESC, to.total_mentions DESC
LIMIT 50;

-- Create view for Reddit activity summary
CREATE OR REPLACE VIEW reddit_activity_summary AS
SELECT 
    ticker_symbol,
    COUNT(*) as total_mentions,
    COUNT(DISTINCT subreddit) as subreddit_count,
    COUNT(DISTINCT author) as unique_authors,
    AVG(confidence_score) as avg_confidence,
    MAX(mentioned_at) as latest_mention,
    COUNT(*) FILTER (WHERE mentioned_at >= NOW() - INTERVAL '24 hours') as mentions_24h,
    COUNT(*) FILTER (WHERE mentioned_at >= NOW() - INTERVAL '1 hour') as mentions_1h
FROM ticker_mentions
WHERE mentioned_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY ticker_symbol
ORDER BY total_mentions DESC;

-- Create materialized view for performance (refresh periodically)
CREATE MATERIALIZED VIEW daily_ticker_summary AS
SELECT 
    tm.ticker_symbol,
    DATE(tm.mentioned_at) as mention_date,
    COUNT(*) as daily_mentions,
    COUNT(DISTINCT tm.subreddit) as subreddit_count,
    COUNT(DISTINCT tm.author) as unique_authors,
    AVG(tm.confidence_score) as avg_confidence,
    COUNT(sa.id) as sentiment_analyses,
    AVG(CASE 
        WHEN sa.sentiment_label = 'very_bullish' THEN 1.0
        WHEN sa.sentiment_label = 'bullish' THEN 0.75
        WHEN sa.sentiment_label = 'slightly_bullish' THEN 0.55
        WHEN sa.sentiment_label = 'neutral' THEN 0.5
        WHEN sa.sentiment_label = 'slightly_bearish' THEN 0.45
        WHEN sa.sentiment_label = 'bearish' THEN 0.25
        WHEN sa.sentiment_label = 'very_bearish' THEN 0.0
        ELSE 0.5
    END) as avg_sentiment_score
FROM ticker_mentions tm
LEFT JOIN sentiment_analyses sa ON tm.content_id = sa.content_id AND tm.ticker_symbol = sa.ticker_symbol
WHERE tm.mentioned_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tm.ticker_symbol, DATE(tm.mentioned_at)
ORDER BY mention_date DESC, daily_mentions DESC;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_daily_ticker_summary_symbol_date ON daily_ticker_summary(ticker_symbol, mention_date);

-- Add comments for documentation
COMMENT ON TABLE ticker_info IS 'Basic information about stock tickers';
COMMENT ON TABLE market_data IS 'Current market data for tickers';
COMMENT ON TABLE reddit_posts IS 'Reddit posts from monitored subreddits';
COMMENT ON TABLE reddit_comments IS 'Comments on Reddit posts';
COMMENT ON TABLE ticker_mentions IS 'Individual ticker mentions found in Reddit content';
COMMENT ON TABLE sentiment_analyses IS 'Sentiment analysis results for ticker mentions';
COMMENT ON TABLE opportunity_scores IS 'Mathematical scoring results for ticker opportunities';
COMMENT ON TABLE risk_assessments IS 'Risk analysis results for ticker opportunities';
COMMENT ON TABLE ai_insights IS 'AI-generated analysis and insights';
COMMENT ON TABLE ticker_opportunities IS 'Main table for ticker opportunity analysis results';
COMMENT ON TABLE analysis_results IS 'Batch analysis run metadata and results';

COMMENT ON VIEW latest_ticker_opportunities IS 'Latest ticker opportunities with complete scoring data';
COMMENT ON VIEW top_opportunities IS 'Top-ranked ticker opportunities from recent analysis';
COMMENT ON VIEW reddit_activity_summary IS 'Summary of Reddit activity by ticker';
COMMENT ON MATERIALIZED VIEW daily_ticker_summary IS 'Daily aggregated ticker mention and sentiment data';
