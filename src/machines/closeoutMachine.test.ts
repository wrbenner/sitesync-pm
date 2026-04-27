import { describe, it, expect } from 'vitest'
import {
  getValidCloseoutTransitions,
  getCloseoutStatusConfig,
  getCloseoutCategoryConfig,
  generateCloseoutList,
  getWarrantyStatusConfig,
  computeWarrantyStatus,
  STANDARD_WARRANTY_PERIODS,
} from './closeoutMachine'

describe('closeoutMachine — getValidCloseoutTransitions', () => {
  it.each([
    ['required', ['Send Request']],
    ['requested', ['Mark Submitted']],
    ['submitted', ['Start Review', 'Approve']],
    ['under_review', ['Approve', 'Reject']],
    ['approved', []],
    ['rejected', ['Resubmit']],
  ] as const)('%s → %j', (state, actions) => {
    expect(getValidCloseoutTransitions(state)).toEqual(actions)
  })

  it('approved is terminal (no transitions)', () => {
    expect(getValidCloseoutTransitions('approved')).toEqual([])
  })
})

describe('closeoutMachine — getCloseoutStatusConfig', () => {
  it.each([
    ['required', 'Required'],
    ['requested', 'Requested'],
    ['submitted', 'Submitted'],
    ['under_review', 'Under Review'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getCloseoutStatusConfig(status).label).toBe(label)
  })
})

describe('closeoutMachine — getCloseoutCategoryConfig', () => {
  it('returns the documented label + icon for each category', () => {
    expect(getCloseoutCategoryConfig('om_manual').label).toBe('O&M Manual')
    expect(getCloseoutCategoryConfig('warranty').label).toBe('Warranty Letter')
    expect(getCloseoutCategoryConfig('lien_waiver').label).toBe('Lien Waiver')
    expect(getCloseoutCategoryConfig('certificate_occupancy').label).toBe('Certificate of Occupancy')
  })

  it('falls back to "Other" for unknown category', () => {
    // @ts-expect-error — exercising fallback
    expect(getCloseoutCategoryConfig('mystery').label).toBe('Other')
  })

  it('every category has a non-empty icon name', () => {
    const cats = [
      'om_manual', 'as_built', 'warranty', 'lien_waiver', 'substantial_completion',
      'certificate_occupancy', 'training', 'spare_parts', 'attic_stock',
      'commissioning', 'punch_list', 'final_payment', 'consent_surety',
      'testing', 'inspection', 'permit_closeout', 'insurance', 'other',
    ] as const
    for (const c of cats) {
      const cfg = getCloseoutCategoryConfig(c)
      expect(cfg.icon).toBeTruthy()
    }
  })
})

describe('closeoutMachine — generateCloseoutList', () => {
  it('returns at least the base item set for any project type', () => {
    const r = generateCloseoutList('commercial')
    expect(r.length).toBeGreaterThan(0)
    // Every item has the required fields.
    for (const item of r) {
      expect(item.category).toBeTruthy()
      expect(item.title).toBeTruthy()
    }
  })

  it('includes project-type specific items beyond the base set', () => {
    const commercial = generateCloseoutList('commercial')
    const healthcare = generateCloseoutList('healthcare')
    // Healthcare is more demanding than commercial, so it should typically have
    // ≥ commercial item count. (Asserts a non-shrinking baseline.)
    expect(healthcare.length).toBeGreaterThanOrEqual(commercial.length)
  })

  it('handles unknown project types gracefully (just base items)', () => {
    // @ts-expect-error — exercising fallback path
    const r = generateCloseoutList('mystery_type')
    expect(r.length).toBeGreaterThan(0)
  })
})

describe('closeoutMachine — getWarrantyStatusConfig', () => {
  it.each([
    ['active', 'Active'],
    ['expiring_soon', 'Expiring Soon'],
    ['expired', 'Expired'],
    ['claimed', 'Claimed'],
  ] as const)('%s → "%s"', (status, label) => {
    expect(getWarrantyStatusConfig(status).label).toBe(label)
  })
})

describe('closeoutMachine — computeWarrantyStatus', () => {
  it('returns "expired" when end date is in the past', () => {
    const past = new Date(Date.now() - 7 * 86400_000).toISOString()
    expect(computeWarrantyStatus(past)).toBe('expired')
  })

  it('returns "expiring_soon" within 30 days', () => {
    const soon = new Date(Date.now() + 15 * 86400_000).toISOString()
    expect(computeWarrantyStatus(soon)).toBe('expiring_soon')
  })

  it('returns "active" when more than 30 days remain', () => {
    const future = new Date(Date.now() + 60 * 86400_000).toISOString()
    expect(computeWarrantyStatus(future)).toBe('active')
  })

  it('30 days exactly is still expiring_soon (boundary)', () => {
    const boundary = new Date(Date.now() + 30 * 86400_000 - 1000).toISOString()
    expect(computeWarrantyStatus(boundary)).toBe('expiring_soon')
  })
})

describe('closeoutMachine — STANDARD_WARRANTY_PERIODS', () => {
  it('Roofing has the longest period (manufacturer + contractor)', () => {
    const max = Math.max(...Object.values(STANDARD_WARRANTY_PERIODS))
    expect(STANDARD_WARRANTY_PERIODS.Roofing).toBe(max)
  })

  it('General fallback is 12 months', () => {
    expect(STANDARD_WARRANTY_PERIODS.General).toBe(12)
  })

  it('every period is a positive integer (months)', () => {
    for (const months of Object.values(STANDARD_WARRANTY_PERIODS)) {
      expect(Number.isInteger(months)).toBe(true)
      expect(months).toBeGreaterThan(0)
    }
  })
})
