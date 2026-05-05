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
  COLLABORATION_BLOCKER_PROMPT,
  DRAWING_ANALYSIS_PROMPT,
  FIELD_PHOTO_COMPARISON_PROMPT,
  DISCREPANCY_EXPLANATION_PROMPT,
  AI_COPILOT_DRAWING_TOOLS,
} from './aiPrompts'
import type { ProjectAIContext } from '../types/ai'
import type { BudgetAnomaly } from './financialEngine'

const ctx = (over: Partial<ProjectAIContext> = {}): ProjectAIContext => ({
  projectName: 'Maple Ridge',
  contractValue: 5_400_000,
  phase: 'construction',
  openRfiCount: 4,
  overdueRfiCount: 1,
  budgetVarianceByDivision: [],
  scheduleVarianceDays: null,
  criticalPathActivities: [],
  recentDailyLogSummaries: [],
  activeBallInCourtSubmittals: [],
  pendingChangeOrderExposure: 0,
  ...over,
})

describe('buildProjectContext', () => {
  it('renders the project header with formatted contract value', () => {
    const out = buildProjectContext(ctx())
    expect(out).toMatch(/=== PROJECT: Maple Ridge ===/)
    expect(out).toMatch(/Contract Value: \$5\.40M/)
  })

  it('shows N/A when contract value is null', () => {
    expect(buildProjectContext(ctx({ contractValue: null }))).toMatch(
      /Contract Value: N\/A/,
    )
  })

  it('uses N/A when phase is null', () => {
    expect(buildProjectContext(ctx({ phase: null }))).toMatch(/Phase: N\/A/)
  })

  it('always includes RFI counts', () => {
    expect(buildProjectContext(ctx())).toMatch(/Open: 4 \| Overdue: 1/)
  })

  it('omits the schedule section when scheduleVarianceDays is null', () => {
    expect(buildProjectContext(ctx())).not.toMatch(/--- Schedule ---/)
  })

  it('marks "ahead" for non-negative schedule variance', () => {
    expect(
      buildProjectContext(ctx({ scheduleVarianceDays: 3 })),
    ).toMatch(/Variance: \+3 days \(ahead\)/)
  })

  it('marks "behind" for negative schedule variance', () => {
    expect(
      buildProjectContext(ctx({ scheduleVarianceDays: -7 })),
    ).toMatch(/Variance: -7 days \(behind\)/)
  })

  it('renders top 3 budget variance divisions with CSI label', () => {
    const out = buildProjectContext(
      ctx({
        budgetVarianceByDivision: [
          { csiCode: '03', divisionName: 'Concrete', budgetVariancePct: 12.3, varianceAmount: 25000 },
          { csiCode: null, divisionName: 'General', budgetVariancePct: -3.1, varianceAmount: -1500 },
        ],
      }),
    )
    expect(out).toMatch(/CSI 03 Concrete/)
    expect(out).toMatch(/General/)
    expect(out).toMatch(/\+12\.3%/)
    expect(out).toMatch(/-3\.1%/)
    expect(out).toMatch(/Variance \+\$25K/)
  })

  it('caps budget divisions at 3', () => {
    const list = Array.from({ length: 6 }, (_, i) => ({
      csiCode: `0${i}`,
      divisionName: `D${i}`,
      budgetVariancePct: i,
      varianceAmount: i * 1000,
    }))
    const out = buildProjectContext(ctx({ budgetVarianceByDivision: list }))
    expect(out).toMatch(/CSI 00 D0/)
    expect(out).toMatch(/CSI 02 D2/)
    expect(out).not.toMatch(/CSI 03 D3/)
  })

  it('renders critical path activities up to 5', () => {
    const out = buildProjectContext(
      ctx({
        scheduleVarianceDays: 0,
        criticalPathActivities: Array.from({ length: 7 }, (_, i) => ({
          name: `Act${i}`,
          finishDate: '2026-06-01',
        })),
      }),
    )
    expect(out).toMatch(/Act0/)
    expect(out).toMatch(/Act4/)
    expect(out).not.toMatch(/Act5/)
  })

  it('renders daily log summaries up to 5 with truncation', () => {
    const long = 'x'.repeat(300)
    const out = buildProjectContext(
      ctx({
        recentDailyLogSummaries: [
          { date: '2026-04-30', summary: long },
        ],
      }),
    )
    expect(out).toMatch(/\[2026-04-30\]/)
    // Truncates summaries to 150 chars in the rendered line
    const idx = out.indexOf('2026-04-30')
    expect(out.slice(idx).slice(0, 200).length).toBeGreaterThan(0)
  })

  it('renders submittals section when ball-in-court items exist', () => {
    const out = buildProjectContext(
      ctx({
        activeBallInCourtSubmittals: [
          { number: 'SUB-3', title: 'HVAC', assignedTo: 'Acme HVAC' },
        ],
      }),
    )
    expect(out).toMatch(/SUB-3 "HVAC": waiting on Acme HVAC/)
  })

  it('renders pending change order exposure when > 0', () => {
    expect(
      buildProjectContext(ctx({ pendingChangeOrderExposure: 12_000 })),
    ).toMatch(/Total: \$12K/)
  })

  it('omits change order exposure when zero', () => {
    expect(buildProjectContext(ctx())).not.toMatch(/Pending Change Order/)
  })

  it('formats values < 1000 as raw dollars', () => {
    expect(
      buildProjectContext(ctx({ pendingChangeOrderExposure: 750 })),
    ).toMatch(/Total: \$750/)
  })

  it('truncates output when token estimate exceeds 3000', () => {
    const huge = 'x'.repeat(20_000)
    const out = buildProjectContext(
      ctx({
        recentDailyLogSummaries: Array.from({ length: 5 }, () => ({
          date: '2026-04-30',
          summary: huge,
        })),
      }),
    )
    // 3000 tokens × 4 chars/token = 12_000 char ceiling
    expect(out.length).toBeLessThanOrEqual(12_000)
  })
})

