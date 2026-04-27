import { describe, it, expect } from 'vitest'
import { createSubmittalSchema, submittalTypeEnum } from './submittal'

describe('submittalTypeEnum', () => {
  it.each([
    'shop_drawing', 'product_data', 'sample',
    'design_data', 'test_report', 'certificate', 'closeout',
  ])('"%s" is valid', (t) => {
    expect(() => submittalTypeEnum.parse(t)).not.toThrow()
  })

  it('rejects unknown types', () => {
    expect(() => submittalTypeEnum.parse('drawing')).toThrow()
    expect(() => submittalTypeEnum.parse('')).toThrow()
  })

  it('exposes 7 documented types', () => {
    expect(submittalTypeEnum.options).toEqual([
      'shop_drawing', 'product_data', 'sample',
      'design_data', 'test_report', 'certificate', 'closeout',
    ])
  })
})

describe('createSubmittalSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      title: 'Anchor bolt shop drawings',
      spec_section: '03 30 00',
      due_date: '2026-02-01',
      ...o,
    }
  }

  it('accepts a valid create payload', () => {
    expect(() => createSubmittalSchema.parse(valid())).not.toThrow()
  })

  it('type defaults to "shop_drawing"', () => {
    expect(createSubmittalSchema.parse(valid()).type).toBe('shop_drawing')
  })

  it('rejects empty title', () => {
    expect(() => createSubmittalSchema.parse(valid({ title: '' })))
      .toThrow(/Title is required/)
  })

  it('rejects title > 200 chars', () => {
    expect(() => createSubmittalSchema.parse(valid({ title: 'x'.repeat(201) }))).toThrow()
  })

  it('rejects empty spec_section (CSI section is required for routing)', () => {
    expect(() => createSubmittalSchema.parse(valid({ spec_section: '' })))
      .toThrow(/Spec section is required/)
  })

  it('rejects spec_section > 50 chars', () => {
    expect(() => createSubmittalSchema.parse(valid({ spec_section: 'x'.repeat(51) }))).toThrow()
  })

  it('rejects empty due_date (lead-time tracking depends on it)', () => {
    expect(() => createSubmittalSchema.parse(valid({ due_date: '' })))
      .toThrow(/Due date is required/)
  })

  it('subcontractor and description are optional with empty-string allowance', () => {
    for (const field of ['subcontractor', 'description']) {
      expect(() => createSubmittalSchema.parse(valid({ [field]: '' }))).not.toThrow()
      expect(() => createSubmittalSchema.parse(valid({ [field]: 'value' }))).not.toThrow()
    }
  })
})
