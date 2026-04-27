import { describe, it, expect } from 'vitest'
import {
  classifyPdfByFilename,
  looksLikeCoverText,
  parseCoverMetadata,
  mergeCoverMetadata,
} from './pdfClassifier'

describe('pdfClassifier — classifyPdfByFilename', () => {
  it.each([
    'Spec Book.pdf',
    'Specifications.pdf',
    'specs.pdf',           // ^specs? — must start with "specs"
    '_Spec Book_.pdf',     // separator-tolerance regression case from comment
    'Spec_Sheet.pdf',
    'Specs Index.pdf',
    'Specs List.pdf',
  ])('%s → spec', (name) => {
    expect(classifyPdfByFilename(name)).toBe('spec')
  })

  it.each([
    'Cover.pdf',
    'Front Cover.pdf',
    'Title Sheet.pdf',
    'cover_sheet.pdf',
    'Project Data.pdf',
    'Project Information.pdf',
    'Code Summary.pdf',
    'General Notes.pdf',
    'G-001.pdf',          // AIA general-series sheet number
    'T 0-0-1.pdf',
    'G001.pdf',
  ])('%s → cover', (name) => {
    expect(classifyPdfByFilename(name)).toBe('cover')
  })

  it.each([
    'A-101 Floor Plan.pdf',
    'Arch_IFC_Set.pdf',
    'M-501 HVAC.pdf',
    'random.pdf',
  ])('%s → drawing (default fallback)', (name) => {
    expect(classifyPdfByFilename(name)).toBe('drawing')
  })

  it('matching is case-insensitive', () => {
    expect(classifyPdfByFilename('SPEC BOOK.pdf')).toBe('spec')
    expect(classifyPdfByFilename('cover.pdf')).toBe('cover')
  })

  it('handles dashes and slashes as separators (boundary tokens become words)', () => {
    expect(classifyPdfByFilename('Project-Spec-Book-2026.pdf')).toBe('spec')
    expect(classifyPdfByFilename('drawings/A-101.pdf')).toBe('drawing')
  })
})

describe('pdfClassifier — looksLikeCoverText', () => {
  it('returns true for text with multiple cover signals', () => {
    const text = `
      PROJECT INFORMATION
      ARCHITECT: Acme Architects
      OWNER: Mr. Big
      CODE SUMMARY:
      OCCUPANCY: R-2
    `
    expect(looksLikeCoverText(text)).toBe(true)
  })

  it('returns false for text with too few signals', () => {
    expect(looksLikeCoverText('Floor plan A-101')).toBe(false)
  })

  it('PROJECT DATA + CODE SUMMARY each contribute 2 points (≥2 threshold)', () => {
    expect(looksLikeCoverText('PROJECT DATA')).toBe(true)
    expect(looksLikeCoverText('CODE SUMMARY')).toBe(true)
  })

  it('a single weak signal alone is not enough', () => {
    expect(looksLikeCoverText('ARCHITECT: Smith')).toBe(false)
    expect(looksLikeCoverText('OWNER: Jones')).toBe(false)
  })
})

describe('pdfClassifier — parseCoverMetadata', () => {
  it('extracts a postal address into street/city/state/zip', () => {
    const text = '123 Main Street, Springfield, CA 90210'
    const r = parseCoverMetadata(text)
    expect(r.address).toBeTruthy()
    expect(r.state).toBe('CA')
    expect(r.zip).toBe('90210')
  })

  it('extracts building area with various unit suffixes', () => {
    const text1 = parseCoverMetadata('Total: 140,000 SF')
    expect(text1.buildingAreaSqft).toBe(140_000)

    const text2 = parseCoverMetadata('GSF: 85,000 gsf')
    expect(text2.buildingAreaSqft).toBe(85_000)

    const text3 = parseCoverMetadata('42,500 square feet')
    expect(text3.buildingAreaSqft).toBe(42_500)
  })

  it('extracts story count', () => {
    expect(parseCoverMetadata('5 stories above grade').numFloors).toBe(5)
    expect(parseCoverMetadata('12-story tower').numFloors).toBe(12)
    expect(parseCoverMetadata('3 floors of parking').numFloors).toBe(3)
  })

  it('extracts occupancy classification (IBC group)', () => {
    expect(parseCoverMetadata('Occupancy: R-2').occupancyClassification).toMatch(/R-?2/)
    expect(parseCoverMetadata('Occupancy Group B').occupancyClassification).toMatch(/B/)
  })

  it('extracts construction type', () => {
    const r = parseCoverMetadata('Type V-A wood frame')
    expect(r.constructionType).toMatch(/V/)
  })

  it('extracts code edition', () => {
    expect(parseCoverMetadata('2021 IBC').codeEdition).toMatch(/2021\s+IBC/i)
    expect(parseCoverMetadata('2019 CBC').codeEdition).toMatch(/2019\s+CBC/i)
  })

  it('returns rawText (normalized) so reviewers see what was parsed', () => {
    const r = parseCoverMetadata('Some\r\nproject\r\n\r\n\r\ndata')
    expect(r.rawText).toBeTruthy()
    // Triple+ newlines collapsed to double
    expect(r.rawText).not.toMatch(/\n{3,}/)
  })

  it('returns confidence as a number between 0 and 1', () => {
    const r = parseCoverMetadata('not really a cover sheet')
    expect(r.confidence).toBeGreaterThanOrEqual(0)
    expect(r.confidence).toBeLessThanOrEqual(1)
  })

  it('initialises an empty consultants record when no labels match', () => {
    const r = parseCoverMetadata('just some text')
    expect(r.consultants).toEqual({})
  })
})

describe('pdfClassifier — mergeCoverMetadata', () => {
  function meta(overrides: Partial<Parameters<typeof mergeCoverMetadata>[0]> = {}): Parameters<typeof mergeCoverMetadata>[0] {
    return {
      consultants: {},
      rawText: '',
      confidence: 0,
      ...overrides,
    }
  }

  it('A wins for fields populated in both', () => {
    const a = meta({ projectName: 'A-name' })
    const b = meta({ projectName: 'B-name' })
    expect(mergeCoverMetadata(a, b).projectName).toBe('A-name')
  })

  it('B fills in gaps where A is undefined', () => {
    const a = meta({})
    const b = meta({ projectName: 'B-name', codeEdition: '2021 IBC' })
    const r = mergeCoverMetadata(a, b)
    expect(r.projectName).toBe('B-name')
    expect(r.codeEdition).toBe('2021 IBC')
  })

  it('consultants spread merges A on top of B', () => {
    const a = meta({ consultants: { architect: 'A-Architect' } })
    const b = meta({ consultants: { architect: 'B-Architect', civil_engineer: 'B-Civil' } })
    const r = mergeCoverMetadata(a, b)
    // A wins for architect (same key), B fills civil_engineer
    expect(r.consultants).toEqual({
      architect: 'A-Architect',
      civil_engineer: 'B-Civil',
    })
  })

  it('confidence is the max of A and B', () => {
    const a = meta({ confidence: 0.4 })
    const b = meta({ confidence: 0.7 })
    expect(mergeCoverMetadata(a, b).confidence).toBe(0.7)
  })

  it('rawText concatenates A then B', () => {
    const a = meta({ rawText: 'first' })
    const b = meta({ rawText: 'second' })
    expect(mergeCoverMetadata(a, b).rawText).toBe('first\n\nsecond')
  })
})
