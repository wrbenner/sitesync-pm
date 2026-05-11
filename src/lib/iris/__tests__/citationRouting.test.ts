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
  it('covers all 11 spec kinds exactly (8 base + 3 Phase 3d)', () => {
    const keys = Object.keys(CITATION_ROUTES).sort()
    expect(keys).toEqual([
      'budget_line',
      'change_order',
      'contract_clause',
      'daily_log_excerpt',
      'drawing_coordinate',
      'photo_observation',
      'punch_item',
      'rfi_reference',
      'schedule_phase',
      'spec_reference',
      'spreadsheet_cell',
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

  // Phase 3d additions
  it('builds spreadsheet_cell deep link with sheet + range query', () => {
    expect(
      citationDeepLink({
        kind: 'spreadsheet_cell',
        label: 'x',
        ref: 'asset-1',
        sheet_name: 'Budget',
        range_a1: 'B2:D15',
      }),
    ).toBe('/files/asset-1?sheet=Budget&range=B2%3AD15')
  })

  it('falls back to bare files path for spreadsheet_cell without sheet/range', () => {
    expect(
      citationDeepLink({ kind: 'spreadsheet_cell', label: 'x', ref: 'asset-1' }),
    ).toBe('/files/asset-1')
  })

  it('builds contract_clause deep link with clause query', () => {
    expect(
      citationDeepLink({
        kind: 'contract_clause',
        label: 'x',
        ref: 'k-1',
        clause_number: '3.2.1',
      }),
    ).toBe('/contracts/k-1?clause=3.2.1')
  })

  it('builds punch_item deep link', () => {
    expect(
      citationDeepLink({ kind: 'punch_item', label: 'x', ref: 'p-1' }),
    ).toBe('/punch-items/p-1')
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
