/**
 * citationRouting — exhaustive routing-table coverage.
 * The compile-time check (CITATION_ROUTES record over CitationKind)
 * catches missing kinds at build time; this asserts the runtime
 * behavior + deep-link shapes.
 */
import { describe, it, expect } from 'vitest'
import {
  CITATION_ROUTES,
  citationDeepLink,
  citationLabel,
  isCitationKind,
} from '../citationRouting'

describe('CITATION_ROUTES', () => {
  it('covers all 8 spec kinds exactly', () => {
    const keys = Object.keys(CITATION_ROUTES).sort()
    expect(keys).toEqual([
      'budget_line',
      'change_order',
      'daily_log_excerpt',
      'drawing_coordinate',
      'photo_observation',
      'rfi_reference',
      'schedule_phase',
      'spec_reference',
    ])
  })

  it('every entry has a non-empty label', () => {
    for (const [kind, route] of Object.entries(CITATION_ROUTES)) {
      expect(route.label.length, `kind=${kind}`).toBeGreaterThan(0)
    }
  })
})

describe('citationDeepLink', () => {
  it('builds the simple-ref deep links for the 6 single-id kinds', () => {
    expect(
      citationDeepLink({ kind: 'rfi_reference', label: 'x', ref: 'rfi-1' }),
    ).toBe('/rfis/rfi-1')
    expect(
      citationDeepLink({ kind: 'daily_log_excerpt', label: 'x', ref: 'log-1' }),
    ).toBe('/daily-logs/log-1')
    expect(
      citationDeepLink({ kind: 'photo_observation', label: 'x', ref: 'photo-1' }),
    ).toBe('/photos/photo-1')
    expect(
      citationDeepLink({ kind: 'spec_reference', label: 'x', ref: 'spec-1' }),
    ).toBe('/specs/spec-1')
    expect(
      citationDeepLink({ kind: 'budget_line', label: 'x', ref: 'cc-1' }),
    ).toBe('/budget?line=cc-1')
    expect(
      citationDeepLink({ kind: 'change_order', label: 'x', ref: 'co-1' }),
    ).toBe('/change-orders/co-1')
    expect(
      citationDeepLink({ kind: 'schedule_phase', label: 'x', ref: 'phase-1' }),
    ).toBe('/schedule?phase=phase-1')
  })

  it('appends pin coordinates for drawing citations when present', () => {
    expect(
      citationDeepLink({
        kind: 'drawing_coordinate',
        label: 'x',
        ref: 'd1',
        x: 0.42,
        y: 0.66,
      }),
    ).toBe('/drawings/d1?pin=0.42,0.66')
  })

  it('omits pin when coords missing', () => {
    expect(
      citationDeepLink({ kind: 'drawing_coordinate', label: 'x', ref: 'd1' }),
    ).toBe('/drawings/d1')
  })

  it('returns null when ref is missing', () => {
    expect(
      citationDeepLink({ kind: 'rfi_reference', label: 'x' }),
    ).toBeNull()
  })
})

describe('isCitationKind / citationLabel', () => {
  it('isCitationKind narrows correctly', () => {
    expect(isCitationKind('rfi_reference')).toBe(true)
    expect(isCitationKind('photo_observation')).toBe(true)
    expect(isCitationKind('not_a_kind')).toBe(false)
  })

  it('citationLabel returns the route label', () => {
    expect(citationLabel('rfi_reference')).toBe('RFI')
    expect(citationLabel('budget_line')).toBe('Budget line')
  })
})
