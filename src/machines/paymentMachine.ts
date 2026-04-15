// AIA G702/G703 Payment Application workflow state machine.
// Manages the lifecycle: draft → submitted → gc_review → owner_review → approved → paid.

import { setup, assign } from 'xstate'
import { colors } from '../styles/theme'

export type PaymentStatus = 'draft' | 'submitted' | 'gc_review' | 'owner_review' | 'approved' | 'rejected' | 'paid' | 'void'
export type LienWaiverStatus = 'pending' | 'conditional' | 'unconditional' | 'final' | 'waived'
export type LienWaiverState = 'california' | 'texas' | 'florida' | 'new_york' | 'generic'

// ── State Machine ────────────────────────────────────────

export const paymentMachine = setup({
  types: {
    context: {} as {
      applicationId: string
      projectId: string
      applicationNumber: number
      error: string | null
    },
    events: {} as
      | { type: 'SUBMIT'; signatureUrl?: string }
      | { type: 'GC_APPROVE' }
      | { type: 'GC_REJECT'; comments: string }
      | { type: 'OWNER_APPROVE'; signatureUrl?: string }
      | { type: 'OWNER_REJECT'; comments: string }
      | { type: 'MARK_PAID'; paymentDate: string; checkNumber?: string }
      | { type: 'VOID'; reason: string }
      | { type: 'REVISE' },
  },
  actions: {
    // Declares the lien waiver side-effect contract. The real implementation lives in
    // approvePayApplication (api/endpoints/payApplications.ts) and is called by the
    // approval mutation. Provide a live implementation when creating an actor instance
    // if the machine is used as a running service.
    autoGenerateLienWaivers: () => {},
  },
}).createMachine({
  id: 'paymentApplication',
  initial: 'draft',
  context: { applicationId: '', projectId: '', applicationNumber: 1, error: null },
  states: {
    draft: {
      on: {
        SUBMIT: { target: 'submitted' },
        VOID: { target: 'void' },
      },
    },
    submitted: {
      on: {
        GC_APPROVE: { target: 'gc_review' },
        GC_REJECT: { target: 'rejected' },
        VOID: { target: 'void' },
      },
    },
    gc_review: {
      on: {
        GC_APPROVE: { target: 'owner_review' },
        GC_REJECT: { target: 'rejected' },
        VOID: { target: 'void' },
      },
    },
    owner_review: {
      on: {
        OWNER_APPROVE: { target: 'approved' },
        OWNER_REJECT: { target: 'rejected' },
        VOID: { target: 'void' },
      },
    },
    approved: {
      entry: [{ type: 'autoGenerateLienWaivers' }],
      on: {
        MARK_PAID: { target: 'paid' },
        VOID: { target: 'void' },
      },
    },
    rejected: {
      on: {
        REVISE: { target: 'draft' },
        VOID: { target: 'void' },
      },
    },
    paid: {
      type: 'final',
    },
    void: {
      type: 'final',
    },
  },
})

// ── Transition Helpers ───────────────────────────────────

export function getValidPaymentTransitions(status: PaymentStatus): string[] {
  const transitions: Record<PaymentStatus, string[]> = {
    draft: ['Submit Application'],
    submitted: ['Approve (GC Review)', 'Reject'],
    gc_review: ['Approve and Forward to Owner', 'Reject'],
    owner_review: ['Approve Payment', 'Reject'],
    approved: ['Mark as Paid', 'Void'],
    rejected: ['Revise and Resubmit', 'Void'],
    paid: [],
    void: [],
  }
  return transitions[status] || []
}

