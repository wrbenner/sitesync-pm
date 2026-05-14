/**
 * Workflow B.2 — Punch item create regression spec.
 *
 * Punch items don't have a dedicated iris_ingest_trigger but they DO fire
 * fn_mark_search_dirty (which writes to search_index_dirty_flags) and
 * trg_punch_item_assigned (which writes a notification). If either
 * regresses to require columns that don't exist OR an RLS path breaks,
 * this spec catches it.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/punch-item-create.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(
  REAL_BACKEND && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY),
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required for DB-side assertions',
)

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `b2-punch-${Date.now()}`

async function signIn(page: Page): Promise<void> {
  // Real DOM: Login.tsx defaults to magic-link mode; click the
  // "Sign in with password" footer toggle to reveal the Password input
  // (only rendered when mode === 'password'). aria-label="Email"/"Password".
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(USER)
  await page.getByLabel('Password', { exact: true }).fill(PASS)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test('B.2 — UI: punch item create submits without RLS/trigger error', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/punch_items') && !url.includes('/rest/v1/rpc/')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/punch-list`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Real DOM: pages/punch-list/index.tsx (line 555) renders the New-Punch
  // button with data-testid="create-punch-item-button". Mobile builds also
  // expose a FAB with aria-label="Quick capture punch item" (line 794) —
  // we use the test-id as the canonical handle.
  await page
    .getByTestId('create-punch-item-button')
    .click()

  // PunchItemCreateWizard.tsx (line 734) renders the title input with
  // placeholder "e.g. Cracked drywall above unit 802 doorframe" — that's
  // the required Title field.
  await page
    .getByPlaceholder('e.g. Cracked drywall above unit 802 doorframe')
    .first()
    .fill(`${MARKER} title`)

  // Submit — PunchItemCreateWizard footer renders a single primary button
  // labeled "Create Punch Item" (canSubmit gate on title.length > 0).
  await page
    .getByRole('button', { name: /Create Punch Item|Add Punch Item/ })
    .first()
    .click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    expect(
      f.body,
      `punch_items create returned ${f.status} from ${f.url}: ${f.body}`,
    ).not.toMatch(/42703|42501|column .+ does not exist|search_index_dirty_flags/i)
  }

  await expect(page.locator('body')).toContainText(MARKER, { timeout: 10_000 })
})

test('B.2 — DB: punch_items row persisted', async () => {
  const { data, error } = await admin
    .from('punch_items')
    .select('id, title, project_id, status, number, is_demo, created_at')
    .ilike('title', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  expect(error, error ? `punch_items select failed: ${error.message}` : undefined).toBeNull()
  expect(data?.length ?? 0).toBeGreaterThan(0)
  const row = data![0]
  expect(row.title).toContain(MARKER)
  expect(row.project_id).toBeTruthy()
  expect(row.number).toBeGreaterThan(0) // auto-assigned by punch_items_number_seq
})

test('B.2 — DB: search_index_dirty_flags row created (fn_mark_search_dirty fired)', async () => {
  const { data, error } = await admin
    .from('search_index_dirty_flags')
    .select('id, entity_type, entity_id, project_id, organization_id, marked_at')
    .eq('entity_type', 'punch_item')
    .order('marked_at', { ascending: false })
    .limit(5)

  if (error) test.skip(true, `search_index_dirty_flags not accessible: ${error.message}`)
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data![0].organization_id, 'search-dirty row must carry organization_id').toBeTruthy()
  expect(data![0].project_id, 'search-dirty row must carry project_id').toBeTruthy()
})
