import { describe, it, expect } from 'vitest'
import { stripPii, assembleDailyLogDraft } from './sections'
import type { DayContext, DraftedDailyLogCrewRow } from '../../types/dailyLogDraft'

describe('stripPii', () => {
  it('redacts emails', () => {
    expect(stripPii('contact me at jane@example.com please')).toMatch(
      /\[email redacted\]/,
    )
  })

  it('redacts US phone numbers in dash, dot, and space-separated form', () => {
    expect(stripPii('call 415-555-1234 today')).toMatch(/\[phone redacted\]/)
    expect(stripPii('call 415 555 1234 today')).toMatch(/\[phone redacted\]/)
    expect(stripPii('555.123.4567 backup')).toMatch(/\[phone redacted\]/)
    expect(stripPii('digits 4155551234 too')).toMatch(/\[phone redacted\]/)
  })

  it('redacts likely full names (Title Case First Last)', () => {
    expect(stripPii('Jane Smith arrived')).toMatch(/\[name redacted\]/)
    expect(stripPii('John Quincy Public attended')).toMatch(/\[name redacted\]/)
  })

  it('does not redact lowercase or single-word inputs', () => {
    expect(stripPii('framer arrived')).toBe('framer arrived')
  })

  it('returns the original string when nothing matches', () => {
    expect(stripPii('No PII here.')).toBe('No PII here.')
  })

  it('redacts multiple PII types in one pass', () => {
    const out = stripPii('Jane Smith - jane@example.com - 415-555-1234')
    expect(out).toMatch(/\[name redacted\]/)
    expect(out).toMatch(/\[email redacted\]/)
    expect(out).toMatch(/\[phone redacted\]/)
  })
})

const baseCtx = (over: Partial<DayContext> = {}): DayContext => ({
  project_id: 'p1',
  date: '2026-05-04',
  timezone: 'project_local',
  weather: null,
  crews: [],
  photos: [],
  captures: [],
  rfis_today: [],
  meeting_action_items: [],
  schedule_events: [],
  inspections: [],
  deliveries: [],
  ...over,
})

