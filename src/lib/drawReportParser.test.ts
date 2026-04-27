import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { pickBestDrawSheet } from './drawReportParser'

// Build a minimal XLSX workbook in memory from sheet name → 2-D array data.
// Avoids fixture files; keeps tests pure-logic.
function makeWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return wb
}

describe('pickBestDrawSheet — empty / single-sheet workbooks', () => {
  it('falls back to the first sheet name with score=0 when no signals at all', () => {
    const wb = makeWorkbook({ 'Cover': [['hello world']] })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('Cover')
    expect(r.score).toBe(0)
  })

  it('zero-sheet workbook returns empty sheetName + score 0 (defensive default)', () => {
    const wb = XLSX.utils.book_new()
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('')
    expect(r.score).toBe(0)
  })
})

describe('pickBestDrawSheet — name hints', () => {
  it('sheet named "G703" gets +30 score from the g703 name hint (3 * 10 multiplier)', () => {
    const wb = makeWorkbook({ 'Cover': [['x']], 'G703': [['x']] })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('G703')
    expect(r.reason).toContain('"g703"')
    // headerMatches=3 → score=3*10=30 (no dollar values)
    expect(r.score).toBe(30)
  })

  it('sheet named "Continuation Sheet" wins via the continuation name hint', () => {
    const wb = makeWorkbook({ 'Cover': [['x']], 'Continuation Sheet': [['x']] })
    expect(pickBestDrawSheet(wb).sheetName).toBe('Continuation Sheet')
  })

  it('sheet named "SOV" (schedule of values) wins via the sov name hint', () => {
    const wb = makeWorkbook({ 'Cover': [['x']], 'SOV': [['x']] })
    expect(pickBestDrawSheet(wb).sheetName).toBe('SOV')
  })

  it('"Draw" / "Pay App" / "Requisition" each contribute +20 (2 * 10 multiplier)', () => {
    const wb = makeWorkbook({ 'Pay App April': [['x']], 'Other': [['x']] })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('Pay App April')
    expect(r.score).toBe(20)
  })
})

describe('pickBestDrawSheet — header term matches', () => {
  it('a sheet with G703 header terms beats a sheet with none', () => {
    const wb = makeWorkbook({
      'Boring': [['Hello', 'World'], ['no', 'signal']],
      'G703-ish': [
        ['Item', 'Description', 'Scheduled Value', 'Work Completed', 'Materials Stored', 'Retainage'],
      ],
    })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('G703-ish')
    // 4 G703 header terms × 10 = 40
    expect(r.score).toBeGreaterThanOrEqual(40)
  })

  it('header term matching is case-insensitive', () => {
    const wb = makeWorkbook({
      'Boring': [['x']],
      'G703-ish': [['SCHEDULED VALUE', 'WORK COMPLETED', 'RETAINAGE']],
    })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('G703-ish')
  })

  it('one row scoring at most one header match per cell (terms inside the same cell only count once)', () => {
    // "Scheduled Value" + "Work Completed" + "Retainage" — three SEPARATE cells → 3 matches × 10 = 30
    const wb = makeWorkbook({
      'Boring': [['x']],
      'A': [['Scheduled Value', 'Work Completed', 'Retainage']],
    })
    expect(pickBestDrawSheet(wb).score).toBeGreaterThanOrEqual(30)
  })
})

describe('pickBestDrawSheet — dollar-value density', () => {
  it('a sheet with > 20 dollar values bumps score by Math.min(dollarValues, 100)', () => {
    // 25 numeric cells > 100 → +25 score
    const rows: unknown[][] = []
    for (let i = 0; i < 25; i++) rows.push([1000 + i])
    const wb = makeWorkbook({ 'Cover': [['x']], 'Money': rows })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('Money')
    expect(r.score).toBeGreaterThanOrEqual(25)
    expect(r.reason).toContain('25 dollar values')
  })

  it('numbers <= 100 do NOT count as dollar values (filters out item numbers)', () => {
    const rows: unknown[][] = []
    for (let i = 0; i < 25; i++) rows.push([50])
    const wb = makeWorkbook({ 'Items': rows })
    expect(pickBestDrawSheet(wb).score).toBe(0)
  })

  it('dollar-value density is reported only when > 20 (filters noise)', () => {
    const rows: unknown[][] = []
    for (let i = 0; i < 5; i++) rows.push([1000 + i])
    const wb = makeWorkbook({ 'Few': rows })
    const r = pickBestDrawSheet(wb)
    expect(r.reason).not.toContain('dollar values')
  })

  it('dollar-value bonus caps at 100 even with thousands of cells', () => {
    const rows: unknown[][] = []
    // 200 dollar cells → bonus capped at 100
    for (let i = 0; i < 200; i++) rows.push([1000 + i])
    const wb = makeWorkbook({ 'Massive': rows })
    expect(pickBestDrawSheet(wb).score).toBeLessThanOrEqual(100)
  })
})

describe('pickBestDrawSheet — composite winner selection', () => {
  it('a real G703 sheet (name hint + header matches + many dollar values) beats every other sheet', () => {
    const g703Rows: unknown[][] = [
      ['Item', 'Description', 'Scheduled Value', 'Work Completed', 'Materials Stored', 'Retainage', 'Balance to Finish'],
    ]
    for (let i = 0; i < 30; i++) g703Rows.push([i + 1, `Line ${i}`, 5000 + i, 1500 + i, 0, 200, 3000 + i])

    const wb = makeWorkbook({
      'Cover Page': [['Project info']],
      'Backup':     [['scratch values']],
      'G703':       g703Rows,
      'Random':     [['noise']],
    })
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('G703')
    // name(+30) + headers(+~50–60) + dollars(>=100 or so) — well above other sheets
    expect(r.score).toBeGreaterThan(60)
  })

  it('reason string captures the top contributing signals (debuggable)', () => {
    const rows: unknown[][] = [['Scheduled Value', 'Work Completed', 'Retainage']]
    for (let i = 0; i < 30; i++) rows.push([i, 5000 + i, 250])
    const wb = makeWorkbook({ 'X': rows })
    const r = pickBestDrawSheet(wb)
    expect(r.reason).toMatch(/G703 header matches/)
    expect(r.reason).toMatch(/dollar values/)
  })

  it('sheets without a !ref are skipped (no crash on malformed XLSX)', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['x']])
    delete ws['!ref']
    XLSX.utils.book_append_sheet(wb, ws, 'Broken')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Scheduled Value']]), 'Good')
    const r = pickBestDrawSheet(wb)
    expect(r.sheetName).toBe('Good')
  })
})
