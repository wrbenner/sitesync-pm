import { describe, it, expect } from 'vitest'
import {
  businessDaysBetween,
  calculateSlaState,
  compareSlaStateMostBrokenFirst,
  ladderStageForSla,
  type SlaState,
} from './slaCalculator'

const D = (s: string) => new Date(s + 'T12:00:00Z')

describe('businessDaysBetween', () => {
  it('returns 0 for same day', () => {
    expect(businessDaysBetween(D('2026-05-04'), D('2026-05-04'))).toBe(0)
  })

  it('counts forward weekdays', () => {
    // Mon → Fri = 4 weekdays after Mon
    expect(businessDaysBetween(D('2026-05-04'), D('2026-05-08'))).toBe(4)
  })

  it('skips weekends', () => {
    // Fri → Mon: only Mon is a weekday after Fri
    expect(businessDaysBetween(D('2026-05-08'), D('2026-05-11'))).toBe(1)
  })

  it('skips holidays in array form', () => {
    // Mon → Fri minus Wed holiday
    expect(
      businessDaysBetween(D('2026-05-04'), D('2026-05-08'), ['2026-05-06']),
    ).toBe(3)
  })

  it('skips holidays in set form', () => {
    expect(
      businessDaysBetween(
        D('2026-05-04'),
        D('2026-05-08'),
        new Set(['2026-05-06']),
      ),
    ).toBe(3)
  })

  it('returns negative when to is before from', () => {
    expect(businessDaysBetween(D('2026-05-11'), D('2026-05-08'))).toBe(-1)
  })

  it('handles spans crossing multiple weekends', () => {
    // Mon → Mon two weeks later = 10 weekdays
    expect(businessDaysBetween(D('2026-05-04'), D('2026-05-18'))).toBe(10)
  })
})

describe('calculateSlaState', () => {
  const now = D('2026-05-04') // Mon

  it('returns paused when pausedAt is set', () => {
    const r = calculateSlaState({
      dueDate: '2026-05-08',
      now,
      pausedAt: '2026-05-03T00:00:00Z',
    })
    expect(r.stage).toBe('paused')
    expect(r.color).toBe('paused')
    expect(r.label).toBe('Paused')
    expect(r.businessDaysRemaining).toBeNull()
  })

  it('returns unknown when dueDate is missing', () => {
    expect(calculateSlaState({ dueDate: null, now }).stage).toBe('unknown')
    expect(calculateSlaState({ dueDate: undefined, now }).stage).toBe('unknown')
  })

  it('returns unknown for unparseable dueDate', () => {
    expect(calculateSlaState({ dueDate: 'not-a-date', now }).stage).toBe(
      'unknown',
    )
  })

  it('classifies on_track when ≥3 business days remain', () => {
    const r = calculateSlaState({ dueDate: '2026-05-11', now })
    expect(r.stage).toBe('on_track')
    expect(r.color).toBe('neutral')
    expect(r.label).toMatch(/d left$/)
  })

  it('classifies nudge when 1-2 business days remain', () => {
    const r = calculateSlaState({ dueDate: '2026-05-06', now }) // Wed
    expect(r.stage).toBe('nudge')
    expect(r.color).toBe('warn')
  })

  it('classifies nudge with "Due today" label when 0 days remain', () => {
    const r = calculateSlaState({ dueDate: '2026-05-04', now })
    expect(r.stage).toBe('nudge')
    expect(r.label).toBe('Due today')
    expect(r.businessDaysRemaining).toBe(0)
  })

  it('classifies overdue (1-2 business days late)', () => {
    const r = calculateSlaState({
      dueDate: '2026-05-01',
      now: D('2026-05-04'),
    })
    expect(r.stage).toBe('overdue')
    expect(r.color).toBe('danger')
    expect(r.businessDaysOverdue).toBeGreaterThan(0)
  })

  it('classifies overdue_cc when 3-6 business days late', () => {
    const r = calculateSlaState({
      dueDate: '2026-04-27',
      now: D('2026-05-04'),
    })
    expect(r.stage).toBe('overdue_cc')
    expect(r.label).toMatch(/escalated/)
  })

  it('classifies delay_risk when ≥7 business days late', () => {
    const r = calculateSlaState({
      dueDate: '2026-04-20',
      now: D('2026-05-04'),
    })
    expect(r.stage).toBe('delay_risk')
    expect(r.label).toMatch(/delay risk/)
  })

  it('honours holidays when computing remaining', () => {
    const r = calculateSlaState({
      dueDate: '2026-05-08',
      now: D('2026-05-04'),
      holidays: ['2026-05-05', '2026-05-06'],
    })
    // Without holidays: 4 days remaining → on_track
    // With 2 holidays: 2 days remaining → nudge
    expect(r.stage).toBe('nudge')
  })
})

describe('compareSlaStateMostBrokenFirst', () => {
  const make = (
    stage: SlaState['stage'],
    overdue = 0,
    remaining: number | null = 0,
  ): SlaState => ({
    stage,
    businessDaysOverdue: overdue,
    businessDaysRemaining: remaining,
    label: '',
    color: 'neutral',
  })

  it('orders delay_risk before overdue_cc before overdue', () => {
    const stages: SlaState['stage'][] = [
      'on_track',
      'delay_risk',
      'overdue',
      'overdue_cc',
    ]
    const items = stages.map((s) => make(s))
    items.sort(compareSlaStateMostBrokenFirst)
    expect(items.map((i) => i.stage)).toEqual([
      'delay_risk',
      'overdue_cc',
      'overdue',
      'on_track',
    ])
  })

  it('within same stage, sorts most overdue first', () => {
    const items = [make('overdue', 1), make('overdue', 5), make('overdue', 3)]
    items.sort(compareSlaStateMostBrokenFirst)
    expect(items.map((i) => i.businessDaysOverdue)).toEqual([5, 3, 1])
  })

  it('within same stage and overdue, sorts fewest days remaining first', () => {
    const items = [
      make('on_track', 0, 5),
      make('on_track', 0, 1),
      make('on_track', 0, 3),
    ]
    items.sort(compareSlaStateMostBrokenFirst)
    expect(items.map((i) => i.businessDaysRemaining)).toEqual([1, 3, 5])
  })

  it('treats null remaining as +Infinity', () => {
    const items = [make('paused', 0, null), make('paused', 0, 1)]
    items.sort(compareSlaStateMostBrokenFirst)
    expect(items[0].businessDaysRemaining).toBe(1)
  })
})

describe('ladderStageForSla', () => {
  it('maps nudge → t_minus_2', () => {
    expect(ladderStageForSla('nudge')).toBe('t_minus_2')
  })

  it('maps overdue → overdue_first', () => {
    expect(ladderStageForSla('overdue')).toBe('overdue_first')
  })

  it('maps overdue_cc → cc_manager', () => {
    expect(ladderStageForSla('overdue_cc')).toBe('cc_manager')
  })

  it('maps delay_risk → delay_risk', () => {
    expect(ladderStageForSla('delay_risk')).toBe('delay_risk')
  })

  it('returns null for on_track / paused / unknown', () => {
    expect(ladderStageForSla('on_track')).toBeNull()
    expect(ladderStageForSla('paused')).toBeNull()
    expect(ladderStageForSla('unknown')).toBeNull()
  })
})
