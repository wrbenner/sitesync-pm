/**
 * Scenario 07 — Adversarial RLS sweep.
 *
 * The #1 production-stopping bug for multi-tenant SaaS is a cross-org read
 * or write that escapes RLS. This spec deliberately tries to leak data
 * across org boundaries using a user from org A's JWT to query org B's rows.
 *
 * If ANY of these tests succeeds, that's a critical security incident.
 *
 * Gates on E2E_REAL_BACKEND=true since RLS only behaves correctly against
 * a real Supabase project. Requires at least two seeded scale-test orgs.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SCALE_TEST_PASSWORD=... \
 *   VU_TOKENS_FILE=/tmp/scale-vu-tokens.json \
 *   npx playwright test e2e/scenarios/07-adversarial-rls.spec.ts
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const VU_TOKENS_FILE = process.env.VU_TOKENS_FILE ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true + VU_TOKENS_FILE')

interface VuToken { jwt: string; orgId: string; email: string; role: string }
let tokensByOrg: Record<string, VuToken[]> = {}
let orgIds: string[] = []

test.beforeAll(() => {
  if (!VU_TOKENS_FILE) test.skip(true, 'VU_TOKENS_FILE not set')
  const parsed = JSON.parse(readFileSync(VU_TOKENS_FILE, 'utf-8')) as { tokens: VuToken[] }
  tokensByOrg = {}
  for (const t of parsed.tokens) {
    if (!tokensByOrg[t.orgId]) tokensByOrg[t.orgId] = []
    tokensByOrg[t.orgId].push(t)
  }
  orgIds = Object.keys(tokensByOrg)
  if (orgIds.length < 2) test.skip(true, `Need 2+ orgs in token pool, got ${orgIds.length}`)
})

async function rest(method: string, path: string, jwt: string, body?: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, body: json }
}

// ---------------------------------------------------------------------------
// A1 — Cross-org SELECT: org A user reads org B's RFIs
// ---------------------------------------------------------------------------
test('A1: cross-org SELECT returns 0 rows (RFIs)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('GET', `/rfis?organization_id=eq.${orgB}`, userA.jwt)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body) ? res.body.length : 1).toBe(0)
})

test('A1b: cross-org SELECT returns 0 rows (daily_logs)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('GET', `/daily_logs?organization_id=eq.${orgB}`, userA.jwt)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body) ? res.body.length : 1).toBe(0)
})

test('A1c: cross-org SELECT returns 0 rows (organization_members)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('GET', `/organization_members?organization_id=eq.${orgB}`, userA.jwt)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body) ? res.body.length : 1).toBe(0)
})

test('A1d: cross-org SELECT returns 0 rows (projects)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('GET', `/projects?organization_id=eq.${orgB}`, userA.jwt)
  expect(res.status).toBe(200)
  expect(Array.isArray(res.body) ? res.body.length : 1).toBe(0)
})

// ---------------------------------------------------------------------------
// A2 — Cross-org INSERT: org A user tries to write into org B
// ---------------------------------------------------------------------------
test('A2: cross-org INSERT rejected (RFI into another org)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('POST', '/rfis', userA.jwt, {
    organization_id: orgB,
    subject: 'ADVERSARIAL: cross-org write attempt',
    question: 'should be blocked',
    metadata: { scale_test: true, adversarial: true },
  })
  expect(res.status, `cross-org INSERT got ${res.status} — RLS LEAK`).toBeGreaterThanOrEqual(400)
})

test('A2b: cross-org INSERT rejected (daily_log into another org)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await rest('POST', '/daily_logs', userA.jwt, {
    organization_id: orgB,
    log_date: new Date().toISOString().slice(0, 10),
    notes: 'ADVERSARIAL',
    metadata: { scale_test: true, adversarial: true },
  })
  expect(res.status, `cross-org INSERT got ${res.status} — RLS LEAK`).toBeGreaterThanOrEqual(400)
})

// ---------------------------------------------------------------------------
// A3 — Cross-org UPDATE: org A user tries to update org B's row
// ---------------------------------------------------------------------------
test('A3: cross-org UPDATE has no effect (RFI status flip)', async () => {
  const userB = tokensByOrg[orgIds[1]][0]
  const ownB = await rest('GET', `/rfis?organization_id=eq.${orgIds[1]}&limit=1`, userB.jwt)
  const list = ownB.body as Array<{ id: string }>
  if (!Array.isArray(list) || list.length === 0) {
    test.skip(true, 'No RFIs in org B to attempt update — seed seed_sample_data missing')
  }
  const targetId = list[0].id
  const userA = tokensByOrg[orgIds[0]][0]
  const res = await rest('PATCH', `/rfis?id=eq.${targetId}`, userA.jwt, { status: 'closed' })
  // Either explicit reject (4xx) OR silent no-op (200 + 0 rows updated).
  if (res.status === 200) {
    const updated = res.body as unknown[]
    expect(Array.isArray(updated) ? updated.length : 1).toBe(0)
  } else {
    expect(res.status).toBeGreaterThanOrEqual(400)
  }
})

// ---------------------------------------------------------------------------
// A4 — Cross-org DELETE: org A user tries to delete org B's row
// ---------------------------------------------------------------------------
test('A4: cross-org DELETE has no effect', async () => {
  const userB = tokensByOrg[orgIds[1]][0]
  const ownB = await rest('GET', `/rfis?organization_id=eq.${orgIds[1]}&limit=1&select=id`, userB.jwt)
  const list = ownB.body as Array<{ id: string }>
  if (!Array.isArray(list) || list.length === 0) {
    test.skip(true, 'No RFIs in org B to attempt delete')
  }
  const targetId = list[0].id
  const userA = tokensByOrg[orgIds[0]][0]
  const res = await rest('DELETE', `/rfis?id=eq.${targetId}`, userA.jwt)
  // The row must still exist after the attempt.
  const after = await rest('GET', `/rfis?id=eq.${targetId}&select=id`, userB.jwt)
  const stillThere = (after.body as unknown[]).length === 1
  expect(stillThere, `Row ${targetId} was deleted by cross-org user — RLS LEAK (status ${res.status})`).toBe(true)
})

// ---------------------------------------------------------------------------
// A5 — RPC invocation: org A user calls bulk_add_team_members for org B
// ---------------------------------------------------------------------------
test('A5: cross-org RPC bulk_add_team_members rejected', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bulk_add_team_members`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userA.jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_org_id: orgB,
      p_members: [{ user_id: userA.email, role: 'owner' }],
    }),
  })
  // Service-role only — should reject for authenticated users entirely.
  expect(res.status, 'bulk_add_team_members callable by non-service-role').toBeGreaterThanOrEqual(400)
})

// ---------------------------------------------------------------------------
// A6 — Storage cross-org read: try to fetch another org's photo by path
// ---------------------------------------------------------------------------
test('A6: cross-org Storage read blocked (drawings bucket)', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  const orgB = orgIds[1]
  // Path follows the seed-storage.ts convention: orgId/projectId/drawing-01.pdf
  // We don't know orgB's projectId, but a plausible-shape path should still 403.
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/drawings/${orgB}/test-project/drawing-01.pdf`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${userA.jwt}`,
      },
    },
  )
  // Either 404 (not found — never created) OR 403/400 (RLS). 200 = LEAK.
  expect(res.status, `Storage 200 from cross-org path — LEAK`).not.toBe(200)
})

// ---------------------------------------------------------------------------
// A7 — JWT forge: tampered org_id claim should be rejected
// ---------------------------------------------------------------------------
test('A7: JWT with tampered payload signature fails verification', async () => {
  const userA = tokensByOrg[orgIds[0]][0]
  // Tamper the middle segment (payload) — base64 of a different claim.
  const parts = userA.jwt.split('.')
  parts[1] = Buffer.from(JSON.stringify({ org_id: orgIds[1], role: 'authenticated' }))
    .toString('base64url')
  const tampered = parts.join('.')
  const res = await rest('GET', '/organizations?select=id', tampered)
  expect(res.status).toBeGreaterThanOrEqual(400)
})
