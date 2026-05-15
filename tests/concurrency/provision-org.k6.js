/**
 * k6 fallback for FMEA I.PROV.1.
 *
 * Vitest's Promise.all is bounded by the JS event-loop fairness; even
 * with 10 parallel rpc.invoke promises, the staging server might still
 * serialize them. k6 spins up real OS threads (VUs) and fires N=20 truly
 * concurrent provision_organization POSTs. The DB still must produce
 * exactly 1 organization row for the shared (slug, owner).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   OWNER_USER_ID=<auth-user-uuid> \
 *   k6 run tests/concurrency/provision-org.k6.js
 *
 * Reporting: k6 prints per-iteration metrics; a follow-up check via
 *   psql -c "SELECT count(*) FROM organizations WHERE slug ~ 'k6-race-'"
 * verifies the no-duplicate invariant. Cleanup is the caller's job —
 * the loop's platform-fix-agent will reset between runs.
 *
 * This script is run-only-when-k6-CLI-present; the vitest spec
 * (provision-org-race.spec.ts) is the canonical CI guard.
 */
/* global __ENV */
// eslint-disable-next-line @typescript-eslint/no-var-requires, no-undef
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 20,
  iterations: 20,
  thresholds: {
    // Every request must complete; whether it succeeds is asserted by
    // the post-run psql query (provision_organization is idempotent on
    // duplicate calls and returns the same org_id).
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'],
  },
}

const URL = __ENV.SUPABASE_URL || ''
const KEY = __ENV.SUPABASE_SERVICE_KEY || ''
const OWNER = __ENV.OWNER_USER_ID || ''
const TS = Date.now()
const SLUG = `k6-race-${TS}`

export default function () {
  if (!URL || !KEY || !OWNER) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY / OWNER_USER_ID')
  }
  const body = JSON.stringify({
    p_name: `k6 race ${TS}`,
    p_slug: SLUG,
    p_owner: OWNER,
    p_metadata: {},
  })
  const res = http.post(`${URL}/rest/v1/rpc/provision_organization`, body, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  })
  check(res, {
    'status is 2xx OR 409': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 409,
  })
}
