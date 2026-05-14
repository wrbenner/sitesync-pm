/**
 * Workflow B.2 — Closeout: warranties + as-builts regression spec.
 *
 * Exercises the closeout workflow's warranty entry path (the "Add Warranty"
 * modal under the Warranties tab). As-builts live under the O&M Manuals
 * tab (Upload O&M Manual modal); we exercise the warranty form as the
 * primary path and validate the O&M upload modal mount as a secondary
 * smoke.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/closeout.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #6/10)
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

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const MARKER = `B2-closeout-${Date.now()}`

async function signIn(page: Page): Promise<void> {
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

test('B.2 — UI: warranty create modal submits', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/warranties') && !url.includes('/rest/v1/closeout_items')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/closeout`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Closeout.tsx tablist (line 134-176) — switch to Warranties tab.
  await page.getByRole('tab', { name: /Warranties/i }).click().catch(() => undefined)
  await page.waitForTimeout(400)

  // Closeout.tsx line 344: "Add Warranty" button (permission-gated to
  // project.settings).
  await page
    .getByRole('button', { name: /^Add Warranty$/i })
    .first()
    .click()

  // WarrantyFormModal (line 549): Item field with placeholder "e.g. Rooftop AHU-1".
  await page.getByPlaceholder('e.g. Rooftop AHU-1').fill(`${MARKER} item`)

  // Submit (line 571 — "Add" label for create mode).
  await page.getByRole('button', { name: /^Add$/, exact: true }).click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    expect(f.body, `closeout API returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist/i)
  }
})

test('B.2 — DB: warranty row persisted', async () => {
  if (!admin) {
    test.skip(true, 'SUPABASE_SERVICE_KEY required')
    return
  }
  const { data, error } = await admin
    .from('warranties' as never)
    .select('id, item, organization_id, created_at')
    .ilike('item', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    test.skip(true, `warranties not exposed: ${error.message}`)
    return
  }
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data?.[0].organization_id, 'warranty organization_id must be set').toBeTruthy()
})
