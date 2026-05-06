import { describe, it, expect } from 'vitest'
import {
  classifyCase, buildForm300, buildForm300A, buildForm301, exportItaCsv,
  type IncidentRow,
} from '../index'

const incident = (overrides: Partial<IncidentRow>): IncidentRow => ({
  id: 'i1',
  type: 'injury',
  severity: 'lost_time',
  date: '2026-04-29T10:00:00Z',
  location: 'Building A',
  description: 'Fell from scaffold',
  injured_party_name: 'Jane Doe',
  injured_party_company: 'Acme',
  injured_party_trade: 'Carpenter',
  osha_recordable: true,
  days_away: 0,
  days_restricted: 0,
  ...overrides,
})

describe('classifyCase', () => {
  it('death wins regardless of other fields', () => {
    expect(classifyCase(incident({ severity: 'fatality' }))).toBe('death')
  })
  it('lost_time + days_away > 0 → days_away', () => {
    expect(classifyCase(incident({ severity: 'lost_time', days_away: 3 }))).toBe('days_away')
  })
  it('restricted days > 0 → restricted', () => {
    expect(classifyCase(incident({ severity: 'medical_treatment', days_restricted: 5 }))).toBe('restricted')
  })
  it('falls through to other_recordable', () => {
    expect(classifyCase(incident({ severity: 'medical_treatment' }))).toBe('other_recordable')
  })
  it('explicit case_classification overrides inference', () => {
    expect(classifyCase(incident({ severity: 'first_aid', case_classification: 'death' }))).toBe('death')
  })
})

describe('buildForm300', () => {
  it('filters out non-recordable cases', () => {
    const rows = buildForm300([
      incident({ id: 'a', osha_recordable: true }),
      incident({ id: 'b', osha_recordable: false }),
    ])
    expect(rows).toHaveLength(1)
  })
  it('numbers cases starting at 1, in chronological order', () => {
    const rows = buildForm300([
      incident({ id: 'b', date: '2026-04-30T10:00:00Z' }),
      incident({ id: 'a', date: '2026-04-01T10:00:00Z' }),
    ])
    expect(rows[0].caseNumber).toBe(1)
    expect(rows[0].dateOfInjury).toBe('2026-04-01')
    expect(rows[1].caseNumber).toBe(2)
  })
})

describe('buildForm300A', () => {
  it('aggregates counts by classification', () => {
    const rows = buildForm300([
      incident({ id: 'a', severity: 'fatality' }),
      incident({ id: 'b', severity: 'lost_time', days_away: 3 }),
      incident({ id: 'c', severity: 'medical_treatment', days_restricted: 5 }),
      incident({ id: 'd', severity: 'medical_treatment' }),
    ])
    const summary = buildForm300A(rows, { year: 2026, establishment: 'Avery Oaks' })
    expect(summary.totalDeaths).toBe(1)
    expect(summary.totalDaysAway).toBe(1)
    expect(summary.totalRestricted).toBe(1)
    expect(summary.totalOtherRecordable).toBe(1)
    expect(summary.totalCases).toBe(4)
    expect(summary.totalDaysAwayDays).toBe(3)
    expect(summary.totalRestrictedDays).toBe(5)
  })

  it('posting period is Feb-1–Apr-30 of the following year', () => {
    const summary = buildForm300A([], { year: 2026, establishment: 'Avery Oaks' })
    expect(summary.postingPeriod.from).toBe('2027-02-01')
    expect(summary.postingPeriod.to).toBe('2027-04-30')
  })
})

describe('buildForm301', () => {
  it('captures per-incident detail', () => {
    const inc = incident({ severity: 'lost_time', days_away: 3 })
    const f301 = buildForm301(inc, 1, {
      whatHappened: 'Worker climbing scaffold lost balance and fell ~6 ft',
      injuryNature: 'Fracture',
      injuryBodyPart: 'Left wrist',
      treatment: 'Cast applied; offsite ER visit',
      source: 'Scaffold',
    })
    expect(f301.result).toBe('days_away')
    expect(f301.injuryBodyPart).toBe('Left wrist')
    expect(f301.caseNumber).toBe(1)
  })
})

describe('exportItaCsv', () => {
  it('produces a valid header + body row per case', () => {
    const rows = buildForm300([incident({})])
    const summary = buildForm300A(rows, { year: 2026, establishment: 'Avery Oaks' })
    const csv = exportItaCsv(rows, summary)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('case_number')
    expect(lines[1]).toContain('"Avery Oaks"')
    expect(lines[1]).toContain('2026')
    expect(lines).toHaveLength(2)
  })

  it('escapes quotes inside fields', () => {
    const rows = buildForm300([incident({ description: 'Worker said "I slipped"' })])
    const summary = buildForm300A(rows, { year: 2026, establishment: 'Test "Co"' })
    const csv = exportItaCsv(rows, summary)
    expect(csv).toContain('""I slipped""')
    expect(csv).toContain('"Test ""Co"""')
  })
})
