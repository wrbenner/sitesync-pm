// Phase 5b — submittalReviewerChain validation + renumber tests.

import { describe, it, expect } from 'vitest'
import {
  validateReviewerChain,
  renumberChain,
} from '../../services/submittalReviewerChain'
import type { ReviewerChainStep } from '../../services/iris/submittalDraft'

const mk = (over: Partial<ReviewerChainStep> = {}): ReviewerChainStep => ({
  uid: 'u',
  sequence: 1,
  reviewer_role: 'Architect',
  reviewer_name: 'Melissa Ellis',
  due_date_offset_days: 7,
  parallel_group: 0,
  ...over,
})

describe('validateReviewerChain', () => {
  it('accepts an empty chain (legacy single-reviewer pattern)', () => {
    expect(validateReviewerChain([])).toEqual({ valid: true, errors: [] })
  })

  it('accepts a well-formed chain', () => {
    const r = validateReviewerChain([mk(), mk({ uid: 'u2', sequence: 2, reviewer_role: 'Owner' })])
    expect(r.valid).toBe(true)
  })

  it('flags steps with no role + no name', () => {
    const r = validateReviewerChain([mk({ reviewer_role: '', reviewer_name: '' })])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/needs a reviewer role or name/)
  })

  it('flags a parallel group with only 1 step', () => {
    const r = validateReviewerChain([
      mk({ uid: 'u1', sequence: 1, parallel_group: 0 }),
      mk({ uid: 'u2', sequence: 2, parallel_group: 1 }),
      mk({ uid: 'u3', sequence: 3, parallel_group: 0 }),
    ])
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toMatch(/Parallel group 1 only has 1 step/)
  })

  it('accepts a parallel pair', () => {
    const r = validateReviewerChain([
      mk({ uid: 'u1', sequence: 1 }),
      mk({ uid: 'u2', sequence: 2, parallel_group: 1 }),
      mk({ uid: 'u3', sequence: 3, parallel_group: 1 }),
      mk({ uid: 'u4', sequence: 4 }),
    ])
    expect(r.valid).toBe(true)
  })
})

describe('renumberChain', () => {
  it('renumbers sequence to 1..N preserving order', () => {
    const r = renumberChain([
      mk({ uid: 'a', sequence: 5 }),
      mk({ uid: 'b', sequence: 9 }),
      mk({ uid: 'c', sequence: 1 }),
    ])
    expect(r.map((s) => s.sequence)).toEqual([1, 2, 3])
    expect(r.map((s) => s.uid)).toEqual(['a', 'b', 'c'])
  })

  it('preserves parallel_group + role + name + due offset', () => {
    const r = renumberChain([mk({ parallel_group: 2, due_date_offset_days: 14 })])
    expect(r[0].parallel_group).toBe(2)
    expect(r[0].due_date_offset_days).toBe(14)
    expect(r[0].reviewer_role).toBe('Architect')
  })
})
