/**
 * compliance-weekly.spec.ts — Compliance officer, weekly cadence.
 *
 * Flow: WH-347 generation -> verify zero rate violations -> e-sign ->
 * archive.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - WH-347 generator + PDF renderer exist (src/lib/compliance/wh347,
 *     src/lib/reports/wh347Pdf.ts). The host page is /reports today; the
 *     dedicated /compliance/wh347 admin route is absent.
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'compliance-weekly'
test.use({ storageState: authStateFor('compliance') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('WH-347 -> zero violations -> e-sign -> archive', async ({ page }) => {
    await measure(PERSONA, 'open /reports', async () => {
      await page.goto('/#/reports', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    logFinding({
      persona: PERSONA,
      step: 'dedicated WH-347 host page',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (WH-347 generator shipped end-to-end; admin host page absent)',
      notes: 'src/lib/compliance/wh347 + src/lib/reports/wh347Pdf.ts ready; no /admin/wh347 route',
    })
    logFinding({
      persona: PERSONA,
      step: 'e-sign and archive WH-347',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (no e-sign UI in repo for WH-347)',
    })

    test.skip(true, 'expected_unwired: WH-347 admin flow not yet wired into a single screen')

    expect(page.url()).toContain('/reports')
    finalize(PERSONA)
  })
})
