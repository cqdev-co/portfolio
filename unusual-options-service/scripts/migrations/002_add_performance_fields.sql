-- ================================================
-- Migration 002: Add Performance Tracking Fields
-- ================================================
-- Description: Adds forward return and win tracking columns to main signals
--              table for direct outcome tracking without joining performance table.
-- Version: 0.3.1
-- Date: January 10, 2026
-- Part of: Phase 2 - Feedback Loop Implementation
-- ================================================

-- Add forward return columns to main signals table
-- These are duplicated from performance table for faster queries
ALTER TABLE public.unusual_options_signals
ADD COLUMN IF NOT EXISTS forward_return_1d NUMERIC(6, 4) NULL,
ADD COLUMN IF NOT EXISTS forward_return_5d NUMERIC(6, 4) NULL,
ADD COLUMN IF NOT EXISTS forward_return_30d NUMERIC(6, 4) NULL,
ADD COLUMN IF NOT EXISTS win BOOLEAN NULL;

-- Add index for win rate queries
CREATE INDEX IF NOT EXISTS idx_signals_win 
    ON public.unusual_options_signals (win);

-- Add index for classification + win queries (Phase 2 validation)
CREATE INDEX IF NOT EXISTS idx_signals_classification_win 
    ON public.unusual_options_signals (signal_classification, win);

-- Add composite index for performance analysis queries
CREATE INDEX IF NOT EXISTS idx_signals_type_classification_win 
    ON public.unusual_options_signals (option_type, signal_classification, win);

-- ================================================
-- Function: Get classification performance stats
-- ================================================
CREATE OR REPLACE FUNCTION get_classification_performance(
    p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
    classification TEXT,
    signal_count BIGINT,
    win_count BIGINT,
    win_rate NUMERIC,
    avg_return_5d NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.signal_classification as classification,
        COUNT(*) as signal_count,
        SUM(CASE WHEN s.win THEN 1 ELSE 0 END)::BIGINT as win_count,
        ROUND(
            SUM(CASE WHEN s.win THEN 1 ELSE 0 END)::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 
            1
        ) as win_rate,
        ROUND(AVG(s.forward_return_5d) * 100, 2) as avg_return_5d
    FROM unusual_options_signals s
    WHERE 
        s.detection_timestamp > NOW() - (p_days_back || ' days')::INTERVAL
        AND s.win IS NOT NULL
    GROUP BY s.signal_classification
    ORDER BY win_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Function: Validate classification predictions
-- ================================================
CREATE OR REPLACE FUNCTION validate_classification_predictions(
    p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
    classification TEXT,
    predicted_win_rate NUMERIC,
    actual_win_rate NUMERIC,
    prediction_error NUMERIC,
    signal_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.signal_classification as classification,
        ROUND(AVG(s.predicted_win_rate) * 100, 1) as predicted_win_rate,
        ROUND(
            SUM(CASE WHEN s.win THEN 1 ELSE 0 END)::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 
            1
        ) as actual_win_rate,
        ROUND(
            SUM(CASE WHEN s.win THEN 1 ELSE 0 END)::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100 - 
            AVG(s.predicted_win_rate) * 100,
            1
        ) as prediction_error,
        COUNT(*) as signal_count
    FROM unusual_options_signals s
    WHERE 
        s.detection_timestamp > NOW() - (p_days_back || ' days')::INTERVAL
        AND s.win IS NOT NULL
        AND s.predicted_win_rate IS NOT NULL
    GROUP BY s.signal_classification
    ORDER BY ABS(
        SUM(CASE WHEN s.win THEN 1 ELSE 0 END)::NUMERIC / 
        NULLIF(COUNT(*), 0) - 
        AVG(s.predicted_win_rate)
    ) ASC;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- NOTES
-- ================================================
-- 
-- Run this migration after 001_add_classification_fields.sql
-- 
-- Usage:
--   -- Get classification performance (last 30 days)
--   SELECT * FROM get_classification_performance(30);
--
--   -- Validate predictions (last 60 days)  
--   SELECT * FROM validate_classification_predictions(60);
--
-- The classification_validator.py script will:
--   1. Fetch signals without win data
--   2. Calculate forward returns from market data
--   3. Update signals with actual outcomes
--   4. Compare predicted vs actual win rates
--
