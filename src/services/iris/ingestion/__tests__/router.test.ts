// ────────────────────────────────────────────────────────────────────────────
// routeArtifact tests — Phase 3b
// ────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest'

import { routeArtifact, WORKER_NAMES } from '../router'

describe('routeArtifact', () => {
  it('returns unclassified + 0 confidence when source_id is missing', () => {
    const result = routeArtifact({ source_id: '', filename: 'x.pdf' })
    expect(result.source_type).toBe('unclassified')
    expect(result.confidence).toBe(0)
  })

  it('caller hint wins over every other signal', () => {
    const result = routeArtifact({
      source_id: 'x',
      mime: 'image/png',
      filename: 'IMG_1234.jpg',
      source_type_hint: 'submittal',
    })
    expect(result.source_type).toBe('submittal')
    expect(result.worker).toBe(WORKER_NAMES.submittal)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('parent_entity_type drives source_type when no caller hint', () => {
    const result = routeArtifact({
      source_id: 'x',
      filename: 'random.pdf',
      parent_entity_type: 'rfi',
    })
    expect(result.source_type).toBe('rfi')
  })

  it('routes images to photo by MIME', () => {
    expect(routeArtifact({ source_id: 'x', mime: 'image/jpeg' }).source_type).toBe('photo')
    expect(routeArtifact({ source_id: 'x', mime: 'image/png' }).source_type).toBe('photo')
  })

  it('routes spreadsheets by MIME', () => {
    expect(routeArtifact({ source_id: 'x', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }).source_type).toBe('spreadsheet')
  })

  it('routes email forwards by MIME', () => {
    expect(routeArtifact({ source_id: 'x', mime: 'message/rfc822' }).source_type).toBe('conversation')
  })

  it('routes by filename keywords when MIME is generic', () => {
    expect(routeArtifact({ source_id: 'x', filename: 'A-101_floor_plan.pdf' }).source_type).toBe('drawing')
    expect(routeArtifact({ source_id: 'x', filename: 'section_03_30_00_concrete.pdf' }).source_type).toBe('spec_section')
    expect(routeArtifact({ source_id: 'x', filename: 'submittal_package_42.pdf' }).source_type).toBe('submittal')
    expect(routeArtifact({ source_id: 'x', filename: 'daily_log_2026-05-10.pdf' }).source_type).toBe('daily_log')
    expect(routeArtifact({ source_id: 'x', filename: 'AIA_A201_contract.pdf' }).source_type).toBe('contract')
    expect(routeArtifact({ source_id: 'x', filename: 'CO-007_change_order.pdf' }).source_type).toBe('change_order')
    expect(routeArtifact({ source_id: 'x', filename: 'pay_app_09.pdf' }).source_type).toBe('pay_app')
    expect(routeArtifact({ source_id: 'x', filename: 'lien_waiver_conditional.pdf' }).source_type).toBe('lien_waiver')
    expect(routeArtifact({ source_id: 'x', filename: 'punch_walkthrough.pdf' }).source_type).toBe('punch_item')
  })

  it('falls back to unclassified when no signal matches', () => {
    const result = routeArtifact({ source_id: 'x', filename: 'random_thing.dat' })
    expect(result.source_type).toBe('unclassified')
    expect(result.confidence).toBe(0)
  })

  it('every IrisSourceType has a registered worker', () => {
    const keys = Object.keys(WORKER_NAMES)
    expect(keys).toHaveLength(16)
    for (const worker of Object.values(WORKER_NAMES)) {
      expect(worker).toMatch(/^iris-ingest-.*-worker$/)
    }
  })

  it('confidence reflects signal strength', () => {
    expect(routeArtifact({ source_id: 'x', source_type_hint: 'rfi' }).confidence).toBeGreaterThanOrEqual(0.9)
    expect(routeArtifact({ source_id: 'x', parent_entity_type: 'rfi' }).confidence).toBeGreaterThanOrEqual(0.8)
    expect(routeArtifact({ source_id: 'x', mime: 'image/jpeg' }).confidence).toBeGreaterThanOrEqual(0.7)
    expect(routeArtifact({ source_id: 'x', filename: 'rfi.pdf' }).confidence).toBeGreaterThanOrEqual(0.5)
  })
})
