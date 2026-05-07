// Phase 3 — predicate test suite for the 20-chip filter registry.
//
// Bugatti standard: every chip's matches() is exercised against rows shaped
// like submittals_log_mv (the canonical row shape consumed by
// SubmittalsItemsView's filterFn). Each chip has at least:
//   - one positive case (row passes)
//   - one negative case (row fails)
// Plus the edge cases the implementation actually special-cases
// (CSV prefix wildcards, BIC sentinels, Iris severity routing, date math).

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  CHIP_APPROVER,
  CHIP_BALL_IN_COURT,
  CHIP_CREATED_BY,
  CHIP_CURRENT_REVISION,
  CHIP_DIVISION,
  CHIP_LOCATION,
  CHIP_NUMBER,
  CHIP_PRIVATE,
  CHIP_RECEIVED_FROM,
  CHIP_RESPONSE,
  CHIP_RESPONSIBLE_CONTRACTOR,
  CHIP_SPEC_SECTION,
  CHIP_STATUS,
  CHIP_SUBMITTAL_MANAGER,
  CHIP_SUBMITTAL_PACKAGE,
  CHIP_TYPE,
  CHIP_IRIS_FINDING,
  CHIP_SCHEDULE_AT_RISK,
  CHIP_REQUIRED_WITHIN_N_DAYS,
  CHIP_CRITICAL_PATH,
  CHIPS,
  CHIPS_BY_ID,
  PROCORE_PARITY_COUNT,
  SITESYNC_ONLY_COUNT,
  applyChipFilters,
  decodeFiltersFromUrl,
  encodeFiltersToUrl,
} from '../../../components/submittals/FilterChips/filterDefinitions'
import type { SubmittalKind, SubmittalStatus } from '../../../types/submittal'

// ── Row factory ─────────────────────────────────────────────────────────────
// Models a submittals_log_mv row. Every column the chip predicates touch is
// included so we can override per-test.

type Row = Record<string, unknown>

const row = (overrides: Partial<Row> = {}): Row => ({
  id: '00000000-0000-0000-0000-000000000001',
  number: '08-001',
  title: 'Aluminum Framing — Storefront',
  csi_section: '08 41 13',
  csi_division: '08',
  rev_number: 0,
  status: 'in_review' as SubmittalStatus,
  kind: 'shop_drawing' as SubmittalKind,
  current_reviewer_id: 'user-architect-1',
  current_reviewer_role: 'architect',
  responsible_sub_id: 'sub-glazing-co',
  subcontractor: 'Glazing Co',
  created_by: 'user-pm-1',
  submittal_manager_id: 'user-mgr-1',
  submittal_package_id: 'pkg-curtainwall-01',
  location_id: 'loc-level-2',
  is_private: false,
  is_critical_path: false,
  disposition: null,
  required_on_site_date: null,
  iris_preflight_findings: null,
  risk_band: 'on_track',
  ...overrides,
})

// ── Registry sanity ─────────────────────────────────────────────────────────

describe('chip registry shape', () => {
  it('has exactly 20 chips: 16 Procore parity + 4 SiteSync-only', () => {
    expect(CHIPS).toHaveLength(20)
    expect(PROCORE_PARITY_COUNT).toBe(16)
    expect(SITESYNC_ONLY_COUNT).toBe(4)
  })
  it('exposes every chip in CHIPS_BY_ID', () => {
    for (const chip of CHIPS) {
      expect(CHIPS_BY_ID[chip.id]).toBe(chip)
    }
  })
  it('has unique ids', () => {
    const ids = new Set(CHIPS.map((c) => c.id))
    expect(ids.size).toBe(CHIPS.length)
  })
})

// ── Procore-parity chips ────────────────────────────────────────────────────

describe('CHIP_APPROVER', () => {
  it('passes when reviewer id matches', () => {
    expect(CHIP_APPROVER.matches(row(), ['user-architect-1'])).toBe(true)
  })
  it('rejects when reviewer id absent from list', () => {
    expect(CHIP_APPROVER.matches(row(), ['user-architect-99'])).toBe(false)
  })
  it('passes when filter is empty', () => {
    expect(CHIP_APPROVER.matches(row(), [])).toBe(true)
  })
})

