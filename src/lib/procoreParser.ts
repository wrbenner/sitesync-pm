/**
 * procoreParser.ts — Procore CSV/Excel Data Parser
 *
 * Parses Procore export files (CSV) and maps them to SiteSync entities.
 * Handles status mapping, user resolution, and cross-reference tracking.
 *
 * Procore RFI statuses: Draft, Open, Closed, Closed-Draft
 * SiteSync RFI statuses: draft, open, under_review, answered, closed, void
 *
 * Procore Submittal statuses: Draft, Open, Approved, Approved as Noted,
 *                              Revise and Resubmit, Rejected, Closed
 * SiteSync Submittal statuses: draft, submitted, gc_review, architect_review,
 *                               approved, rejected, resubmit, closed
 */

// ── Types ────────────────────────────────────────────────

export interface ParsedRFI {
  procoreId: string
  number: string
  subject: string
  status: string  // SiteSync status (mapped)
  question: string
  createdBy: string
  dateInitiated: string | null
  dueDate: string | null
  rfiManager: string
  assignees: string[]
  receivedFrom: string
  responsibleContractor: string
  drawingNumber: string
  specSection: string
  location: string
  costCode: string
  costImpact: string | null
  costImpactAmount: number | null
  scheduleImpact: string | null
  scheduleImpactDays: number | null
  isPrivate: boolean
  reference: string
  rawRow: Record<string, string>
}

export interface ParsedSubmittal {
  procoreId: string
  number: string
  revision: number
  title: string
  status: string  // SiteSync status (mapped)
  type: string
  specSection: string
  submittalManager: string
  responsibleContractor: string
  receivedFrom: string
  receivedDate: string | null
  submitByDate: string | null
  requiredOnSiteDate: string | null
  leadTime: number | null
  description: string
  ballInCourt: string
  rawRow: Record<string, string>
}

export interface ParseResult<T> {
  records: T[]
  warnings: string[]
  errors: string[]
  unmappedUsers: string[]
  totalRows: number
  skippedRows: number
}

export interface ColumnMapping {
  sourceColumn: string
  targetField: string
  confidence: number  // 0-1 match confidence
}

// ── Status Mapping ──────────────────────────────────────

const RFI_STATUS_MAP: Record<string, string> = {
  'draft': 'draft',
  'open': 'open',
  'closed': 'closed',
  'closed-draft': 'void',
  'closed draft': 'void',
  // Handle case variations
  'Draft': 'draft',
  'Open': 'open',
  'Closed': 'closed',
  'Closed-Draft': 'void',
}

const SUBMITTAL_STATUS_MAP: Record<string, string> = {
  'draft': 'draft',
  'open': 'submitted',
  'approved': 'approved',
  'approved as noted': 'approved',
  'revise and resubmit': 'resubmit',
  'rejected': 'rejected',
  'closed': 'closed',
  // Handle case variations
  'Draft': 'draft',
  'Open': 'submitted',
  'Approved': 'approved',
  'Approved as Noted': 'approved',
  'Approved As Noted': 'approved',
  'Revise and Resubmit': 'resubmit',
  'Revise And Resubmit': 'resubmit',
  'Rejected': 'rejected',
  'Closed': 'closed',
}

// ── CSV Parser ──────────────────────────────────────────

export function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const records: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const record: Record<string, string> = {}

    for (let j = 0; j < headers.length; j++) {
      record[headers[j].trim()] = (values[j] ?? '').trim()
    }

    records.push(record)
  }

  return records
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

// ── Column Auto-Mapping ─────────────────────────────────

