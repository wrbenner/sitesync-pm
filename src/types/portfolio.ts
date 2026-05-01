/**
 * Type definitions for the portfolio rollup and risk-ranking surfaces.
 */

export type RiskLevel = 'green' | 'yellow' | 'red';

export type PayAppStatus =
  | 'on_track'
  | 'awaiting_review'
  | 'overdue'
  | 'paid'
  | 'unknown';

export interface PortfolioProjectInput {
  project_id: string;
  project_name: string;
  contract_value: number;
  schedule_variance_days: number;
  percent_complete: number;
  rfis_overdue: number;
  payapp_status: PayAppStatus;
  safety_incidents_ytd: number;
  profit_margin_pct: number;
  budget_variance_pct?: number;
  status?: 'active' | 'closed' | 'archived';
}

export interface PortfolioHealth {
  totalActiveValue: number;
  totalOpenRfis: number;
  projectsAtRisk: number;
  totalIncidentsYtd: number;
  byStatus: Record<RiskLevel, number>;
  totalProjects: number;
  weightedPercentComplete: number;
}

export interface RiskRankedProject extends PortfolioProjectInput {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
}

export interface ProjectTemplate {
  id?: string;
  name: string;
  description?: string;
  structural_payload: TemplatePayload;
  created_at?: string;
}

export interface TemplatePayload {
  sov_line_items?: Array<{
    code: string;
    description: string;
    division?: string;
    scheduled_value?: number;
  }>;
  rfi_categories?: string[];
  submittal_log_defaults?: Array<{
    spec_section: string;
    title: string;
    type?: string;
  }>;
  punch_templates?: Array<{
    title: string;
    trade?: string;
    description?: string;
  }>;
  closeout_deliverables?: Array<{
    name: string;
    category?: string;
    required?: boolean;
  }>;
  /** Role labels only — never user IDs. */
  role_assignments?: Array<{
    role: string;
    label?: string;
  }>;
  /** Anything else carried by template authors. */
  extra?: Record<string, unknown>;
}

export interface ProjectShape {
  id?: string;
  name: string;
  sov_line_items?: TemplatePayload['sov_line_items'];
  rfi_categories?: string[];
  submittal_log_defaults?: TemplatePayload['submittal_log_defaults'];
  punch_templates?: TemplatePayload['punch_templates'];
  closeout_deliverables?: TemplatePayload['closeout_deliverables'];
  role_assignments?: Array<{
    role: string;
    label?: string;
    user_id?: string;
  }>;
  // Transactional fields that should be stripped:
  open_rfis?: unknown[];
  change_orders?: unknown[];
  daily_logs?: unknown[];
  photos?: unknown[];
  // Allow free-form for materialize override merging.
  [key: string]: unknown;
}

export interface NewProjectInput {
  name: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  [key: string]: unknown;
}
