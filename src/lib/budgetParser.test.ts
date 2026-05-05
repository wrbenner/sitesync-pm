import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  detectBudgetSheets,
  detectHeaderRow,
  parseBudgetWorkbook,
  groupByCSIDivision,
  toImportPayload,
  type ParsedBudgetRow,
} from './budgetParser'

function aoaWorkbook(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  return wb
}

const ROW = (over: Partial<ParsedBudgetRow> = {}): ParsedBudgetRow => ({
  rawCode: '03100',
  csiCode: '03',
  csiName: 'Concrete',
  description: 'Cast-in-place foundations',
  budgetAmount: 50_000,
  budgetPerUnit: null,
  budgetPerSF: null,
  qualifications: null,
  aiMapped: false,
  sourceRow: 1,
  isNIC: false,
  ...over,
})

describe('detectBudgetSheets', () => {
  it('scores a sheet with budget keywords higher than a metadata sheet', () => {
    const wb = aoaWorkbook([
      {
        name: 'Setup',
        rows: [
          ['Project', 'Maple Ridge'],
          ['Owner', 'RTG Capital'],
        ],
      },
      {
        name: 'Internal Budget',
        rows: [
          ['CODE', 'DESCRIPTION', 'BUDGET'],
          ['03100', 'Concrete', 50000],
          ['04100', 'Masonry', 75000],
          ['05000', 'Steel', 120000],
          ['06000', 'Wood', 35000],
        ],
      },
    ])
    const candidates = detectBudgetSheets(wb)
    expect(candidates[0].name).toBe('Internal Budget')
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score)
  })

  it('penalises sheets with non-budget names', () => {
    const wb = aoaWorkbook([
      { name: 'Takeoff', rows: [['x', 1]] },
      { name: 'Bid', rows: [['CODE', 'BUDGET'], ['01', 100]] },
    ])
    const cs = detectBudgetSheets(wb)
    const takeoff = cs.find((c) => c.name === 'Takeoff')!
    const bid = cs.find((c) => c.name === 'Bid')!
    expect(bid.score).toBeGreaterThan(takeoff.score)
  })

  it('returns one candidate per sheet sorted by score descending', () => {
    const wb = aoaWorkbook([
      { name: 'A', rows: [['x']] },
      { name: 'B', rows: [['x']] },
      { name: 'C', rows: [['x']] },
    ])
    const cs = detectBudgetSheets(wb)
    expect(cs).toHaveLength(3)
    for (let i = 0; i < cs.length - 1; i++) {
      expect(cs[i].score).toBeGreaterThanOrEqual(cs[i + 1].score)
    }
  })
})

describe('detectHeaderRow', () => {
  it('finds header row when CODE/DESCRIPTION/BUDGET headers are present', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Project Budget', '', ''],
      ['', '', ''],
      ['CODE', 'DESCRIPTION', 'BUDGET'],
      ['03100', 'Concrete', 50000],
    ])
    const range = XLSX.utils.decode_range(ws['!ref']!)
    const result = detectHeaderRow(ws, range)
    expect(result.headerRow).toBe(2)
    expect(result.columns.length).toBeGreaterThan(0)
    const roles = result.columns.map((c) => c.role)
    expect(roles).toContain('description')
    expect(roles).toContain('budget')
  })

  it('returns 0 columns when no recognisable headers exist', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Random', 'Stuff', 'Here'],
      ['Just', 'Numbers', 1],
    ])
    const range = XLSX.utils.decode_range(ws['!ref']!)
    const result = detectHeaderRow(ws, range)
    expect(result.columns.length).toBe(0)
  })
})

