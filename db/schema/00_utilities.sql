-- ============================================================================
-- SHARED UTILITY FUNCTIONS
-- ============================================================================
-- Reusable trigger functions referenced by all other schema files.
-- Run this FIRST before any other schema file.
-- ============================================================================

-- Generic updated_at trigger function (used by all tables with updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
