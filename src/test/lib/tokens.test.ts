import { describe, it, expect } from 'vitest'
import { colors, spacing, touchTarget, getStatusColor, getPriorityColor } from '../../styles/theme'

describe('Design Tokens', () => {
  it('has brand colors from 50 to 900', () => {
    expect(colors.brand50).toBeTruthy()
    expect(colors.brand500).toBeTruthy()
    expect(colors.brand900).toBeTruthy()
  })

  it('has all status colors', () => {
    expect(colors.statusActive).toBeTruthy()
    expect(colors.statusPending).toBeTruthy()
    expect(colors.statusCritical).toBeTruthy()
    expect(colors.statusInfo).toBeTruthy()
    expect(colors.statusNeutral).toBeTruthy()
  })

  it('has spacing scale', () => {
    expect(spacing['0']).toBe('0')
    expect(spacing['4']).toBe('16px')
    expect(spacing['8']).toBe('32px')
  })

  it('has touch target sizes', () => {
    expect(parseInt(touchTarget.min)).toBeGreaterThanOrEqual(44)
    expect(parseInt(touchTarget.field)).toBeGreaterThanOrEqual(56)
  })
})

describe('getStatusColor', () => {
  it('returns fg and bg for known statuses', () => {
    const result = getStatusColor('open')
    expect(result.fg).toMatch(/^#/)
    expect(result.bg).toMatch(/^rgba/)
  })

  it('handles all common statuses', () => {
    const statuses = ['open', 'closed', 'approved', 'rejected', 'draft', 'in_progress', 'todo', 'done', 'at_risk', 'on_track', 'answered', 'void']
    for (const s of statuses) {
      const result = getStatusColor(s)
      expect(result.fg).toBeTruthy()
      expect(result.bg).toBeTruthy()
    }
  })

  it('returns default for unknown status', () => {
    const result = getStatusColor('nonexistent_status')
    expect(result.fg).toBeTruthy()
  })
})

describe('getPriorityColor', () => {
  it('returns colors for all priorities', () => {
    for (const p of ['critical', 'high', 'medium', 'low']) {
      const result = getPriorityColor(p)
      expect(result.fg).toMatch(/^#/)
      expect(result.bg).toMatch(/^rgba/)
    }
  })
})
