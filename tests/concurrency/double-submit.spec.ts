/**
 * FMEA I.IDEM.2 + M.FORM.1 — Double-submit creates duplicate RFI.
 *
 * Hazard: a user mashes Enter then immediately clicks the "Create as Open"
 * button (or double-clicks the button itself). Without idempotency
 * middleware / disabled-button-while-pending UX, two POST /rfis fire and
 * two rows land in the DB.
 *
 * What we exercise:
 *   1. Sign in to the live app (E2E_REAL_BACKEND=true).
 *   2. Open the RFI create wizard, fill the title with a unique MARKER.
 *   3. Within the same tick, press Enter on the title input AND click the
 *      "Create as Open" button. The Playwright .click() doesn't await
 *      the network, so this lands BOTH events before the UI can disable.
 *   4. Wait for navigation/toast settle.
 *   5. Query the rfis table (service-role) for rows whose title starts with
 *      MARKER. Expect exactly 1.
 *
 * If this fails (>1), file a loop-detected-bug — platform-diagnoser should
 * either disable the submit button on first click OR add an idempotency
 * token middleware to /rest/v1/rfis.
 *
 * Catalog: I.IDEM.2 + M.FORM.1 (Section I/M, hazard #33).
 *
 * Note: this spec lives under tests/concurrency/ (vitest's exclude list
 * skips this dir, see vitest.config.ts) and is matched by playwright via
 * the testMatch pattern below. Run with:
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<url> POLISH_USER=... POLISH_PASS=... \
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *   npx playwright test tests/concurrency/double-submit.spec.ts
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
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required for DB-side assertion',
)
test.skip(
  REAL_BACKEND && (!USER || !PASS),
  'POLISH_USER + POLISH_PASS required to sign in',
)

let admin: SupabaseClient
const MARKER = `double-submit-${Date.now()}`

test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

test.afterAll(async () => {
  if (admin) {
    // Sweep any rows the test created so re-runs stay deterministic.
    await admin.from('rfis').delete().ilike('title', `${MARKER}%`)
  }
})

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

test('FMEA I.IDEM.2 — rapid Enter + click produces exactly 1 RFI row', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/rfis`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  await page.getByTestId('create-rfi-button').click()

  const titleInput = page.getByPlaceholder('What needs to be clarified?')
  await titleInput.first().fill(`${MARKER} subject`)

  // Tight double-fire: kick both events without awaiting between them.
  // The submit handler likely posts to PostgREST without disabling the
  // button. If the platform has no idempotency middleware, both events
  // race to the DB and we get 2 rows.
  const submit = page.getByRole('button', { name: 'Create as Open' }).first()
  await Promise.all([
    submit.click().catch(() => undefined),
    titleInput.first().press('Enter').catch(() => undefined),
  ])

  // Wait for both potential round-trips to settle.
  await page.waitForTimeout(3_000)

  // DB assertion — source of truth.
  const { data, error } = await admin
    .from('rfis')
    .select('id, title, created_at')
    .ilike('title', `${MARKER}%`)
    .order('created_at', { ascending: false })

  expect(error, error ? `rfis select failed: ${error.message}` : undefined).toBeNull()
  const count = data?.length ?? 0
  expect(
    count,
    `expected exactly 1 RFI row matching ${MARKER}; got ${count}. ` +
      `If > 1, FMEA I.IDEM.2/M.FORM.1 is a real hazard — file loop-detected-bug.`,
  ).toBe(1)
})
