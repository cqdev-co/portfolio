-- ================================================
-- Unusual Options - Spread Detection Migration
-- ================================================
-- Description: Adds spread detection fields to existing schema
-- Version: 1.3.0
-- Created: 2025-11-04
-- Phase: Conservative (High-confidence detection only ≥80%)
-- ================================================

-- Add spread detection columns to main signals table
ALTER TABLE unusual_options_signals
    ADD COLUMN IF NOT EXISTS is_likely_spread BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS spread_confidence NUMERIC(4, 3) 
        CHECK (spread_confidence >= 0 AND spread_confidence <= 1),
    ADD COLUMN IF NOT EXISTS spread_type TEXT 
        CHECK (spread_type IN (
            'VERTICAL_CALL_SPREAD', 
            'VERTICAL_PUT_SPREAD',
            'CALENDAR_SPREAD',
            'IRON_CONDOR',
            'STRADDLE',
            'STRANGLE',
            'POSSIBLE_SPREAD'
        )),
    ADD COLUMN IF NOT EXISTS matched_leg_symbols TEXT[],
    ADD COLUMN IF NOT EXISTS spread_strike_width NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS spread_detection_reason TEXT,
    ADD COLUMN IF NOT EXISTS spread_net_premium NUMERIC(12, 2);

-- Add index for spread filtering
CREATE INDEX IF NOT EXISTS idx_signals_is_spread 
    ON unusual_options_signals(is_likely_spread);

CREATE INDEX IF NOT EXISTS idx_signals_spread_confidence 
    ON unusual_options_signals(spread_confidence DESC) 
    WHERE spread_confidence IS NOT NULL;

-- Add comment to document usage
COMMENT ON COLUMN unusual_options_signals.is_likely_spread IS 
    'TRUE if signal is part of a detected spread pattern (≥80% confidence)';

COMMENT ON COLUMN unusual_options_signals.spread_confidence IS 
    'Confidence score for spread detection (0.0-1.0). Only set when ≥60%';

COMMENT ON COLUMN unusual_options_signals.spread_type IS 
    'Type of spread detected (VERTICAL, CALENDAR, etc.)';

COMMENT ON COLUMN unusual_options_signals.matched_leg_symbols IS 
    'Array of matching contract symbols that form the spread';

COMMENT ON COLUMN unusual_options_signals.spread_detection_reason IS 
    'Human-readable explanation of why this was flagged as spread';

-- ================================================
-- VALIDATION QUERIES
-- ================================================

-- Check spread detection stats
SELECT 
    'Total Signals' as metric,
    COUNT(*) as count
FROM unusual_options_signals
UNION ALL
SELECT 
    'Likely Spreads (≥80%)' as metric,
    COUNT(*) as count
FROM unusual_options_signals
WHERE is_likely_spread = TRUE
UNION ALL
SELECT 
    'Possible Spreads (60-79%)' as metric,
    COUNT(*) as count
FROM unusual_options_signals
WHERE spread_confidence >= 0.60 AND is_likely_spread = FALSE
UNION ALL
SELECT 
    'Directional Signals' as metric,
    COUNT(*) as count
FROM unusual_options_signals
WHERE spread_confidence IS NULL OR spread_confidence < 0.60
ORDER BY 
    CASE metric
        WHEN 'Total Signals' THEN 1
        WHEN 'Likely Spreads (≥80%)' THEN 2
        WHEN 'Possible Spreads (60-79%)' THEN 3
        WHEN 'Directional Signals' THEN 4
    END;

-- Show example spreads by type
SELECT 
    spread_type,
    COUNT(*) as count,
    AVG(spread_confidence)::NUMERIC(4,3) as avg_confidence,
    AVG(premium_flow)::NUMERIC(12,0) as avg_premium
FROM unusual_options_signals
WHERE is_likely_spread = TRUE
GROUP BY spread_type
ORDER BY count DESC;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================

