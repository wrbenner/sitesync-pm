/**
 * Intelligent Budget Parser
 *
 * Handles messy, real-world construction budget spreadsheets — the kind
 * that GCs actually use. Not the clean CSV fantasy that most importers expect.
 *
 * Tested against: Treymore Construction / RTG Capital "Merrit Crossing" budget
 * with 13 sheets, custom cost codes, merged cells, metadata rows, section totals,
 * "NIC" values, and subcontractor notes scattered throughout.
 *
 * Design philosophy: detect structure automatically, never require the user
 * to manually map columns or clean up their file first.
 */

import * as XLSX from 'xlsx';

// ── Types ────────────────────────────────────────────────────

export interface SheetCandidate {
  name: string;
  index: number;
  score: number;          // 0–100 confidence that this is the budget sheet
  reason: string;         // human-readable explanation of why
  rowCount: number;
  dollarValues: number;   // count of cells that look like dollar amounts
}

export interface DetectedColumn {
  index: number;          // 0-based column index
  header: string;         // detected header text
  role: ColumnRole;
  confidence: number;     // 0–1
}

export type ColumnRole =
  | 'code'
  | 'description'
  | 'budget'
  | 'budget_per_unit'
  | 'budget_per_sf'
  | 'qualifications'
  | 'notes'
  | 'skip';

export interface ParsedBudgetRow {
  /** Raw cost code from the spreadsheet (e.g., "2145", "3020") */
  rawCode: string;
  /** Mapped CSI division code (e.g., "01", "03", "31") */
  csiCode: string;
  /** CSI division name */
  csiName: string;
  /** Line item description from the spreadsheet */
  description: string;
  /** Budget amount in dollars */
  budgetAmount: number;
  /** Budget per unit (if available) */
  budgetPerUnit: number | null;
  /** Budget per SF (if available) */
  budgetPerSF: number | null;
  /** Qualifications / subcontractor notes */
  qualifications: string | null;
  /** Whether the CSI code was auto-mapped (vs found in the spreadsheet) */
  aiMapped: boolean;
  /** Original row index in the spreadsheet (for debugging) */
  sourceRow: number;
  /** Whether this row was flagged as NIC (Not In Contract) */
  isNIC: boolean;
}

export interface ParseResult {
  /** Detected sheet info */
  sheet: SheetCandidate;
  /** Header row index (0-based) */
  headerRow: number;
  /** Detected columns */
  columns: DetectedColumn[];
  /** Parsed line items (excludes totals, metadata, separators) */
  rows: ParsedBudgetRow[];
  /** Section totals found (for verification) */
  sectionTotals: Array<{ name: string; amount: number; rowIndex: number }>;
  /** Metadata extracted from the sheet */
  metadata: Record<string, string>;
  /** Warnings about parsing decisions */
  warnings: string[];
  /** Grand total found in the spreadsheet (for verification) */
  grandTotal: number | null;
  /** Computed total from parsed rows (should match grandTotal) */
  computedTotal: number;
}

// ── Sheet Detection ──────────────────────────────────────────

const BUDGET_SHEET_KEYWORDS: Array<{ term: string; bonus: number }> = [
  { term: 'internal budget', bonus: 40 },   // GC's real budget
  { term: 'budget', bonus: 25 },
  { term: 'cost', bonus: 15 },
  { term: 'estimate', bonus: 20 },
  { term: 'sov', bonus: 20 },
  { term: 'schedule of values', bonus: 25 },
  { term: 'breakdown', bonus: 15 },
  { term: 'bid', bonus: 15 },
  { term: 'pricing', bonus: 15 },
];

const NON_BUDGET_SHEET_KEYWORDS = [
  'info', 'set up', 'setup', 'contract docs', 'alternates',
  'takeoff', 'quantity', 'tdhca', 'bor', 'unit cost',
  'off site', 'offsite',
];

/**
 * Scores each sheet in the workbook for likelihood of being the main budget.
 * Returns all candidates sorted by score (highest first).
 */
