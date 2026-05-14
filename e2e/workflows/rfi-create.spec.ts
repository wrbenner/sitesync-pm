/**
 * Workflow B.2 — RFI create regression spec.
 *
 * Companion to submittal-create.spec.ts. Same iris-ingest trigger class
 * (rfis_iris_ingest_trigger). If the prod trigger regresses to org_id
 * or any downstream RLS / audit-log path breaks, this spec catches it.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/rfi-create.spec.ts
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

const MARKER = `b2-rfi-${Date.now()}`

async function signIn(page: Page): Promise<void> {
  // Real DOM: Login.tsx defaults to magic-link mode; click the
  // "Sign in with password" footer toggle to reveal the Password input
  // (only rendered when mode === 'password'). See submittal-create.spec.ts.
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

test('B.2 — UI: RFI create form submits without 42703', async ({ page }) => {
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/rfis') && !url.includes('/rest/v1/rpc/')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/rfis`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Real DOM: pages/RFIs.tsx (line 1319) renders the New-RFI button with
  // data-testid="create-rfi-button" and aria-label="Create new RFI".
  await page
    .getByTestId('create-rfi-button')
    .click()

  // RFICreateWizard.tsx (line 867) renders the question textarea with
  // placeholder "What needs to be clarified?" — this is the title/subject
  // field (mapped to `title` on submit, line 671).
  await page
    .getByPlaceholder('What needs to be clarified?')
    .first()
    .fill(`${MARKER} subject`)

  // Optional details — the RFIRichTextEditor (line 946) renders a TipTap
  // editor. If a plain textarea exists in DOM, fill it as a smoke check;
  // otherwise skip — `description` falls back to the question on submit.
  const question = page.locator('textarea').nth(1)
  if (await question.count() > 0) {
    await question.fill('Synthetic B.2 regression test question.').catch(() => undefined)
  }

  // Submit — RFICreateWizard footer renders two buttons: "Save as Draft"
  // (line ~1361) and "Create as Open" (line ~1382). We exercise the
  // primary publish path.
  await page
    .getByRole('button', { name: 'Create as Open' })
    .first()
    .click()

  await page.waitForTimeout(2_000)

  for (const f of failures) {
    expect(f.body, `rfis create returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist|projects\.org_id/i)
  }

  await expect(page.locator('body')).toContainText(MARKER, { timeout: 10_000 })
})

test('B.2 — DB: RFI row persisted', async () => {
  const { data, error } = await admin
    .from('rfis')
    .select('id, title, project_id, status, created_at')
    .ilike('title', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  expect(error, error ? `rfis select failed: ${error.message}` : undefined).toBeNull()
  expect(data?.length ?? 0).toBeGreaterThan(0)
  expect(data![0].title).toContain(MARKER)
  expect(data![0].project_id).toBeTruthy()
})

test('B.2 — DB: audit_log entry exists with non-null org_id', async () => {
  const { data, error } = await admin
    .from('audit_log')
    .select('id, entity_type, action, organization_id, created_at')
    .eq('entity_type', 'rfi')
    .eq('action', 'create')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) test.skip(true, `audit_log not exposed: ${error.message}`)
  expect((data ?? []).length).toBeGreaterThan(0)
  expect(data![0].organization_id, 'rfi audit entry organization_id must be set').toBeTruthy()
})
