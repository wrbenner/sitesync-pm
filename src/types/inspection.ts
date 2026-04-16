import type { Priority } from './database';

export type InspectionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type InspectionType =
  | 'safety'
  | 'quality'
  | 'building'
  | 'fire'
  | 'electrical'
  | 'structural'
  | 'general';

export interface ChecklistItem {
  id: string;
  description: string;
  result: 'pass' | 'fail' | 'na' | null;
  notes?: string;
}

export interface Inspection {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: InspectionType;
  status: InspectionStatus;
  priority: Priority;
  scheduled_date: string | null;
  completed_date: string | null;
  inspector_id: string | null;
  location: string | null;
  score: number | null;
  findings: string | null;
  checklist_items: ChecklistItem[] | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionFinding {
  id: string;
  inspection_id: string;
  user_id: string | null;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'observation';
  attachments: string[] | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateInspectionInput {
  project_id: string;
  title: string;
  description?: string;
  type: InspectionType;
  priority: Priority;
  scheduled_date?: string;
  inspector_id?: string;
  location?: string;
  checklist_items?: ChecklistItem[];
}
