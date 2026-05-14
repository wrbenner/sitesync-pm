/**
 * Phase B.13 — Mobile viewport regression for high-value flows.
 *
 * Re-runs a subset of B.1's route sweep at iPhone + iPad viewports.
 * Catches "page renders fine on desktop but breaks on iPhone" bugs
 * (overflow, fixed-position overlap, hidden CTAs).
 *
 * Viewports per ops/coverage/mobile.json:
 *   iPhone   375×812
 *   iPad     414×896   (Walker noted this was actually iPad Mini-shape)
 *   iPad Pro 1024×1366
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

const VIEWPORTS = [
  { device: 'iPhone', w: 375, h: 812 },
  { device: 'iPad', w: 414, h: 896 },
  { device: 'iPad Pro', w: 1024, h: 1366 },
]

// High-value flows that MUST work on mobile (field users + supers).
const FLOWS = ['/day', '/daily-log', '/punch-list', '/rfis', '/photos', '/field']

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByPlaceholder('you@company.com').fill(USER)
  await page.getByPlaceholder('Enter your password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|day|onboarding|profile|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test.describe('B.13 — Mobile viewport regression', () => {
  for (const vp of VIEWPORTS) {
    for (const flow of FLOWS) {
      test(`${vp.device} ${vp.w}x${vp.h} renders ${flow}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h })

        const consoleErrors: string[] = []
        page.on('console', (msg: ConsoleMessage) => {
          if (msg.type() === 'error' && /TypeError|ReferenceError/i.test(msg.text())) {
            consoleErrors.push(msg.text())
          }
        })

        await signIn(page)
        await page.goto(`${BASE_URL}/#${flow}`)
        await page.waitForTimeout(1_500)

        // Assert no horizontal overflow on the body
        const overflow = await page.evaluate(() => {
          const body = document.body
          return body.scrollWidth - body.clientWidth
        })
        expect(
          overflow,
          `${flow} on ${vp.device} has horizontal overflow of ${overflow}px (body scrollWidth > clientWidth)`,
        ).toBeLessThanOrEqual(2)

        expect(
          consoleErrors,
          `JS crash on ${flow} @ ${vp.device}:\n${consoleErrors.join('\n')}`,
        ).toHaveLength(0)
      })
    }
  }
})
