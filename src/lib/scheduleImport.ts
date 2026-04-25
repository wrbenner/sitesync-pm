// SiteSync PM — Schedule Import Parser
// Handles Primavera P6 (.xer), MS Project (.xml), and CSV formats.
// Pure frontend parsing — no Java/WASM dependencies.

// ── Types ───────────────────────────────────────────────────

export interface ImportedActivity {
  id: string;
  name: string;
  wbs?: string;
  startDate: string;   // ISO date
  endDate: string;     // ISO date
  duration: number;    // days
  percentComplete: number;
  predecessors: Array<{
    activityId: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    lag: number;  // days
  }>;
  resources?: string[];
  isCritical?: boolean;
  isMilestone?: boolean;
  isBehind?: boolean;
  calendarId?: string;
  totalFloat?: number;
  freeFloat?: number;
}

export interface ImportResult {
  activities: ImportedActivity[];
  calendars: Array<{ id: string; name: string }>;
  projectName: string;
  dataDate: string;
  warnings: string[];
  format: 'xer' | 'msp_xml' | 'csv' | 'pdf';
}

// ── Format Detection ────────────────────────────────────────

export function detectFormat(content: string): 'xer' | 'msp_xml' | 'csv' {
  const trimmed = content.trimStart();

  // XER files start with "ERMHDR" line
  if (trimmed.startsWith('ERMHDR')) {
    return 'xer';
  }

  // MS Project XML starts with XML declaration or <Project> root
  if (
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<Project') ||
    /<Project[\s>]/i.test(trimmed.substring(0, 500))
  ) {
    return 'msp_xml';
  }

  // Default to CSV
  return 'csv';
}

// ── XER Parser (Primavera P6) ───────────────────────────────
// XER is a tab-delimited text format with table markers:
//   %T <TableName>
//   %F <field1> <field2> ...
//   %R <value1> <value2> ...

interface XERTable {
  name: string;
  fields: string[];
  rows: Record<string, string>[];
}

function parseXERTables(text: string): Map<string, XERTable> {
  const tables = new Map<string, XERTable>();
  const lines = text.split(/\r?\n/);
  let currentTable: XERTable | null = null;

  for (const line of lines) {
    if (line.startsWith('%T')) {
      // Table declaration
      const tableName = line.substring(2).trim();
      currentTable = { name: tableName, fields: [], rows: [] };
      tables.set(tableName, currentTable);
    } else if (line.startsWith('%F') && currentTable) {
      // Field names
      currentTable.fields = line.substring(2).trim().split('\t');
    } else if (line.startsWith('%R') && currentTable) {
      // Row data
      const values = line.substring(2).trim().split('\t');
      const row: Record<string, string> = {};
      currentTable.fields.forEach((field, idx) => {
        row[field] = values[idx] ?? '';
      });
      currentTable.rows.push(row);
    }
    // %E marks end of table — we just move on
  }

  return tables;
}

/** Map P6 relationship type codes to standard abbreviations */
function mapP6RelType(code: string): 'FS' | 'SS' | 'FF' | 'SF' {
  const map: Record<string, 'FS' | 'SS' | 'FF' | 'SF'> = {
    PR_FS: 'FS',
    PR_SS: 'SS',
    PR_FF: 'FF',
    PR_SF: 'SF',
    FS: 'FS',
    SS: 'SS',
    FF: 'FF',
    SF: 'SF',
  };
  return map[code] ?? 'FS';
}

/** Parse a P6-style date string (yyyy-mm-dd hh:mm or similar) to ISO date */
function parseP6Date(dateStr: string): string {
  if (!dateStr) return '';
  // P6 dates can be in various formats. Try common ones.
  const cleaned = dateStr.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10);
  }
  // Try parsing as date
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return cleaned;
}

