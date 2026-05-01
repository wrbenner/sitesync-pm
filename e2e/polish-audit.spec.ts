/**
 * Polish-audit screenshot crawler.
 *
 * NOT a regression test — fails are not "bugs," they're "look at this."
 * Captures every priority route across viewport × theme matrices into
 * polish-review/ for visual review.
 *
 * Outputs:
 *   polish-review/iphone-light/<route>.png
 *   polish-review/iphone-dark/<route>.png
 *   polish-review/desktop-light/<route>.png
 *   polish-review/desktop-dark/<route>.png
 *   polish-review/iphone-landscape/<route>.png  (Tier-1 only)
 *   polish-review/console-errors.json — JSON log of all console errors,
 *                                       grouped by route + viewport, so
 *                                       we can hunt non-visible bugs
 *                                       like the recurring NaN top CSS.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Route {
  hash: string
  slug: string
  /**
   * Tier:
   *   1 = first impression / daily-driver — must be perfect
   *   2 = high-traffic — must feel solid
   *   3 = supporting — must not be broken
   */
  tier: 1 | 2 | 3
}

const DEMO_RFI = 'b0000001-0000-0000-0000-000000000001'

const ROUTES: Route[] = [
  { hash: '/login',                slug: '01-login',          tier: 1 },
  { hash: '/dashboard',            slug: '02-dashboard',      tier: 1 },
  { hash: '/daily-log',            slug: '03-daily-log',      tier: 1 },
  { hash: '/rfis',                 slug: '04-rfis',           tier: 1 },
  { hash: `/rfis/${DEMO_RFI}`,     slug: '05-rfi-detail',     tier: 1 },
  { hash: '/profile',              slug: '06-profile',        tier: 1 },
  { hash: '/drawings',             slug: '10-drawings',       tier: 2 },
  { hash: '/schedule',             slug: '11-schedule',       tier: 2 },
  { hash: '/punch-list',           slug: '12-punch-list',     tier: 2 },
  { hash: '/submittals',           slug: '13-submittals',     tier: 2 },
  { hash: '/budget',               slug: '14-budget',         tier: 2 },
  { hash: '/ai',                   slug: '15-ai-copilot',     tier: 2 },
  { hash: '/settings',             slug: '16-settings',       tier: 2 },
  { hash: '/settings/team',        slug: '17-team',           tier: 2 },
  { hash: '/settings/notifications', slug: '18-notifs',       tier: 2 },
  { hash: '/change-orders',        slug: '20-change-orders',  tier: 3 },
  { hash: '/safety',               slug: '21-safety',         tier: 3 },
  { hash: '/workforce',            slug: '22-workforce',      tier: 3 },
  { hash: '/crews',                slug: '23-crews',          tier: 3 },
  { hash: '/time-tracking',        slug: '24-time-tracking',  tier: 3 },
  { hash: '/directory',            slug: '25-directory',      tier: 3 },
  { hash: '/meetings',             slug: '26-meetings',       tier: 3 },
  { hash: '/pay-apps',             slug: '27-pay-apps',       tier: 3 },
  { hash: '/contracts',            slug: '28-contracts',      tier: 3 },
  { hash: '/equipment',            slug: '29-equipment',      tier: 3 },
  { hash: '/permits',              slug: '30-permits',        tier: 3 },
  { hash: '/files',                slug: '31-files',          tier: 3 },
  { hash: '/reports',              slug: '32-reports',        tier: 3 },
  { hash: '/integrations',         slug: '33-integrations',   tier: 3 },
  { hash: '/audit-trail',          slug: '34-audit-trail',    tier: 3 },
  { hash: '/security',             slug: '35-security',       tier: 3 },
]

const OUT_DIR = path.resolve(__dirname, '..', 'polish-review')
const ERRORS_FILE = path.join(OUT_DIR, 'console-errors.json')

interface ConsoleError {
  combo: string
  slug: string
  text: string
  stack?: string
}
const allErrors: ConsoleError[] = []

const VIEWPORTS = [
  { name: 'iphone',           width: 393,  height: 852,  tiers: [1, 2, 3] as const },
  { name: 'desktop',          width: 1440, height: 900,  tiers: [1, 2, 3] as const },
  // Landscape iPhone — bottom tab bar is the most likely thing to break here.
  // Only capture Tier-1 to keep the run cost in line.
  { name: 'iphone-landscape', width: 852,  height: 393,  tiers: [1] as const },
] as const

const THEMES = ['light', 'dark'] as const

async function settle(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
  await page
    .waitForLoadState('networkidle', { timeout: 8_000 })
    .catch(() => undefined)
  // Wait for skeleton placeholders to clear before the screenshot. Pages
  // like Budget / Crews / Files / Punch / RFIs / Submittals render
  // [data-skeleton] divs while data is in flight; without this wait the
  // capture often lands mid-prime and shows a flat skeleton block.
  // Bounded so a genuinely-stuck skeleton still gets captured (and
  // surfaces in the punch list) rather than hanging the whole spec.
  await page
    .waitForFunction(
      () => document.querySelectorAll('[data-skeleton="true"]').length === 0,
      { timeout: 6_000, polling: 200 },
    )
    .catch(() => undefined)
  await page.waitForTimeout(250)
}

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const combo = `${vp.name}-${theme}`
    test.describe(`polish-audit @ ${combo}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } })

      for (const route of ROUTES) {
        if (!(vp.tiers as readonly number[]).includes(route.tier)) continue

        test(`tier${route.tier} ${route.slug}`, async ({ page }) => {
          const errors: ConsoleError[] = []
          page.on('pageerror', (err) => {
            errors.push({ combo, slug: route.slug, text: err.message, stack: err.stack })
          })
          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              errors.push({ combo, slug: route.slug, text: msg.text() })
            }
          })

          // Pre-set the theme before app boot so the very first render
          // is in the requested mode. The store reads from this exact key.
          await page.addInitScript((mode) => {
            try {
              localStorage.setItem('sitesync-theme-mode', mode)
            } catch {
              /* private mode: ignore */
            }
          }, theme)

          await page.goto(`#${route.hash}`)
          await settle(page)

          await page.screenshot({
            path: path.join(OUT_DIR, combo, `${route.slug}.png`),
            fullPage: true,
          })

          // Push captured errors to the global list. Done after the
          // shot so we capture everything that fired during render.
          allErrors.push(...errors)

          expect(true).toBeTruthy()
        })
      }
    })
  }
}

test.afterAll(async () => {
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(allErrors, null, 2))
  } catch {
    /* best-effort write */
  }
})
