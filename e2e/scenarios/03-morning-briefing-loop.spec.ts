/**
 * Scenario 3 — The morning-briefing loop
 *
 *   6am cron → morning-briefing edge function runs per project
 *     → notification queue populated
 *     → notification-queue-worker sends emails
 *     → push notifications fire
 *     → user opens app
 *     → briefing renders with real data.
 *
 * STATUS: SKIPPED — depends on:
 *   • morning-briefing edge function (not shipped this session)
 *   • notification-queue-worker (notification_queue table exists; worker
 *     edge function does not)
 *   • push notification infrastructure (FCM/APNs tokens, not in scope)
 *
 * The spec body is structured so when the producers ship, removing
 * `test.skip` is the only change.
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test.skip('morning-briefing — cron → queue → email → app', async ({ page }) => {
  const { ctx, teardown } = await setupScenario(page, {
    name: '03-morning-briefing',
    aiResponses: {
      'morning briefing for project': 'Today: 3 RFIs require response. Pour scheduled at 9am. 1 punch item critical.',
    },
  })
  try {
    // 1. Trigger morning-briefing cron.
    const result = await ctx.triggerCron('morning-briefing', { simulatedTime: '06:00' })
    expect(result).toBeTruthy()

    // 2. Assert notification_queue was populated for each project member.
    // 3. Assert notification-queue-worker drained the queue.
    // 4. Assert outbound emails captured.
    expect(ctx.emails.length).toBeGreaterThan(0)
    expect(ctx.emails.every(e => /briefing|morning/i.test(e.subject))).toBe(true)

    // 5. User opens app — briefing card visible on dashboard.
    await page.goto('/#/dashboard')
    await expect(page.getByText(/morning briefing|today's briefing/i)).toBeVisible()
  } finally {
    await teardown()
  }
})
