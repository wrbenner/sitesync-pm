// Phase 8 — DistributeAction email parser tests.

import { describe, it, expect } from 'vitest'
import { parseEmails } from '../../../components/submittals/detail/Distribute/DistributeAction'

describe('parseEmails', () => {
  it('returns empty for empty / whitespace', () => {
    expect(parseEmails('')).toEqual([])
    expect(parseEmails('   ')).toEqual([])
  })

  it('parses a single email', () => {
    expect(parseEmails('foreman@example.com')).toEqual(['foreman@example.com'])
  })

  it('splits on commas, semicolons, whitespace, newlines', () => {
    const r = parseEmails('a@x.com, b@x.com; c@x.com\nd@x.com   e@x.com')
    expect(r).toHaveLength(5)
  })

  it('drops invalid addresses silently', () => {
    expect(parseEmails('valid@x.com, not-an-email, also@y.com')).toEqual([
      'valid@x.com',
      'also@y.com',
    ])
  })

  it('dedupes case-insensitively, preserves first-seen casing', () => {
    expect(parseEmails('Foo@Example.com, foo@example.com, FOO@example.com')).toEqual([
      'Foo@Example.com',
    ])
  })

  it('keeps order of first occurrence', () => {
    expect(parseEmails('zoo@x.com, alpha@x.com, beta@x.com')).toEqual([
      'zoo@x.com',
      'alpha@x.com',
      'beta@x.com',
    ])
  })

  it('handles emails with plus addressing', () => {
    expect(parseEmails('walker+sub@x.com')).toEqual(['walker+sub@x.com'])
  })
})
