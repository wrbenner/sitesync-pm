import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { pickBestDrawSheet, prepareDrawReportUpload } from './drawReportParser'

function buildWorkbook(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return wb
}

describe('pickBestDrawSheet', () => {
  it('prefers a sheet whose name contains G703', () => {
    const wb = buildWorkbook([
      { name: 'Cover', rows: [['Title', 'Pay App']] },
      {
        name: 'G703 Continuation',
        rows: [
          ['Item', 'Description', 'Scheduled Value'],
          ['1', 'Concrete', 50_000],
        ],
      },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('G703 Continuation')
    expect(pick.score).toBeGreaterThan(0)
    expect(pick.reason).toMatch(/g703|continuation/)
  })

  it('detects a sheet by SOV name keyword', () => {
    const wb = buildWorkbook([
      { name: 'Notes', rows: [['Just text']] },
      { name: 'SOV', rows: [['anything']] },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('SOV')
  })

  it('boosts a sheet by header term matches', () => {
    const wb = buildWorkbook([
      { name: 'Tab1', rows: [['No relevant terms here']] },
      {
        name: 'Tab2',
        rows: [
          [
            'Item Description',
            'Scheduled Value',
            'Work Completed',
            'Materials Stored',
            'Total Completed',
            'Balance to Finish',
            'Retainage',
          ],
        ],
      },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('Tab2')
    expect(pick.reason).toMatch(/G703 header matches/)
  })

  it('uses dollar-value density as a tiebreaker', () => {
    // Both sheets have the same name signal (zero) — Tab2 wins on dollar density.
    const dollarRows: unknown[][] = []
    for (let i = 0; i < 30; i++) dollarRows.push([i, `Line ${i}`, 1000 + i])
    const wb = buildWorkbook([
      { name: 'Tab1', rows: [['x']] },
      { name: 'Tab2', rows: dollarRows },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('Tab2')
    expect(pick.reason).toMatch(/dollar values/)
  })

  it('falls back to the first sheet when no signals are present', () => {
    const wb = buildWorkbook([
      { name: 'A', rows: [['just text']] },
      { name: 'B', rows: [['more text']] },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('A')
    expect(pick.score).toBe(0)
  })

  it('combines name and header signals additively', () => {
    const wb = buildWorkbook([
      {
        name: 'Cover',
        rows: [['Item Description', 'Scheduled Value', 'Retainage']],
      },
      {
        name: 'G703',
        rows: [['Item Description', 'Scheduled Value', 'Retainage']],
      },
    ])
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('G703')
  })

  it('handles workbooks with empty sheets', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, {} as XLSX.Sheet, 'Empty')
    const pick = pickBestDrawSheet(wb)
    expect(pick.sheetName).toBe('Empty')
  })
})

describe('prepareDrawReportUpload', () => {
  it('rejects unsupported file types', async () => {
    const file = new File(['hello'], 'budget.txt', { type: 'text/plain' })
    await expect(prepareDrawReportUpload(file)).rejects.toThrow(
      /Unsupported file type/,
    )
  })

  it('rejects files with no extension and no MIME', async () => {
    const file = new File(['x'], 'noext', { type: '' })
    await expect(prepareDrawReportUpload(file)).rejects.toThrow(
      /Unsupported file type/,
    )
  })
})
