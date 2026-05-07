/**
 * Auth setup for the polish-audit Playwright project.
 *
 * Reads credentials from environment variables at runtime — never from
 * disk, never hard-coded:
 *   POLISH_USER  — email
 *   POLISH_PASS  — password
 *
 * On success, persists the authenticated browser-context state to
 * playwright/.auth/user.json so the audit spec can reuse it without
 * re-logging-in 60+ times. That file contains a live session token
 * and is .gitignore'd.
 *
 * Run as part of `playwright.polish.config.ts` — not the main suite.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json')

setup('authenticate polish-audit user', async ({ page }) => {
  const email = process.env.POLISH_USER
  const password = process.env.POLISH_PASS
  if (!email || !password) {
    throw new Error(
      'POLISH_USER and POLISH_PASS env vars must be set before running the polish audit.',
    )
  }

  await page.goto('#/login')

  // The redesigned login starts in magic-link mode. Switch to password mode.
  const toggle = page.getByRole('button', { name: /sign in with password/i }).first()
  if (await toggle.count() > 0) {
    await toggle.click()
    await page.waitForTimeout(200)
  }
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.locator('button[type="submit"]').first().click()

  // After login the app redirects to / (→ /day), /dashboard, /onboarding, or /profile.
  await page.waitForURL(/#\/(day|dashboard|onboarding|profile|$)/, { timeout: 20_000 })

  // Belt-and-suspenders: confirm we're not still on /login.
  expect(page.url()).not.toMatch(/#\/login/)

  await page.context().storageState({ path: STATE_FILE })
})