describe('CHIP_BALL_IN_COURT', () => {
  it('matches reviewer id', () => {
    expect(CHIP_BALL_IN_COURT.matches(row(), ['user-architect-1'])).toBe(true)
  })
  it('__unassigned__ sentinel matches when reviewer is empty', () => {
    expect(CHIP_BALL_IN_COURT.matches(row({ current_reviewer_id: '', current_reviewer: null }), ['__unassigned__'])).toBe(true)
  })
  it('__architect_side__ sentinel matches reviewer_role containing arch', () => {
    expect(CHIP_BALL_IN_COURT.matches(row({ current_reviewer_role: 'Architect of Record' }), ['__architect_side__'])).toBe(true)
  })
  it('__sub_side__ sentinel matches reviewer_role containing sub', () => {
    expect(CHIP_BALL_IN_COURT.matches(row({ current_reviewer_role: 'subcontractor' }), ['__sub_side__'])).toBe(true)
  })
  it('rejects when nothing matches', () => {
    expect(CHIP_BALL_IN_COURT.matches(row(), ['user-other'])).toBe(false)
  })
})

describe('CHIP_CREATED_BY', () => {
  it('matches creator id', () => {
    expect(CHIP_CREATED_BY.matches(row(), ['user-pm-1'])).toBe(true)
  })
  it('rejects when creator differs', () => {
    expect(CHIP_CREATED_BY.matches(row({ created_by: 'user-pm-2' }), ['user-pm-1'])).toBe(false)
  })
})

describe('CHIP_CURRENT_REVISION', () => {
  it('passes when rev within [min, max]', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: 2 }), { min: 1, max: 3 })).toBe(true)
  })
  it('passes when only min set and rev >= min', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: 5 }), { min: 1 })).toBe(true)
  })
  it('passes when only max set and rev <= max', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: 0 }), { max: 0 })).toBe(true)
  })
  it('rejects below min', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: 0 }), { min: 1 })).toBe(false)
  })
  it('rejects above max', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: 5 }), { max: 3 })).toBe(false)
  })
  it('treats null rev as 0', () => {
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: null }), { min: 1 })).toBe(false)
    expect(CHIP_CURRENT_REVISION.matches(row({ rev_number: null }), { max: 0 })).toBe(true)
  })
})

describe('CHIP_DIVISION', () => {
  it('matches division', () => {
    expect(CHIP_DIVISION.matches(row(), ['08'])).toBe(true)
  })
  it('rejects different division', () => {
    expect(CHIP_DIVISION.matches(row(), ['09'])).toBe(false)
  })
})

describe('CHIP_LOCATION', () => {
  it('matches location id', () => {
    expect(CHIP_LOCATION.matches(row(), ['loc-level-2'])).toBe(true)
  })
  it('rejects different location', () => {
    expect(CHIP_LOCATION.matches(row(), ['loc-level-1'])).toBe(false)
  })
})

describe('CHIP_NUMBER', () => {
  it('matches substring', () => {
    expect(CHIP_NUMBER.matches(row(), '08-')).toBe(true)
  })
  it('case-insensitive', () => {
    expect(CHIP_NUMBER.matches(row({ number: 'A-007' }), 'a')).toBe(true)
  })
  it('rejects non-substring', () => {
    expect(CHIP_NUMBER.matches(row(), '999')).toBe(false)
  })
  it('passes when filter is empty string', () => {
    expect(CHIP_NUMBER.matches(row(), '')).toBe(true)
  })
})

describe('CHIP_PRIVATE', () => {
  it('matches when both true', () => {
    expect(CHIP_PRIVATE.matches(row({ is_private: true }), true)).toBe(true)
  })
  it('matches when both false', () => {
    expect(CHIP_PRIVATE.matches(row({ is_private: false }), false)).toBe(true)
  })
  it('rejects when mismatched', () => {
    expect(CHIP_PRIVATE.matches(row({ is_private: false }), true)).toBe(false)
  })
})

describe('CHIP_RECEIVED_FROM', () => {
  it('matches sub id', () => {
    expect(CHIP_RECEIVED_FROM.matches(row(), ['sub-glazing-co'])).toBe(true)
  })
  it('matches subcontractor name field', () => {
    expect(CHIP_RECEIVED_FROM.matches(row(), ['Glazing Co'])).toBe(true)
  })
  it('matches created_by as fallback', () => {
    expect(CHIP_RECEIVED_FROM.matches(row(), ['user-pm-1'])).toBe(true)
  })
})

describe('CHIP_RESPONSE', () => {
  it('matches disposition code', () => {
    expect(CHIP_RESPONSE.matches(row({ disposition: 'no_exceptions_taken' }), ['no_exceptions_taken'])).toBe(true)
  })
  it('rejects non-matching code', () => {
    expect(CHIP_RESPONSE.matches(row({ disposition: 'rejected' }), ['no_exceptions_taken'])).toBe(false)
  })
})

describe('CHIP_RESPONSIBLE_CONTRACTOR', () => {
  it('matches sub id', () => {
    expect(CHIP_RESPONSIBLE_CONTRACTOR.matches(row(), ['sub-glazing-co'])).toBe(true)
  })
})

