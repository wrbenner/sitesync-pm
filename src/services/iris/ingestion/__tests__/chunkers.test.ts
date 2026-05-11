// ────────────────────────────────────────────────────────────────────────────
// Chunker tests — Phase 3b
// ────────────────────────────────────────────────────────────────────────────
// Pure-function unit tests. No DB, no OpenAI.

import { describe, expect, it } from 'vitest'

import { chunkDrawing, splitByTokenBudget } from '../chunkers/drawing'
import { chunkSpec, detectCsiSections } from '../chunkers/spec'
import { chunkRfi } from '../chunkers/rfi'
import { approxTokens, CHUNK_TOKEN_CEILING } from '../chunkers/types'

// ── splitByTokenBudget ──────────────────────────────────────────────────────

describe('splitByTokenBudget', () => {
  it('returns empty array on empty text', () => {
    expect(splitByTokenBudget('', 100)).toEqual([])
  })

  it('returns single segment when text fits in budget', () => {
    const text = 'short text'
    const result = splitByTokenBudget(text, 100)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe(text)
  })

  it('splits on paragraph boundaries first', () => {
    const para1 = 'A'.repeat(800)
    const para2 = 'B'.repeat(800)
    const text = `${para1}\n\n${para2}`
    // Budget at 300 tokens = 1200 chars. Each para is 800 chars = 200 tokens.
    // Two paras fit in one segment (1600 chars > 1200). So they split.
    const result = splitByTokenBudget(text, 300)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('splits on sentences when a paragraph exceeds budget', () => {
    const sentences = Array(20).fill('This is a long sentence that goes on and on.').join(' ')
    const result = splitByTokenBudget(sentences, 50)
    expect(result.length).toBeGreaterThan(1)
    for (const seg of result) {
      expect(seg.tokens).toBeLessThanOrEqual(80) // small slack for sentence-boundary precision
    }
  })

  it('hard-splits when a single sentence exceeds budget', () => {
    const oneLongSentence = 'X'.repeat(2000) // 500 tokens, no spaces or punctuation
    const result = splitByTokenBudget(oneLongSentence, 100)
    expect(result.length).toBeGreaterThan(1)
  })

  it('every segment respects the budget (with sentence-boundary slack)', () => {
    const text = Array(50).fill('Paragraph text here.').join('\n\n')
    const budget = 100
    const result = splitByTokenBudget(text, budget)
    for (const seg of result) {
      expect(seg.tokens).toBeLessThanOrEqual(budget * 1.5)
    }
  })

  it('approxTokens approximates 4 chars/token', () => {
    expect(approxTokens('1234')).toBe(1)
    expect(approxTokens('12345')).toBe(2)
    expect(approxTokens('')).toBe(0)
  })
})

// ── chunkDrawing ────────────────────────────────────────────────────────────

describe('chunkDrawing', () => {
  it('emits one chunk per sheet when no regions detected', () => {
    const chunks = chunkDrawing({
      drawing_id: 'D-001',
      source_id: 'D-001',
      version_hash: 'v1',
      sheets: [
        { sheet: 'A-101', text: 'Floor plan for level 1. Curtain wall extends along grid line B from column B-2 to B-7. See enlarged details on sheet A-501 for storefront window assemblies and entry vestibule construction.' },
        { sheet: 'A-102', text: 'Floor plan for level 2. Mechanical room is located above grid C-3 with separate roof access via stair tower. Coordinate ductwork with structural beams on sheet S-202.' },
      ],
    })
    expect(chunks).toHaveLength(2)
    expect(chunks[0].source_anchor).toMatchObject({ kind: 'drawing', sheet: 'A-101' })
    expect(chunks[1].source_anchor).toMatchObject({ kind: 'drawing', sheet: 'A-102' })
  })

  it('emits one chunk per region when regions provided', () => {
    const chunks = chunkDrawing({
      drawing_id: 'D-002',
      source_id: 'D-002',
      version_hash: 'v1',
      sheets: [
        {
          sheet: 'A-201',
          text: 'full sheet text for the elevation drawing including curtain wall details and structural connections to the slab edge along grid line C-2 between columns C-2 and C-7',
          regions: [
            { bbox: [10, 20, 100, 200], text: 'Detail callout 1: anchor bolt schedule per spec section 03 30 00 with minimum embedment of 6 inches into the slab. Bolts shall be ASTM F1554 Grade 36 with hot-dip galvanized finish per ASTM A153.' },
            { bbox: [200, 300, 400, 500], text: 'Detail callout 2: continuous waterstop at all construction joints below grade level. PVC waterstop type per spec 03 15 00. Lap joints minimum 6 inches with manufacturer-supplied adhesive.' },
          ],
        },
      ],
    })
    expect(chunks).toHaveLength(2)
    expect(chunks[0].source_anchor).toMatchObject({ kind: 'drawing', sheet: 'A-201' })
    if (chunks[0].source_anchor.kind === 'drawing') {
      expect(chunks[0].source_anchor.bbox).toEqual([10, 20, 100, 200])
    }
  })

  it('drops sub-floor chunks (too short to embed)', () => {
    const chunks = chunkDrawing({
      drawing_id: 'D-003',
      source_id: 'D-003',
      version_hash: 'v1',
      sheets: [{ sheet: 'A-301', text: 'a' }],
    })
    expect(chunks).toHaveLength(0)
  })

  it('produces stable ordinal indices', () => {
    const chunks = chunkDrawing({
      drawing_id: 'D-004',
      source_id: 'D-004',
      version_hash: 'v1',
      sheets: [
        { sheet: 'A-401', text: 'A'.repeat(400) },
        { sheet: 'A-402', text: 'B'.repeat(400) },
        { sheet: 'A-403', text: 'C'.repeat(400) },
      ],
    })
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1, 2])
  })
})

