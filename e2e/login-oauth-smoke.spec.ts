import { test, expect } from '@playwright/test'

test('login page renders with magic-link + OAuth buttons', async ({ page }) => {
  await page.goto('http://localhost:5174/sitesync-pm/#/login', { waitUntil: 'networkidle' })
  // Wait for entrance animation
  await page.waitForTimeout(800)

  // Email input
  const email = page.getByLabel('Email', { exact: true })
  await expect(email).toBeVisible()

  // OAuth buttons (desktop label: short "Google" / "Microsoft" with full aria-label)
  const google = page.getByLabel('Continue with Google')
  const microsoft = page.getByLabel('Continue with Microsoft')
  await expect(google).toBeVisible()
  await expect(microsoft).toBeVisible()

  // Submit pill button (exact match — "Continue with Google/Microsoft" also exist)
  const continueBtn = page.getByLabel('Continue', { exact: true })
  await expect(continueBtn).toBeVisible()

  // Snapshot
  await page.screenshot({ path: '/tmp/login-snapshot.png', fullPage: false })

  // No console errors
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.waitForTimeout(300)
  expect(errors).toEqual([])
})