describe('parseBudgetWorkbook', () => {
  it('parses a minimal budget into typed rows', () => {
    const wb = aoaWorkbook([
      {
        name: 'Budget',
        rows: [
          ['CODE', 'DESCRIPTION', 'BUDGET'],
          ['03100', 'Concrete foundations', 50_000],
          ['05000', 'Structural steel', 120_000],
        ],
      },
    ])
    const result = parseBudgetWorkbook(wb)
    expect(result.rows.length).toBeGreaterThanOrEqual(2)
    const desc = result.rows.map((r) => r.description)
    expect(desc).toContain('Concrete foundations')
    expect(desc).toContain('Structural steel')
    const amounts = result.rows.map((r) => r.budgetAmount)
    expect(amounts).toContain(50_000)
    expect(amounts).toContain(120_000)
  })

  it('produces a computedTotal that sums non-NIC amounts', () => {
    const wb = aoaWorkbook([
      {
        name: 'Budget',
        rows: [
          ['CODE', 'DESCRIPTION', 'BUDGET'],
          ['03100', 'Concrete', 100_000],
          ['05000', 'Steel', 200_000],
        ],
      },
    ])
    const result = parseBudgetWorkbook(wb)
    const sum = result.rows.reduce(
      (s, r) => (r.isNIC ? s : s + r.budgetAmount),
      0,
    )
    expect(result.computedTotal).toBeCloseTo(sum, 0)
  })

  it('returns warnings as an array (possibly empty)', () => {
    const wb = aoaWorkbook([
      {
        name: 'Budget',
        rows: [
          ['CODE', 'DESCRIPTION', 'BUDGET'],
          ['03100', 'Concrete', 50_000],
        ],
      },
    ])
    const result = parseBudgetWorkbook(wb)
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})

describe('groupByCSIDivision', () => {
  it('groups rows by CSI code', () => {
    const rows = [
      ROW({ csiCode: '03', csiName: 'Concrete', description: 'Footings' }),
      ROW({ csiCode: '03', csiName: 'Concrete', description: 'Slab' }),
      ROW({ csiCode: '05', csiName: 'Metals', description: 'Steel' }),
    ]
    const grouped = groupByCSIDivision(rows)
    expect(grouped.size).toBe(2)
    expect(grouped.get('03 - Concrete')!.length).toBe(2)
    expect(grouped.get('05 - Metals')!.length).toBe(1)
  })

  it('returns an empty map for an empty input', () => {
    expect(groupByCSIDivision([]).size).toBe(0)
  })

  it('preserves insertion order within each group', () => {
    const a = ROW({ csiCode: '03', description: 'A' })
    const b = ROW({ csiCode: '03', description: 'B' })
    const grouped = groupByCSIDivision([a, b])
    const list = grouped.get('03 - Concrete')!
    expect(list[0].description).toBe('A')
    expect(list[1].description).toBe('B')
  })
})

describe('toImportPayload', () => {
  it('maps non-NIC rows to import shape', () => {
    const rows = [
      ROW({ description: 'A', csiCode: '03', budgetAmount: 100 }),
      ROW({ description: 'B', csiCode: '04', budgetAmount: 200 }),
    ]
    const out = toImportPayload(rows)
    expect(out).toEqual([
      { name: 'A', code: '03', budgeted_amount: 100, spent: 0, committed: 0 },
      { name: 'B', code: '04', budgeted_amount: 200, spent: 0, committed: 0 },
    ])
  })

  it('drops NIC rows with zero budget', () => {
    const rows = [
      ROW({ description: 'NIC zero', isNIC: true, budgetAmount: 0 }),
      ROW({ description: 'Live', budgetAmount: 50 }),
    ]
    const out = toImportPayload(rows)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Live')
  })

  it('keeps NIC rows that have a non-zero budget (defensive)', () => {
    const rows = [ROW({ description: 'NIC w/ value', isNIC: true, budgetAmount: 99 })]
    const out = toImportPayload(rows)
    expect(out).toHaveLength(1)
    expect(out[0].budgeted_amount).toBe(99)
  })

  it('returns an empty array for empty input', () => {
    expect(toImportPayload([])).toEqual([])
  })
})