export function detectBudgetSheets(workbook: XLSX.WorkBook): SheetCandidate[] {
  const candidates: SheetCandidate[] = [];

  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const name = workbook.SheetNames[i];
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rowCount = range.e.r - range.s.r + 1;

    let score = 0;
    const reasons: string[] = [];

    // Name-based scoring
    const nameLower = name.toLowerCase();
    let _nameMatched = false;
    for (const { term, bonus } of BUDGET_SHEET_KEYWORDS) {
      if (nameLower.includes(term)) {
        score += bonus;
        reasons.push(`name contains "${term}"`);
        _nameMatched = true;
        break;
      }
    }
    for (const kw of NON_BUDGET_SHEET_KEYWORDS) {
      if (nameLower.includes(kw)) {
        score -= 20;
        reasons.push(`name suggests non-budget sheet ("${kw}")`);
      }
    }

    // Content-based scoring: scan for dollar values and budget-like patterns
    let dollarValues = 0;
    let nonZeroDollarValues = 0;
    let codePatterns = 0;
    let totalRows = 0;
    let nicValues = 0;
    const sampleRows = Math.min(rowCount, 80);

    for (let r = range.s.r; r < range.s.r + sampleRows; r++) {
      let hasNumber = false;
      let hasCode = false;
      for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        const val = String(cell.v ?? '');
        // Check for dollar amounts
        if (typeof cell.v === 'number' && Math.abs(cell.v) > 100) {
          dollarValues++;
          nonZeroDollarValues++;
          hasNumber = true;
        }
        if (val.match(/^\$[\d,]+/)) {
          dollarValues++;
          nonZeroDollarValues++;
          hasNumber = true;
        }
        // Check for NIC values
        if (val.toUpperCase() === 'NIC' || val.toUpperCase() === 'N/C') {
          nicValues++;
        }
        // Check for cost code patterns (4-digit numbers)
        if (val.match(/^\d{3,5}$/)) {
          codePatterns++;
          hasCode = true;
        }
        // Check for "TOTAL" rows (strong budget signal)
        if (val.toUpperCase().includes('TOTAL')) {
          totalRows++;
        }
      }
      if (hasNumber && hasCode) score += 1;
    }

    if (dollarValues > 10) {
      score += 20;
      reasons.push(`${dollarValues} dollar values found`);
    }
    // Bonus for sheets with actual non-zero dollar values (not mostly NIC)
    if (nonZeroDollarValues > 20) {
      score += 15;
      reasons.push(`${nonZeroDollarValues} non-zero values`);
    }
    // Penalty for sheets that are mostly NIC
    if (nicValues > 10 && nicValues > nonZeroDollarValues) {
      score -= 15;
      reasons.push(`mostly NIC values (${nicValues})`);
    }
    if (codePatterns > 5) {
      score += 15;
      reasons.push(`${codePatterns} cost code patterns`);
    }
    if (totalRows > 3) {
      score += 15;
      reasons.push(`${totalRows} section totals`);
    }
    if (rowCount > 50) {
      score += 10;
      reasons.push(`${rowCount} rows (substantial data)`);
    }

    candidates.push({
      name,
      index: i,
      score: Math.max(0, score),
      reason: reasons.join('; ') || 'no signals detected',
      rowCount,
      dollarValues: nonZeroDollarValues,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ── Header Detection ─────────────────────────────────────────

const HEADER_KEYWORDS = new Map<string, ColumnRole>([
  ['code', 'code'],
  ['cost code', 'code'],
  ['item', 'code'],
  ['no.', 'code'],
  ['#', 'code'],
  ['description', 'description'],
  ['code description', 'description'],
  ['division', 'description'],
  ['name', 'description'],
  ['item description', 'description'],
  ['scope', 'description'],
  ['category', 'description'],
  ['trade', 'description'],
  ['budget', 'budget'],
  ['amount', 'budget'],
  ['total', 'budget'],
  ['cost', 'budget'],
  ['value', 'budget'],
  ['contract', 'budget'],
  ['original', 'budget'],
  ['estimate', 'budget'],
  ['budget/unit', 'budget_per_unit'],
  ['per unit', 'budget_per_unit'],
  ['$/unit', 'budget_per_unit'],
  ['unit cost', 'budget_per_unit'],
  ['budget/sf', 'budget_per_sf'],
  ['per sf', 'budget_per_sf'],
  ['$/sf', 'budget_per_sf'],
  ['cost/sf', 'budget_per_sf'],
  ['qualifications', 'qualifications'],
  ['quals', 'qualifications'],
  ['notes', 'notes'],
  ['precon', 'notes'],
  ['remarks', 'notes'],
  ['comments', 'notes'],
]);

interface HeaderDetectionResult {
  headerRow: number;
  columns: DetectedColumn[];
}

/**
 * Scans the first 20 rows to find the header row.
 * The header row is the one with the most column-role matches.
 */
export function detectHeaderRow(
  sheet: XLSX.Sheet,
  range: XLSX.Range,
): HeaderDetectionResult {
  let bestRow = 0;
  let bestScore = 0;
  let bestColumns: DetectedColumn[] = [];

  const scanEnd = Math.min(range.s.r + 20, range.e.r);

  for (let r = range.s.r; r <= scanEnd; r++) {
    const columns: DetectedColumn[] = [];
    let rowScore = 0;

    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;

      const val = String(cell.v ?? '').toLowerCase().trim();
      if (!val) continue;

      // Check against header keywords
      let bestMatch: { role: ColumnRole; confidence: number } | null = null;

      for (const [keyword, role] of HEADER_KEYWORDS) {
        if (val === keyword) {
          bestMatch = { role, confidence: 1.0 };
          break;
        }
        if (val.includes(keyword)) {
          const conf = keyword.length / val.length;
          if (!bestMatch || conf > bestMatch.confidence) {
            bestMatch = { role, confidence: Math.max(0.5, conf) };
          }
        }
      }

      if (bestMatch) {
        columns.push({
          index: c,
          header: String(cell.v ?? ''),
          role: bestMatch.role,
          confidence: bestMatch.confidence,
        });
        rowScore += bestMatch.confidence;
      }
    }

    // Must have at least a code or description + budget column
    const hasCodeOrDesc = columns.some(c => c.role === 'code' || c.role === 'description');
    const hasBudget = columns.some(c => c.role === 'budget');

    if (hasCodeOrDesc && hasBudget && rowScore > bestScore) {
      bestScore = rowScore;
      bestRow = r;
      bestColumns = columns;
    }
  }

  // Deduplicate: if multiple columns have the same role, keep highest confidence
  const roleMap = new Map<ColumnRole, DetectedColumn>();
  // Exception: allow multiple 'budget' columns (budget, budget/unit, budget/sf are different roles)
  for (const col of bestColumns) {
    const existing = roleMap.get(col.role);
    if (!existing || col.confidence > existing.confidence) {
      roleMap.set(col.role, col);
    }
  }

  return {
    headerRow: bestRow,
    columns: Array.from(roleMap.values()),
  };
}

// ── Row Classification ───────────────────────────────────────

type RowType = 'line_item' | 'section_total' | 'grand_total' | 'metadata' | 'separator' | 'header' | 'subheader';

function classifyRow(
  cells: Map<number, XLSX.CellObject>,
  columns: DetectedColumn[],
  headerRow: number,
  rowIndex: number,
): RowType {
  if (rowIndex <= headerRow) return 'metadata';

  const _codeCol = columns.find(c => c.role === 'code');
  const budgetCol = columns.find(c => c.role === 'budget');
  const descCol = columns.find(c => c.role === 'description');

  // Get description text (primary signal for row classification)
  const descCell = descCol ? cells.get(descCol.index) : null;
  const descText = String(descCell?.v ?? '').trim().toUpperCase();
  const codeCell = codeCol ? cells.get(codeCol.index) : null;
  const codeText = String(codeCell?.v ?? '').trim();

  // All text (for empty check)
  const allText = Array.from(cells.values())
    .map(c => String(c.v ?? '').trim())
    .join(' ');

  // Completely empty row
  if (allText.trim() === '') return 'separator';

  // Grand total patterns — check description column specifically
  if (descText.match(/^TOTAL\s*(CONST|CONSTRUCTION|PROJECT|CONTRACT|BUILDING)/)) {
    return 'grand_total';
  }
  if (descText.match(/^GRAND\s*TOTAL/)) return 'grand_total';
  // Also check if any cell says "TOTAL CONST..." (for merged cell layouts)
  const allTextUpper = allText.toUpperCase();
  if (allTextUpper.match(/TOTAL\s*(CONST|CONSTRUCTION|PROJECT|CONTRACT|BUILDING)\s*(COST|VALUE|AMOUNT|BUDGET)?/)) {
    return 'grand_total';
  }

  // Section total patterns — "SOMETHING TOTAL" in description column
  // If description ends with or contains "TOTAL", it's a section total — even if it has a code
  // e.g., "3000 GENERAL COND. TOTAL" has code 3000 but is clearly a total row
  if (descText.match(/\bTOTAL\s*$/) || descText.match(/^.+\s+TOTAL\b/)) {
    return 'section_total';
  }

  // Section subtotal patterns without "TOTAL" keyword
  // e.g., "GC / CM FEES" is a subtotal row (matches the amount of one child line item)
  if (!codeText && descText.match(/^(GC\s*\/?\s*CM\s+FEES|SUBTOTAL|SUB-TOTAL)\s*$/)) {
    return 'section_total';
  }

  if (budgetCol) {
    const budgetCell = cells.get(budgetCol.index);
    const budgetVal = budgetCell?.v;
    const descVal = String(descCell?.v ?? '').trim();

    // Sub-header: row right after header with metadata (dates, unit counts)
    if (rowIndex === headerRow + 1 && !codeText.match(/^\d{3,5}$/)) {
      return 'subheader';
    }

    // Section header: has description but no code and no budget value
    if (descVal && !codeText.match(/^\d+$/) && (budgetVal === undefined || budgetVal === null || budgetVal === '')) {
      // Check if it looks like a section header (all caps, short text)
      if (descVal === descVal.toUpperCase() && descVal.length < 40) {
        return 'metadata';
      }
    }

    // Row with a code pattern and/or a budget value = line item
    if (codeText.match(/^\d{3,5}$/) || (typeof budgetVal === 'number' && budgetVal !== 0)) {
      return 'line_item';
    }

    // NIC values are still line items
    if (typeof budgetVal === 'string' && budgetVal.toUpperCase().includes('NIC')) {
      return 'line_item';
    }
  }

  // Check if any cell has a numeric value > 100 (likely a budget line)
  for (const cell of cells.values()) {
    if (typeof cell.v === 'number' && Math.abs(cell.v) > 100) {
      return 'line_item';
    }
  }

  return 'metadata';
}

// ── Cost Code → CSI Mapping ──────────────────────────────────

/**
 * Maps custom contractor cost codes to CSI MasterFormat divisions.
 *
 * Most GCs use internal numbering systems (Treymore uses 2145, 3020, etc.)
 * that don't directly correspond to CSI codes. This mapper uses the section
 * context (what section is this code under?) combined with description
 * keyword matching to assign the right CSI division.
 */

interface SectionContext {
  name: string;
  csiCode: string;
}

const SECTION_TO_CSI: Record<string, string> = {
  'general cond': '01',
  'general conditions': '01',
  'general requirements': '01',
  'sitework': '31',
  'site work': '31',
  'earthwork': '31',
  'concrete': '03',
  'framing': '06',
  'carpentry': '06',
  'wood': '06',
  'masonry': '04',
  'metal': '05',
  'metals': '05',
  'steel': '05',
  'roofing': '07',
  'glass': '08',
  'glazing': '08',
  'hardware': '08',
  'doors': '08',
  'windows': '08',
  'openings': '08',
  'insulation': '07',
  'thermal': '07',
  'waterproofing': '07',
  'painting': '09',
  'finishes': '09',
  'flooring': '09',
  'tile': '09',
  'drywall': '09',
  'appliances': '11',
  'equipment': '11',
  'plumbing': '22',
  'electrical': '26',
  'hvac': '23',
  'mechanical': '23',
  'fire': '21',
  'sprinkler': '21',
  'fire protection': '21',
  'clean-up': '01',
  'cleanup': '01',
  'cleaning': '01',
  'rec': '13',
  'recreational': '13',
  'recreation': '13',
  'rec. facilities': '13',
  'miscellaneous': '10',
  'specialties': '10',
  'window coverings': '12',
  'furnishings': '12',
  'contingency': '01',
  'gc/cm fees': '01',
  'gc fees': '01',
  'cm fees': '01',
  'overhead': '01',
  'profit': '01',
  'insurance': '01',
  'bond': '01',
  'landscape': '32',
  'landscaping': '32',
  'paving': '32',
  'exterior': '32',
  'utilities': '33',
  'elevator': '14',
  'conveying': '14',
  'low voltage': '27',
  'communications': '27',
  'fire alarm': '28',
  'security': '28',
};

const CSI_DIVISION_NAMES: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics & Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '25': 'Integrated Automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
};

