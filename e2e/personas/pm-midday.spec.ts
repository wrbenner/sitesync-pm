/**
 * pm-midday.spec.ts — PM, 11:00am pay-app reconciliation.
 *
 * Flow: open pay app -> reconciliation -> resolve variances -> submit
 * to owner.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - PreSubmissionAudit not yet mounted in PayAppDetail.tsx ->
 *     expected_unwired
 *   - /share/owner-payapp public route absent -> expected_unwired
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'pm-midday'
test.use({ storageState: authStateFor('pm') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('pay app reconciliation -> resolve variances -> submit', async ({ page }) => {
    await measure(PERSONA, 'open /pay-apps', async () => {
      await page.goto('/#/pay-apps', { waitUntil: 'load' })
      await page.waitForTimeout(1200)
    })

    logFinding({
      persona: PERSONA,
      step: 'PreSubmissionAudit on pay app detail',
      kind: 'expected_unwired',
      citation: 'docs/COMPLIANCE_GATE.md',
      notes: 'src/pages/payment-applications/PreSubmissionAudit.tsx exists; not mounted in PayAppDetail.tsx',
    })

    logFinding({
      persona: PERSONA,
      step: 'submit-to-owner share link generation',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (Public route /share/owner-payapp pending registration)',
      notes: 'OwnerPayAppPreview.tsx exists; route not registered in src/App.tsx',
    })

    test.skip(
      true,
      'expected_unwired: pay-app reconciliation -> compliance gate -> owner-share is pending wiring in PayAppDetail',
    )

    expect(page.url()).toContain('/pay-apps')
    finalize(PERSONA)
  })
})
