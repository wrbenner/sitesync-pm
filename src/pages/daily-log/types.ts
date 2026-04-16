import type { DailyLog as DailyLogRow } from '../../types/database';

export interface DailyLogExtensions {
  crew_entries?: Array<{ trade?: string; company?: string; headcount?: number; hours?: number }>;
  equipment_entries?: Array<{ type: string; count: number; hours_operated: number }>;
  material_deliveries?: Array<{ description: string; quantity: number; po_reference: string; delivery_ticket: string }>;
  safety_observations?: string;
  toolbox_talk_topic?: string;
  visitors?: Array<{ name: string; company: string; purpose: string; time_in: string; time_out: string }>;
  incident_details?: Array<{ description: string; type: string; corrective_action: string }>;
}

export type ExtendedDailyLog = DailyLogRow & DailyLogExtensions;

export interface ManpowerRow {
  id: string;
  trade: string;
  company: string;
  headcount: number;
  hours: number;
}

export interface IncidentForm {
  type: string;
  description: string;
  corrective_action: string;
}