function _detectSectionContext(
  sheet: XLSX.Sheet,
  rowIndex: number,
  headerRow: number,
  columns: DetectedColumn[],
): SectionContext | null {
  // Scan backward from this row to find the nearest section total or section header
  const descCol = columns.find(c => c.role === 'description');
  const _codeCol = columns.find(c => c.role === 'code');

  // Scan forward to find the next "TOTAL" row — that tells us our section
  // Use the description column specifically to avoid false matches from numeric cells
  for (let r = rowIndex + 1; r < rowIndex + 60; r++) {
    // Check the description column first
    const dc = descCol ? sheet[XLSX.utils.encode_cell({ r, c: descCol.index })] : null;
    const descText = String(dc?.v ?? '').trim();

    // Also check all cells for merged/shifted layouts
    let scanText = descText;
    if (!descText) {
      for (let c = 0; c <= 6; c++) { // only check first few columns
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          const v = String(cell.v ?? '').trim();
          if (v.toUpperCase().includes('TOTAL')) {
            scanText = v;
            break;
          }
        }
      }
    }

    // Look for "SOMETHING TOTAL" pattern
    const totalMatch = scanText.match(/^(.+?)\s+TOTAL/i);
    if (totalMatch) {
      const sectionName = totalMatch[1].trim().toLowerCase();
      for (const [key, csi] of Object.entries(SECTION_TO_CSI)) {
        if (sectionName.includes(key) || key.includes(sectionName)) {
          return { name: totalMatch[1].trim(), csiCode: csi };
        }
      }
    }
  }

  return null;
}

