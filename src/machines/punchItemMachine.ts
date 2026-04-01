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
      | { type: 'START_WORK' }           // Assignee starts work
      | { type: 'VERIFY_DIRECT' }        // Super verifies item already complete at creation
      | { type: 'RESOLVE' }              // Assignee marks their work done
      | { type: 'VERIFY' }               // Super verifies completion
      | { type: 'REJECT_VERIFICATION' }  // Super rejects, sends back to in_progress
      | { type: 'REOPEN' },              // Manually reopen
  },
}).createMachine({
  id: 'punchItem',
  initial: 'open',
  context: { punchItemId: '', projectId: '', error: null },
  states: {
    open: {
      on: {
        START_WORK: { target: 'in_progress' },
        VERIFY_DIRECT: { target: 'verified' },
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
      on: {
        REJECT_VERIFICATION: { target: 'in_progress' },
      },
    },
  },
})

// ── Valid Transitions ─────────────────────────────────────

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
    open: { 'Start Work': 'in_progress', 'Verify (Complete at Creation)': 'verified' },
    in_progress: { 'Mark Resolved': 'resolved', 'Reopen': 'open' },
    resolved: { 'Verify': 'verified', 'Reopen': 'open' },
    verified: { 'Reject Verification': 'in_progress' },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ────────────────────────────────────────

export function getPunchStatusConfig(status: PunchItemState) {
  const config: Record<PunchItemState, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    in_progress: { label: 'In Progress', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    resolved: { label: 'Resolved', color: colors.statusPending, bg: colors.statusPendingSubtle },
    verified: { label: 'Verified', color: colors.statusActive, bg: colors.statusActiveSubtle },
  }
  return config[status] || config.open
}
