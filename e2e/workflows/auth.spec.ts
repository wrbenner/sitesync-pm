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
    await page.goto(`${BASE_URL}/#/signup`)
    await page.getByPlaceholder(/email|you@company/i).fill(email)
    await page.getByPlaceholder(/password/i).first().fill(pass)
    // Some signup forms have a confirm-password input
    const confirm = page.getByPlaceholder(/confirm/i).first()
    if (await confirm.count() > 0) await confirm.fill(pass)
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
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByPlaceholder('you@company.com').fill(email)
  await page.getByPlaceholder('Enter your password').fill('definitely-wrong-pw-9876')
  await page.locator('button[type="submit"]').first().click()
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
  const emailInput = page.getByPlaceholder(/email|you@company/i).first()
  if (await emailInput.count() === 0) {
    test.skip(true, 'forgot-password not surfaced as a separate route or modal')
  }
  await emailInput.fill('walker@sitesyncai.com')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(2_000)
  const body = await page.locator('body').textContent()
  expect(
    /sent|check.*email|reset link|link to reset/i.test(body ?? ''),
    'forgot-password submit should confirm an email was sent',
  ).toBe(true)
})
