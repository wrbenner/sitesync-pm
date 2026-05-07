// Phase 5 — submittalDraft service tests.
//
// Covers the pure-function helpers: emptyDraft, buildDraftFromSpec,
// buildDraftFromVoice, buildDraftFromPin, runPreflight.

import { describe, it, expect } from 'vitest'
import {
  emptyDraft,
  buildDraftFromSpec,
  buildDraftFromVoice,
  buildDraftFromPin,
  runPreflight,
} from '../../../services/iris/submittalDraft'

describe('emptyDraft', () => {
  it('defaults source=manual when no arg passed', () => {
    const d = emptyDraft()
    expect(d.source).toBe('manual')
    expect(d.title).toBe('')
    expect(d.is_critical_path).toBe(false)
    expect(d.is_private).toBe(false)
    expect(d.drawing_pin_ids).toEqual([])
    expect(d.attachment_ids).toEqual([])
    expect(d.provenance).toEqual({})
  })
})

describe('buildDraftFromSpec', () => {
  it('seeds csi_section + paragraph + page + kind + title with spec provenance', () => {
    const d = buildDraftFromSpec({
      csi_section: '08 41 13',
      spec_section_paragraph: '§2.04.B.3',
      spec_pdf_page: 47,
      inferred_kind: 'shop_drawing',
      inferred_title: 'Aluminum-Framed Storefronts',
    })
    expect(d.source).toBe('spec')
    expect(d.csi_section).toBe('08 41 13')
    expect(d.spec_section_paragraph).toBe('§2.04.B.3')
    expect(d.spec_pdf_page).toBe(47)
    expect(d.kind).toBe('shop_drawing')
    expect(d.title).toBe('Aluminum-Framed Storefronts')
    expect(d.provenance.csi_section).toBe('spec')
    expect(d.provenance.kind).toBe('spec')
    expect(d.provenance.title).toBe('spec')
  })

  it('only sets fields that were provided (no over-eager defaults)', () => {
    const d = buildDraftFromSpec({ csi_section: '03 30 00' })
    expect(d.csi_section).toBe('03 30 00')
    expect(d.spec_section_paragraph).toBeNull()
    expect(d.spec_pdf_page).toBeNull()
    expect(d.kind).toBeNull()
    expect(d.title).toBe('')
    expect(d.provenance.csi_section).toBe('spec')
    expect(d.provenance.kind).toBeUndefined()
  })
})

describe('buildDraftFromVoice', () => {
  it('uses Iris-extracted entities when provided', () => {
    const d = buildDraftFromVoice({
      transcript: 'Make a shop drawing for storefront aluminum',
      entities: { title: 'Storefront aluminum', kind: 'shop_drawing', csi_section: '08 41 13' },
    })
    expect(d.source).toBe('voice')
    expect(d.title).toBe('Storefront aluminum')
    expect(d.kind).toBe('shop_drawing')
    expect(d.csi_section).toBe('08 41 13')
    expect(d.provenance.title).toBe('voice')
    expect(d.provenance.kind).toBe('voice')
    expect(d.provenance.csi_section).toBe('voice')
  })

  it('falls back to first-sentence title when no entity extraction', () => {
    const d = buildDraftFromVoice({
      transcript: 'Storefront frame system. ACME Glass. Spec 08 41 13.',
    })
    expect(d.title).toBe('Storefront frame system')
    expect(d.provenance.title).toBe('voice')
  })

  it('truncates long transcripts to 60 chars', () => {
    const long = 'a'.repeat(200)
    const d = buildDraftFromVoice({ transcript: long })
    expect(d.title.length).toBeLessThanOrEqual(60)
  })
})

describe('buildDraftFromPin', () => {
  it('attaches the pin id and synthesizes a title from the sheet label', () => {
    const d = buildDraftFromPin({
      drawing_pin_id: 'pin-1',
      sheet_number: 'A-201',
      sheet_title: 'Curtain Wall Plan',
      csi_section: '08 44 13',
    })
    expect(d.source).toBe('drawing_pin')
    expect(d.drawing_pin_ids).toEqual(['pin-1'])
    expect(d.title).toContain('A-201')
    expect(d.title).toContain('Curtain Wall Plan')
    expect(d.csi_section).toBe('08 44 13')
    expect(d.provenance.drawing_pin_ids).toBe('drawing_pin')
  })

  it('handles missing sheet metadata gracefully', () => {
    const d = buildDraftFromPin({
      drawing_pin_id: 'pin-2',
      sheet_number: null,
      sheet_title: null,
    })
    expect(d.drawing_pin_ids).toEqual(['pin-2'])
    expect(d.title).toBe('')
  })
})

describe('runPreflight', () => {
  it('blocks an empty title', () => {
    const d = emptyDraft()
    const findings = runPreflight(d)
    const titleBlock = findings.find((f) => f.id === 'title_required')
    expect(titleBlock?.severity).toBe('block')
  })

  it('warns when no ball-in-court is set', () => {
    const d = emptyDraft()
    d.title = 'Test'
    const findings = runPreflight(d)
    expect(findings.find((f) => f.id === 'bic_missing')?.severity).toBe('warning')
  })

  it('flags shop drawings with short lead time', () => {
    const d = emptyDraft()
    d.title = 'Shop drawing'
    d.kind = 'shop_drawing'
    d.lead_time_weeks = 2
    const findings = runPreflight(d)
    expect(findings.find((f) => f.id === 'shop_drawing_short_lead')?.severity).toBe('warning')
  })

  it('returns no blocks once required fields are filled', () => {
    const d = emptyDraft()
    d.title = 'Test submittal'
    d.ball_in_court_user_id = 'user-1'
    d.due_date = '2099-01-01'
    d.kind = 'product_data'
    d.csi_section = '08 41 13'
    d.attachment_ids = ['file-1']
    const findings = runPreflight(d)
    const blocks = findings.filter((f) => f.severity === 'block')
    expect(blocks).toHaveLength(0)
  })
})
