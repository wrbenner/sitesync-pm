/**
 * Page sweep spec — navigates all 28 demo pages at 3 viewports, captures
 * screenshots, and asserts against the most common visual regressions:
 *   • Stuck loading skeletons (page never resolved data)
 *   • Broken image (alt text visible where img should be)
 *   • Empty page (body text length < 200 chars)
 *   • Route fallback ("Not Found" or "404" showing)
 *
 * Screenshots land in: polish-review/pages/<slug>/<viewport>-NN-<name>.png
 *
 * Run with:
 *   npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Notes on dev-bypass mode:
 *   • Pages gated to admin/pm roles show "Access Restricted" for the viewer
 *     role that VITE_DEV_BYPASS grants. This is correct behaviour — not a bug.
 *     ACCESS_RESTRICTED_PAGES documents which pages fall into this category.
 *   • The dashboard loads a 3-second fallback skeleton before showing
 *     WelcomeOnboarding when Supabase is unreachable. The spec waits 4 s.
 */

import path from 'node:path'
import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

// ── Page catalogue ──────────────────────────────────────────────────────────

interface PageEntry {
  route: string
  slug: string
  /** Minimum visible text length that signals the page loaded real content */
  minChars?: number
}

const PAGES: PageEntry[] = [
  { route: '/dashboard',     slug: 'dashboard' },
  { route: '/daily-log',     slug: 'daily-log' },
  { route: '/schedule',      slug: 'schedule' },
  { route: '/budget',        slug: 'budget' },
  { route: '/rfis',          slug: 'rfis' },
  { route: '/submittals',    slug: 'submittals' },
  { route: '/punch-list',    slug: 'punch-list' },
  { route: '/drawings',      slug: 'drawings' },
  { route: '/change-orders', slug: 'change-orders' },
  { route: '/safety',        slug: 'safety' },
  { route: '/workforce',     slug: 'workforce' },
  { route: '/crews',         slug: 'crews' },
  { route: '/time-tracking', slug: 'time-tracking' },
  { route: '/directory',     slug: 'directory' },
  { route: '/meetings',      slug: 'meetings' },
  { route: '/pay-apps',      slug: 'pay-apps' },
  { route: '/contracts',     slug: 'contracts' },
  { route: '/estimating',    slug: 'estimating' },
  { route: '/equipment',     slug: 'equipment' },
  { route: '/procurement',   slug: 'procurement' },
  { route: '/permits',       slug: 'permits' },
  { route: '/files',         slug: 'files' },
  { route: '/reports',       slug: 'reports' },
  { route: '/closeout',      slug: 'closeout' },
  { route: '/bim',           slug: 'bim' },
  { route: '/ai',            slug: 'ai' },
  { route: '/audit-trail',   slug: 'audit-trail' },
  { route: '/integrations',  slug: 'integrations' },
]

/**
 * Pages that correctly show "Access Restricted" in dev-bypass (viewer) mode.
 * These are gated to admin/pm/owner roles and should show content in real auth.
 */
const ACCESS_RESTRICTED_PAGES = new Set([
  'budget', 'change-orders', 'pay-apps', 'audit-trail', 'integrations',
  'contracts', 'estimating', 'procurement', 'reports',
])

// ── Helpers ─────────────────────────────────────────────────────────────────

function viewportLabel(page: Page): string {
  const vp = page.viewportSize()
  if (!vp) return 'desktop'
  if (vp.width <= 430) return 'iphone'
  if (vp.width <= 1024) return 'ipad'
  return 'desktop'
}

