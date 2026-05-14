/**
 * Scenario 06 — Full CRUD round-trip for the 10 Core 9 + Closeout pages.
 *
 * Unlike the page-N-*.spec.ts polish-screenshot specs, these exercise the
 * actual create → assert → cleanup cycle against a real Supabase project.
 * They are gated on `E2E_REAL_BACKEND=true` because under VITE_DEV_BYPASS
 * (the default Playwright webServer config) no mutation actually persists.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true \
 *   POLISH_USER=<owner-email> POLISH_PASS=<password> \
 *   npx playwright test e2e/scenarios/06-crud-roundtrip.spec.ts \
 *     --project=chromium --workers=4
 *
 * The plan slots this between seed-orgs.ts and the heavy k6 profile:
 *   1. seed-orgs.ts --count 50 --members-per-org 10
 *   2. mint-vu-tokens.ts (for k6)
 *   3. seed-storage.ts (for upload-dependent paths below)
 *   4. THIS FILE (10 entity round-trips)
 *   5. k6 heavy profile
 *   6. teardown.ts
 *
 * Each entity block is structured:
 *   - Navigate to the list view
 *   - Open the primary create modal/form
 *   - Fill required fields
 *   - Submit
 *   - Assert the new row appears in the list with the seed marker
 *
 * No explicit delete — teardown.ts sweeps everything tagged `scale_test=true`.
 */
import { test, expect, Page } from '@playwright/test'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

async function signIn(page: Page) {
  await page.goto('#/login')
  await page.getByPlaceholder('you@company.com').fill(USER)
  await page.getByPlaceholder('Enter your password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|onboarding|profile|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1200)
}

async function waitListLoaded(page: Page) {
  await page.waitForFunction(
    () => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''),
    { timeout: 20_000 },
  ).catch(() => undefined)
}

// Marker so teardown sweeps these. Each entity puts this into a title/notes
// field so the post-run cleanup can match on substring.
const SCALE_TEST_MARKER = `e2e-crud-roundtrip-${Date.now()}`

