// ── specBookCsv ─────────────────────────────────────────────────────────
// Pure CSV parser for the project spec book uploader (Phase 2.2).
//
// Accepted columns (header-case insensitive, order-insensitive):
//   section_code (req), section_title (req), division, responsible_party,
//   responsible_email, notes
//
// Returns parsed rows + a list of errors for any malformed rows. Pure
// for testability — the Settings UI calls this then calls the
// upload-spec-book hook.

export interface SpecBookRow {
  section_code: string
  section_title: string
  division: string | null
  responsible_party: string | null
  responsible_email: string | null
  notes: string | null
}

export interface ParseResult {
  rows: SpecBookRow[]
  errors: Array<{ row: number; message: string }>
}

const REQUIRED = ['section_code', 'section_title']

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuote = false
      } else cur += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

export function parseSpecBookCsv(csv: string): ParseResult {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], errors: [{ row: 0, message: 'empty file' }] }

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))
  for (const req of REQUIRED) {
    if (!headerCells.includes(req)) {
      return { rows: [], errors: [{ row: 0, message: `missing required column: ${req}` }] }
    }
  }

  const rows: SpecBookRow[] = []
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const record: Record<string, string> = {}
    for (let c = 0; c < headerCells.length; c++) {
      record[headerCells[c]] = cells[c] ?? ''
    }
    const code = record['section_code']?.trim()
    const title = record['section_title']?.trim()
    if (!code) { errors.push({ row: i + 1, message: 'section_code is required' }); continue }
    if (!title) { errors.push({ row: i + 1, message: 'section_title is required' }); continue }
    rows.push({
      section_code: code,
      section_title: title,
      division: record['division']?.trim() || null,
      responsible_party: record['responsible_party']?.trim() || null,
      responsible_email: record['responsible_email']?.trim() || null,
      notes: record['notes']?.trim() || null,
    })
  }

  return { rows, errors }
}
