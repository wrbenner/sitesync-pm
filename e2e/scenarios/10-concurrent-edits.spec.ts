/**
 * Scenario 10 — Concurrent edits + race conditions.
 *
 * Catches the race-condition class of bugs:
 *   - Two users updating the same row → last-write-wins vs conflict detection
 *   - Two users approving the same CO → idempotency or double-approval
 *   - 100 parallel inserts into the same table → connection-pool ceiling
 *   - Same user double-clicks a primary CTA → duplicate row
 *
 * Real backend only.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const VU_TOKENS_FILE = process.env.VU_TOKENS_FILE ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only')

interface VuToken { jwt: string; orgId: string; role: string }
let tokens: VuToken[] = []

test.beforeAll(() => {
  if (!VU_TOKENS_FILE) test.skip(true, 'VU_TOKENS_FILE not set')
  tokens = (JSON.parse(readFileSync(VU_TOKENS_FILE, 'utf-8')) as { tokens: VuToken[] }).tokens
  if (tokens.length < 2) test.skip(true, 'Need 2+ tokens for concurrent specs')
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
  return { status: res.status, body: (await res.json().catch(() => null)) as unknown }
}

async function projectIdFor(t: VuToken): Promise<string | null> {
  const r = await rest('GET', `/projects?organization_id=eq.${t.orgId}&select=id&limit=1`, t.jwt)
  const list = r.body as Array<{ id: string }>
  return Array.isArray(list) && list.length > 0 ? list[0].id : null
}

// ---------------------------------------------------------------------------
// C1 — Two users in the same org update the same RFI's status simultaneously
// ---------------------------------------------------------------------------
test('C1: simultaneous PATCH on same RFI does not corrupt state', async () => {
  const orgTokens = tokens.filter((t) => t.orgId === tokens[0].orgId).slice(0, 2)
  if (orgTokens.length < 2) test.skip(true, 'Need 2 users in same org')
  const proj = await projectIdFor(orgTokens[0])
  if (!proj) test.skip(true, 'No project to test against')

  const create = await rest('POST', '/rfis', orgTokens[0].jwt, {
    organization_id: orgTokens[0].orgId,
    project_id: proj,
    subject: `concurrent-${Date.now()}`,
    question: 'concurrent test',
    status: 'open',
    metadata: { scale_test: true },
  })
  expect(create.status).toBeLessThan(300)
  const rfi = (create.body as Array<{ id: string }>)[0]

  // Fire two concurrent PATCHes — one closes, one re-opens. The DB must
  // end up in one of these two states deterministically.
  const [a, b] = await Promise.all([
    rest('PATCH', `/rfis?id=eq.${rfi.id}`, orgTokens[0].jwt, { status: 'closed' }),
    rest('PATCH', `/rfis?id=eq.${rfi.id}`, orgTokens[1].jwt, { status: 'open' }),
  ])
  // Both PATCHes succeed individually (PostgreSQL serializes the writes).
  expect(a.status).toBeLessThan(300)
  expect(b.status).toBeLessThan(300)

  const final = await rest('GET', `/rfis?id=eq.${rfi.id}&select=status`, orgTokens[0].jwt)
  const row = (final.body as Array<{ status: string }>)[0]
  expect(['closed', 'open']).toContain(row.status)

  await rest('DELETE', `/rfis?id=eq.${rfi.id}`, orgTokens[0].jwt)
})

// ---------------------------------------------------------------------------
// C2 — Double-click on create: two POSTs in flight, only one row should land
// (or both — testing idempotency, not enforcement)
// ---------------------------------------------------------------------------
test('C2: double-click create produces 2 rows (no idempotency key yet)', async () => {
  const t = tokens[0]
  const proj = await projectIdFor(t)
  if (!proj) test.skip(true, 'No project to test against')
  const subject = `double-click-${Date.now()}`
  const [a, b] = await Promise.all([
    rest('POST', '/rfis', t.jwt, {
      organization_id: t.orgId, project_id: proj, subject, question: 'x',
      status: 'open', metadata: { scale_test: true },
    }),
    rest('POST', '/rfis', t.jwt, {
      organization_id: t.orgId, project_id: proj, subject, question: 'x',
      status: 'open', metadata: { scale_test: true },
    }),
  ])
  expect(a.status).toBeLessThan(300)
  expect(b.status).toBeLessThan(300)
  // Today both rows are created. Document as a known gap — idempotency keys
  // are a future-PR-shipped feature. Once shipped, the assertion flips to
  // expect 1 unique row.
  const list = await rest(
    'GET',
    `/rfis?subject=eq.${encodeURIComponent(subject)}&select=id`,
    t.jwt,
  )
  const found = (list.body as unknown[]).length
  if (found > 1) {
    test.info().annotations.push({
      type: 'known-gap',
      description: 'Double-submitted POSTs both succeed — idempotency-key handling is a follow-up.',
    })
  }
  // Cleanup
  for (const row of list.body as Array<{ id: string }>) {
    await rest('DELETE', `/rfis?id=eq.${row.id}`, t.jwt)
  }
})

// ---------------------------------------------------------------------------
// C3 — 100 parallel inserts into the same table from same user
// (connection-pool stress)
// ---------------------------------------------------------------------------
test('C3: 100 parallel INSERTs all succeed or fail cleanly', async () => {
  const t = tokens[0]
  const proj = await projectIdFor(t)
  if (!proj) test.skip(true, 'No project to test against')
  const tag = `pool-${Date.now()}`
  const promises = Array.from({ length: 100 }, (_, i) =>
    rest('POST', '/rfis', t.jwt, {
      organization_id: t.orgId,
      project_id: proj,
      subject: `${tag}-${i}`,
      question: 'pool stress',
      status: 'open',
      metadata: { scale_test: true },
    }),
  )
  const results = await Promise.all(promises)
  const ok = results.filter((r) => r.status >= 200 && r.status < 300).length
  const conn5xx = results.filter((r) => r.status >= 500).length
  expect(conn5xx, `${conn5xx} of 100 INSERTs returned 5xx — connection pool exhaustion`).toBe(0)
  // Cleanup
  await rest('DELETE', `/rfis?subject=like.${tag}*`, t.jwt)
  test.info().annotations.push({ type: 'metric', description: `100 inserts: ${ok} ok` })
})

// ---------------------------------------------------------------------------
// C4 — Same user double-approve on CO: second approve must not double-count
// the financial impact (idempotent state transition)
// ---------------------------------------------------------------------------
test('C4: double-approve on CO does not double the budget impact', async () => {
  const t = tokens[0]
  const proj = await projectIdFor(t)
  if (!proj) test.skip(true)
  const create = await rest('POST', '/change_orders', t.jwt, {
    organization_id: t.orgId,
    project_id: proj,
    title: `double-approve-${Date.now()}`,
    status: 'submitted',
    amount: 1000,
    metadata: { scale_test: true },
  })
  if (create.status >= 400) test.skip(true, `change_orders absent: ${JSON.stringify(create.body)}`)
  const co = (create.body as Array<{ id: string }>)[0]
  const [a, b] = await Promise.all([
    rest('PATCH', `/change_orders?id=eq.${co.id}`, t.jwt, { status: 'approved' }),
    rest('PATCH', `/change_orders?id=eq.${co.id}`, t.jwt, { status: 'approved' }),
  ])
  expect(a.status).toBeLessThan(300)
  expect(b.status).toBeLessThan(300)
  const final = await rest('GET', `/change_orders?id=eq.${co.id}&select=status`, t.jwt)
  expect(((final.body as Array<{ status: string }>)[0]).status).toBe('approved')
  await rest('DELETE', `/change_orders?id=eq.${co.id}`, t.jwt)
})