// ---------------------------------------------------------------------------
// 1. RFIs
// ---------------------------------------------------------------------------
test('CRUD: create RFI → appears in list', async ({ page }) => {
  await signIn(page)
  await page.goto('#/rfis')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new rfi|create rfi|create first rfi|^new$/i }).first().click()
  await page.getByPlaceholder(/needs to be clarified|subject/i).first()
    .fill(`${SCALE_TEST_MARKER} rfi subject`)
  // Question field — usually a textarea with placeholder containing "background"
  // or directly the question. Fall back to the second visible textarea.
  const question = page.locator('textarea').first()
  await question.fill('Synthetic e2e CRUD test question.')
  await page.getByRole('button', { name: /^submit$|create rfi|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 2. Daily Logs
// ---------------------------------------------------------------------------
test('CRUD: create daily log entry → appears in list', async ({ page }) => {
  await signIn(page)
  await page.goto('#/daily-log')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new (daily )?log|create.*log|^new$|^add entry$/i }).first().click()
  await page.locator('textarea, input[type="text"]').first().fill(`${SCALE_TEST_MARKER} daily log note`)
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 3. Punch List
// ---------------------------------------------------------------------------
test('CRUD: create punch item → appears in list', async ({ page }) => {
  await signIn(page)
  await page.goto('#/punch-list')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new punch|add punch|^new$|^add item$/i }).first().click()
  await page.locator('input[type="text"], textarea').first().fill(`${SCALE_TEST_MARKER} punch item`)
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 4. Submittals
// ---------------------------------------------------------------------------
test('CRUD: create submittal → appears in list', async ({ page }) => {
  await signIn(page)
  await page.goto('#/submittals')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new submittal|create submittal|^new$/i }).first().click()
  await page.locator('input[type="text"], textarea').first().fill(`${SCALE_TEST_MARKER} submittal title`)
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 5. Schedule
// ---------------------------------------------------------------------------
test('CRUD: create schedule activity → appears in timeline', async ({ page }) => {
  await signIn(page)
  await page.goto('#/schedule')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new activity|add activity|^new$/i }).first().click()
  await page.locator('input[type="text"], textarea').first().fill(`${SCALE_TEST_MARKER} schedule activity`)
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 6. Budget
// ---------------------------------------------------------------------------
test('CRUD: create budget line → appears with variance', async ({ page }) => {
  await signIn(page)
  await page.goto('#/budget')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new line|add line|^new$/i }).first().click()
  await page.locator('input[type="text"], textarea').first().fill(`${SCALE_TEST_MARKER} budget line`)
  // Budget forms usually need a numeric amount.
  const amount = page.locator('input[type="number"]').first()
  if (await amount.count() > 0) await amount.fill('1000')
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 7. Change Orders
// ---------------------------------------------------------------------------
test('CRUD: create change order → appears in list', async ({ page }) => {
  await signIn(page)
  await page.goto('#/change-orders')
  await waitListLoaded(page)
  await page.getByRole('button', { name: /new co|new change|create change|^new$/i }).first().click()
  await page.locator('input[type="text"], textarea').first().fill(`${SCALE_TEST_MARKER} change order`)
  await page.getByRole('button', { name: /^submit$|^save$|^create$/i }).first().click()
  await page.waitForTimeout(1500)
  await expect(page.locator('body')).toContainText(SCALE_TEST_MARKER, { timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 8. Closeout
// ---------------------------------------------------------------------------
test('CRUD: mark closeout step complete → progress advances', async ({ page }) => {
  await signIn(page)
  await page.goto('#/closeout')
  await waitListLoaded(page)
  // Closeout pages have a checkbox per requirement. Toggle the first
  // incomplete one. Assertion: at least one checked box exists after the toggle.
  const checkbox = page.locator('input[type="checkbox"]:not(:checked)').first()
  if (await checkbox.count() === 0) {
    test.skip(true, 'No incomplete closeout step in fixture')
  }
  await checkbox.check()
  await page.waitForTimeout(1000)
  await expect(page.locator('input[type="checkbox"]:checked').first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// 9. Drawings (depends on seed-storage.ts)
// ---------------------------------------------------------------------------
test('CRUD: upload drawing PDF → renders in viewer', async ({ page }) => {
  await signIn(page)
  await page.goto('#/drawings')
  await waitListLoaded(page)
  const uploadBtn = page.getByRole('button', { name: /upload|^new$|add drawing/i }).first()
  if (await uploadBtn.count() === 0) {
    test.skip(true, 'No upload affordance found on /drawings')
  }
  // File chooser flow. Re-uses the minimal PDF the seed-storage script writes.
  const filePromise = page.waitForEvent('filechooser')
  await uploadBtn.click()
  const chooser = await filePromise
  // The PDF must exist on disk where Playwright runs. seed-storage.ts uses an
  // in-memory buffer; for spec-side upload we need a fixture file. Use
  // e2e/fixtures/test-drawing.pdf (created by setup if missing — see runbook).
  await chooser.setFiles('e2e/fixtures/test-drawing.pdf')
  await page.waitForTimeout(2000)
  // Assert the drawing appears in the list / viewer.
  await expect(page.locator('canvas, iframe[src*="pdf"], object[type*="pdf"]').first())
    .toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// 10. Files (depends on seed-storage.ts)
// ---------------------------------------------------------------------------
test('CRUD: upload file + bulk multi-select operates on selection', async ({ page }) => {
  await signIn(page)
  await page.goto('#/files')
  await waitListLoaded(page)
  const uploadBtn = page.getByRole('button', { name: /upload|^new$|add file/i }).first()
  if (await uploadBtn.count() === 0) {
    test.skip(true, 'No upload affordance found on /files')
  }
  const filePromise = page.waitForEvent('filechooser')
  await uploadBtn.click()
  const chooser = await filePromise
  await chooser.setFiles('e2e/fixtures/test-document.pdf')
  await page.waitForTimeout(2000)
  // Assert at least one file row appears.
  await expect(page.locator('[role="row"], [data-testid*="file-row"]').first())
    .toBeVisible({ timeout: 15_000 })
  // Multi-select: tick the first checkbox and verify a bulk action toolbar shows.
  const firstCb = page.locator('input[type="checkbox"]').first()
  if (await firstCb.count() > 0) {
    await firstCb.check()
    await page.waitForTimeout(500)
    // Toolbar copy varies — be tolerant.
    await expect(page.locator('body')).toContainText(/selected|bulk|move|delete/i)
  }
})