const RFI_COLUMN_ALIASES: Record<string, string[]> = {
  number: ['number', 'rfi number', 'rfi #', 'rfi_number', '#'],
  subject: ['subject', 'title', 'rfi subject', 'description'],
  status: ['status', 'rfi status'],
  question: ['question', 'body', 'description', 'details'],
  createdBy: ['created by', 'creator', 'created_by', 'author'],
  dateInitiated: ['date initiated', 'date_initiated', 'initiated date', 'created date', 'created_at'],
  dueDate: ['due date', 'due_date', 'response due', 'response_due_date'],
  rfiManager: ['rfi manager', 'rfi_manager', 'manager'],
  assignees: ['assignees', 'assigned to', 'assignee', 'assigned_to'],
  receivedFrom: ['received from', 'received_from', 'from', 'originator'],
  responsibleContractor: ['responsible contractor', 'responsible_contractor', 'contractor', 'company'],
  drawingNumber: ['drawing number', 'drawing_number', 'drawing', 'drawing ref'],
  specSection: ['spec section', 'spec_section', 'specification', 'spec'],
  location: ['location', 'area', 'zone'],
  costCode: ['cost code', 'cost_code'],
  costImpact: ['cost impact', 'cost_impact'],
  scheduleImpact: ['schedule impact', 'schedule_impact'],
}

const SUBMITTAL_COLUMN_ALIASES: Record<string, string[]> = {
  number: ['submittal number', 'number', 'submittal #', '#'],
  title: ['submittal title', 'title', 'name', 'description'],
  status: ['submittal status', 'status'],
  type: ['submittal type', 'type'],
  specSection: ['submittal spec section number', 'spec section', 'spec_section'],
  submittalManager: ['submittal manager', 'manager'],
  responsibleContractor: ['responsible contractor name', 'responsible contractor', 'contractor'],
  receivedFrom: ['received from', 'from'],
  receivedDate: ['received date', 'received_date'],
  submitByDate: ['submit by date', 'submit_by_date'],
  requiredOnSiteDate: ['required on-site date', 'required on site date', 'on_site_date'],
  leadTime: ['lead time', 'lead_time'],
  description: ['description', 'details'],
  ballInCourt: ['ball in court', 'ball_in_court', 'bic'],
}

export function autoMapColumns(
  headers: string[],
  aliases: Record<string, string[]>
): ColumnMapping[] {
  const mappings: ColumnMapping[] = []
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim())

  for (const [field, aliasList] of Object.entries(aliases)) {
    let bestMatch = ''
    let bestConfidence = 0

    for (const alias of aliasList) {
      const idx = normalizedHeaders.indexOf(alias.toLowerCase())
      if (idx >= 0) {
        bestMatch = headers[idx]
        bestConfidence = 1.0
        break
      }

      // Fuzzy: check if header contains the alias
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (normalizedHeaders[i].includes(alias.toLowerCase()) && bestConfidence < 0.7) {
          bestMatch = headers[i]
          bestConfidence = 0.7
        }
      }
    }

    if (bestMatch) {
      mappings.push({ sourceColumn: bestMatch, targetField: field, confidence: bestConfidence })
    }
  }

  return mappings
}

// ── RFI Parser ──────────────────────────────────────────

export function parseRFIs(csvText: string): ParseResult<ParsedRFI> {
  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    return { records: [], warnings: [], errors: ['No data rows found in CSV'], unmappedUsers: [], totalRows: 0, skippedRows: 0 }
  }

  const headers = Object.keys(rows[0])
  const mappings = autoMapColumns(headers, RFI_COLUMN_ALIASES)
  const mappingDict: Record<string, string> = {}
  for (const m of mappings) {
    mappingDict[m.targetField] = m.sourceColumn
  }

  const records: ParsedRFI[] = []
  const warnings: string[] = []
  const errors: string[] = []
  const users = new Set<string>()
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const get = (field: string): string => row[mappingDict[field]] ?? ''

    const procoreStatus = get('status')
    const mappedStatus = RFI_STATUS_MAP[procoreStatus] ?? RFI_STATUS_MAP[procoreStatus.toLowerCase()]
    if (!mappedStatus) {
      warnings.push(`Row ${i + 2}: Unknown RFI status "${procoreStatus}", defaulting to "open"`)
    }

    const number = get('number')
    if (!number) {
      skipped++
      continue
    }

    // Track users for mapping
    const createdBy = get('createdBy')
    const rfiManager = get('rfiManager')
    const receivedFrom = get('receivedFrom')
    if (createdBy) users.add(createdBy)
    if (rfiManager) users.add(rfiManager)
    if (receivedFrom) users.add(receivedFrom)

    const costImpactRaw = get('costImpact')
    const scheduleImpactRaw = get('scheduleImpact')

    records.push({
      procoreId: `procore-rfi-${i}`,
      number,
      subject: get('subject'),
      status: mappedStatus ?? 'open',
      question: get('question'),
      createdBy,
      dateInitiated: get('dateInitiated') || null,
      dueDate: get('dueDate') || null,
      rfiManager,
      assignees: get('assignees').split(/[,;]/).map(s => s.trim()).filter(Boolean),
      receivedFrom,
      responsibleContractor: get('responsibleContractor'),
      drawingNumber: get('drawingNumber'),
      specSection: get('specSection'),
      location: get('location'),
      costCode: get('costCode'),
      costImpact: costImpactRaw || null,
      costImpactAmount: null,
      scheduleImpact: scheduleImpactRaw || null,
      scheduleImpactDays: null,
      isPrivate: get('isPrivate')?.toLowerCase() === 'yes' || get('isPrivate')?.toLowerCase() === 'true',
      reference: get('reference') ?? '',
      rawRow: row,
    })
  }

  return {
    records,
    warnings,
    errors,
    unmappedUsers: Array.from(users),
    totalRows: rows.length,
    skippedRows: skipped,
  }
}

