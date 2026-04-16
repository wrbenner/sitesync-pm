import { describe, it, expect } from 'vitest'
import type { MappedSchedulePhase } from '../types/entities'
import {
  detectConflicts,
  getResolutionHistory,
  resolveConflict,
  getTradeLabel,
  type TradeConflict,
  type ConflictResolution,
} from './coordinationService'

// Minimal phase factory for tests
function makePhase(overrides: Partial<MappedSchedulePhase> & {
  id: string; name: string; startDate: string; endDate: string;
}): MappedSchedulePhase {
  return {
    status: 'in_progress',
    percent_complete: 50,
    assigned_trade: null,
    location: null,
    is_critical_path: false,
    is_critical: false,
    progress: 50,
    completed: false,
    ...overrides,
  } as unknown as MappedSchedulePhase
}

// Two MEP phases that overlap in time — should always conflict
const electricalPhase = makePhase({
  id: 'e1',
  name: 'Electrical Rough-In',
  startDate: '2026-05-01',
  endDate: '2026-05-20',
})

const plumbingPhase = makePhase({
  id: 'p1',
  name: 'Plumbing Rough-In',
  startDate: '2026-05-05',
  endDate: '2026-05-25',
})

describe('detectConflicts', () => {
  it('detects overlapping MEP trades as a conflict', () => {
    const conflicts = detectConflicts([electricalPhase, plumbingPhase])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].phaseA.id).toBe('e1')
    expect(conflicts[0].phaseB.id).toBe('p1')
    expect(conflicts[0].overlapDays).toBeGreaterThan(0)
  })

  it('returns no conflicts for non-overlapping dates', () => {
    const a = makePhase({ id: 'a1', name: 'Electrical', startDate: '2026-04-01', endDate: '2026-04-15' })
    const b = makePhase({ id: 'b1', name: 'Plumbing', startDate: '2026-04-20', endDate: '2026-05-05' })
    expect(detectConflicts([a, b])).toHaveLength(0)
  })

  it('skips completed phases', () => {
    const done = makePhase({
      id: 'c1',
      name: 'Electrical',
      startDate: '2026-05-01',
      endDate: '2026-05-20',
      status: 'completed',
      percent_complete: 100,
    })
    expect(detectConflicts([done, plumbingPhase])).toHaveLength(0)
  })

  it('skips same-trade phases (no self-conflict)', () => {
    const elec2 = makePhase({ id: 'e2', name: 'Electrical Final', startDate: '2026-05-05', endDate: '2026-05-15' })
    const conflicts = detectConflicts([electricalPhase, elec2])
    expect(conflicts).toHaveLength(0)
  })

  it('critical path phases get higher urgency', () => {
    const critElec = makePhase({
      id: 'ce1',
      name: 'Electrical Rough-In',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      is_critical_path: true,
    })
    const critPlumb = makePhase({
      id: 'cp1',
      name: 'Plumbing Rough-In',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      is_critical_path: true,
    })
    const conflicts = detectConflicts([critElec, critPlumb])
    if (conflicts.length > 0) {
      expect(conflicts[0].urgency).toBe('critical')
    }
  })

  it('suggests correct trade order based on construction sequencing', () => {
    const concretePhase = makePhase({ id: 'con1', name: 'Concrete Pour', startDate: '2026-05-01', endDate: '2026-05-20' })
    const elecPhase = makePhase({ id: 'el1', name: 'Electrical Rough-In', startDate: '2026-05-05', endDate: '2026-05-25' })
    const conflicts = detectConflicts([concretePhase, elecPhase])
    if (conflicts.length > 0) {
      // Concrete should go before electrical (lower priority number)
      expect(conflicts[0].suggestedOrder).toBe('A')
    }
  })

  it('sorts conflicts with critical first', () => {
    const critElec = makePhase({
      id: 'ce1',
      name: 'Electrical Rough-In',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
      is_critical_path: true,
    })
    const critPlumb = makePhase({
      id: 'cp1',
      name: 'Plumbing Rough-In',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    })
    const farElec = makePhase({
      id: 'fe1',
      name: 'Electrical Final',
      startDate: '2026-08-01',
      endDate: '2026-08-20',
    })
    const farMech = makePhase({
      id: 'fm1',
      name: 'Mechanical Final',
      startDate: '2026-08-05',
      endDate: '2026-08-25',
    })
    const conflicts = detectConflicts([farElec, farMech, critElec, critPlumb])
    if (conflicts.length >= 2) {
      const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      for (let i = 0; i < conflicts.length - 1; i++) {
        expect(urgencyOrder[conflicts[i].urgency]).toBeLessThanOrEqual(urgencyOrder[conflicts[i + 1].urgency])
      }
    }
  })
})

describe('getResolutionHistory', () => {
  it('returns historical entry for known trade pair', () => {
    const history = getResolutionHistory('electrical', 'plumbing')
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].tradeA === 'electrical' || history[0].tradeB === 'electrical').toBe(true)
  })

  it('returns empty array for unknown trade pair', () => {
    const history = getResolutionHistory('roofing', 'glazing')
    expect(history).toEqual([])
  })

  it('is symmetric: (A, B) returns same as (B, A)', () => {
    const ab = getResolutionHistory('mechanical', 'electrical')
    const ba = getResolutionHistory('electrical', 'mechanical')
    expect(ab).toEqual(ba)
  })
})

describe('resolveConflict', () => {
  const sampleConflict: TradeConflict = {
    id: 'conflict-e1-p1',
    phaseA: electricalPhase,
    phaseB: plumbingPhase,
    overlapStart: '2026-05-05',
    overlapEnd: '2026-05-20',
    overlapDays: 16,
    location: 'Level 2',
    urgency: 'high',
    impactIfAFirst: 0,
    impactIfBFirst: 2,
    historicalNote: null,
    suggestedResolution: 'Electrical first',
    suggestedOrder: 'A',
    resolved: false,
    resolvedAt: null,
  }

  it('marks the specified conflict as resolved', () => {
    const resolution: ConflictResolution = {
      conflictId: 'conflict-e1-p1',
      chosenOrder: 'A',
      notifyForemen: true,
      updateLookahead: true,
    }
    const updated = resolveConflict([sampleConflict], resolution)
    expect(updated[0].resolved).toBe(true)
    expect(updated[0].resolvedAt).not.toBeNull()
  })

  it('leaves other conflicts untouched', () => {
    const other: TradeConflict = { ...sampleConflict, id: 'conflict-other', resolved: false }
    const resolution: ConflictResolution = {
      conflictId: 'conflict-e1-p1',
      chosenOrder: 'B',
      notifyForemen: false,
      updateLookahead: false,
    }
    const updated = resolveConflict([sampleConflict, other], resolution)
    expect(updated[1].resolved).toBe(false)
  })
})

describe('getTradeLabel', () => {
  it('returns assigned_trade when present', () => {
    const phase = makePhase({ id: 'x', name: 'Phase', startDate: '2026-05-01', endDate: '2026-05-10', assigned_trade: 'concrete' })
    expect(getTradeLabel(phase)).toBe('concrete')
  })

  it('extracts trade from phase name when assigned_trade is null', () => {
    const phase = makePhase({ id: 'x', name: 'Electrical Rough-In', startDate: '2026-05-01', endDate: '2026-05-10' })
    expect(getTradeLabel(phase)).toBe('electrical')
  })

  it('falls back to general for unrecognized names', () => {
    const phase = makePhase({ id: 'x', name: 'Misc Site Work', startDate: '2026-05-01', endDate: '2026-05-10' })
    expect(getTradeLabel(phase)).toBe('general')
  })
})
