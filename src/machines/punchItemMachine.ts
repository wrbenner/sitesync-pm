import { setup } from 'xstate'
import { colors } from '../styles/theme'

export type PunchItemState = 'open' | 'completed_by_sub' | 'verified' | 'rejected'

export const punchItemMachine = setup({
  types: {
    context: {} as {
      punchItemId: string
      projectId: string
      rejectionNote: string
      error: string | null
    },
    events: {} as
      | { type: 'MARK_COMPLETE' }           // Sub marks their work done
      | { type: 'VERIFY' }                   // Superintendent verifies completion
      | { type: 'REJECT'; note: string }     // Superintendent rejects, returns to open
      | { type: 'REOPEN' },                  // Manually reopen a verified item
  },
}).createMachine({
  id: 'punchItem',
  initial: 'open',
  context: { punchItemId: '', projectId: '', rejectionNote: '', error: null },
  states: {
    open: {
      on: {
        MARK_COMPLETE: { target: 'completed_by_sub' },
      },
    },
    completed_by_sub: {
      on: {
        VERIFY: { target: 'verified' },
        REJECT: {
          target: 'open',
          actions: ({ context, event }) => {
            context.rejectionNote = event.note
          },
        },
      },
    },
    verified: {
      on: {
        REOPEN: { target: 'open' },
      },
    },
    rejected: {
      on: {
        MARK_COMPLETE: { target: 'completed_by_sub' },
      },
    },
  },
})

// ── Valid Transitions ─────────────────────────────────────

export function getValidPunchTransitions(status: PunchItemState): string[] {
  const transitions: Record<PunchItemState, string[]> = {
    open: ['Mark Complete'],
    completed_by_sub: ['Verify', 'Reject'],
    verified: ['Reopen'],
    rejected: ['Mark Complete'],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextPunchStatus(currentStatus: PunchItemState, action: string): PunchItemState | null {
  const map: Record<string, Record<string, PunchItemState>> = {
    open: { 'Mark Complete': 'completed_by_sub' },
    completed_by_sub: { 'Verify': 'verified', 'Reject': 'open' },
    verified: { 'Reopen': 'open' },
    rejected: { 'Mark Complete': 'completed_by_sub' },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ────────────────────────────────────────

export function getPunchStatusConfig(status: PunchItemState) {
  const config: Record<PunchItemState, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    completed_by_sub: { label: 'Awaiting Verification', color: colors.statusPending, bg: colors.statusPendingSubtle },
    verified: { label: 'Verified', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }
  return config[status] || config.open
}
