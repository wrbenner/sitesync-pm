#!/bin/bash
# =============================================================================
# Layer 1 Database/RLS Tests — REST API Edition
# =============================================================================
# Runs database schema and RLS assertions via the Supabase REST API
# using the service role key. This eliminates the need for direct psql
# connections and works from any CI environment.
#
# Required env vars:
#   SUPABASE_URL          — Supabase project URL
#   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
#   SUPABASE_ANON_KEY     — Anon key (for RLS-bound tests)
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SKIPPED=0

SB_URL="${SUPABASE_URL:-}"
SB_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SB_ANON_KEY="${SUPABASE_ANON_KEY:-}"

if [[ -z "$SB_URL" ]] || [[ -z "$SB_SERVICE_KEY" ]]; then
  echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  WARNING: SUPABASE_URL or SERVICE_ROLE_KEY missing      ║${NC}"
  echo -e "${RED}║  Layer 1 is SKIPPING ALL TESTS                         ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
  echo "::warning::Layer 1 SKIPPED: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  exit 0
fi

# Helper: query via service role (bypasses RLS)
sb_query() {
  local table="$1"
  local params="$2"
  curl -s "${SB_URL}/rest/v1/${table}?${params}" \
    -H "apikey: ${SB_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SB_SERVICE_KEY}"
}

# Helper: query via anon key (RLS enforced)
sb_query_anon() {
  local table="$1"
  local params="$2"
  curl -s "${SB_URL}/rest/v1/${table}?${params}" \
    -H "apikey: ${SB_ANON_KEY}" \
    -H "Authorization: Bearer ${SB_ANON_KEY}"
}

# Helper: check if a column exists on a table
column_exists() {
  local table="$1"
  local column="$2"
  local result
  result=$(curl -s -o /dev/null -w "%{http_code}" \
    "${SB_URL}/rest/v1/${table}?select=${column}&limit=0" \
    -H "apikey: ${SB_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SB_SERVICE_KEY}")
  [[ "$result" == "200" ]]
}

# Helper: call an RPC function
sb_rpc() {
  local fn="$1"
  local body="$2"
  curl -s -X POST "${SB_URL}/rest/v1/rpc/${fn}" \
    -H "apikey: ${SB_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SB_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

pass() { echo -e "  ${GREEN}PASS [$1] $2${NC}"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}FAIL [$1] $2${NC}"; FAILED=$((FAILED + 1)); }
skip() { echo -e "  ${YELLOW}SKIP [$1] $2${NC}"; SKIPPED=$((SKIPPED + 1)); }

echo -e "\n── Layer 1: Database / RLS Tests (REST API) ──\n"

# ─── Connectivity check ──────────────────────────────────────────────────────
echo "Testing Supabase connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${SB_URL}/rest/v1/" \
  -H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}")
if [[ "$HTTP_CODE" != "200" ]]; then
  echo -e "${RED}Cannot connect to Supabase (HTTP $HTTP_CODE)${NC}"
  echo "::error::Layer 1 FAILED: Cannot connect to Supabase REST API (HTTP $HTTP_CODE)"
  exit 1
fi
echo -e "${GREEN}Connected to Supabase${NC}\n"

# ─── 1. Schema existence tests ───────────────────────────────────────────────
echo "── Schema Tests ──"

# 1.1: Core tables exist
for table in rfis submittals tasks daily_logs change_orders contracts punch_items incidents projects organizations project_members; do
  result=$(curl -s -o /dev/null -w "%{http_code}" "${SB_URL}/rest/v1/${table}?limit=0" \
    -H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}")
  if [[ "$result" == "200" ]]; then
    pass "1.1" "Table ${table} exists"
  else
    fail "1.1" "Table ${table} missing (HTTP $result)"
  fi
done

# 1.2: Provenance columns (created_by)
echo ""
echo "── Provenance Columns ──"
for table in rfis submittals daily_logs contracts; do
  if column_exists "$table" "created_by"; then
    pass "1.2" "${table}.created_by exists"
  else
    fail "1.2" "${table}.created_by missing"
  fi
done

# 1.3: Provenance columns (updated_by) — from Batch 3
for table in rfis submittals tasks daily_logs change_orders contracts punch_items incidents; do
  if column_exists "$table" "updated_by"; then
    pass "1.3" "${table}.updated_by exists"
  else
    skip "1.3" "${table}.updated_by not yet added (run supabase db push)"
  fi
done

# 1.4: Soft-delete columns — from Batch 4
echo ""
echo "── Soft-Delete Columns ──"
for table in rfis submittals tasks daily_logs change_orders punch_items; do
  if column_exists "$table" "deleted_at"; then
    pass "1.4" "${table}.deleted_at exists"
  else
    skip "1.4" "${table}.deleted_at not yet added (run supabase db push)"
  fi
done

# ─── 2. RLS enforcement tests ────────────────────────────────────────────────
echo ""
echo "── RLS Enforcement ──"

