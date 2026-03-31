// Predictive forecast Zod schemas.
// Validates data from generate-insights and weekly-digest edge functions.

import { z } from 'zod'

// ── Schedule Forecast ────────────────────────────────────

export const ScheduleForecastSchema = z.object({
  p10_date: z.string(),
  p50_date: z.string(),
  p90_date: z.string(),
  confidence: z.number().min(0).max(100),
  historical_median_variance_days: z.number(),
  top_delay_drivers: z.array(z.object({
    activity_id: z.string(),
    activity_name: z.string(),
    criticality_index: z.number().min(0).max(1),
    slack_days: z.number(),
    current_progress: z.number().min(0).max(100),
  })),
  schedule_trend: z.array(z.object({
    date: z.string(),
    p50_finish: z.string(),
    variance_from_baseline: z.number(),
  })),
})

// ── Cost Forecast (EVM) ──────────────────────────────────

export const CostForecastSchema = z.object({
  budget: z.number().positive(),
  spent_to_date: z.number().nonnegative(),
  eac: z.number().positive(),
  vac: z.number(),
  cpi: z.number(),
  spi: z.number(),
  evm_snapshots: z.array(z.object({
    date: z.string(),
    earned_value: z.number().nonnegative(),
    planned_value: z.number().nonnegative(),
    actual_cost: z.number().nonnegative(),
  })),
  cost_drivers: z.array(z.object({
    category: z.string(),
    budget: z.number().nonnegative(),
    spent: z.number().nonnegative(),
    forecast: z.number().nonnegative(),
    variance_pct: z.number(),
  })),
  top_cost_risks: z.array(z.object({
    description: z.string(),
    impact_low: z.number().nonnegative(),
    impact_high: z.number().nonnegative(),
    probability_pct: z.number().min(0).max(100),
  })),
})

// ── Safety Prediction ────────────────────────────────────

export const SafetyPredictionSchema = z.object({
  incident_likelihood_pct: z.number().min(0).max(100),
  top_risks: z.array(z.object({
    risk: z.string(),
    leading_indicator: z.string(),
    score: z.number().min(0).max(100),
  })),
  mitigations: z.array(z.string()),
})

// ── Weekly Insight ───────────────────────────────────────

export const InsightSchema = z.object({
  id: z.string(),
  narrative: z.string(),
  key_findings: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    severity: z.enum(['critical', 'major', 'minor']),
  })),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    estimated_impact: z.string(),
    owner: z.string().optional(),
  })),
  metrics_summary: z.object({
    schedule_p50_days: z.number(),
    cost_variance_pct: z.number(),
    safety_risk_score: z.number().min(0).max(100),
    schedule_trend: z.enum(['improving', 'stable', 'deteriorating']),
    cost_trend: z.enum(['improving', 'stable', 'deteriorating']),
  }),
})

// ── Combined Forecast Response ───────────────────────────

export const PredictiveForecastSchema = z.object({
  schedule_forecast: ScheduleForecastSchema,
  cost_forecast: CostForecastSchema,
  safety_prediction: SafetyPredictionSchema,
  alert_status: z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    title: z.string(),
    message: z.string(),
    action: z.string(),
  }).optional(),
  latest_insight: z.object({
    id: z.string(),
    narrative: z.string(),
  }).optional(),
  updated_at: z.string(),
})

// ── Type Exports ─────────────────────────────────────────

export type ScheduleForecast = z.infer<typeof ScheduleForecastSchema>
export type CostForecast = z.infer<typeof CostForecastSchema>
export type SafetyPrediction = z.infer<typeof SafetyPredictionSchema>
export type Insight = z.infer<typeof InsightSchema>
export type PredictiveForecast = z.infer<typeof PredictiveForecastSchema>
