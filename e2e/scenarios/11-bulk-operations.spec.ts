/**
 * Scenario 11 — Bulk operations.
 *
 * Real construction PMs import 100s of RFIs from a spreadsheet, bulk-close
 * 50 punch items at end of week, and bulk-reassign whole task lists. The
 * Playwright suite mostly tests single-row flows. This spec hammers the
 * bulk paths.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const VU_TOKENS_FILE = process.env.VU_TOKENS_FILE ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only')

interface VuToken { jwt: string; orgId: string; role: string }
let owner: VuToken | null = null

test.beforeAll(() => {
  if (!VU_TOKENS_FILE) test.skip(true)
  const tokens = (JSON.parse(readFileSync(VU_TOKENS_FILE, 'utf-8')) as { tokens: VuToken[] }).tokens
  owner = tokens.find((t) => t.role === 'owner') ?? tokens[0]
})

async function rest(method: string, p: string, body?: unknown) {
  if (!owner) throw new Error('no owner')
  const r = await fetch(`${SUPABASE_URL}/rest/v1${p}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${owner.jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, body: (await r.json().catch(() => null)) as unknown }
}

async function projectId(): Promise<string | null> {
  if (!owner) return null
  const r = await rest('GET', `/projects?organization_id=eq.${owner.orgId}&select=id&limit=1`)
  const list = r.body as Array<{ id: string }>
  return Array.isArray(list) && list.length > 0 ? list[0].id : null
}

// ---------------------------------------------------------------------------
// B1 — Bulk INSERT: 100 RFIs in one request
// ---------------------------------------------------------------------------
test('B1: bulk INSERT 100 RFIs succeeds', async () => {
  const proj = await projectId()
  if (!proj || !owner) test.skip(true)
  const tag = `bulk-insert-${Date.now()}`
  const rows = Array.from({ length: 100 }, (_, i) => ({
    organization_id: owner!.orgId,
    project_id: proj,
    subject: `${tag}-${i}`,
    question: 'bulk',
    status: 'open',
    metadata: { scale_test: true },
  }))
  const start = Date.now()
  const res = await rest('POST', '/rfis', rows)
  const ms = Date.now() - start
  expect(res.status, `bulk INSERT failed ${res.status}`).toBeLessThan(300)
  expect(ms, `bulk INSERT took ${ms}ms — should be <5s`).toBeLessThan(5000)
  // Cleanup
  await rest('DELETE', `/rfis?subject=like.${tag}*`)
})

// ---------------------------------------------------------------------------
// B2 — Bulk UPDATE: close 50 RFIs in one PATCH
// ---------------------------------------------------------------------------
test('B2: bulk UPDATE (50 RFIs closed in one PATCH)', async () => {
  const proj = await projectId()
  if (!proj || !owner) test.skip(true)
  const tag = `bulk-update-${Date.now()}`
  await rest('POST', '/rfis', Array.from({ length: 50 }, (_, i) => ({
    organization_id: owner!.orgId,
    project_id: proj,
    subject: `${tag}-${i}`,
    question: 'bulk',
    status: 'open',
    metadata: { scale_test: true },
  })))
  const start = Date.now()
  const res = await rest(
    'PATCH',
    `/rfis?subject=like.${tag}*&organization_id=eq.${owner!.orgId}`,
    { status: 'closed' },
  )
  const ms = Date.now() - start
  expect(res.status).toBeLessThan(300)
  expect(ms, `bulk UPDATE took ${ms}ms`).toBeLessThan(5000)
  const verify = await rest('GET', `/rfis?subject=like.${tag}*&status=eq.closed&select=id`)
  expect((verify.body as unknown[]).length).toBe(50)
  await rest('DELETE', `/rfis?subject=like.${tag}*`)
})

// ---------------------------------------------------------------------------
// B3 — Bulk DELETE: 100 rows in one DELETE
// ---------------------------------------------------------------------------
test('B3: bulk DELETE 100 RFIs', async () => {
  const proj = await projectId()
  if (!proj || !owner) test.skip(true)
  const tag = `bulk-delete-${Date.now()}`
  await rest('POST', '/rfis', Array.from({ length: 100 }, (_, i) => ({
    organization_id: owner!.orgId,
    project_id: proj,
    subject: `${tag}-${i}`,
    question: 'bulk',
    status: 'open',
    metadata: { scale_test: true },
  })))
  const start = Date.now()
  const res = await rest('DELETE', `/rfis?subject=like.${tag}*&organization_id=eq.${owner!.orgId}`)
  const ms = Date.now() - start
  expect(res.status).toBeLessThan(300)
  expect(ms, `bulk DELETE took ${ms}ms`).toBeLessThan(5000)
  const verify = await rest('GET', `/rfis?subject=like.${tag}*&select=id`)
  expect((verify.body as unknown[]).length).toBe(0)
})

// ---------------------------------------------------------------------------
// B4 — Pagination cliff: select 500 rows in one go
// ---------------------------------------------------------------------------
test('B4: SELECT 500 RFIs returns within budget', async () => {
  if (!owner) test.skip(true)
  const start = Date.now()
  const res = await rest(
    'GET',
    `/rfis?organization_id=eq.${owner!.orgId}&select=id,subject,status&limit=500`,
  )
  const ms = Date.now() - start
  expect(res.status).toBe(200)
  expect(ms, `500-row SELECT took ${ms}ms — should be <3s`).toBeLessThan(3000)
})
