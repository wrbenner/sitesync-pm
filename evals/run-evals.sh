#!/usr/bin/env bash
# =============================================================================
# SiteSync PM — Eval Harness Runner
# =============================================================================
# Runs all eval layers and reports results.
#
# Usage:
#   ./run-evals.sh              # Run all layers (1+2 active, 3+4 skipped)
#   ./run-evals.sh --layer 1    # Run only Layer 1
#   ./run-evals.sh --layer 2    # Run only Layer 2
#   ./run-evals.sh --dry-run    # Validate config without running tests
#
# Exit codes:
#   0 — All executed tests passed
#   1 — One or more tests failed
#   2 — Configuration error
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No color
BOLD='\033[1m'

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

L1_PASSED=0; L1_FAILED=0; L1_SKIPPED=0
L2_PASSED=0; L2_FAILED=0; L2_SKIPPED=0
L3_PASSED=0; L3_FAILED=0; L3_SKIPPED=0
L4_PASSED=0; L4_FAILED=0; L4_SKIPPED=0

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
TARGET_LAYER=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --layer)
      TARGET_LAYER="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--layer N] [--dry-run]"
      echo "  --layer N    Run only layer N (1, 2, 3, or 4)"
      echo "  --dry-run    Validate config without executing tests"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Config validation
# ---------------------------------------------------------------------------
echo -e "${BOLD}=== SiteSync PM Eval Harness ===${NC}"
echo ""

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo -e "${RED}ERROR: config.json not found.${NC}"
  echo "  1. Copy the example:  cp config.example.json config.json"
  echo "  2. Fill in your test environment values (or set environment variables)."
  exit 2
fi

