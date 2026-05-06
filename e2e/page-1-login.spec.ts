/**
 * PAGE 1 — /login — Full e2e verification.
 *
 * Drives the login page workflows and captures every state.
 *
 * The current login design:
 * - Magic-link mode by default: single email input (no placeholder), submit pill
 * - Toggle at bottom: "Sign in with password" switches to password mode
 * - Password mode: email field (placeholder="Email") + password field (placeholder="Password")
 * - "Use a sign-in link" toggles back to magic mode
 * - Google + Microsoft OAuth buttons always visible
 * - "Sign up" link at bottom
 *
 * Output:
 *   polish-review/pages/login/<viewport>-<NN>-<state>.png
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'login')

const USER = process.env.POLISH_USER ?? 'demo@example.com'
const PASS = process.env.POLISH_PASS ?? 'demo-password'

async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined)
  await page.waitForTimeout(ms)
}

async function shot(page: Page, viewport: string, n: number, name: string) {
  const filename = `${viewport}-${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: true,
  }).catch(() => undefined)
}

const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'ipad',    width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Login E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      // Override to NOT use storageState so we hit the real login page.
      storageState: { cookies: [], origins: [] },
    })

    test('full login workflow', async ({ page }) => {
      // ────────────────────────────────────────────────────────
      // STATE 01 — Cold landing on /login (magic-link mode default)
      // ────────────────────────────────────────────────────────
      await page.goto('#/login')
      await settle(page, 400)

      // Functional assert: email input rendered (magic mode — no placeholder)
      const emailInput = page.locator('input[type="email"]')
      await expect(emailInput).toBeVisible({ timeout: 8_000 })

      // Mode-toggle button should read "Sign in with password" in magic mode
      const pwdModeBtn = page.getByRole('button', { name: /sign in with password/i })
      await expect(pwdModeBtn).toBeVisible({ timeout: 5_000 })

      await shot(page, vp.name, 1, 'magic-link-empty')

      // ────────────────────────────────────────────────────────
      // STATE 02 — Fill email in magic-link mode
      // ────────────────────────────────────────────────────────
      await emailInput.fill('test@example.com')
      await settle(page, 200)
      await shot(page, vp.name, 2, 'magic-link-filled')

      // ────────────────────────────────────────────────────────
      // STATE 03 — Switch to password mode
      // ────────────────────────────────────────────────────────
      await pwdModeBtn.click().catch(() => undefined)
      await settle(page, 300)

      // In password mode: email field has placeholder="Email", password has "Password"
      const pwdInput = page.locator('input[type="password"]')
      await expect(pwdInput).toBeVisible({ timeout: 5_000 })

      await shot(page, vp.name, 3, 'password-mode-empty')

      // ────────────────────────────────────────────────────────
      // STATE 04 — Fill bad credentials (error state)
      // ────────────────────────────────────────────────────────
      const emailInPwdMode = page.locator('input[type="email"]')
      await emailInPwdMode.fill('not-a-real-user@example.com').catch(() => undefined)
      await pwdInput.fill('definitely-wrong-password').catch(() => undefined)
      await page.locator('button[type="submit"]').first().click().catch(() => undefined)
      await settle(page, 1500)
      await shot(page, vp.name, 4, 'password-mode-bad-creds-error')

      // ────────────────────────────────────────────────────────
      // STATE 05 — Switch back to magic-link mode
      // ────────────────────────────────────────────────────────
      const magicModeBtn = page.getByRole('button', { name: /use a sign-in link/i })
      if (await magicModeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await magicModeBtn.click()
        await settle(page, 300)
        await shot(page, vp.name, 5, 'back-to-magic-link')
      }

      // ────────────────────────────────────────────────────────
      // STATE 06 — OAuth buttons visible
      // ────────────────────────────────────────────────────────
      const googleBtn = page.getByRole('button', { name: /google/i }).first()
      if (await googleBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await shot(page, vp.name, 6, 'oauth-buttons-visible')
      }

      // ────────────────────────────────────────────────────────
      // STATE 07 — Sign up link
      // ────────────────────────────────────────────────────────
      const signUpLink = page.getByRole('link', { name: /sign up/i }).first()
      if (await signUpLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await shot(page, vp.name, 7, 'signup-link-visible')
      }

      // ────────────────────────────────────────────────────────
      // STATE 08 — Sign-up page
      // ────────────────────────────────────────────────────────
      await page.goto('#/signup').catch(() => undefined)
      await settle(page, 500)
      await shot(page, vp.name, 8, 'signup-page')

      // Fill visible inputs on signup page generically
      const signupInputs = page.locator('input:visible')
      const signupCount = await signupInputs.count().catch(() => 0)
      for (let i = 0; i < signupCount; i++) {
        const inp = signupInputs.nth(i)
        const type = await inp.getAttribute('type').catch(() => null)
        const placeholder = await inp.getAttribute('placeholder').catch(() => null)
        if (type === 'email') await inp.fill('demo+test@example.com').catch(() => undefined)
        else if (type === 'password') await inp.fill('SuperSecure123!').catch(() => undefined)
        else if (placeholder?.match(/first/i)) await inp.fill('Demo').catch(() => undefined)
        else if (placeholder?.match(/last/i)) await inp.fill('User').catch(() => undefined)
        else if (placeholder?.match(/company|name/i)) await inp.fill('Demo Co').catch(() => undefined)
      }
      await settle(page, 200)
      await shot(page, vp.name, 9, 'sign-up-filled')

      // ────────────────────────────────────────────────────────
      // STATE 10 — Successful Sign In with real credentials
      // ────────────────────────────────────────────────────────
      await page.goto('#/login')
      await settle(page, 400)

      // Switch to password mode
      const pwdToggle = page.getByRole('button', { name: /sign in with password/i })
      if (await pwdToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await pwdToggle.click()
        await settle(page, 200)
      }

      await page.locator('input[type="email"]').fill(USER).catch(() => undefined)
      await page.locator('input[type="password"]').fill(PASS).catch(() => undefined)
      await shot(page, vp.name, 10, 'sign-in-credentials-filled')

      await page.locator('button[type="submit"]').first().click().catch(() => undefined)

      // If dev bypass is active we landed on dashboard immediately (no Supabase)
      await page.waitForURL(
        (url) => !url.toString().includes('#/login'),
        { timeout: 5_000 },
      ).catch(() => undefined)
      await settle(page, 1200)
      await shot(page, vp.name, 11, 'post-login-landing')
    })
  })
}
