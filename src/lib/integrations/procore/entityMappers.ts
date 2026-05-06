/**
 * Procore → SiteSync entity mappers.
 *
 * Pure functions. The output shape stays loose because the consumer
 * (procore-import-extended edge fn) writes the result directly into
 * the SiteSync tables, with `external_ids.procore_id` set so the
 * import is replayable / dedupable.
 */

import type {
  ProcoreRfi,
  ProcoreSubmittal,
  ProcoreChangeOrder,
  ProcoreDailyLog,
  ProcoreDrawing,
  ProcorePhoto,
  ProcoreContact,
} from '../../../types/integrations';

export interface MappedRfi {
  number: string;
  subject: string;
  status: string;
  question: string | null;
  answer: string | null;
  due_date: string | null;
  created_at: string;
  external_ids: { procore_id: number };
}

export interface MappedSubmittal {
  number: string;
  title: string;
  status: string;
  spec_section: string | null;
  due_date: string | null;
  external_ids: { procore_id: number };
}

export interface MappedChangeOrder {
  number: string;
  title: string;
  status: string;
  amount: number;
  reason: string | null;
  external_ids: { procore_id: number };
}

export interface MappedDailyLog {
  date: string;
  notes: string | null;
  weather: string | null;
  external_ids: { procore_id: number };
}

export interface MappedDrawing {
  number: string;
  title: string;
  revision: string;
  external_ids: { procore_id: number };
  source_url: string | null;
}

export interface MappedPhoto {
  url: string;
  caption: string | null;
  taken_at: string | null;
  external_ids: { procore_id: number };
}

export interface MappedContact {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  external_ids: { procore_id: number };
}

export function mapRfi(input: ProcoreRfi): MappedRfi {
  return {
    number: String(input.number ?? input.id),
    subject: input.subject,
    status: normalizeStatus(input.status),
    question: input.question ?? null,
    answer: input.answer ?? null,
    due_date: input.due_date ?? null,
    created_at: input.created_at,
    external_ids: { procore_id: input.id },
  };
}

export function mapSubmittal(input: ProcoreSubmittal): MappedSubmittal {
  return {
    number: String(input.number ?? input.id),
    title: input.title,
    status: normalizeStatus(input.status),
    spec_section: input.spec_section ?? null,
    due_date: input.due_date ?? null,
    external_ids: { procore_id: input.id },
  };
}

export function mapChangeOrder(input: ProcoreChangeOrder): MappedChangeOrder {
  const amt =
    typeof input.amount === 'string' ? parseFloat(input.amount) : input.amount;
  return {
    number: String(input.number ?? input.id),
    title: input.title,
    status: normalizeStatus(input.status),
    amount: Number.isFinite(amt as number) ? Number(amt) : 0,
    reason: input.reason ?? null,
    external_ids: { procore_id: input.id },
  };
}

export function mapDailyLog(input: ProcoreDailyLog): MappedDailyLog {
  return {
    date: input.date,
    notes: input.notes ?? null,
    weather: input.weather ?? null,
    external_ids: { procore_id: input.id },
  };
}

export function mapDrawing(input: ProcoreDrawing): MappedDrawing {
  return {
    number: input.number,
    title: input.title,
    revision: input.revision,
    source_url: input.url ?? null,
    external_ids: { procore_id: input.id },
  };
}

export function mapPhoto(input: ProcorePhoto): MappedPhoto {
  return {
    url: input.url,
    caption: input.caption ?? null,
    taken_at: input.taken_at ?? null,
    external_ids: { procore_id: input.id },
  };
}

export function mapContact(input: ProcoreContact): MappedContact {
  return {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    company_name: input.company?.name ?? null,
    external_ids: { procore_id: input.id },
  };
}

/**
 * Normalize Procore's freeform status strings to SiteSync's
 * lowercase-snake convention. Unknown statuses pass through verbatim
 * so we don't lose data — the UI can map them later.
 */
export function normalizeStatus(s: string | undefined | null): string {
  if (!s) return 'unknown';
  return s.toLowerCase().replace(/[\s-]+/g, '_');
}