export function parseXER(text: string): ImportResult {
  const warnings: string[] = [];
  const tables = parseXERTables(text);

  // Extract project info
  const projectTable = tables.get('PROJECT');
  let projectName = 'Imported Project';
  let dataDate = new Date().toISOString().substring(0, 10);

  if (projectTable && projectTable.rows.length > 0) {
    const proj = projectTable.rows[0];
    projectName = proj['proj_short_name'] || proj['project_name'] || proj['proj_long_name'] || projectName;
    if (proj['last_recalc_date']) {
      dataDate = parseP6Date(proj['last_recalc_date']);
    }
  } else {
    warnings.push('PROJECT table not found — using default project name.');
  }

  // Extract calendars
  const calendarTable = tables.get('CALENDAR');
  const calendars: Array<{ id: string; name: string }> = [];
  if (calendarTable) {
    for (const row of calendarTable.rows) {
      calendars.push({
        id: row['clndr_id'] || '',
        name: row['clndr_name'] || `Calendar ${row['clndr_id'] || 'Unknown'}`,
      });
    }
  }

  // Extract WBS codes for lookup
  const wbsTable = tables.get('PROJWBS');
  const wbsMap = new Map<string, string>();
  if (wbsTable) {
    for (const row of wbsTable.rows) {
      const wbsId = row['wbs_id'] || '';
      const wbsCode = row['wbs_short_name'] || row['wbs_name'] || '';
      wbsMap.set(wbsId, wbsCode);
    }
  }

  // Extract predecessors
  const predTable = tables.get('TASKPRED');
  const predMap = new Map<string, Array<{ activityId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }>>();
  if (predTable) {
    for (const row of predTable.rows) {
      const taskId = row['task_id'] || '';
      const predTaskId = row['pred_task_id'] || '';
      const predType = mapP6RelType(row['pred_type'] || 'PR_FS');
      const lag = parseFloat(row['lag_hr_cnt'] || '0') / 8; // hours to days

      if (!predMap.has(taskId)) {
        predMap.set(taskId, []);
      }
      predMap.get(taskId)!.push({
        activityId: predTaskId,
        type: predType,
        lag: Math.round(lag * 100) / 100,
      });
    }
  }

  // Extract resource assignments
  const rsrcTable = tables.get('TASKRSRC');
  const rsrcMap = new Map<string, string[]>();
  if (rsrcTable) {
    for (const row of rsrcTable.rows) {
      const taskId = row['task_id'] || '';
      const rsrcName = row['rsrc_name'] || row['rsrc_short_name'] || '';
      if (rsrcName) {
        if (!rsrcMap.has(taskId)) {
          rsrcMap.set(taskId, []);
        }
        rsrcMap.get(taskId)!.push(rsrcName);
      }
    }
  }

  // Extract activities from TASK table
  const taskTable = tables.get('TASK');
  const activities: ImportedActivity[] = [];

  if (taskTable) {
    for (const row of taskTable.rows) {
      const taskId = row['task_id'] || '';
      const taskCode = row['task_code'] || taskId;
      const taskName = row['task_name'] || 'Unnamed Activity';
      const taskType = row['task_type'] || '';
      const wbsId = row['wbs_id'] || '';

      const startDate = parseP6Date(
        row['act_start_date'] || row['early_start_date'] || row['target_start_date'] || ''
      );
      const endDate = parseP6Date(
        row['act_end_date'] || row['early_end_date'] || row['target_end_date'] || ''
      );

      const durationHours = parseFloat(row['target_drtn_hr_cnt'] || row['remain_drtn_hr_cnt'] || '0');
      const duration = Math.round((durationHours / 8) * 100) / 100;

      const pctComplete = parseFloat(row['phys_complete_pct'] || row['complete_pct'] || '0');

      const totalFloat = row['total_float_hr_cnt'] !== undefined
        ? parseFloat(row['total_float_hr_cnt'] || '0') / 8
        : undefined;
      const freeFloat = row['free_float_hr_cnt'] !== undefined
        ? parseFloat(row['free_float_hr_cnt'] || '0') / 8
        : undefined;

      const isMilestone = taskType === 'TT_Mile' ||
        taskType === 'TT_FinMile' ||
        duration === 0;

      const isCritical = totalFloat !== undefined && totalFloat <= 0;

      activities.push({
        id: taskCode,
        name: taskName,
        wbs: wbsMap.get(wbsId) || undefined,
        startDate,
        endDate,
        duration,
        percentComplete: pctComplete,
        predecessors: predMap.get(taskId) || [],
        resources: rsrcMap.get(taskId) || undefined,
        isCritical,
        isMilestone,
        calendarId: row['clndr_id'] || undefined,
        totalFloat: totalFloat !== undefined ? Math.round(totalFloat * 100) / 100 : undefined,
        freeFloat: freeFloat !== undefined ? Math.round(freeFloat * 100) / 100 : undefined,
      });
    }
  } else {
    warnings.push('TASK table not found in XER file.');
  }

  if (activities.length === 0) {
    warnings.push('No activities were parsed from the file.');
  }

  return {
    activities,
    calendars,
    projectName,
    dataDate,
    warnings,
    format: 'xer',
  };
}

