import { describe, it, expect } from 'vitest'
import { createMeetingSchema, meetingTypeEnum } from './meeting'

describe('meetingTypeEnum', () => {
  it.each(['oac', 'safety', 'coordination', 'progress', 'subcontractor'])(
    '"%s" is valid',
    (t) => {
      expect(() => meetingTypeEnum.parse(t)).not.toThrow()
    },
  )

  it('rejects unknown meeting types', () => {
    expect(() => meetingTypeEnum.parse('all-hands')).toThrow()
    expect(() => meetingTypeEnum.parse('')).toThrow()
  })

  it('exposes 5 documented types', () => {
    expect(meetingTypeEnum.options).toEqual([
      'oac', 'safety', 'coordination', 'progress', 'subcontractor',
    ])
  })
})

describe('createMeetingSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      title: 'Weekly OAC',
      date: '2026-01-15',
      type: 'oac' as const,
      ...o,
    }
  }

  it('accepts a minimal valid meeting', () => {
    expect(() => createMeetingSchema.parse(valid())).not.toThrow()
  })

  it('attendees defaults to empty array', () => {
    expect(createMeetingSchema.parse(valid()).attendees).toEqual([])
  })

  it('rejects empty title / empty date', () => {
    expect(() => createMeetingSchema.parse(valid({ title: '' }))).toThrow(/Title is required/)
    expect(() => createMeetingSchema.parse(valid({ date: '' }))).toThrow(/Date is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createMeetingSchema.parse(valid({ title: 'x'.repeat(201) }))).toThrow()
  })

  it('attendees must be non-empty strings under 200 chars', () => {
    expect(() => createMeetingSchema.parse(valid({ attendees: [''] })))
      .toThrow(/Attendee name required/)
    expect(() => createMeetingSchema.parse(valid({ attendees: ['x'.repeat(201)] })))
      .toThrow()
  })

  it('attendees array allows multiple valid names', () => {
    expect(() =>
      createMeetingSchema.parse(valid({ attendees: ['Alice', 'Bob', 'Charlie'] })),
    ).not.toThrow()
  })

  it('duration_minutes must be a positive integer when supplied', () => {
    expect(() => createMeetingSchema.parse(valid({ duration_minutes: 60 }))).not.toThrow()
    expect(() => createMeetingSchema.parse(valid({ duration_minutes: 0 }))).toThrow(/positive/)
    expect(() => createMeetingSchema.parse(valid({ duration_minutes: -10 }))).toThrow(/positive/)
    expect(() => createMeetingSchema.parse(valid({ duration_minutes: 30.5 }))).toThrow()
  })

  it('time, location, agenda are optional with empty-string allowance', () => {
    for (const field of ['time', 'location', 'agenda']) {
      expect(() => createMeetingSchema.parse(valid({ [field]: '' }))).not.toThrow()
      expect(() => createMeetingSchema.parse(valid({ [field]: 'value' }))).not.toThrow()
    }
  })
})
