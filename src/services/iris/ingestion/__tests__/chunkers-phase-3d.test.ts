// ────────────────────────────────────────────────────────────────────────────
// Phase 3d chunker tests — submittal, contract, spreadsheet
// ────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest'
import { chunkSubmittal } from '../chunkers/submittal'
import { chunkContract } from '../chunkers/contract'
import { chunkSpreadsheet } from '../chunkers/spreadsheet'

const filler = (n: number, base = 'Construction work item description '): string => {
  let out = ''
  while (out.length < n) out += base
  return out.slice(0, n)
}

// ── chunkSubmittal ──────────────────────────────────────────────────────────

describe('chunkSubmittal', () => {
  it('emits header + sub-item chunks for a healthy submittal', () => {
    const chunks = chunkSubmittal({
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Curtain wall thermal break assembly',
      status: 'submitted',
      satisfies_spec_section: '07 92 00',
      description: filler(200),
      sub_items: [
        { idx: 1, product_name: 'Thermal break spacer', manufacturer: 'Acme', description: filler(150) },
        { idx: 2, product_name: 'Sealant cartridge', manufacturer: 'Acme', description: filler(150) },
      ],
    })
    const parts = chunks.map((c) => (c.metadata as { part: string }).part)
    expect(parts).toContain('header')
    expect(parts.filter((p) => p === 'sub_item')).toHaveLength(2)
  })

  it('skips empty sub-items', () => {
    const chunks = chunkSubmittal({
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Curtain wall thermal break with extra long descriptive name for the test',
      status: 'submitted',
      sub_items: [
        { idx: 1, product_name: 'A', description: 'short' },
        { idx: 2, product_name: 'B', description: filler(200) },
      ],
    })
    const subItems = chunks.filter((c) => (c.metadata as { part: string }).part === 'sub_item')
    expect(subItems).toHaveLength(1)
  })

  it('tags satisfies_spec in header metadata', () => {
    const chunks = chunkSubmittal({
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Curtain wall thermal break with descriptive name',
      status: 'submitted',
      satisfies_spec_section: '07 92 00',
      description: filler(200),
      sub_items: [],
    })
    const header = chunks.find((c) => (c.metadata as { part: string }).part === 'header')
    expect((header?.metadata as { satisfies_spec: string }).satisfies_spec).toBe('07 92 00')
  })

  it('emits review notes chunk when present', () => {
    const chunks = chunkSubmittal({
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Submittal name with enough words for floor',
      status: 'reviewed',
      review_notes: filler(200, 'Owner reviewed and stamped no exceptions '),
      sub_items: [],
    })
    const review = chunks.find((c) => (c.metadata as { part: string }).part === 'review_notes')
    expect(review).toBeDefined()
    expect(review?.text).toMatch(/^Review:/)
  })

  it('is deterministic', () => {
    const input = {
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Stable name for determinism check across runs',
      status: 'submitted',
      satisfies_spec_section: '07 92 00',
      description: filler(200),
      sub_items: [
        { idx: 1, product_name: 'X', description: filler(150) },
      ],
    }
    expect(chunkSubmittal(input)).toEqual(chunkSubmittal(input))
  })
})

// ── chunkContract ───────────────────────────────────────────────────────────

