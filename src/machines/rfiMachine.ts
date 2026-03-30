import { setup } from 'xstate'

export type RFIState = 'draft' | 'open' | 'under_review' | 'answered' | 'closed' | 'void'

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
  if (!dueDate) return { color: '#8C8580', label: 'No due date' }
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { color: '#C93B3B', label: `${Math.abs(days)} days overdue` }
  if (days <= 3) return { color: '#C4850C', label: `Due in ${days} days` }
  return { color: '#2D8A6E', label: `Due in ${days} days` }
}

// ── Days Open ────────────────────────────────────────────

export function getDaysOpen(createdAt: string | null): number {
  if (!createdAt) return 0
  return Math.max(0, Math.ceil((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)))
}

// ── Status Display ───────────────────────────────────────

export function getRFIStatusConfig(status: RFIState) {
  const config: Record<RFIState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    open: { label: 'Open', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    under_review: { label: 'Under Review', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    answered: { label: 'Answered', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    closed: { label: 'Closed', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    void: { label: 'Void', color: '#8C8580', bg: 'rgba(140,133,128,0.04)' },
  }
  return config[status] || config.draft
}
