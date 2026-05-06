/**
 * Shared fixtures for the polish e2e sweep.
 *
 * - Handles login with POLISH_USER / POLISH_PASS env vars.
 * - Falls back to dev-bypass when no credentials are set.
 * - Provides a `screenshotPath(name)` helper for consistent capture paths.
 */

import { test as base, expect } from '@playwright/test'
import path from 'path'

export { expect }

type PolishFixtures = {
  /** Absolute path for a named screenshot under polish-review/pages/<page>/. */
  screenshotPath: (name: string) => string
  /** Whether real credentials are available. */
  hasAuth: boolean
}

export const test = base.extend<PolishFixtures>({
  screenshotPath: async ({}, use, testInfo) => {
    const fn = (name: string) => {
      const page = testInfo.titlePath[0].replace(/[^a-z0-9]/gi, '-').toLowerCase()
      return path.join('polish-review', 'pages', page, `${name}.png`)
    }
    await use(fn)
  },

  hasAuth: async ({}, use) => {
    await use(!!process.env.POLISH_USER && !!process.env.POLISH_PASS)
  },
})

/**
 * Login helper — call once per spec file in beforeAll.
 * When dev-bypass is active (no credentials), this is a no-op.
 */
export async function loginIfNeeded(page: import('@playwright/test').Page) {
  if (!process.env.POLISH_USER || !process.env.POLISH_PASS) return

  await page.goto('/auth/login')
  await page.fill('input[type="email"]', process.env.POLISH_USER)
  await page.fill('input[type="password"]', process.env.POLISH_PASS)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|#\/)/, { timeout: 15_000 })
}