// ── MS Project XML Parser ───────────────────────────────────

/** Parse ISO 8601 duration like PT8H0M0S or PT40H0M0S into days */
function parseMSPDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/PT(\d+)H(\d+)M(\d+)S/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return Math.round(((hours + minutes / 60) / 8) * 100) / 100;
  }
  // Try simple number
  const num = parseFloat(durationStr);
  if (!isNaN(num)) return num;
  return 0;
}

/** Get text content of a child element by tag name */
function getElementText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? '';
}

/** Map MSP predecessor type number to abbreviation */
function mapMSPLinkType(typeNum: string): 'FS' | 'SS' | 'FF' | 'SF' {
  const map: Record<string, 'FS' | 'SS' | 'FF' | 'SF'> = {
    '0': 'FF',
    '1': 'FS',
    '2': 'SF',
    '3': 'SS',
  };
  return map[typeNum] ?? 'FS';
}

export function parseMSProjectXML(xml: string): ImportResult {
  const warnings: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    warnings.push(`XML parse error: ${parseError.textContent?.substring(0, 200) ?? 'Unknown error'}`);
    return {
      activities: [],
      calendars: [],
      projectName: 'Parse Error',
      dataDate: new Date().toISOString().substring(0, 10),
      warnings,
      format: 'msp_xml',
    };
  }

  // Project info
  const projectEl = doc.getElementsByTagName('Project')[0];
  const projectName = getElementText(projectEl || doc, 'Name') || getElementText(projectEl || doc, 'Title') || 'Imported Project';
  const statusDate = getElementText(projectEl || doc, 'StatusDate');
  const dataDate = statusDate
    ? statusDate.substring(0, 10)
    : new Date().toISOString().substring(0, 10);

  // Calendars
  const calendars: Array<{ id: string; name: string }> = [];
  const calendarEls = doc.getElementsByTagName('Calendar');
  for (let i = 0; i < calendarEls.length; i++) {
    const cal = calendarEls[i];
    const uid = getElementText(cal, 'UID');
    const name = getElementText(cal, 'Name');
    if (uid) {
      calendars.push({ id: uid, name: name || `Calendar ${uid}` });
    }
  }

  // Build UID-to-ID map for predecessor resolution
  const uidToId = new Map<string, string>();
  const taskEls = doc.getElementsByTagName('Task');

  // First pass: build UID map
  for (let i = 0; i < taskEls.length; i++) {
    const task = taskEls[i];
    const uid = getElementText(task, 'UID');
    const id = getElementText(task, 'ID');
    if (uid) {
      uidToId.set(uid, id || uid);
    }
  }

  // Second pass: parse activities
  const activities: ImportedActivity[] = [];

  for (let i = 0; i < taskEls.length; i++) {
    const task = taskEls[i];
    const uid = getElementText(task, 'UID');
    const name = getElementText(task, 'Name');

    // Skip the project summary task (UID 0)
    if (uid === '0' && !name) continue;

    const startStr = getElementText(task, 'Start');
    const finishStr = getElementText(task, 'Finish');
    const durationStr = getElementText(task, 'Duration');
    const pctComplete = parseFloat(getElementText(task, 'PercentComplete') || '0');
    const isMilestone = getElementText(task, 'Milestone') === '1';
    const isCritical = getElementText(task, 'Critical') === '1';
    const wbs = getElementText(task, 'WBS') || getElementText(task, 'OutlineNumber') || undefined;
    const calendarUID = getElementText(task, 'CalendarUID') || undefined;
    const totalSlack = getElementText(task, 'TotalSlack');
    const freeSlack = getElementText(task, 'FreeSlack');

    const startDate = startStr ? startStr.substring(0, 10) : '';
    const endDate = finishStr ? finishStr.substring(0, 10) : '';
    const duration = parseMSPDuration(durationStr);

    // Parse predecessors
    const predecessors: ImportedActivity['predecessors'] = [];
    const predLinks = task.getElementsByTagName('PredecessorLink');
    for (let j = 0; j < predLinks.length; j++) {
      const link = predLinks[j];
      const predUID = getElementText(link, 'PredecessorUID');
      const linkType = getElementText(link, 'Type');
      const linkLag = getElementText(link, 'LinkLag');

      // MSP stores lag in tenths of minutes; convert to days
      const lagMinutes = parseInt(linkLag || '0', 10) / 10;
      const lagDays = Math.round((lagMinutes / (8 * 60)) * 100) / 100;

      predecessors.push({
        activityId: uidToId.get(predUID) || predUID,
        type: mapMSPLinkType(linkType),
        lag: lagDays,
      });
    }

    activities.push({
      id: uid,
      name: name || `Task ${uid}`,
      wbs,
      startDate,
      endDate,
      duration,
      percentComplete: pctComplete,
      predecessors,
      isCritical,
      isMilestone,
      calendarId: calendarUID,
      totalFloat: totalSlack ? parseMSPDuration(totalSlack) : undefined,
      freeFloat: freeSlack ? parseMSPDuration(freeSlack) : undefined,
    });
  }

  if (activities.length === 0) {
    warnings.push('No tasks found in MS Project XML file.');
  }

  return {
    activities,
    calendars,
    projectName,
    dataDate,
    warnings,
    format: 'msp_xml',
  };
}

