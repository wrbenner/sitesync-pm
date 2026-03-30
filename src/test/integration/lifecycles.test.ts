import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { rfiMachine, getValidTransitions, getNextStatus as getRFINext, getBallInCourt, getDaysOpen } from '../../machines/rfiMachine'
import { submittalMachine, getNextSubmittalStatus } from '../../machines/submittalMachine'
import { taskMachine, getValidTaskTransitions, getNextTaskStatus } from '../../machines/taskMachine'
import { dailyLogMachine, getNextDailyLogStatus } from '../../machines/dailyLogMachine'
import { punchItemMachine } from '../../machines/punchItemMachine'
import {
  getValidCOTransitions,
  getNextCOStatus,
  getNextCOType,
  formatCONumber,
} from '../../machines/changeOrderMachine'
import { rfiFactory, taskFactory, punchItemFactory, budgetItemFactory, projectFactory } from '../factories'

describe('RFI Lifecycle Integration', () => {
  it('complete lifecycle: draft → open → review → answered → closed', () => {
    const rfi = rfiFactory.build({ status: 'draft' })
    const actor = createActor(rfiMachine)
    actor.start()

    // Creator submits
    expect(actor.getSnapshot().value).toBe('draft')
    expect(getBallInCourt('draft', rfi.created_by, null)).toBe(rfi.created_by)

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('open')

    // PM assigns reviewer
    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('under_review')
    expect(getBallInCourt('under_review', rfi.created_by, 'reviewer-id')).toBe('reviewer-id')

    // Reviewer responds
    actor.send({ type: 'RESPOND', content: 'Use W14x22 connection', userId: 'reviewer-id' })
    expect(actor.getSnapshot().value).toBe('answered')
    expect(getBallInCourt('answered', rfi.created_by, 'reviewer-id')).toBe(rfi.created_by)

    // Creator closes
    actor.send({ type: 'CLOSE', userId: rfi.created_by! })
    expect(actor.getSnapshot().value).toBe('closed')
    expect(getBallInCourt('closed', rfi.created_by, 'reviewer-id')).toBeNull()

    actor.stop()
  })

  it('reopen cycle: closed → open → review → answered → closed', () => {
    const actor = createActor(rfiMachine)
    actor.start()
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')

    actor.send({ type: 'REOPEN', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('open')

    actor.send({ type: 'ASSIGN', assigneeId: 'reviewer' })
    actor.send({ type: 'RESPOND', content: 'Updated answer', userId: 'reviewer' })
    actor.send({ type: 'CLOSE', userId: 'user-1' })
    expect(actor.getSnapshot().value).toBe('closed')
    actor.stop()
  })

  it('days open increases over time', () => {
    const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysOpen(pastDate)).toBeGreaterThanOrEqual(10)
  })
})

describe('Submittal Lifecycle Integration', () => {
  it('complete review chain: draft → submit → GC → A/E → close', () => {
    const actor = createActor(submittalMachine)
    actor.start()
    expect(actor.getSnapshot().context.revisionNumber).toBe(1)

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')

    actor.send({ type: 'GC_APPROVE' })
    expect(actor.getSnapshot().value).toBe('gc_review')

    // GC forwards to architect (BUG #1 FIX: proper review chain)
    actor.send({ type: 'GC_APPROVE' })
    expect(actor.getSnapshot().value).toBe('architect_review')

    actor.send({ type: 'ARCHITECT_APPROVE' })
    expect(actor.getSnapshot().value).toBe('approved')

    actor.send({ type: 'CLOSE' })
    expect(actor.getSnapshot().value).toBe('closed')
    expect(actor.getSnapshot().status).toBe('done')
    actor.stop()
  })

  it('rejection and resubmission bumps revision', () => {
    const actor = createActor(submittalMachine)
    actor.start()

    // First submission rejected by GC
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_REJECT' })
    expect(actor.getSnapshot().value).toBe('rejected')

    // Resubmit as Rev 2
    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    expect(actor.getSnapshot().value).toBe('draft')

    // Second try goes all the way through the full review chain
    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'GC_APPROVE' }) // Forward to architect
    actor.send({ type: 'ARCHITECT_APPROVE' })
    expect(actor.getSnapshot().value).toBe('approved')
    actor.stop()
  })

  it('revise and resubmit from architect review', () => {
    const actor = createActor(submittalMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'GC_APPROVE' })
    actor.send({ type: 'REQUEST_RESUBMIT' })
    expect(actor.getSnapshot().value).toBe('resubmit')

    actor.send({ type: 'RESUBMIT' })
    expect(actor.getSnapshot().context.revisionNumber).toBe(2)
    actor.stop()
  })
})

describe('Task Lifecycle Integration', () => {
  it('todo → start → review → approve (done)', () => {
    const actor = createActor(taskMachine)
    actor.start()

    actor.send({ type: 'START' })
    expect(actor.getSnapshot().value).toBe('in_progress')

    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    expect(actor.getSnapshot().value).toBe('in_review')

    actor.send({ type: 'APPROVE' })
    expect(actor.getSnapshot().value).toBe('done')
    actor.stop()
  })

  it('review rejection sends back to in_progress', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'START' })
    actor.send({ type: 'SUBMIT_FOR_REVIEW' })
    actor.send({ type: 'REJECT' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('direct completion skipping review', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'COMPLETE' })
    expect(actor.getSnapshot().value).toBe('done')
    actor.stop()
  })

  it('reopen from done goes back to todo', () => {
    const actor = createActor(taskMachine)
    actor.start()
    actor.send({ type: 'COMPLETE' })
    actor.send({ type: 'REOPEN' })
    expect(actor.getSnapshot().value).toBe('todo')
    actor.stop()
  })

  it('transition functions match machine behavior', () => {
    expect(getNextTaskStatus('todo', 'Start Work')).toBe('in_progress')
    expect(getNextTaskStatus('in_progress', 'Submit for Review')).toBe('in_review')
    expect(getNextTaskStatus('in_review', 'Approve')).toBe('done')
    expect(getNextTaskStatus('done', 'Reopen')).toBe('todo')
  })
})

