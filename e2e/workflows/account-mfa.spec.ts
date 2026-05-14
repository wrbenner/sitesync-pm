/**
 * Workflow B.2 — Account · MFA: enroll + challenge regression spec.
 *
 * Exercises the MFA enrollment surface (MfaEnrollment.tsx mounted under
 * /profile, line 570 of UserProfile.tsx). The flow:
 *
 *   1. Profile page renders the "Two-factor authentication" card.
 *   2. If not enrolled, "Enable two-factor authentication" button starts
 *      Supabase MFA enrollment → opens QR modal with a 6-digit input.
 *   3. The challenge step (verify OTP) requires a real authenticator —
 *      we assert only the enrollment scaffold (QR + input render).
 *   4. If already enrolled, we assert the "Enabled" badge instead.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/workflows/account-mfa.spec.ts
 *
 * Authored: 2026-05-14 (Phase B.2 expansion — workflow #10/10)
 */
import { test, expect, type Page } from '@playwright/test'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

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

test('B.2 — UI: MFA card renders on /profile', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/profile`)
  await page
    .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
    .catch(() => undefined)

  // MfaEnrollment.tsx line 152: heading "Two-factor authentication".
  await expect(page.getByRole('heading', { name: /Two-factor authentication/i }))
    .toBeVisible({ timeout: 10_000 })
})

test('B.2 — UI: MFA enroll OR challenge state is interactive', async ({ page }) => {
  await signIn(page)
  await page.goto(`${BASE_URL}/#/profile`)
  await page.waitForTimeout(2_000)

  // Two branches:
  //   A. Not enrolled → "Enable two-factor authentication" button present
  //      (MfaEnrollment.tsx line 181). Click it to start enrollment; the
  //      QR modal should mount with the 6-digit "123456" placeholder
  //      input (line 289) — that's the challenge surface.
  //   B. Already enrolled → "Enabled" badge present (line 168). Confirms
  //      the challenge path was completed at least once for this user.

  const enableBtn = page.getByRole('button', { name: /Enable two-factor authentication/i })
  const enabledBadge = page.getByText(/^Enabled$/)

  if (await enabledBadge.count() > 0) {
    // Branch B: already enrolled — assert the Enabled badge is the live
    // marker and we don't need to enroll. Challenge has been verified.
    await expect(enabledBadge.first()).toBeVisible()
    return
  }

  // Branch A: not enrolled. Click to open the QR modal.
  await expect(enableBtn).toBeVisible({ timeout: 5_000 })
  await enableBtn.click()
  await page.waitForTimeout(1_500)

  // Modal title (line 213 — "Set up authenticator app") + 6-digit OTP
  // input (line 289, placeholder="123456").
  await expect(page.getByText(/Set up authenticator app/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByPlaceholder('123456')).toBeVisible()
})
