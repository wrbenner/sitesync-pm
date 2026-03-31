// ── Platform Intelligence Types ───────────────────────────────
// Cross-project data network: benchmarking, sub reputation,
// material pricing, and risk prediction.
// All benchmarking data is anonymized and aggregated.
// Individual project data NEVER shared across organizations.

// ── Benchmark Types ───────────────────────────────────────────

export const BENCHMARK_METRICS = [
  'cost_per_sf',
  'rfi_turnaround_days',
  'submittal_cycle_days',
  'change_order_rate',
  'punch_density_per_1000sf',
  'safety_incident_rate',
  'schedule_variance_pct',
  'labor_productivity_index',
  'rework_rate',
  'closeout_duration_days',
] as const

export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number]

export const BENCHMARK_LABELS: Record<BenchmarkMetric, { label: string; unit: string; lowerIsBetter: boolean }> = {
  cost_per_sf: { label: 'Cost per Square Foot', unit: '$/SF', lowerIsBetter: true },
  rfi_turnaround_days: { label: 'RFI Response Time', unit: 'days', lowerIsBetter: true },
  submittal_cycle_days: { label: 'Submittal Cycle Time', unit: 'days', lowerIsBetter: true },
  change_order_rate: { label: 'Change Order Rate', unit: '%', lowerIsBetter: true },
  punch_density_per_1000sf: { label: 'Punch List Density', unit: 'items/1000 SF', lowerIsBetter: true },
  safety_incident_rate: { label: 'Safety Incident Rate (TRIR)', unit: 'per 200K hrs', lowerIsBetter: true },
  schedule_variance_pct: { label: 'Schedule Variance', unit: '%', lowerIsBetter: false },
  labor_productivity_index: { label: 'Labor Productivity Index', unit: 'index', lowerIsBetter: false },
  rework_rate: { label: 'Rework Rate', unit: '%', lowerIsBetter: true },
  closeout_duration_days: { label: 'Closeout Duration', unit: 'days', lowerIsBetter: true },
}

export const PROJECT_TYPES = [
  'commercial_office',
  'commercial_retail',
  'residential_multifamily',
  'residential_single',
  'industrial',
  'healthcare',
  'education',
  'hospitality',
  'mixed_use',
  'infrastructure',
] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  commercial_office: 'Commercial Office',
  commercial_retail: 'Commercial Retail',
  residential_multifamily: 'Multifamily Residential',
  residential_single: 'Single Family',
  industrial: 'Industrial / Warehouse',
  healthcare: 'Healthcare',
  education: 'Education',
  hospitality: 'Hospitality',
  mixed_use: 'Mixed Use',
  infrastructure: 'Infrastructure',
}

export interface BenchmarkData {
  id: string
  metricType: BenchmarkMetric
  projectType: ProjectType
  region: string
  value: number
  p25: number  // 25th percentile
  p50: number  // median
  p75: number  // 75th percentile
  p90: number  // 90th percentile
  sampleSize: number
  period: string // '2026-Q1'
  calculatedAt: string
}

export interface BenchmarkComparison {
  metric: BenchmarkMetric
  yourValue: number
  benchmarkMedian: number
  benchmarkP25: number
  benchmarkP75: number
  percentile: number // Where your value falls (0-100)
  trend: 'better' | 'worse' | 'same'
  sampleSize: number
}

// ── Subcontractor Reputation Types ────────────────────────────

export interface SubcontractorProfile {
  companyId: string
  companyName: string
  trade: string
  region: string
  // Aggregate metrics
  overallScore: number // 0-100
  onTimeRate: number   // 0-1
  rfiResponseDays: number
  reworkRate: number   // 0-1
  safetyScore: number  // 0-100
  paymentHistory: 'excellent' | 'good' | 'fair' | 'poor'
  // Volume
  projectCount: number
  ratingCount: number
  activeProjects: number
  // Trend
  scoreTrend: 'improving' | 'stable' | 'declining'
  // Flags
  verified: boolean
  featured: boolean // Top performer
  certifications: string[]
}

export interface SubcontractorRating {
  id: string
  companyId: string
  projectType: ProjectType
  metrics: {
    onTimeDelivery: number    // 0-5
    qualityOfWork: number     // 0-5
    communication: number     // 0-5
    safetyCompliance: number  // 0-5
    documentation: number     // 0-5
    wouldHireAgain: boolean
  }
  period: string
  createdAt: string
}

// ── Material Price Types ──────────────────────────────────────

export const MATERIAL_CATEGORIES = [
  'concrete',
  'structural_steel',
  'rebar',
  'lumber',
  'drywall',
  'copper_pipe',
  'electrical_wire',
  'ductwork',
  'roofing',
  'glass',
  'insulation',
  'paint',
] as const

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]

export const MATERIAL_LABELS: Record<MaterialCategory, { label: string; unit: string }> = {
  concrete: { label: 'Ready Mix Concrete', unit: '$/CY' },
  structural_steel: { label: 'Structural Steel', unit: '$/ton' },
  rebar: { label: 'Reinforcing Steel', unit: '$/ton' },
  lumber: { label: 'Dimensional Lumber', unit: '$/MBF' },
  drywall: { label: 'Gypsum Board', unit: '$/SF' },
  copper_pipe: { label: 'Copper Pipe (Type L)', unit: '$/LF' },
  electrical_wire: { label: 'Electrical Wire (12 AWG)', unit: '$/LF' },
  ductwork: { label: 'HVAC Ductwork', unit: '$/LF' },
  roofing: { label: 'TPO Roofing Membrane', unit: '$/SF' },
  glass: { label: 'Curtain Wall Glass', unit: '$/SF' },
  insulation: { label: 'Batt Insulation (R-19)', unit: '$/SF' },
  paint: { label: 'Interior Latex Paint', unit: '$/gal' },
}

export interface MaterialPrice {
  id: string
  materialType: MaterialCategory
  unit: string
  price: number
  region: string
  recordedAt: string
}

export interface MaterialPriceTrend {
  materialType: MaterialCategory
  region: string
  current: number
  previous: number
  change: number      // absolute
  changePct: number   // percentage
  direction: 'up' | 'down' | 'stable'
  history: Array<{ date: string; price: number }>
}

// ── Risk Prediction Types ─────────────────────────────────────

export interface RiskPrediction {
  id: string
  projectId: string
  riskType: 'budget_overrun' | 'schedule_slip' | 'rfi_delay' | 'submittal_rejection' | 'safety_incident'
  probability: number // 0-1
  impact: 'low' | 'medium' | 'high' | 'critical'
  description: string
  factors: string[]
  recommendation: string
  predictedAt: string
}

// ── Platform Opt-in Status ────────────────────────────────────

export interface PlatformOptIn {
  organizationId: string
  benchmarkingEnabled: boolean
  subRatingsEnabled: boolean
  materialPricingEnabled: boolean
  anonymizationLevel: 'full' | 'partial' // full = no org-level data shared
  dataResidency: 'us' | 'eu' | 'apac'
  consentedAt: string
  consentedBy: string
}
