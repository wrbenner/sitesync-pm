import { setup, assign } from 'xstate'
import { colors } from '../styles/theme'

export type SubmittalState =
  | 'draft'
  | 'submitted'
  | 'gc_review'
  | 'architect_review'
  | 'approved'
  | 'rejected'
  | 'resubmit'
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
  initial: 'draft',
  context: { submittalId: '', projectId: '', revisionNumber: 1, error: null },
  states: {
    draft: {
      on: { SUBMIT: { target: 'submitted' } },
    },
    submitted: {
      on: {
        GC_APPROVE: { target: 'gc_review' },
        GC_REJECT: { target: 'rejected' },
      },
    },
    gc_review: {
      on: {
        // GC_APPROVE from gc_review forwards to architect (BUG #1 FIX)
        GC_APPROVE: { target: 'architect_review' },
        GC_REJECT: { target: 'rejected' },
        ARCHITECT_REVISE: { target: 'resubmit' },
        REQUEST_RESUBMIT: { target: 'resubmit' },
      },
    },
    architect_review: {
      on: {
        ARCHITECT_APPROVE: { target: 'approved' },
        ARCHITECT_REJECT: { target: 'rejected' },
        ARCHITECT_REVISE: { target: 'resubmit' },
        REQUEST_RESUBMIT: { target: 'resubmit' },
      },
    },
    approved: {
      on: { CLOSE: { target: 'closed' } },
    },
    rejected: {
      on: {
        RESUBMIT: {
          target: 'draft',
          actions: [
            assign({ revisionNumber: ({ context }) => context.revisionNumber + 1 }),
            'triggerRevisionCreation',
          ],
        },
      },
    },
    resubmit: {
      on: {
        RESUBMIT: {
          target: 'draft',
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
    draft: ['Submit for Review'],
    submitted: ['GC Approve', 'GC Reject'],
    gc_review: ['Forward to Architect', 'GC Reject', 'Revise and Resubmit'],
    architect_review: ['Architect Approve', 'Architect Reject', 'Revise and Resubmit'],
    approved: ['Close Out'],
    rejected: ['Revise and Resubmit'],
    resubmit: ['Revise and Resubmit'],
    closed: [],
  }
  return transitions[status] || []
}

// ── Next Status ──────────────────────────────────────────

export function getNextSubmittalStatus(currentStatus: SubmittalState, action: string): SubmittalState | null {
  const map: Record<string, Record<string, SubmittalState>> = {
    draft: { 'Submit for Review': 'submitted' },
    submitted: { 'GC Approve': 'gc_review', 'GC Reject': 'rejected' },
    gc_review: {
      'Forward to Architect': 'architect_review',
      'GC Reject': 'rejected',
      'Revise and Resubmit': 'resubmit',
    },
    architect_review: {
      'Architect Approve': 'approved',
      'Architect Reject': 'rejected',
      'Revise and Resubmit': 'resubmit',
    },
    approved: { 'Close Out': 'closed' },
    rejected: { 'Revise and Resubmit': 'draft' },
    resubmit: { 'Revise and Resubmit': 'draft' },
  }
  return map[currentStatus]?.[action] || null
}

// ── Status Display ───────────────────────────────────────

export function getSubmittalStatusConfig(status: SubmittalState) {
  const config: Record<SubmittalState, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    submitted: { label: 'Submitted', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    gc_review: { label: 'GC Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    architect_review: { label: 'A/E Review', color: colors.statusReview, bg: colors.statusReviewSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    resubmit: { label: 'Revise and Resubmit', color: colors.statusPending, bg: colors.statusPendingSubtle },
    closed: { label: 'Closed', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.draft
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