describe('assembleDailyLogDraft', () => {
  it('produces a fully partial draft on a zero-data day', () => {
    const out = assembleDailyLogDraft(baseCtx())
    expect(out.partial).toBe(true)
    expect(out.partial_reasons.weather).toMatch(/[Nn]o weather/)
    expect(out.manpower).toEqual([])
    expect(out.manpower_total).toBe(0)
    expect(out.work_performed).toEqual([])
    expect(out.weather.condition).toBe('unknown')
    expect(out.weather.weather_source).toBe('unknown')
  })

  it('renders a weather summary when weather is present', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        weather: {
          condition: 'sunny',
          high_temp_f: 78,
          low_temp_f: 55,
          precipitation_in: 0,
          wind_mph: 5,
          weather_source: 'observed',
        },
      }),
    )
    expect(out.weather_summary).toMatch(/sunny/)
    expect(out.weather_summary).toMatch(/78°F \/ 55°F/)
    expect(out.partial_reasons.weather).toBeUndefined()
  })

  it('appends precipitation when > 0', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        weather: {
          condition: 'rain',
          precipitation_in: 0.42,
          weather_source: 'observed',
        },
      }),
    )
    expect(out.weather_summary).toMatch(/0\.42″ precipitation/)
  })

  it('appends wind only at ≥15 mph', () => {
    const lo = assembleDailyLogDraft(
      baseCtx({
        weather: { condition: 'clear', wind_mph: 12, weather_source: 'observed' },
      }),
    )
    expect(lo.weather_summary).not.toMatch(/wind/)
    const hi = assembleDailyLogDraft(
      baseCtx({
        weather: { condition: 'gusty', wind_mph: 22, weather_source: 'observed' },
      }),
    )
    expect(hi.weather_summary).toMatch(/wind 22 mph/)
  })

  it('flags forecast weather in summary', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        weather: { condition: 'cloudy', weather_source: 'forecast' },
      }),
    )
    expect(out.weather_summary).toMatch(/forecast/)
  })

  it('rolls up duplicate (trade, sub_company) crew rows', () => {
    const c1: DraftedDailyLogCrewRow = {
      trade: 'electrician',
      sub_company: 'Acme',
      count: 2,
      hours: 16,
      source: 'crew_check_in',
    }
    const c2: DraftedDailyLogCrewRow = { ...c1, count: 1, hours: 8 }
    const c3: DraftedDailyLogCrewRow = {
      trade: 'plumber',
      sub_company: 'Bravo',
      count: 4,
      hours: 32,
      source: 'roster_scheduled',
    }
    const out = assembleDailyLogDraft(baseCtx({ crews: [c1, c2, c3] }))
    // 2 buckets after rollup
    expect(out.manpower.length).toBe(2)
    const elec = out.manpower.find((r) => r.trade === 'electrician')!
    expect(elec.count).toBe(3)
    expect(elec.hours).toBe(24)
    // Sorted by count descending
    expect(out.manpower[0].count).toBeGreaterThanOrEqual(out.manpower[1].count)
    expect(out.manpower_total).toBe(7)
  })

  it('prefers crew_check_in over roster_scheduled when rolling up', () => {
    const observed: DraftedDailyLogCrewRow = {
      trade: 'framer',
      sub_company: 'X',
      count: 2,
      source: 'crew_check_in',
    }
    const scheduled: DraftedDailyLogCrewRow = {
      trade: 'framer',
      sub_company: 'X',
      count: 1,
      source: 'roster_scheduled',
    }
    const out = assembleDailyLogDraft(baseCtx({ crews: [observed, scheduled] }))
    expect(out.manpower[0].source).toBe('crew_check_in')
  })

  it('promotes photo captions into work_performed bullets with source', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        photos: [
          { id: 'photo-1', caption: 'Pour at Grid C/4 complete' },
          { id: 'photo-2', caption: '' }, // skipped: empty caption
        ],
      }),
    )
    expect(out.work_performed).toHaveLength(1)
    expect(out.work_performed[0].text).toMatch(/Pour at Grid C\/4/)
    expect(out.work_performed[0].sources[0]).toMatchObject({
      kind: 'photo_caption',
      ref: 'photo-1',
    })
  })

  it('promotes voice captures with kind=voice_capture', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        captures: [
          { id: 'cap-1', text: 'Concrete delivered at 9am', kind: 'voice' },
        ],
      }),
    )
    expect(out.work_performed[0].sources[0].kind).toBe('voice_capture')
  })

  it('schedule progress emits a "+%" bullet when delta_percent is present', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        schedule_events: [
          { id: 's1', title: 'Slab on grade', delta_percent: 25 },
        ],
      }),
    )
    expect(out.work_performed[0].text).toMatch(/Slab on grade.*\+25%/)
  })

  it('schedule progress falls back to status when no delta_percent', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        schedule_events: [{ id: 's1', title: 'Inspection', new_status: 'passed' }],
      }),
    )
    expect(out.work_performed[0].text).toMatch(/Inspection: passed/)
  })

  it('preserves the supplied generated_by string', () => {
    const out = assembleDailyLogDraft(baseCtx(), { generated_by: 'claude-opus-4-7' })
    expect(out.generated_by).toBe('claude-opus-4-7')
  })

  it('defaults generated_by to claude-sonnet-4-6', () => {
    const out = assembleDailyLogDraft(baseCtx())
    expect(out.generated_by).toBe('claude-sonnet-4-6')
  })

  it('aggregates provenance counts per source kind', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        photos: [
          { id: 'p1', caption: 'caption one' },
          { id: 'p2', caption: 'caption two' },
        ],
        captures: [{ id: 'c1', text: 'observed', kind: 'voice' }],
      }),
    )
    const photoEntry = out.provenance.find((p) => p.kind === 'photo_caption')
    expect(photoEntry?.count).toBe(2)
    const voiceEntry = out.provenance.find((p) => p.kind === 'voice_capture')
    expect(voiceEntry?.count).toBe(1)
  })

  it('strips PII from any user-generated bullet text', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        captures: [{ id: 'c1', text: 'Email Jane at jane@x.com', kind: 'text' }],
      }),
    )
    expect(out.work_performed[0].text).toMatch(/\[email redacted\]/)
  })

  it('marks partial when any section was missing inputs', () => {
    const out = assembleDailyLogDraft(
      baseCtx({
        weather: { condition: 'clear', weather_source: 'observed' },
        crews: [
          { trade: 'electrician', count: 1, source: 'crew_check_in' },
        ],
        photos: [{ id: 'p1', caption: 'Wall framed' }],
      }),
    )
    // Issues + visitors empty → still partial
    expect(out.partial).toBe(true)
    expect(out.partial_reasons.issues).toBeDefined()
    expect(out.partial_reasons.visitors).toBeDefined()
  })
})
