/**
 * Scenario 1 — The SLA loop
 *
 *   PM files RFI
 *     → escalator fires reminder at T-2
 *     → architect ignores
 *     → escalator fires CC-manager at +3
 *     → architect replies via inbound-email
 *     → reply threads onto the RFI
 *     → SLA clock resolves
 *     → escalation marked closed
 *
 * STATUS: SKIPPED — depends on features not yet shipped this session.
 * Required:
 *   • inbound-email edge function (parses Postmark webhook → rfi_responses)
 *     — prior round (Tab A integration), not landed in this branch
 *   • sla-escalator cron + business-day calendar (slaCalculator.ts)
 *     — designed but not built
 *   • CC-manager escalation policy table
 *
 * The spec body is written so when those features ship, removing the
 * `test.skip` is the only change needed.
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test.skip('SLA loop — RFI → escalation → inbound reply → close', async ({ page }) => {
  const { ctx, teardown } = await setupScenario(page, {
    name: '01-sla-loop',
    aiResponses: {},
  })
  try {
    // 1. PM files an RFI via UI.
    await page.goto('/#/rfis')
    await page.getByRole('button', { name: /new rfi/i }).click()
    await page.getByLabel(/title/i).fill('North wall flashing detail')
    await page.getByLabel(/description/i).fill('Need clarification on flashing termination at parapet.')
    await page.getByRole('button', { name: /send|submit/i }).click()

    // 2. Trigger sla-escalator cron with a clock-now-equal-to-T-2 fixture.
    await ctx.triggerCron('sla-escalator', { simulatedNow: '+T-2' })

    // 3. Assert reminder email queued to architect.
    expect(ctx.emails.find(e => /reminder/i.test(e.subject))).toBeDefined()

    // 4. Trigger again at +3 — expect CC to manager.
    await ctx.triggerCron('sla-escalator', { simulatedNow: '+3' })
    expect(ctx.emails.find(e => /cc.*manager/i.test(e.subject))).toBeDefined()

    // 5. Simulate architect replying via inbound-email webhook.
    await page.request.post('/test/inbound-email', {
      data: {
        from: 'architect@e2e.test',
        subject: 'Re: RFI 001 — North wall flashing detail',
        text: 'Use detail B from sheet A8.04. No scope change.',
      },
    })

    // 6. Assert reply threaded onto the RFI.
    await page.goto('/#/rfis')
    await page.getByText(/north wall flashing/i).click()
    await expect(page.getByText(/use detail b from sheet a8.04/i)).toBeVisible()

    // 7. Assert escalation marked closed.
    expect(ctx.emails.find(e => /closed|resolved/i.test(e.subject))).toBeDefined()
  } finally {
    await teardown()
  }
})
