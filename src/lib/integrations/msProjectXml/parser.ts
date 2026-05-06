/**
 * MS Project (MSPDI XML) parser.
 *
 * MSPDI is a verbose XML schema. We don't need a full DOM library —
 * a small extractor that walks angle-bracket tokens is enough for
 * the fields we care about. Internally we keep ISO 8601 dates;
 * conversion to MS Project's `YYYY-MM-DDTHH:MM:SS` happens only at
 * the export boundary.
 */

import type {
  MspSchedule,
  MspTask,
  MspResource,
  MspAssignment,
  MspLink,
} from '../../../types/integrations';
import { ok, fail, validationError, type Result } from '../../../services/errors';

export function parseMspdi(xml: string): Result<MspSchedule> {
  if (!xml || typeof xml !== 'string') {
    return fail(validationError('MSPDI content is empty'));
  }
  if (!/<Project[\s>]/.test(xml)) {
    return fail(validationError('Not a Project XML document'));
  }

  const name = textOf(xml, 'Name') ?? 'Unnamed';
  const startDate = textOf(xml, 'StartDate') ?? '';
  const finishDate = textOf(xml, 'FinishDate') ?? undefined;

  const tasks = parseList(xml, 'Tasks', 'Task').map((node): MspTask => ({
    uid: textOf(node, 'UID') ?? '',
    id: textOf(node, 'ID') ?? '',
    name: textOf(node, 'Name') ?? '',
    start: toIso(textOf(node, 'Start') ?? ''),
    finish: toIso(textOf(node, 'Finish') ?? ''),
    duration: textOf(node, 'Duration'),
    percentComplete: numberOrZero(textOf(node, 'PercentComplete')),
    outlineLevel: numberOrZero(textOf(node, 'OutlineLevel')),
  }));

  const links: MspLink[] = [];
  for (const taskNode of parseList(xml, 'Tasks', 'Task')) {
    const uid = textOf(taskNode, 'UID') ?? '';
    for (const pl of allBlocks(taskNode, 'PredecessorLink')) {
      links.push({
        successorUid: uid,
        predecessorUid: textOf(pl, 'PredecessorUID') ?? '',
        type: numberOrZero(textOf(pl, 'Type')),
        lag: textOf(pl, 'LinkLag') ? Number(textOf(pl, 'LinkLag')) : undefined,
      });
    }
  }

  const resources = parseList(xml, 'Resources', 'Resource').map((node): MspResource => ({
    uid: textOf(node, 'UID') ?? '',
    name: textOf(node, 'Name') ?? '',
    type: textOf(node, 'Type') ?? undefined,
    rate: textOf(node, 'StandardRate') ? Number(textOf(node, 'StandardRate')) : undefined,
  }));

  const assignments = parseList(xml, 'Assignments', 'Assignment').map((node): MspAssignment => ({
    taskUid: textOf(node, 'TaskUID') ?? '',
    resourceUid: textOf(node, 'ResourceUID') ?? '',
    units: numberOrZero(textOf(node, 'Units')),
  }));

  return ok({
    name,
    startDate: toIso(startDate),
    finishDate: finishDate ? toIso(finishDate) : undefined,
    tasks,
    resources,
    assignments,
    links,
  });
}

function parseList(xml: string, container: string, tag: string): string[] {
  const containerRe = new RegExp(
    '<' + container + '\\b[^>]*>([\\s\\S]*?)<\\/' + container + '>',
    'i',
  );
  const containerMatch = containerRe.exec(xml);
  if (!containerMatch) return [];
  return allBlocks(containerMatch[1], tag);
}

function allBlocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(
    '<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>',
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function textOf(xml: string, tag: string): string | undefined {
  const re = new RegExp(
    '<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>',
    'i',
  );
  const m = re.exec(xml);
  if (!m) return undefined;
  return decodeXml(m[1].trim());
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function numberOrZero(s: string | undefined): number {
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toIso(s: string): string {
  if (!s) return '';
  return s;
}
