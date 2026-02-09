-- Drop unused views, tables, and materialized views
-- All 5 objects have zero application code references.

-- Views (must drop before their underlying tables)
DROP VIEW IF EXISTS signal_leaderboard;
DROP VIEW IF EXISTS performance_dashboard;

-- Materialized view
DROP MATERIALIZED VIEW IF EXISTS stock_score_trends;

-- Tables
DROP TABLE IF EXISTS daily_performance_snapshots;
DROP TABLE IF EXISTS signal_performance;
