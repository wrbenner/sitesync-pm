import { describe, it, expect } from 'vitest'
import { createDailyLogSchema, crewHoursEntrySchema } from './dailyLog'

describe('createDailyLogSchema', () => {
  it('accepts a minimal valid log (date only)', () => {
    expect(() => createDailyLogSchema.parse({ date: '2026-01-15' })).not.toThrow()
  })

  it('rejects empty date', () => {
    expect(() => createDailyLogSchema.parse({ date: '' })).toThrow(/Date is required/)
  })

  it('weather_summary / work_summary / issues_delays optional with empty-string allowance', () => {
    for (const field of ['weather_summary', 'work_summary', 'issues_delays']) {
      expect(() => createDailyLogSchema.parse({ date: '2026-01-15', [field]: '' }))
        .not.toThrow()
      expect(() => createDailyLogSchema.parse({ date: '2026-01-15', [field]: 'content' }))
        .not.toThrow()
    }
  })
})

describe('crewHoursEntrySchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      crew_name: 'Concrete Crew A',
      workers: 8,
      hours: 8,
      ...o,
    }
  }

  it('accepts a valid crew-hours entry', () => {
    expect(() => crewHoursEntrySchema.parse(valid())).not.toThrow()
  })

  it('rejects empty crew_name', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ crew_name: '' })))
      .toThrow(/Crew name is required/)
  })

  it('rejects crew_name > 120 chars', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ crew_name: 'x'.repeat(121) }))).toThrow()
  })

  it('rejects non-integer workers', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ workers: 7.5 })))
      .toThrow(/whole number/)
  })

  it('rejects negative workers', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ workers: -1 })))
      .toThrow(/non-negative/)
  })

  it('accepts 0 workers (vacated crew slot)', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ workers: 0 }))).not.toThrow()
  })

  it('rejects negative hours', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ hours: -1 })))
      .toThrow(/non-negative/)
  })

  it('rejects hours > 24 (single-day cap)', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ hours: 25 })))
      .toThrow(/cannot exceed 24/)
  })

  it('hours of exactly 24 is accepted (boundary)', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ hours: 24 }))).not.toThrow()
  })

  it('accepts fractional hours (e.g. 7.5)', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ hours: 7.5 }))).not.toThrow()
  })

  it('trade is optional with empty-string allowance', () => {
    expect(() => crewHoursEntrySchema.parse(valid({ trade: '' }))).not.toThrow()
    expect(() => crewHoursEntrySchema.parse(valid({ trade: 'Concrete' }))).not.toThrow()
  })
})
