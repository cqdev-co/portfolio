-- ================================================
-- Reactivate Valid Signals
-- ================================================
-- Description: Finds and reactivates signals that were falsely
--              marked inactive due to the 3-hour rule bug
-- 
-- Run this AFTER applying fix_continuity_expiry_logic.sql
-- ================================================

-- Step 1: Identify falsely inactive signals
-- (inactive but option hasn't expired and was recently detected)
SELECT 
    'BEFORE REACTIVATION' as status,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_signals,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry >= CURRENT_DATE) as inactive_not_expired,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry < CURRENT_DATE) as inactive_expired
FROM unusual_options_signals;

-- Step 2: Show signals that will be reactivated
SELECT 
    ticker,
    option_symbol,
    grade,
    expiry,
    last_detected_at,
    (expiry - CURRENT_DATE) as days_to_expiry,
    detection_count
FROM unusual_options_signals
WHERE is_active = FALSE
    AND expiry >= CURRENT_DATE  -- Option not expired
    AND last_detected_at > NOW() - INTERVAL '7 days'  -- Recently detected
ORDER BY last_detected_at DESC;

-- Step 3: Reactivate the falsely inactive signals
UPDATE unusual_options_signals
SET 
    is_active = TRUE,
    updated_at = NOW()
WHERE is_active = FALSE
    AND expiry >= CURRENT_DATE  -- Option hasn't expired
    AND last_detected_at > NOW() - INTERVAL '7 days';  -- Recently detected

-- Step 4: Verify the fix
SELECT 
    'AFTER REACTIVATION' as status,
    COUNT(*) FILTER (WHERE is_active = TRUE) as active_signals,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry >= CURRENT_DATE) as inactive_not_expired,
    COUNT(*) FILTER (WHERE is_active = FALSE AND expiry < CURRENT_DATE) as inactive_expired
FROM unusual_options_signals;

-- Step 5: Show breakdown by ticker (top 10)
SELECT 
    ticker,
    COUNT(*) as reactivated_count,
    MIN(expiry) as earliest_expiry,
    MAX(expiry) as latest_expiry,
    MAX(detection_count) as max_detection_count
FROM unusual_options_signals
WHERE is_active = TRUE
    AND last_detected_at > NOW() - INTERVAL '7 days'
GROUP BY ticker
ORDER BY reactivated_count DESC
LIMIT 10;

-- ================================================
-- Expected Results:
-- ================================================
-- Before: inactive_not_expired > 0 (signals wrongly marked)
-- After:  inactive_not_expired = 0 (all fixed)
--
-- The active_signals count should increase by the number
-- of signals that were falsely marked inactive.
--
-- Example:
-- BEFORE:  active=633, inactive_not_expired=150
-- AFTER:   active=783, inactive_not_expired=0
-- ================================================

-- ================================================
-- Maintenance Query (Run Periodically)
-- ================================================
-- Check if any signals are incorrectly marked inactive
-- (Should always return 0 after fixes are applied)

SELECT 
    COUNT(*) as incorrectly_inactive,
    ARRAY_AGG(DISTINCT ticker) as affected_tickers
FROM unusual_options_signals
WHERE is_active = FALSE
    AND expiry >= CURRENT_DATE;

-- If this returns > 0, re-run the UPDATE statement above
-- ================================================

