import { describe, it, expect } from 'vitest'
import {
  classifyPdfByFilename,
  looksLikeCoverText,
  parseCoverMetadata,
  mergeCoverMetadata,
} from './pdfClassifier'

// ── classifyPdfByFilename ────────────────────────────────────────

describe('classifyPdfByFilename — spec routing', () => {
  it('matches "Spec Book" through underscore separators (the original bug fix)', () => {
    expect(classifyPdfByFilename('_Spec Book_2025.pdf')).toBe('spec')
    expect(classifyPdfByFilename('ProjectX_Spec_Book.pdf')).toBe('spec')
  })

  it('matches "Specifications"', () => {
    expect(classifyPdfByFilename('Specifications.pdf')).toBe('spec')
    expect(classifyPdfByFilename('Project Specifications.pdf')).toBe('spec')
  })

  it('matches "Specs Index"', () => {
    expect(classifyPdfByFilename('Specs Index.pdf')).toBe('spec')
  })

  it('matches "Specs Sheet"', () => {
    expect(classifyPdfByFilename('Specs Sheet.pdf')).toBe('spec')
  })

  it('matches a filename starting with "specs"', () => {
    expect(classifyPdfByFilename('specs.pdf')).toBe('spec')
  })
})

describe('classifyPdfByFilename — cover routing', () => {
  it('matches "Cover Sheet"', () => {
    expect(classifyPdfByFilename('Cover Sheet.pdf')).toBe('cover')
  })

  it('matches "Front Cover" and "Back Cover"', () => {
    expect(classifyPdfByFilename('Front Cover.pdf')).toBe('cover')
    expect(classifyPdfByFilename('Back Cover.pdf')).toBe('cover')
  })

  it('matches "Title Sheet"', () => {
    expect(classifyPdfByFilename('Title Sheet.pdf')).toBe('cover')
  })

  it('matches "Project Data" / "Project Information"', () => {
    expect(classifyPdfByFilename('Project Data.pdf')).toBe('cover')
    expect(classifyPdfByFilename('Project Information.pdf')).toBe('cover')
  })

  it('matches "Code Summary" / "Code Analysis"', () => {
    expect(classifyPdfByFilename('Code Summary.pdf')).toBe('cover')
    expect(classifyPdfByFilename('Code Analysis.pdf')).toBe('cover')
  })

  it('matches G-001 / G-000 / T-001 AIA project-data sheet numbers', () => {
    expect(classifyPdfByFilename('G-001.pdf')).toBe('cover')
    expect(classifyPdfByFilename('G-000.pdf')).toBe('cover')
    expect(classifyPdfByFilename('T-001.pdf')).toBe('cover')
  })
})

describe('classifyPdfByFilename — drawing fallback', () => {
  it('Random architectural sheets fall through to "drawing"', () => {
    expect(classifyPdfByFilename('A-101 First Floor Plan.pdf')).toBe('drawing')
    expect(classifyPdfByFilename('S-301 Framing Plan.pdf')).toBe('drawing')
  })

  it('A meaningless filename defaults to "drawing"', () => {
    expect(classifyPdfByFilename('document.pdf')).toBe('drawing')
  })
})

// ── looksLikeCoverText ──────────────────────────────────────────

describe('looksLikeCoverText — heuristic threshold', () => {
  it('returns false for empty / unrelated text (zero signals)', () => {
    expect(looksLikeCoverText('Floor plan with door schedule')).toBe(false)
    expect(looksLikeCoverText('')).toBe(false)
  })

  it('returns true with PROJECT DATA + CODE SUMMARY (4 points = clearly a cover)', () => {
    expect(looksLikeCoverText('PROJECT DATA\nCODE SUMMARY')).toBe(true)
  })

  it('returns true when ARCHITECT + OWNER both appear (2 points)', () => {
    expect(looksLikeCoverText('ARCHITECT: HKS\nOWNER: Maple Ridge LLC')).toBe(true)
  })

  it('returns true with TYPE V-A construction + OCCUPANCY R-2 (2 points)', () => {
    expect(looksLikeCoverText('TYPE V-A construction\nOCCUPANCY R-2')).toBe(true)
  })

  it('returns false with only one signal (e.g. just OWNER)', () => {
    expect(looksLikeCoverText('OWNER: someone')).toBe(false)
  })
})

