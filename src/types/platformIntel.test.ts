import { describe, it, expect } from 'vitest'
import {
  BENCHMARK_METRICS,
  BENCHMARK_LABELS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
} from './platformIntel'

describe('platformIntel — BENCHMARK_METRICS', () => {
  it('exposes the documented 10 benchmark metrics', () => {
    expect(BENCHMARK_METRICS).toHaveLength(10)
  })

  it('metrics are unique (no duplicates)', () => {
    expect(new Set(BENCHMARK_METRICS).size).toBe(BENCHMARK_METRICS.length)
  })

  it('every metric is snake_case (no spaces, lowercase, underscores)', () => {
    for (const metric of BENCHMARK_METRICS) {
      expect(metric, `${metric} is not snake_case`).toMatch(/^[a-z_0-9]+$/)
    }
  })
})

describe('platformIntel — BENCHMARK_LABELS', () => {
  it('every metric has a label entry (paired-vocabulary check)', () => {
    for (const metric of BENCHMARK_METRICS) {
      expect(BENCHMARK_LABELS[metric], `${metric} missing label`).toBeDefined()
    }
  })

  it('every label entry has label + unit + lowerIsBetter populated', () => {
    for (const [metric, cfg] of Object.entries(BENCHMARK_LABELS)) {
      expect(cfg.label, `${metric} missing label`).toBeTruthy()
      expect(cfg.unit, `${metric} missing unit`).toBeTruthy()
      expect(typeof cfg.lowerIsBetter, `${metric} lowerIsBetter not boolean`).toBe('boolean')
    }
  })

  it('cost / time / variance metrics are lowerIsBetter=true', () => {
    expect(BENCHMARK_LABELS.cost_per_sf.lowerIsBetter).toBe(true)
    expect(BENCHMARK_LABELS.rfi_turnaround_days.lowerIsBetter).toBe(true)
    expect(BENCHMARK_LABELS.submittal_cycle_days.lowerIsBetter).toBe(true)
    expect(BENCHMARK_LABELS.safety_incident_rate.lowerIsBetter).toBe(true)
    expect(BENCHMARK_LABELS.rework_rate.lowerIsBetter).toBe(true)
  })

  it('productivity index is lowerIsBetter=false (higher = better)', () => {
    expect(BENCHMARK_LABELS.labor_productivity_index.lowerIsBetter).toBe(false)
  })

  it('schedule_variance lowerIsBetter=false (negative variance = ahead, ok)', () => {
    // Documents the existing convention: schedule_variance_pct is signed,
    // so "lower is better" doesn't apply cleanly. The catalog marks it false.
    expect(BENCHMARK_LABELS.schedule_variance_pct.lowerIsBetter).toBe(false)
  })

  it('TRIR safety metric uses the OSHA "per 200K hrs" unit', () => {
    expect(BENCHMARK_LABELS.safety_incident_rate.unit).toContain('200K')
    expect(BENCHMARK_LABELS.safety_incident_rate.label).toContain('TRIR')
  })

  it('cost_per_sf uses the documented "$/SF" unit string', () => {
    expect(BENCHMARK_LABELS.cost_per_sf.unit).toBe('$/SF')
  })
})

describe('platformIntel — PROJECT_TYPES', () => {
  it('exposes the documented 10 project types', () => {
    expect(PROJECT_TYPES).toHaveLength(10)
  })

  it('types are unique (no duplicates)', () => {
    expect(new Set(PROJECT_TYPES).size).toBe(PROJECT_TYPES.length)
  })

  it('separates commercial_office vs commercial_retail (distinct construction types)', () => {
    expect(PROJECT_TYPES).toContain('commercial_office')
    expect(PROJECT_TYPES).toContain('commercial_retail')
  })

  it('separates residential_multifamily vs residential_single', () => {
    expect(PROJECT_TYPES).toContain('residential_multifamily')
    expect(PROJECT_TYPES).toContain('residential_single')
  })
})

describe('platformIntel — PROJECT_TYPE_LABELS', () => {
  it('every project type has a label (paired-vocabulary check)', () => {
    for (const t of PROJECT_TYPES) {
      expect(PROJECT_TYPE_LABELS[t], `${t} missing label`).toBeDefined()
    }
  })

  it('every label is non-empty Title Case', () => {
    for (const label of Object.values(PROJECT_TYPE_LABELS)) {
      expect(label).toBeTruthy()
      expect(label[0]).toBe(label[0].toUpperCase())
    }
  })

  it('industrial is rendered with the dual-purpose "Industrial / Warehouse" label', () => {
    expect(PROJECT_TYPE_LABELS.industrial).toBe('Industrial / Warehouse')
  })

  it('residential_multifamily is rendered as "Multifamily Residential" (not "Residential Multifamily")', () => {
    expect(PROJECT_TYPE_LABELS.residential_multifamily).toBe('Multifamily Residential')
  })

  it('all labels are unique within the table', () => {
    const labels = Object.values(PROJECT_TYPE_LABELS)
    expect(new Set(labels).size).toBe(labels.length)
  })
})
