/**
 * Polish sweep — visits every production page and captures a full-page screenshot.
 * Screenshots land in polish-review/pages/<page>/<viewport>-NN-name.png via
 * Playwright's built-in screenshot mechanism.
 *
 * Auth: VITE_DEV_BYPASS=true skips Supabase auth so every route renders immediately.
 * Viewports are set per-project in playwright.polish.config.ts.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const PAGES = [
  { slug: 'dashboard',     hash: '#/dashboard',      name: 'page-01-dashboard' },
  { slug: 'daily-log',     hash: '#/daily-log',      name: 'page-02-daily-log' },
  { slug: 'schedule',      hash: '#/schedule',       name: 'page-03-schedule' },
  { slug: 'budget',        hash: '#/budget',         name: 'page-04-budget' },
  { slug: 'rfis',          hash: '#/rfis',           name: 'page-05-rfis' },
  { slug: 'submittals',    hash: '#/submittals',     name: 'page-06-submittals' },
  { slug: 'punch-list',    hash: '#/punch-list',     name: 'page-07-punch-list' },
  { slug: 'drawings',      hash: '#/drawings',       name: 'page-08-drawings' },
  { slug: 'change-orders', hash: '#/change-orders',  name: 'page-09-change-orders' },
  { slug: 'safety',        hash: '#/safety',         name: 'page-10-safety' },
  { slug: 'workforce',     hash: '#/workforce',      name: 'page-11-workforce' },
  { slug: 'crews',         hash: '#/crews',          name: 'page-12-crews' },
  { slug: 'time-tracking', hash: '#/time-tracking',  name: 'page-13-time-tracking' },
  { slug: 'directory',     hash: '#/directory',      name: 'page-14-directory' },
  { slug: 'meetings',      hash: '#/meetings',       name: 'page-15-meetings' },
  { slug: 'pay-apps',      hash: '#/pay-apps',       name: 'page-16-pay-apps' },
  { slug: 'contracts',     hash: '#/contracts',      name: 'page-17-contracts' },
  { slug: 'estimating',    hash: '#/estimating',     name: 'page-18-estimating' },
  { slug: 'equipment',     hash: '#/equipment',      name: 'page-19-equipment' },
  { slug: 'procurement',   hash: '#/procurement',    name: 'page-20-procurement' },
  { slug: 'permits',       hash: '#/permits',        name: 'page-21-permits' },
  { slug: 'files',         hash: '#/files',          name: 'page-22-files' },
  { slug: 'reports',       hash: '#/reports',        name: 'page-23-reports' },
  { slug: 'closeout',      hash: '#/closeout',       name: 'page-24-closeout' },
  { slug: 'bim',           hash: '#/bim',            name: 'page-25-bim' },
  { slug: 'ai',            hash: '#/ai',             name: 'page-26-ai' },
  { slug: 'audit-trail',   hash: '#/audit-trail',    name: 'page-27-audit-trail' },
  { slug: 'integrations',  hash: '#/integrations',   name: 'page-28-integrations' },
]

function viewportLabel(width: number): string {
  if (width <= 430) return 'iphone'
  if (width <= 1024) return 'ipad'
  return 'desktop'
}

for (const pg of PAGES) {
  test(pg.name, async ({ page }, testInfo) => {
    const { width } = testInfo.project.use.viewport ?? { width: 1440 }
    const vp = viewportLabel(width)
    const dir = path.resolve(`polish-review/pages/${pg.slug}`)
    fs.mkdirSync(dir, { recursive: true })

    await page.goto(pg.hash, { waitUntil: 'domcontentloaded' })

    // Wait for skeleton → content transition (max 8s)
    await page.waitForTimeout(1500)

    // Dismiss any loading skeletons — wait until they clear or timeout
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[aria-label="Loading page content"]').length === 0,
        { timeout: 6000 },
      )
    } catch {
      // If still loading, screenshot anyway — the loading state itself is useful triage info
    }

    const screenshotPath = path.join(dir, `${vp}-01-load.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })

    // Verify the page didn't crash to a blank white screen
    const body = await page.locator('body').boundingBox()
    expect(body).not.toBeNull()
    expect(body!.height).toBeGreaterThan(100)

    // Verify no full-page error overlay (allows individual component errors)
    const errorText = await page.locator('body').textContent()
    const hasCrash =
      errorText?.includes('Something went wrong') &&
      !errorText?.includes('SiteSync') // crash page won't have nav
    if (hasCrash) {
      // Attach screenshot as evidence but don't fail — flag for triage
      testInfo.annotations.push({ type: 'crash-detected', description: `${pg.slug} at ${vp}` })
    }
  })
}
