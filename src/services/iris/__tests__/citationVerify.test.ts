/**
 * citationVerify — substring + bookend match for fake-snippet detection.
 * The Day 41 auto-reject leans on this; precision matters.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  normalizeForVerify,
  sourceFetchKindFor,
  verifyAllCitationSnippets,
  verifySnippetAgainstSource,
} from '../citationVerify'

describe('normalizeForVerify', () => {
  it('lowercases', () => {
    expect(normalizeForVerify('HELLO World')).toBe('hello world')
  })
  it('collapses whitespace runs', () => {
    expect(normalizeForVerify('a    b\t\nc')).toBe('a b c')
  })
  it('strips edge punctuation', () => {
    expect(normalizeForVerify('"hello, world."')).toBe('hello, world')
  })
  it('strips trailing newlines and tabs', () => {
    expect(normalizeForVerify('  test \n\n')).toBe('test')
  })
})

describe('verifySnippetAgainstSource', () => {
  const source =
    'The footing detail at column line 7 was rejected on 2026-04-12. Architect requested re-submission with revised rebar count.'

  it('passes for empty snippet (label-only citation)', () => {
    expect(verifySnippetAgainstSource(undefined, source)).toBe(true)
    expect(verifySnippetAgainstSource(null, source)).toBe(true)
    expect(verifySnippetAgainstSource('', source)).toBe(true)
  })

  it('fails when source text is null (entity not found)', () => {
    expect(verifySnippetAgainstSource('something', null)).toBe(false)
  })

  it('passes for too-short snippets (< 8 chars)', () => {
    expect(verifySnippetAgainstSource('foo', source)).toBe(true)
    expect(verifySnippetAgainstSource('rebar', source)).toBe(true)
  })

  it('passes on exact substring match (case-insensitive)', () => {
    expect(verifySnippetAgainstSource('was rejected on 2026-04-12', source)).toBe(true)
  })

  it('passes when whitespace differs', () => {
    expect(
      verifySnippetAgainstSource('was   rejected\non\t2026-04-12', source),
    ).toBe(true)
  })

  it('fails when the snippet is invented (not in source)', () => {
    expect(
      verifySnippetAgainstSource(
        'foundation was approved by the SE on 2026-04-15',
        source,
      ),
    ).toBe(false)
  })

  it('passes on bookend match for long quotes (> 80 chars)', () => {
    const longSource =
      'The architect responded on 2026-04-12: the proposed footing detail at column line 7 has been rejected per spec section 03 30 00, and the contractor must re-submit with revised rebar counts that meet ACI 318 minimums by Friday.'
    // The middle differs (paraphrase), but head 60 + tail 20 still match.
    const drift =
      'the architect responded on 2026-04-12: the proposed footing detail at column line 7 has been rejected per spec... revised rebar counts that meet ACI 318 minimums by Friday'
    expect(verifySnippetAgainstSource(drift, longSource)).toBe(true)
  })

  it('fails when bookends drift past tolerance', () => {
    const longSource =
      'The architect responded on 2026-04-12: the proposed footing detail at column line 7 has been rejected per spec section 03 30 00, and the contractor must re-submit with revised rebar counts that meet ACI 318 minimums by Friday.'
    const fake =
      'the engineer wrote a really long thing about the foundation and the rebar and it does not actually appear in the document at all here'
    expect(verifySnippetAgainstSource(fake, longSource)).toBe(false)
  })
})

describe('sourceFetchKindFor', () => {
  it('returns the right fetch kind for verifiable citations', () => {
    expect(sourceFetchKindFor({ kind: 'rfi_reference', label: 'x' })).toBe('rfi_text')
    expect(sourceFetchKindFor({ kind: 'daily_log_excerpt', label: 'x' })).toBe('daily_log_notes')
    expect(sourceFetchKindFor({ kind: 'change_order', label: 'x' })).toBe('change_order_text')
    expect(sourceFetchKindFor({ kind: 'spec_reference', label: 'x' })).toBe('spec_section_text')
  })

  it('returns null for citations without verifiable snippet text', () => {
    expect(sourceFetchKindFor({ kind: 'budget_line', label: 'x' })).toBeNull()
    expect(sourceFetchKindFor({ kind: 'schedule_phase', label: 'x' })).toBeNull()
    expect(sourceFetchKindFor({ kind: 'drawing_coordinate', label: 'x' })).toBeNull()
    expect(sourceFetchKindFor({ kind: 'photo_observation', label: 'x' })).toBeNull()
  })
})

describe('verifyAllCitationSnippets', () => {
  it('returns ok when all citations verify', async () => {
    const fetcher = vi.fn().mockResolvedValue('the rfi response says approve as drawn')
    const result = await verifyAllCitationSnippets(
      [
        {
          kind: 'rfi_reference',
          label: 'RFI 1',
          ref: '00000000-0000-0000-0000-000000000001',
          snippet: 'approve as drawn',
        },
      ],
      fetcher,
    )
    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('reports source_not_found when fetcher returns null', async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const result = await verifyAllCitationSnippets(
      [
        {
          kind: 'rfi_reference',
          label: 'RFI 1',
          ref: '00000000-0000-0000-0000-000000000001',
          snippet: 'something specific',
        },
      ],
      fetcher,
    )
    expect(result.ok).toBe(false)
    expect(result.failures[0]).toEqual({
      index: 0,
      kind: 'rfi_reference',
      ref: '00000000-0000-0000-0000-000000000001',
      reason: 'source_not_found',
    })
  })

  it('reports snippet_mismatch when text invented', async () => {
    const fetcher = vi.fn().mockResolvedValue('the actual response is very different text')
    const result = await verifyAllCitationSnippets(
      [
        {
          kind: 'rfi_reference',
          label: 'RFI 1',
          ref: '00000000-0000-0000-0000-000000000001',
          snippet: 'fictional architect quote that does not exist here',
        },
      ],
      fetcher,
    )
    expect(result.ok).toBe(false)
    expect(result.failures[0].reason).toBe('snippet_mismatch')
  })

  it('skips citations without snippets (label-only)', async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const result = await verifyAllCitationSnippets(
      [
        {
          kind: 'rfi_reference',
          label: 'RFI 1',
          ref: '00000000-0000-0000-0000-000000000001',
        },
      ],
      fetcher,
    )
    expect(result.ok).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('skips citations whose kind has no verifiable source (drawing/budget/etc.)', async () => {
    const fetcher = vi.fn()
    const result = await verifyAllCitationSnippets(
      [
        {
          kind: 'budget_line',
          label: 'Line 03 30 00',
          ref: '00000000-0000-0000-0000-000000000001',
          snippet: 'whatever — not verified for this kind',
        },
      ],
      fetcher,
    )
    expect(result.ok).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('aggregates multiple failures with correct indices', async () => {
    const fetcher = vi.fn().mockResolvedValue('the actual answer was unrelated')
    const result = await verifyAllCitationSnippets(
      [
        { kind: 'rfi_reference', label: 'a', ref: '00000000-0000-0000-0000-000000000001', snippet: 'made-up snippet text one' },
        { kind: 'budget_line', label: 'b', ref: '00000000-0000-0000-0000-000000000002', snippet: 'no-verify kind' },
        { kind: 'rfi_reference', label: 'c', ref: '00000000-0000-0000-0000-000000000003', snippet: 'made-up snippet text two' },
      ],
      fetcher,
    )
    expect(result.ok).toBe(false)
    expect(result.failures.map((f) => f.index)).toEqual([0, 2])
  })
})
