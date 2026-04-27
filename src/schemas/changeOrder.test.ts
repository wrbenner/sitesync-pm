import { describe, it, expect } from 'vitest'
import { createChangeOrderSchema, changeOrderTypeEnum } from './changeOrder'

describe('changeOrderTypeEnum', () => {
  it.each(['pco', 'cor', 'co'])('"%s" valid', (t) => {
    expect(() => changeOrderTypeEnum.parse(t)).not.toThrow()
  })

  it('rejects unknown type values', () => {
    expect(() => changeOrderTypeEnum.parse('co_request')).toThrow()
    expect(() => changeOrderTypeEnum.parse('')).toThrow()
  })

  it('exposes 3 documented types (PCO → COR → CO promotion chain)', () => {
    expect(changeOrderTypeEnum.options).toEqual(['pco', 'cor', 'co'])
  })
})

describe('createChangeOrderSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      title: 'Add reinforcement at level 3',
      amount: 25_000,
      reason: 'Engineer detected design inadequacy in rebar spacing',
      ...o,
    }
  }

  it('accepts a valid create payload', () => {
    expect(() => createChangeOrderSchema.parse(valid())).not.toThrow()
  })

  it('type defaults to "pco" (lowest stage of the lifecycle)', () => {
    expect(createChangeOrderSchema.parse(valid()).type).toBe('pco')
  })

  it('rejects empty title', () => {
    expect(() => createChangeOrderSchema.parse(valid({ title: '' })))
      .toThrow(/Title is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createChangeOrderSchema.parse(valid({ title: 'x'.repeat(201) }))).toThrow()
  })

  it('rejects non-integer amount (must be cents)', () => {
    expect(() => createChangeOrderSchema.parse(valid({ amount: 99.99 })))
      .toThrow(/integer.*cents/i)
  })

  it('accepts negative amount (deductive change orders / credits)', () => {
    expect(() => createChangeOrderSchema.parse(valid({ amount: -10_000 }))).not.toThrow()
  })

  it('rejects empty reason (every CO needs a justification)', () => {
    expect(() => createChangeOrderSchema.parse(valid({ reason: '' })))
      .toThrow(/Reason is required/)
  })

  it('rejects reason > 5000 chars', () => {
    expect(() => createChangeOrderSchema.parse(valid({ reason: 'x'.repeat(5001) }))).toThrow()
  })

  it('cost_codes / requested_by / requested_date optional with empty-string allowance', () => {
    for (const field of ['cost_codes', 'requested_by', 'requested_date']) {
      expect(() => createChangeOrderSchema.parse(valid({ [field]: '' }))).not.toThrow()
      expect(() => createChangeOrderSchema.parse(valid({ [field]: 'value' }))).not.toThrow()
    }
  })
})
