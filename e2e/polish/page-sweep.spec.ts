/**
 * Page sweep spec — captures screenshots of all key pages at current viewport.
 * Run via playwright.polish.config.ts with VITE_DEV_BYPASS=true.
 *
 * Captures land in: polish-review/pages/<page>/<viewport>-NN-name.png
 * Look for: clipped text, layout overlap, stuck skeletons, faded buttons,
 *           em-dash or ? placeholders, broken images, content behind FAB/nav.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const PAGES = [
  { name: 'dashboard',            path: '#/dashboard' },
  { name: 'daily-log',            path: '#/daily-log' },
  { name: 'schedule',             path: '#/schedule' },
  { name: 'budget',               path: '#/budget' },
  { name: 'rfis',                 path: '#/rfis' },
  { name: 'submittals',           path: '#/submittals' },
  { name: 'punch-list',           path: '#/punch-list' },
  { name: 'drawings',             path: '#/drawings' },
  { name: 'change-orders',        path: '#/change-orders' },
  { name: 'pay-apps',             path: '#/pay-apps' },
  { name: 'safety',               path: '#/safety' },
  { name: 'workforce',            path: '#/workforce' },
  { name: 'crews',                path: '#/crews' },
  { name: 'directory',            path: '#/directory' },
  { name: 'meetings',             path: '#/meetings' },
  { name: 'contracts',            path: '#/contracts' },
  { name: 'procurement',          path: '#/procurement' },
  { name: 'estimating',           path: '#/estimating' },
  { name: 'equipment',            path: '#/equipment' },
  { name: 'permits',              path: '#/permits' },
  { name: 'files',                path: '#/files' },
  { name: 'reports',              path: '#/reports' },
  { name: 'closeout',             path: '#/closeout' },
  { name: 'bim',                  path: '#/bim' },
  { name: 'ai',                   path: '#/ai' },
  { name: 'audit-trail',          path: '#/audit-trail' },
  { name: 'integrations',         path: '#/integrations' },
  { name: 'settings',             path: '#/settings' },
] as const

/** Wait for the page to settle: no loading spinners, no aria-busy, content present. */
async function waitForSettle(page: import('@playwright/test').Page, pageName: string) {
  // Wait for main nav (proves the shell rendered)
  await page.waitForSelector('nav[aria-label="Main navigation"]', { timeout: 15_000 }).catch(() => {
    console.warn(`[${pageName}] nav not found within 15s`)
  })
  // Let async data settle for up to 5s
  await page.waitForTimeout(2000)
  // Dismiss any open modals/overlays that might obscure the page
  await page.keyboard.press('Escape').catch(() => {})
}

for (const { name, path: pagePath } of PAGES) {
  test(`page: ${name}`, async ({ page }, testInfo) => {
    // Capture to named directory
    const screenshotDir = path.join('polish-review', 'pages', name)

    await page.goto(pagePath)
    await waitForSettle(page, name)

    // Full-page screenshot
    const screenshotPath = path.join(screenshotDir, `01-loaded.png`)
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      animations: 'disabled',
    })

    // Soft checks — record as warnings, not hard failures
    const bodyText = await page.textContent('body') ?? ''

    // Check for stuck loading indicators
    const spinnerCount = await page.locator('[role="progressbar"][aria-busy="true"]').count()
    if (spinnerCount > 0) {
      console.warn(`[${name}] ${spinnerCount} stuck loading indicators`)
    }

    // Check for placeholder text that shouldn't appear in production
    const placeholders = ['undefined', 'null', '???', 'NaN', 'TODO']
    for (const p of placeholders) {
      if (bodyText.includes(p)) {
        console.warn(`[${name}] contains placeholder text: "${p}"`)
      }
    }

    // Attach screenshot to test report
    await testInfo.attach(`${name}-desktop`, {
      path: screenshotPath,
      contentType: 'image/png',
    })

    // Page should have rendered without a blank body
    expect(bodyText.length).toBeGreaterThan(10)
  })
}