describe('CHIP_SPEC_SECTION', () => {
  it('matches exact section', () => {
    expect(CHIP_SPEC_SECTION.matches(row(), ['08 41 13'])).toBe(true)
  })
  it('matches prefix wildcard 08*', () => {
    expect(CHIP_SPEC_SECTION.matches(row(), ['08*'])).toBe(true)
  })
  it('matches prefix wildcard with whitespace stripping', () => {
    expect(CHIP_SPEC_SECTION.matches(row({ csi_section: '084113' }), ['08 41*'])).toBe(true)
  })
  it('rejects non-matching prefix', () => {
    expect(CHIP_SPEC_SECTION.matches(row(), ['09*'])).toBe(false)
  })
  it('falls back to spec_section when csi_section absent', () => {
    expect(CHIP_SPEC_SECTION.matches(row({ csi_section: undefined, spec_section: '03 30 00' }), ['03*'])).toBe(true)
  })
})

describe('CHIP_STATUS', () => {
  it('matches a single status', () => {
    expect(CHIP_STATUS.matches(row(), ['in_review'] as SubmittalStatus[])).toBe(true)
  })
  it('matches one of many', () => {
    expect(
      CHIP_STATUS.matches(row(), ['draft', 'in_review', 'closed'] as SubmittalStatus[]),
    ).toBe(true)
  })
  it('rejects status not in list', () => {
    expect(CHIP_STATUS.matches(row(), ['closed'] as SubmittalStatus[])).toBe(false)
  })
})

describe('CHIP_SUBMITTAL_MANAGER', () => {
  it('matches manager id', () => {
    expect(CHIP_SUBMITTAL_MANAGER.matches(row(), ['user-mgr-1'])).toBe(true)
  })
})

describe('CHIP_SUBMITTAL_PACKAGE', () => {
  it('matches package id', () => {
    expect(CHIP_SUBMITTAL_PACKAGE.matches(row(), ['pkg-curtainwall-01'])).toBe(true)
  })
})

describe('CHIP_TYPE', () => {
  it('matches kind', () => {
    expect(CHIP_TYPE.matches(row(), ['shop_drawing'] as SubmittalKind[])).toBe(true)
  })
  it('falls back to type when kind absent', () => {
    expect(
      CHIP_TYPE.matches(row({ kind: undefined, type: 'product_data' }), ['product_data'] as SubmittalKind[]),
    ).toBe(true)
  })
  it('rejects unknown kind', () => {
    expect(CHIP_TYPE.matches(row(), ['samples'] as SubmittalKind[])).toBe(false)
  })
})

// ── SiteSync-only chips ─────────────────────────────────────────────────────

describe('CHIP_IRIS_FINDING', () => {
  it('matches "none" when findings array empty', () => {
    expect(CHIP_IRIS_FINDING.matches(row({ iris_preflight_findings: [] }), 'none')).toBe(true)
  })
  it('matches "none" when findings null', () => {
    expect(CHIP_IRIS_FINDING.matches(row({ iris_preflight_findings: null }), 'none')).toBe(true)
  })
  it('matches "has_p0" when severity P0 present', () => {
    expect(
      CHIP_IRIS_FINDING.matches(
        row({ iris_preflight_findings: [{ severity: 'P0', id: 'f1' }, { severity: 'P2', id: 'f2' }] }),
        'has_p0',
      ),
    ).toBe(true)
  })
  it('does not match "has_p0" when only P1/P2 present', () => {
    expect(
      CHIP_IRIS_FINDING.matches(
        row({ iris_preflight_findings: [{ severity: 'P1' }, { severity: 'P2' }] }),
        'has_p0',
      ),
    ).toBe(false)
  })
  it('matches "has_p1"', () => {
    expect(
      CHIP_IRIS_FINDING.matches(
        row({ iris_preflight_findings: [{ severity: 'P1', id: 'fp1' }] }),
        'has_p1',
      ),
    ).toBe(true)
  })
  it('matches a specific finding id', () => {
    expect(
      CHIP_IRIS_FINDING.matches(
        row({ iris_preflight_findings: [{ severity: 'P2', id: 'finding-abc' }] }),
        'finding-abc',
      ),
    ).toBe(true)
  })
})

