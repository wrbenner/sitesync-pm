/**
 * Polish sweep — full-page screenshots at 3 viewports for every key route.
 *
 * Screenshots land in:
 *   polish-review/pages/<pageName>/<viewport>-01-initial.png
 *   polish-review/pages/<pageName>/<viewport>-02-scrolled.png  (if page scrolls)
 *
 * Failures are NOT expected to block the sweep; each page test is independent
 * so one broken page doesn't cancel the rest.
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ── Viewport definitions ──────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'iphone',   width: 393,  height: 852  },
  { name: 'ipad',     width: 1024, height: 1366 },
  { name: 'desktop',  width: 1440, height: 900  },
] as const

// ── Page registry (28 key routes) ────────────────────────────────────────────

const PAGES = [
  // ── Demo critical path ─────────────────────────────────────────────────────
  { name: 'dashboard',           hash: '#/dashboard',           label: 'Command Center' },
  { name: 'rfis',                hash: '#/rfis',                label: 'RFIs' },
  { name: 'submittals',          hash: '#/submittals',          label: 'Submittals' },
  { name: 'budget',              hash: '#/budget',              label: 'Budget' },
  { name: 'daily-log',           hash: '#/daily-log',           label: 'Daily Log' },
  { name: 'punch-list',          hash: '#/punch-list',          label: 'Punch List' },
  // ── Field operations ───────────────────────────────────────────────────────
  { name: 'tasks',               hash: '#/tasks',               label: 'Tasks' },
  { name: 'change-orders',       hash: '#/change-orders',       label: 'Change Orders' },
  { name: 'meetings',            hash: '#/meetings',            label: 'Meetings' },
  { name: 'crews',               hash: '#/crews',               label: 'Crews' },
  { name: 'schedule',            hash: '#/schedule',            label: 'Schedule' },
  { name: 'drawings',            hash: '#/drawings',            label: 'Drawings' },
  { name: 'files',               hash: '#/files',               label: 'Files' },
  { name: 'field-capture',       hash: '#/field-capture',       label: 'Field Capture' },
  { name: 'safety',              hash: '#/safety',              label: 'Safety' },
  // ── Financial ──────────────────────────────────────────────────────────────
  { name: 'pay-apps',            hash: '#/pay-apps',            label: 'Pay Apps' },
  { name: 'lien-waivers',        hash: '#/lien-waivers',        label: 'Lien Waivers' },
  { name: 'financials',          hash: '#/financials',          label: 'Financials' },
  { name: 'procurement',         hash: '#/procurement',         label: 'Procurement' },
  { name: 'vendors',             hash: '#/vendors',             label: 'Vendors' },
  { name: 'contracts',           hash: '#/contracts',           label: 'Contracts' },
  // ── Project management ─────────────────────────────────────────────────────
  { name: 'directory',           hash: '#/directory',           label: 'Directory' },
  { name: 'equipment',           hash: '#/equipment',           label: 'Equipment' },
  { name: 'permits',             hash: '#/permits',             label: 'Permits' },
  { name: 'specifications',      hash: '#/specifications',      label: 'Specifications' },
  { name: 'closeout',            hash: '#/closeout',            label: 'Closeout' },
  // ── Intelligence / portfolio ───────────────────────────────────────────────
  { name: 'portfolio',           hash: '#/portfolio',           label: 'Portfolio' },
  { name: 'project-health',      hash: '#/project-health',      label: 'Project Health' },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function screenshotDir(pageName: string): string {
  const dir = path.join('polish-review', 'pages', pageName)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function screenshotPath(pageName: string, viewport: string, index: number, label: string): string {
  const paddedIdx = String(index).padStart(2, '0')
  return path.join(screenshotDir(pageName), `${viewport}-${paddedIdx}-${label}.png`)
}

const ERROR_BOUNDARY_RE = /something went wrong|an unexpected error occurred/i
const LOADING_SKELETON_RE = /loading\.\.\./i

// ── Sweep ─────────────────────────────────────────────────────────────────────

for (const pg of PAGES) {
  test.describe(`page: ${pg.name}`, () => {
    for (const vp of VIEWPORTS) {
      test(`${vp.name} (${vp.width}×${vp.height})`, async ({ page }) => {
        // Set viewport
        await page.setViewportSize({ width: vp.width, height: vp.height })

        // Navigate
        await page.goto(pg.hash)

        // Step 1: Wait for React to mount the app shell (role="main" must exist)
        // This guards against screenshots taken before the JS bundle executes.
        await page.waitForSelector('[role="main"]', { timeout: 10_000 })

        // Step 2: Once the shell is up, wait for loading skeletons to clear — up to 8s
        await page.waitForFunction(
          () => {
            const skeletons = document.querySelectorAll('[aria-busy="true"], .animate-pulse')
            return skeletons.length === 0
          },
          { timeout: 8_000 },
        ).catch(() => { /* some pages have persistent loading without data — proceed */ })

        // Small settle wait for CSS transitions
        await page.waitForTimeout(400)

        // ── Screenshot 01: initial viewport ──────────────────────────────────
        await page.screenshot({
          path: screenshotPath(pg.name, vp.name, 1, 'initial'),
          fullPage: false,
        })

        // ── Assertions ────────────────────────────────────────────────────────
        const bodyText = await page.locator('body').innerText().catch(() => '')

        expect(bodyText, `ErrorBoundary on ${pg.name} @ ${vp.name}`)
          .not.toMatch(ERROR_BOUNDARY_RE)

        // No horizontal overflow (content wider than viewport means layout break)
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(
          scrollWidth,
          `horizontal overflow on ${pg.name} @ ${vp.name}: scrollWidth=${scrollWidth} > viewport=${vp.width}`,
        ).toBeLessThanOrEqual(vp.width + 4)  // 4px tolerance for subpixel rounding

        // Role="main" must be present (accessibility + content loaded signal)
        await expect(
          page.locator('[role="main"]'),
          `missing role=main on ${pg.name} @ ${vp.name}`,
        ).toBeVisible({ timeout: 5_000 })

        // ── Screenshot 02: scrolled (desktop only — check nothing hidden behind FAB) ──
        if (vp.name !== 'iphone') {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await page.waitForTimeout(200)
          await page.screenshot({
            path: screenshotPath(pg.name, vp.name, 2, 'bottom'),
            fullPage: false,
          })
          // Scroll back
          await page.evaluate(() => window.scrollTo(0, 0))
        }
      })
    }
  })
}
