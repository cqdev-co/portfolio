#!/usr/bin/env bash
# =============================================================================
# Database Migration Runner
# =============================================================================
#
# Simple migration runner for Supabase PostgreSQL.
# Tracks applied migrations in a _migrations table and runs
# new .sql files in lexicographic order.
#
# Usage:
#   ./db/migrate.sh                    # Run pending migrations
#   ./db/migrate.sh --status           # Show migration status
#   ./db/migrate.sh --dry-run          # Show what would be run
#   ./db/migrate.sh --new my_migration # Create a new migration file
#
# Requirements:
#   - SUPABASE_DB_URL environment variable (or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
#   - psql (PostgreSQL client)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure migrations directory exists
mkdir -p "${MIGRATIONS_DIR}"

# =============================================================================
# HELPERS
# =============================================================================

log_info()  { echo -e "${GREEN}[migrate]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[migrate]${NC} $*"; }
log_error() { echo -e "${RED}[migrate]${NC} $*" >&2; }

get_db_url() {
  if [ -n "${SUPABASE_DB_URL:-}" ]; then
    echo "${SUPABASE_DB_URL}"
    return
  fi

  # Try to construct from Supabase project URL
  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    # Extract project ref from URL (e.g., https://abc123.supabase.co -> abc123)
    local project_ref
    project_ref=$(echo "${NEXT_PUBLIC_SUPABASE_URL}" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
    echo "postgresql://postgres.${project_ref}:${SUPABASE_SERVICE_ROLE_KEY:-password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    return
  fi

  log_error "Set SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
  exit 1
}

# Create the _migrations tracking table if it doesn't exist
ensure_migrations_table() {
  local db_url="$1"
  psql "${db_url}" -q -c "
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  " 2>/dev/null || true
}

# Get list of already-applied migrations
get_applied_migrations() {
  local db_url="$1"
  psql "${db_url}" -t -A -c "SELECT name FROM _migrations ORDER BY name;" 2>/dev/null || echo ""
}

# Get list of pending migration files
get_pending_migrations() {
  local db_url="$1"
  local applied
  applied=$(get_applied_migrations "${db_url}")

  for file in "${MIGRATIONS_DIR}"/*.sql; do
    [ -f "${file}" ] || continue
    local name
    name=$(basename "${file}")
    if ! echo "${applied}" | grep -q "^${name}$"; then
      echo "${file}"
    fi
  done
}

# =============================================================================
# COMMANDS
# =============================================================================

cmd_status() {
  local db_url
  db_url=$(get_db_url)
  ensure_migrations_table "${db_url}"

  log_info "Migration status:"
  echo ""

  local applied
  applied=$(get_applied_migrations "${db_url}")

  for file in "${MIGRATIONS_DIR}"/*.sql; do
    [ -f "${file}" ] || continue
    local name
    name=$(basename "${file}")
    if echo "${applied}" | grep -q "^${name}$"; then
      echo -e "  ${GREEN}✓${NC} ${name}"
    else
      echo -e "  ${YELLOW}○${NC} ${name} (pending)"
    fi
  done
  echo ""
}

cmd_dry_run() {
  local db_url
  db_url=$(get_db_url)
  ensure_migrations_table "${db_url}"

  local pending
  pending=$(get_pending_migrations "${db_url}")

  if [ -z "${pending}" ]; then
    log_info "No pending migrations."
    return
  fi

  log_info "Pending migrations (dry run):"
  echo ""
  for file in ${pending}; do
    echo -e "  ${YELLOW}→${NC} $(basename "${file}")"
  done
  echo ""
}

cmd_run() {
  local db_url
  db_url=$(get_db_url)
  ensure_migrations_table "${db_url}"

  local pending
  pending=$(get_pending_migrations "${db_url}")

  if [ -z "${pending}" ]; then
    log_info "No pending migrations. Database is up to date."
    return
  fi

  for file in ${pending}; do
    local name
    name=$(basename "${file}")
    log_info "Running: ${name}..."

    if psql "${db_url}" -v ON_ERROR_STOP=1 -f "${file}"; then
      psql "${db_url}" -q -c "INSERT INTO _migrations (name) VALUES ('${name}');"
      log_info "  ✓ Applied: ${name}"
    else
      log_error "  ✗ Failed: ${name}"
      log_error "Migration stopped. Fix the issue and re-run."
      exit 1
    fi
  done

  echo ""
  log_info "All migrations applied successfully."
}

cmd_new() {
  local description="$1"
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local filename="${timestamp}_${description}.sql"
  local filepath="${MIGRATIONS_DIR}/${filename}"

  cat > "${filepath}" << EOF
-- Migration: ${description}
-- Created: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- =============================================================================

-- TODO: Add your migration SQL here

-- =============================================================================
-- ROLLBACK (keep commented for reference)
-- =============================================================================
-- DROP TABLE IF EXISTS ...;
EOF

  log_info "Created: db/migrations/${filename}"
}

# =============================================================================
# MAIN
# =============================================================================

case "${1:-run}" in
  --status|-s)
    cmd_status
    ;;
  --dry-run|-d)
    cmd_dry_run
    ;;
  --new|-n)
    if [ -z "${2:-}" ]; then
      log_error "Usage: ./db/migrate.sh --new <description>"
      exit 1
    fi
    cmd_new "$2"
    ;;
  run|"")
    cmd_run
    ;;
  *)
    echo "Usage: ./db/migrate.sh [--status|--dry-run|--new <name>|run]"
    exit 1
    ;;
esac
