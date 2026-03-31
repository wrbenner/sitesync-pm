import { setup } from 'xstate'
import { colors } from '../styles/theme'

export type PunchItemState = 'open' | 'in_progress' | 'resolved' | 'verified'

export const punchItemMachine = setup({
  types: {
    context: {} as {
      punchItemId: string
      projectId: string
      error: string | null
    },
    events: {} as
      | { type: 'START_WORK' }
      | { type: 'RESOLVE' }
      | { type: 'VERIFY' }
      | { type: 'VERIFY_DIRECT' }  // BUG #3 FIX: For items complete at creation
      | { type: 'REJECT_VERIFICATION' }  // BUG #3 FIX: Failed verification
      | { type: 'REOPEN' },
  },
}).createMachine({
  id: 'punchItem',
  initial: 'open',
  context: { punchItemId: '', projectId: '', error: null },
  states: {
    open: {
      on: {
        START_WORK: { target: 'in_progress' },
        VERIFY_DIRECT: { target: 'verified' },  // BUG #3 FIX: Skip to verified
      },
    },
    in_progress: {
      on: {
        RESOLVE: { target: 'resolved' },
        REOPEN: { target: 'open' },
      },
    },
    resolved: {
      on: {
        VERIFY: { target: 'verified' },
        REOPEN: { target: 'open' },
      },
    },
    verified: {
      // BUG #3 FIX: Not fully final — failed verification can reopen for rework
      on: {
        REJECT_VERIFICATION: { target: 'in_progress' },
      },
    },
  },
})

// ── Valid Transitions (BUG #3 FIX: Missing helper) ───────

export function getValidPunchTransitions(status: PunchItemState): string[] {
  const transitions: Record<PunchItemState, string[]> = {
    open: ['Start Work', 'Verify (Complete at Creation)'],
    in_progress: ['Mark Resolved', 'Reopen'],
    resolved: ['Verify', 'Reopen'],
    verified: ['Reject Verification'],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextPunchStatus(currentStatus: PunchItemState, action: string): PunchItemState | null {
  const map: Record<string, Record<string, PunchItemState>> = {
    open: {
      'Start Work': 'in_progress',
      'Verify (Complete at Creation)': 'verified',
    },
    in_progress: {
      'Mark Resolved': 'resolved',
      'Reopen': 'open',
    },
    resolved: {
      'Verify': 'verified',
      'Reopen': 'open',
    },
    verified: {
      'Reject Verification': 'in_progress',
    },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display (BUG #3 FIX: Missing helper) ─────────

export function getPunchStatusConfig(status: PunchItemState) {
  const config: Record<PunchItemState, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    in_progress: { label: 'In Progress', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    resolved: { label: 'Resolved', color: colors.statusPending, bg: colors.statusPendingSubtle },
    verified: { label: 'Verified', color: colors.statusActive, bg: colors.statusActiveSubtle },
  }
  return config[status] || config.open
}
