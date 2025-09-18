-- Tickers Table Schema
-- This table stores all available stock tickers from global markets

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
    is_active BOOLEAN DEFAULT true,
    ticker_type VARCHAR(20) DEFAULT 'stock', -- stock, etf, crypto, forex, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_fetched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tickers_symbol ON tickers(symbol);
CREATE INDEX IF NOT EXISTS idx_tickers_exchange ON tickers(exchange);
CREATE INDEX IF NOT EXISTS idx_tickers_country ON tickers(country);
CREATE INDEX IF NOT EXISTS idx_tickers_sector ON tickers(sector);
CREATE INDEX IF NOT EXISTS idx_tickers_is_active ON tickers(is_active);
CREATE INDEX IF NOT EXISTS idx_tickers_ticker_type ON tickers(ticker_type);

-- Enable Row Level Security (RLS) if needed
ALTER TABLE tickers ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow read access to all users (adjust as needed)
CREATE POLICY "Allow read access to tickers" ON tickers
    FOR SELECT USING (true);

-- Create a policy to allow insert/update for service role only
CREATE POLICY "Allow insert/update for service role" ON tickers
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tickers_updated_at 
    BEFORE UPDATE ON tickers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();