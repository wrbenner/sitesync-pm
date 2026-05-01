/**
 * Type definitions for the Enterprise Adoption Pack integrations.
 *
 * Procore, Primavera P6 (XER), MS Project (MSPDI XML), and the
 * accounting cost-code importers all flow through these interfaces
 * before being mapped onto SiteSync's native shapes.
 */

// ── Procore ─────────────────────────────────────────────

export interface ProcoreClientOptions {
  accessToken: string;
  region?: 'us' | 'eu' | 'au';
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Token-bucket rate (req/sec). Procore caps at 10; we default to 9. */
  requestsPerSecond?: number;
  /** Max retry attempts on 429. */
  maxRetries?: number;
}

export interface ProcorePagedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextPage: number | null;
}

export interface ProcoreProject {
  id: number;
  name: string;
  active: boolean;
  company: { id: number; name: string };
  start_date?: string;
  completion_date?: string;
}

export interface ProcoreRfi {
  id: number;
  number: string | number;
  subject: string;
  status: string;
  question?: string;
  answer?: string;
  due_date?: string;
  created_at: string;
  assignee_ids?: number[];
}

export interface ProcoreSubmittal {
  id: number;
  number: string | number;
  title: string;
  status: string;
  spec_section?: string;
  responsible_contractor_id?: number;
  due_date?: string;
}

export interface ProcoreChangeOrder {
  id: number;
  number: string | number;
  title: string;
  status: string;
  amount?: number | string;
  reason?: string;
}

export interface ProcoreDailyLog {
  id: number;
  date: string;
  notes?: string;
  weather?: string;
}

export interface ProcoreDrawing {
  id: number;
  number: string;
  title: string;
  revision: string;
  set_id?: number;
  url?: string;
}

export interface ProcorePhoto {
  id: number;
  url: string;
  caption?: string;
  taken_at?: string;
}

export interface ProcoreContact {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: { id: number; name: string };
}

export interface ProcoreSchedule {
  project_id: number;
  tasks: Array<{
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    percent_complete?: number;
    predecessor_ids?: number[];
  }>;
}

export interface ProcoreBudget {
  project_id: number;
  line_items: Array<{
    id: number;
    code: string;
    description: string;
    original_budget: number;
    revised_budget: number;
    actuals?: number;
  }>;
}

// ── P6 / XER ────────────────────────────────────────────

export interface P6Schedule {
  project: {
    id: string;
    name: string;
    plannedStart?: string;
    plannedFinish?: string;
    dataDate?: string;
  };
  tasks: P6Task[];
  predecessors: P6Predecessor[];
  calendars: P6Calendar[];
  resources: P6Resource[];
  assignments: P6Assignment[];
}

export interface P6Task {
  id: string;
  code: string;
  name: string;
  type: string;
  durationDays: number;
  percentComplete: number;
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  actualStart?: string;
  actualFinish?: string;
  calendarId?: string;
  /** Constraints we don't have a SiteSync equivalent for are stored here. */
  legacy_constraints: Record<string, string>;
}

export interface P6Predecessor {
  taskId: string;
  predecessorId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays: number;
}

export interface P6Calendar {
  id: string;
  name: string;
  type?: string;
}

export interface P6Resource {
  id: string;
  name: string;
  type: 'labor' | 'material' | 'nonlabor' | 'other';
  rate?: number;
}

export interface P6Assignment {
  taskId: string;
  resourceId: string;
  units: number;
}

// ── MS Project (MSPDI) ──────────────────────────────────

export interface MspSchedule {
  name: string;
  startDate: string;
  finishDate?: string;
  tasks: MspTask[];
  resources: MspResource[];
  assignments: MspAssignment[];
  links: MspLink[];
}

export interface MspTask {
  uid: string;
  id: string;
  name: string;
  start: string;
  finish: string;
  duration?: string;
  percentComplete: number;
  outlineLevel: number;
}

export interface MspResource {
  uid: string;
  name: string;
  type?: string;
  rate?: number;
}

export interface MspAssignment {
  taskUid: string;
  resourceUid: string;
  units: number;
}

export interface MspLink {
  predecessorUid: string;
  successorUid: string;
  type: number;
  lag?: number;
}

// ── Cost code importers ─────────────────────────────────

export type CostCodeType = 'labor' | 'material' | 'equipment' | 'sub' | 'overhead';

export interface ParsedCostCode {
  code: string;
  name: string;
  division?: string;
  type?: CostCodeType;
  rate?: number;
}

export interface ColumnMap {
  code: string;
  name: string;
  division?: string;
  type?: string;
  rate?: string;
}

export interface CostCodeImporter {
  id: string;
  system: string;
  defaultColumnMap: ColumnMap;
  parse(csv: string, columnMap?: ColumnMap): import('../services/errors').Result<ParsedCostCode[]>;
}
