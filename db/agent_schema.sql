-- ============================================================================
-- AI ANALYST AGENT - AGENTIC SYSTEM SCHEMA
-- ============================================================================
-- 
-- Tables for the Agentic Victor system:
-- - watchlist: User's monitored tickers with custom thresholds
-- - alerts: Triggered alerts history
-- - scan_history: Scan analytics and deduplication
-- - briefings: Morning briefings archive
-- - config: System configuration
--
-- Run this in Supabase SQL Editor to set up the tables.
-- ============================================================================

-- ============================================================================
-- WATCHLIST
-- ============================================================================
-- User's list of tickers to monitor for opportunities

CREATE TABLE IF NOT EXISTS agent_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ticker identification
  ticker VARCHAR(10) NOT NULL UNIQUE,
  
  -- Custom thresholds (override defaults)
  target_rsi_low DECIMAL(5, 2) DEFAULT 35,
  target_rsi_high DECIMAL(5, 2) DEFAULT 55,
  target_iv_percentile DECIMAL(5, 2) DEFAULT 50,
  min_cushion_pct DECIMAL(5, 2) DEFAULT 8,
  min_grade VARCHAR(2) DEFAULT 'B',
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_watchlist_ticker 
  ON agent_watchlist(ticker);
CREATE INDEX IF NOT EXISTS idx_agent_watchlist_active 
  ON agent_watchlist(active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_watchlist_updated_at
  BEFORE UPDATE ON agent_watchlist
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_watchlist_updated_at();

-- ============================================================================
-- ALERTS
-- ============================================================================
-- History of all triggered alerts

CREATE TABLE IF NOT EXISTS agent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert identification
  ticker VARCHAR(10) NOT NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'ENTRY_SIGNAL',      -- Grade A/B opportunity detected
    'EXIT_SIGNAL',       -- Time to close position
    'POSITION_RISK',     -- Risk warning (DTE, cushion, etc.)
    'EARNINGS_WARNING',  -- Earnings approaching
    'NEWS_EVENT',        -- Material news detected
    'MACRO_EVENT'        -- Fed, CPI, etc. impact
  )),
  
  -- Priority
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  
  -- Content
  headline TEXT NOT NULL,
  analysis TEXT,
  
  -- Full data snapshot
  data JSONB DEFAULT '{}',
  -- Contains: price, rsi, grade, spread recommendation, cushion, etc.
  
  -- AI review (if enabled)
  ai_conviction INTEGER CHECK (ai_conviction >= 1 AND ai_conviction <= 10),
  ai_reasoning TEXT,
  
  -- Status
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_alerts_ticker 
  ON agent_alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_type 
  ON agent_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_priority 
  ON agent_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_created 
  ON agent_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_alerts_acknowledged 
  ON agent_alerts(acknowledged);

-- ============================================================================
-- SCAN HISTORY
-- ============================================================================
-- Track all scans for analytics and alert deduplication

CREATE TABLE IF NOT EXISTS agent_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scan type
  scan_type VARCHAR(50) NOT NULL CHECK (scan_type IN (
    'WATCHLIST',      -- Scan user's watchlist
    'FULL_MARKET',    -- Full market scan
    'POSITION_CHECK', -- Check open positions
    'BRIEFING'        -- Morning briefing scan
  )),
  
  -- Results
  tickers_scanned INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  alerts_triggered INTEGER DEFAULT 0,
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Errors
  errors JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_scan_history_type 
  ON agent_scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_agent_scan_history_created 
  ON agent_scan_history(created_at DESC);

-- ============================================================================
-- BRIEFINGS
-- ============================================================================
-- Archive of morning briefings

CREATE TABLE IF NOT EXISTS agent_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Date (unique per day)
  date DATE UNIQUE NOT NULL,
  
  -- Market data
  market_summary TEXT,
  market_data JSONB DEFAULT '{}',
  -- Contains: spy, vix, regime, sectors
  
  -- Alerts and updates
  watchlist_alerts JSONB DEFAULT '[]',
  position_updates JSONB DEFAULT '[]',
  calendar_events JSONB DEFAULT '[]',
  
  -- AI commentary
  ai_commentary TEXT,
  
  -- Delivery status
  delivered_discord BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_briefings_date 
  ON agent_briefings(date DESC);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================
-- System configuration key-value store

CREATE TABLE IF NOT EXISTS agent_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_config_updated_at();

-- Insert default configuration
INSERT INTO agent_config (key, value, description) VALUES
  ('scan_interval_ms', '1800000', 'Scan interval in milliseconds (default: 30 min)'),
  ('briefing_time', '"09:00"', 'Morning briefing time in ET (HH:MM format)'),
  ('alert_cooldown_ms', '7200000', 'Cooldown between alerts for same ticker (default: 2 hours)'),
  ('discord_enabled', 'true', 'Enable Discord notifications'),
  ('ai_review_enabled', 'true', 'Enable AI review before sending alerts'),
  ('min_conviction', '6', 'Minimum AI conviction score to send alert (1-10)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- ALERT COOLDOWN TRACKING
-- ============================================================================
-- Track last alert time per ticker to prevent spam

CREATE TABLE IF NOT EXISTS agent_alert_cooldowns (
  ticker VARCHAR(10) PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  last_alert_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_alert_cooldowns_time 
  ON agent_alert_cooldowns(last_alert_at);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active watchlist with recent alert status
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

-- Recent alerts summary
CREATE OR REPLACE VIEW agent_recent_alerts AS
SELECT 
  id,
  ticker,
  alert_type,
  priority,
  headline,
  ai_conviction,
  acknowledged,
  created_at
FROM agent_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Daily scan statistics
CREATE OR REPLACE VIEW agent_scan_stats AS
SELECT 
  DATE(created_at) AS date,
  scan_type,
  COUNT(*) AS scan_count,
  SUM(tickers_scanned) AS total_tickers_scanned,
  SUM(opportunities_found) AS total_opportunities,
  SUM(alerts_triggered) AS total_alerts,
  AVG(execution_time_ms)::INTEGER AS avg_execution_ms
FROM agent_scan_history
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), scan_type
ORDER BY date DESC, scan_type;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agent_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_alert_cooldowns ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (single user system)
CREATE POLICY "Allow all for authenticated users" ON agent_watchlist
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON agent_alerts
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON agent_scan_history
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON agent_briefings
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON agent_config
  FOR ALL USING (true);

CREATE POLICY "Allow all for authenticated users" ON agent_alert_cooldowns
  FOR ALL USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON agent_watchlist TO service_role;
GRANT ALL ON agent_alerts TO service_role;
GRANT ALL ON agent_scan_history TO service_role;
GRANT ALL ON agent_briefings TO service_role;
GRANT ALL ON agent_config TO service_role;
GRANT ALL ON agent_alert_cooldowns TO service_role;
GRANT ALL ON agent_watchlist_status TO service_role;
GRANT ALL ON agent_recent_alerts TO service_role;
GRANT ALL ON agent_scan_stats TO service_role;

