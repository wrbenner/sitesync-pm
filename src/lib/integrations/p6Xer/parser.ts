/**
 * Primavera P6 XER parser.
 *
 * XER is a tab-delimited text format with three header markers:
 *   %T <TABLE_NAME>
 *   %F <field1>\t<field2>\t...
 *   %R <value1>\t<value2>\t...
 * The file ends with %E.
 *
 * We parse the structural tables we care about (PROJECT, TASK,
 * TASKPRED, CALENDAR, RSRC, TASKRSRC) and emit a normalized
 * P6Schedule. Constraints we don't have a SiteSync equivalent for
 * are preserved verbatim in `legacy_constraints` per task.
 *
 * This is a pure parser — no I/O — so it's testable with synthetic
 * fixtures.
 */

import type {
  P6Schedule,
  P6Task,
  P6Predecessor,
  P6Calendar,
  P6Resource,
  P6Assignment,
} from '../../../types/integrations';
import { ok, fail, validationError, type Result } from '../../../services/errors';

interface XerTable {
  name: string;
  fields: string[];
  rows: string[][];
}

const SUPPORTED_CONSTRAINT_FIELDS = new Set([
  'cstr_type',
  'cstr_date',
  'cstr_type2',
  'cstr_date2',
]);

export function parseXer(content: string): Result<P6Schedule> {
  if (!content || typeof content !== 'string') {
    return fail(validationError('XER content is empty'));
  }
  const lines = content.split(/\r?\n/);
  const tables = new Map<string, XerTable>();
  let current: XerTable | null = null;

  for (const raw of lines) {
    if (!raw) continue;
    if (raw.startsWith('%T')) {
      const name = raw.slice(2).trim().split(/\s+/)[0];
      current = { name, fields: [], rows: [] };
      tables.set(name, current);
    } else if (raw.startsWith('%F')) {
      if (!current) continue;
      current.fields = stripPrefix(raw, '%F')
        .split('\t')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (raw.startsWith('%R')) {
      if (!current) continue;
      const cells = stripPrefix(raw, '%R').split('\t');
      while (cells.length > current.fields.length) cells.pop();
      while (cells.length < current.fields.length) cells.push('');
      current.rows.push(cells);
    } else if (raw.startsWith('%E')) {
      break;
    }
  }

  const projectTable = tables.get('PROJECT');
  if (!projectTable || projectTable.rows.length === 0) {
    return fail(validationError('XER missing PROJECT table'));
  }

  const project = rowToObj(projectTable, 0);
  const tasks = parseTasks(tables.get('TASK'));
  const predecessors = parsePredecessors(tables.get('TASKPRED'));
  const calendars = parseCalendars(tables.get('CALENDAR'));
  const resources = parseResources(tables.get('RSRC'));
  const assignments = parseAssignments(tables.get('TASKRSRC'));

  return ok({
    project: {
      id: project.proj_id ?? '',
      name: project.proj_short_name ?? project.proj_name ?? 'Unnamed',
      plannedStart: project.plan_start_date || undefined,
      plannedFinish: project.plan_end_date || undefined,
      dataDate: project.last_recalc_date || undefined,
    },
    tasks,
    predecessors,
    calendars,
    resources,
    assignments,
  });
}

function parseTasks(table: XerTable | undefined): P6Task[] {
  if (!table) return [];
  return table.rows.map((row) => {
    const obj = rowToObj(table, table.rows.indexOf(row));
    const legacy: Record<string, string> = {};
    for (const f of table.fields) {
      if (SUPPORTED_CONSTRAINT_FIELDS.has(f) && obj[f]) {
        legacy[f] = obj[f];
      }
    }
    return {
      id: obj.task_id ?? '',
      code: obj.task_code ?? '',
      name: obj.task_name ?? '',
      type: obj.task_type ?? '',
      durationDays: numberOrZero(obj.target_drtn_hr_cnt) / 8,
      percentComplete: numberOrZero(obj.phys_complete_pct),
      earlyStart: obj.early_start_date || undefined,
      earlyFinish: obj.early_end_date || undefined,
      lateStart: obj.late_start_date || undefined,
      lateFinish: obj.late_end_date || undefined,
      actualStart: obj.act_start_date || undefined,
      actualFinish: obj.act_end_date || undefined,
      calendarId: obj.clndr_id || undefined,
      legacy_constraints: legacy,
    };
  });
}

function parsePredecessors(table: XerTable | undefined): P6Predecessor[] {
  if (!table) return [];
  return table.rows.map((_row, i) => {
    const obj = rowToObj(table, i);
    const t = (obj.pred_type ?? 'PR_FS').replace(/^PR_/, '');
    const validTypes: P6Predecessor['type'][] = ['FS', 'SS', 'FF', 'SF'];
    const type = (validTypes as string[]).includes(t)
      ? (t as P6Predecessor['type'])
      : 'FS';
    return {
      taskId: obj.task_id ?? '',
      predecessorId: obj.pred_task_id ?? '',
      type,
      lagDays: numberOrZero(obj.lag_hr_cnt) / 8,
    };
  });
}

function parseCalendars(table: XerTable | undefined): P6Calendar[] {
  if (!table) return [];
  return table.rows.map((_row, i) => {
    const obj = rowToObj(table, i);
    return {
      id: obj.clndr_id ?? '',
      name: obj.clndr_name ?? '',
      type: obj.clndr_type ?? undefined,
    };
  });
}

function parseResources(table: XerTable | undefined): P6Resource[] {
  if (!table) return [];
  return table.rows.map((_row, i) => {
    const obj = rowToObj(table, i);
    const rawType = (obj.rsrc_type ?? '').toLowerCase();
    let type: P6Resource['type'] = 'other';
    if (rawType.includes('labor')) type = 'labor';
    else if (rawType.includes('material')) type = 'material';
    else if (rawType.includes('nonlabor')) type = 'nonlabor';
    return {
      id: obj.rsrc_id ?? '',
      name: obj.rsrc_name ?? '',
      type,
      rate: obj.cost_per_qty ? Number(obj.cost_per_qty) : undefined,
    };
  });
}

function parseAssignments(table: XerTable | undefined): P6Assignment[] {
  if (!table) return [];
  return table.rows.map((_row, i) => {
    const obj = rowToObj(table, i);
    return {
      taskId: obj.task_id ?? '',
      resourceId: obj.rsrc_id ?? '',
      units: numberOrZero(obj.target_qty),
    };
  });
}

function rowToObj(table: XerTable, idx: number): Record<string, string> {
  const out: Record<string, string> = {};
  const row = table.rows[idx] ?? [];
  for (let i = 0; i < table.fields.length; i++) {
    out[table.fields[i]] = row[i] ?? '';
  }
  return out;
}

function numberOrZero(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Strip a `%X` marker plus its single delimiter (tab or space). */
function stripPrefix(line: string, marker: string): string {
  const rest = line.slice(marker.length);
  if (rest.startsWith('\t') || rest.startsWith(' ')) return rest.slice(1);
  return rest;
}