// ── chunkSpec + detectCsiSections ───────────────────────────────────────────

describe('chunkSpec', () => {
  it('emits one chunk per section', () => {
    const chunks = chunkSpec({
      spec_document_id: 'S-001',
      source_id: 'S-001',
      version_hash: 'v1',
      sections: [
        { section: '03 30 00', title: 'Cast-in-place concrete', text: 'Concrete shall conform to ASTM C94/C94M Standard Specification for Ready-Mixed Concrete. Slump shall not exceed 5 inches at point of placement. Air content shall be 5 to 7 percent for exterior exposed concrete. Curing shall continue for a minimum of 7 days at temperatures above 50 degrees Fahrenheit.', page: 12 },
        { section: '05 12 00', title: 'Structural steel', text: 'All structural steel shall conform to ASTM A992 for wide-flange shapes and ASTM A36 for plates and bars. Connections shall be designed per AISC 360-22 Specification for Structural Steel Buildings. Field welding shall be performed by AWS D1.1 qualified welders only.', page: 24 },
      ],
    })
    expect(chunks).toHaveLength(2)
    expect(chunks[0].source_anchor).toMatchObject({ kind: 'spec_section', section: '03 30 00', page: 12 })
    expect(chunks[0].text).toContain('03 30 00')
    expect(chunks[0].text).toContain('Cast-in-place concrete')
  })

  it('skips empty section text', () => {
    const chunks = chunkSpec({
      spec_document_id: 'S-002',
      source_id: 'S-002',
      version_hash: 'v1',
      sections: [
        { section: '03 30 00', text: '   ' },
        { section: '03 40 00', text: 'Precast structural concrete units shall conform to ACI 318 Building Code Requirements for Structural Concrete and ASTM C1116 Standard Specification for Fiber-Reinforced Concrete. Erection tolerances shall comply with PCI MNL-117.' },
      ],
    })
    expect(chunks).toHaveLength(1)
    if (chunks[0].source_anchor.kind === 'spec_section') {
      expect(chunks[0].source_anchor.section).toBe('03 40 00')
    }
  })

  it('splits very long sections into multiple chunks', () => {
    const huge = 'Specification paragraph. '.repeat(2000) // ~50K chars = ~12500 tokens
    const chunks = chunkSpec({
      spec_document_id: 'S-003',
      source_id: 'S-003',
      version_hash: 'v1',
      sections: [{ section: '03 30 00', title: 'Concrete', text: huge }],
    })
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.estimated_token_count).toBeLessThanOrEqual(CHUNK_TOKEN_CEILING * 1.5)
    }
    expect(chunks[0].metadata.part_of_split).toBeDefined()
  })

  it('detectCsiSections finds canonical 6-digit headers', () => {
    const text = 'Some preamble.\n\n03 30 00 Cast-in-place concrete. Body...\n\n05 12 00 Structural steel.'
    const found = detectCsiSections(text)
    expect(found).toHaveLength(2)
    expect(found[0].section).toBe('03 30 00')
    expect(found[1].section).toBe('05 12 00')
  })
})

// ── chunkRfi ────────────────────────────────────────────────────────────────

