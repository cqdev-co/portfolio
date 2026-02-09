-- ============================================================================
-- MIGRATION: Add 'active' column to agent_watchlist
-- ============================================================================
-- Run this if you get: ERROR: column "active" does not exist
-- This happens when the table was created before the active column was added.
-- ============================================================================

-- Add the active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_watchlist' AND column_name = 'active'
    ) THEN
        ALTER TABLE agent_watchlist ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create the index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_agent_watchlist_active 
  ON agent_watchlist(active);

-- Recreate the view with the active column
CREATE OR REPLACE VIEW agent_watchlist_status AS
SELECT 
  w.id,
  w.ticker,
  w.target_rsi_low,
  w.target_rsi_high,
  w.target_iv_percentile,
  w.min_cushion_pct,
  w.min_grade,
  w.active,
  w.notes,
  w.added_at,
  (
    SELECT created_at 
    FROM agent_alerts a 
    WHERE a.ticker = w.ticker 
    ORDER BY created_at DESC 
    LIMIT 1
  ) AS last_alert_at,
  (
    SELECT COUNT(*) 
    FROM agent_alerts a 
    WHERE a.ticker = w.ticker 
    AND a.created_at > NOW() - INTERVAL '7 days'
  ) AS alerts_last_7d
FROM agent_watchlist w
WHERE w.active = TRUE
ORDER BY w.ticker;

-- Grant access
GRANT ALL ON agent_watchlist_status TO service_role;