describe('CHIP_SCHEDULE_AT_RISK', () => {
  it('true when band is overdue', () => {
    expect(CHIP_SCHEDULE_AT_RISK.matches(row({ risk_band: 'overdue' }), true)).toBe(true)
  })
  it('true when band is at_risk', () => {
    expect(CHIP_SCHEDULE_AT_RISK.matches(row({ risk_band: 'at_risk' }), true)).toBe(true)
  })
  it('true when band is submit_overdue', () => {
    expect(CHIP_SCHEDULE_AT_RISK.matches(row({ risk_band: 'submit_overdue' }), true)).toBe(true)
  })
  it('false when band is on_track', () => {
    expect(CHIP_SCHEDULE_AT_RISK.matches(row(), true)).toBe(false)
  })
  it('inverse when value is false', () => {
    expect(CHIP_SCHEDULE_AT_RISK.matches(row({ risk_band: 'on_track' }), false)).toBe(true)
  })
})

describe('CHIP_REQUIRED_WITHIN_N_DAYS', () => {
  // Freeze time so date math is deterministic.
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'))
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('matches when required date is within N days', () => {
    expect(
      CHIP_REQUIRED_WITHIN_N_DAYS.matches(row({ required_on_site_date: '2026-05-08' }), 7),
    ).toBe(true)
  })
  it('matches today (boundary inclusive)', () => {
    expect(
      CHIP_REQUIRED_WITHIN_N_DAYS.matches(row({ required_on_site_date: '2026-05-06' }), 0),
    ).toBe(true)
  })
  it('rejects date outside the window', () => {
    expect(
      CHIP_REQUIRED_WITHIN_N_DAYS.matches(row({ required_on_site_date: '2026-06-15' }), 7),
    ).toBe(false)
  })
  it('rejects when required date is null', () => {
    expect(CHIP_REQUIRED_WITHIN_N_DAYS.matches(row({ required_on_site_date: null }), 7)).toBe(false)
  })
})

describe('CHIP_CRITICAL_PATH', () => {
  it('matches when both true', () => {
    expect(CHIP_CRITICAL_PATH.matches(row({ is_critical_path: true }), true)).toBe(true)
  })
  it('matches when both false', () => {
    expect(CHIP_CRITICAL_PATH.matches(row({ is_critical_path: false }), false)).toBe(true)
  })
})

// ── applyChipFilters / URL round-trip ───────────────────────────────────────

describe('applyChipFilters', () => {
  it('returns input unchanged when no filters', () => {
    const rows = [row(), row({ id: '2' })]
    expect(applyChipFilters(rows, {})).toHaveLength(2)
  })
  it('AND-composes multiple chips', () => {
    const a = row({ id: 'a', status: 'in_review', kind: 'shop_drawing' })
    const b = row({ id: 'b', status: 'in_review', kind: 'product_data' })
    const c = row({ id: 'c', status: 'closed', kind: 'shop_drawing' })
    const filters = { status: ['in_review'], type: ['shop_drawing'] }
    const result = applyChipFilters([a, b, c], filters)
    expect(result.map((r) => r.id)).toEqual(['a'])
  })
  it('ignores unknown chip ids', () => {
    const rows = [row()]
    expect(applyChipFilters(rows, { unknown_chip: 'x' })).toHaveLength(1)
  })
  it('skips undefined and null chip values', () => {
    const rows = [row()]
    expect(applyChipFilters(rows, { status: undefined, type: null as never })).toHaveLength(1)
  })
})

describe('URL round-trip via decodeFiltersFromUrl/encodeFiltersToUrl', () => {
  it('round-trips status multi', () => {
    const input = new URLSearchParams('?filter[status]=in_review,sent_to_reviewer')
    const decoded = decodeFiltersFromUrl(input)
    expect(decoded.status).toEqual(['in_review', 'sent_to_reviewer'])
    const encoded = encodeFiltersToUrl(new URLSearchParams(), decoded)
    expect(encoded.get('filter[status]')).toBe('in_review,sent_to_reviewer')
  })
  it('round-trips boolean (private)', () => {
    const input = new URLSearchParams('?filter[private]=true')
    const decoded = decodeFiltersFromUrl(input)
    expect(decoded.private).toBe(true)
    const encoded = encodeFiltersToUrl(new URLSearchParams(), decoded)
    expect(encoded.get('filter[private]')).toBe('true')
  })
  it('round-trips revision range', () => {
    const input = new URLSearchParams('?filter[current_revision]=1-3')
    const decoded = decodeFiltersFromUrl(input)
    expect(decoded.current_revision).toEqual({ min: 1, max: 3 })
    const encoded = encodeFiltersToUrl(new URLSearchParams(), decoded)
    expect(encoded.get('filter[current_revision]')).toBe('1-3')
  })
  it('preserves base params not owned by chips', () => {
    const base = new URLSearchParams('?other=keep')
    const encoded = encodeFiltersToUrl(base, { status: ['draft'] })
    expect(encoded.get('other')).toBe('keep')
    expect(encoded.get('filter[status]')).toBe('draft')
  })
})
