import { describe, it, expect } from 'vitest'
import { budgetCSVRowSchema, budgetCSVSchema } from './budget'

describe('budgetCSVRowSchema', () => {
  function valid(o: Record<string, unknown> = {}) {
    return {
      description: 'Concrete pour',
      amount: 50_000,
      division: '03 - Concrete',
      ...o,
    }
  }

  it('parses a valid row with required fields only', () => {
    expect(() => budgetCSVRowSchema.parse(valid())).not.toThrow()
  })

  it('rejects empty description', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ description: '' })))
      .toThrow(/Description is required/)
  })

  it('rejects description > 500 chars', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ description: 'x'.repeat(501) })))
      .toThrow()
  })

  it('rejects empty division', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ division: '' })))
      .toThrow(/Division is required/)
  })

  it('rejects division > 50 chars', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ division: 'x'.repeat(51) })))
      .toThrow()
  })

  it('rejects non-integer amount (must be cents)', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ amount: 99.99 })))
      .toThrow(/integer.*cents/i)
  })

  it('accepts negative amounts (e.g. credits)', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ amount: -1000 }))).not.toThrow()
  })

  it('cost_code is optional + accepts empty string', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ cost_code: '' }))).not.toThrow()
    expect(() => budgetCSVRowSchema.parse(valid({ cost_code: '03-30-00' }))).not.toThrow()
  })

  it('category is optional + accepts empty string', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ category: '' }))).not.toThrow()
    expect(() => budgetCSVRowSchema.parse(valid({ category: 'Labor' }))).not.toThrow()
  })

  it('description at exactly 500 chars is accepted (boundary)', () => {
    expect(() => budgetCSVRowSchema.parse(valid({ description: 'x'.repeat(500) })))
      .not.toThrow()
  })
})

describe('budgetCSVSchema (array)', () => {
  it('accepts an empty array', () => {
    expect(() => budgetCSVSchema.parse([])).not.toThrow()
  })

  it('accepts an array of valid rows', () => {
    const r = budgetCSVSchema.parse([
      { description: 'A', amount: 1000, division: '01' },
      { description: 'B', amount: 2000, division: '02' },
    ])
    expect(r).toHaveLength(2)
  })

  it('rejects when ANY row is invalid', () => {
    expect(() =>
      budgetCSVSchema.parse([
        { description: 'A', amount: 1000, division: '01' },
        { description: 'B', amount: 99.5, division: '02' }, // non-integer
      ]),
    ).toThrow()
  })
})