async function saveScreenshot(page: Page, slug: string, step: string): Promise<string> {
  const label = viewportLabel(page)
  const dir = path.resolve('polish-review', 'pages', slug)
  fs.mkdirSync(dir, { recursive: true })
  const existing = fs.readdirSync(dir).filter(f => f.startsWith(label))
  const nn = String(existing.length + 1).padStart(2, '0')
  const file = path.join(dir, `${label}-${nn}-${step}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

/**
 * Count elements that use the skeletonStyle CSS animation defined in
 * src/styles/animations.ts. The animation name is "shimmer" (or pulse),
 * which injects a custom @keyframes — not Tailwind's animate-pulse class.
 * We detect both the Tailwind class and any element whose background uses
 * the shimmer gradient via computed style.
 */
async function countStuckSkeletons(page: Page): Promise<number> {
  return page.evaluate(() => {
    const byClass = document.querySelectorAll(
      '[data-testid="skeleton"], .animate-pulse, [class*="skeleton"], [aria-busy="true"]',
    ).length
    // Also detect elements with shimmer animation via inline CSS
    const allEls = Array.from(document.querySelectorAll('*'))
    const byShimmer = allEls.filter(el => {
      const s = window.getComputedStyle(el)
      return s.animationName?.includes('shimmer') || s.animationName?.includes('pulse')
    }).length
    return byClass + byShimmer
  })
}

async function countBrokenImages(page: Page): Promise<number> {
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    return imgs.filter(img => img.complete && img.naturalWidth === 0 && img.src).length
  })
}

async function visibleTextLength(page: Page): Promise<number> {
  return page.evaluate(() => (document.body.innerText ?? '').trim().length)
}

// ── Test suite ───────────────────────────────────────────────────────────────

for (const { route, slug, minChars = 150 } of PAGES) {
  test(`page-sweep: ${slug}`, async ({ page }) => {
    // Navigate using hash router
    await page.goto(`#${route}`, { waitUntil: 'domcontentloaded' })

    // Give lazy-loaded components and Supabase-retry timeouts up to 5s to settle.
    // The dashboard skeleton has a 3s bail-out; waiting 4s ensures it resolves.
    await page.waitForLoadState('networkidle').catch(() => { /* timeout OK */ })
    await page.waitForTimeout(4000)

    // Screenshot 1 — settled render
    await saveScreenshot(page, slug, 'initial')

    // ── Assertions ──────────────────────────────────────────────────────────

    // 1. Not redirected to 404 / login
    const url = page.url()
    expect(url, `${slug}: redirected unexpectedly`).not.toMatch(/404|not-found/i)

    // 2. #main-content or <main> is present
    const mainContent = page.locator('#main-content, main, [role="main"]').first()
    const hasMain = await mainContent.isVisible().catch(() => false)
    expect(hasMain, `${slug}: no #main-content or <main> found`).toBe(true)

    // 3. No stuck skeletons (allow access-restricted pages to skip since they
    //    render a clean restriction state, not skeleton)
    if (!ACCESS_RESTRICTED_PAGES.has(slug)) {
      const skeletonCount = await countStuckSkeletons(page)
      expect(
        skeletonCount,
        `${slug}: ${skeletonCount} skeleton elements still visible after 4s — loading state never resolved`,
      ).toBe(0)
    }

    // 4. Page has meaningful content
    const textLen = await visibleTextLength(page)
    expect(textLen, `${slug}: page text only ${textLen} chars — probably empty`).toBeGreaterThan(minChars)

    // 5. No broken images in the viewport
    const brokenImgs = await countBrokenImages(page)
    expect(brokenImgs, `${slug}: ${brokenImgs} broken images detected`).toBe(0)

    // 6. No "Not Found" route fallback
    const bodyText = await page.evaluate(() => document.body.innerText)
    expect(bodyText, `${slug}: "Not Found" route fallback rendered`).not.toMatch(/\bnot found\b/i)
    expect(bodyText, `${slug}: "404" error page rendered`).not.toMatch(/\b404\b/)

    // 7. Log "Access Restricted" pages as info (expected in dev-bypass viewer mode)
    if (ACCESS_RESTRICTED_PAGES.has(slug)) {
      const isRestricted = bodyText.includes('Access Restricted')
      if (isRestricted) {
        console.log(
          `  [info] ${slug}: "Access Restricted" in dev-bypass viewer mode — expected, not a bug`,
        )
      }
    }

    // Screenshot 2 — final state after all assertions
    await saveScreenshot(page, slug, 'final')
  })
}
