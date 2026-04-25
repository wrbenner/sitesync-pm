// SiteSync PM — Schedule Export Utilities
// Exports schedule data to P6 XER, CSV, and triggers browser downloads.

import type { ImportedActivity } from './scheduleImport';

// ── XER Export (Primavera P6) ───────────────────────────────

/** Map relationship type to P6 code */
function toP6RelType(type: 'FS' | 'SS' | 'FF' | 'SF'): string {
  const map: Record<string, string> = { FS: 'PR_FS', SS: 'PR_SS', FF: 'PR_FF', SF: 'PR_SF' };
  return map[type] ?? 'PR_FS';
}

/** Format a date as P6 date string */
function formatP6Date(isoDate: string): string {
  if (!isoDate) return '';
  return isoDate; // P6 accepts ISO format dates
}

export function exportToXER(activities: ImportedActivity[], projectName: string): string {
  const lines: string[] = [];
  const now = new Date().toISOString().substring(0, 10);
  const projId = '1';

  // Header
  lines.push(`ERMHDR\t9.0\t${now}\tProject\tSiteSync PM Export`);
  lines.push('');

  // PROJECT table
  lines.push('%T\tPROJECT');
  lines.push('%F\tproj_id\tproj_short_name\tproject_name\tlast_recalc_date');
  lines.push(`%R\t${projId}\t${projectName}\t${projectName}\t${now}`);
  lines.push('%E');
  lines.push('');

  // CALENDAR table (default calendar)
  lines.push('%T\tCALENDAR');
  lines.push('%F\tclndr_id\tclndr_name');
  lines.push('%R\t1\tStandard 5-Day');
  lines.push('%E');
  lines.push('');

  // WBS table (flat — one WBS per unique WBS code)
  const wbsCodes = new Set<string>();
  const wbsEntries: Array<{ id: string; code: string }> = [];
  let wbsCounter = 1;

  // Add project-level WBS
  wbsEntries.push({ id: '1', code: projectName });

  for (const act of activities) {
    const code = act.wbs || 'General';
    if (!wbsCodes.has(code)) {
      wbsCodes.add(code);
      wbsCounter++;
      wbsEntries.push({ id: String(wbsCounter), code });
    }
  }

  lines.push('%T\tPROJWBS');
  lines.push('%F\twbs_id\twbs_short_name\twbs_name\tproj_id\tparent_wbs_id');
  for (const wbs of wbsEntries) {
    const parentId = wbs.id === '1' ? '' : '1';
    lines.push(`%R\t${wbs.id}\t${wbs.code}\t${wbs.code}\t${projId}\t${parentId}`);
  }
  lines.push('%E');
  lines.push('');

  // Build WBS code to ID map
  const wbsCodeToId = new Map<string, string>();
  for (const wbs of wbsEntries) {
    wbsCodeToId.set(wbs.code, wbs.id);
  }

  // TASK table
  lines.push('%T\tTASK');
  lines.push('%F\ttask_id\ttask_code\ttask_name\twbs_id\tproj_id\tclndr_id\ttask_type\tact_start_date\tact_end_date\ttarget_drtn_hr_cnt\tphys_complete_pct\ttotal_float_hr_cnt\tfree_float_hr_cnt');

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const taskId = String(i + 1);
    const wbsCode = act.wbs || 'General';
    const wbsId = wbsCodeToId.get(wbsCode) || '1';
    const durationHours = Math.round(act.duration * 8);
    const taskType = act.isMilestone ? 'TT_Mile' : 'TT_Task';
    const totalFloatHrs = act.totalFloat !== undefined ? Math.round(act.totalFloat * 8) : '';
    const freeFloatHrs = act.freeFloat !== undefined ? Math.round(act.freeFloat * 8) : '';

    lines.push(
      `%R\t${taskId}\t${act.id}\t${act.name}\t${wbsId}\t${projId}\t${act.calendarId || '1'}\t${taskType}\t${formatP6Date(act.startDate)}\t${formatP6Date(act.endDate)}\t${durationHours}\t${act.percentComplete}\t${totalFloatHrs}\t${freeFloatHrs}`
    );
  }
  lines.push('%E');
  lines.push('');

  // Build activity ID to task_id map for predecessors
  const actIdToTaskId = new Map<string, string>();
  for (let i = 0; i < activities.length; i++) {
    actIdToTaskId.set(activities[i].id, String(i + 1));
  }

  // TASKPRED table
  const predRows: string[] = [];
  let predId = 0;
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const taskId = String(i + 1);

    for (const pred of act.predecessors) {
      predId++;
      const predTaskId = actIdToTaskId.get(pred.activityId) || pred.activityId;
      const lagHours = Math.round(pred.lag * 8);
      predRows.push(
        `%R\t${predId}\t${taskId}\t${predTaskId}\t${toP6RelType(pred.type)}\t${lagHours}`
      );
    }
  }

  if (predRows.length > 0) {
    lines.push('%T\tTASKPRED');
    lines.push('%F\ttaskpred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt');
    for (const row of predRows) {
      lines.push(row);
    }
    lines.push('%E');
    lines.push('');
  }

  // End of file
  lines.push('%E');

  return lines.join('\r\n');
}

// ── CSV Export ──────────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPredecessors(preds: ImportedActivity['predecessors']): string {
  return preds.map((p) => {
    let str = p.activityId;
    if (p.type !== 'FS') str += p.type;
    if (p.lag !== 0) str += (p.lag > 0 ? '+' : '') + p.lag + 'd';
    return str;
  }).join(', ');
}

export function exportToCSV(activities: ImportedActivity[]): string {
  const headers = [
    'ID',
    'Name',
    'WBS',
    'Start',
    'End',
    'Duration (days)',
    'Progress (%)',
    'Predecessors',
    'Resources',
    'Milestone',
    'Critical',
    'Total Float (days)',
    'Free Float (days)',
  ];

  const rows = activities.map((act) => [
    escapeCSVField(act.id),
    escapeCSVField(act.name),
    escapeCSVField(act.wbs || ''),
    escapeCSVField(act.startDate),
    escapeCSVField(act.endDate),
    String(act.duration),
    String(act.percentComplete),
    escapeCSVField(formatPredecessors(act.predecessors)),
    escapeCSVField((act.resources || []).join(', ')),
    act.isMilestone ? 'Yes' : 'No',
    act.isCritical ? 'Yes' : 'No',
    act.totalFloat !== undefined ? String(act.totalFloat) : '',
    act.freeFloat !== undefined ? String(act.freeFloat) : '',
  ]);

  return [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');
}

// ── File Download ───────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
}