// ── Submittal Parser ────────────────────────────────────

export function parseSubmittals(csvText: string): ParseResult<ParsedSubmittal> {
  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    return { records: [], warnings: [], errors: ['No data rows found in CSV'], unmappedUsers: [], totalRows: 0, skippedRows: 0 }
  }

  const headers = Object.keys(rows[0])
  const mappings = autoMapColumns(headers, SUBMITTAL_COLUMN_ALIASES)
  const mappingDict: Record<string, string> = {}
  for (const m of mappings) {
    mappingDict[m.targetField] = m.sourceColumn
  }

  const records: ParsedSubmittal[] = []
  const warnings: string[] = []
  const errors: string[] = []
  const users = new Set<string>()
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const get = (field: string): string => row[mappingDict[field]] ?? ''

    const procoreStatus = get('status')
    const mappedStatus = SUBMITTAL_STATUS_MAP[procoreStatus] ?? SUBMITTAL_STATUS_MAP[procoreStatus.toLowerCase()]
    if (!mappedStatus) {
      warnings.push(`Row ${i + 2}: Unknown submittal status "${procoreStatus}", defaulting to "submitted"`)
    }

    const number = get('number')
    if (!number) {
      skipped++
      continue
    }

    const manager = get('submittalManager')
    const contractor = get('responsibleContractor')
    if (manager) users.add(manager)
    if (contractor) users.add(contractor)

    records.push({
      procoreId: `procore-sub-${i}`,
      number,
      revision: 0,
      title: get('title'),
      status: mappedStatus ?? 'submitted',
      type: get('type'),
      specSection: get('specSection'),
      submittalManager: manager,
      responsibleContractor: contractor,
      receivedFrom: get('receivedFrom'),
      receivedDate: get('receivedDate') || null,
      submitByDate: get('submitByDate') || null,
      requiredOnSiteDate: get('requiredOnSiteDate') || null,
      leadTime: parseInt(get('leadTime')) || null,
      description: get('description'),
      ballInCourt: get('ballInCourt'),
      rawRow: row,
    })
  }

  return {
    records,
    warnings,
    errors,
    unmappedUsers: Array.from(users),
    totalRows: rows.length,
    skippedRows: skipped,
  }
}

// ── Validation ──────────────────────────────────────────

export function validateMigrationCounts(
  procoreCounts: Record<string, number>,
  sitesyncCounts: Record<string, number>
): Array<{ entity: string; procore: number; sitesync: number; match: boolean }> {
  const entities = new Set([...Object.keys(procoreCounts), ...Object.keys(sitesyncCounts)])
  return Array.from(entities).map(entity => ({
    entity,
    procore: procoreCounts[entity] ?? 0,
    sitesync: sitesyncCounts[entity] ?? 0,
    match: procoreCounts[entity] === sitesyncCounts[entity],
  }))
}
