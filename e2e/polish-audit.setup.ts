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
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.resolve(__dirname, '..', 'playwright', '.auth', 'user.json')
const SESSION_FILE = path.resolve(__dirname, '..', 'playwright', '.auth', 'session.json')
const SUPABASE_PROJECT_REF = 'hypxrmcppjfbtlwuoafc'
const LS_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`

setup('authenticate polish-audit user', async ({ page }) => {
  const email = process.env.POLISH_USER
  const password = process.env.POLISH_PASS
  if (!email || !password) {
    throw new Error(
      'POLISH_USER and POLISH_PASS env vars must be set before running the polish audit.',
    )
  }

  if (existsSync(SESSION_FILE)) {
    // Inject pre-fetched session into browser storage (avoids browser→Supabase network).
    const sessionJson = readFileSync(SESSION_FILE, 'utf-8')
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(([key, value]) => { localStorage.setItem(key, value) }, [LS_KEY, sessionJson])
    await page.goto('#/day')
    await page.waitForURL(/#\/(day|dashboard|onboarding|profile)/, { timeout: 15_000 }).catch(() => undefined)
  } else {
    // Fallback: UI-based sign-in
    await page.goto('#/login')
    const pwBtn = page.getByRole('button', { name: /sign in with password/i })
    if (await pwBtn.count() > 0) await pwBtn.click()
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await page.locator('button[type="submit"]').first().click()
    await page.waitForURL(/#\/(day|dashboard|onboarding|profile|$)/, { timeout: 20_000 })
  }

  expect(page.url()).not.toMatch(/#\/login/)
  await page.context().storageState({ path: STATE_FILE })
})
