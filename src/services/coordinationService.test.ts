import { describe, it, expect } from 'vitest'
import {
  detectConflicts,
  getResolutionHistory,
  resolveConflict,
  getTradeLabel,
  type TradeConflict,
  type ConflictResolution,
} from './coordinationService'
import type { MappedSchedulePhase } from '../types/entities'

function makePhase(overrides: Partial<{
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
  percent_complete: number
  is_critical_path: boolean
  location: string | null
  assigned_trade: string | null
}>): MappedSchedulePhase {
  return {
    id: 'phase-1',
    name: 'Electrical Rough-in',
    startDate: '2026-06-01',
    endDate: '2026-06-20',
    status: 'not_started',
    percent_complete: 0,
    is_critical_path: false,
    location: 'Level 1',
    assigned_trade: null,
    ...overrides,
  } as unknown as MappedSchedulePhase
}

describe('detectConflicts', () => {
  it('detects MEP trade conflict with date overlap and same location', () => {
    const electrical = makePhase({ id: 'e1', name: 'Electrical Rough-in', assigned_trade: 'electrical', location: 'Level 1', startDate: '2026-06-01', endDate: '2026-06-20' })
    const plumbing = makePhase({ id: 'p1', name: 'Plumbing Rough-in', assigned_trade: 'plumbing', location: 'Level 1', startDate: '2026-06-10', endDate: '2026-06-25' })

    const conflicts = detectConflicts([electrical, plumbing])

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].phaseA.id).toBe('e1')
    expect(conflicts[0].phaseB.id).toBe('p1')
    expect(conflicts[0].overlapDays).toBeGreaterThan(0)
    expect(conflicts[0].resolved).toBe(false)
  })

  it('detects MEP conflict without explicit location (inferred overlap)', () => {
    const mechanical = makePhase({ id: 'm1', name: 'HVAC Ductwork', assigned_trade: 'mechanical', location: null, startDate: '2026-06-01', endDate: '2026-06-20' })
    const electrical = makePhase({ id: 'e1', name: 'Electrical Rough-in', assigned_trade: 'electrical', location: null, startDate: '2026-06-10', endDate: '2026-06-25' })

    const conflicts = detectConflicts([mechanical, electrical])
    expect(conflicts).toHaveLength(1)
  })

  it('produces no conflict when dates do not overlap', () => {
    const a = makePhase({ id: 'a1', name: 'Plumbing', assigned_trade: 'plumbing', location: 'Level 1', startDate: '2026-05-01', endDate: '2026-05-15' })
    const b = makePhase({ id: 'b1', name: 'Electrical', assigned_trade: 'electrical', location: 'Level 1', startDate: '2026-06-01', endDate: '2026-06-20' })

    expect(detectConflicts([a, b])).toHaveLength(0)
  })

  it('produces no conflict when same trade is scheduled (same trade does not self-conflict)', () => {
    const elec1 = makePhase({ id: 'e1', name: 'Electrical Rough-in Level 1', assigned_trade: 'electrical', location: 'Level 1' })
    const elec2 = makePhase({ id: 'e2', name: 'Electrical Rough-in Level 2', assigned_trade: 'electrical', location: 'Level 1' })

    expect(detectConflicts([elec1, elec2])).toHaveLength(0)
  })

  it('excludes completed phases from conflict detection', () => {
    const done = makePhase({ id: 'c1', name: 'Concrete Pour', assigned_trade: 'concrete', status: 'completed', location: 'Level 1', startDate: '2026-06-01', endDate: '2026-06-20' })
    const active = makePhase({ id: 's1', name: 'Structural Steel', assigned_trade: 'structural', location: 'Level 1', startDate: '2026-06-10', endDate: '2026-06-25' })

    expect(detectConflicts([done, active])).toHaveLength(0)
  })

  it('excludes 100% complete phases', () => {
    const almostDone = makePhase({ id: 'p1', name: 'Plumbing', assigned_trade: 'plumbing', percent_complete: 100, location: 'Level 1', startDate: '2026-06-01', endDate: '2026-06-20' })
    const other = makePhase({ id: 'e1', name: 'Electrical', assigned_trade: 'electrical', location: 'Level 1', startDate: '2026-06-10', endDate: '2026-06-25' })

    expect(detectConflicts([almostDone, other])).toHaveLength(0)
  })

  it('sorts conflicts by urgency with critical first', () => {
    const today = new Date()
    const in1Day = new Date(today.getTime() + 1 * 86400000).toISOString().split('T')[0]
    const in30Days = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
    const in50Days = new Date(today.getTime() + 50 * 86400000).toISOString().split('T')[0]
    const in60Days = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0]

    const criticalA = makePhase({ id: 'c1', name: 'Critical Electrical', assigned_trade: 'electrical', is_critical_path: true, location: 'Level 1', startDate: in1Day, endDate: in30Days })
    const criticalB = makePhase({ id: 'c2', name: 'Critical Plumbing', assigned_trade: 'plumbing', is_critical_path: true, location: 'Level 1', startDate: in1Day, endDate: in30Days })
    const lowA = makePhase({ id: 'l1', name: 'Low Mechanical', assigned_trade: 'mechanical', location: 'Level 2', startDate: in50Days, endDate: in60Days })
    const lowB = makePhase({ id: 'l2', name: 'Low Fire Protection', assigned_trade: 'fire_protection', location: 'Level 2', startDate: in50Days, endDate: in60Days })

    const conflicts = detectConflicts([lowA, lowB, criticalA, criticalB])

    const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    for (let i = 0; i < conflicts.length - 1; i++) {
      expect(urgencyOrder[conflicts[i].urgency]).toBeLessThanOrEqual(urgencyOrder[conflicts[i + 1].urgency])
    }
  })

  it('no conflicts when phases are at different locations and not MEP', () => {
    const carpentryA = makePhase({ id: 'c1', name: 'Carpentry Level 1', assigned_trade: 'carpentry', location: 'Level 1', startDate: '2026-06-01', endDate: '2026-06-20' })
    const carpentryB = makePhase({ id: 'c2', name: 'Finishing Level 2', assigned_trade: 'finishing', location: 'Level 2', startDate: '2026-06-10', endDate: '2026-06-25' })

    expect(detectConflicts([carpentryA, carpentryB])).toHaveLength(0)
  })
})