// ── CSV Parser ──────────────────────────────────────────────
// Expected columns: Name, Start, End, Duration, Progress, Predecessor
// Flexible: auto-detects column mapping from header row.

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapCSVHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const aliases: Record<string, string[]> = {
    name: ['name', 'taskname', 'activityname', 'activity', 'task', 'description'],
    start: ['start', 'startdate', 'begin', 'begindate', 'earlystart'],
    end: ['end', 'enddate', 'finish', 'finishdate', 'earlyfinish'],
    duration: ['duration', 'dur', 'days', 'originalduration'],
    progress: ['progress', 'percentcomplete', 'pctcomplete', 'complete', 'pct'],
    predecessor: ['predecessor', 'predecessors', 'pred', 'dependency', 'dependencies'],
    wbs: ['wbs', 'wbscode', 'outlinenumber'],
    id: ['id', 'uid', 'taskid', 'activityid', 'code'],
    resources: ['resources', 'resource', 'assignedto', 'assignee'],
  };

  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeHeader(headers[i]);
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.includes(normalized)) {
        map[key] = i;
        break;
      }
    }
  }

  return map;
}

/** Parse predecessor strings like "3FS+2d", "5", "2SS", "4FF-1d" */
function parsePredecessorString(predStr: string): ImportedActivity['predecessors'] {
  if (!predStr) return [];
  const preds: ImportedActivity['predecessors'] = [];
  const parts = predStr.split(/[,;]/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+\.?\d*)?[d]?$/i);
    if (match) {
      preds.push({
        activityId: match[1],
        type: (match[2]?.toUpperCase() as 'FS' | 'SS' | 'FF' | 'SF') || 'FS',
        lag: parseFloat(match[3] || '0'),
      });
    } else {
      // Try just a number
      const numMatch = trimmed.match(/^(\d+)/);
      if (numMatch) {
        preds.push({ activityId: numMatch[1], type: 'FS', lag: 0 });
      }
    }
  }

  return preds;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  // MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  // DD-MMM-YYYY (e.g., 15-Jan-2024)
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dmmMatch = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmmMatch) {
    const m = months[dmmMatch[2].toLowerCase()];
    if (m) return `${dmmMatch[3]}-${m}-${dmmMatch[1].padStart(2, '0')}`;
  }
  // Fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  return trimmed;
}

