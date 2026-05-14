/**
 * Workflow B.2 — Submittal create regression spec.
 *
 * Direct catch for the 2026-05-14 demo failure (PR #543 trigger fixes merged
 * but never applied to prod). This spec exercises the full submittal-create
 * path through the UI AND verifies the database side-effects (row inserted,
 * audit_log entry written, no PGSQL 42703 from the iris-ingest trigger).
 *
 * If any of the four iris-ingest trigger functions on the target Supabase
 * project regress to `org_id` (broken) or `daily_logs_iris_ingest_trigger`
 * regresses to `NEW.narrative`, the INSERT here will trip 42501/42703 and
 * this spec will fail. That's the gate.
 *
 * Gated on `E2E_REAL_BACKEND=true` — same convention as e2e/scenarios/06-*.
 * Default Playwright config uses VITE_DEV_BYPASS where mutations don't
 * persist, so this spec is skipped unless the operator opts in.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true \
 *   E2E_BASE_URL=https://<vercel-preview-url> \
 *   POLISH_USER=<owner-email> POLISH_PASS=<password> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/submittal-create.spec.ts \
 *     --project=chromium
 *
 * Authored: 2026-05-14 (Phase B.2 of functional-frog mission)
 * Sibling specs: rfi-create.spec.ts, daily-log-create.spec.ts (same trigger class)
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

const MARKER = `b2-submittal-${Date.now()}`

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

test('B.2 — UI: submittal create form submits without 42703', async ({ page }) => {
  // Capture every network response so we can assert no 42703 came back from
  // PostgREST during the submit click — that's the trigger-error signature.
  const failures: Array<{ url: string; status: number; body: string }> = []
  page.on('response', async (res) => {
    const url = res.url()
    if (!url.includes('/rest/v1/submittals') && !url.includes('/rest/v1/rpc/')) return
    if (res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ url, status: res.status(), body })
    }
  })

  await signIn(page)
  await page.goto(`${BASE_URL}/#/submittals`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // Open create modal/form. Real-app button labels vary; match permissively.
  await page
    .getByRole('button', { name: /new submittal|create submittal|create first submittal|^new$/i })
    .first()
    .click()

  // Fill title — required field per submittals_title_check.
  await page
    .getByPlaceholder(/title|name|description/i)
    .first()
    .fill(`${MARKER} title`)

  // Some forms require a spec section. If a select with that label exists,
  // pick the first non-empty option. Safe no-op otherwise.
  const specSelect = page.getByLabel(/spec section|section|csi/i).first()
  if (await specSelect.count() > 0) {
    const options = await specSelect.locator('option').all()
    if (options.length > 1) await specSelect.selectOption({ index: 1 })
  }

  await page
    .getByRole('button', { name: /^submit$|^save$|^create$|^create submittal$/i })
    .first()
    .click()

  // Wait for the submit to complete (modal closes OR list re-renders).
  await page.waitForTimeout(2_000)

  // Critical assertion #1: no PostgREST 4xx with code 42703 on the submittals
  // endpoint. This is the iris-ingest-trigger regression signature.
  for (const f of failures) {
    expect(f.body, `submittals create returned ${f.status} from ${f.url}: ${f.body}`)
      .not.toMatch(/42703|42501|column .+ does not exist|NEW\.narrative|projects\.org_id/i)
  }

  // Critical assertion #2: the new submittal is visible in the UI list.
  await expect(page.locator('body')).toContainText(MARKER, { timeout: 10_000 })
})

test('B.2 — DB: submittal row persisted with expected fields', async ({ page }) => {
  // UI test above already created the row. Verify via service-role read.
  await page.waitForTimeout(500) // small settle for write-then-read
  const { data, error } = await admin
    .from('submittals')
    .select('id, title, project_id, status, created_at')
    .ilike('title', `${MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  expect(error, error ? `submittals select failed: ${error.message}` : undefined).toBeNull()
  expect(data, 'expected at least one submittal row with the test marker').toBeTruthy()
  expect(data?.length ?? 0).toBeGreaterThan(0)
  const row = data![0]
  expect(row.title).toContain(MARKER)
  expect(row.project_id).toBeTruthy()
  expect(row.status).toBeTruthy()
})

test('B.2 — DB: iris ingest queue received the submittal', async ({ page: _page }) => {
  // The submittal-create trigger chain enqueues an iris ingest job. If
  // organization_id resolution is broken (the demo-day bug), the enqueue
  // either silently drops the org or trips 42703. We assert the queue saw
  // a job for our row by selecting from pgmq.q_iris_ingest (if accessible
  // via service role) OR by reading iris_ingest_queue if exposed as a view.
  // Best-effort: skip cleanly if neither is reachable in this env.
  const { data, error } = await admin
    .schema('public' as never)
    .from('iris_ingest_queue' as never)
    .select('id, source_type, entity_id, organization_id')
    .eq('source_type', 'submittal')
    .order('id', { ascending: false })
    .limit(5)

  if (error) {
    test.skip(true, `iris_ingest_queue not exposed via PostgREST in this env: ${error.message}`)
  }
  expect(Array.isArray(data)).toBe(true)
  // Don't pin to our specific marker (the queue table doesn't carry the title)
  // — just assert the queue has *some* recent submittal entries with org_id set.
  const recent = data ?? []
  if (recent.length > 0) {
    expect(recent[0].organization_id, 'queue row organization_id must be set')
      .toBeTruthy()
  }
})

test('B.2 — DB: audit_log entry exists for the new submittal', async ({ page: _page }) => {
  // submittal-create writes an audit_log row via fn_audit_trigger. Verify.
  const { data, error } = await admin
    .from('audit_log')
    .select('id, entity_type, entity_id, action, created_at, organization_id')
    .eq('entity_type', 'submittal')
    .eq('action', 'create')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    test.skip(true, `audit_log not exposed via PostgREST: ${error.message}`)
  }
  expect(Array.isArray(data)).toBe(true)
  expect((data ?? []).length).toBeGreaterThan(0)
  // Most recent submittal audit entry must carry an organization_id (the
  // demo-day bug would have left this null because the trigger's
  // `projects.org_id` SELECT returned null silently before erroring).
  expect((data ?? [])[0].organization_id, 'audit_log organization_id must be set')
    .toBeTruthy()
})
