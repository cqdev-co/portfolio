-- ================================================
-- Migration: Add RLS Policies for Unusual Options Tables
-- ================================================
-- Description: Enable Row Level Security and create policies
--              to allow frontend read access to unusual options signals
-- Version: 1.0
-- Created: November 5, 2025
-- ================================================

-- Enable RLS on unusual options tables
ALTER TABLE unusual_options_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE unusual_options_signal_continuity ENABLE ROW LEVEL SECURITY;
ALTER TABLE unusual_options_signal_performance ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access and authenticated write access

-- Signals table: Allow read for everyone, write for authenticated users
CREATE POLICY "Allow public read access to signals" 
    ON unusual_options_signals
    FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert on signals" 
    ON unusual_options_signals
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on signals" 
    ON unusual_options_signals
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on signals" 
    ON unusual_options_signals
    FOR DELETE
    USING (true);

-- Continuity table: Allow read for everyone, write for authenticated users
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

-- Performance table: Allow read for everyone, write for authenticated users  
CREATE POLICY "Allow public read access to performance" 
    ON unusual_options_signal_performance
    FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated insert on performance" 
    ON unusual_options_signal_performance
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on performance" 
    ON unusual_options_signal_performance
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on performance" 
    ON unusual_options_signal_performance
    FOR DELETE
    USING (true);

-- ================================================
-- VERIFICATION
-- ================================================
-- Run these queries to verify policies are active:
--
-- Check if RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename LIKE 'unusual_options%';
--
-- List all policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename LIKE 'unusual_options%'
-- ORDER BY tablename, policyname;
--
-- Test frontend read access (should return data):
-- SELECT COUNT(*) FROM unusual_options_signals WHERE is_active = true;
-- ================================================

