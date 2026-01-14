-- ================================================
-- Migration 000: Create Signal Continuity Table
-- ================================================
-- Description: Creates the missing continuity tracking table
--              for signal lifecycle management.
-- Run this if you see: 'relation "unusual_options_signal_continuity" does not exist'
-- ================================================

-- Signal continuity tracking table
CREATE TABLE IF NOT EXISTS unusual_options_signal_continuity (
    -- Identity
    continuity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL,
    signal_group_id UUID NOT NULL,
    
    -- Detection Context
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_run_id UUID,  -- Optional: link to specific scan run
    
    -- Metrics at detection time
    current_volume INTEGER NOT NULL,
    current_oi INTEGER NOT NULL,
    premium_flow NUMERIC(12, 2),
    underlying_price NUMERIC(10, 2) NOT NULL,
    overall_score NUMERIC(4, 3) NOT NULL,
    grade TEXT NOT NULL,
    
    -- Changes since last detection
    volume_delta INTEGER,
    oi_delta INTEGER,
    premium_flow_delta NUMERIC(12, 2),
    score_delta NUMERIC(4, 3),
    grade_change TEXT,  -- 'UPGRADED', 'DOWNGRADED', 'UNCHANGED'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for continuity table
CREATE INDEX IF NOT EXISTS idx_continuity_signal_id 
    ON unusual_options_signal_continuity(signal_id);
CREATE INDEX IF NOT EXISTS idx_continuity_group_id 
    ON unusual_options_signal_continuity(signal_group_id);
CREATE INDEX IF NOT EXISTS idx_continuity_detected_at 
    ON unusual_options_signal_continuity(detected_at DESC);

-- Enable RLS
ALTER TABLE unusual_options_signal_continuity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read access to continuity" 
    ON unusual_options_signal_continuity
    FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert on continuity" 
    ON unusual_options_signal_continuity
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on continuity" 
    ON unusual_options_signal_continuity
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on continuity" 
    ON unusual_options_signal_continuity
    FOR DELETE
    USING (true);

-- ================================================
-- DONE
-- ================================================
-- After running this, re-run your scanner:
--   poetry run python scripts/cron_scanner.py --scan-all --min-grade B
