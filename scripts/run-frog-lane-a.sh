#!/usr/bin/env bash
# Lane A (battle-ready): offline inventory + optional staging API contracts.
# Heavy matrices (edge-fn × roles × payloads; full RLS) — run separately via npm scripts,
# often overnight — see docs/runbooks/BATTLE_TEST_RUNBOOK.md
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== frog:inventory (no staging secrets) =="
npm run frog:inventory

ENV_FILE="$ROOT/.env.scale-test"
if [[ ! -f "$ENV_FILE" ]]; then
  printf '\n%s\n' "[frog] No .env.scale-test — copy .env.scale-test.example, fill staging keys, then:"
  printf '%s\n' "       npm run frog:lane-a"
  printf '\n%s\n' "[frog] Heavy matrices (when secrets exist):"
  printf '%s\n' "       npm run frog:staging-contracts"
  printf '%s\n' "       npm run frog:staging-edge-matrix"
  printf '%s\n' "       npm run frog:staging-rls-matrix"
  exit 0
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" || -z "${SUPABASE_SERVICE_KEY:-}" ]]; then
  echo "[frog] .env.scale-test must set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY" >&2
  exit 1
fi

echo ""
echo "== frog:staging-contracts (RPC sample + webhooks + cron + storage) =="
npm run frog:staging-contracts

echo ""
printf '%s\n' "[frog] Staging contract sweep done."
printf '%s\n' "Next — edge-fn role matrix (long): npm run frog:staging-edge-matrix"
printf '%s\n' "Next — RLS role matrix (very long): npm run frog:staging-rls-matrix"
printf '%s\n' "Playwright B1 route sweep (needs POLISH_USER/POLISH_PASS + E2E_REAL_BACKEND):"
printf '%s\n' "  E2E_REAL_BACKEND=true E2E_BASE_URL=http://localhost:5173/sitesync-pm/ \\"
printf '%s\n' "    POLISH_USER=… POLISH_PASS=… npx playwright test e2e/coverage/B1-every-route.spec.ts --workers=4"
printf '%s\n' "Full battle test: docs/runbooks/BATTLE_TEST_RUNBOOK.md"
