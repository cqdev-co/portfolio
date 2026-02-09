-- =============================================================================
-- PCS (Put Credit Spread) Signal Tables
-- =============================================================================
-- Creates tables for PCS engine signal storage and trade tracking.
-- Mirrors CDS signal tables but with credit-specific fields.
-- =============================================================================

-- PCS signals (scan results)
CREATE TABLE IF NOT EXISTS pcs_signals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    technical_score NUMERIC(5, 1) DEFAULT 0,
    fundamental_score NUMERIC(5, 1) DEFAULT 0,
    analyst_score NUMERIC(5, 1) DEFAULT 0,
    iv_score NUMERIC(5, 1) DEFAULT 0,
    total_score NUMERIC(5, 1) DEFAULT 0,
    iv_rank NUMERIC(5, 1),
    upside_potential NUMERIC(8, 2) DEFAULT 0,
    signals JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    sector TEXT,
    industry TEXT,
    scan_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Dedupe: one record per ticker per scan date
    CONSTRAINT pcs_signals_ticker_date_unique UNIQUE (ticker, scan_date)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_pcs_signals_ticker ON pcs_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_pcs_signals_scan_date ON pcs_signals(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_signals_total_score ON pcs_signals(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_pcs_signals_iv_rank ON pcs_signals(iv_rank DESC);

-- PCS signal outcomes (trade tracking)
CREATE TABLE IF NOT EXISTS pcs_signal_outcomes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker TEXT NOT NULL,
    short_strike NUMERIC(10, 2) NOT NULL,
    long_strike NUMERIC(10, 2) NOT NULL,
    expiration DATE NOT NULL,
    entry_credit NUMERIC(10, 4) NOT NULL,
    contracts INTEGER DEFAULT 1,
    entry_date DATE NOT NULL,
    exit_date DATE,
    exit_debit NUMERIC(10, 4),
    exit_reason TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired', 'rolled')),
    iv_rank_at_entry NUMERIC(5, 1),
    total_score_at_entry NUMERIC(5, 1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trade queries
CREATE INDEX IF NOT EXISTS idx_pcs_outcomes_ticker ON pcs_signal_outcomes(ticker);
CREATE INDEX IF NOT EXISTS idx_pcs_outcomes_status ON pcs_signal_outcomes(status);
CREATE INDEX IF NOT EXISTS idx_pcs_outcomes_entry_date ON pcs_signal_outcomes(entry_date DESC);

-- PCS signal performance view (joins signals + outcomes)
CREATE OR REPLACE VIEW pcs_signal_performance AS
SELECT
    o.id,
    o.ticker,
    o.short_strike,
    o.long_strike,
    o.expiration,
    o.entry_credit,
    o.exit_debit,
    o.contracts,
    o.entry_date,
    o.exit_date,
    o.exit_reason,
    o.status,
    o.iv_rank_at_entry,
    o.total_score_at_entry,
    -- Calculated P&L fields
    CASE
        WHEN o.status = 'closed' AND o.exit_debit IS NOT NULL
        THEN (o.entry_credit - o.exit_debit) * o.contracts * 100
        ELSE NULL
    END AS pnl_dollars,
    CASE
        WHEN o.status = 'closed' AND o.exit_debit IS NOT NULL AND o.entry_credit > 0
        THEN ((o.entry_credit - o.exit_debit) / o.entry_credit) * 100
        ELSE NULL
    END AS pnl_percent,
    -- Spread width
    (o.short_strike - o.long_strike) AS width,
    -- Credit ratio
    CASE
        WHEN (o.short_strike - o.long_strike) > 0
        THEN (o.entry_credit / (o.short_strike - o.long_strike)) * 100
        ELSE NULL
    END AS credit_ratio_pct,
    -- Days held
    CASE
        WHEN o.exit_date IS NOT NULL
        THEN o.exit_date - o.entry_date
        ELSE CURRENT_DATE - o.entry_date
    END AS days_held,
    -- Latest signal data
    s.technical_score,
    s.fundamental_score,
    s.analyst_score,
    s.iv_score
FROM pcs_signal_outcomes o
LEFT JOIN LATERAL (
    SELECT *
    FROM pcs_signals
    WHERE pcs_signals.ticker = o.ticker
    ORDER BY scan_date DESC
    LIMIT 1
) s ON true
ORDER BY o.entry_date DESC;

-- Enable RLS (if using Supabase auth)
ALTER TABLE pcs_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pcs_signal_outcomes ENABLE ROW LEVEL SECURITY;

-- Public read policies (adjust for your auth model)
CREATE POLICY IF NOT EXISTS "Allow public read pcs_signals"
    ON pcs_signals FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert pcs_signals"
    ON pcs_signals FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update pcs_signals"
    ON pcs_signals FOR UPDATE USING (true);

CREATE POLICY IF NOT EXISTS "Allow public read pcs_signal_outcomes"
    ON pcs_signal_outcomes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Allow public insert pcs_signal_outcomes"
    ON pcs_signal_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow public update pcs_signal_outcomes"
    ON pcs_signal_outcomes FOR UPDATE USING (true);