# Resolve env vars in config
resolve_config_value() {
  local val
  val=$(python3 -c "
import json, os, sys
config = json.load(open('$CONFIG_FILE'))
keys = '$1'.split('.')
v = config
for k in keys:
    v = v[k]
if v.startswith('\$'):
    v = os.environ.get(v[1:], '')
print(v)
" 2>/dev/null || echo "")
  echo "$val"
}

DB_URL=$(resolve_config_value "supabase.db_url")
SUPA_URL=$(resolve_config_value "supabase.url")
SUPA_KEY=$(resolve_config_value "supabase.anon_key")

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${CYAN}Dry run — validating configuration...${NC}"
  echo ""
  [[ -n "$DB_URL" ]]  && echo -e "  supabase.db_url:  ${GREEN}set${NC}" || echo -e "  supabase.db_url:  ${RED}missing${NC}"
  [[ -n "$SUPA_URL" ]] && echo -e "  supabase.url:     ${GREEN}set${NC}" || echo -e "  supabase.url:     ${RED}missing${NC}"
  [[ -n "$SUPA_KEY" ]] && echo -e "  supabase.anon_key:${GREEN}set${NC}" || echo -e "  supabase.anon_key:${RED}missing${NC}"
  echo ""
  echo "Config validation complete. No tests executed."
  exit 0
fi

# ---------------------------------------------------------------------------
# Helper: count PASS/FAIL/SKIP from test output
# ---------------------------------------------------------------------------
count_results() {
  local output="$1"
  local pass_count fail_count skip_count
  pass_count=$(echo "$output" | grep -c "^PASS " || true)
  fail_count=$(echo "$output" | grep -c "^FAIL " || true)
  skip_count=$(echo "$output" | grep -c "^SKIP " || true)
  echo "$pass_count $fail_count $skip_count"
}

# ---------------------------------------------------------------------------
# Layer 1: Database Tests
# ---------------------------------------------------------------------------
run_layer1() {
  echo -e "${BOLD}── Layer 1: Database / RLS Tests ──${NC}"

  if [[ -z "$DB_URL" ]]; then
    echo -e "${YELLOW}  SKIP: No database URL configured${NC}"
    L1_SKIPPED=6
    return
  fi

  # Run setup
  echo -e "  ${CYAN}Running setup.sql...${NC}"
  if ! psql "$DB_URL" -f "$SCRIPT_DIR/layer1-database/setup.sql" > /dev/null 2>&1; then
    echo -e "  ${YELLOW}WARNING: setup.sql had errors (some tables may not exist yet)${NC}"
  fi

  # Run each test file
  local test_files=(
    "test_tenant_isolation.sql"
    "test_permission_boundary.sql"
    "test_scope_enforcement.sql"
    "test_referential_integrity.sql"
    "test_soft_delete.sql"
    "test_state_machine.sql"
  )

  for test_file in "${test_files[@]}"; do
    local filepath="$SCRIPT_DIR/layer1-database/$test_file"
    if [[ ! -f "$filepath" ]]; then
      echo -e "  ${RED}Missing: $test_file${NC}"
      ((L1_FAILED++))
      continue
    fi

    echo -e "  ${CYAN}Running $test_file...${NC}"
    local output
    output=$(psql "$DB_URL" -f "$filepath" 2>&1) || true

    # Parse PASS/FAIL/SKIP from RAISE NOTICE output
    local p f s
    p=$(echo "$output" | grep -c "PASS \[" || true)
    f=$(echo "$output" | grep -c "FAIL \[" || true)
    s=$(echo "$output" | grep -c "SKIP \[" || true)

    # Print individual results
    echo "$output" | grep -E "^(NOTICE:|psql:)" | sed 's/NOTICE:  /  /' | while read -r line; do
      if echo "$line" | grep -q "PASS"; then
        echo -e "  ${GREEN}$line${NC}"
      elif echo "$line" | grep -q "FAIL"; then
        echo -e "  ${RED}$line${NC}"
      elif echo "$line" | grep -q "SKIP"; then
        echo -e "  ${YELLOW}$line${NC}"
      fi
    done

    L1_PASSED=$((L1_PASSED + p))
    L1_FAILED=$((L1_FAILED + f))
    L1_SKIPPED=$((L1_SKIPPED + s))
  done

  # Run teardown
  echo -e "  ${CYAN}Running teardown.sql...${NC}"
  psql "$DB_URL" -f "$SCRIPT_DIR/layer1-database/teardown.sql" > /dev/null 2>&1 || true

  echo ""
}

# ---------------------------------------------------------------------------
# Layer 2: API Tests
# ---------------------------------------------------------------------------
run_layer2() {
  echo -e "${BOLD}── Layer 2: API Tests ──${NC}"

  if [[ -z "$SUPA_URL" ]] || [[ -z "$SUPA_KEY" ]]; then
    echo -e "${YELLOW}  SKIP: Supabase URL or key not configured${NC}"
    L2_SKIPPED=4
    return
  fi

  # Check for tsx/npx
  if ! command -v npx &> /dev/null; then
    echo -e "${YELLOW}  SKIP: npx not available${NC}"
    L2_SKIPPED=4
    return
  fi

  local test_files=(
    "test_auth_enforcement.ts"
    "test_scope_enforcement.ts"
    "test_input_validation.ts"
    "test_output_schema.ts"
  )

  for test_file in "${test_files[@]}"; do
    local filepath="$SCRIPT_DIR/layer2-api/$test_file"
    if [[ ! -f "$filepath" ]]; then
      echo -e "  ${RED}Missing: $test_file${NC}"
      ((L2_FAILED++))
      continue
    fi

    echo -e "  ${CYAN}Running $test_file...${NC}"
    local output
    output=$(cd "$SCRIPT_DIR" && npx tsx "$filepath" 2>&1) || true

    # Parse results
    local p f s
    p=$(echo "$output" | grep -c "^PASS " || true)
    f=$(echo "$output" | grep -c "^FAIL " || true)
    s=$(echo "$output" | grep -c "^SKIP " || true)

    # Print individual results
    echo "$output" | grep -E "^(PASS|FAIL|SKIP)" | while read -r line; do
      if echo "$line" | grep -q "^PASS"; then
        echo -e "  ${GREEN}$line${NC}"
      elif echo "$line" | grep -q "^FAIL"; then
        echo -e "  ${RED}$line${NC}"
      elif echo "$line" | grep -q "^SKIP"; then
        echo -e "  ${YELLOW}$line${NC}"
      fi
    done

    L2_PASSED=$((L2_PASSED + p))
    L2_FAILED=$((L2_FAILED + f))
    L2_SKIPPED=$((L2_SKIPPED + s))
  done

  echo ""
}

# ---------------------------------------------------------------------------
# Layer 3: E2E Tests (all placeholders)
# ---------------------------------------------------------------------------
run_layer3() {
  echo -e "${BOLD}── Layer 3: E2E Workflow Tests ──${NC}"
  echo -e "  ${YELLOW}All Layer 3 tests are placeholders (requires kernel hooks)${NC}"

  local test_files=(
    "test_rfi_lifecycle.spec.ts"
    "test_submittal_lifecycle.spec.ts"
    "test_daily_log_lifecycle.spec.ts"
    "test_punch_item_lifecycle.spec.ts"
  )

  for test_file in "${test_files[@]}"; do
    echo -e "  ${YELLOW}SKIP $test_file (placeholder)${NC}"
    ((L3_SKIPPED++))
  done

  echo ""
}

# ---------------------------------------------------------------------------
# Layer 4: AI Tests (all placeholders)
# ---------------------------------------------------------------------------
run_layer4() {
  echo -e "${BOLD}── Layer 4: AI Evaluation Tests ──${NC}"
  echo -e "  ${YELLOW}All Layer 4 tests are placeholders (requires AI policy layer)${NC}"

  local test_files=(
    "test_grounding.ts"
    "test_citation.ts"
    "test_hallucination.ts"
    "test_trust_tagging.ts"
  )

  for test_file in "${test_files[@]}"; do
    echo -e "  ${YELLOW}SKIP $test_file (placeholder)${NC}"
    ((L4_SKIPPED++))
  done

  echo ""
}

# ---------------------------------------------------------------------------
# Execute requested layers
# ---------------------------------------------------------------------------
echo ""

if [[ -z "$TARGET_LAYER" ]] || [[ "$TARGET_LAYER" == "1" ]]; then
  run_layer1
fi

if [[ -z "$TARGET_LAYER" ]] || [[ "$TARGET_LAYER" == "2" ]]; then
  run_layer2
fi

if [[ -z "$TARGET_LAYER" ]] || [[ "$TARGET_LAYER" == "3" ]]; then
  run_layer3
fi

if [[ -z "$TARGET_LAYER" ]] || [[ "$TARGET_LAYER" == "4" ]]; then
  run_layer4
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL_PASSED=$((L1_PASSED + L2_PASSED + L3_PASSED + L4_PASSED))
TOTAL_FAILED=$((L1_FAILED + L2_FAILED + L3_FAILED + L4_FAILED))
TOTAL_SKIPPED=$((L1_SKIPPED + L2_SKIPPED + L3_SKIPPED + L4_SKIPPED))

echo -e "${BOLD}=== SiteSync PM Eval Results ===${NC}"
printf "  Layer 1 (Database):  %s passed, %s failed, %s skipped\n" "$L1_PASSED" "$L1_FAILED" "$L1_SKIPPED"
printf "  Layer 2 (API):       %s passed, %s failed, %s skipped\n" "$L2_PASSED" "$L2_FAILED" "$L2_SKIPPED"
printf "  Layer 3 (E2E):       %s passed, %s failed, %s skipped\n" "$L3_PASSED" "$L3_FAILED" "$L3_SKIPPED"
printf "  Layer 4 (AI):        %s passed, %s failed, %s skipped\n" "$L4_PASSED" "$L4_FAILED" "$L4_SKIPPED"
echo   "  ─────────────────────────────────"
printf "  ${BOLD}TOTAL:               %s passed, %s failed, %s skipped (placeholder)${NC}\n" "$TOTAL_PASSED" "$TOTAL_FAILED" "$TOTAL_SKIPPED"
echo ""

if [[ "$TOTAL_FAILED" -gt 0 ]]; then
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
else
  echo -e "${GREEN}All executed tests passed.${NC}"
  exit 0
fi
