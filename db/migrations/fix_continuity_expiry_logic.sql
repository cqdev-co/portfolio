-- ================================================
-- Migration: Fix Continuity Tracking Expiry Logic
-- ================================================
-- Description: Updates mark_stale_signals_inactive() to only mark
--              signals as inactive when option contracts expire,
--              not based on time since last detection
-- Version: 1.0
-- Created: November 5, 2025
-- ================================================

-- Drop and recreate the function with corrected logic
CREATE OR REPLACE FUNCTION mark_stale_signals_inactive(
    p_hours_threshold INTEGER DEFAULT 3  -- Kept for backwards compatibility but unused
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark signals as inactive only when the option contract has expired
    UPDATE unusual_options_signals
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE is_active = TRUE
        AND expiry < CURRENT_DATE;  -- Option has expired
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- VERIFICATION
-- ================================================
-- Run this query to verify active signals are not being marked inactive incorrectly:
--
-- SELECT 
--     COUNT(*) as active_signals,
--     COUNT(*) FILTER (WHERE expiry < CURRENT_DATE) as should_be_inactive,
--     COUNT(*) FILTER (WHERE expiry >= CURRENT_DATE) as should_remain_active
-- FROM unusual_options_signals
-- WHERE is_active = TRUE;
--
-- After running the function, all should_be_inactive signals will be marked inactive
-- while should_remain_active signals will stay active regardless of last_detected_at
-- ================================================

-- Optionally reactivate any signals that were incorrectly marked inactive
-- (signals that expired in the future but were marked inactive due to 3-hour rule)
UPDATE unusual_options_signals
SET is_active = TRUE,
    updated_at = NOW()
WHERE is_active = FALSE
    AND expiry >= CURRENT_DATE
    AND last_detected_at > NOW() - INTERVAL '24 hours';

-- Show summary of changes
SELECT 
    'Migration Complete' as status,
    COUNT(*) FILTER (WHERE is_active = TRUE AND expiry >= CURRENT_DATE) as active_valid,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry < CURRENT_DATE) as inactive_expired,
    COUNT(*) FILTER (WHERE is_active = TRUE AND expiry < CURRENT_DATE) as needs_cleanup,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry >= CURRENT_DATE) as incorrectly_inactive
FROM unusual_options_signals;

