import { describe, it, expect } from 'vitest'
import {
  assessTaskRisk,
  computeEarnedValue,
  detectRFIBottlenecks,
  assessSubmittalRisks,
  generateTaskRiskInsights,
  generateBudgetInsights,
} from '../../lib/predictions'

describe('assessTaskRisk', () => {
  it('returns low risk for a task with no issues', () => {
    const result = assessTaskRisk({
      id: 't1', title: 'Install drywall', status: 'in_progress',
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      start_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      percent_complete: 20, predecessor_ids: null, is_critical_path: false, estimated_hours: null,
    }, [])
    expect(result.riskLevel).toBe('low')
    expect(result.riskScore).toBeLessThan(20)
  })

  it('returns critical risk for overdue task', () => {
    const result = assessTaskRisk({
      id: 't2', title: 'Pour foundation', status: 'in_progress',
      due_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
      start_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      percent_complete: 30, predecessor_ids: null, is_critical_path: true, estimated_hours: null,
    }, [])
    expect(result.riskLevel).toBe('critical')
    expect(result.factors.some(f => f.includes('overdue'))).toBe(true)
    expect(result.factors.some(f => f.includes('critical path'))).toBe(true)
  })

  it('increases risk for blocked predecessors', () => {
    const result = assessTaskRisk({
      id: 't3', title: 'Start framing', status: 'todo',
      due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      start_date: null, percent_complete: 0,
      predecessor_ids: ['p1', 'p2'], is_critical_path: false, estimated_hours: null,
    }, [
      { id: 'p1', status: 'in_progress' },
      { id: 'p2', status: 'todo' },
    ])
    expect(result.riskScore).toBeGreaterThanOrEqual(20)
    expect(result.factors.some(f => f.includes('predecessor'))).toBe(true)
  })

  it('flags progress behind elapsed time', () => {
    const result = assessTaskRisk({
      id: 't4', title: 'Electrical rough in', status: 'in_progress',
      due_date: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      start_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
      percent_complete: 10, // 10% done but 67% of time elapsed
      predecessor_ids: null, is_critical_path: false, estimated_hours: null,
    }, [])
    expect(result.riskScore).toBeGreaterThanOrEqual(15)
    expect(result.factors.some(f => f.includes('Progress') || f.includes('behind'))).toBe(true)
  })
})

describe('computeEarnedValue', () => {
  const items = [
    { original_amount: 1000000, actual_amount: 600000, committed_amount: 200000, percent_complete: 50 },
    { original_amount: 500000, actual_amount: 200000, committed_amount: 100000, percent_complete: 40 },
  ]

  it('computes CPI correctly', () => {
    const ev = computeEarnedValue(items, 47, 50) // 47% progress, 50% time
    expect(ev.BAC).toBe(1500000)
    expect(ev.AC).toBe(800000)
    expect(ev.CPI).toBeCloseTo(1500000 * 0.47 / 800000, 1)
  })

  it('computes SPI correctly', () => {
    const ev = computeEarnedValue(items, 40, 50) // 40% progress at 50% time
    expect(ev.SPI).toBeCloseTo((1500000 * 0.40) / (1500000 * 0.50), 1)
    expect(ev.SPI).toBeLessThan(1) // Behind schedule
  })

  it('generates alerts for low CPI', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 1000000, actual_amount: 800000, committed_amount: 0, percent_complete: 50 }],
      50, 50,
    )
    // CPI = (1M * 0.5) / 800K = 0.625
    expect(ev.CPI).toBeLessThan(0.95)
    expect(ev.alerts.length).toBeGreaterThan(0)
  })

  it('handles empty budget', () => {
    const ev = computeEarnedValue([], 50, 50)
    expect(ev.BAC).toBe(0)
    expect(ev.CPI).toBe(1) // No cost, default CPI
  })
})

describe('detectRFIBottlenecks', () => {
  it('detects reviewer with many overdue RFIs', () => {
    const now = new Date()
    const rfis = [
      { id: '1', title: 'RFI 1', status: 'open', assigned_to: 'John', due_date: new Date(now.getTime() - 5 * 86400000).toISOString(), created_at: new Date(now.getTime() - 10 * 86400000).toISOString() },
      { id: '2', title: 'RFI 2', status: 'under_review', assigned_to: 'John', due_date: new Date(now.getTime() - 3 * 86400000).toISOString(), created_at: new Date(now.getTime() - 8 * 86400000).toISOString() },
      { id: '3', title: 'RFI 3', status: 'open', assigned_to: 'John', due_date: new Date(now.getTime() - 1 * 86400000).toISOString(), created_at: new Date(now.getTime() - 6 * 86400000).toISOString() },
      { id: '4', title: 'RFI 4', status: 'open', assigned_to: 'Jane', due_date: new Date(now.getTime() + 5 * 86400000).toISOString(), created_at: new Date(now.getTime() - 2 * 86400000).toISOString() },
    ]
    const bottlenecks = detectRFIBottlenecks(rfis)
    expect(bottlenecks.length).toBe(1)
    expect(bottlenecks[0].reviewer).toBe('John')
    expect(bottlenecks[0].overdueCount).toBe(3)
  })

  it('returns empty for no bottlenecks', () => {
    const now = new Date()
    const rfis = [
      { id: '1', title: 'RFI 1', status: 'open', assigned_to: 'Alice', due_date: new Date(now.getTime() + 10 * 86400000).toISOString(), created_at: now.toISOString() },
    ]
    expect(detectRFIBottlenecks(rfis)).toHaveLength(0)
  })
})

describe('assessSubmittalRisks', () => {
  it('detects submittals projected to miss deadlines', () => {
    const risks = assessSubmittalRisks([
      { id: 's1', title: 'Steel shop drawings', status: 'draft', submit_by_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), lead_time_days: 21 },
    ])
    expect(risks.length).toBe(1)
    expect(risks[0].riskLevel).toBe('critical')
    expect(risks[0].gapDays).toBeLessThan(0)
  })

  it('skips approved submittals', () => {
    const risks = assessSubmittalRisks([
      { id: 's2', title: 'Concrete mix design', status: 'approved', submit_by_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) },
    ])
    expect(risks).toHaveLength(0)
  })

  it('flags medium risk when buffer is tight', () => {
    const risks = assessSubmittalRisks([
      { id: 's3', title: 'HVAC equipment', status: 'submitted', submit_by_date: new Date(Date.now() + 26 * 86400000).toISOString().slice(0, 10), lead_time_days: 14 },
    ])
    // 26 days available, needs 10 review + 14 lead = 24 days, gap = 2 (medium)
    expect(risks.length).toBe(1)
    expect(risks[0].riskLevel).toBe('medium')
  })
})

describe('insight generation', () => {
  it('generates critical task risk insights', () => {
    const insights = generateTaskRiskInsights([
      { taskId: '1', taskTitle: 'Pour foundation', riskLevel: 'critical', riskScore: 80, factors: ['10 days overdue'], delayProbability: 0.8 },
      { taskId: '2', taskTitle: 'Frame walls', riskLevel: 'high', riskScore: 50, factors: ['Behind schedule'], delayProbability: 0.5 },
    ])
    expect(insights.length).toBe(2)
    expect(insights[0].severity).toBe('critical')
    expect(insights[1].severity).toBe('warning')
  })

  it('generates budget insights for low CPI', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 1000000, actual_amount: 700000, committed_amount: 0, percent_complete: 50 }],
      50, 50,
    )
    const insights = generateBudgetInsights(ev)
    // CPI = 500K / 700K = 0.714, should trigger critical
    expect(insights.some(i => i.severity === 'critical')).toBe(true)
  })
})
