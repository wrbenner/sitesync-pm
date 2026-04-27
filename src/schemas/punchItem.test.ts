import { describe, it, expect } from 'vitest'
import { createPunchItemSchema, punchPriorityEnum } from './punchItem'

describe('punchPriorityEnum', () => {
  it.each(['critical', 'high', 'medium', 'low'])('"%s" is valid', (p) => {
    expect(() => punchPriorityEnum.parse(p)).not.toThrow()
  })

  it('rejects unknown priorities', () => {
    expect(() => punchPriorityEnum.parse('urgent')).toThrow()
  })
})

describe('createPunchItemSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      title: 'Touch up paint near elevator',
      location: 'Lobby - Floor 1',
      assignee: 'Painters R Us',
      ...o,
    }
  }

  it('accepts a valid create payload', () => {
    expect(() => createPunchItemSchema.parse(valid())).not.toThrow()
  })

  it('priority defaults to "medium"', () => {
    expect(createPunchItemSchema.parse(valid()).priority).toBe('medium')
  })

  it('rejects empty title', () => {
    expect(() => createPunchItemSchema.parse(valid({ title: '' })))
      .toThrow(/Title is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createPunchItemSchema.parse(valid({ title: 'x'.repeat(201) }))).toThrow()
  })

  it('rejects empty location (required for tradesperson dispatch)', () => {
    expect(() => createPunchItemSchema.parse(valid({ location: '' })))
      .toThrow(/Location is required/)
  })

  it('rejects location > 200 chars', () => {
    expect(() => createPunchItemSchema.parse(valid({ location: 'x'.repeat(201) }))).toThrow()
  })

  it('rejects empty assignee (required for accountability)', () => {
    expect(() => createPunchItemSchema.parse(valid({ assignee: '' })))
      .toThrow(/Assignee is required/)
  })

  it('rejects assignee > 200 chars', () => {
    expect(() => createPunchItemSchema.parse(valid({ assignee: 'x'.repeat(201) }))).toThrow()
  })

  it('floor, trade, due_date, description optional with empty-string allowance', () => {
    for (const field of ['floor', 'trade', 'due_date', 'description']) {
      expect(() => createPunchItemSchema.parse(valid({ [field]: '' }))).not.toThrow()
      expect(() => createPunchItemSchema.parse(valid({ [field]: 'value' }))).not.toThrow()
    }
  })
})
