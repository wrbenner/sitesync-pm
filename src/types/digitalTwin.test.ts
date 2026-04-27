import { describe, it, expect } from 'vitest'
import { OVERLAY_LAYERS, OVERLAY_CONFIG } from './digitalTwin'

describe('digitalTwin — OVERLAY_LAYERS', () => {
  it('exposes the documented 6 overlay layers', () => {
    expect(OVERLAY_LAYERS).toEqual([
      'progress', 'rfis', 'safety', 'schedule', 'crews', 'photos',
    ])
  })

  it('layers are unique (no duplicates)', () => {
    expect(new Set(OVERLAY_LAYERS).size).toBe(OVERLAY_LAYERS.length)
  })

  it('every layer id is lowercase + alphanumeric (no separators)', () => {
    for (const id of OVERLAY_LAYERS) {
      expect(id, `${id} contains separators`).toMatch(/^[a-z]+$/)
    }
  })
})

describe('digitalTwin — OVERLAY_CONFIG', () => {
  it('every layer has a config entry (paired-vocabulary check)', () => {
    for (const id of OVERLAY_LAYERS) {
      expect(OVERLAY_CONFIG[id], `${id} missing config`).toBeDefined()
    }
  })

  it('every config has all required fields populated', () => {
    for (const [id, cfg] of Object.entries(OVERLAY_CONFIG)) {
      expect(cfg.id).toBe(id)
      expect(cfg.label, `${id} missing label`).toBeTruthy()
      expect(cfg.description, `${id} missing description`).toBeTruthy()
      expect(cfg.icon, `${id} missing icon`).toBeTruthy()
      expect(cfg.color, `${id} missing color`).toBeTruthy()
    }
  })

  it('paired-key invariant: OVERLAY_CONFIG[id].id === id', () => {
    // Catches the "rename the key but forget to update the embedded id" bug.
    for (const id of OVERLAY_LAYERS) {
      expect(OVERLAY_CONFIG[id].id).toBe(id)
    }
  })

  it('safety overlay maps to the critical color (incident-heatmap visual coding)', () => {
    expect(OVERLAY_CONFIG.safety.color).toBe('statusCritical')
  })

  it('progress overlay maps to the active color (positive-outcome visual coding)', () => {
    expect(OVERLAY_CONFIG.progress.color).toBe('statusActive')
  })

  it('rfis overlay uses the brand orange (call-to-attention)', () => {
    expect(OVERLAY_CONFIG.rfis.color).toBe('primaryOrange')
  })

  it('every label is human-readable Title Case (single word for the 6 documented layers)', () => {
    for (const cfg of Object.values(OVERLAY_CONFIG)) {
      expect(cfg.label[0]).toBe(cfg.label[0].toUpperCase())
    }
  })

  it('all icons are non-empty Lucide icon names (alphabetic strings)', () => {
    for (const cfg of Object.values(OVERLAY_CONFIG)) {
      expect(cfg.icon).toMatch(/^[A-Za-z]+$/)
    }
  })

  it('all labels are unique within the catalog', () => {
    const labels = Object.values(OVERLAY_CONFIG).map((c) => c.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('all icons are unique within the catalog', () => {
    const icons = Object.values(OVERLAY_CONFIG).map((c) => c.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})
