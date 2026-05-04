/**
 * Scenario 8 — The realtime loop
 *
 *   Two PMs open same RFI
 *     → presence shows both
 *     → one types in MentionInput
 *     → @-autocomplete fires
 *     → mention notification queued
 *     → other user sees typing indicator
 *     → both edit simultaneously via CollabTextarea
 *     → no last-write-wins data loss.
 *
 * STATUS: SKIPPED — depends on Liveblocks integration which is Tab A
 * territory (per the spec's "out of scope" list, but the realtime
 * surface is the dependency). The MentionInput / CollabTextarea
 * components exist on a separate branch.
 *
 * What's shipped this session that this scenario can use today:
 *   • org_search_index for the @-autocomplete data
 *   • Notification table + RLS for the mention notification
 *
 * Full spec stays skipped until Liveblocks is wired.
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test.skip('realtime — two PMs co-edit RFI without data loss', async ({ browser }) => {
  // Realtime requires two browser contexts simulating two users.
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  const setupA = await setupScenario(pageA, { name: '08-realtime' })
  try {
    // 1. Both users open the same RFI.
    await pageA.goto('/#/rfis/<test-rfi-id>')
    await pageB.goto('/#/rfis/<test-rfi-id>')

    // 2. Presence shows both avatars.
    await expect(pageA.getByLabel(/2 collaborators/i)).toBeVisible()

    // 3. User A types '@' in mention input.
    // 4. Autocomplete fires; pick a workforce member.
    // 5. Send mention; assert notification queued.
    // 6. User B sees the new line + typing indicator.
    // 7. Both edit simultaneously; assert both edits land (CRDT, no LWW).

    expect(setupA.ctx.emails.find(e => /mentioned you/i.test(e.subject))).toBeDefined()
  } finally {
    await setupA.teardown()
    await ctxA.close()
    await ctxB.close()
  }
})