describe('chunkRfi', () => {
  it('emits body chunk + one per response', () => {
    const chunks = chunkRfi({
      rfi_id: 'rfi-042',
      source_id: 'rfi-042',
      version_hash: 'v1',
      title: 'Curtain wall sealant compatibility with adjacent EIFS substrate',
      body_text: 'Subcontractor asks whether we can substitute Dow 795 silicone sealant for the spec-called Tremco Spectrem 1 on the curtain wall to EIFS transition. Please confirm with the architect of record and provide ASI documentation if approved. Schedule impact would be one week of pre-order lead time savings.',
      responses: [
        { response_idx: 0, text: 'Architect of record confirms Dow 795 is approved as substitution per ASI-005 dated 2026-05-08. Performance is equivalent for the stated assembly. Update submittal package accordingly.', author: 'Casey Architect' },
        { response_idx: 1, text: 'GC: Acknowledged the approval. We are updating the curtain wall submittal package to reflect the Dow 795 substitution. Procurement is pulling the spec-revised version.', author: 'PM' },
      ],
    })
    expect(chunks).toHaveLength(3) // 1 body + 2 responses
    expect(chunks[0].source_anchor).toMatchObject({ kind: 'rfi', rfi_id: 'rfi-042', response_idx: undefined })
    if (chunks[1].source_anchor.kind === 'rfi') {
      expect(chunks[1].source_anchor.response_idx).toBe(0)
    }
    if (chunks[2].source_anchor.kind === 'rfi') {
      expect(chunks[2].source_anchor.response_idx).toBe(1)
    }
  })

  it('drops empty responses', () => {
    const chunks = chunkRfi({
      rfi_id: 'rfi-043',
      source_id: 'rfi-043',
      version_hash: 'v1',
      title: 'Empty thread test with realistic body length',
      body_text: 'Body text describing a request for information about the steel connection detail at column line C-5. Need clarification on weld size and bolt grade per AISC 360 requirements. Drawing S-301 is unclear.',
      responses: [
        { response_idx: 0, text: '   ' },
        { response_idx: 1, text: 'Architect confirms weld size is 1/4 inch fillet all around. Bolt grade is A325-N per the structural notes on sheet S-001. Update detail callout on S-301.' },
      ],
    })
    expect(chunks).toHaveLength(2) // 1 body + 1 non-empty response (the response_idx=0 dropped)
  })

  it('propagates status into metadata', () => {
    const chunks = chunkRfi({
      rfi_id: 'rfi-044',
      source_id: 'rfi-044',
      version_hash: 'v1',
      title: 'Title for the RFI being tracked here',
      body_text: 'A reasonably long body about an open RFI that should be indexed for retrieval and surface in PM searches for unresolved issues. Includes context on schedule impact and downstream coordination needs.',
      responses: [],
      status: 'open',
    })
    expect(chunks[0].metadata.status).toBe('open')
    expect(chunks[0].metadata.part).toBe('body')
  })

  it('returns empty array when neither body nor responses have content', () => {
    const chunks = chunkRfi({
      rfi_id: 'rfi-045',
      source_id: 'rfi-045',
      version_hash: 'v1',
      title: '',
      body_text: '',
      responses: [],
    })
    expect(chunks).toEqual([])
  })
})

// ── deterministic re-runs ───────────────────────────────────────────────────

describe('chunker determinism (re-ingest idempotency)', () => {
  it('chunkDrawing produces identical output across re-runs', () => {
    const input = {
      drawing_id: 'D-100',
      source_id: 'D-100',
      version_hash: 'v1',
      sheets: [
        { sheet: 'A-101', text: 'Floor plan with mechanical room callouts on grid B-2 including diffuser locations and return air grilles. Coordinate with HVAC drawings on sheet M-101 for duct routing and pressure relief paths.' },
        { sheet: 'A-102', text: 'Second floor plan with electrical service entry detail at grid C-1. Conduit drops aligned with structural beams per E-101 power distribution plan. Verify clearances with steel framing.' },
      ],
    }
    const a = chunkDrawing(input)
    const b = chunkDrawing(input)
    expect(b).toEqual(a)
  })

  it('chunkSpec produces identical output across re-runs', () => {
    const input = {
      spec_document_id: 'S-100',
      source_id: 'S-100',
      version_hash: 'v1',
      sections: [{ section: '03 30 00', text: 'Cast-in-place concrete specification body that is long enough to be indexed and retrieved. Includes mix design requirements, placement procedures, curing protocols, and acceptance testing criteria per ACI 318.' }],
    }
    expect(chunkSpec(input)).toEqual(chunkSpec(input))
  })

  it('chunkRfi produces identical output across re-runs', () => {
    const input = {
      rfi_id: 'rfi-100',
      source_id: 'rfi-100',
      version_hash: 'v1',
      title: 'Determinism test RFI with realistic question scope',
      body_text: 'Body text that is long enough to chunk into something meaningful and indexable for retrieval. Asks about clarification on the curtain wall to slab edge connection detail at grid B-5.',
      responses: [{ response_idx: 0, text: 'Response that is long enough as well to surface in retrieval results when a PM later searches for curtain wall connection clarifications and approved substitutions.' }],
    }
    expect(chunkRfi(input)).toEqual(chunkRfi(input))
  })
})