describe('buildBudgetInsightPrompt', () => {
  const anomaly = (over: Partial<BudgetAnomaly> = {}): BudgetAnomaly =>
    ({
      divisionName: 'Concrete',
      severity: 'warning',
      message: 'Trending +8%',
      ...over,
    } as BudgetAnomaly)

  it('embeds the project name', () => {
    expect(
      buildBudgetInsightPrompt([anomaly()], 'Maple Ridge'),
    ).toMatch(/"Maple Ridge"/)
  })

  it('includes one line per anomaly with uppercase severity', () => {
    const out = buildBudgetInsightPrompt(
      [anomaly(), anomaly({ divisionName: 'Steel', severity: 'critical' })],
      'P',
    )
    expect(out).toMatch(/Concrete \(WARNING\):/)
    expect(out).toMatch(/Steel \(CRITICAL\):/)
  })

  it('forbids hyphens (per voice guide)', () => {
    expect(
      buildBudgetInsightPrompt([anomaly()], 'P'),
    ).toMatch(/Do not use hyphens/)
  })

  it('handles an empty anomaly list', () => {
    const out = buildBudgetInsightPrompt([], 'Empty')
    expect(out).toMatch(/"Empty"/)
    expect(out).toMatch(/the following cost anomalies/i)
  })
})

describe('exported system prompts', () => {
  it.each([
    ['CONSTRUCTION_SYSTEM_PROMPT', CONSTRUCTION_SYSTEM_PROMPT],
    ['SYSTEM_PROMPT', SYSTEM_PROMPT],
    ['RFI_DRAFT_PROMPT', RFI_DRAFT_PROMPT],
    ['DAILY_LOG_SUMMARY_PROMPT', DAILY_LOG_SUMMARY_PROMPT],
    ['RISK_ANALYSIS_PROMPT', RISK_ANALYSIS_PROMPT],
    ['MEETING_MINUTES_PROMPT', MEETING_MINUTES_PROMPT],
    ['COLLABORATION_BLOCKER_PROMPT', COLLABORATION_BLOCKER_PROMPT],
    ['DRAWING_ANALYSIS_PROMPT', DRAWING_ANALYSIS_PROMPT],
    ['FIELD_PHOTO_COMPARISON_PROMPT', FIELD_PHOTO_COMPARISON_PROMPT],
    ['DISCREPANCY_EXPLANATION_PROMPT', DISCREPANCY_EXPLANATION_PROMPT],
  ])('%s is a non-empty string', (_name, prompt) => {
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(50)
  })

  it.each([
    ['SYSTEM_PROMPT', SYSTEM_PROMPT],
    ['RFI_DRAFT_PROMPT', RFI_DRAFT_PROMPT],
    ['DAILY_LOG_SUMMARY_PROMPT', DAILY_LOG_SUMMARY_PROMPT],
    ['RISK_ANALYSIS_PROMPT', RISK_ANALYSIS_PROMPT],
    ['MEETING_MINUTES_PROMPT', MEETING_MINUTES_PROMPT],
    ['COLLABORATION_BLOCKER_PROMPT', COLLABORATION_BLOCKER_PROMPT],
    ['DRAWING_ANALYSIS_PROMPT', DRAWING_ANALYSIS_PROMPT],
    ['FIELD_PHOTO_COMPARISON_PROMPT', FIELD_PHOTO_COMPARISON_PROMPT],
    ['DISCREPANCY_EXPLANATION_PROMPT', DISCREPANCY_EXPLANATION_PROMPT],
  ])('%s instructs no hyphens', (_name, prompt) => {
    expect(prompt).toMatch(/[Dd]o not use hyphens|[Nn]ever use hyphens/)
  })
})

describe('AI_COPILOT_DRAWING_TOOLS', () => {
  it('exposes the five drawing-intelligence tools', () => {
    expect(AI_COPILOT_DRAWING_TOOLS).toHaveLength(5)
    const names = AI_COPILOT_DRAWING_TOOLS.map((t) => t.name)
    expect(names).toContain('get_drawing_metadata')
    expect(names).toContain('analyze_pair_relationships')
    expect(names).toContain('get_discrepancy_stats')
    expect(names).toContain('trigger_clash_analysis')
    expect(names).toContain('compare_field_photo_to_drawing')
  })

  it('every tool declares object schema with required parameters', () => {
    for (const tool of AI_COPILOT_DRAWING_TOOLS) {
      expect(tool.parameters.type).toBe('object')
      expect(Array.isArray(tool.parameters.required)).toBe(true)
      expect(tool.parameters.required.length).toBeGreaterThan(0)
      for (const req of tool.parameters.required) {
        expect(tool.parameters.properties).toHaveProperty(req)
      }
    }
  })

  it('every tool has a non-empty description', () => {
    for (const tool of AI_COPILOT_DRAWING_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20)
    }
  })
})