describe('Daily Log Lifecycle Integration', () => {
  it('draft → submit → approve', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    expect(actor.getSnapshot().value).toBe('submitted')

    actor.send({ type: 'APPROVE', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('approved')
    expect(actor.getSnapshot().status).toBe('done')
    actor.stop()
  })

  it('draft → submit → reject → resubmit → approve', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'REJECT', comments: 'Missing crew hours', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('rejected')

    // Superintendent revises
    actor.send({ type: 'SAVE_DRAFT' })
    expect(actor.getSnapshot().value).toBe('draft')

    actor.send({ type: 'SUBMIT' })
    actor.send({ type: 'APPROVE', userId: 'pm-1' })
    expect(actor.getSnapshot().value).toBe('approved')
    actor.stop()
  })

  it('save draft stays in draft', () => {
    const actor = createActor(dailyLogMachine)
    actor.start()
    actor.send({ type: 'SAVE_DRAFT' })
    expect(actor.getSnapshot().value).toBe('draft')
    actor.stop()
  })
})

describe('Punch Item Lifecycle Integration', () => {
  it('full lifecycle: open → work → resolve → verify', () => {
    const punchItem = punchItemFactory.build()
    const actor = createActor(punchItemMachine)
    actor.start()

    expect(actor.getSnapshot().value).toBe('open')
    actor.send({ type: 'START_WORK' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.send({ type: 'RESOLVE' })
    expect(actor.getSnapshot().value).toBe('resolved')
    actor.send({ type: 'VERIFY' })
    expect(actor.getSnapshot().value).toBe('verified')
    // Verified is no longer final (can be rejected back to in_progress)
    expect(actor.getSnapshot().status).toBe('active')
    actor.stop()
  })

  it('failed verification sends to rework', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE' })
    actor.send({ type: 'VERIFY' })
    actor.send({ type: 'REJECT_VERIFICATION' })
    expect(actor.getSnapshot().value).toBe('in_progress')
    actor.stop()
  })

  it('failed verification reopens', () => {
    const actor = createActor(punchItemMachine)
    actor.start()
    actor.send({ type: 'START_WORK' })
    actor.send({ type: 'RESOLVE' })
    actor.send({ type: 'REOPEN' })
    expect(actor.getSnapshot().value).toBe('open')
    actor.stop()
  })
})

describe('Change Order Lifecycle Integration', () => {
  it('PCO → COR → CO full promotion lifecycle', () => {
    // Phase 1: PCO
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
    expect(formatCONumber('pco', 1)).toBe('PCO-001')

    // Promote to COR
    expect(getNextCOType('pco')).toBe('cor')
    expect(formatCONumber('cor', 1)).toBe('COR-001')

    // Phase 2: COR through approval
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')

    // Promote to CO
    expect(getNextCOType('cor')).toBe('co')
    expect(formatCONumber('co', 1)).toBe('CO-001')

    // Phase 3: Final CO
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
    expect(getNextCOType('co')).toBeNull() // End of chain
  })

  it('rejection and resubmission', () => {
    expect(getNextCOStatus('draft', 'Submit for Review')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Reject')).toBe('rejected')
    expect(getNextCOStatus('rejected', 'Revise and Resubmit')).toBe('pending_review')
    expect(getNextCOStatus('pending_review', 'Approve')).toBe('approved')
  })

  it('void is terminal', () => {
    expect(getNextCOStatus('pending_review', 'Void')).toBe('void')
    expect(getValidCOTransitions('void')).toEqual([])
  })
})

describe('Factory Data', () => {
  it('rfiFactory produces valid RFI data', () => {
    const rfi = rfiFactory.build()
    expect(rfi.id).toBeTruthy()
    expect(rfi.project_id).toBe('test-project-id')
    expect(rfi.status).toBe('open')
    expect(rfi.created_at).toBeTruthy()
  })

  it('rfiFactory respects overrides', () => {
    const rfi = rfiFactory.build({ status: 'closed', title: 'Custom' })
    expect(rfi.status).toBe('closed')
    expect(rfi.title).toBe('Custom')
  })

  it('rfiFactory.buildList creates multiple', () => {
    const rfis = rfiFactory.buildList(5)
    expect(rfis).toHaveLength(5)
    expect(new Set(rfis.map((r) => r.id)).size).toBe(5) // unique IDs
  })

  it('taskFactory produces valid task data', () => {
    const task = taskFactory.build()
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('medium')
  })

  it('punchItemFactory produces valid data', () => {
    const item = punchItemFactory.build()
    expect(item.status).toBe('open')
    expect(item.location).toBeTruthy()
  })

  it('budgetItemFactory.buildList creates varied divisions', () => {
    const items = budgetItemFactory.buildList(6)
    const divisions = new Set(items.map((i) => i.division))
    expect(divisions.size).toBe(6)
  })

  it('projectFactory produces valid project', () => {
    const project = projectFactory.build()
    expect(project.name).toBe('Test Project')
    expect(project.contract_value).toBeGreaterThan(0)
  })
})
