import { describe, it, expect } from 'vitest'
import {
  PROJECT_TYPE_LABELS,
  DELIVERY_METHOD_LABELS,
  CONTRACT_TYPE_LABELS,
  PROJECT_PHASE_LABELS,
} from './project'

describe('project — PROJECT_TYPE_LABELS', () => {
  it('exposes the documented 11 project types', () => {
    expect(Object.keys(PROJECT_TYPE_LABELS).sort()).toEqual([
      'commercial_office', 'data_center', 'education', 'government',
      'healthcare', 'hospitality', 'industrial', 'infrastructure',
      'mixed_use', 'multifamily', 'retail',
    ])
  })

  it('every label is human-readable Title Case', () => {
    for (const label of Object.values(PROJECT_TYPE_LABELS)) {
      expect(label, `"${label}" is not Title Case`).toMatch(/^[A-Z]/)
      expect(label).not.toContain('_')
    }
  })

  it('CSI-correlated labels match expected naming', () => {
    expect(PROJECT_TYPE_LABELS.commercial_office).toBe('Commercial Office')
    expect(PROJECT_TYPE_LABELS.data_center).toBe('Data Center')
    expect(PROJECT_TYPE_LABELS.mixed_use).toBe('Mixed Use')
  })
})

describe('project — DELIVERY_METHOD_LABELS', () => {
  it('exposes the 4 standard delivery methods', () => {
    expect(Object.keys(DELIVERY_METHOD_LABELS)).toEqual([
      'design_bid_build', 'cm_at_risk', 'design_build', 'integrated_project_delivery',
    ])
  })

  it('CM at Risk uses the correct industry capitalization', () => {
    expect(DELIVERY_METHOD_LABELS.cm_at_risk).toBe('CM at Risk')
  })

  it('IPD label matches the documented expansion', () => {
    expect(DELIVERY_METHOD_LABELS.integrated_project_delivery).toBe('Integrated Project Delivery')
  })
})

describe('project — CONTRACT_TYPE_LABELS', () => {
  it('exposes the 5 standard contract types', () => {
    expect(Object.keys(CONTRACT_TYPE_LABELS)).toEqual([
      'lump_sum', 'gmp', 'cost_plus', 'time_and_materials', 'unit_price',
    ])
  })

  it('GMP is rendered as the industry abbreviation (not "Guaranteed Maximum Price")', () => {
    expect(CONTRACT_TYPE_LABELS.gmp).toBe('GMP')
  })
})

describe('project — PROJECT_PHASE_LABELS', () => {
  it('exposes the documented 6-phase lifecycle', () => {
    expect(Object.keys(PROJECT_PHASE_LABELS)).toEqual([
      'preconstruction', 'mobilization', 'construction',
      'commissioning', 'closeout', 'warranty',
    ])
  })

  it('phase labels use Title Case with no separators', () => {
    for (const label of Object.values(PROJECT_PHASE_LABELS)) {
      expect(label).toMatch(/^[A-Z][a-z]+$/)
    }
  })

  it('lifecycle order matches construction reality (precon → warranty)', () => {
    const phases = Object.keys(PROJECT_PHASE_LABELS)
    expect(phases[0]).toBe('preconstruction')
    expect(phases[phases.length - 1]).toBe('warranty')
  })
})

describe('project — label table cross-checks', () => {
  it('all label tables have unique values (no two enum members share a label)', () => {
    for (const table of [
      PROJECT_TYPE_LABELS,
      DELIVERY_METHOD_LABELS,
      CONTRACT_TYPE_LABELS,
      PROJECT_PHASE_LABELS,
    ]) {
      const labels = Object.values(table)
      expect(new Set(labels).size, 'duplicate label in table').toBe(labels.length)
    }
  })

  it('every label is non-empty', () => {
    for (const table of [
      PROJECT_TYPE_LABELS,
      DELIVERY_METHOD_LABELS,
      CONTRACT_TYPE_LABELS,
      PROJECT_PHASE_LABELS,
    ]) {
      for (const label of Object.values(table)) {
        expect(label).toBeTruthy()
      }
    }
  })
})