// ── parseCoverMetadata — address parsing ────────────────────────

describe('parseCoverMetadata — address', () => {
  it('extracts street + city + state + ZIP from a canonical postal address', () => {
    const md = parseCoverMetadata('123 Main Street, Raleigh, NC 27601')
    expect(md.street).toBe('123 Main Street')
    expect(md.city).toBe('Raleigh')
    expect(md.state).toBe('NC')
    expect(md.zip).toBe('27601')
    expect(md.address).toBe('123 Main Street, Raleigh, NC 27601')
  })

  it('handles ZIP+4', () => {
    const md = parseCoverMetadata('456 Oak Avenue, Cary, NC 27513-1234')
    expect(md.zip).toBe('27513-1234')
  })

  it('handles abbreviated street suffixes (Blvd, Pkwy, Hwy)', () => {
    const md = parseCoverMetadata('789 First Blvd, Durham, NC 27701')
    expect(md.street).toBe('789 First Blvd')
  })

  it('returns no address fields when input lacks a recognisable address', () => {
    const md = parseCoverMetadata('No address mentioned anywhere here.')
    expect(md.address).toBeUndefined()
    expect(md.zip).toBeUndefined()
  })
})

// ── parseCoverMetadata — code / construction / occupancy ────────

describe('parseCoverMetadata — IBC / occupancy / code edition', () => {
  it('extracts construction type "Type V-A" with letter group', () => {
    const md = parseCoverMetadata('Construction: Type V-A wood frame')
    expect(md.constructionType).toBe('V-A')
  })

  it('extracts construction type "Type III" without letter group', () => {
    const md = parseCoverMetadata('Type III masonry')
    expect(md.constructionType).toBe('III')
  })

  it('extracts occupancy R-2 from "Occupancy: R-2"', () => {
    const md = parseCoverMetadata('Occupancy: R-2 multi-family')
    expect(md.occupancyClassification).toBe('R-2')
  })

  it('extracts occupancy "B" from "Occupancy Group B"', () => {
    const md = parseCoverMetadata('Occupancy Group B office')
    expect(md.occupancyClassification).toBe('B')
  })

  it('extracts code edition "2021 IBC"', () => {
    const md = parseCoverMetadata('Code: 2021 IBC')
    expect(md.codeEdition).toBe('2021 IBC')
  })

  it('extracts code edition "2019 CBC"', () => {
    const md = parseCoverMetadata('Compliance per 2019 CBC, NEC')
    expect(md.codeEdition).toBe('2019 CBC')
  })
})

// ── parseCoverMetadata — area / stories ────────────────────────

describe('parseCoverMetadata — building area + stories', () => {
  it('extracts "140,000 SF" as numeric square footage', () => {
    expect(parseCoverMetadata('Total: 140,000 SF').buildingAreaSqft).toBe(140000)
  })

  it('extracts "85,000 gsf"', () => {
    expect(parseCoverMetadata('Building 85,000 gsf').buildingAreaSqft).toBe(85000)
  })

  it('rejects unreasonably small areas (< 500 sqft is probably a label like "12 sf")', () => {
    expect(parseCoverMetadata('Sample 12 sf').buildingAreaSqft).toBeUndefined()
  })

  it('extracts "5 stories"', () => {
    expect(parseCoverMetadata('Building has 5 stories').numFloors).toBe(5)
  })

  it('extracts "12 floors"', () => {
    expect(parseCoverMetadata('12 floors above grade').numFloors).toBe(12)
  })

  it('rejects unreasonable story counts (>200)', () => {
    expect(parseCoverMetadata('500 stories').numFloors).toBeUndefined()
  })
})

