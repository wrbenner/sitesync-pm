// =============================================================================
// runPhotoLinker — resolution-rule regression tests
// =============================================================================
// Pure unit tests: no DB. Each test pins a single rule of the engine so a
// future change can't silently invert a behavior the field actually depends on
// (low-confidence GPS staying low-confidence on every link, disputed checkins
// being ignored, etc.).
// =============================================================================

import { describe, it, expect } from 'vitest'
import { runPhotoLinker, type LinkerContext } from './photoLinker'
import type { MediaInput } from './types'
import type { DrawingRow } from './drawingPinResolver'
import type { CrewCheckinRow, CrewRow } from './subResolver'

// A drawing centered on (30, -97) — Avery Oaks-ish coords. Sheet is 80m × 60m,
// north-aligned. Origin = the SW corner of the depicted area.
const SHEET_A: DrawingRow = {
  id: 'd-a',
  project_id: 'p',
  origin_set: true,
  origin_lat: 30.4080,
  origin_lng: -97.7570,
  sheet_extent_m: { w_m: 80, h_m: 60 },
  north_offset_deg: 0,
}

const SHEET_NO_ORIGIN: DrawingRow = {
  id: 'd-no',
  project_id: 'p',
  origin_set: false,
  origin_lat: null,
  origin_lng: null,
  sheet_extent_m: null,
  north_offset_deg: null,
}

function emptyCtx(overrides: Partial<LinkerContext> = {}): LinkerContext {
  return {
    drawings: [],
    checkins: [],
    crewsById: new Map(),
    todaysDailyLog: null,
    openPunchItems: [],
    openRfis: [],
    ...overrides,
  }
}

describe('runPhotoLinker — drawings', () => {
  it('skips drawings without origin_set', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568, gpsStatus: 'good', gpsAccuracyMeters: 5,
    }
    const links = runPhotoLinker(media, emptyCtx({ drawings: [SHEET_NO_ORIGIN] }))
    expect(links.filter(l => l.entityType === 'drawing')).toHaveLength(0)
  })

  it('produces a drawing pin in [0..1] when GPS lands inside the sheet extent', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568, gpsStatus: 'good', gpsAccuracyMeters: 5,
    }
    const links = runPhotoLinker(media, emptyCtx({ drawings: [SHEET_A] }))
    const drawing = links.find(l => l.entityType === 'drawing')
    expect(drawing).toBeDefined()
    expect(drawing!.pinX).toBeGreaterThanOrEqual(0)
    expect(drawing!.pinX).toBeLessThanOrEqual(1)
    expect(drawing!.pinY).toBeGreaterThanOrEqual(0)
    expect(drawing!.pinY).toBeLessThanOrEqual(1)
  })

  it('drops drawings whose extent does not contain the point', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 31.0,  // way north of the sheet
      lng: -97.7,
      gpsStatus: 'good', gpsAccuracyMeters: 5,
    }
    const links = runPhotoLinker(media, emptyCtx({ drawings: [SHEET_A] }))
    expect(links.filter(l => l.entityType === 'drawing')).toHaveLength(0)
  })

  it('skips drawing resolution when gpsStatus is unavailable', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568, gpsStatus: 'unavailable',
    }
    const links = runPhotoLinker(media, emptyCtx({ drawings: [SHEET_A] }))
    expect(links.filter(l => l.entityType === 'drawing')).toHaveLength(0)
  })
})

describe('runPhotoLinker — sub on site', () => {
  const crews: Map<string, CrewRow> = new Map([
    ['c-roof', { id: 'c-roof', trade: 'Roofing' }],
    ['c-frame', { id: 'c-frame', trade: 'Wood Framing' }],
  ])

  it('returns the crew whose checkin window contains the photo', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
    }
    const checkins: CrewCheckinRow[] = [{
      id: 'k1', crew_id: 'c-roof',
      checked_in_at: '2026-04-29T13:00:00Z',
      checked_out_at: '2026-04-29T20:00:00Z',
      disputed_at: null,
    }]
    const links = runPhotoLinker(media, emptyCtx({ checkins, crewsById: crews }))
    expect(links.find(l => l.entityType === 'crew')?.entityId).toBe('c-roof')
  })

  it('ignores disputed checkins for legal-grade attribution', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
    }
    const checkins: CrewCheckinRow[] = [{
      id: 'k1', crew_id: 'c-roof',
      checked_in_at: '2026-04-29T13:00:00Z',
      checked_out_at: '2026-04-29T20:00:00Z',
      disputed_at: '2026-04-29T16:00:00Z',
    }]
    const links = runPhotoLinker(media, emptyCtx({ checkins, crewsById: crews }))
    expect(links.filter(l => l.entityType === 'crew')).toHaveLength(0)
  })

  it('breaks ties with spec-section affinity (07 → roofing)', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      specSection: '07 46 46',  // siding/sheet metal — roofing trade
    }
    const checkins: CrewCheckinRow[] = [
      { id: 'k1', crew_id: 'c-roof',  checked_in_at: '2026-04-29T13:00:00Z', checked_out_at: '2026-04-29T20:00:00Z', disputed_at: null },
      { id: 'k2', crew_id: 'c-frame', checked_in_at: '2026-04-29T13:00:00Z', checked_out_at: '2026-04-29T20:00:00Z', disputed_at: null },
    ]
    const links = runPhotoLinker(media, emptyCtx({ checkins, crewsById: crews }))
    const crewLinks = links.filter(l => l.entityType === 'crew')
    expect(crewLinks[0].entityId).toBe('c-roof')
  })
})

describe('runPhotoLinker — daily log + punch items', () => {
  it('attaches today\'s daily log when the photo timestamp matches', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
    }
    const links = runPhotoLinker(media, emptyCtx({
      todaysDailyLog: { id: 'log-1', log_date: '2026-04-29' },
    }))
    expect(links.find(l => l.entityType === 'daily_log')?.entityId).toBe('log-1')
  })

  it('attaches a nearby (≤5 m) punch item', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568,
    }
    const links = runPhotoLinker(media, emptyCtx({
      openPunchItems: [
        { id: 'pi-far',  geo_lat: 30.5,    geo_lng: -97.7,    status: 'open' },
        { id: 'pi-near', geo_lat: 30.4082, geo_lng: -97.7568, status: 'open' },
      ],
    }))
    const punch = links.filter(l => l.entityType === 'punch_item')
    expect(punch.map(l => l.entityId)).toContain('pi-near')
    expect(punch.map(l => l.entityId)).not.toContain('pi-far')
  })
})

describe('runPhotoLinker — idempotency', () => {
  it('produces the same edges on repeated calls', () => {
    const media: MediaInput = {
      mediaId: 'm1', mediaType: 'photo_pin', projectId: 'p',
      takenAt: '2026-04-29T15:00:00Z',
      lat: 30.4082, lng: -97.7568, gpsStatus: 'good', gpsAccuracyMeters: 5,
    }
    const ctx = emptyCtx({
      drawings: [SHEET_A],
      todaysDailyLog: { id: 'log-1', log_date: '2026-04-29' },
    })
    const a = runPhotoLinker(media, ctx)
    const b = runPhotoLinker(media, ctx)
    expect(a).toEqual(b)
  })
})