export function parseCSV(csv: string): ImportResult {
  const warnings: string[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    warnings.push('CSV file appears empty or has no data rows.');
    return {
      activities: [],
      calendars: [],
      projectName: 'CSV Import',
      dataDate: new Date().toISOString().substring(0, 10),
      warnings,
      format: 'csv',
    };
  }

  const headers = parseCSVLine(lines[0]);
  const colMap = mapCSVHeaders(headers);

  if (colMap.name === undefined) {
    // Try to guess: first non-empty text column is name
    warnings.push('Could not identify a "Name" column. Using first column as activity name.');
    colMap.name = 0;
  }

  const activities: ImportedActivity[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const name = values[colMap.name] || '';
    if (!name) continue; // Skip empty rows

    const startDate = colMap.start !== undefined ? parseDate(values[colMap.start] || '') : '';
    const endDate = colMap.end !== undefined ? parseDate(values[colMap.end] || '') : '';

    let duration = 0;
    if (colMap.duration !== undefined) {
      duration = parseFloat(values[colMap.duration] || '0') || 0;
    } else if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        duration = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const pctStr = colMap.progress !== undefined ? values[colMap.progress] || '0' : '0';
    const percentComplete = parseFloat(pctStr.replace('%', '')) || 0;

    const predStr = colMap.predecessor !== undefined ? values[colMap.predecessor] || '' : '';
    const predecessors = parsePredecessorString(predStr);

    const id = colMap.id !== undefined ? values[colMap.id] || String(i) : String(i);
    const wbs = colMap.wbs !== undefined ? values[colMap.wbs] || undefined : undefined;

    const resources = colMap.resources !== undefined && values[colMap.resources]
      ? values[colMap.resources].split(/[,;]/).map((r) => r.trim()).filter(Boolean)
      : undefined;

    activities.push({
      id,
      name,
      wbs,
      startDate,
      endDate,
      duration,
      percentComplete,
      predecessors,
      resources,
      isMilestone: duration === 0 && startDate !== '',
    });
  }

  if (activities.length === 0) {
    warnings.push('No activities were parsed from the CSV file.');
  }

  return {
    activities,
    calendars: [],
    projectName: 'CSV Import',
    dataDate: new Date().toISOString().substring(0, 10),
    warnings,
    format: 'csv',
  };
}

// ── MS Project XML Export ───────────────────────────────────

/** Convert days to PT duration string (e.g., 5 days -> PT40H0M0S) */
function toMSPDuration(days: number): string {
  const hours = Math.round(days * 8);
  return `PT${hours}H0M0S`;
}

/** Map relationship type to MSP link type number */
function toMSPLinkType(type: 'FS' | 'SS' | 'FF' | 'SF'): string {
  const map: Record<string, string> = { FF: '0', FS: '1', SF: '2', SS: '3' };
  return map[type] ?? '1';
}

export function exportToMSProjectXML(activities: ImportedActivity[], projectName: string): string {
  const now = new Date().toISOString();

  // Build UID lookup from activity IDs
  const idToUID = new Map<string, number>();
  activities.forEach((act, idx) => {
    idToUID.set(act.id, idx + 1);
  });

  const tasksXML = activities.map((act, idx) => {
    const uid = idx + 1;
    const startDateTime = act.startDate ? `${act.startDate}T08:00:00` : '';
    const finishDateTime = act.endDate ? `${act.endDate}T17:00:00` : '';

    const predLinks = act.predecessors.map((pred) => {
      const predUID = idToUID.get(pred.activityId) ?? 0;
      const lagTenthMinutes = Math.round(pred.lag * 8 * 60 * 10);
      return `      <PredecessorLink>
        <PredecessorUID>${predUID}</PredecessorUID>
        <Type>${toMSPLinkType(pred.type)}</Type>
        <LinkLag>${lagTenthMinutes}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`;
    }).join('\n');

    return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${escapeXML(act.name)}</Name>
      <WBS>${escapeXML(act.wbs || String(uid))}</WBS>
      <Start>${startDateTime}</Start>
      <Finish>${finishDateTime}</Finish>
      <Duration>${toMSPDuration(act.duration)}</Duration>
      <PercentComplete>${Math.round(act.percentComplete)}</PercentComplete>
      <Milestone>${act.isMilestone ? '1' : '0'}</Milestone>
      <Critical>${act.isCritical ? '1' : '0'}</Critical>
${predLinks}
    </Task>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escapeXML(projectName)}</Name>
  <CreationDate>${now}</CreationDate>
  <StatusDate>${now}</StatusDate>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${escapeXML(projectName)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <OutlineLevel>0</OutlineLevel>
    </Task>
${tasksXML}
  </Tasks>
</Project>`;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
