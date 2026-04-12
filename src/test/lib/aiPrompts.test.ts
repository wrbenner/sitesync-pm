import { describe, it, expect } from 'vitest'
import {
  buildProjectContext,
  buildBudgetInsightPrompt,
  CONSTRUCTION_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  RFI_DRAFT_PROMPT,
  DAILY_LOG_SUMMARY_PROMPT,
  RISK_ANALYSIS_PROMPT,
} from '../../lib/aiPrompts'
import type { ProjectAIContext } from '../../types/ai'
import type { BudgetAnomaly } from '../../lib/financialEngine'

function makeProjectContext(overrides?: Partial<ProjectAIContext>): ProjectAIContext {
  return {
    projectName: 'Test Tower',
    contractValue: 42_800_000,
    phase: 'Construction',
    openRfiCount: 6,
    overdueRfiCount: 2,
    budgetVarianceByDivision: [],
    scheduleVarianceDays: null,
    criticalPathActivities: [],
    recentDailyLogSummaries: [],
    activeBallInCourtSubmittals: [],
    pendingChangeOrderExposure: 0,
    ...overrides,
  }
}

describe('buildProjectContext', () => {
  it('should include the project name', () => {
    const result = buildProjectContext(makeProjectContext({ projectName: 'Central Station' }))
    expect(result).toContain('Central Station')
  })

  it('should include contract value formatted as dollars', () => {
    const result = buildProjectContext(makeProjectContext({ contractValue: 42_800_000 }))
    expect(result).toContain('$42.80M')
  })

  it('should show N/A for null contract value', () => {
    const result = buildProjectContext(makeProjectContext({ contractValue: null }))
    expect(result).toContain('N/A')
  })

  it('should include phase when present', () => {
    const result = buildProjectContext(makeProjectContext({ phase: 'Foundation' }))
    expect(result).toContain('Foundation')
  })

  it('should show N/A for null phase', () => {
    const result = buildProjectContext(makeProjectContext({ phase: null }))
    expect(result).toContain('N/A')
  })

  it('should include open and overdue RFI counts', () => {
    const result = buildProjectContext(makeProjectContext({ openRfiCount: 8, overdueRfiCount: 3 }))
    expect(result).toContain('Open: 8')
    expect(result).toContain('Overdue: 3')
  })

  it('should include budget variance when divisions present', () => {
    const ctx = makeProjectContext({
      budgetVarianceByDivision: [
        { csiCode: '03', divisionName: 'Concrete', budgetVariancePct: -8.5, varianceAmount: -120_000 },
      ],
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('Concrete')
    expect(result).toContain('-8.5%')
  })

  it('should limit budget variance output to top 3 divisions', () => {
    const ctx = makeProjectContext({
      budgetVarianceByDivision: [
        { csiCode: '03', divisionName: 'Concrete', budgetVariancePct: -8.5, varianceAmount: -120_000 },
        { csiCode: '05', divisionName: 'Structural Steel', budgetVariancePct: -12.0, varianceAmount: -200_000 },
        { csiCode: '23', divisionName: 'HVAC', budgetVariancePct: -3.0, varianceAmount: -40_000 },
        { csiCode: '26', divisionName: 'Electrical', budgetVariancePct: -1.0, varianceAmount: -10_000 },
      ],
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('Concrete')
    expect(result).toContain('Structural Steel')
    expect(result).toContain('HVAC')
    expect(result).not.toContain('Electrical')
  })

  it('should include schedule variance when present', () => {
    const result = buildProjectContext(makeProjectContext({ scheduleVarianceDays: 4 }))
    expect(result).toContain('+4')
    expect(result).toContain('ahead')
  })

  it('should show behind when schedule variance is negative', () => {
    const result = buildProjectContext(makeProjectContext({ scheduleVarianceDays: -3 }))
    expect(result).toContain('behind')
  })

  it('should include critical path activities', () => {
    const ctx = makeProjectContext({
      criticalPathActivities: [
        { name: 'MEP Rough In', finishDate: '2026-05-01' },
      ],
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('MEP Rough In')
    expect(result).toContain('2026-05-01')
  })

  it('should limit critical path to 5 activities', () => {
    const ctx = makeProjectContext({
      criticalPathActivities: Array.from({ length: 7 }, (_, i) => ({
        name: `Activity ${i + 1}`,
        finishDate: `2026-05-${String(i + 1).padStart(2, '0')}`,
      })),
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('Activity 5')
    expect(result).not.toContain('Activity 6')
  })

  it('should include recent daily log summaries', () => {
    const ctx = makeProjectContext({
      recentDailyLogSummaries: [
        { date: '2026-04-10', summary: 'Concrete pour on Level 3 completed' },
      ],
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('2026-04-10')
    expect(result).toContain('Concrete pour on Level 3 completed')
  })

  it('should include ball in court submittals', () => {
    const ctx = makeProjectContext({
      activeBallInCourtSubmittals: [
        { number: 'SUB-007', title: 'HVAC Equipment', assignedTo: 'Architect' },
      ],
    })
    const result = buildProjectContext(ctx)
    expect(result).toContain('SUB-007')
    expect(result).toContain('HVAC Equipment')
    expect(result).toContain('Architect')
  })

  it('should include pending change order exposure when nonzero', () => {
    const result = buildProjectContext(
      makeProjectContext({ pendingChangeOrderExposure: 485_000 })
    )
    expect(result).toContain('$485K')
  })

  it('should not include change order section when exposure is zero', () => {
    const result = buildProjectContext(makeProjectContext({ pendingChangeOrderExposure: 0 }))
    expect(result).not.toContain('Pending Change Order')
  })

  it('should return a string (never throws)', () => {
    expect(() => buildProjectContext(makeProjectContext())).not.toThrow()
  })

  it('should truncate context that exceeds token limit', () => {
    const longSummary = 'x'.repeat(20_000)
    const ctx = makeProjectContext({
      recentDailyLogSummaries: [{ date: '2026-04-10', summary: longSummary }],
    })
    const result = buildProjectContext(ctx)
    // CONTEXT_TOKEN_LIMIT is 3000 tokens = 12000 chars
    expect(result.length).toBeLessThanOrEqual(12_000)
  })

  it('should format contract value in thousands (K) for sub-million amounts', () => {
    const result = buildProjectContext(makeProjectContext({ contractValue: 850_000 }))
    expect(result).toContain('$850K')
  })
})

describe('buildBudgetInsightPrompt', () => {
  it('should include project name in prompt', () => {
    const anomalies: BudgetAnomaly[] = []
    const result = buildBudgetInsightPrompt(anomalies, 'Downtown Tower')
    expect(result).toContain('Downtown Tower')
  })

  it('should include anomaly details', () => {
    const anomalies: BudgetAnomaly[] = [
      {
        divisionName: 'Concrete',
        severity: 'critical',
        message: 'Concrete is 18% over budget',
        variancePct: -18,
      },
    ]
    const result = buildBudgetInsightPrompt(anomalies, 'Test Project')
    expect(result).toContain('Concrete')
    expect(result).toContain('CRITICAL')
    expect(result).toContain('18% over budget')
  })

  it('should include multiple anomalies', () => {
    const anomalies: BudgetAnomaly[] = [
      { divisionName: 'Concrete', severity: 'critical', message: 'Concrete overrun', variancePct: -18 },
      { divisionName: 'Site Work', severity: 'warning', message: 'Site work overrun', variancePct: -7 },
    ]
    const result = buildBudgetInsightPrompt(anomalies, 'Test Project')
    expect(result).toContain('Concrete')
    expect(result).toContain('Site Work')
  })

  it('should instruct not to use hyphens', () => {
    const result = buildBudgetInsightPrompt([], 'Test')
    expect(result).toContain('Do not use hyphens')
  })

  it('should address construction superintendent audience', () => {
    const result = buildBudgetInsightPrompt([], 'Test')
    expect(result.toLowerCase()).toContain('superintendent')
  })

  it('should return a non-empty string', () => {
    const result = buildBudgetInsightPrompt([], 'Test')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('Prompt constants', () => {
  it('CONSTRUCTION_SYSTEM_PROMPT should be a non-empty string', () => {
    expect(typeof CONSTRUCTION_SYSTEM_PROMPT).toBe('string')
    expect(CONSTRUCTION_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it('CONSTRUCTION_SYSTEM_PROMPT should mention construction expertise', () => {
    expect(CONSTRUCTION_SYSTEM_PROMPT.toLowerCase()).toContain('construction')
  })

  it('SYSTEM_PROMPT should be a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string')
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it('SYSTEM_PROMPT should instruct not to use hyphens', () => {
    expect(SYSTEM_PROMPT).toContain('hyphens')
  })

  it('RFI_DRAFT_PROMPT should reference AIA or ConsensusDocs', () => {
    expect(RFI_DRAFT_PROMPT).toContain('AIA')
  })

  it('DAILY_LOG_SUMMARY_PROMPT should mention weather', () => {
    expect(DAILY_LOG_SUMMARY_PROMPT.toLowerCase()).toContain('weather')
  })

  it('RISK_ANALYSIS_PROMPT should mention severity levels', () => {
    expect(RISK_ANALYSIS_PROMPT).toContain('critical')
    expect(RISK_ANALYSIS_PROMPT).toContain('warning')
  })
})
