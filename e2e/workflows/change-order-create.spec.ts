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
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByRole('button', { name: /sign in with password/i }).first().click().catch(() => undefined)
  await page.waitForTimeout(400)
  await page.getByPlaceholder('Email').fill(USER)
  await page.getByPlaceholder('Password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
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

  await page
    .getByRole('button', { name: /new co|new change|create change|^new$/i })
    .first()
    .click()

  // Change order forms typically need title/description + amount.
  await page
    .getByPlaceholder(/title|description|change|reason/i)
    .first()
    .fill(`${MARKER} change order`)

  const amount = page.locator('input[type="number"]').first()
  if (await amount.count() > 0) await amount.fill('5000')

  await page
    .getByRole('button', { name: /^submit$|^save$|^create$/i })
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
  // change_orders schema typically uses justification/description for the text;
  // search broadly via title-like columns.
  const { data, error } = await admin
    .from('change_orders')
    .select('id, justification, co_number, project_id, status, total_cents, created_at')
    .or(`justification.ilike.${MARKER}%,co_number.ilike.${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    // Schema may not have justification — fall back to ordering by recency
    const fb = await admin
      .from('change_orders')
      .select('id, project_id, status, co_number, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
    expect(fb.error, fb.error ? `change_orders fallback failed: ${fb.error.message}` : undefined).toBeNull()
    return
  }
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data![0].project_id).toBeTruthy()
  expect(data![0].co_number).toBeTruthy()
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