describe('getResolutionHistory', () => {
  it('finds history for a known trade pair', () => {
    const history = getResolutionHistory('electrical', 'plumbing')
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].tradeA === 'electrical' || history[0].tradeB === 'electrical').toBe(true)
  })

  it('finds history with reversed trade order', () => {
    const forward = getResolutionHistory('mechanical', 'electrical')
    const reversed = getResolutionHistory('electrical', 'mechanical')
    expect(forward).toHaveLength(reversed.length)
  })

  it('returns empty array for unknown trade pair', () => {
    const history = getResolutionHistory('roofing', 'glazing')
    expect(history).toEqual([])
  })
})

describe('resolveConflict', () => {
  it('marks the matching conflict as resolved', () => {
    const conflict: TradeConflict = {
      id: 'conflict-abc-xyz',
      phaseA: makePhase({ id: 'abc' }),
      phaseB: makePhase({ id: 'xyz' }),
      overlapStart: '2026-06-10',
      overlapEnd: '2026-06-15',
      overlapDays: 6,
      location: 'Level 1',
      urgency: 'medium',
      impactIfAFirst: 0,
      impactIfBFirst: 2,
      historicalNote: null,
      suggestedResolution: 'Recommend A first.',
      suggestedOrder: 'A',
      resolved: false,
      resolvedAt: null,
    }

    const resolution: ConflictResolution = {
      conflictId: 'conflict-abc-xyz',
      chosenOrder: 'A',
      notifyForemen: true,
      updateLookahead: true,
    }

    const result = resolveConflict([conflict], resolution)

    expect(result).toHaveLength(1)
    expect(result[0].resolved).toBe(true)
    expect(result[0].resolvedAt).toBeTruthy()
  })

  it('leaves other conflicts unchanged', () => {
    const c1: TradeConflict = { id: 'conflict-1', resolved: false, resolvedAt: null } as TradeConflict
    const c2: TradeConflict = { id: 'conflict-2', resolved: false, resolvedAt: null } as TradeConflict

    const result = resolveConflict([c1, c2], { conflictId: 'conflict-1', chosenOrder: 'A', notifyForemen: false, updateLookahead: false })

    expect(result[0].resolved).toBe(true)
    expect(result[1].resolved).toBe(false)
  })
})

describe('getTradeLabel', () => {
  it('returns assigned_trade when set', () => {
    const phase = makePhase({ assigned_trade: 'plumbing', name: 'Something Else' })
    expect(getTradeLabel(phase)).toBe('plumbing')
  })

  it('infers "electrical" from phase name', () => {
    const phase = makePhase({ assigned_trade: null, name: 'Electrical Conduit Installation' })
    expect(getTradeLabel(phase)).toBe('electrical')
  })

  it('infers "mechanical" from HVAC in name', () => {
    const phase = makePhase({ assigned_trade: null, name: 'HVAC Ductwork' })
    expect(getTradeLabel(phase)).toBe('mechanical')
  })

  it('infers "concrete" from name', () => {
    const phase = makePhase({ assigned_trade: null, name: 'Concrete Pour Level 3' })
    expect(getTradeLabel(phase)).toBe('concrete')
  })

  it('falls back to "general" for unknown names', () => {
    const phase = makePhase({ assigned_trade: null, name: 'Miscellaneous Site Work' })
    expect(getTradeLabel(phase)).toBe('general')
  })
})
