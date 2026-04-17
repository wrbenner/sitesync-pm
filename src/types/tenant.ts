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

export type { ProjectRole } from './database'
import type { ProjectRole } from './database'

export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer: 1,
  architect: 2,
  owner_rep: 2,
  subcontractor: 2,
  member: 2,
  field_user: 2,
  foreman: 3,
  field_engineer: 3,
  project_engineer: 3,
  safety_manager: 3,
  superintendent: 4,
  project_manager: 5,
  admin: 6,
  owner: 7,
  project_executive: 7,
}

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
  updated_at?: string
}

export interface PortfolioMetrics {
  total_projects: number
  active_projects: number
  total_contract_value: number
  total_budget_spent: number
  open_rfis?: number
  overdue_rfis?: number
  open_punch_items?: number
  avg_completion_percentage: number
  projects_on_schedule: number
  projects_at_risk: number
  warnings?: string[]
}
