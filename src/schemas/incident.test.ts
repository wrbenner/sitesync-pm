import { describe, it, expect } from 'vitest'
import { createIncidentSchema, incidentSeverityEnum } from './incident'

describe('incidentSeverityEnum', () => {
  it.each(['near_miss', 'minor', 'recordable', 'lost_time', 'critical'])(
    '"%s" is a valid severity',
    (severity) => {
      expect(() => incidentSeverityEnum.parse(severity)).not.toThrow()
    },
  )

  it('rejects unknown severity values', () => {
    expect(() => incidentSeverityEnum.parse('mystery')).toThrow()
    expect(() => incidentSeverityEnum.parse('')).toThrow()
    expect(() => incidentSeverityEnum.parse('CRITICAL')).toThrow() // case-sensitive
  })

  it('5 documented severity values exist', () => {
    expect(incidentSeverityEnum.options).toEqual([
      'near_miss', 'minor', 'recordable', 'lost_time', 'critical',
    ])
  })
})

describe('createIncidentSchema', () => {
  function valid(overrides: Record<string, unknown> = {}) {
    return {
      date: '2026-01-15',
      severity: 'minor' as const,
      description: 'Worker slipped on wet floor near loading dock.',
      location: 'Loading Dock A',
      ...overrides,
    }
  }

  it('parses a valid incident report', () => {
    expect(() => createIncidentSchema.parse(valid())).not.toThrow()
  })

  it('rejects empty date', () => {
    expect(() => createIncidentSchema.parse(valid({ date: '' })))
      .toThrow(/Date is required/)
  })

  it('rejects empty description', () => {
    expect(() => createIncidentSchema.parse(valid({ description: '' })))
      .toThrow(/Description is required/)
  })

  it('rejects description > 5000 chars', () => {
    expect(() => createIncidentSchema.parse(valid({ description: 'a'.repeat(5001) })))
      .toThrow()
  })

  it('rejects empty location', () => {
    expect(() => createIncidentSchema.parse(valid({ location: '' })))
      .toThrow(/Location is required/)
  })

  it('rejects location > 200 chars', () => {
    expect(() => createIncidentSchema.parse(valid({ location: 'a'.repeat(201) })))
      .toThrow()
  })

  it('rejects unknown severity values', () => {
    expect(() => createIncidentSchema.parse(valid({ severity: 'fatal' }))).toThrow()
  })

  it('corrective_action is optional (accepts empty string)', () => {
    expect(() => createIncidentSchema.parse(valid({ corrective_action: '' }))).not.toThrow()
    expect(() => createIncidentSchema.parse(valid({ corrective_action: 'Cleanup spill' }))).not.toThrow()
  })

  it('all 5 severity values are accepted', () => {
    for (const severity of ['near_miss', 'minor', 'recordable', 'lost_time', 'critical']) {
      expect(() => createIncidentSchema.parse(valid({ severity }))).not.toThrow()
    }
  })

  it('description at exactly 5000 chars is accepted (boundary)', () => {
    expect(() => createIncidentSchema.parse(valid({ description: 'a'.repeat(5000) })))
      .not.toThrow()
  })

  it('location at exactly 200 chars is accepted (boundary)', () => {
    expect(() => createIncidentSchema.parse(valid({ location: 'a'.repeat(200) })))
      .not.toThrow()
  })
})