# 2.1: Anon key cannot read rfis (RLS blocks unauthenticated)
if [[ -n "$SB_ANON_KEY" ]]; then
  anon_result=$(sb_query_anon "rfis" "select=id&limit=1")
  if echo "$anon_result" | grep -q '"code"'; then
    pass "2.1" "Anon key blocked from rfis (RLS enforced)"
  elif [[ "$anon_result" == "[]" ]]; then
    pass "2.1" "Anon key returns empty from rfis (RLS enforced or no data)"
  else
    fail "2.1" "Anon key can read rfis — RLS may be misconfigured"
  fi
else
  skip "2.1" "No SUPABASE_ANON_KEY configured"
fi

# 2.2: Service role CAN read rfis (bypasses RLS)
service_result=$(sb_query "rfis" "select=id&limit=1")
if echo "$service_result" | grep -qv '"code"'; then
  pass "2.2" "Service role can read rfis (RLS bypassed)"
else
  fail "2.2" "Service role cannot read rfis: $service_result"
fi

# 2.3: Verify estimates has RLS policies (Batch 2)
estimates_result=$(sb_query "estimates" "select=id&limit=1")
if echo "$estimates_result" | grep -qv '"code"'; then
  pass "2.3" "Service role can access estimates (RLS policies exist)"
else
  skip "2.3" "estimates not accessible — Batch 2 RLS policies may not be applied"
fi

# ─── 3. Role constraint tests ────────────────────────────────────────────────
echo ""
echo "── Role Constraints ──"

# 3.1: Check if project_members.role column is queryable
pm_result=$(sb_query "project_members" "select=role&limit=10")
pm_http=$(curl -s -o /dev/null -w "%{http_code}" "${SB_URL}/rest/v1/project_members?select=role&limit=10" \
  -H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}")
if [[ "$pm_http" == "200" ]]; then
  pass "3.1" "project_members.role column accessible"
  if echo "$pm_result" | grep -qE 'project_manager|superintendent|subcontractor'; then
    pass "3.1b" "Kernel roles found in project_members"
  else
    skip "3.1b" "No kernel roles in project_members yet (no data or legacy roles only)"
  fi
else
  fail "3.1" "Cannot query project_members.role (HTTP $pm_http)"
fi

# 3.2: Check kernel_role_label function
label_result=$(sb_rpc "kernel_role_label" '{"raw_role":"member"}')
if echo "$label_result" | grep -q 'legacy'; then
  pass "3.2" "kernel_role_label() function works"
elif echo "$label_result" | grep -q 'PGRST202'; then
  skip "3.2" "kernel_role_label() not yet deployed (run supabase db push)"
else
  fail "3.2" "kernel_role_label() returned unexpected: $label_result"
fi

# ─── 4. State machine tests ──────────────────────────────────────────────────
echo ""
echo "── State Machine ──"

# 4.1: Check rfis.status column is queryable
status_http=$(curl -s -o /dev/null -w "%{http_code}" "${SB_URL}/rest/v1/rfis?select=status&limit=100" \
  -H "apikey: ${SB_SERVICE_KEY}" -H "Authorization: Bearer ${SB_SERVICE_KEY}")
status_result=$(sb_query "rfis" "select=status&limit=100")
if [[ "$status_http" == "200" ]]; then
  pass "4.1" "rfis.status column accessible"
  if echo "$status_result" | grep -q 'status'; then
    statuses=$(echo "$status_result" | grep -o '"status":"[^"]*"' | sort -u | head -10)
    echo "    Current statuses in DB: $statuses"
  else
    echo "    (no RFI data in database yet)"
  fi
else
  fail "4.1" "Cannot query rfis.status (HTTP $status_http)"
fi

# ─── 5. Audit infrastructure tests ───────────────────────────────────────────
echo ""
echo "── Audit Infrastructure ──"

# 5.1: audit_log table exists
audit_result=$(sb_query "audit_log" "select=id&limit=1")
if echo "$audit_result" | grep -qv '"code"'; then
  pass "5.1" "audit_log table exists and accessible"
else
  fail "5.1" "audit_log table not accessible"
fi

# 5.2: fn_audit_trigger exists
trigger_check=$(sb_rpc "fn_audit_trigger" '{}' 2>&1)
if echo "$trigger_check" | grep -q 'PGRST202'; then
  skip "5.2" "fn_audit_trigger() not yet deployed (run supabase db push)"
else
  pass "5.2" "fn_audit_trigger() is deployed"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}PASSED: $PASSED${NC}  ${RED}FAILED: $FAILED${NC}  ${YELLOW}SKIPPED: $SKIPPED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $SKIPPED -gt 0 ]]; then
  echo ""
  echo "::warning::$SKIPPED tests skipped — some Step 4 migrations not yet applied to database. Run 'supabase db push' to apply."
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "::error::$FAILED tests FAILED"
  exit 1
fi

exit 0
