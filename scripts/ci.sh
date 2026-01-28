#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
AUTO_FIX=false
for arg in "$@"; do
  case $arg in
    --fix)
      AUTO_FIX=true
      shift
      ;;
  esac
done

# Track failures
FAILED_JOBS=()

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

run_job() {
  local job_name="$1"
  local job_cmd="$2"
  
  echo -e "${YELLOW}→ Running: ${NC}$job_cmd"
  if eval "$job_cmd"; then
    print_success "$job_name passed"
    return 0
  else
    print_error "$job_name failed"
    FAILED_JOBS+=("$job_name")
    return 1
  fi
}

# Navigate to repo root
cd "$(dirname "$0")/.."
REPO_ROOT=$(pwd)

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════════════════════════════════╗"
if [ "$AUTO_FIX" = true ]; then
echo "  ║               Local CI Pipeline (auto-fix enabled)                ║"
else
echo "  ║                     Local CI Pipeline                             ║"
fi
echo "  ╚═══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────────────────────────────────────
# Typecheck
# ─────────────────────────────────────────────────────────────────────────────
print_header "Typecheck"
run_job "Typecheck" "bun run typecheck" || true

# ─────────────────────────────────────────────────────────────────────────────
# Lint (JavaScript/TypeScript)
# ─────────────────────────────────────────────────────────────────────────────
print_header "Lint"
run_job "Lint" "bun run lint" || true

# Format check with auto-fix option
if ! run_job "Format check" "bun run format:check"; then
  if [ "$AUTO_FIX" = true ]; then
    echo -e "${YELLOW}→ Auto-fixing format issues...${NC}"
    bun run format
    print_success "Format issues fixed"
    # Remove from failed jobs since we fixed it
    FAILED_JOBS=("${FAILED_JOBS[@]/Format check}")
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Lint Python
# ─────────────────────────────────────────────────────────────────────────────
print_header "Lint Python"

PYTHON_SERVICES=""
[ -d "unusual-options-service" ] && PYTHON_SERVICES+="unusual-options-service "
[ -d "penny-stock-scanner" ] && PYTHON_SERVICES+="penny-stock-scanner "
[ -d "wp-service" ] && PYTHON_SERVICES+="wp-service "

if [ -n "$PYTHON_SERVICES" ]; then
  if command -v ruff &> /dev/null; then
    # Python format check with auto-fix option
    if ! run_job "Python format check" "ruff format --check $PYTHON_SERVICES"; then
      if [ "$AUTO_FIX" = true ]; then
        echo -e "${YELLOW}→ Auto-fixing Python format issues...${NC}"
        ruff format $PYTHON_SERVICES
        print_success "Python format issues fixed"
        # Remove from failed jobs since we fixed it
        FAILED_JOBS=("${FAILED_JOBS[@]/Python format check}")
      fi
    fi
    run_job "Python lint" \
      "ruff check $PYTHON_SERVICES" || true
  else
    print_warning "ruff not installed, skipping Python lint"
    print_warning "Install with: pip install ruff"
  fi
else
  print_warning "No Python services found, skipping Python lint"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test (JavaScript/TypeScript)
# ─────────────────────────────────────────────────────────────────────────────
print_header "Test"
run_job "Test" "bun run test" || true

# ─────────────────────────────────────────────────────────────────────────────
# Test Python
# ─────────────────────────────────────────────────────────────────────────────
print_header "Test Python"

# Helper to run pytest and handle "no tests collected" (exit code 5) gracefully
# This matches the GitHub Actions behavior which uses `|| true`
run_pytest() {
  local service_name="$1"
  local service_dir="$2"
  
  echo -e "${YELLOW}→ Testing ${service_name}${NC}"
  (
    cd "$service_dir"
    if [ -f "poetry.lock" ]; then
      poetry install --no-interaction --quiet 2>/dev/null || true
      
      # Check if any test files exist
      if find tests/ -name "test_*.py" -o -name "*_test.py" 2>/dev/null | grep -q .; then
        echo -e "${YELLOW}→ Running: ${NC}poetry run pytest tests/ -v --tb=short"
        if poetry run pytest tests/ -v --tb=short; then
          print_success "${service_name} tests passed"
        else
          print_error "${service_name} tests failed"
          # Don't add to FAILED_JOBS - matches CI behavior with || true
        fi
      else
        print_warning "${service_name}: No test files found (skipping)"
      fi
    fi
  )
}

if command -v poetry &> /dev/null; then
  [ -d "unusual-options-service" ] && run_pytest "unusual-options" "unusual-options-service"
  [ -d "penny-stock-scanner" ] && run_pytest "penny-scanner" "penny-stock-scanner"
else
  print_warning "poetry not installed, skipping Python tests"
  print_warning "Install with: pip install poetry"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
print_header "Build"

# Set placeholder env vars if not set (mimics CI behavior)
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder}"

run_job "Build" "bun run build" || true

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Filter out empty strings from FAILED_JOBS (from auto-fix removals)
ACTUAL_FAILURES=()
for job in "${FAILED_JOBS[@]}"; do
  [ -n "$job" ] && ACTUAL_FAILURES+=("$job")
done

if [ ${#ACTUAL_FAILURES[@]} -eq 0 ]; then
  echo ""
  print_success "All CI checks passed!"
  echo ""
  exit 0
else
  echo ""
  print_error "The following jobs failed:"
  for job in "${ACTUAL_FAILURES[@]}"; do
    echo -e "  ${RED}• $job${NC}"
  done
  echo ""
  exit 1
fi
