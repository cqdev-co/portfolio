-- Fix Signal Efficiency: Add unique constraint and clean up duplicates
-- This script addresses the database efficiency issue where continuing signals
-- create multiple rows instead of updating a single row.

-- Step 1: Add unique constraint to prevent future duplicates
-- This will make the upsert operation work correctly
ALTER TABLE volatility_squeeze_signals 
ADD CONSTRAINT unique_symbol_scan_date 
UNIQUE (symbol, scan_date);

-- Note: If there are existing duplicates, the above will fail.
-- In that case, we need to clean up duplicates first.

-- Step 2: Clean up existing duplicates (keep the most recent record for each symbol+date)
-- This query identifies duplicates and keeps only the latest one based on updated_at
WITH duplicate_signals AS (
    SELECT 
        symbol,
        scan_date,
        COUNT(*) as duplicate_count,
        MAX(updated_at) as latest_updated_at
    FROM volatility_squeeze_signals
    GROUP BY symbol, scan_date
    HAVING COUNT(*) > 1
),
signals_to_keep AS (
    SELECT s.id
    FROM volatility_squeeze_signals s
    INNER JOIN duplicate_signals d ON s.symbol = d.symbol AND s.scan_date = d.scan_date
    WHERE s.updated_at = d.latest_updated_at
),
signals_to_delete AS (
    SELECT s.id
    FROM volatility_squeeze_signals s
    INNER JOIN duplicate_signals d ON s.symbol = d.symbol AND s.scan_date = d.scan_date
    WHERE s.id NOT IN (SELECT id FROM signals_to_keep)
)
-- Show what would be deleted (for verification)
SELECT 
    s.symbol,
    s.scan_date,
    s.signal_status,
    s.days_in_squeeze,
    s.created_at,
    s.updated_at,
    'TO_DELETE' as action
FROM volatility_squeeze_signals s
INNER JOIN signals_to_delete std ON s.id = std.id
ORDER BY s.symbol, s.scan_date, s.updated_at;

-- Step 3: Actually delete the duplicates (uncomment when ready)
/*
WITH duplicate_signals AS (
    SELECT 
        symbol,
        scan_date,
        COUNT(*) as duplicate_count,
        MAX(updated_at) as latest_updated_at
    FROM volatility_squeeze_signals
    GROUP BY symbol, scan_date
    HAVING COUNT(*) > 1
),
signals_to_keep AS (
    SELECT s.id
    FROM volatility_squeeze_signals s
    INNER JOIN duplicate_signals d ON s.symbol = d.symbol AND s.scan_date = d.scan_date
    WHERE s.updated_at = d.latest_updated_at
),
signals_to_delete AS (
    SELECT s.id
    FROM volatility_squeeze_signals s
    INNER JOIN duplicate_signals d ON s.symbol = d.symbol AND s.scan_date = d.scan_date
    WHERE s.id NOT IN (SELECT id FROM signals_to_keep)
)
DELETE FROM volatility_squeeze_signals
WHERE id IN (SELECT id FROM signals_to_delete);
*/

-- Step 4: Verify the cleanup
SELECT 
    'After cleanup' as status,
    COUNT(*) as total_signals,
    COUNT(DISTINCT CONCAT(symbol, '|', scan_date)) as unique_symbol_dates,
    COUNT(*) - COUNT(DISTINCT CONCAT(symbol, '|', scan_date)) as remaining_duplicates
FROM volatility_squeeze_signals;

-- Step 5: Show current KLG situation for verification
SELECT 
    symbol,
    scan_date,
    signal_status,
    days_in_squeeze,
    first_detected_date,
    last_active_date,
    created_at,
    updated_at
FROM volatility_squeeze_signals 
WHERE symbol = 'KLG' 
ORDER BY scan_date DESC, updated_at DESC;
