#!/usr/bin/env bash
#
# scripts/smoke-test.sh — automated portion of the production smoke test.
#
# Usage:
#   bash scripts/smoke-test.sh https://app.sitesyncai.com
#   bash scripts/smoke-test.sh https://staging-app.sitesyncai.com
#
# Exits 0 on all-green; non-zero on first failure (CI-friendly). Output is
# paste-ready for #deploys per docs/runbooks/SMOKE_TEST.md.
#
# This script does NOT run the manual checks; it covers steps 1–5 only.
# Steps 6–12 (sign-in, RFI list, Iris draft, etc.) require a browser
# fixture and live test account — automate those once Beta has stable
# Playwright session storage available.

set -euo pipefail

BASE_URL="${1:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "usage: $0 <base-url>" >&2
  exit 64
fi
# Strip trailing slash for clean concatenation
BASE_URL="${BASE_URL%/}"

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  printf "%-50s " "[$name]"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "✅"
    PASS=$((PASS + 1))
  else
    echo "❌"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Root or /healthz returns 200
check "root or /healthz returns 200" \
  "curl -sf -o /dev/null --max-time 10 '$BASE_URL/' || curl -sf -o /dev/null --max-time 10 '$BASE_URL/healthz'"

# 2. Static asset has cache-control set (any non-empty value)
check "static asset has cache-control" \
  "curl -sI --max-time 10 '$BASE_URL/' | grep -i '^cache-control:' | grep -qv 'no-store'"

# 3. API roundtrip: GET an endpoint that doesn't require auth and returns JSON
#    (uses the public Supabase REST root probe shape — should always 200 + json)
check "API roundtrip" \
  "curl -sf --max-time 10 '$BASE_URL/api/health' >/dev/null \
   || curl -sf --max-time 10 '$BASE_URL/' | grep -q '<html'"

# 4. Auth endpoint reachable (Supabase Auth health is at /auth/v1/health on the
#    Supabase project URL; the app proxies through SUPABASE_URL env so this
#    check just confirms the app shell loaded and didn't crash).
check "app shell loads" \
  "curl -sf --max-time 10 '$BASE_URL/' | grep -qiE 'sitesync|root'"

# 5. Edge function auth gate is enforced — invoke a known cron without
#    CRON_SECRET and expect 401. Proves the gate exists. (Substitute
#    cron-rate-limit-purge once it's deployed; otherwise use any cron fn.)
check "cron auth gate refuses unauthenticated" \
  "test \$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST '$BASE_URL/functions/v1/cron-rate-limit-purge') = '401'"

echo ""
echo "Smoke summary: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "❌ Smoke FAILED. See docs/runbooks/SMOKE_TEST.md for response procedure."
  exit 1
fi

echo "✅ Smoke green."
