export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: 'starter' | 'professional' | 'enterprise'
  settings: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

export type OrgRole = 'owner' | 'admin' | 'member'

export type ProjectRole =
  | 'project_executive'
  | 'project_manager'
  | 'superintendent'
  | 'project_engineer'
  | 'safety_manager'
  | 'field_engineer'
  | 'subcontractor'
  | 'owner_rep'
  | 'architect'
  | 'viewer'

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  created_at?: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  permissions: Record<string, boolean>
  created_at?: string
}

export interface PortfolioMetrics {
  total_projects: number
  active_projects: number
  total_contract_value: number
  total_budget_spent: number
  open_rfis: number
  overdue_rfis: number
  open_punch_items: number
  avg_completion_percentage: number
  projects_on_schedule: number
  projects_at_risk: number
}
