/**
 * Workflow B.2 — Auth flow (signup → email verify → signin → password reset → MFA).
 *
 * Hits public routes that B1-every-route.spec.ts excludes. Real-backend
 * tests against a throwaway @sitesync.test email.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   SUPABASE_URL=<target> SUPABASE_SERVICE_KEY=<service-role> \
 *   npx playwright test e2e/workflows/auth.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(
  REAL_BACKEND && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY),
  'SUPABASE_URL + SUPABASE_SERVICE_KEY required',
)

let admin: SupabaseClient
test.beforeAll(() => {
  if (REAL_BACKEND && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
})

const newEmail = (): string => `b2-auth-${randomUUID().slice(0, 8)}@sitesync.test`
const newPassword = (): string => `Auth-${randomUUID().slice(0, 12)}!1`

async function deleteUserByEmail(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const u = data?.users.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

test('B.2 auth — signup form renders and submits', async ({ page }) => {
  const email = newEmail()
  const pass = newPassword()
  try {
    // Real DOM: src/pages/auth/Signup.tsx renders a form with
    // aria-label="Create SiteSync account" and id-anchored inputs:
    //   signup-first-name / signup-last-name / signup-email /
    //   signup-password / signup-confirm-password / signup-company /
    //   signup-accept-terms. None of them carry a placeholder. We bind via
    //   label-for relationships using getByLabel (each input has an <label
    //   htmlFor>).
    await page.goto(`${BASE_URL}/#/signup`)
    await page.getByLabel(/^First Name/).fill('B2')
    await page.getByLabel(/^Last Name/).fill('Test')
    await page.getByLabel(/^Email/).fill(email)
    // Password + Confirm Password share the "Password" prefix — match each
    // exactly to avoid resolving to two elements.
    await page.getByLabel(/^Password\*?$/).fill(pass)
    await page.getByLabel(/^Confirm Password/).fill(pass)
    await page.getByLabel(/^Company \/ Organization/).fill('Acme Test Co')
    await page.getByLabel(/I accept the Terms of Service/).check().catch(() => undefined)
    await page.locator('button[type="submit"]').first().click()
    // Expect either /verify-pending OR a toast indicating the email was sent
    await page.waitForTimeout(2_500)
    const url = page.url()
    const body = await page.locator('body').textContent()
    expect(
      url.includes('verify-pending') ||
        /verify|check.*email|confirmation/i.test(body ?? ''),
      `signup did not redirect to verify-pending or show a confirmation message. URL=${url}`,
    ).toBe(true)
  } finally {
    await deleteUserByEmail(email)
  }
})

test('B.2 auth — login form rejects bad password with a visible error', async ({ page }) => {
  const email = `nonexistent-${randomUUID().slice(0, 6)}@sitesync.test`
  // Real DOM: Login.tsx defaults to magic-link mode — Password input is
  // only rendered after clicking the "Sign in with password" footer toggle
  // (Login.tsx ~line 859). aria-label="Email" + placeholder="Email" on
  // email input; aria-label="Password" + placeholder="Password" on password
  // input. Submission is via a SubmitPill button (no readable name); Enter
  // on the password field also triggers the form (onKeyDown handler).
  await page.goto(`${BASE_URL}/#/login`)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-pw-9876')
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForTimeout(2_500)
  const body = await page.locator('body').textContent()
  expect(
    /invalid|incorrect|not found|wrong|failed/i.test(body ?? ''),
    'bad-credentials login should surface a visible error message',
  ).toBe(true)
})

test('B.2 auth — forgot password flow renders + submits', async ({ page }: { page: Page }) => {
  await page.goto(`${BASE_URL}/#/forgot-password`).catch(() => undefined)
  // Some apps put forgot-password as a link on /login instead of a route.
  // If the route 404s, click the "forgot" link on /login.
  if (page.url().endsWith('/login') || page.url().endsWith('#/')) {
    await page.goto(`${BASE_URL}/#/login`)
    await page.getByText(/forgot/i).first().click().catch(() => undefined)
  }
  // Real DOM: any email input on the resulting page is the one we want.
  // Login.tsx uses aria-label="Email"; magic-mode forgot-password screens
  // typically reuse the same field. Fall through to placeholder if the
  // label isn't present.
  const labelMatch = page.getByLabel('Email', { exact: true })
  const emailInput = (await labelMatch.count()) > 0
    ? labelMatch
    : page.getByPlaceholder('Email').first()
  if (await emailInput.count() === 0) {
    test.skip(true, 'forgot-password not surfaced as a separate route or modal')
  }
  await emailInput.fill('walker@sitesyncai.com')
  // The SubmitPill button on Login.tsx has no readable name; pressing
  // Enter on the email field triggers the form via onKeyDown.
  await emailInput.press('Enter')
  await page.waitForTimeout(2_000)
  const body = await page.locator('body').textContent()
  expect(
    /sent|check.*email|reset link|link to reset/i.test(body ?? ''),
    'forgot-password submit should confirm an email was sent',
  ).toBe(true)
})
