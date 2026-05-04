import { describe, it, expect, vi } from 'vitest'

import type { StreamItem } from '../../../types/stream'
import { generateIrisDraft } from '../drafts'
import { DRAFT_TEMPLATES } from '../templates'
import type { ProjectContextSnapshot } from '../types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const triggerItem: StreamItem = {
  id: 'owner-update-trigger',
  type: 'task',
  cardType: 'draft',
  title: 'Owner Update',
  reason: 'On-demand from Reports',
  urgency: 'medium',
  dueDate: null,
  assignedTo: null,
  waitingOnYou: false,
  overdue: false,
  createdAt: new Date().toISOString(),
  sourceData: null,
  sourceTrail: [],
  actions: [],
  irisEnhancement: {
    draftAvailable: true,
    draftType: 'owner_update',
    confidence: 0.5,
    summary: 'Draft owner update',
  },
}

const richContext: ProjectContextSnapshot = {
  projectId: 'p1',
  projectName: 'Merritt Crossing',
  userName: 'Alex PM',
  reportingPeriodDays: 7,
  scheduleStatus: {
    behindActivities: [
      { name: 'Storefront install', daysBehind: 4, sourceLabel: 'Schedule activity #142' },
      { name: 'Roof TPO', daysBehind: 2, sourceLabel: 'Schedule activity #138' },
    ],
    milestonesHit: [
      { name: 'Slab pour complete', dateLabel: 'Apr 22', sourceLabel: 'Milestone M-04' },
    ],
    milestonesMissed: [],
  },
  budgetStatus: {
    percentCommitted: 82.4,
    approvedTotal: 14_500_000,
    changeOrderExposure: 245_000,
    sourceLabel: 'Cost Codes — committed vs approved',
  },
  topRisks: [
    { title: 'Storefront submittal stalled', summary: '12 days past due, blocks dry-in', sourceLabel: 'Risk card: storefront-submittal' },
    { title: 'Site water table rising', summary: 'May affect Footing F-7 schedule', sourceLabel: 'Daily log on April 26' },
    { title: 'AHU 4 lead time slipped', summary: 'Now 14 weeks vs 10', sourceLabel: 'Procurement log' },
  ],
  decisionsNeeded: [
    { title: 'Storefront color', summary: 'Need owner sign-off on bronze vs black anodized', sourceLabel: 'RFI #247' },
  ],
  progressHighlights: [
    { summary: 'Level 3 framing 95% complete', sourceLabel: 'Daily log on April 29' },
    { summary: 'Underground plumbing inspected and approved', sourceLabel: 'Inspection log' },
  ],
  lookahead14Days: [
    { activity: 'Roof TPO weld-down', dateLabel: 'May 6–10', sourceLabel: 'Schedule activity #138' },
    { activity: 'MEP rough-in level 4', dateLabel: 'May 8–14', sourceLabel: 'Schedule activity #155' },
  ],
}

const sparseContext: ProjectContextSnapshot = {
  projectId: 'p2',
  projectName: 'Tiny Tenant Improvement',
  userName: null,
}

// ── Template-level tests ────────────────────────────────────────────────────

