import { describe, it, expect } from 'vitest'
import {
  gate,
  GATE_THRESHOLDS,
  type ExtractionResult,
} from './confidenceGate'

const E = (over: Partial<ExtractionResult<string>> = {}): ExtractionResult<string> => ({
  payload: 'ok',
  confidence: 0.9,
  ...over,
})

describe('gate', () => {
  it('returns auto_apply when confidence ≥ 0.85', () => {
    expect(gate(E({ confidence: 0.85 })).status).toBe('auto_apply')
    expect(gate(E({ confidence: 0.99 })).status).toBe('auto_apply')
  })

  it('returns auto_apply_with_warning when 0.7 ≤ confidence < 0.85', () => {
    expect(gate(E({ confidence: 0.7 })).status).toBe('auto_apply_with_warning')
    expect(gate(E({ confidence: 0.8 })).status).toBe('auto_apply_with_warning')
    expect(gate(E({ confidence: 0.849 })).status).toBe('auto_apply_with_warning')
  })

  it('returns manual_review when confidence < 0.7', () => {
    expect(gate(E({ confidence: 0.69 })).status).toBe('manual_review')
    expect(gate(E({ confidence: 0 })).status).toBe('manual_review')
  })

  it('preserves the original payload and confidence', () => {
    const result = gate(E({ payload: 'data', confidence: 0.92 }))
    expect(result.payload).toBe('data')
    expect(result.confidence).toBe(0.92)
  })

  it('flags fields below 0.7 confidence', () => {
    const result = gate(
      E({
        confidence: 0.95,
        field_confidence: { name: 0.95, ssn: 0.5, address: 0.65, phone: 0.8 },
      }),
    )
    expect(result.flagged_fields.sort()).toEqual(['address', 'ssn'])
  })

  it('returns empty flagged_fields when no field_confidence is provided', () => {
    expect(gate(E({ confidence: 0.5 })).flagged_fields).toEqual([])
  })

  it('flags a low-confidence field even on auto_apply overall', () => {
    const result = gate(
      E({ confidence: 0.95, field_confidence: { name: 0.5 } }),
    )
    expect(result.status).toBe('auto_apply')
    expect(result.flagged_fields).toEqual(['name'])
  })

  it('treats confidence exactly at boundary 0.85 as auto_apply', () => {
    expect(gate(E({ confidence: 0.85 })).status).toBe('auto_apply')
  })

  it('treats confidence exactly at boundary 0.7 as auto_apply_with_warning', () => {
    expect(gate(E({ confidence: 0.7 })).status).toBe('auto_apply_with_warning')
  })

  it('exposes constant thresholds for use by call-sites', () => {
    expect(GATE_THRESHOLDS.AUTO_APPLY).toBe(0.85)
    expect(GATE_THRESHOLDS.WARNING).toBe(0.7)
  })

  it('preserves bbox and pdf_page if present', () => {
    const result = gate(
      E({ pdf_page: 4, bbox: { x0: 10, y0: 20, x1: 30, y1: 40 } }),
    )
    expect(result.pdf_page).toBe(4)
    expect(result.bbox).toEqual({ x0: 10, y0: 20, x1: 30, y1: 40 })
  })
})
