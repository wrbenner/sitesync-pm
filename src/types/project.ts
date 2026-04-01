// Comprehensive Project type for the SiteSync frontend.
// Re-exports the canonical DB-derived type and adds derived/computed fields
// that getProject() maps on top of raw DB rows.

import type { Project as ProjectRow } from './entities'

export type ProjectType =
  | 'commercial_office'
  | 'mixed_use'
  | 'healthcare'
  | 'education'
  | 'multifamily'
  | 'industrial'
  | 'data_center'
  | 'retail'
  | 'hospitality'
  | 'government'
  | 'infrastructure'

export type DeliveryMethod =
  | 'design_bid_build'
  | 'cm_at_risk'
  | 'design_build'
  | 'integrated_project_delivery'

export type ContractType =
  | 'lump_sum'
  | 'gmp'
  | 'cost_plus'
  | 'time_and_materials'
  | 'unit_price'

export type ProjectPhase =
  | 'preconstruction'
  | 'mobilization'
  | 'construction'
  | 'commissioning'
  | 'closeout'
  | 'warranty'

// Human-readable labels for enum values used in UI selects and display.
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  commercial_office: 'Commercial Office',
  mixed_use: 'Mixed Use',
  healthcare: 'Healthcare',
  education: 'Education',
  multifamily: 'Multifamily',
  industrial: 'Industrial',
  data_center: 'Data Center',
  retail: 'Retail',
  hospitality: 'Hospitality',
  government: 'Government',
  infrastructure: 'Infrastructure',
}

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  design_bid_build: 'Design Bid Build',
  cm_at_risk: 'CM at Risk',
  design_build: 'Design Build',
  integrated_project_delivery: 'Integrated Project Delivery',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  lump_sum: 'Lump Sum',
  gmp: 'GMP',
  cost_plus: 'Cost Plus',
  time_and_materials: 'Time and Materials',
  unit_price: 'Unit Price',
}

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  preconstruction: 'Preconstruction',
  mobilization: 'Mobilization',
  construction: 'Construction',
  commissioning: 'Commissioning',
  closeout: 'Closeout',
  warranty: 'Warranty',
}

// EnrichedProject extends the raw DB row with computed fields added by getProject().
// Use this type throughout the app when working with project data from the API.
export interface EnrichedProject extends ProjectRow {
  // Computed fields mapped by getProject()
  totalValue: number
  completionPercentage: number
  daysRemaining: number
  scheduledEndDate: string
  startDate: string
  contractor: string
}

// Re-export base row type for convenience
export type { ProjectRow }
