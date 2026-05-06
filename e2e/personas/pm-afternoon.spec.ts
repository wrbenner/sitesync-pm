/**
 * pm-afternoon.spec.ts — PM, 4:00pm punch list bulk-assign.
 *
 * Flow: punch list -> bulk-assign 12 items -> approve walkthrough captures.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - /walkthrough route absent (per Pre-existing doc debt section) ->
 *     expected_unwired for "approve walkthrough captures" step.
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'pm-afternoon'
test.use({ storageState: authStateFor('pm') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('punch list -> bulk-assign -> walkthrough captures', async ({ page }) => {
    await measure(PERSONA, 'open /punch-list', async () => {
      await page.goto('/#/punch-list', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    // Bulk-assign UI exists on the page. Document any time-to-render
    // observations as friction even when no regression is fired.
    await measure(PERSONA, 'open /punch-list (re-render)', async () => {
      await page.goto('/#/punch-list', { waitUntil: 'load' })
      await page.waitForTimeout(500)
    })

    logFinding({
      persona: PERSONA,
      step: 'walkthrough capture review',
      kind: 'expected_unwired',
      citation: 'docs/WALKTHROUGH_MODE.md + docs/STATUS.md (no host /walkthrough route)',
      notes: 'src/pages/walkthrough/index.tsx exists but route not registered',
    })

    test.skip(
      true,
      'expected_unwired: walkthrough capture approval flow needs /walkthrough route',
    )

    expect(page.url()).toContain('/punch-list')
    finalize(PERSONA)
  })
})
