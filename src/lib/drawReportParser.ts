/**
 * Draw Report Parser — Client-side pre-processing for AIA G702/G703 uploads.
 *
 * The heavy lifting (structured extraction, % complete, per-row confidence)
 * happens in the `extract-draw-report` edge function via Gemini. This module
 * just does the light work of preparing an upload for that call:
 *
 *   - PDF  → read bytes → base64 → send as pdf_base64
 *   - XLSX → score each sheet for G703 shape → flatten the best sheet to
 *            tab-separated text → send as xlsx_text
 *
 * Keeping the structural interpretation in the LLM means we don't have to
 * re-implement xlsx layout heuristics (merged cells, hidden headers, totals
 * rows). Costs a few cents per upload; saves hundreds of lines of parser code.
 */

import * as XLSX from 'xlsx'

// ── Public API ────────────────────────────────────────────────

export interface PrepareResult {
  filename: string
  /**
   * True when the file is a PDF. If pdfText is also present, the edge
   * function should use the text path (3–8s Gemini call). If pdfText is
   * empty/short, a signed URL must be sent for vision fallback (scanned
   * PDFs with no embedded text layer).
   */
  isPdf?: boolean
  /**
   * Text extracted via pdf.js from the PDF's embedded text layer.
   * Cuts extraction latency 5–10× vs. Gemini vision on digital PDFs.
   * Empty string indicates a scanned / image-only PDF that needs vision.
   */
  pdfText?: string
  /** Flattened tab-separated text of the detected G703 sheet. */
  xlsxText?: string
  /** Which sheet we picked, and why. For UI transparency / debugging. */
  sheetHint?: { name: string; score: number; reason: string }
}

/**
 * Extract text layer from a PDF via pdf.js. Runs fully client-side in
 * ~200ms for a modest G702/G703. Returns empty string for scanned PDFs
 * with no embedded text, signaling the caller to fall back to Gemini
 * vision.
 */
async function extractPdfTextFromFile(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('/pdf.worker.min.js', import.meta.url).href
  }
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const pageTexts: string[] = []
  const max = Math.min(pdf.numPages, 200)
  for (let p = 1; p <= max; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // Preserve rough layout: join text items on a page with spaces,
    // separate pages with double newlines. Gemini is excellent at
    // reassembling columnar data from this flat form.
    const pageText = content.items
      .map((it) => ('str' in it ? (it as { str: string }).str : ''))
      .join(' ')
    pageTexts.push(pageText)
  }
  return pageTexts.join('\n\n').trim()
}

/** Minimum text length to trust as a real G703 text layer (vs junk artifacts). */
const TEXT_LAYER_MIN_CHARS = 500

export async function prepareDrawReportUpload(file: File): Promise<PrepareResult> {
  const name = file.name
  const lower = name.toLowerCase()

  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    // Try the fast text-layer path first. Falls back to vision if empty.
    let pdfText = ''
    try {
      pdfText = await extractPdfTextFromFile(file)
    } catch (err) {
      console.warn('[drawReportParser] pdf.js text extraction failed, will use vision fallback', err)
    }
    if (pdfText.length >= TEXT_LAYER_MIN_CHARS) {
      return { filename: name, isPdf: true, pdfText }
    }
    // No usable text layer — caller should send a signed URL and let the
    // edge function do Gemini vision.
    return { filename: name, isPdf: true }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) {
    const buf = await file.arrayBuffer()
    const workbook = XLSX.read(buf, { type: 'array', cellStyles: false })
    const { sheetName, score, reason } = pickBestDrawSheet(workbook)
    const xlsxText = flattenSheetToText(workbook.Sheets[sheetName])
    return {
      filename: name,
      xlsxText,
      sheetHint: { name: sheetName, score, reason },
    }
  }

  throw new Error(
    `Unsupported file type. Please upload a PDF or Excel (.xlsx) draw report.`,
  )
}

