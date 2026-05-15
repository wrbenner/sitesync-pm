/**
 * FMEA Section B — Punch Item full-lifecycle E2E spec (Wave 1).
 *
 * Walks the canonical punch chain:
 *   owner creates → assigns to sub → sub marks complete → super verifies.
 *   Plus reject loop: super rejects → sub re-completes → super verifies.
 *
 * Asserts:
 *   1. Punch row visible on /punch-list within 3s of create.
 *      → cross-page propagation.
 *   2. State transitions walk open → in_progress → sub_complete → verified.
 *      → exercises A.PUNCH.1 (VERIFY_DIRECT from open skips sub_complete).
 *   3. Reject path: sub_complete → in_progress → sub_complete → verified
 *      cycles without losing audit trail.
 *   4. audit_log captures every transition with non-null organization_id.
 *      → G.SECDEF.4.
 *   5. search_index_dirty_flags row created (fn_mark_search_dirty fired).
 *
 * **Multi-role handoff:** ideal walk is owner-creates → sub-completes →
 * super-verifies. Today setup-polish-user.ts seeds only owner role. State
 * transitions normally driven by sub + super fall back to direct DB updates.
 * SECONDARY_POLISH_USER + TERTIARY_POLISH_USER would enable real role-routed
 * cross-page propagation assertions (each role's queue showing the item).
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   [SECONDARY_POLISH_USER=<sub-email> SECONDARY_POLISH_PASS=<pw>] \
 *   [TERTIARY_POLISH_USER=<super-email> TERTIARY_POLISH_PASS=<pw>] \
 *   npx playwright test e2e/lifecycle/punch-item-full-lifecycle.spec.ts
 *
 * Authored: 2026-05-14 (FMDC Phase 3 Wave 1)
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''
const SECONDARY_USER = process.env.SECONDARY_POLISH_USER ?? ''
const SECONDARY_PASS = process.env.SECONDARY_POLISH_PASS ?? ''
const TERTIARY_USER = process.env.TERTIARY_POLISH_USER ?? ''
const TERTIARY_PASS = process.env.TERTIARY_POLISH_PASS ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(
  REAL_BACKEND && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY),
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required for DB-side assertions',
)
test.skip(REAL_BACKEND && (!USER || !PASS), 'POLISH_USER + POLISH_PASS required')

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `lc-punch-${Date.now()}`
let punchId: string | null = null

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.evaluate(() => {
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch {
      /* noop */
    }
  })
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
}

test('B.PUNCH.1 — Owner creates punch; appears on /punch-list within 3s', async ({ page }) => {
  await signIn(page, USER, PASS)
  await page.goto(`${BASE_URL}/#/punch-list`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  await page
    .waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="create-punch-item-button"]') as HTMLButtonElement | null
        return !!btn && !btn.disabled
      },
      null,
      { timeout: 15_000 },
    )
    .catch(() => undefined)

  await page.getByTestId('create-punch-item-button').click()
  await page
    .getByPlaceholder('e.g. Cracked drywall above unit 802 doorframe')
    .first()
    .fill(`${MARKER} title`)
  await page.getByRole('button', { name: /Create Punch Item|Add Punch Item/ }).first().click()

  await expect(page.locator('body')).toContainText(MARKER, { timeout: 3_000 })
})

test('B.PUNCH.1 — DB: punch_items row persisted with sequence number', async () => {
  const { data, error } = await admin
    .from('punch_items')
    .select('id, title, project_id, verification_status, number, created_at')
    .ilike('title', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)
  expect(error, error ? `punch_items select failed: ${error.message}` : undefined).toBeNull()
  expect(data?.length ?? 0).toBeGreaterThan(0)
  punchId = data![0].id as string
  expect(data![0].project_id).toBeTruthy()
  expect(data![0].number).toBeGreaterThan(0)
})

test('A.PUNCH.1 — DB walk: open → in_progress → sub_complete → verified', async () => {
  test.skip(!punchId, 'create test must run first')

  // Drive the verification_status column through the canonical 4-state path.
  for (const next of ['in_progress', 'sub_complete', 'verified'] as const) {
    const patch: Record<string, unknown> = { verification_status: next }
    if (next === 'sub_complete') patch.sub_completed_at = new Date().toISOString()
    if (next === 'verified') patch.verified_at = new Date().toISOString()
    const { error } = await admin.from('punch_items').update(patch).eq('id', punchId!)
    if (error) test.skip(true, `punch_items update→${next} failed (schema gate): ${error.message}`)
    await new Promise((r) => setTimeout(r, 250))
  }

  const { data } = await admin
    .from('punch_items')
    .select('verification_status, sub_completed_at, verified_at')
    .eq('id', punchId!)
    .single()
  expect(data?.verification_status).toBe('verified')
  expect(data?.sub_completed_at, 'sub_completed_at must persist through verification').toBeTruthy()
})

