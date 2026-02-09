-- Grant table-level permissions for Supabase roles
-- RLS policies handle row-level access; these grants handle table-level access.

-- Public/anonymous read access (for dashboard queries)
GRANT SELECT ON signals TO anon;
GRANT SELECT ON signals TO authenticated;

-- Service role full access (for engine dual-writes)
GRANT ALL ON signals TO service_role;
