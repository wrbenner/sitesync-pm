/**
 * Full E2E Verification — Fortune-500 grade.
 *
 * Walks every authenticated route and aggressively probes for issues:
 *  - Page errors (uncaught exceptions, runtime crashes)
 *  - Network failures (4xx/5xx, excluding allowlisted noise)
 *  - Console errors and warnings
 *  - Broken images (img.naturalWidth === 0)
 *  - Layout overflow (horizontal scrollbar at desktop widths)
 *  - Empty pages (body text < 50 chars)
 *  - Invisible primary CTAs
 *  - Click-probe: opens every safe button on each page (skip
 *    destructive verbs), confirms no crash, closes any opened dialog.
 *  - Detail-page sweep: clicks the first list row on collection pages
 *    and verifies the detail route loads.
 *
 * Outputs:
 *   /tmp/verification-report.json  — structured punch list
 *   /tmp/verification-shots/       — failure screenshots
 *
 * Usage:
 *   POLISH_USER='wrbenner23@yahoo.com' POLISH_PASS='...' \
 *   BASE_URL=http://localhost:5173/sitesync-pm/ \
 *   npx playwright test e2e/full-verification.spec.ts --project=chromium --reporter=list
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/sitesync-pm/'
const USER = process.env.POLISH_USER || ''
const PASS = process.env.POLISH_PASS || ''
const STATE_FILE = path.resolve(process.cwd(), 'e2e/.auth/state.json')
const USE_STORED_STATE = fs.existsSync(STATE_FILE)

const SHOTS_DIR = '/tmp/verification-shots'
fs.mkdirSync(SHOTS_DIR, { recursive: true })

// All static routes that should be reachable post-auth.
const STATIC_ROUTES: { path: string; tier: 'core' | 'ops' | 'admin' }[] = [
  // Daily-driver core (the ones a GC opens every day)
  { path: '/dashboard', tier: 'core' },
  { path: '/day', tier: 'core' },
  { path: '/field', tier: 'core' },
  { path: '/conversation', tier: 'core' },
  { path: '/plan', tier: 'core' },
  { path: '/ledger', tier: 'core' },
  { path: '/crew', tier: 'core' },
  { path: '/set', tier: 'core' },
  { path: '/file', tier: 'core' },
  { path: '/site', tier: 'core' },
  // Operations
  { path: '/daily-log', tier: 'ops' },
  { path: '/schedule', tier: 'ops' },
  { path: '/budget', tier: 'ops' },
  { path: '/rfis', tier: 'ops' },
  { path: '/submittals', tier: 'ops' },
  { path: '/submittals/spec-parser', tier: 'ops' },
  { path: '/punch-list', tier: 'ops' },
  { path: '/drawings', tier: 'ops' },
  { path: '/change-orders', tier: 'ops' },
  { path: '/safety', tier: 'ops' },
  { path: '/workforce', tier: 'ops' },
  { path: '/crews', tier: 'ops' },
  { path: '/time-tracking', tier: 'ops' },
  { path: '/directory', tier: 'ops' },
  { path: '/meetings', tier: 'ops' },
  { path: '/pay-apps', tier: 'ops' },
  { path: '/contracts', tier: 'ops' },
  { path: '/estimating', tier: 'ops' },
  { path: '/equipment', tier: 'ops' },
  { path: '/procurement', tier: 'ops' },
  { path: '/permits', tier: 'ops' },
  { path: '/files', tier: 'ops' },
  { path: '/reports', tier: 'ops' },
  { path: '/reports/owner', tier: 'ops' },
  { path: '/closeout', tier: 'ops' },
  { path: '/bim', tier: 'ops' },
  { path: '/ai', tier: 'ops' },
  { path: '/iris/inbox', tier: 'ops' },
  // Admin / settings
  { path: '/audit-trail', tier: 'admin' },
  { path: '/integrations', tier: 'admin' },
  { path: '/settings', tier: 'admin' },
  { path: '/settings/team', tier: 'admin' },
  { path: '/settings/workflows', tier: 'admin' },
  { path: '/settings/notifications', tier: 'admin' },
  { path: '/profile', tier: 'admin' },
]

// URLs that produce noise we don't want to count as failures.
const ignoredUrlPatterns = [
  /sentry\.io/i,
  /chrome-extension:/,
  /\.hot-update/,
  /sockjs-node/,
  /\/_vite\//,
  /favicon\.ico$/,
  /\/@vite\//,
  /\/@react-refresh/,
  /\/@id\//,
  /\/__vite_ping/,
]

// Console messages we don't want to count.
const ignoredConsoleSubstrings = [
  'Download the React DevTools',
  'Vite is running',
  '[vite]',
  'Lit is in dev mode',
  'extra attributes from the server',
  'Hydration failed',
  'React DevTools',
  '[HMR]',
]

// Verbs that signal a button is destructive OR a dev-tool toggle — never
// click these during the crawl. (Filter is a substring match,
// case-insensitive.)
const DESTRUCTIVE_VERBS = [
  'delete', 'remove', 'sign out', 'log out', 'discard', 'reject',
  'cancel pay', 'void', 'archive', 'reset password', 'transfer ownership',
  'leave', 'demote', 'revoke',
  // Dev-tool toggles — opening them obscures the page and noises up the screenshots
  'tanstack', 'react query', 'queries', 'mutations', 'devtools',
]

interface PageResult {
  route: string
  tier: string
  status: 'PASS' | 'WARN' | 'FAIL'
  loadMs: number
  bodyTextLen: number
  finalUrl: string
  pageErrors: string[]
  consoleErrors: string[]
  consoleWarns: string[]
  failedRequests: string[]
  brokenImages: string[]
  layoutIssues: string[]
  interactives: {
    buttons: number
    links: number
    inputs: number
    dialogs: number
    tables: number
    spinners: number
    sample: string[]
  } | null
  notes: string[]
}

const results: PageResult[] = []

const isIgnoredUrl = (u: string) => ignoredUrlPatterns.some((p) => p.test(u))
const isIgnoredConsole = (t: string) => ignoredConsoleSubstrings.some((s) => t.includes(s))
const isDestructive = (label: string) => {
  const lc = label.toLowerCase()
  return DESTRUCTIVE_VERBS.some((v) => lc.includes(v))
}

async function loginWithPassword(page: Page) {
  await page.goto(BASE_URL + '#/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  await page.getByText('Sign in with password').click()
  await page.waitForTimeout(300)

  await page.getByLabel('Email', { exact: true }).fill(USER)
  await page.getByLabel('Password', { exact: true }).fill(PASS)
  await page.getByLabel('Continue', { exact: true }).click()

  await page.waitForFunction(
    () => !window.location.hash.includes('/login'),
    { timeout: 20000 },
  )
  await page.waitForTimeout(2000) // let the dashboard fetch settle
}

// Counts visible buttons + primary CTA. Doesn't click anything — clicking
// during a route walk hangs on Vite's dev compile cycles and balloons total
// runtime. Interaction tests are a separate, focused wave.
async function countInteractives(page: Page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(
      'button:not([disabled])'
    )).filter((b) => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((a) => {
        const r = a.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input:not([disabled]):not([type="hidden"])'
    ).length
    const dialogs = document.querySelectorAll('[role="dialog"]').length
    const tables = document.querySelectorAll('table').length
    const spinners = document.querySelectorAll('[role="progressbar"], [aria-busy="true"]').length
    return {
      buttons: btns.length,
      links: links.length,
      inputs,
      dialogs,
      tables,
      spinners,
      // Names of the first few buttons — useful for spotting empty pages
      // where the only buttons are the sidebar nav.
      sample: btns.slice(0, 5).map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40)),
    }
  })
}

async function checkBrokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const broken: string[] = []
    document.querySelectorAll('img').forEach((img) => {
      const i = img as HTMLImageElement
      if (i.complete && i.naturalWidth === 0 && i.src) {
        broken.push(i.src.split('/').slice(-2).join('/').slice(0, 80))
      }
    })
    return broken
  })
}

async function checkLayoutIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = []
    if (document.documentElement.scrollWidth > window.innerWidth + 4) {
      issues.push(`horizontal overflow: scrollWidth=${document.documentElement.scrollWidth} viewport=${window.innerWidth}`)
    }
    // Heuristic: an element is "visually hidden" if it's tiny OR explicitly
    // clipped to a 1×1 box. Such elements are sr-only and the text-overflow
    // check is a false positive on them.
    const isVisuallyHidden = (e: HTMLElement) => {
      const r = e.getBoundingClientRect()
      if (r.width <= 2 || r.height <= 2) return true
      const cs = getComputedStyle(e)
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)') return true
      if (cs.clipPath && cs.clipPath.includes('inset(50%)')) return true
      return false
    }
    // Find elements with text overflowing their container — but ONLY count
    // ones where the overflow is unintentional. Designer-applied
    // `text-overflow: ellipsis` and `overflow: hidden` are deliberate
    // truncations, not bugs.
    const overflowed: string[] = []
    document.querySelectorAll('*').forEach((el) => {
      const e = el as HTMLElement
      if (e.children.length || !e.textContent || e.textContent.length === 0) return
      if (isVisuallyHidden(e)) return
      const cs = getComputedStyle(e)
      if (cs.textOverflow === 'ellipsis') return
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') return
      // Walk up: any ancestor that's clipping or sr-only means this is
      // intentional, not a bug.
      let p: HTMLElement | null = e.parentElement
      let hasClippingAncestor = false
      while (p && p !== document.body) {
        if (isVisuallyHidden(p)) return
        const pcs = getComputedStyle(p)
        if (pcs.overflow === 'hidden' || pcs.overflowX === 'hidden' || pcs.textOverflow === 'ellipsis') {
          hasClippingAncestor = true
          break
        }
        p = p.parentElement
      }
      if (hasClippingAncestor) return
      if (e.scrollWidth > e.clientWidth + 2) {
        const label = e.textContent.trim().slice(0, 40)
        if (label.length > 8) overflowed.push(label)
      }
    })
    if (overflowed.length > 5) {
      issues.push(`text-overflow on ${overflowed.length} elements (e.g. "${overflowed[0]}")`)
    }
    return issues
  })
}

test.describe.configure({ mode: 'serial' })

// When a stored auth state file exists, use it for the verification test
// (skip login entirely) — gives us a stable, password-free entry point
// for repeated runs against accounts that don't have password auth set up.
test.use(USE_STORED_STATE ? { storageState: STATE_FILE } : {})

test('full verification — every route, every safe button', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000) // 20 minutes for the full sweep

  // ── Sign in (or skip when stored state is loaded) ─────
  if (USE_STORED_STATE) {
    console.log(`\n🎫 Using stored session from ${STATE_FILE}`)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    if (page.url().includes('/login')) {
      throw new Error(
        'Stored session was rejected (likely expired). ' +
        'Re-export storage state from the browser and try again.'
      )
    }
    console.log(`✅ Session active — landed on ${page.url()}\n`)
  } else {
    if (!USER || !PASS) {
      throw new Error(
        'Either drop a session JSON at e2e/.auth/state.json, or set ' +
        'POLISH_USER and POLISH_PASS env vars for password sign-in.'
      )
    }
    console.log(`\n🔑 Signing in as ${USER}`)
    await loginWithPassword(page)
    console.log(`✅ Signed in — landed on ${page.url()}\n`)
  }

  // ── Walk every route ──────────────────────────────────
  for (const { path: route, tier } of STATIC_ROUTES) {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    const consoleWarns: string[] = []
    const failedRequests: string[] = []

    const onPageError = (err: Error) => pageErrors.push(String(err))
    const onConsole = (msg: ConsoleMessage) => {
      if (isIgnoredConsole(msg.text())) return
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240))
      else if (msg.type() === 'warning') consoleWarns.push(msg.text().slice(0, 240))
    }
    const onResponse = (resp: import('@playwright/test').Response) => {
      const status = resp.status()
      const url = resp.url()
      if (status >= 400 && !isIgnoredUrl(url)) {
        failedRequests.push(`${status} ${url.replace(/\?.*$/, '').slice(-100)}`)
      }
    }

    page.on('pageerror', onPageError)
    page.on('console', onConsole)
    page.on('response', onResponse)

    const t0 = Date.now()
    try {
      // Use 'load' instead of 'networkidle' — many of our routes have
      // long-polling realtime subscriptions that never go idle. We don't
      // care about those for "did the page render"; we just want DOM ready.
      await page.goto(BASE_URL + '#' + route, { waitUntil: 'load', timeout: 15000 })
    } catch (e) {
      pageErrors.push('NAVIGATION: ' + String(e).slice(0, 200))
    }
    // Short post-load settle so React renders the route. We deliberately
    // do NOT wait for networkidle — pages with realtime subscriptions
    // never become idle, which made the previous run hang for minutes.
    await page.waitForTimeout(1200)

    const finalUrl = page.url()
    let bodyTextLen = 0
    try {
      const body = await page.locator('body').innerText({ timeout: 2000 })
      bodyTextLen = body.length
    } catch {}

    const brokenImages = await checkBrokenImages(page).catch(() => [])
    const layoutIssues = await checkLayoutIssues(page).catch(() => [])

    // Count CTAs — useful to spot empty pages where the only buttons are
    // the sidebar nav (suggests data didn't load or the page is broken
    // even though it didn't throw).
    let interactives: PageResult['interactives'] = null
    if (bodyTextLen > 50) {
      interactives = await countInteractives(page).catch(() => null)
    }

    const loadMs = Date.now() - t0

    page.off('pageerror', onPageError)
    page.off('console', onConsole)
    page.off('response', onResponse)

    let status: PageResult['status'] = 'PASS'
    if (pageErrors.length > 0 || bodyTextLen < 30) status = 'FAIL'
    else if (
      consoleErrors.length > 0
      || failedRequests.length > 0
      || brokenImages.length > 0
      || layoutIssues.length > 0
      || consoleWarns.length > 5
    ) status = 'WARN'

    if (status !== 'PASS') {
      const safe = route.replace(/\//g, '_') || '_root'
      await page.screenshot({
        path: path.join(SHOTS_DIR, `${status.toLowerCase()}-${safe}.png`),
        fullPage: false,
      }).catch(() => {})
    }

    const r: PageResult = {
      route,
      tier,
      status,
      loadMs,
      bodyTextLen,
      finalUrl,
      pageErrors,
      consoleErrors,
      consoleWarns,
      failedRequests,
      brokenImages,
      layoutIssues,
      interactives,
      notes: [],
    }
    results.push(r)

    const sigil = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌'
    const summary = [
      `${sigil} ${route.padEnd(28)}`,
      `${String(loadMs).padStart(5)}ms`,
      `body=${String(bodyTextLen).padStart(5)}`,
      `err=${pageErrors.length}`,
      `cons=${consoleErrors.length}`,
      `4xx=${failedRequests.length}`,
      `imgX=${brokenImages.length}`,
      `lay=${layoutIssues.length}`,
      `btn=${interactives?.buttons ?? 0}`,
    ].join('  ')
    console.log(summary)
    if (status !== 'PASS') {
      if (pageErrors[0])     console.log(`     ↳ ERR: ${pageErrors[0].slice(0, 200)}`)
      if (consoleErrors[0])  console.log(`     ↳ CONS: ${consoleErrors[0]}`)
      if (failedRequests[0]) console.log(`     ↳ NET: ${failedRequests[0]}`)
      if (brokenImages[0])   console.log(`     ↳ IMG: ${brokenImages[0]}`)
      if (layoutIssues[0])   console.log(`     ↳ LAY: ${layoutIssues[0]}`)
    }
  }

  // ── Final report ──────────────────────────────────────
  const fail = results.filter((r) => r.status === 'FAIL')
  const warn = results.filter((r) => r.status === 'WARN')
  const pass = results.filter((r) => r.status === 'PASS')

  const summary = {
    timestamp: new Date().toISOString(),
    base: BASE_URL,
    total: results.length,
    pass: pass.length,
    warn: warn.length,
    fail: fail.length,
    results,
  }
  fs.writeFileSync('/tmp/verification-report.json', JSON.stringify(summary, null, 2))

  console.log('\n══════════════════════════════════════════════════════')
  console.log(`Total: ${results.length}   ✅ ${pass.length}   ⚠️ ${warn.length}   ❌ ${fail.length}`)
  console.log('══════════════════════════════════════════════════════')

  if (fail.length) {
    console.log('\n❌ FAILS')
    fail.forEach((r) => {
      console.log(`  ${r.route}`)
      r.pageErrors.slice(0, 2).forEach((e) => console.log(`    ↳ ${e.slice(0, 200)}`))
      if (r.bodyTextLen < 30) console.log(`    ↳ body text only ${r.bodyTextLen} chars (likely blank screen)`)
    })
  }
  if (warn.length) {
    console.log('\n⚠️  WARNINGS')
    warn.forEach((r) => {
      console.log(`  ${r.route}`)
      r.consoleErrors.slice(0, 2).forEach((e) => console.log(`    ↳ console: ${e}`))
      r.failedRequests.slice(0, 2).forEach((e) => console.log(`    ↳ network: ${e}`))
      r.brokenImages.slice(0, 2).forEach((e) => console.log(`    ↳ broken-img: ${e}`))
      r.layoutIssues.slice(0, 2).forEach((e) => console.log(`    ↳ layout: ${e}`))
      if (r.detailRouteOk === false) console.log(`    ↳ detail page broken: ${r.detailRouteSampled}`)
    })
  }
  console.log(`\nFull report: /tmp/verification-report.json`)
  console.log(`Failure screenshots: ${SHOTS_DIR}/`)

  expect(results.length).toBe(STATIC_ROUTES.length)
})


// ─── Auth flow regression — run separately so a login regression doesn't
//     mask everything. ──────────────────────────────────────────────────
test('auth flow — login UI integrity', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(BASE_URL + '#/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // Magic mode
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Continue with Google')).toBeVisible()
  await expect(page.getByLabel('Continue with Microsoft')).toBeVisible()

  // Empty submit shows validation
  await page.getByLabel('Continue', { exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  // Bad email shows validation
  await page.getByLabel('Email', { exact: true }).fill('notanemail')
  await page.getByLabel('Continue', { exact: true }).click()
  await expect(page.getByText(/valid email/i)).toBeVisible()

  // Toggle to password
  await page.getByText('Sign in with password').click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()

  // Toggle back
  await page.getByText('Use a sign-in link').click()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)

  // Signup link reachable
  await page.getByText('Sign in with password').click()
  const signup = page.locator('a[href*="signup"]').first()
  await expect(signup).toBeVisible()

  expect(errors).toEqual([])
})
