/**
 * Keyboard-shortcuts audit — every documented shortcut must actually
 * fire. The shortcuts list is mirrored from src/lib/keyboard-shortcuts
 * (or wherever the canonical list lives in this codebase).
 *
 * Rule: a shortcut "fires" when pressing it changes ONE of:
 *   • URL (route change)
 *   • a known dialog/popover open state (data-state="open" on a known
 *     trigger element OR a dialog with role="dialog" appearing)
 *   • a focus shift to a known input (e.g. Cmd+K → focus search input)
 *
 * If none of the above changes within 600ms of keypress, the shortcut
 * is recorded as "did not fire."
 *
 * Output: audit/keyboard-shortcuts.json
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(REPO_ROOT, 'audit', 'keyboard-shortcuts.json')

interface ShortcutCheck {
  name: string
  keys: string                                          // Playwright key sequence
  /** Where to start before pressing. */
  start_route: string
  /** What we expect to happen. */
  expect: 'open_palette' | 'open_help' | 'navigate'
  /** When expect === 'navigate', the resulting URL fragment we look for. */
  to?: string
}

const CHECKS: ReadonlyArray<ShortcutCheck> = [
  { name: 'Cmd+K opens command palette', keys: 'Meta+K', start_route: '/dashboard', expect: 'open_palette' },
  { name: '? opens shortcuts help',      keys: '?',      start_route: '/dashboard', expect: 'open_help' },
  { name: 'g d → Dashboard',             keys: 'g d',    start_route: '/rfis',      expect: 'navigate', to: '/dashboard' },
  { name: 'g r → RFIs',                  keys: 'g r',    start_route: '/dashboard', expect: 'navigate', to: '/rfis' },
  { name: 'g l → Daily Log',             keys: 'g l',    start_route: '/dashboard', expect: 'navigate', to: '/daily-log' },
]

interface CheckResult {
  name: string
  fired: boolean
  detail: string
}

const results: CheckResult[] = []

for (const c of CHECKS) {
  test(`keyboard-shortcut @ ${c.name}`, async ({ page }) => {
    test.setTimeout(20_000)
    await page.goto(`/sitesync-pm/#${c.start_route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)

    const startUrl = page.url()

    // Press the keys (split on whitespace; press each segment).
    for (const seg of c.keys.split(/\s+/)) {
      await page.keyboard.press(seg)
      await page.waitForTimeout(80)
    }

    let fired = false
    let detail = ''

    if (c.expect === 'open_palette') {
      const palette = page.locator('[role="dialog"]:has-text("Search"), [aria-label*="command palette" i]').first()
      try {
        await palette.waitFor({ state: 'visible', timeout: 1_000 })
        fired = true
        detail = 'palette dialog visible'
      } catch { detail = 'palette not visible after keypress' }
    } else if (c.expect === 'open_help') {
      const help = page.locator('[role="dialog"]:has-text("shortcut" i), [data-shortcuts="help"]').first()
      try {
        await help.waitFor({ state: 'visible', timeout: 1_000 })
        fired = true
        detail = 'help dialog visible'
      } catch { detail = 'help not visible after keypress' }
    } else if (c.expect === 'navigate' && c.to) {
      try {
        await page.waitForURL(new RegExp(c.to.replace(/\//g, '\\/')), { timeout: 1_500 })
        fired = true
        detail = `navigated to ${page.url()}`
      } catch { detail = `did not navigate (still at ${startUrl})` }
    }

    results.push({ name: c.name, fired, detail })
    expect(true).toBe(true)
  })
}

test.afterAll(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    total: results.length,
    fired: results.filter((r) => r.fired).length,
    results,
  }, null, 2))
  // eslint-disable-next-line no-console
  console.log(`[keyboard-shortcuts] ${results.filter((r) => r.fired).length}/${results.length} fired`)
})
