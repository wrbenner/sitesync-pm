import { setup, assign } from 'xstate'
import { colors } from '../styles/theme'

export type SubmittalState =
  | 'in_preparation'
  | 'submitted_to_gc'
  | 'gc_review'
  | 'submitted_to_architect'
  | 'architect_review'
  | 'approved'
  | 'revise_resubmit'
  | 'rejected'
  | 'closed'
export type SubmittalStamp = 'approved' | 'approved_as_noted' | 'rejected' | 'revise_and_resubmit'

// ── XState Machine ───────────────────────────────────────

export const submittalMachine = setup({
  types: {
    context: {} as {
      submittalId: string
      projectId: string
      revisionNumber: number
      error: string | null
    },
    events: {} as
      | { type: 'SUBMIT' }
      | { type: 'GC_APPROVE' }
      | { type: 'GC_REJECT' }
      | { type: 'ARCHITECT_RECEIVE' }
      | { type: 'ARCHITECT_APPROVE' }
      | { type: 'ARCHITECT_REJECT' }
      | { type: 'ARCHITECT_REVISE' }
      | { type: 'REQUEST_RESUBMIT' }
      | { type: 'RESUBMIT' }
      | { type: 'CLOSE' },
  },
  actions: {
    /**
     * Side effect: caller must provide this via machine.provide({ actions: { triggerRevisionCreation } })
     * to call createSubmittalRevision and start a new revision cycle.
     */
    triggerRevisionCreation: () => {},
  },
}).createMachine({
  id: 'submittal',
  initial: 'in_preparation',
  context: { submittalId: '', projectId: '', revisionNumber: 1, error: null },
  states: {
    in_preparation: {
      on: { SUBMIT: { target: 'submitted_to_gc' } },
    },
    submitted_to_gc: {
      on: {
        GC_APPROVE: { target: 'gc_review' },
        GC_REJECT: { target: 'revise_resubmit' },
      },
    },
    gc_review: {
      on: {
        GC_APPROVE: { target: 'submitted_to_architect' },
        GC_REJECT: { target: 'revise_resubmit' },
        REQUEST_RESUBMIT: { target: 'revise_resubmit' },
      },
    },
    submitted_to_architect: {
      on: {
        ARCHITECT_RECEIVE: { target: 'architect_review' },
        REQUEST_RESUBMIT: { target: 'revise_resubmit' },
      },
    },
    architect_review: {
      on: {
        ARCHITECT_APPROVE: { target: 'approved' },
        ARCHITECT_REJECT: { target: 'revise_resubmit' },
        ARCHITECT_REVISE: { target: 'revise_resubmit' },
        REQUEST_RESUBMIT: { target: 'revise_resubmit' },
      },
    },
    approved: {
      on: { CLOSE: { target: 'closed' } },
    },
    revise_resubmit: {
      on: {
        RESUBMIT: {
          target: 'in_preparation',
          actions: [
            assign({ revisionNumber: ({ context }) => context.revisionNumber + 1 }),
            'triggerRevisionCreation',
          ],
        },
      },
    },
    // Kept for backwards compatibility with persisted state records
    rejected: {
      on: {
        RESUBMIT: {
          target: 'in_preparation',
          actions: [
            assign({ revisionNumber: ({ context }) => context.revisionNumber + 1 }),
            'triggerRevisionCreation',
          ],
        },
      },
    },
    closed: { type: 'final' },
  },
})

// ── Valid Transitions ────────────────────────────────────

