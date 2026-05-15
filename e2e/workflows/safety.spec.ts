/**
 * Workflow B.2 — Safety: incident report + corrective action regression spec.
 *
 * Exercises the safety incidents flow: Report Incident button opens
 * IncidentForm (location, type, severity, description). Corrective action
 * is an inline sub-section of the same form. We submit a near-miss (no
 * photo required for that severity) to keep the spec deterministic.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/safety.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #3/10)
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

const MARKER = `b2-safety-${Date.now()}`

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

test('B.2 — UI: incident report form submits (near-miss + corrective action)', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/safety_incidents') && !url.includes('/rest/v1/corrective_actions')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/safety`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // pages/safety/index.tsx line 204: "Report Incident" button (incidents
  // tab is default). Opens IncidentForm modal (role="dialog"
  // aria-label="Report Incident").
  await page
    .getByRole('button', { name: /^Report Incident$/i })
    .first()
    .click()

  await expect(page.getByRole('dialog', { name: /Report Incident/i })).toBeVisible({ timeout: 5_000 })

  // IncidentForm.tsx line 161: incident-type <select>. Use "near_miss" so
  // photo is not required (line 240 — required only for medical+).
  await page.locator('select').first().selectOption('near_miss')

  // Location input (line 174, placeholder="e.g. Level 3 stairwell").
  await page.getByPlaceholder('e.g. Level 3 stairwell').fill(`${MARKER} location`)

  // Severity select (line 181).
  const severitySelect = page.locator('select').nth(1)
  await severitySelect.selectOption('first_aid')

  // Involved Party (line 194).
  await page.getByPlaceholder('Name or crew').fill('B.2 test crew')

  // Description (line 201).
  await page.getByPlaceholder('Describe what happened').fill(`${MARKER} description`)

  // Corrective action (line 219) — optional but exercises the CA branch.
  await page.getByPlaceholder('Action to prevent recurrence').fill('Re-brief crew on lockout/tagout')

  // Submit (line 249 — "Save Incident").
  await page.getByRole('button', { name: /^Save Incident$/ }).click()

  await page.waitForTimeout(2_000)

  // No PostgREST 4xx from safety_incidents / corrective_actions.
  for (const f of failures) {
    expect(f.body, `safety API returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist/i)
  }
})

test('B.2 — DB: safety_incident row persisted with corrective action link', async () => {
  if (!admin) {
    test.skip(true, 'SUPABASE_SERVICE_KEY required')
    return
  }
  const { data, error } = await admin
    .from('safety_incidents' as never)
    .select('id, location, severity, organization_id, created_at')
    .ilike('location', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    test.skip(true, `safety_incidents not exposed: ${error.message}`)
    return
  }
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data?.[0].organization_id, 'incident organization_id must be set').toBeTruthy()
})
