import { describe, it, expect } from 'vitest'
import {
  buildProjectContext,
  buildBudgetInsightPrompt,
  CONSTRUCTION_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  RFI_DRAFT_PROMPT,
  DAILY_LOG_SUMMARY_PROMPT,
  RISK_ANALYSIS_PROMPT,
  MEETING_MINUTES_PROMPT,
} from './aiPrompts'
import type { ProjectAIContext } from '../types/ai'

function ctx(overrides: Partial<ProjectAIContext> = {}): ProjectAIContext {
  return {
    projectName: 'Test Project',
    contractValue: 1_000_000,
    phase: 'Construction',
    openRfiCount: 0,
    overdueRfiCount: 0,
    budgetVarianceByDivision: [],
    scheduleVarianceDays: null,
    criticalPathActivities: [],
    recentDailyLogSummaries: [],
    activeBallInCourtSubmittals: [],
    pendingChangeOrderExposure: 0,
    ...overrides,
  }
}

describe('aiPrompts — buildProjectContext', () => {
  it('always includes the project header with name + value + phase', () => {
    const r = buildProjectContext(ctx())
    expect(r).toContain('=== PROJECT: Test Project ===')
    expect(r).toContain('Phase: Construction')
  })

  it('formats contract value as a dollar string', () => {
    const r = buildProjectContext(ctx({ contractValue: 5_000_000 }))
    expect(r).toMatch(/\$5/)
  })

  it('falls back to "N/A" when contract value is null', () => {
    const r = buildProjectContext(ctx({ contractValue: null }))
    expect(r).toContain('Contract Value: N/A')
  })

  it('falls back to "N/A" when phase is null', () => {
    const r = buildProjectContext(ctx({ phase: null }))
    expect(r).toContain('Phase: N/A')
  })

  it('always emits the RFIs section with open + overdue counts', () => {
    const r = buildProjectContext(ctx({ openRfiCount: 5, overdueRfiCount: 2 }))
    expect(r).toContain('--- RFIs ---')
    expect(r).toMatch(/Open:\s*5/)
    expect(r).toMatch(/Overdue:\s*2/)
  })

  it('includes top 3 budget divisions by variance', () => {
    const r = buildProjectContext(
      ctx({
        budgetVarianceByDivision: [
          { csiCode: '03', divisionName: 'Concrete', budgetVariancePct: 12, varianceAmount: 50_000 },
          { csiCode: '04', divisionName: 'Masonry',  budgetVariancePct: -5, varianceAmount: -10_000 },
          { csiCode: '05', divisionName: 'Metals',   budgetVariancePct: 0.5, varianceAmount: 1_000 },
          { csiCode: '06', divisionName: 'Wood',     budgetVariancePct: 8,  varianceAmount: 12_000 },
        ],
      }),
    )
    expect(r).toContain('--- Budget')
    expect(r).toContain('CSI 03 Concrete')
    expect(r).toContain('CSI 04 Masonry')
    expect(r).toContain('CSI 05 Metals')
    // 4th item dropped (slice 0..3)
    expect(r).not.toContain('CSI 06 Wood')
  })

  it('omits the budget section entirely when no variance entries', () => {
    const r = buildProjectContext(ctx({ budgetVarianceByDivision: [] }))
    expect(r).not.toContain('--- Budget')
  })

  it('schedule section uses + prefix and "ahead" when variance ≥ 0', () => {
    const r = buildProjectContext(ctx({ scheduleVarianceDays: 3 }))
    expect(r).toContain('+3 days')
    expect(r).toContain('ahead')
  })

  it('schedule section uses "behind" when variance < 0', () => {
    const r = buildProjectContext(ctx({ scheduleVarianceDays: -7 }))
    expect(r).toContain('-7 days')
    expect(r).toContain('behind')
  })

  it('omits schedule section when scheduleVarianceDays is null', () => {
    const r = buildProjectContext(ctx({ scheduleVarianceDays: null }))
    expect(r).not.toContain('--- Schedule ---')
  })

  it('includes top 5 critical-path activities', () => {
    const activities = Array.from({ length: 7 }, (_, i) => ({
      name: `Activity-${i}`,
      finishDate: '2026-06-01',
    }))
    const r = buildProjectContext(ctx({ scheduleVarianceDays: 0, criticalPathActivities: activities }))
    for (let i = 0; i < 5; i++) {
      expect(r).toContain(`Activity-${i}`)
    }
    expect(r).not.toContain('Activity-5')
    expect(r).not.toContain('Activity-6')
  })

  it('truncates daily log summary to 150 chars', () => {
    const longSummary = 'a'.repeat(500)
    const r = buildProjectContext(
      ctx({
        recentDailyLogSummaries: [{ date: '2026-01-01', summary: longSummary }],
      }),
    )
    // 150 a's max in any single line
    expect(r).toContain('a'.repeat(150))
    expect(r).not.toContain('a'.repeat(151))
  })

  it('caps daily logs section at 5 entries', () => {
    const logs = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-0${i}`,
      summary: `Log ${i}`,
    }))
    const r = buildProjectContext(ctx({ recentDailyLogSummaries: logs }))
    expect(r).toContain('Log 0')
    expect(r).toContain('Log 4')
    expect(r).not.toContain('Log 5')
  })

  it('lists active ball-in-court submittals', () => {
    const r = buildProjectContext(
      ctx({
        activeBallInCourtSubmittals: [
          { number: 'SUB-001', title: 'Anchor bolts', assignedTo: 'Architect' },
        ],
      }),
    )
    expect(r).toContain('SUB-001')
    expect(r).toContain('Anchor bolts')
    expect(r).toContain('Architect')
  })

  it('emits pending CO exposure section only when > 0', () => {
    expect(buildProjectContext(ctx({ pendingChangeOrderExposure: 0 }))).not.toContain('Change Order Exposure')
    expect(buildProjectContext(ctx({ pendingChangeOrderExposure: 25_000 }))).toContain('Change Order Exposure')
  })

  it('truncates context if estimated tokens exceed the 3000 limit', () => {
    // ~60 chars × 1000 entries = 60_000 chars / 4 chars-per-token = 15_000 tokens.
    const summaries = Array.from({ length: 1000 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      summary: 'long summary that pads token count significantly',
    }))
    const r = buildProjectContext(ctx({ recentDailyLogSummaries: summaries }))
    // 3000 tokens × 4 chars/token = 12_000 char ceiling
    expect(r.length).toBeLessThanOrEqual(12_000)
  })
})

describe('aiPrompts — buildBudgetInsightPrompt', () => {
  it('embeds the project name and one anomaly per line', () => {
    const r = buildBudgetInsightPrompt(
      [
        { divisionName: 'Concrete', severity: 'critical', message: 'Over budget', variancePct: 15 },
        { divisionName: 'Masonry',  severity: 'warning',  message: '85% spent',   variancePct: 85 },
      ],
      'Maple Ridge',
    )
    expect(r).toContain('"Maple Ridge"')
    expect(r).toMatch(/Concrete\s+\(CRITICAL\)/)
    expect(r).toMatch(/Masonry\s+\(WARNING\)/)
  })

  it('handles an empty anomaly list (still emits the system prompt body)', () => {
    const r = buildBudgetInsightPrompt([], 'P')
    expect(r).toContain('"P"')
  })

  it('forbids hyphens in the response per the instruction', () => {
    const r = buildBudgetInsightPrompt([], 'P')
    expect(r).toMatch(/Do not use hyphens/i)
  })
})

describe('aiPrompts — system prompt constants', () => {
  it('CONSTRUCTION_SYSTEM_PROMPT mentions SiteSync PM and CSI MasterFormat', () => {
    expect(CONSTRUCTION_SYSTEM_PROMPT).toContain('SiteSync PM')
    expect(CONSTRUCTION_SYSTEM_PROMPT).toContain('CSI MasterFormat')
  })

  it('SYSTEM_PROMPT positions itself as the SiteSync PM Copilot', () => {
    expect(SYSTEM_PROMPT).toContain('SiteSync PM Copilot')
  })

  it('RFI_DRAFT_PROMPT references AIA / ConsensusDocs compliance', () => {
    expect(RFI_DRAFT_PROMPT).toMatch(/AIA/)
    expect(RFI_DRAFT_PROMPT).toMatch(/ConsensusDocs/)
  })

  it('DAILY_LOG_SUMMARY_PROMPT mentions owner reporting + record keeping', () => {
    expect(DAILY_LOG_SUMMARY_PROMPT).toMatch(/owner reporting/)
  })

  it('RISK_ANALYSIS_PROMPT mentions the four risk dimensions', () => {
    expect(RISK_ANALYSIS_PROMPT).toMatch(/schedule/)
    expect(RISK_ANALYSIS_PROMPT).toMatch(/budget/)
    expect(RISK_ANALYSIS_PROMPT).toMatch(/safety/)
    expect(RISK_ANALYSIS_PROMPT).toMatch(/quality/)
  })

  it('MEETING_MINUTES_PROMPT mentions structured output for stakeholders', () => {
    expect(MEETING_MINUTES_PROMPT).toMatch(/stakeholders/)
  })
})