export function getValidSubmittalTransitions(status: SubmittalState): string[] {
  const transitions: Record<SubmittalState, string[]> = {
    in_preparation: ['Submit for Review'],
    submitted_to_gc: ['GC Approve', 'GC Reject'],
    gc_review: ['Forward to Architect', 'GC Reject', 'Revise and Resubmit'],
    submitted_to_architect: ['Architect Receive', 'Revise and Resubmit'],
    architect_review: ['Architect Approve', 'Architect Reject', 'Revise and Resubmit'],
    approved: ['Close Out'],
    revise_resubmit: ['Resubmit'],
    rejected: ['Resubmit'],
    closed: [],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextSubmittalStatus(currentStatus: SubmittalState, action: string): SubmittalState | null {
  const map: Record<string, Record<string, SubmittalState>> = {
    in_preparation: { 'Submit for Review': 'submitted_to_gc' },
    submitted_to_gc: { 'GC Approve': 'gc_review', 'GC Reject': 'revise_resubmit' },
    gc_review: {
      'Forward to Architect': 'submitted_to_architect',
      'GC Reject': 'revise_resubmit',
      'Revise and Resubmit': 'revise_resubmit',
    },
    submitted_to_architect: {
      'Architect Receive': 'architect_review',
      'Revise and Resubmit': 'revise_resubmit',
    },
    architect_review: {
      'Architect Approve': 'approved',
      'Architect Reject': 'revise_resubmit',
      'Revise and Resubmit': 'revise_resubmit',
    },
    approved: { 'Close Out': 'closed' },
    revise_resubmit: { Resubmit: 'in_preparation' },
    rejected: { Resubmit: 'in_preparation' },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ───────────────────────────────────────

export function getSubmittalStatusConfig(status: SubmittalState) {
  const config: Record<SubmittalState, { label: string; color: string; bg: string }> = {
    in_preparation: { label: 'In Preparation', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    submitted_to_gc: { label: 'Submitted to GC', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    gc_review: { label: 'GC Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    submitted_to_architect: { label: 'Submitted to A/E', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    architect_review: { label: 'A/E Review', color: colors.statusReview, bg: colors.statusReviewSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    revise_resubmit: { label: 'Revise and Resubmit', color: colors.statusPending, bg: colors.statusPendingSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    closed: { label: 'Closed', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.in_preparation
}

// ── Stamp Display ────────────────────────────────────────

export function getStampConfig(stamp: SubmittalStamp) {
  const config: Record<SubmittalStamp, { label: string; color: string; bg: string }> = {
    approved: { label: 'APPROVED', color: colors.statusActive, bg: colors.statusActiveSubtle },
    approved_as_noted: { label: 'APPROVED AS NOTED', color: colors.statusPending, bg: colors.statusPendingSubtle },
    rejected: { label: 'REJECTED', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    revise_and_resubmit: { label: 'REVISE AND RESUBMIT', color: colors.statusPending, bg: colors.statusPendingSubtle },
  }
  return config[stamp] || config.approved
}

// ── Lead Time Urgency ────────────────────────────────────

export function getLeadTimeUrgency(submitByDate: string | null): { color: string; label: string; urgent: boolean } {
  if (!submitByDate) return { color: colors.statusNeutral, label: 'No submit date', urgent: false }
  const days = Math.ceil((new Date(submitByDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { color: colors.statusCritical, label: `${Math.abs(days)} days past submit date`, urgent: true }
  if (days <= 7) return { color: colors.statusPending, label: `Submit within ${days} days`, urgent: true }
  return { color: colors.statusActive, label: `${days} days until submit date`, urgent: false }
}

// ── CSI MasterFormat Divisions ───────────────────────────

export const CSI_DIVISIONS = [
  { code: '01', name: 'General Requirements' },
  { code: '02', name: 'Existing Conditions' },
  { code: '03', name: 'Concrete' },
  { code: '04', name: 'Masonry' },
  { code: '05', name: 'Metals' },
  { code: '06', name: 'Wood, Plastics, and Composites' },
  { code: '07', name: 'Thermal and Moisture Protection' },
  { code: '08', name: 'Openings' },
  { code: '09', name: 'Finishes' },
  { code: '10', name: 'Specialties' },
  { code: '11', name: 'Equipment' },
  { code: '12', name: 'Furnishings' },
  { code: '13', name: 'Special Construction' },
  { code: '14', name: 'Conveying Equipment' },
  { code: '21', name: 'Fire Suppression' },
  { code: '22', name: 'Plumbing' },
  { code: '23', name: 'HVAC' },
  { code: '25', name: 'Integrated Automation' },
  { code: '26', name: 'Electrical' },
  { code: '27', name: 'Communications' },
  { code: '28', name: 'Electronic Safety and Security' },
  { code: '31', name: 'Earthwork' },
  { code: '32', name: 'Exterior Improvements' },
  { code: '33', name: 'Utilities' },
] as const
