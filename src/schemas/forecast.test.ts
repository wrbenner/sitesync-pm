import { describe, it, expect } from 'vitest'
import {
  ScheduleForecastSchema,
  CostForecastSchema,
  SafetyPredictionSchema,
  InsightSchema,
  PredictiveForecastSchema,
} from './forecast'

describe('ScheduleForecastSchema', () => {
  function valid() {
    return {
      p10_date: '2026-06-15',
      p50_date: '2026-07-01',
      p90_date: '2026-07-30',
      confidence: 75,
      historical_median_variance_days: 12,
      top_delay_drivers: [
        {
          activity_id: 'a-1',
          activity_name: 'Foundation',
          criticality_index: 0.8,
          slack_days: 3,
          current_progress: 50,
        },
      ],
      schedule_trend: [
        { date: '2026-01-01', p50_finish: '2026-07-01', variance_from_baseline: 5 },
      ],
    }
  }

  it('parses a valid schedule forecast', () => {
    expect(() => ScheduleForecastSchema.parse(valid())).not.toThrow()
  })

  it('clamps confidence to [0, 100]', () => {
    expect(() => ScheduleForecastSchema.parse({ ...valid(), confidence: -1 })).toThrow()
    expect(() => ScheduleForecastSchema.parse({ ...valid(), confidence: 101 })).toThrow()
  })

  it('clamps criticality_index to [0, 1]', () => {
    const v = valid()
    v.top_delay_drivers[0].criticality_index = 1.5
    expect(() => ScheduleForecastSchema.parse(v)).toThrow()
  })

  it('clamps current_progress to [0, 100]', () => {
    const v = valid()
    v.top_delay_drivers[0].current_progress = 150
    expect(() => ScheduleForecastSchema.parse(v)).toThrow()
  })
})

describe('CostForecastSchema', () => {
  function valid() {
    return {
      budget: 1_000_000,
      spent_to_date: 250_000,
      eac: 1_100_000,
      vac: -100_000,
      cpi: 0.95,
      spi: 0.92,
      evm_snapshots: [
        { date: '2026-01-01', earned_value: 100_000, planned_value: 110_000, actual_cost: 105_000 },
      ],
      cost_drivers: [
        { category: 'Concrete', budget: 200_000, spent: 50_000, forecast: 220_000, variance_pct: 10 },
      ],
      top_cost_risks: [
        { description: 'Steel price spike', impact_low: 10_000, impact_high: 50_000, probability_pct: 30 },
      ],
    }
  }

  it('parses a valid cost forecast', () => {
    expect(() => CostForecastSchema.parse(valid())).not.toThrow()
  })

  it('budget must be positive', () => {
    expect(() => CostForecastSchema.parse({ ...valid(), budget: 0 })).toThrow()
    expect(() => CostForecastSchema.parse({ ...valid(), budget: -1 })).toThrow()
  })

  it('spent_to_date must be non-negative', () => {
    expect(() => CostForecastSchema.parse({ ...valid(), spent_to_date: -1 })).toThrow()
    expect(() => CostForecastSchema.parse({ ...valid(), spent_to_date: 0 })).not.toThrow()
  })

  it('vac may be negative (over-budget projection)', () => {
    expect(() => CostForecastSchema.parse({ ...valid(), vac: -500_000 })).not.toThrow()
  })

  it('top_cost_risks probability_pct clamped to [0, 100]', () => {
    const v = valid()
    v.top_cost_risks[0].probability_pct = 110
    expect(() => CostForecastSchema.parse(v)).toThrow()
  })
})

describe('SafetyPredictionSchema', () => {
  it('rejects incident_likelihood_pct out of [0, 100]', () => {
    expect(() => SafetyPredictionSchema.parse({
      incident_likelihood_pct: 200, top_risks: [], mitigations: [],
    })).toThrow()
  })

  it('accepts valid prediction with empty arrays', () => {
    expect(() => SafetyPredictionSchema.parse({
      incident_likelihood_pct: 25, top_risks: [], mitigations: [],
    })).not.toThrow()
  })

  it('top_risks score clamped to [0, 100]', () => {
    expect(() => SafetyPredictionSchema.parse({
      incident_likelihood_pct: 25,
      top_risks: [{ risk: 'Falls', leading_indicator: 'Open edges', score: 150 }],
      mitigations: ['Edge protection'],
    })).toThrow()
  })
})

describe('InsightSchema', () => {
  function valid() {
    return {
      id: 'insight-1',
      narrative: 'Project tracking well overall.',
      key_findings: [
        { title: 'Schedule', summary: 'On track', severity: 'minor' as const },
      ],
      recommendations: [
        { action: 'Continue monitoring', priority: 'low' as const, estimated_impact: 'Low' },
      ],
      metrics_summary: {
        schedule_p50_days: 0,
        cost_variance_pct: 1.2,
        safety_risk_score: 30,
        schedule_trend: 'stable' as const,
        cost_trend: 'improving' as const,
      },
    }
  }

  it('parses a valid insight', () => {
    expect(() => InsightSchema.parse(valid())).not.toThrow()
  })

  it('rejects unknown severity', () => {
    const v = valid()
    v.key_findings[0].severity = 'medium' as never
    expect(() => InsightSchema.parse(v)).toThrow()
  })

  it('rejects unknown priority', () => {
    const v = valid()
    v.recommendations[0].priority = 'urgent' as never
    expect(() => InsightSchema.parse(v)).toThrow()
  })

  it('rejects unknown trend value', () => {
    const v = valid()
    v.metrics_summary.schedule_trend = 'great' as never
    expect(() => InsightSchema.parse(v)).toThrow()
  })

  it('recommendation owner is optional', () => {
    const v = valid()
    delete (v.recommendations[0] as { owner?: string }).owner
    expect(() => InsightSchema.parse(v)).not.toThrow()
  })
})

describe('PredictiveForecastSchema (combined)', () => {
  it('rejects when alert_status has unknown severity', () => {
    expect(() => PredictiveForecastSchema.parse({
      schedule_forecast: {
        p10_date: '', p50_date: '', p90_date: '', confidence: 75,
        historical_median_variance_days: 0, top_delay_drivers: [], schedule_trend: [],
      },
      cost_forecast: {
        budget: 1, spent_to_date: 0, eac: 1, vac: 0, cpi: 1, spi: 1,
        evm_snapshots: [], cost_drivers: [], top_cost_risks: [],
      },
      safety_prediction: { incident_likelihood_pct: 0, top_risks: [], mitigations: [] },
      alert_status: { severity: 'mystery', title: 't', message: 'm', action: 'a' },
      updated_at: '2026-01-01',
    })).toThrow()
  })

  it('alert_status is optional (forecast can omit it)', () => {
    expect(() => PredictiveForecastSchema.parse({
      schedule_forecast: {
        p10_date: '', p50_date: '', p90_date: '', confidence: 75,
        historical_median_variance_days: 0, top_delay_drivers: [], schedule_trend: [],
      },
      cost_forecast: {
        budget: 1, spent_to_date: 0, eac: 1, vac: 0, cpi: 1, spi: 1,
        evm_snapshots: [], cost_drivers: [], top_cost_risks: [],
      },
      safety_prediction: { incident_likelihood_pct: 0, top_risks: [], mitigations: [] },
      updated_at: '2026-01-01',
    })).not.toThrow()
  })
})
