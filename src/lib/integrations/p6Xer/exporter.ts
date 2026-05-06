/**
 * Minimal P6 XER exporter.
 *
 * Round-trips the SiteSync-shaped P6Schedule back to XER text. Only
 * the tables we parse are emitted; everything else is omitted.
 */

import type { P6Schedule } from '../../../types/integrations';

const PROJECT_FIELDS = [
  'proj_id',
  'proj_short_name',
  'proj_name',
  'plan_start_date',
  'plan_end_date',
  'last_recalc_date',
];
const TASK_FIELDS = [
  'task_id',
  'task_code',
  'task_name',
  'task_type',
  'target_drtn_hr_cnt',
  'phys_complete_pct',
  'early_start_date',
  'early_end_date',
  'late_start_date',
  'late_end_date',
  'act_start_date',
  'act_end_date',
  'clndr_id',
];
const PRED_FIELDS = ['task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'];
const CAL_FIELDS = ['clndr_id', 'clndr_name', 'clndr_type'];
const RSRC_FIELDS = ['rsrc_id', 'rsrc_name', 'rsrc_type', 'cost_per_qty'];
const TASKRSRC_FIELDS = ['task_id', 'rsrc_id', 'target_qty'];

export function exportXer(schedule: P6Schedule): string {
  const out: string[] = [];
  out.push('ERMHDR\t8.0\t' + new Date().toISOString().slice(0, 10));

  emitTable(out, 'PROJECT', PROJECT_FIELDS, [
    [
      schedule.project.id,
      schedule.project.name,
      schedule.project.name,
      schedule.project.plannedStart ?? '',
      schedule.project.plannedFinish ?? '',
      schedule.project.dataDate ?? '',
    ],
  ]);
  emitTable(
    out,
    'TASK',
    TASK_FIELDS,
    schedule.tasks.map((t) => [
      t.id,
      t.code,
      t.name,
      t.type,
      String(t.durationDays * 8),
      String(t.percentComplete),
      t.earlyStart ?? '',
      t.earlyFinish ?? '',
      t.lateStart ?? '',
      t.lateFinish ?? '',
      t.actualStart ?? '',
      t.actualFinish ?? '',
      t.calendarId ?? '',
    ]),
  );
  emitTable(
    out,
    'TASKPRED',
    PRED_FIELDS,
    schedule.predecessors.map((p) => [
      p.taskId,
      p.predecessorId,
      'PR_' + p.type,
      String(p.lagDays * 8),
    ]),
  );
  emitTable(
    out,
    'CALENDAR',
    CAL_FIELDS,
    schedule.calendars.map((c) => [c.id, c.name, c.type ?? '']),
  );
  emitTable(
    out,
    'RSRC',
    RSRC_FIELDS,
    schedule.resources.map((r) => [
      r.id,
      r.name,
      r.type,
      r.rate != null ? String(r.rate) : '',
    ]),
  );
  emitTable(
    out,
    'TASKRSRC',
    TASKRSRC_FIELDS,
    schedule.assignments.map((a) => [a.taskId, a.resourceId, String(a.units)]),
  );
  out.push('%E');
  return out.join('\n');
}

function emitTable(
  acc: string[],
  name: string,
  fields: string[],
  rows: string[][],
): void {
  acc.push('%T\t' + name);
  acc.push('%F\t' + fields.join('\t'));
  for (const row of rows) acc.push('%R\t' + row.join('\t'));
}
