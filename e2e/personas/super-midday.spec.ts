/**
 * super-midday.spec.ts — Superintendent, 11:30am field capture.
 *
 * Flow: photo capture -> Iris classify -> confirm RFI draft -> submit.
 *
 * Wiring backlog references (docs/STATUS.md):
 *   - Iris approval gate not mounted on RFI detail -> expected_unwired
 *   - parse-walkthrough-capture edge fn requires service role to invoke
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'super-midday'
test.use({ storageState: authStateFor('super') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('field capture -> classify -> RFI draft', async ({ page }) => {
    await measure(PERSONA, 'open /rfis', async () => {
      await page.goto('/#/rfis', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    // Iris drafted-action gate is implemented but not mounted on entity
    // pages per docs/STATUS.md ("Iris suggestion strip not yet mounted").
    logFinding({
      persona: PERSONA,
      step: 'Iris approval gate on RFI detail',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages)',
      notes: 'src/components/iris/IrisApprovalGate.tsx exists but no host page mounts it',
    })

    // The photo-classify -> RFI-draft pipeline requires the parse edge fn
    // and Iris suggest fn; both are deployed but the call-site isn't
    // wired into the photo upload flow. Skip the end-to-end assertion.
    test.skip(
      true,
      'expected_unwired: photo classify -> RFI auto-draft is implemented in lib/edge fns but call-site is missing',
    )

    expect(page.url()).toContain('/rfis')
    finalize(PERSONA)
  })
})