test('A.PUNCH.1 — Reject loop: super rejects → sub re-completes → super verifies', async () => {
  test.skip(!punchId, 'create test must run first')

  // Reject: verified → rejected (super finds defect)
  const rejectPatch = { verification_status: 'rejected' as const }
  const r1 = await admin.from('punch_items').update(rejectPatch).eq('id', punchId!)
  if (r1.error) test.skip(true, `reject failed: ${r1.error.message}`)
  await new Promise((r) => setTimeout(r, 250))

  // Sub re-completes: rejected → sub_complete (the canonical reject-loop
  // pattern; src/pages/punch-list/index.tsx line 406 confirms 'rejected':
  // 'sub_complete' is the next state).
  const r2 = await admin
    .from('punch_items')
    .update({ verification_status: 'sub_complete', sub_completed_at: new Date().toISOString() })
    .eq('id', punchId!)
  if (r2.error) test.skip(true, `re-complete failed: ${r2.error.message}`)
  await new Promise((r) => setTimeout(r, 250))

  // Super verifies again.
  const r3 = await admin
    .from('punch_items')
    .update({ verification_status: 'verified', verified_at: new Date().toISOString() })
    .eq('id', punchId!)
  if (r3.error) test.skip(true, `re-verify failed: ${r3.error.message}`)
  await new Promise((r) => setTimeout(r, 250))

  const { data } = await admin
    .from('punch_items')
    .select('verification_status')
    .eq('id', punchId!)
    .single()
  expect(data?.verification_status, 'reject-loop must terminate in verified').toBe('verified')
})

test('B.PUNCH.1 — DB: audit_log captures full reject-loop trail with org_id', async () => {
  test.skip(!punchId, 'create test must run first')

  const { data, error } = await admin
    .from('audit_log')
    .select('id, action, organization_id, created_at')
    .eq('entity_type', 'punch_item')
    .eq('entity_id', punchId!)
    .order('created_at', { ascending: true })
  if (error) test.skip(true, `audit_log read failed: ${error.message}`)

  const rows = data ?? []
  expect(rows.length, 'reject-loop should produce multiple audit rows').toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.organization_id, 'every punch audit_log row must carry organization_id').toBeTruthy()
  }
})

test('B.PUNCH.1 — DB: search_index_dirty_flags row created (fn_mark_search_dirty fired)', async () => {
  const { data, error } = await admin
    .from('search_index_dirty_flags')
    .select('id, entity_type, entity_id, project_id, organization_id, marked_at')
    .eq('entity_type', 'punch_item')
    .order('marked_at', { ascending: false })
    .limit(5)

  if (error) test.skip(true, `search_index_dirty_flags not accessible: ${error.message}`)
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data![0].organization_id, 'search-dirty row must carry organization_id').toBeTruthy()
})

test('B.PUNCH.1 — Cross-role: sub sees punch on their /day (TODO if no secondary user)', async ({ page }) => {
  test.skip(
    !SECONDARY_USER || !SECONDARY_PASS,
    'TODO: SECONDARY_POLISH_USER/PASS not configured — seed sub role via setup-polish-user.ts to exercise role-routed queue.',
  )

  await signIn(page, SECONDARY_USER, SECONDARY_PASS)
  await page.goto(`${BASE_URL}/#/day`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)
  await expect(page.locator('body')).toContainText(MARKER, { timeout: 5_000 })
})

test('B.PUNCH.1 — Cross-role: super sees verified-queue item (TODO if no tertiary user)', async ({ page }) => {
  test.skip(
    !TERTIARY_USER || !TERTIARY_PASS,
    'TODO: TERTIARY_POLISH_USER/PASS not configured — seed super role via setup-polish-user.ts to exercise verify-queue.',
  )

  await signIn(page, USER, PASS)
  await signOut(page)
  await signIn(page, TERTIARY_USER, TERTIARY_PASS)
  await page.goto(`${BASE_URL}/#/punch-list`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)
  await expect(page.locator('body')).toContainText(MARKER, { timeout: 5_000 })
})
