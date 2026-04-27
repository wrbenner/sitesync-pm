import { describe, it, expect } from 'vitest'
import { createRFISchema, rfiPriorityEnum } from './rfi'

describe('rfiPriorityEnum', () => {
  it.each(['critical', 'high', 'medium', 'low'])('"%s" is valid', (p) => {
    expect(() => rfiPriorityEnum.parse(p)).not.toThrow()
  })

  it('rejects unknown priorities', () => {
    expect(() => rfiPriorityEnum.parse('urgent')).toThrow()
    expect(() => rfiPriorityEnum.parse('')).toThrow()
  })
})

describe('createRFISchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return { title: 'Slab pour clearance', description: 'Need spec', ...o }
  }

  it('accepts a valid create payload', () => {
    expect(() => createRFISchema.parse(valid())).not.toThrow()
  })

  it('priority defaults to "medium"', () => {
    expect(createRFISchema.parse(valid()).priority).toBe('medium')
  })

  it('rejects empty title', () => {
    expect(() => createRFISchema.parse(valid({ title: '' })))
      .toThrow(/Title is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createRFISchema.parse(valid({ title: 'x'.repeat(201) })))
      .toThrow()
  })

  it('rejects empty description (API requires it; form-level is more lenient)', () => {
    expect(() => createRFISchema.parse(valid({ description: '' })))
      .toThrow(/Description is required/)
  })

  it('optional fields accept empty string OR populated value', () => {
    for (const field of ['due_date', 'assigned_to', 'spec_section', 'drawing_reference']) {
      expect(() => createRFISchema.parse(valid({ [field]: '' }))).not.toThrow()
      expect(() => createRFISchema.parse(valid({ [field]: 'value' }))).not.toThrow()
    }
  })
})
