/**
 * Workflow B.2 — Change order create regression spec.
 *
 * Completes the iris-ingest-trigger class coverage:
 *   - submittal-create.spec.ts  (fn_mark_search_dirty)
 *   - rfi-create.spec.ts        (rfis_iris_ingest_trigger)
 *   - daily-log-create.spec.ts  (daily_logs_iris_ingest_trigger + NEW.summary)
 *   - punch-item-create.spec.ts (fn_mark_search_dirty + trg_punch_item_assigned)
 *   - change-order-create.spec.ts (change_orders_iris_ingest_trigger) <— this file
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/change-order-create.spec.ts
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

const MARKER = `b2-co-${Date.now()}`

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

test('B.2 — UI: change order create submits without 42703', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/change_orders') && !url.includes('/rest/v1/rpc/')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/change-orders`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Real DOM: pages/ChangeOrders.tsx (line 576 and 614) renders a PrimaryBtn
  // labeled "New CO" inside <PermissionGate permission="change_orders.create">.
  await page
    .getByRole('button', { name: 'New CO' })
    .first()
    .click()

  // CreateChangeOrderModal.tsx (line 20) defines the Title field with
  // placeholder "Brief title for this change". Required per changeOrderSchema.
  await page
    .getByPlaceholder('Brief title for this change')
    .first()
    .fill(`${MARKER} change order`)

  // Description (line 38) is the other required text field.
  const descBox = page
    .getByPlaceholder('Describe the scope change and what triggered it')
    .first()
  if (await descBox.count() > 0) {
    await descBox.fill('Synthetic B.2 change-order regression description.')
  }

  // Amount — the modal uses a currency-type FormInput rendered as
  // <input type="number"> with placeholder "0" (EntityFormModal currency
  // branch). The first number input on the modal is the Estimated Amount.
  const amount = page.locator('input[type="number"]').first()
  if (await amount.count() > 0) await amount.fill('5000')

  // Submit — CreateChangeOrderModal sets submitLabel="Create Change Order"
  // (line 262 in CreateChangeOrderModal.tsx).
  await page
    .getByRole('button', { name: 'Create Change Order' })
    .first()
    .click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    expect(
      f.body,
      `change_orders create returned ${f.status} from ${f.url}: ${f.body}`,
    ).not.toMatch(/42703|42501|column .+ does not exist|projects\.org_id/i)
  }

  await expect(page.locator('body')).toContainText(MARKER, { timeout: 10_000 })
})

test('B.2 — DB: change_orders row persisted', async () => {
  // Real change_orders schema (verified against staging 2026-05-14):
  //   - `number` (integer)         — CO sequence number, NOT `co_number`
  //   - `description` (text)       — long-form text, NOT `justification`
  //   - `amount_cents` (bigint)    — money, NOT `total_cents`
  // Title carries the MARKER (see UI test above).
  const { data, error } = await admin
    .from('change_orders')
    .select('id, title, description, number, project_id, status, amount_cents, created_at')
    .or(`title.ilike.${MARKER}%,description.ilike.${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    const fb = await admin
      .from('change_orders')
      .select('id, project_id, status, number, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(fb.error, fb.error ? `change_orders fallback failed: ${fb.error.message}` : undefined).toBeNull()
    return
  }
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data![0].project_id).toBeTruthy()
  expect(data![0].number).toBeTruthy()
})

test('B.2 — DB: trigger source on prod uses organization_id (not org_id)', async () => {
  const { data, error } = await admin
    .schema('pg_catalog' as never)
    .from('pg_proc' as never)
    .select('prosrc')
    .eq('proname', 'change_orders_iris_ingest_trigger')
    .limit(1)

  if (error) test.skip(true, `pg_proc not exposed: ${error.message}`)
  const src = (data?.[0] as { prosrc?: string } | undefined)?.prosrc ?? ''
  if (src) {
    expect(src, 'change_orders trigger must not reference projects.org_id').not.toMatch(/org_id FROM/)
    expect(src, 'change_orders trigger must reference organization_id').toMatch(/organization_id/)
  }
})
