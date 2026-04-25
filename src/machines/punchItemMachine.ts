import { setup } from 'xstate'
import { colors } from '../styles/theme'

export type PunchItemState = 'open' | 'in_progress' | 'sub_complete' | 'verified' | 'rejected'

export const punchItemMachine = setup({
  types: {
    context: {} as {
      punchItemId: string
      projectId: string
      rejectionNote: string
      error: string | null
    },
    events: {} as
      | { type: 'START_WORK' }           // Assign work and begin
      | { type: 'VERIFY_DIRECT' }        // Direct verify from open (already complete at creation)
      | { type: 'MARK_SUB_COMPLETE' }    // Sub marks their work done
      | { type: 'VERIFY' }               // Superintendent verifies completion
      | { type: 'REJECT' }               // Verification failed, return to in_progress
      | { type: 'REOPEN' },              // Manually reopen
  },
}).createMachine({
  id: 'punchItem',
  initial: 'open',
  context: { punchItemId: '', projectId: '', rejectionNote: '', error: null },
  states: {
    open: {
      on: {
        START_WORK: { target: 'in_progress' },
        VERIFY_DIRECT: { target: 'verified' },
      },
    },
    in_progress: {
      on: {
        MARK_SUB_COMPLETE: { target: 'sub_complete' },
        REOPEN: { target: 'open' },
      },
    },
    sub_complete: {
      on: {
        VERIFY: { target: 'verified' },
        REJECT: { target: 'in_progress' },
        REOPEN: { target: 'open' },
      },
    },
    verified: {
      on: {
        REJECT: { target: 'in_progress' },
        REOPEN: { target: 'open' },
      },
    },
    rejected: {
      on: {
        START_WORK: { target: 'in_progress' },
        REOPEN: { target: 'open' },
      },
    },
  },
})

// ── Valid Transitions ─────────────────────────────────────

export function getValidPunchTransitions(status: PunchItemState): string[] {
  const transitions: Record<PunchItemState, string[]> = {
    open: ['Start Work', 'Verify'],
    in_progress: ['Sub Complete', 'Reopen'],
    sub_complete: ['Verify', 'Reject', 'Reopen'],
    verified: ['Reject', 'Reopen'],
    rejected: ['Start Work', 'Reopen'],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextPunchStatus(currentStatus: PunchItemState, action: string): PunchItemState | null {
  const map: Record<string, Record<string, PunchItemState>> = {
    open: {
      'Start Work': 'in_progress',
      'Verify': 'verified',
    },
    in_progress: {
      'Sub Complete': 'sub_complete',
      'Reopen': 'open',
    },
    sub_complete: {
      'Verify': 'verified',
      'Reject': 'in_progress',
      'Reopen': 'open',
    },
    verified: {
      'Reject': 'in_progress',
      'Reopen': 'open',
    },
    rejected: {
      'Start Work': 'in_progress',
      'Reopen': 'open',
    },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ────────────────────────────────────────

export function getPunchStatusConfig(status: PunchItemState) {
  const config: Record<PunchItemState, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    in_progress: { label: 'In Progress', color: colors.statusPending, bg: colors.statusPendingSubtle },
    sub_complete: { label: 'Sub Complete', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    verified: { label: 'Verified', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }
  return config[status] || config.open
}