function mapDescriptionToCSI(description: string): { code: string; name: string } | null {
  const lower = description.toLowerCase();
  for (const [key, csi] of Object.entries(SECTION_TO_CSI)) {
    if (lower.includes(key)) {
      return { code: csi, name: CSI_DIVISION_NAMES[csi] || key };
    }
  }
  return null;
}

// ── Number Parsing ───────────────────────────────────────────

function parseAmount(val: unknown): { amount: number; isNIC: boolean } {
  if (val === null || val === undefined || val === '') {
    return { amount: 0, isNIC: false };
  }
  if (typeof val === 'number') {
    return { amount: val, isNIC: false };
  }
  const str = String(val).trim().toUpperCase();
  if (str === 'NIC' || str === 'N/C' || str === 'N.I.C.' || str === 'NOT IN CONTRACT') {
    return { amount: 0, isNIC: true };
  }
  if (str === '-' || str === '--' || str === 'N/A' || str === 'TBD' || str === 'INCL' || str === 'INCLUDED') {
    return { amount: 0, isNIC: false };
  }
  // Strip currency symbols, commas, spaces
  const cleaned = str.replace(/[$,\s]/g, '');
  // Handle parentheses for negative numbers: (1,234) → -1234
  const parenMatch = cleaned.match(/^\((.+)\)$/);
  if (parenMatch) {
    const num = parseFloat(parenMatch[1]);
    return { amount: isNaN(num) ? 0 : -num, isNIC: false };
  }
  const num = parseFloat(cleaned);
  return { amount: isNaN(num) ? 0 : num, isNIC: false };
}

