/**
 * Scenario 4 — The walkthrough loop
 *
 *   Owner walk → voice + photo capture
 *     → parse-walkthrough-capture extracts items
 *     → linkage engine attaches drawings/subs
 *     → punch items bulk-create
 *     → email notifications to subs
 *     → subs reply via inbound-email-aware flow
 *     → punch items update.
 *
 * STATUS: SKIPPED — depends on features across multiple streams:
 *   • parse-walkthrough-capture edge function (Tab C voice transcription)
 *   • linkage engine (this session — would actually run)
 *   • inbound-email reply parser (prior round)
 *   • bulk punch creation flow (UI integration)
 *
 * The linkage portion alone is testable today; a partial spec is
 * marked `test()` (unskip) to exercise just the photoLinker chain. The
 * full loop stays skipped.
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test.skip('walkthrough — voice/photo → punch → sub email → reply (full loop deferred)', async ({ page }) => {
  const { ctx, teardown } = await setupScenario(page, {
    name: '04-walkthrough',
    aiResponses: {
      'extract punch items from this walkthrough': [
        { title: 'Cabinet door alignment unit 312', area: 'Kitchen' },
        { title: 'Paint touch up corridor B2', area: 'Corridor' },
      ],
    },
  })
  try {
    // 1. Upload voice + photo via the walkthrough capture endpoint.
    // 2. parse-walkthrough-capture extracts structured punch items.
    // 3. linkage engine attaches drawings + subs (this session's photo linker).
    // 4. Punch items bulk-created.
    // 5. Sub emails dispatched.
    // 6. Sub replies via inbound-email; punch updates.
    expect(ctx.emails.length).toBeGreaterThan(0)
    await page.goto('/#/punch-list')
  } finally {
    await teardown()
  }
})

test('walkthrough — linkage engine standalone (this session\'s photoLinker)', async () => {
  // This sub-scenario tests just the auto-linker rules independently of the
  // walkthrough infrastructure. It runs today; the full loop above doesn't.
  const { runPhotoLinker } = await import('../../src/lib/linkage/photoLinker')
  const result = runPhotoLinker(
    {
      mediaId: 'ee400001-0000-4000-8000-000000000001',
      mediaType: 'photo_pin',
      projectId: 'e2000001-0000-4000-8000-000000000002',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568, gpsStatus: 'good', gpsAccuracyMeters: 5,
    },
    {
      drawings: [{
        id: 'dwg-1', project_id: 'e2000001-0000-4000-8000-000000000002',
        origin_set: true, origin_lat: 30.4080, origin_lng: -97.7570,
        sheet_extent_m: { w_m: 80, h_m: 60 }, north_offset_deg: 0,
      }],
      checkins: [{
        id: 'k1', crew_id: 'crew-roof',
        checked_in_at: '2026-04-29T13:00:00Z', checked_out_at: '2026-04-29T20:00:00Z',
        disputed_at: null,
      }],
      crewsById: new Map([['crew-roof', { id: 'crew-roof', trade: 'Roofing' }]]),
      todaysDailyLog: { id: 'log-1', log_date: '2026-04-29' },
      openPunchItems: [],
      openRfis: [],
    },
  )
  // Expect at least drawing + crew + daily-log links from the same photo.
  expect(result.find(l => l.entityType === 'drawing')).toBeDefined()
  expect(result.find(l => l.entityType === 'crew')).toBeDefined()
  expect(result.find(l => l.entityType === 'daily_log')).toBeDefined()
})