describe('chunkContract', () => {
  it('emits one chunk per clause', () => {
    const chunks = chunkContract({
      source_id: 'k-1',
      version_hash: 'h1',
      contract_id: 'k-1',
      contract_title: 'Standard AIA A201 General Conditions',
      contract_type: 'aia_a201',
      clauses: [
        { clause_number: '3.2.1', heading: 'Review of Contract Documents', text: filler(200) },
        { clause_number: '3.2.2', heading: 'Errors and Omissions', text: filler(200) },
        { clause_number: '3.2.3', heading: 'Notice to Architect', text: filler(200) },
      ],
    })
    expect(chunks).toHaveLength(3)
  })

  it('attaches clause_number to source_anchor', () => {
    const chunks = chunkContract({
      source_id: 'k-1',
      version_hash: 'h1',
      contract_id: 'k-1',
      contract_title: 'Stable contract title for tests',
      clauses: [{ clause_number: '7.4.1', text: filler(200) }],
    })
    expect(chunks[0].source_anchor).toMatchObject({
      kind: 'contract',
      contract_id: 'k-1',
      clause_number: '7.4.1',
    })
  })

  it('skips empty clauses', () => {
    const chunks = chunkContract({
      source_id: 'k-1',
      version_hash: 'h1',
      contract_id: 'k-1',
      contract_title: 'Title',
      clauses: [
        { clause_number: '1.1', text: '' },
        { clause_number: '1.2', text: '   ' },
        { clause_number: '1.3', text: filler(200) },
      ],
    })
    expect(chunks).toHaveLength(1)
  })

  it('splits very long clauses while keeping clause_number stable', () => {
    const chunks = chunkContract({
      source_id: 'k-1',
      version_hash: 'h1',
      contract_id: 'k-1',
      contract_title: 'Title',
      clauses: [
        { clause_number: '14.2.4', text: filler(20000) },
      ],
    })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      const anchor = c.source_anchor as { clause_number: string }
      expect(anchor.clause_number).toBe('14.2.4')
    }
  })

  it('is deterministic', () => {
    const input = {
      source_id: 'k-1',
      version_hash: 'h1',
      contract_id: 'k-1',
      contract_title: 'Stable title',
      clauses: [{ clause_number: '1', text: filler(200) }],
    }
    expect(chunkContract(input)).toEqual(chunkContract(input))
  })
})

// ── chunkSpreadsheet ────────────────────────────────────────────────────────

describe('chunkSpreadsheet', () => {
  it('emits one chunk per range', () => {
    const chunks = chunkSpreadsheet({
      source_id: 'a-1',
      version_hash: 'h1',
      asset_id: 'a-1',
      file_name: 'Budget.xlsx',
      ranges: [
        { sheet_name: 'Summary', range_a1: 'A1:F30', text: filler(300) },
        { sheet_name: 'Detail', range_a1: 'A1:H200', text: filler(300) },
      ],
    })
    expect(chunks).toHaveLength(2)
  })

  it('attaches sheet_name + range_a1 to source_anchor', () => {
    const chunks = chunkSpreadsheet({
      source_id: 'a-1',
      version_hash: 'h1',
      asset_id: 'a-1',
      ranges: [
        { sheet_name: 'Estimate', range_a1: 'B2:D15', named_range: 'BudgetSummary', text: filler(300) },
      ],
    })
    expect(chunks[0].source_anchor).toMatchObject({
      kind: 'spreadsheet',
      asset_id: 'a-1',
      sheet_name: 'Estimate',
      range_a1: 'B2:D15',
    })
    expect((chunks[0].metadata as { named_range: string }).named_range).toBe('BudgetSummary')
  })

  it('skips empty ranges', () => {
    const chunks = chunkSpreadsheet({
      source_id: 'a-1',
      version_hash: 'h1',
      asset_id: 'a-1',
      ranges: [
        { sheet_name: 'A', range_a1: 'A1', text: '' },
        { sheet_name: 'A', range_a1: 'A2', text: '   ' },
        { sheet_name: 'B', range_a1: 'B1:B10', text: filler(300) },
      ],
    })
    expect(chunks).toHaveLength(1)
  })

  it('is deterministic', () => {
    const input = {
      source_id: 'a-1',
      version_hash: 'h1',
      asset_id: 'a-1',
      ranges: [{ sheet_name: 'S', range_a1: 'A1:Z100', text: filler(300) }],
    }
    expect(chunkSpreadsheet(input)).toEqual(chunkSpreadsheet(input))
  })
})

// ── Determinism + ordinal density across all 3 ──────────────────────────────

describe('Phase 3d chunkers — ordinal density', () => {
  it('chunkSubmittal emits dense ordinals starting at 0', () => {
    const chunks = chunkSubmittal({
      source_id: 'sub-1',
      version_hash: 'h1',
      submittal_id: 'sub-1',
      package_number: 'SUB-014',
      package_name: 'Long enough package name for the floor check',
      status: 'submitted',
      description: filler(200),
      sub_items: [{ idx: 1, product_name: 'X', description: filler(200) }],
      review_notes: filler(200),
    })
    const ords = chunks.map((c) => c.ordinal)
    expect(ords[0]).toBe(0)
    for (let i = 1; i < ords.length; i++) {
      expect(ords[i]).toBe(ords[i - 1] + 1)
    }
  })
})