// ── Sheet scoring ────────────────────────────────────────────
//
// We look for G703 continuation-sheet signals. Real-world draw reports
// are messy: some files have 5 sheets (cover, SOV, backup, etc.) and the
// G703 can be on any of them. We pick the sheet with the strongest signal.

const G703_HEADER_TERMS = [
  'scheduled value',
  'work completed',
  'materials presently stored',
  'materials stored',
  'total completed',
  'balance to finish',
  'retainage',
  'this period',
  'previous application',
  'from previous',
  '% (g',
  'percent complete',
  'item description',
]

interface SheetScore {
  sheetName: string
  score: number
  reason: string
}

export function pickBestDrawSheet(workbook: XLSX.WorkBook): SheetScore {
  let best: SheetScore = { sheetName: workbook.SheetNames[0] || '', score: 0, reason: 'default' }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    if (!sheet || !sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!ref'])

    let headerMatches = 0
    let dollarValues = 0
    const reasons: string[] = []

    // Name hints
    const nameLower = name.toLowerCase()
    if (nameLower.includes('g703') || nameLower.includes('continuation') || nameLower.includes('sov')) {
      headerMatches += 3
      reasons.push(`name contains "${nameLower.includes('g703') ? 'g703' : nameLower.includes('continuation') ? 'continuation' : 'sov'}"`)
    }
    if (nameLower.includes('draw') || nameLower.includes('pay app') || nameLower.includes('requisition')) {
      headerMatches += 2
      reasons.push(`name suggests draw report`)
    }

    // Header scoring (scan first 30 rows)
    const scanEndRow = Math.min(range.e.r, range.s.r + 30)
    for (let r = range.s.r; r <= scanEndRow; r++) {
      for (let c = range.s.c; c <= Math.min(range.e.c, 30); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (!cell) continue
        const v = String(cell.v ?? '').toLowerCase().trim()
        if (!v) continue
        for (const term of G703_HEADER_TERMS) {
          if (v.includes(term)) {
            headerMatches += 1
            break
          }
        }
      }
    }
    if (headerMatches > 0) reasons.push(`${headerMatches} G703 header matches`)

    // Dollar value density
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= Math.min(range.e.c, 30); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })]
        if (!cell) continue
        if (typeof cell.v === 'number' && Math.abs(cell.v) > 100) dollarValues++
      }
    }
    if (dollarValues > 20) reasons.push(`${dollarValues} dollar values`)

    const score = headerMatches * 10 + Math.min(dollarValues, 100)
    if (score > best.score) {
      best = { sheetName: name, score, reason: reasons.join('; ') || 'no strong signals' }
    }
  }

  return best
}

// ── Sheet flattening ─────────────────────────────────────────
//
// Gemini reads tab-separated rows well — the tabs preserve column
// positions so header alignment is obvious.

function flattenSheetToText(sheet: XLSX.Sheet): string {
  if (!sheet || !sheet['!ref']) return ''
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const lines: string[] = []
  // Cap total rows to keep the prompt within Gemini's window. Real G703s
  // rarely exceed 200 lines; giving 500 rows of headroom is plenty.
  const maxRow = Math.min(range.e.r, range.s.r + 500)
  const maxCol = Math.min(range.e.c, 25)
  for (let r = range.s.r; r <= maxRow; r++) {
    const cells: string[] = []
    let hasAny = false
    for (let c = range.s.c; c <= maxCol; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })]
      const raw = cell?.v
      if (raw === undefined || raw === null || raw === '') {
        cells.push('')
        continue
      }
      hasAny = true
      if (typeof raw === 'number') {
        // Don't over-format — keep raw numeric so Gemini can reason about it.
        cells.push(String(raw))
      } else {
        // Collapse internal tabs/newlines so they don't break the grid.
        cells.push(String(raw).replace(/[\t\r\n]+/g, ' ').trim())
      }
    }
    if (hasAny) lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}
