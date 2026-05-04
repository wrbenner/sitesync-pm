/**
 * Wave-1 walk — captures the demo-critical surfaces as PM and Super would
 * see them, against the running dev server. Output lands in
 * `polish-review/wave1-walk/{viewport}/{slug}.png` so we can score each
 * screen against the investor-demo story.
 *
 * Run:
 *   POLISH_USER=... POLISH_PASS=... pnpm playwright test e2e/wave1-walk.spec.ts \
 *     --config=playwright.polish.config.ts
 *
 * Or, if `playwright/.auth/user.json` already exists from a prior polish run,
 * just `pnpm playwright test e2e/wave1-walk.spec.ts --config=playwright.polish.config.ts`
 * and it'll reuse the session.
 */
import { test, type Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'wave1-walk')

interface Stop {
  hash: string
  slug: string
  /** optional in-page action before the shot, e.g. expand first stream item */
  prepare?: (page: Page) => Promise<void>
}

const STOPS: Stop[] = [
  { hash: '/day',                          slug: '01-command-stream' },
  {
    hash: '/day',
    slug: '02-command-stream-item-expanded',
    prepare: async (page) => {
      // Click the first stream item to expand it.
      const first = page.locator('[data-stream-item]').first()
      if (await first.count()) await first.click({ trial: false }).catch(() => {})
      await page.waitForTimeout(300)
    },
  },
  { hash: '/drawings',                     slug: '03-drawings' },
  { hash: '/rfis',                         slug: '04-rfis' },
  { hash: '/budget',                       slug: '05-budget' },
  { hash: '/schedule',                     slug: '06-schedule' },
  { hash: '/daily-log',                    slug: '07-daily-log' },
  { hash: '/punch-list',                   slug: '08-punch-list' },
  { hash: '/submittals',                   slug: '09-submittals' },
  { hash: '/reports',                      slug: '10-reports' },
  { hash: '/commitments',                  slug: '11-commitments' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'iphone',  width: 390,  height: 844 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`wave1-walk @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    for (const stop of STOPS) {
      test(`${stop.slug}`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(`console: ${m.text()}`)
        })

        await page.goto(`/sitesync-pm/#${stop.hash}`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(800) // let layout + animations settle
        if (stop.prepare) await stop.prepare(page)

        const dir = path.join(OUT_DIR, vp.name)
        fs.mkdirSync(dir, { recursive: true })
        await page.screenshot({
          path: path.join(dir, `${stop.slug}.png`),
          fullPage: true,
        })

        if (errors.length) {
          fs.writeFileSync(
            path.join(dir, `${stop.slug}.errors.txt`),
            errors.join('\n'),
          )
        }
      })
    }
  })
}