// ── Metadata Extraction ──────────────────────────────────────

function extractMetadata(
  sheet: XLSX.Sheet,
  range: XLSX.Range,
  headerRow: number,
): Record<string, string> {
  const metadata: Record<string, string> = {};

  // Scan rows above the header for metadata
  for (let r = range.s.r; r < headerRow; r++) {
    const rowValues: string[] = [];
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.v !== undefined && cell.v !== null) {
        rowValues.push(String(cell.v).trim());
      }
    }

    const text = rowValues.join(' | ');
    if (!text) continue;

    // Try to extract key-value pairs
    for (const val of rowValues) {
      if (val.match(/project|job|name/i) && !metadata.projectName) {
        const next = rowValues[rowValues.indexOf(val) + 1];
        if (next && !next.match(/project|job|name/i)) {
          metadata.projectName = next;
        }
      }
      if (val.match(/months?/i)) metadata.duration = val;
      if (val.match(/sales?\s*tax/i)) metadata.salesTax = val;
      if (val.match(/units?/i) && val.match(/\d/)) metadata.units = val;
      if (val.match(/sf|sq\s*ft|square\s*feet/i) && val.match(/\d/)) metadata.squareFeet = val;
    }

    // Company name is usually in the first couple rows
    if (r <= range.s.r + 1 && rowValues.length <= 3 && rowValues[0]?.length > 2) {
      if (!metadata.companyName) {
        metadata.companyName = rowValues[0];
      } else if (!metadata.projectName) {
        metadata.projectName = rowValues[0];
      }
    }
  }

  return metadata;
}

