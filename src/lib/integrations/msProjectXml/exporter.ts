/**
 * MS Project (MSPDI XML) exporter.
 *
 * Emits the minimal viable subset MS Project will load: Project
 * envelope, Tasks (with PredecessorLinks), Resources, Assignments.
 * Dates are converted to MS Project's `YYYY-MM-DDTHH:MM:SS` only at
 * this boundary.
 */

import type { MspSchedule } from '../../../types/integrations';

export function exportMspdi(schedule: MspSchedule): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Project xmlns="http://schemas.microsoft.com/project">');
  lines.push('  <Name>' + esc(schedule.name) + '</Name>');
  lines.push('  <StartDate>' + toMspDate(schedule.startDate) + '</StartDate>');
  if (schedule.finishDate) {
    lines.push('  <FinishDate>' + toMspDate(schedule.finishDate) + '</FinishDate>');
  }

  // Tasks
  lines.push('  <Tasks>');
  for (const t of schedule.tasks) {
    lines.push('    <Task>');
    lines.push('      <UID>' + esc(t.uid) + '</UID>');
    lines.push('      <ID>' + esc(t.id) + '</ID>');
    lines.push('      <Name>' + esc(t.name) + '</Name>');
    lines.push('      <Start>' + toMspDate(t.start) + '</Start>');
    lines.push('      <Finish>' + toMspDate(t.finish) + '</Finish>');
    lines.push('      <PercentComplete>' + t.percentComplete + '</PercentComplete>');
    lines.push('      <OutlineLevel>' + t.outlineLevel + '</OutlineLevel>');
    if (t.duration) lines.push('      <Duration>' + esc(t.duration) + '</Duration>');
    for (const link of schedule.links.filter((l) => l.successorUid === t.uid)) {
      lines.push('      <PredecessorLink>');
      lines.push('        <PredecessorUID>' + esc(link.predecessorUid) + '</PredecessorUID>');
      lines.push('        <Type>' + link.type + '</Type>');
      if (link.lag != null) lines.push('        <LinkLag>' + link.lag + '</LinkLag>');
      lines.push('      </PredecessorLink>');
    }
    lines.push('    </Task>');
  }
  lines.push('  </Tasks>');

  // Resources
  lines.push('  <Resources>');
  for (const r of schedule.resources) {
    lines.push('    <Resource>');
    lines.push('      <UID>' + esc(r.uid) + '</UID>');
    lines.push('      <Name>' + esc(r.name) + '</Name>');
    if (r.type) lines.push('      <Type>' + esc(r.type) + '</Type>');
    if (r.rate != null) lines.push('      <StandardRate>' + r.rate + '</StandardRate>');
    lines.push('    </Resource>');
  }
  lines.push('  </Resources>');

  // Assignments
  lines.push('  <Assignments>');
  for (const a of schedule.assignments) {
    lines.push('    <Assignment>');
    lines.push('      <TaskUID>' + esc(a.taskUid) + '</TaskUID>');
    lines.push('      <ResourceUID>' + esc(a.resourceUid) + '</ResourceUID>');
    lines.push('      <Units>' + a.units + '</Units>');
    lines.push('    </Assignment>');
  }
  lines.push('  </Assignments>');

  lines.push('</Project>');
  return lines.join('\n');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert ISO 8601 (or partial) to MS Project's `YYYY-MM-DDTHH:MM:SS`.
 * - Plain date `YYYY-MM-DD` → append `T00:00:00`.
 * - ISO with timezone → strip trailing Z or +offset to keep
 *   MSPDI's local-naive convention.
 */
function toMspDate(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso + 'T00:00:00';
  // Strip trailing Z or +HH:MM, keep only the seconds portion.
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (m) return m[1];
  return iso;
}
