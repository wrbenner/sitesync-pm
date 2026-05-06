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

  // The login form uses placeholder-based inputs; locate by role/type.
  await page.getByPlaceholder('you@company.com').fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)

  // Two "Sign In" buttons exist — the tab control and the form submit.
  // Target the submit button by type to avoid the ambiguity.
  await page.locator('button[type="submit"]').first().click()

  // Successful login can land on any of these depending on whether the
  // user has a project yet. Accept any of them as proof of auth.
  await page.waitForURL(/#\/(dashboard|onboarding|profile|$)/, { timeout: 20_000 })

  // Belt-and-suspenders: confirm we're not still on /login.
  expect(page.url()).not.toMatch(/#\/login/)

  await page.context().storageState({ path: STATE_FILE })
})