// ── Main Parser ──────────────────────────────────────────────

/**
 * Parse a messy construction budget workbook.
 *
 * @param workbook - XLSX workbook already read
 * @param sheetIndex - specific sheet to parse (auto-detected if omitted)
 */
export function parseBudgetWorkbook(
  workbook: XLSX.WorkBook,
  sheetIndex?: number,
): ParseResult {
  const warnings: string[] = [];

  // 1. Detect which sheet to use
  const candidates = detectBudgetSheets(workbook);
  const selectedSheet = sheetIndex !== undefined
    ? candidates.find(c => c.index === sheetIndex) || candidates[0]
    : candidates[0];

  if (!selectedSheet || selectedSheet.score < 5) {
    // Fall back to first sheet
    warnings.push('Could not confidently detect budget sheet — using first sheet');
  }

  const sheetName = workbook.SheetNames[selectedSheet?.index ?? 0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // 2. Find the header row
  const { headerRow, columns } = detectHeaderRow(sheet, range);

  if (columns.length < 2) {
    warnings.push('Could not detect column layout — results may be inaccurate');
  }

  // 3. Extract metadata from rows above header
  const metadata = extractMetadata(sheet, range, headerRow);

  // 4. Parse each data row
  const rows: ParsedBudgetRow[] = [];
  const sectionTotals: Array<{ name: string; amount: number; rowIndex: number }> = [];
  let grandTotal: number | null = null;

  // Build a section context cache: for each row, what section is it in?
  // We do this by scanning for TOTAL rows and working backward
  const sectionMap = new Map<number, SectionContext>();
  const totalRowIndices: number[] = [];

  // First pass: find all TOTAL rows to establish sections
  const descColRef = columns.find(c => c.role === 'description');
  const codeColRef = columns.find(c => c.role === 'code');

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    // Use description column for TOTAL detection to avoid false matches from numbers
    const dc = descColRef ? sheet[XLSX.utils.encode_cell({ r, c: descColRef.index })] : null;
    let scanText = String(dc?.v ?? '').trim();

    // If description is empty, check the first few text columns
    if (!scanText) {
      for (let c = 0; c <= 6; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          const v = String(cell.v ?? '').trim();
          if (v.toUpperCase().includes('TOTAL')) {
            scanText = v;
            break;
          }
        }
      }
    }

    // Skip rows with valid cost codes — they're line items, not totals
    const cc = codeColRef ? sheet[XLSX.utils.encode_cell({ r, c: codeColRef.index })] : null;
    const ccText = String(cc?.v ?? '').trim();
    if (ccText.match(/^\d{3,5}$/)) continue;

    const totalMatch = scanText.match(/^(.+?)\s+TOTAL/i);
    if (totalMatch) {
      totalRowIndices.push(r);
      const sectionName = totalMatch[1].trim().toLowerCase();
      let csi = '00';
      for (const [key, code] of Object.entries(SECTION_TO_CSI)) {
        if (sectionName.includes(key) || key.includes(sectionName)) {
          csi = code;
          break;
        }
      }
      sectionMap.set(r, { name: totalMatch[1].trim(), csiCode: csi });
    }
  }

  // Build reverse lookup: for any row, find the next TOTAL row to know the section
  function getSectionForRow(rowIdx: number): SectionContext | null {
    for (const totalRow of totalRowIndices) {
      if (totalRow > rowIdx) {
        return sectionMap.get(totalRow) || null;
      }
    }
    return null;
  }

  const _codeCol = columns.find(c => c.role === 'code');
  const descCol = columns.find(c => c.role === 'description');
  const budgetCol = columns.find(c => c.role === 'budget');
  const budgetPerUnitCol = columns.find(c => c.role === 'budget_per_unit');
  const budgetPerSFCol = columns.find(c => c.role === 'budget_per_sf');
  const qualsCol = columns.find(c => c.role === 'qualifications');
  const notesCol = columns.find(c => c.role === 'notes');

  // Second pass: parse data rows
  let foundGrandTotal = false;
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    // Stop parsing after grand total — everything below is summary/metadata
    if (foundGrandTotal) continue;

    const cells = new Map<number, XLSX.CellObject>();
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) cells.set(c, cell);
    }

    const rowType = classifyRow(cells, columns, headerRow, r);

    if (rowType === 'section_total') {
      const allText = Array.from(cells.values())
        .map(c => String(c.v ?? '').trim())
        .join(' ');
      const budgetCell = budgetCol ? cells.get(budgetCol.index) : null;
      const amount = budgetCell ? parseAmount(budgetCell.v).amount : 0;
      sectionTotals.push({ name: allText.trim(), amount, rowIndex: r });
      continue;
    }

    if (rowType === 'grand_total') {
      const budgetCell = budgetCol ? cells.get(budgetCol.index) : null;
      if (budgetCell) {
        grandTotal = parseAmount(budgetCell.v).amount;
      }
      foundGrandTotal = true;
      continue;
    }

    if (rowType !== 'line_item') continue;

    // Extract cell values
    const rawCode = codeCol ? String(cells.get(codeCol.index)?.v ?? '').trim() : '';
    const description = descCol ? String(cells.get(descCol.index)?.v ?? '').trim() : '';

    if (!description && !rawCode) continue;

    const budgetParsed = budgetCol
      ? parseAmount(cells.get(budgetCol.index)?.v)
      : { amount: 0, isNIC: false };

    const budgetPerUnit = budgetPerUnitCol
      ? parseAmount(cells.get(budgetPerUnitCol.index)?.v).amount || null
      : null;
    const budgetPerSF = budgetPerSFCol
      ? parseAmount(cells.get(budgetPerSFCol.index)?.v).amount || null
      : null;

    const quals = qualsCol ? String(cells.get(qualsCol.index)?.v ?? '').trim() || null : null;
    const notes = notesCol ? String(cells.get(notesCol.index)?.v ?? '').trim() || null : null;
    const qualifications = [quals, notes].filter(Boolean).join(' | ') || null;

    // Map to CSI code
    let csiCode = '00';
    let csiName = 'Unclassified';
    let aiMapped = true;

    // Strategy 1: Section context (most reliable for custom code systems)
    const section = getSectionForRow(r);
    if (section) {
      csiCode = section.csiCode;
      csiName = CSI_DIVISION_NAMES[csiCode] || section.name;
    }

    // Strategy 2: Description keyword matching (fallback)
    if (csiCode === '00' && description) {
      const match = mapDescriptionToCSI(description);
      if (match) {
        csiCode = match.code;
        csiName = match.name;
      }
    }

    // Strategy 3: If the raw code looks like a CSI code (01-48), use it directly
    if (rawCode.match(/^(0[1-9]|[1-4][0-9])$/)) {
      csiCode = rawCode;
      csiName = CSI_DIVISION_NAMES[csiCode] || `Division ${csiCode}`;
      aiMapped = false;
    }

    // If code is already CSI-format (XX XX XX or XX-XX-XX)
    if (rawCode.match(/^\d{2}[\s-]\d{2}[\s-]\d{2}$/)) {
      csiCode = rawCode.replace(/[\s-]/g, '').slice(0, 2);
      csiName = CSI_DIVISION_NAMES[csiCode] || `Division ${csiCode}`;
      aiMapped = false;
    }

    rows.push({
      rawCode,
      csiCode,
      csiName,
      description: description || `Code ${rawCode}`,
      budgetAmount: budgetParsed.amount,
      budgetPerUnit,
      budgetPerSF,
      qualifications,
      aiMapped,
      sourceRow: r,
      isNIC: budgetParsed.isNIC,
    });
  }

  // Compute verification totals
  const computedTotal = rows.reduce((s, r) => s + r.budgetAmount, 0);

  if (grandTotal !== null && Math.abs(computedTotal - grandTotal) > 1) {
    const diff = computedTotal - grandTotal;
    const pct = grandTotal !== 0 ? ((diff / grandTotal) * 100).toFixed(1) : '∞';
    warnings.push(
      `Computed total ($${computedTotal.toLocaleString()}) differs from spreadsheet total ($${grandTotal.toLocaleString()}) by $${Math.abs(diff).toLocaleString()} (${pct}%). This usually means some rows were classified as totals or metadata.`
    );
  }

  const nicCount = rows.filter(r => r.isNIC).length;
  if (nicCount > 0) {
    warnings.push(`${nicCount} line items marked as NIC (Not In Contract) — imported with $0 budget`);
  }

  return {
    sheet: selectedSheet || { name: sheetName, index: 0, score: 0, reason: 'default', rowCount: range.e.r + 1, dollarValues: 0 },
    headerRow,
    columns,
    rows,
    sectionTotals,
    metadata,
    warnings,
    grandTotal,
    computedTotal,
  };
}

// ── Helpers for UI ───────────────────────────────────────────

/** Group parsed rows by CSI division for the preview table */
export function groupByCSIDivision(rows: ParsedBudgetRow[]): Map<string, ParsedBudgetRow[]> {
  const groups = new Map<string, ParsedBudgetRow[]>();
  for (const row of rows) {
    const key = `${row.csiCode} - ${row.csiName}`;
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }
  return groups;
}

/** Convert parsed rows to the format expected by budgetService.importDivisionRows */
export function toImportPayload(
  rows: ParsedBudgetRow[],
): Array<{ name: string; code: string; budgeted_amount: number; spent: number; committed: number }> {
  return rows
    .filter(r => !r.isNIC || r.budgetAmount > 0) // include NIC rows only if they somehow have a value
    .map(r => ({
      name: r.description,
      code: r.csiCode,
      budgeted_amount: r.budgetAmount,
      spent: 0,
      committed: 0,
    }));
}
