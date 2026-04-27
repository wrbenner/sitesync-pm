import { describe, it, expect } from 'vitest'
import { STAMP_CONFIGS, type StampType } from './StampTool'

describe('StampTool — STAMP_CONFIGS shape', () => {
  it('has the documented 7 stamp types', () => {
    expect(Object.keys(STAMP_CONFIGS).sort()).toEqual(
      [
        'approved',
        'not_for_construction',
        'preliminary',
        'rejected',
        'reviewed',
        'revise_resubmit',
        'void',
      ].sort(),
    )
  })

  it('every config has label + color + borderColor', () => {
    for (const [type, cfg] of Object.entries(STAMP_CONFIGS)) {
      expect(cfg.label, `${type} missing label`).toBeTruthy()
      expect(cfg.color, `${type} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(cfg.borderColor, `${type} missing borderColor`).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('color and borderColor match within a config (paired)', () => {
    for (const cfg of Object.values(STAMP_CONFIGS)) {
      expect(cfg.color).toBe(cfg.borderColor)
    }
  })

  it('labels are uppercased English (no lowercase letters)', () => {
    for (const cfg of Object.values(STAMP_CONFIGS)) {
      expect(cfg.label).toBe(cfg.label.toUpperCase())
    }
  })

  it('approved/preliminary stamps use the documented colors', () => {
    expect(STAMP_CONFIGS.approved.color).toBe('#2E8B57')        // green
    expect(STAMP_CONFIGS.preliminary.color).toBe('#E08A00')      // amber
    expect(STAMP_CONFIGS.reviewed.color).toBe('#1565C0')         // blue
  })

  it('rejected, void, and not_for_construction share the red color', () => {
    expect(STAMP_CONFIGS.rejected.color).toBe('#D32F2F')
    expect(STAMP_CONFIGS.void.color).toBe('#D32F2F')
    expect(STAMP_CONFIGS.not_for_construction.color).toBe('#D32F2F')
  })

  it('revise_resubmit and preliminary share the amber/warning color', () => {
    expect(STAMP_CONFIGS.revise_resubmit.color).toBe('#E08A00')
    expect(STAMP_CONFIGS.preliminary.color).toBe('#E08A00')
  })

  it('every StampType union member has a config (no orphans)', () => {
    const types: StampType[] = [
      'approved', 'rejected', 'revise_resubmit', 'reviewed',
      'void', 'not_for_construction', 'preliminary',
    ]
    for (const t of types) {
      expect(STAMP_CONFIGS[t]).toBeDefined()
    }
  })

  it('NOT FOR CONSTRUCTION label is the longest (drives stamp width calc)', () => {
    const labels = Object.values(STAMP_CONFIGS).map((c) => c.label)
    const longest = labels.reduce((a, b) => (a.length >= b.length ? a : b))
    expect(longest).toBe('NOT FOR CONSTRUCTION')
  })
})
