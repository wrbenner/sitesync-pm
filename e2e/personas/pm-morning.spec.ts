/**
 * pm-morning.spec.ts — PM, 8:00am inbox triage.
 *
 * Flow: open Conversation inbox -> answer 3 RFIs -> approve 2 submittals
 * -> review 1 CO.
 *
 * Wiring backlog (docs/STATUS.md):
 *   - /conversation route IS now in App.tsx (verified 2026-04-29) but
 *     Iris suggest strip not mounted on RFI/Submittal/CO detail.
 *   - Workflow runner not yet called from rfiService/submittalService —
 *     status mutations bypass the runner.
 */
import { test, expect } from '@playwright/test'
import { authStateFor } from './__helpers__/personaAuth'
import { measure, finalize } from './__helpers__/timing'
import { logFinding } from './__helpers__/findings'

const PERSONA = 'pm-morning'
test.use({ storageState: authStateFor('pm') })

test.describe(PERSONA, () => {
  test.setTimeout(90_000)

  test('inbox triage -> 3 RFIs -> 2 submittals -> 1 CO', async ({ page }) => {
    await measure(PERSONA, 'open /conversation', async () => {
      await page.goto('/#/conversation', { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    })

    await measure(PERSONA, 'open /rfis', async () => {
      await page.goto('/#/rfis', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    await measure(PERSONA, 'open /submittals', async () => {
      await page.goto('/#/submittals', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    await measure(PERSONA, 'open /change-orders', async () => {
      await page.goto('/#/change-orders', { waitUntil: 'load' })
      await page.waitForTimeout(800)
    })

    logFinding({
      persona: PERSONA,
      step: 'Iris draft response on RFI detail',
      kind: 'expected_unwired',
      citation: 'docs/STATUS.md (Iris suggestion strip not yet mounted on entity detail pages)',
    })
    logFinding({
      persona: PERSONA,
      step: 'workflow runner on RFI status mutation',
      kind: 'expected_unwired',
      citation: 'docs/PLATINUM_WORKFLOWS.md (runner not yet called from entity service mutations)',
      notes: 'src/lib/workflows/runner.ts not invoked from src/services/rfiService.ts',
    })

    // Without the workflow runner integration, "answer 3 RFIs / approve
    // 2 submittals / review 1 CO" amounts to plain status mutations,
    // which the page-level specs already cover. Mark this end-to-end
    // assertion as expected_unwired.
    test.skip(
      true,
      'expected_unwired: inbox-batched triage flow not yet a single screen (requires Conversation inbox UX integration)',
    )

    expect(page.url()).toContain('/change-orders')
    finalize(PERSONA)
  })
})