describe('owner_update template', () => {
  const tmpl = DRAFT_TEMPLATES.owner_update

  it('returns a 0.5 confidence — owner update needs significant review', () => {
    expect(tmpl.confidence).toBe(0.5)
  })

  it('builds a prompt that includes every required section heading', () => {
    const prompt = tmpl.buildPrompt(triggerItem, richContext)
    expect(prompt).toContain('Schedule status:')
    expect(prompt).toContain('Budget status:')
    expect(prompt).toContain('Top risks')
    expect(prompt).toContain('Decisions needed from owner:')
    expect(prompt).toContain('Progress highlights:')
    expect(prompt).toContain('Lookahead — next 14 days:')
  })

  it('cites at least one source per populated section in the prompt', () => {
    const prompt = tmpl.buildPrompt(triggerItem, richContext)
    expect(prompt).toContain('Schedule activity #142')          // schedule
    expect(prompt).toContain('Cost Codes — committed vs approved') // budget
    expect(prompt).toContain('Risk card: storefront-submittal') // risks
    expect(prompt).toContain('RFI #247')                         // decisions
    expect(prompt).toContain('Daily log on April 29')             // progress
    expect(prompt).toContain('Schedule activity #155')           // lookahead
  })

  it('includes the project name and reporting period in the prompt', () => {
    const prompt = tmpl.buildPrompt(triggerItem, richContext)
    expect(prompt).toContain('Merritt Crossing')
    expect(prompt).toMatch(/last 7 days/)
  })

  it('formats the budget number with %, dollars, and CO exposure', () => {
    const prompt = tmpl.buildPrompt(triggerItem, richContext)
    expect(prompt).toContain('82.4% committed')
    expect(prompt).toContain('$14,500,000')
    expect(prompt).toContain('$245,000')
  })

  it('writes "No material change" for empty sections instead of inventing', () => {
    const prompt = tmpl.buildPrompt(triggerItem, sparseContext)
    // Each empty section gets the placeholder bullet.
    const occurrences = prompt.match(/No material change/g) ?? []
    // Schedule + Budget + Risks + Decisions + Progress + Lookahead = 6.
    expect(occurrences.length).toBeGreaterThanOrEqual(6)
  })

  it('still produces a coherent prompt even with sparse context (no throws)', () => {
    expect(() => tmpl.buildPrompt(triggerItem, sparseContext)).not.toThrow()
    const prompt = tmpl.buildPrompt(triggerItem, sparseContext)
    expect(prompt.length).toBeGreaterThan(200)
    expect(prompt).toContain('Tiny Tenant Improvement')
  })

  it('getSources de-duplicates and includes every populated section source', () => {
    const sources = tmpl.getSources(triggerItem, richContext)
    expect(sources).toContain('Schedule activity #142')
    expect(sources).toContain('Cost Codes — committed vs approved')
    expect(sources).toContain('Risk card: storefront-submittal')
    expect(sources).toContain('RFI #247')
    expect(sources).toContain('Daily log on April 29')
    expect(sources).toContain('Schedule activity #155')
    // No duplicates.
    expect(new Set(sources).size).toBe(sources.length)
  })

  it('falls back to a generic source label when context has zero data', () => {
    const sources = tmpl.getSources(triggerItem, sparseContext)
    expect(sources.length).toBeGreaterThan(0)
    expect(sources[0]).toMatch(/snapshot/i)
  })
})

// ── End-to-end via generateIrisDraft (LLM stubbed) ──────────────────────────

describe('generateIrisDraft — owner_update path', () => {
  const fakeBody =
    'Owner update: Merritt Crossing, last 7 days. Schedule: storefront install is 4 days behind. ' +
    'Budget: 82.4% committed of approved. Key risks: storefront submittal stalled. ' +
    'Decisions needed: storefront color sign-off. Progress: level 3 framing 95% complete. ' +
    'Lookahead: roof TPO weld-down May 6–10. — Alex PM'

  it('returns a non-empty draft with status pending and 0.5 confidence', async () => {
    const generate = vi.fn().mockResolvedValue({ text: fakeBody })
    // The real generateText returns much more — for our purposes only `text`
    // matters. Cast through unknown to satisfy the strict signature.
    const draft = await generateIrisDraft(triggerItem, richContext, {
      generate: generate as unknown as typeof import('ai').generateText,
    } as never)
    expect(draft.content.length).toBeGreaterThan(0)
    expect(draft.status).toBe('pending')
    expect(draft.confidence).toBe(0.5)
    expect(draft.type).toBe('owner_update')
    expect(draft.id).toBe(triggerItem.id)
  })

  it('passes a prompt covering every section to the model', async () => {
    let capturedPrompt = ''
    const generate = vi.fn(async (args: { prompt: string }) => {
      capturedPrompt = args.prompt
      return { text: fakeBody }
    })
    await generateIrisDraft(triggerItem, richContext, {
      generate: generate as unknown as typeof import('ai').generateText,
    } as never)
    expect(capturedPrompt).toContain('Schedule status:')
    expect(capturedPrompt).toContain('Budget status:')
    expect(capturedPrompt).toContain('Top risks')
    expect(capturedPrompt).toContain('Decisions needed from owner:')
  })

  it('attaches the de-duped source labels to the draft', async () => {
    const generate = vi.fn().mockResolvedValue({ text: fakeBody })
    const draft = await generateIrisDraft(triggerItem, richContext, {
      generate: generate as unknown as typeof import('ai').generateText,
    } as never)
    expect(draft.sources).toContain('Schedule activity #142')
    expect(draft.sources).toContain('Cost Codes — committed vs approved')
    expect(draft.sources).toContain('Risk card: storefront-submittal')
    expect(draft.sources.length).toBeGreaterThanOrEqual(3)
  })

  it('returns gracefully (no throws) when project data is sparse', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: 'Brief update — no material change across schedule, budget, risks, or lookahead.',
    })
    const draft = await generateIrisDraft(triggerItem, sparseContext, {
      generate: generate as unknown as typeof import('ai').generateText,
    } as never)
    expect(draft.content.length).toBeGreaterThan(0)
    expect(draft.status).toBe('pending')
  })
})
