/**
 * compliance-monthly.spec.ts — Compliance officer, monthly cadence.
 *
 * Flow: OSHA 300 export -> COI gap report -> preliminary notice deadlines.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - OSHA 300 generator exists at src/lib/compliance/osha300; no host
 *     export page in /admin yet -> expected_unwired
 *   - COI block banner expects a host page (the crew check-in page) that
 *     doesn't exist yet -> expected_unwired
 *   - Preliminary notice deadline UI is absent (lien-rights lib exists)
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'compliance-monthly'
test.use({ storageState: authStateFor('compliance') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('OSHA 300 -> COI gap report -> prelim notices', async ({ page }) => {
    await measure(PERSONA, 'open /reports', async () => {
      await page.goto('/#/reports', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    logFinding({
      persona: PERSONA,
      step: 'OSHA 300 export host page',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (OSHA 300/300A lib shipped; no UI host page)',
    })
    logFinding({
      persona: PERSONA,
      step: 'COI gap report dashboard',
      kind: 'expected_unwired',
      citation: 'docs/COMPLIANCE_GATE.md (COI banner mounts pending)',
    })
    logFinding({
      persona: PERSONA,
      step: 'preliminary notice deadlines',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (state lien rules lib shipped; no UI host page)',
    })

    test.skip(true, 'expected_unwired: monthly compliance dashboard absent')

    expect(page.url()).toContain('/reports')
    finalize(PERSONA)
  })
})
