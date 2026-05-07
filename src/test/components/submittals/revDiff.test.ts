// Phase 8 — RevDiffView pure-function tests.
//
// The signature-based diff is what powers the Iris one-line summary +
// "Added / Removed / Carried over" stat strip. Phase 8b replaces it with
// stable-id-based matching once `parent_markup_id` lands.

import { describe, it, expect } from 'vitest'
import {
  computeDiffCounts,
  buildDeterministicSummary,
} from '../../../components/submittals/detail/Revisions/RevDiffView'
import type { SubmittalMarkup } from '../../../services/submittalMarkup'

const mk = (over: Partial<SubmittalMarkup> = {}): SubmittalMarkup => ({
  id: String(over.id ?? Math.random()),
  submittal_item_id: 'i-1',
  rev_number: 0,
  pdf_page: 1,
  geometry: {},
  kind: 'highlight',
  comment_md: null,
  created_by: null,
  created_at: '2026-05-01T00:00:00Z',
  ...over,
})

describe('computeDiffCounts', () => {
  it('returns zeros when both empty', () => {
    expect(computeDiffCounts([], [])).toEqual({ added: 0, removed: 0, kept: 0 })
  })

  it('counts added when markup new in target only', () => {
    const r = computeDiffCounts([], [mk({ kind: 'pen' })])
    expect(r).toEqual({ added: 1, removed: 0, kept: 0 })
  })

  it('counts removed when markup gone from target', () => {
    const r = computeDiffCounts([mk({ kind: 'redline' })], [])
    expect(r).toEqual({ added: 0, removed: 1, kept: 0 })
  })

  it('counts kept when (kind, page, comment) match', () => {
    const a = mk({ id: 'a', kind: 'pen', pdf_page: 3, comment_md: 'note' })
    const b = mk({ id: 'b', kind: 'pen', pdf_page: 3, comment_md: 'note' })
    const r = computeDiffCounts([a], [b])
    expect(r).toEqual({ added: 0, removed: 0, kept: 1 })
  })

  it('mixes added/removed/kept correctly', () => {
    const r = computeDiffCounts(
      [
        mk({ id: 'k1', kind: 'highlight', pdf_page: 1, comment_md: 'a' }),
        mk({ id: 'r1', kind: 'redline',   pdf_page: 2, comment_md: 'b' }),
      ],
      [
        mk({ id: 'k1', kind: 'highlight', pdf_page: 1, comment_md: 'a' }),
        mk({ id: 'a1', kind: 'pen',       pdf_page: 4, comment_md: 'new' }),
      ],
    )
    expect(r).toEqual({ added: 1, removed: 1, kept: 1 })
  })
})

describe('buildDeterministicSummary', () => {
  it('handles both-empty case', () => {
    expect(buildDeterministicSummary([], [])).toMatch(/no markups/i)
  })

  it('reports unchanged when 1 carried over and 0 added/removed', () => {
    const a = mk({ kind: 'pen', pdf_page: 1, comment_md: 'a' })
    const b = mk({ kind: 'pen', pdf_page: 1, comment_md: 'a' })
    const summary = buildDeterministicSummary([a], [b])
    expect(summary).toMatch(/carried over unchanged/i)
  })

  it('joins added/removed/kept with bullets', () => {
    const summary = buildDeterministicSummary(
      [mk({ kind: 'redline', pdf_page: 1 })],
      [mk({ kind: 'pen', pdf_page: 2 }), mk({ kind: 'highlight', pdf_page: 3 })],
    )
    expect(summary).toMatch(/2 new/i)
    expect(summary).toMatch(/1 previous/i)
  })
})
