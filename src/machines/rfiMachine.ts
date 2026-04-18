import { setup, fromPromise } from 'xstate'
import { colors } from '../styles/theme'
import type { CreateRfiPayload } from '../types/api'

export type RFIState = 'draft' | 'open' | 'under_review' | 'answered' | 'closed' | 'void'

// Actor factory for production. Inject via rfiMachine.provide({ actors: createRfiActors(...) }).
// The machine's setup() uses no-op placeholders so tests run without real API calls.
export function createRfiActors(
  createFn: (projectId: string, payload: CreateRfiPayload) => Promise<unknown>,
  updateFn: (projectId: string, id: string, updates: Partial<CreateRfiPayload> & { status?: string }) => Promise<unknown>
) {
  return {
    persistCreate: fromPromise(({ input }: { input: { projectId: string; payload: CreateRfiPayload } }) =>
      input.projectId ? createFn(input.projectId, input.payload) : Promise.resolve(null)
    ),
    persistTransition: fromPromise(({ input }: { input: { projectId: string; rfiId: string; status: string } }) =>
      input.rfiId ? updateFn(input.projectId, input.rfiId, { status: input.status }) : Promise.resolve(null)
    ),
  }
}

export interface RFITransition {
  from: RFIState
  to: RFIState
  timestamp: string
  userId: string
  reason?: string
}

export const rfiMachine = setup({
  types: {
    context: {} as {
      rfiId: string
      projectId: string
      transitions: RFITransition[]
      error: string | null
    },
    events: {} as
      | { type: 'SUBMIT' }
      | { type: 'ASSIGN'; assigneeId: string }
      | { type: 'START_REVIEW' }
      | { type: 'RESPOND'; content: string; userId: string }
      | { type: 'CLOSE'; userId: string }
      | { type: 'REOPEN'; userId: string }
      | { type: 'VOID'; userId: string; reason: string },
  },
  // No-op placeholders. Override in production:
  //   rfiMachine.provide({ actors: createRfiActors(createRfi, updateRfi) })
  actors: {
    persistCreate: fromPromise<unknown, { projectId: string; payload: CreateRfiPayload }>(
      () => Promise.resolve(null)
    ),
    persistTransition: fromPromise<unknown, { projectId: string; rfiId: string; status: string }>(
      () => Promise.resolve(null)
    ),
  },
}).createMachine({
  id: 'rfi',
  initial: 'draft',
  context: { rfiId: '', projectId: '', transitions: [], error: null },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'open' },
        VOID: { target: 'void' },
      },
    },
    open: {
      on: {
        ASSIGN: { target: 'under_review' },
        CLOSE: { target: 'closed' },
        VOID: { target: 'void' },
      },
    },
    under_review: {
      on: {
        RESPOND: { target: 'answered' },
        CLOSE: { target: 'closed' },
        VOID: { target: 'void' },
      },
    },
    answered: {
      on: {
        CLOSE: { target: 'closed' },
        REOPEN: { target: 'open' },
        VOID: { target: 'void' },
      },
    },
    closed: {
      on: {
        REOPEN: { target: 'open' },
        VOID: { target: 'void' },
      },
    },
    void: {
      type: 'final',
    },
  },
})

// ── Valid Target States (state-to-state, for service-layer validation) ────────

/**
 * Returns valid target RFIState values for a given current state and role.
 * Used by rfiService.transitionStatus() for lifecycle enforcement.
 * Role groups: admin/owner can void from any non-final state.
 */
export function getValidRfiTargetStates(status: RFIState, userRole: string = 'viewer'): RFIState[] {
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'

  const base: Record<RFIState, RFIState[]> = {
    draft: ['open'],
    open: ['under_review', 'closed'],
    under_review: ['answered', 'closed'],
    answered: ['closed', 'open'],
    closed: ['open'],
    void: [],
  }

  const result: RFIState[] = [...(base[status] || [])]

  if (isAdminOrOwner && status !== 'void') {
    result.push('void')
  }

  return result
}

// ── Valid Transitions ────────────────────────────────────

// BUG #4 FIX: Accept userRole parameter. Void only available to admin/owner.
export function getValidTransitions(status: RFIState, userRole: string = 'viewer'): string[] {
  const isAdminOrOwner = userRole === 'admin' || userRole === 'owner'

  const base: Record<RFIState, string[]> = {
    draft: ['Submit'],
    open: ['Assign for Review', 'Close'],
    under_review: ['Respond', 'Close'],
    answered: ['Close', 'Reopen'],
    closed: ['Reopen'],
    void: [],
  }

  const result = [...(base[status] || [])]

  // BUG #4 FIX: Only admin/owner can void. Non-admin users never see void option.
  if (isAdminOrOwner && status !== 'void') {
    result.push('Void')
  }

  return result
}

// ── Next Status ──────────────────────────────────────────

export function getNextStatus(currentStatus: RFIState, action: string): RFIState | null {
  const map: Record<string, Record<string, RFIState>> = {
    draft: { 'Submit': 'open', 'Void': 'void' },
    open: { 'Assign for Review': 'under_review', 'Close': 'closed', 'Void': 'void' },
    under_review: { 'Respond': 'answered', 'Close': 'closed', 'Void': 'void' },
    answered: { 'Close': 'closed', 'Reopen': 'open', 'Void': 'void' },
    closed: { 'Reopen': 'open', 'Void': 'void' },
  }
  return map[currentStatus]?.[action] || null
}

// ── Ball in Court ────────────────────────────────────────

export function getBallInCourt(status: RFIState, createdBy: string | null, assignedTo: string | null): string | null {
  switch (status) {
    case 'draft':
    case 'open':
      return assignedTo || createdBy
    case 'under_review':
      return assignedTo
    case 'answered':
      return createdBy
    case 'closed':
    case 'void':
      return null
    default:
      return null
  }
}

// ── Due Date Urgency ─────────────────────────────────────

export function getDueDateUrgency(dueDate: string | null): { color: string; label: string } {
  if (!dueDate) return { color: colors.statusNeutral, label: 'No due date' }
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { color: colors.statusCritical, label: `${Math.abs(days)} days overdue` }
  if (days <= 3) return { color: colors.statusPending, label: `Due in ${days} days` }
  return { color: colors.statusActive, label: `Due in ${days} days` }
}

// ── Days Open ────────────────────────────────────────────

export function getDaysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.max(0, Math.ceil((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)))
}

// ── Status Display ───────────────────────────────────────

export function getRFIStatusConfig(status: RFIState) {
  const config: Record<RFIState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    open: { label: 'Open', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    under_review: { label: 'Under Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    answered: { label: 'Answered', color: colors.statusActive, bg: colors.statusActiveSubtle },
    closed: { label: 'Closed', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    void: { label: 'Void', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.draft
}
