import { describe, it, expect } from 'vitest'
import { scoped, scopedBy } from './orgScope'

// Minimal fake builder that mimics PostgrestFilterBuilder's chaining: every
// builder method returns `this` so the test can assert call shape without
// depending on supabase-js.
function fakeBuilder() {
  const calls: Array<[string, string, unknown]> = []
  const builder = {
    eq(column: unknown, value: unknown) {
      calls.push(['eq', column as string, value])
      return builder
    },
    order(column: string) {
      calls.push(['order', column, undefined])
      return builder
    },
    select() {
      calls.push(['select', '*', undefined])
      return builder
    },
  }
  return { builder, calls }
}

describe('scoped', () => {
  it('appends .eq("organization_id", orgId) to the builder', () => {
    const { builder, calls } = fakeBuilder()
    const out = scoped(builder, 'org-123')
    expect(out).toBe(builder)
    expect(calls).toEqual([['eq', 'organization_id', 'org-123']])
  })

  it('throws on null orgId', () => {
    const { builder } = fakeBuilder()
    expect(() => scoped(builder, null)).toThrow(/orgId is required/)
  })

  it('throws on undefined orgId', () => {
    const { builder } = fakeBuilder()
    expect(() => scoped(builder, undefined)).toThrow(/orgId is required/)
  })

  it('throws on empty-string orgId (silent-empty-result bug class)', () => {
    const { builder } = fakeBuilder()
    expect(() => scoped(builder, '')).toThrow(/orgId is required/)
  })

  it('preserves builder methods so .order() can be chained after', () => {
    const { builder, calls } = fakeBuilder()
    scoped(builder, 'org-123').order('created_at')
    expect(calls).toEqual([
      ['eq', 'organization_id', 'org-123'],
      ['order', 'created_at', undefined],
    ])
  })
})

describe('scopedBy', () => {
  it('appends .eq with a custom column name', () => {
    const { builder, calls } = fakeBuilder()
    scopedBy(builder, 'org_id', 'org-123')
    expect(calls).toEqual([['eq', 'org_id', 'org-123']])
  })

  it('error message names the offending column', () => {
    const { builder } = fakeBuilder()
    expect(() => scopedBy(builder, 'org_id', null)).toThrow(/org_id/)
  })
})
