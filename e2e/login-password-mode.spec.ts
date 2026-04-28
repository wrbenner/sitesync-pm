import { test, expect } from '@playwright/test'

test('login page supports password mode toggle', async ({ page }) => {
  await page.goto('http://localhost:5174/sitesync-pm/#/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Initial — magic-link mode
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByText(/we'll send a sign-in link/i)).toBeVisible()
  expect(await page.locator('input[type="password"]').count()).toBe(0)

  await page.screenshot({ path: '/tmp/login-magic.png', fullPage: false })

  // Toggle to password
  await page.getByText('Sign in with password').click()
  await page.waitForTimeout(200)

  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByText(/sign in with your password/i)).toBeVisible()
  await expect(page.getByText(/use a sign-in link instead/i)).toBeVisible()

  await page.screenshot({ path: '/tmp/login-password.png', fullPage: false })

  // Toggle back
  await page.getByText('Use a sign-in link instead').click()
  await page.waitForTimeout(200)
  expect(await page.locator('input[type="password"]').count()).toBe(0)
  await expect(page.getByText(/we'll send a sign-in link/i)).toBeVisible()
})