// ── parseCoverMetadata — consultants ────────────────────────────

describe('parseCoverMetadata — consultant block', () => {
  it('extracts inline "ARCHITECT: HKS"', () => {
    const md = parseCoverMetadata('ARCHITECT: HKS Architects')
    expect(md.consultants.architect).toBe('HKS Architects')
  })

  it('extracts label-then-next-line "STRUCTURAL ENGINEER" → "Walter P Moore"', () => {
    const md = parseCoverMetadata('STRUCTURAL ENGINEER\nWalter P Moore')
    expect(md.consultants.structural_engineer).toBe('Walter P Moore')
  })

  it('skips email, phone, url lines while looking for the firm name', () => {
    const md = parseCoverMetadata([
      'OWNER',
      'owner@example.com',
      '(555) 123-4567',
      'https://example.com',
      'Maple Ridge LLC',
    ].join('\n'))
    expect(md.consultants.owner).toBe('Maple Ridge LLC')
  })
})

// ── parseCoverMetadata — confidence + raw text ─────────────────

describe('parseCoverMetadata — confidence + raw text', () => {
  it('confidence is 0 with no extracted fields', () => {
    const md = parseCoverMetadata('No useful content')
    expect(md.confidence).toBe(0)
  })

  it('confidence saturates at 1.0 when all 5+ slots are filled', () => {
    const md = parseCoverMetadata([
      'PROJECT XANADU',
      '123 Main Street, Raleigh, NC 27601',
      'ARCHITECT: HKS',
      'STRUCTURAL ENGINEER: Walter P Moore',
      '85,000 SF',
      '5 stories',
      'Occupancy: R-2',
      'Type V-A',
      '2021 IBC',
    ].join('\n'))
    expect(md.confidence).toBe(1)
  })

  it('rawText is normalised (no \\r\\n; collapsed multiple blank lines)', () => {
    const md = parseCoverMetadata('a\r\nb\n\n\n\nc')
    expect(md.rawText).not.toContain('\r')
    expect(md.rawText).not.toContain('\n\n\n')
  })
})

// ── mergeCoverMetadata ─────────────────────────────────────────

describe('mergeCoverMetadata — non-destructive merge', () => {
  const empty = { consultants: {}, rawText: '', confidence: 0 }

  it('a wins on overlap (a.projectName preferred over b.projectName)', () => {
    const a = { ...empty, projectName: 'A' }
    const b = { ...empty, projectName: 'B' }
    expect(mergeCoverMetadata(a, b).projectName).toBe('A')
  })

  it('b fills gaps where a is undefined', () => {
    const a = { ...empty }
    const b = { ...empty, projectName: 'B', codeEdition: '2021 IBC' }
    const m = mergeCoverMetadata(a, b)
    expect(m.projectName).toBe('B')
    expect(m.codeEdition).toBe('2021 IBC')
  })

  it('consultants merge with a winning on overlapping keys', () => {
    const a = { ...empty, consultants: { architect: 'A-Architects' } }
    const b = { ...empty, consultants: { architect: 'B-Architects', owner: 'B-Owner' } }
    const m = mergeCoverMetadata(a, b)
    expect(m.consultants.architect).toBe('A-Architects')
    expect(m.consultants.owner).toBe('B-Owner')
  })

  it('rawText concatenates a then b with a blank-line separator', () => {
    const a = { ...empty, rawText: 'first' }
    const b = { ...empty, rawText: 'second' }
    expect(mergeCoverMetadata(a, b).rawText).toBe('first\n\nsecond')
  })

  it('confidence takes the MAX of the two inputs', () => {
    const a = { ...empty, confidence: 0.4 }
    const b = { ...empty, confidence: 0.8 }
    expect(mergeCoverMetadata(a, b).confidence).toBe(0.8)
  })
})
