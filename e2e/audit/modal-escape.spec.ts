/**
 * Modal-escape audit — every visible modal must close via:
 *   1. Escape key
 *   2. Backdrop click (clicking outside the dialog content)
 *   3. The dialog's own X button
 *
 * Approach: open every entry-point we know about, find each resulting
 * dialog, then verify the three close paths each work.
 *
 * Pages with known modal triggers are enumerated explicitly. Each
 * trigger is identified by aria-label or visible text rather than
 * brittle CSS selectors so the audit survives style refactors.
 *
 * Output: audit/modal-escape.json
 */
import { test, expect, Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(REPO_ROOT, 'audit', 'modal-escape.json')

interface ModalCase {
  name: string
  start_route: string
  /** Selector for the trigger button. Use aria-label or visible text. */
  trigger: string
  /** Optional explicit dialog-close X selector. Defaults to a generic close button query. */
  close_x_selector?: string
}

const CASES: ReadonlyArray<ModalCase> = [
  { name: 'New RFI modal',          start_route: '/rfis',        trigger: 'button:has-text("New RFI")' },
  { name: 'New Submittal modal',    start_route: '/submittals',  trigger: 'button:has-text("New Submittal")' },
  { name: 'New Change Order modal', start_route: '/change-orders', trigger: 'button:has-text("Create")' },
  { name: 'New Crew modal',         start_route: '/crews',       trigger: 'button:has-text("Add Crew")' },
  { name: 'Command palette (Cmd+K)', start_route: '/dashboard',  trigger: '__keypress__:Meta+K' },
]

interface CaseResult {
  name: string
  opened: boolean
  closes_on_escape: boolean
  closes_on_backdrop: boolean
  closes_on_x: boolean
  detail?: string
}

const results: CaseResult[] = []

async function openModal(page: Page, c: ModalCase): Promise<boolean> {
  await page.goto(`/sitesync-pm/#${c.start_route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  if (c.trigger.startsWith('__keypress__:')) {
    const keys = c.trigger.replace('__keypress__:', '')
    await page.keyboard.press(keys)
  } else {
    const btn = page.locator(c.trigger).first()
    try {
      await btn.click({ timeout: 2_000 })
    } catch { return false }
  }
  // Wait for any role="dialog" to appear.
  try {
    await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 1_500 })
    return true
  } catch { return false }
}

async function dialogVisible(page: Page): Promise<boolean> {
  return page.locator('[role="dialog"]').first().isVisible().catch(() => false)
}

for (const c of CASES) {
  test(`modal-escape @ ${c.name}`, async ({ page }) => {
    test.setTimeout(20_000)
    const r: CaseResult = {
      name: c.name, opened: false,
      closes_on_escape: false, closes_on_backdrop: false, closes_on_x: false,
    }

    // 1. Escape
    if (await openModal(page, c)) {
      r.opened = true
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      r.closes_on_escape = !(await dialogVisible(page))
    } else {
      r.detail = 'modal did not open on trigger'
      results.push(r)
      return
    }

    // 2. Backdrop click — re-open and click outside the dialog content.
    if (await openModal(page, c)) {
      const dialog = page.locator('[role="dialog"]').first()
      try {
        const box = await dialog.boundingBox()
        if (box) {
          // Click 8px outside the top-left corner.
          await page.mouse.click(Math.max(0, box.x - 8), Math.max(0, box.y - 8))
          await page.waitForTimeout(300)
          r.closes_on_backdrop = !(await dialogVisible(page))
        }
      } catch { /* leave false */ }
    }

    // 3. X button — re-open and click the dialog's close affordance.
    if (await openModal(page, c)) {
      const closeBtn = page
        .locator('[role="dialog"]')
        .first()
        .locator(c.close_x_selector ?? 'button[aria-label*="close" i], button:has-text("×"), button:has-text("Close")')
        .first()
      try {
        await closeBtn.click({ timeout: 1_500 })
        await page.waitForTimeout(300)
        r.closes_on_x = !(await dialogVisible(page))
      } catch { /* leave false */ }
    }

    results.push(r)
    expect(true).toBe(true)
  })
}

test.afterAll(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    cases: results,
  }, null, 2))
  // eslint-disable-next-line no-console
  const allClosed = results.filter((r) => r.opened && r.closes_on_escape && r.closes_on_backdrop && r.closes_on_x).length
  console.log(`[modal-escape] ${allClosed}/${results.length} cases pass all three close paths`)
})
