-- Migration: Add Signal Classification Fields
-- Date: January 2026
-- Description: Adds data-driven classification system to replace unreliable grade system
--
-- Classification values:
-- - high_conviction: PUT signals with favorable setup (~60% win rate)
-- - moderate: PUT signals with less favorable setup (~40% win rate)  
-- - informational: Unusual activity but direction unclear (~25% win rate)
-- - likely_hedge: Institutional hedging activity (not directional)
-- - contrarian: CALL signals (~9% win rate - consider fading)
-- - unclassified: Not yet classified

-- Add new classification columns to unusual_options_signals table
ALTER TABLE unusual_options_signals
ADD COLUMN IF NOT EXISTS signal_classification TEXT DEFAULT 'unclassified',
ADD COLUMN IF NOT EXISTS classification_reason TEXT,
ADD COLUMN IF NOT EXISTS predicted_win_rate FLOAT,
ADD COLUMN IF NOT EXISTS classification_factors JSONB;

-- Create index for filtering by classification
CREATE INDEX IF NOT EXISTS idx_signal_classification 
ON unusual_options_signals(signal_classification);

-- Create index for filtering high conviction signals
CREATE INDEX IF NOT EXISTS idx_high_conviction_signals
ON unusual_options_signals(signal_classification, detection_timestamp DESC)
WHERE signal_classification = 'high_conviction';

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_classification_date
ON unusual_options_signals(signal_classification, detection_timestamp DESC, ticker);

-- Add comment explaining the classification system
COMMENT ON COLUMN unusual_options_signals.signal_classification IS 
'Data-driven classification based on Jan 2026 analysis: high_conviction (60% win), moderate (40%), informational (25%), likely_hedge (N/A), contrarian (9%)';

COMMENT ON COLUMN unusual_options_signals.classification_reason IS 
'Human-readable explanation of why the signal received this classification';

COMMENT ON COLUMN unusual_options_signals.predicted_win_rate IS 
'Historical win rate for this classification type (0.0-1.0)';

COMMENT ON COLUMN unusual_options_signals.classification_factors IS 
'JSON array of factors that contributed to this classification';