export function getPaymentStatusConfig(status: PaymentStatus) {
  const config: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    submitted: { label: 'Submitted', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    gc_review: { label: 'GC Review', color: colors.statusPending, bg: colors.statusPendingSubtle },
    owner_review: { label: 'Owner Review', color: colors.statusReview, bg: colors.statusReviewSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    paid: { label: 'Paid', color: colors.statusActive, bg: colors.orangeLight },
    void: { label: 'Void', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.draft
}

// ── G702 Calculation Engine ──────────────────────────────

export interface G702Data {
  applicationNumber: number
  periodTo: string
  projectName: string
  contractorName: string
  // Financial fields
  originalContractSum: number
  netChangeOrders: number
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePercent: number
  retainageAmount: number
  totalEarnedLessRetainage: number
  lessPreviousCertificates: number
  currentPaymentDue: number
  balanceToFinish: number
  // Signatures
  contractorSignature?: string
  ownerSignature?: string
}

export interface G703LineItem {
  itemNumber: string
  costCode: string
  description: string
  scheduledValue: number
  previousCompleted: number
  thisPeroid: number
  materialsStored: number
  totalCompletedAndStored: number
  percentComplete: number
  balanceToFinish: number
  retainage: number
}

export function calculateG702(
  lineItems: G703LineItem[],
  retainagePercent: number,
  previousCertificates: number,
  originalContractSum: number,
  approvedChangeOrders: number,
): G702Data {
  const netChangeOrders = approvedChangeOrders
  const contractSumToDate = originalContractSum + netChangeOrders

  const totalCompletedAndStored = lineItems.reduce(
    (sum, item) => sum + item.totalCompletedAndStored, 0
  )

  const retainageAmount = Math.round(totalCompletedAndStored * (retainagePercent / 100) * 100) / 100
  const totalEarnedLessRetainage = totalCompletedAndStored - retainageAmount
  const currentPaymentDue = totalEarnedLessRetainage - previousCertificates
  const balanceToFinish = contractSumToDate - totalCompletedAndStored

  return {
    applicationNumber: 0,
    periodTo: '',
    projectName: '',
    contractorName: '',
    originalContractSum,
    netChangeOrders,
    contractSumToDate,
    totalCompletedAndStored,
    retainagePercent,
    retainageAmount,
    totalEarnedLessRetainage,
    lessPreviousCertificates: previousCertificates,
    currentPaymentDue,
    balanceToFinish,
  }
}

export function calculateG703LineItem(
  scheduledValue: number,
  previousCompleted: number,
  thisPeroid: number,
  materialsStored: number,
  retainagePercent: number,
): Omit<G703LineItem, 'itemNumber' | 'costCode' | 'description'> {
  const totalCompletedAndStored = previousCompleted + thisPeroid + materialsStored
  const percentComplete = scheduledValue > 0
    ? Math.round((totalCompletedAndStored / scheduledValue) * 10000) / 100
    : 0
  const balanceToFinish = scheduledValue - totalCompletedAndStored
  const retainage = Math.round(totalCompletedAndStored * (retainagePercent / 100) * 100) / 100

  return {
    scheduledValue,
    previousCompleted,
    thisPeroid,
    materialsStored,
    totalCompletedAndStored,
    percentComplete,
    balanceToFinish,
    retainage,
  }
}

// ── Lien Waiver Types ────────────────────────────────────

export interface LienWaiver {
  id: string
  applicationId: string
  contractorName: string
  amount: number
  status: LienWaiverStatus
  waiverState: LienWaiverState
  throughDate: string
  signedAt?: string
  signedBy?: string
  documentUrl?: string
}

export function getLienWaiverStatusConfig(status: LienWaiverStatus) {
  const config: Record<LienWaiverStatus, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: colors.statusPending, bg: colors.statusPendingSubtle },
    conditional: { label: 'Conditional', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    unconditional: { label: 'Unconditional', color: colors.statusActive, bg: colors.statusActiveSubtle },
    final: { label: 'Final', color: colors.statusActive, bg: colors.orangeLight },
    waived: { label: 'Waived', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  }
  return config[status] || config.pending
}

// State-specific lien waiver form names
export const LIEN_WAIVER_FORMS: Record<LienWaiverState, { conditional: string; unconditional: string }> = {
  california: {
    conditional: 'California Civil Code § 8132 Conditional Waiver and Release on Progress Payment',
    unconditional: 'California Civil Code § 8134 Unconditional Waiver and Release on Progress Payment',
  },
  texas: {
    conditional: 'Texas Property Code § 53.284 Conditional Waiver and Release on Progress Payment',
    unconditional: 'Texas Property Code § 53.284 Unconditional Waiver and Release on Progress Payment',
  },
  florida: {
    conditional: 'Florida Statute § 713.20 Partial Release of Lien (Conditional)',
    unconditional: 'Florida Statute § 713.20 Partial Release of Lien (Unconditional)',
  },
  new_york: {
    conditional: 'New York Lien Law Partial Lien Waiver (Conditional)',
    unconditional: 'New York Lien Law Partial Lien Waiver (Unconditional)',
  },
  generic: {
    conditional: 'Conditional Waiver and Release on Progress Payment',
    unconditional: 'Unconditional Waiver and Release on Progress Payment',
  },
}
