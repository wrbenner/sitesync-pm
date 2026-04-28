/**
 * Polish-workflow spec — walks productive lifecycles, not just routes.
 *
 * Each surface has a comprehensive list of named states. The spec walks
 * each one and captures a screenshot. Tolerant of missing buttons — if a
 * permission, data row, or action isn't available with this account, the
 * step skips and the workflow continues.
 *
 * Run:
 *   POLISH_USER=…  POLISH_PASS=…  \
 *     npx playwright test --config=playwright.polish.config.ts --project=polish-workflow
 *
 * Output: polish-review/workflows/<viewport>/<surface>/<NN>-<state>.png
 *         polish-review/workflows-console-errors.json
 *
 * One file per surface keeps the runner debuggable; if RFIs goes wrong,
 * Daily Log still captures.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'workflows')
const ERRORS_FILE = path.resolve(__dirname, '..', 'polish-review', 'workflows-console-errors.json')

interface WorkflowError {
  combo: string
  surface: string
  step: string
  text: string
}
const allErrors: WorkflowError[] = []

// ── Helpers ──────────────────────────────────────────────

async function settle(page: Page, extraMs = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined)
  await page.waitForTimeout(extraMs)
}

async function shot(page: Page, viewport: string, surface: string, n: number, name: string) {
  const filename = `${String(n).padStart(2, '0')}-${name}.png`
  await page
    .screenshot({ path: path.join(OUT_DIR, viewport, surface, filename), fullPage: true })
    .catch(() => undefined)
}

async function tryClick(page: Page, label: RegExp | string, opts?: { exact?: boolean; nth?: number }) {
  const locator = page.getByRole('button', { name: label, exact: opts?.exact })
  const count = await locator.count().catch(() => 0)
  if (count === 0) return false
  const target = opts?.nth !== undefined ? locator.nth(opts.nth) : locator.first()
  await target.click({ timeout: 4_000 }).catch(() => undefined)
  return true
}

async function tryClickLink(page: Page, hrefMatch: RegExp) {
  const locator = page.locator(`a[href*="${hrefMatch.source.replace(/[\\/]/g, '/')}"]`).first()
  const count = await locator.count().catch(() => 0)
  if (count === 0) return false
  await locator.click({ timeout: 4_000 }).catch(() => undefined)
  return true
}

async function tryFill(page: Page, placeholder: RegExp | string, value: string) {
  const locator = page.getByPlaceholder(placeholder)
  const count = await locator.count().catch(() => 0)
  if (count === 0) return false
  await locator.first().fill(value).catch(() => undefined)
  return true
}

async function escClose(page: Page) {
  await page.keyboard.press('Escape').catch(() => undefined)
  await settle(page, 150)
}

async function withErrorListener(
  page: Page,
  combo: string,
  surface: string,
  fn: (track: (step: string) => void) => Promise<void>,
) {
  let currentStep = 'init'
  page.on('pageerror', (err) => {
    allErrors.push({ combo, surface, step: currentStep, text: err.message })
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      allErrors.push({ combo, surface, step: currentStep, text: msg.text() })
    }
  })
  await fn((step) => {
    currentStep = step
  })
}

// ── Viewports ────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

// ────────────────────────────────────────────────────────────────────
// Workflows
//
// One test per surface. Steps are sequential. tryClick / tryFill skip
// gracefully when an element isn't available.
// ────────────────────────────────────────────────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`workflow @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    // ════════════════════════════════════════════════════════
    // PRIORITY 1 — daily-driver surfaces (deepest coverage)
    // ════════════════════════════════════════════════════════

    test(`dashboard lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'dashboard', async (track) => {
        track('landing')
        await page.goto('#/dashboard')
        await settle(page, 600)
        await shot(page, vp.name, 'dashboard', 1, 'landing')

        // Hover a KPI tile (desktop only) to capture hover state
        if (vp.name === 'desktop') {
          track('kpi-hover')
          const kpiButtons = page.locator('[role="button"]').filter({ hasText: /Schedule|Budget|Open RFIs|Safety/ }).first()
          if (await kpiButtons.count() > 0) {
            await kpiButtons.hover()
            await settle(page, 200)
            await shot(page, vp.name, 'dashboard', 2, 'kpi-hover')
          }
        }

        // Scroll to bottom to capture below-fold content
        track('scrolled')
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
        await settle(page, 200)
        await shot(page, vp.name, 'dashboard', 3, 'scrolled-bottom')

        // Open project picker if present
        track('project-picker')
        const picker = page.locator('button').filter({ hasText: /^Merritt Crossing$|^Select Project$/i }).first()
        if (await picker.count() > 0) {
          await picker.click().catch(() => undefined)
          await settle(page, 300)
          await shot(page, vp.name, 'dashboard', 4, 'project-picker-open')
          await escClose(page)
        }
      })
    })

    test(`daily-log lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'daily-log', async (track) => {
        track('today')
        await page.goto('#/daily-log')
        await settle(page, 400)
        await shot(page, vp.name, 'daily-log', 1, 'today')

        track('quick-entry-step1')
        if (await tryClick(page, /^quick entry$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'daily-log', 2, 'quick-entry-step1-weather')

          // Walk the multi-step quick entry
          for (let stepIdx = 2; stepIdx <= 9; stepIdx++) {
            track(`quick-entry-step${stepIdx}`)
            if (await tryClick(page, /^next/i)) {
              await settle(page, 250)
              await shot(page, vp.name, 'daily-log', 1 + stepIdx, `quick-entry-step${stepIdx}`)
            } else {
              break
            }
          }
          await escClose(page)
        }

        track('field-capture-modal')
        if (await tryClick(page, /field capture/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'daily-log', 11, 'field-capture-modal')
          await escClose(page)
        }

        track('manual-entry-tab')
        if (await tryClick(page, /^manual entry$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'daily-log', 12, 'manual-entry')
        }

        track('calendar-view-tab')
        if (await tryClick(page, /^calendar view$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'daily-log', 13, 'calendar-view')
        }

        track('export-pdf')
        if (await tryClick(page, /export pdf/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'daily-log', 14, 'export-pdf-modal')
          await escClose(page)
        }
      })
    })

    test(`rfis lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'rfis', async (track) => {
        track('list')
        await page.goto('#/rfis')
        await settle(page, 400)
        await shot(page, vp.name, 'rfis', 1, 'list')

        track('new-form')
        const opened =
          (await tryClick(page, /^create first rfi$/i)) ||
          (await tryClick(page, /^new rfi$/i)) ||
          (await tryClick(page, /^create rfi$/i)) ||
          (await tryClick(page, /^\+ new$/i))
        if (opened) {
          await settle(page, 300)
          await shot(page, vp.name, 'rfis', 2, 'new-form-empty')

          track('new-form-typed')
          if (await tryFill(page, /needs to be clarified/i, 'What is the spec section reference for the embedded plates on column line A?')) {
            await settle(page, 200)
            await shot(page, vp.name, 'rfis', 3, 'new-form-typed')
          }
          // priority pill click
          track('priority-high')
          if (await tryClick(page, /^high$/i)) {
            await settle(page, 150)
            await shot(page, vp.name, 'rfis', 4, 'priority-high')
          }
          await escClose(page)
        }

        // open detail of first existing RFI
        track('detail')
        if (await tryClickLink(page, /\/rfis\//)) {
          await settle(page, 400)
          await shot(page, vp.name, 'rfis', 5, 'detail')

          // try a reply if possible
          track('reply')
          if (await tryClick(page, /^reply$|^add reply$/i)) {
            await settle(page, 200)
            await shot(page, vp.name, 'rfis', 6, 'reply-form')
            await escClose(page)
          }
        }

        // back to list, exercise filters
        track('filter-open')
        await page.goto('#/rfis')
        await settle(page, 400)
        const openTab = page.getByRole('button', { name: /^open/i }).first()
        if (await openTab.count() > 0) {
          await openTab.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 'rfis', 7, 'filter-open')
        }
      })
    })

    test(`punch-list lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'punch-list', async (track) => {
        track('list')
        await page.goto('#/punch-list')
        await settle(page, 400)
        await shot(page, vp.name, 'punch-list', 1, 'list')

        track('new-item')
        const opened =
          (await tryClick(page, /^new item$/i)) ||
          (await tryClick(page, /^create first punch/i)) ||
          (await tryClick(page, /^\+ new$/i))
        if (opened) {
          await settle(page, 300)
          await shot(page, vp.name, 'punch-list', 2, 'new-item-modal')
          await escClose(page)
        }

        track('grid-view')
        const gridIcon = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' }).nth(1)
        // try grid icon by aria-label
        const gridBtn = page.getByRole('button', { name: /grid view/i }).first()
        if (await gridBtn.count() > 0) {
          await gridBtn.click().catch(() => undefined)
          await settle(page, 250)
          await shot(page, vp.name, 'punch-list', 3, 'grid-view')
        }

        track('map-view')
        const mapBtn = page.getByRole('button', { name: /map view/i }).first()
        if (await mapBtn.count() > 0) {
          await mapBtn.click().catch(() => undefined)
          await settle(page, 250)
          await shot(page, vp.name, 'punch-list', 4, 'map-view')
        }

        track('open-filter')
        const openTab = page.getByRole('button', { name: /^open\s*\d/i }).first()
        if (await openTab.count() > 0) {
          await openTab.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 'punch-list', 5, 'filter-open')
        }

        track('detail')
        if (await tryClickLink(page, /\/punch-list\//)) {
          await settle(page, 400)
          await shot(page, vp.name, 'punch-list', 6, 'detail')
        }
      })
    })

    test(`submittals lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'submittals', async (track) => {
        track('list')
        await page.goto('#/submittals')
        await settle(page, 400)
        await shot(page, vp.name, 'submittals', 1, 'list-or-empty')

        track('new-modal')
        const opened =
          (await tryClick(page, /^new submittal$/i)) ||
          (await tryClick(page, /^create submittal$/i)) ||
          (await tryClick(page, /^create first submittal$/i))
        if (opened) {
          await settle(page, 300)
          await shot(page, vp.name, 'submittals', 2, 'new-submittal-modal')
          await escClose(page)
        }

        track('import-from-spec')
        if (await tryClick(page, /import from spec/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'submittals', 3, 'import-from-spec')
          await escClose(page)
        }

        track('detail')
        if (await tryClickLink(page, /\/submittals\//)) {
          await settle(page, 400)
          await shot(page, vp.name, 'submittals', 4, 'detail')
        }
      })
    })

    // ════════════════════════════════════════════════════════
    // PRIORITY 2 — high-traffic surfaces (medium coverage)
    // ════════════════════════════════════════════════════════

    test(`drawings lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'drawings', async (track) => {
        track('list')
        await page.goto('#/drawings')
        await settle(page, 400)
        await shot(page, vp.name, 'drawings', 1, 'list-or-empty')

        track('upload-modal')
        if (await tryClick(page, /^upload$/i) || await tryClick(page, /upload drawings/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'drawings', 2, 'upload-modal')
          await escClose(page)
        }

        track('sets-panel')
        if (await tryClick(page, /^sets$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'drawings', 3, 'sets-panel')
          await escClose(page)
        }

        track('annotations-panel')
        if (await tryClick(page, /^annotations$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'drawings', 4, 'annotations-panel')
          await escClose(page)
        }

        track('grid-list-toggle')
        const gridBtn = page.getByRole('button', { name: /grid|list/i }).nth(1)
        if (await gridBtn.count() > 0) {
          await gridBtn.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 'drawings', 5, 'view-toggled')
        }
      })
    })

    test(`schedule lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'schedule', async (track) => {
        track('gantt-default')
        await page.goto('#/schedule')
        await settle(page, 800)
        await shot(page, vp.name, 'schedule', 1, 'gantt-default')

        track('look-ahead')
        if (await tryClick(page, /look-ahead/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'schedule', 2, 'look-ahead')
        }

        track('list-view')
        if (await tryClick(page, /^list$/i, { nth: 0 })) {
          await settle(page, 400)
          await shot(page, vp.name, 'schedule', 3, 'list-view')
        }

        track('what-if')
        if (await tryClick(page, /what-if/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'schedule', 4, 'what-if')
          await escClose(page)
        }

        track('import-wizard')
        if (await tryClick(page, /^import$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'schedule', 5, 'import-wizard')
          await escClose(page)
        }

        track('logic-quality-expand')
        if (await tryClick(page, /^expand$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'schedule', 6, 'logic-quality-expanded')
        }
      })
    })

    test(`budget lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'budget', async (track) => {
        track('summary')
        await page.goto('#/budget')
        await settle(page, 600)
        await shot(page, vp.name, 'budget', 1, 'summary')

        track('cost-codes')
        if (await tryClick(page, /^cost codes$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'budget', 2, 'cost-codes')
        }

        track('cash-flow')
        if (await tryClick(page, /^cash flow$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'budget', 3, 'cash-flow')
        }

        track('period-close')
        if (await tryClick(page, /^period close$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'budget', 4, 'period-close')
        }

        track('snapshots')
        if (await tryClick(page, /^snapshots$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'budget', 5, 'snapshots')
        }

        track('add-menu')
        if (await tryClick(page, /^\+ add$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'budget', 6, 'add-menu-open')
          await escClose(page)
        }
      })
    })

    test(`pay-apps lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'pay-apps', async (track) => {
        track('list')
        await page.goto('#/pay-apps')
        await settle(page, 500)
        await shot(page, vp.name, 'pay-apps', 1, 'list')

        track('retainage')
        if (await tryClick(page, /^retainage$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'pay-apps', 2, 'retainage')
        }

        track('lien-waivers')
        if (await tryClick(page, /^lien waivers$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'pay-apps', 3, 'lien-waivers')
        }

        track('cash-flow')
        if (await tryClick(page, /^cash flow$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'pay-apps', 4, 'cash-flow')
        }
      })
    })

    test(`change-orders lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'change-orders', async (track) => {
        track('list')
        await page.goto('#/change-orders')
        await settle(page, 400)
        await shot(page, vp.name, 'change-orders', 1, 'list-or-empty')

        track('new-co')
        const opened =
          (await tryClick(page, /^new change order$/i)) ||
          (await tryClick(page, /^create first/i))
        if (opened) {
          await settle(page, 300)
          await shot(page, vp.name, 'change-orders', 2, 'new-co-modal')
          await escClose(page)
        }
      })
    })

    test(`safety lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'safety', async (track) => {
        track('overview')
        await page.goto('#/safety')
        await settle(page, 500)
        await shot(page, vp.name, 'safety', 1, 'overview')

        const tabs = ['inspections', 'toolbox talks', 'certifications', 'corrective']
        for (let i = 0; i < tabs.length; i++) {
          track(`tab-${tabs[i]}`)
          if (await tryClick(page, new RegExp(`^${tabs[i]}`, 'i'))) {
            await settle(page, 300)
            await shot(page, vp.name, 'safety', 2 + i, `tab-${tabs[i].replace(/\s/g, '-')}`)
          }
        }

        track('report-incident')
        if (await tryClick(page, /report incident/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'safety', 6, 'report-incident-modal')
          await escClose(page)
        }
      })
    })

    test(`workforce lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'workforce', async (track) => {
        track('roster')
        await page.goto('#/workforce')
        await settle(page, 500)
        await shot(page, vp.name, 'workforce', 1, 'roster')

        const tabs = ['time tracking', 'credentials', 'forecast', 'productivity']
        for (let i = 0; i < tabs.length; i++) {
          track(`tab-${tabs[i]}`)
          if (await tryClick(page, new RegExp(`^${tabs[i]}`, 'i'))) {
            await settle(page, 300)
            await shot(page, vp.name, 'workforce', 2 + i, `tab-${tabs[i].replace(/\s/g, '-')}`)
          }
        }

        track('add-worker')
        if (await tryClick(page, /add worker/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'workforce', 6, 'add-worker-modal')
          await escClose(page)
        }
      })
    })

    test(`crews lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'crews', async (track) => {
        track('cards')
        await page.goto('#/crews')
        await settle(page, 500)
        await shot(page, vp.name, 'crews', 1, 'cards')

        track('map')
        if (await tryClick(page, /^map$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'crews', 2, 'map')
        }

        track('performance')
        if (await tryClick(page, /^performance$/i)) {
          await settle(page, 400)
          await shot(page, vp.name, 'crews', 3, 'performance')
        }

        track('add-crew')
        if (await tryClick(page, /add crew/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'crews', 4, 'add-crew-modal')
          await escClose(page)
        }
      })
    })

    test(`time-tracking lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'time-tracking', async (track) => {
        track('timesheet')
        await page.goto('#/time-tracking')
        await settle(page, 500)
        await shot(page, vp.name, 'time-tracking', 1, 'timesheet')

        const tabs = ['certified payroll', 't&m tickets', 'rates', 'payroll export']
        for (let i = 0; i < tabs.length; i++) {
          track(`tab-${tabs[i]}`)
          if (await tryClick(page, new RegExp(`^${tabs[i]}`, 'i'))) {
            await settle(page, 300)
            await shot(page, vp.name, 'time-tracking', 2 + i, `tab-${tabs[i].replace(/[\s&]/g, '-')}`)
          }
        }
      })
    })

    test(`directory lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'directory', async (track) => {
        track('people')
        await page.goto('#/directory')
        await settle(page, 500)
        await shot(page, vp.name, 'directory', 1, 'people')

        track('companies')
        if (await tryClick(page, /^companies$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'directory', 2, 'companies')
        }

        track('not-contacted-filter')
        if (await tryClick(page, /not contacted/i)) {
          await settle(page, 200)
          await shot(page, vp.name, 'directory', 3, 'not-contacted')
        }
      })
    })

    test(`meetings lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'meetings', async (track) => {
        track('upcoming')
        await page.goto('#/meetings')
        await settle(page, 500)
        await shot(page, vp.name, 'meetings', 1, 'upcoming')

        track('past')
        if (await tryClick(page, /^past$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'meetings', 2, 'past')
        }

        track('templates')
        if (await tryClick(page, /^templates$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'meetings', 3, 'templates')
          await escClose(page)
        }

        track('schedule-meeting')
        if (await tryClick(page, /schedule meeting/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'meetings', 4, 'schedule-modal')
          await escClose(page)
        }
      })
    })

    // ════════════════════════════════════════════════════════
    // PRIORITY 3 — supporting surfaces (light coverage)
    // ════════════════════════════════════════════════════════

    test(`equipment lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'equipment', async (track) => {
        track('list')
        await page.goto('#/equipment')
        await settle(page, 400)
        await shot(page, vp.name, 'equipment', 1, 'list-or-empty')

        track('add-equipment')
        if (await tryClick(page, /add equipment/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'equipment', 2, 'add-modal')
          await escClose(page)
        }
      })
    })

    test(`permits lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'permits', async (track) => {
        track('access-or-list')
        await page.goto('#/permits')
        await settle(page, 400)
        await shot(page, vp.name, 'permits', 1, 'access-or-list')
      })
    })

    test(`files lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'files', async (track) => {
        track('list')
        await page.goto('#/files')
        await settle(page, 500)
        await shot(page, vp.name, 'files', 1, 'list-or-empty')

        track('upload')
        if (await tryClick(page, /^upload$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'files', 2, 'upload-modal')
          await escClose(page)
        }

        track('list-toggle')
        const listBtn = page.getByRole('button', { name: /list/i }).first()
        if (await listBtn.count() > 0) {
          await listBtn.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 'files', 3, 'list-view')
        }
      })
    })

    test(`reports lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'reports', async (track) => {
        track('overview')
        await page.goto('#/reports')
        await settle(page, 500)
        await shot(page, vp.name, 'reports', 1, 'overview')

        track('owner-portal')
        await page.goto('#/reports/owner')
        await settle(page, 500)
        await shot(page, vp.name, 'reports', 2, 'owner-portal')
      })
    })

    test(`integrations lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'integrations', async (track) => {
        track('list')
        await page.goto('#/integrations')
        await settle(page, 500)
        await shot(page, vp.name, 'integrations', 1, 'list')
      })
    })

    test(`audit-trail lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'audit-trail', async (track) => {
        track('list')
        await page.goto('#/audit-trail')
        await settle(page, 500)
        await shot(page, vp.name, 'audit-trail', 1, 'list')
      })
    })

    test(`closeout lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'closeout', async (track) => {
        track('overview')
        await page.goto('#/closeout')
        await settle(page, 500)
        await shot(page, vp.name, 'closeout', 1, 'overview')
      })
    })

    test(`contracts lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'contracts', async (track) => {
        track('contracts-tab')
        await page.goto('#/contracts')
        await settle(page, 500)
        await shot(page, vp.name, 'contracts', 1, 'contracts-tab')

        const tabs = ['vendors', 'insurance', 'change orders']
        for (let i = 0; i < tabs.length; i++) {
          track(`tab-${tabs[i]}`)
          if (await tryClick(page, new RegExp(`^${tabs[i]}$`, 'i'))) {
            await settle(page, 300)
            await shot(page, vp.name, 'contracts', 2 + i, `tab-${tabs[i].replace(/\s/g, '-')}`)
          }
        }
      })
    })

    test(`bim lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'bim', async (track) => {
        track('viewer')
        await page.goto('#/bim')
        await settle(page, 800)
        await shot(page, vp.name, 'bim', 1, 'viewer')
      })
    })

    test(`estimating lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'estimating', async (track) => {
        track('list')
        await page.goto('#/estimating')
        await settle(page, 500)
        await shot(page, vp.name, 'estimating', 1, 'list')
      })
    })

    test(`procurement lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'procurement', async (track) => {
        track('list')
        await page.goto('#/procurement')
        await settle(page, 500)
        await shot(page, vp.name, 'procurement', 1, 'list')
      })
    })

    // ════════════════════════════════════════════════════════
    // The AI surface (Iris) — comprehensive
    // ════════════════════════════════════════════════════════

    test(`iris lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'iris', async (track) => {
        track('empty')
        await page.goto('#/ai')
        await settle(page, 500)
        await shot(page, vp.name, 'iris', 1, 'empty-with-prompts')

        track('prompt-clicked')
        const prompt = page.getByRole('button', { name: /budget analysis/i }).first()
        if (await prompt.count() > 0) {
          await prompt.click().catch(() => undefined)
          await settle(page, 1500)
          await shot(page, vp.name, 'iris', 2, 'streaming-or-response')
        }

        track('approvals')
        if (await tryClick(page, /^approvals$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'iris', 3, 'approvals-panel')
          await escClose(page)
        }

        track('history')
        if (await tryClick(page, /^history$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'iris', 4, 'history-panel')
          await escClose(page)
        }
      })
    })

    // ════════════════════════════════════════════════════════
    // Settings — every subroute
    // ════════════════════════════════════════════════════════

    test(`settings lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'settings', async (track) => {
        const routes = [
          { path: '/settings', name: 'project-details' },
          { path: '/settings/team', name: 'team' },
          { path: '/settings/notifications', name: 'notifications' },
          { path: '/settings/workflows', name: 'workflows' },
        ]
        for (let i = 0; i < routes.length; i++) {
          const r = routes[i]
          track(r.name)
          await page.goto('#' + r.path)
          await settle(page, 500)
          await shot(page, vp.name, 'settings', i + 1, r.name)
        }
      })
    })

    // ════════════════════════════════════════════════════════
    // Profile — including the destructive flow
    // ════════════════════════════════════════════════════════

    test(`profile lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'profile', async (track) => {
        track('overview')
        await page.goto('#/profile')
        await settle(page, 500)
        await shot(page, vp.name, 'profile', 1, 'overview')

        // scroll down to see the danger zone
        track('scrolled-to-danger')
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
        await settle(page, 200)
        await shot(page, vp.name, 'profile', 2, 'scrolled-to-danger')

        track('delete-confirm')
        if (await tryClick(page, /^delete account$/i)) {
          await settle(page, 300)
          await shot(page, vp.name, 'profile', 3, 'delete-confirm-empty')

          // type partial confirm to capture the half-validated state
          track('delete-confirm-typed')
          const confirmInput = page.getByPlaceholder(/.+/).first()
          if (await confirmInput.count() > 0) {
            // input doesn't have a placeholder; locate by the label
          }
          // type via keyboard
          await page.keyboard.type('DELETE MY ACCOUNT').catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 'profile', 4, 'delete-confirm-typed')
          await escClose(page)
        }
      })
    })

    // ════════════════════════════════════════════════════════
    // Public surfaces (not in main flow but visited)
    // ════════════════════════════════════════════════════════

    test(`security lifecycle`, async ({ page }) => {
      await withErrorListener(page, vp.name, 'security', async (track) => {
        track('overview')
        await page.goto('#/security')
        await settle(page, 500)
        await shot(page, vp.name, 'security', 1, 'overview')

        track('scrolled')
        await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }))
        await settle(page, 200)
        await shot(page, vp.name, 'security', 2, 'scrolled')
      })
    })
  })
}

test.afterAll(async () => {
  try {
    fs.mkdirSync(path.dirname(ERRORS_FILE), { recursive: true })
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(allErrors, null, 2))
  } catch {
    /* best-effort */
  }
})

test.beforeEach(async () => {
  expect(true).toBeTruthy()
})
