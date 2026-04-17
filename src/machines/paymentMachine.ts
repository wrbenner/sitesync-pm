// AIA G702/G703 Payment Application workflow state machine.
// Manages the lifecycle: draft → submitted → gc_review → owner_review → approved → paid.

import { setup } from 'xstate'
import { colors } from '../styles/theme'
import { type Cents, toCents, fromCents, addCents, subtractCents, applyRateCents } from '../types/money'

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
        OWNER_APPROVE: { target: 'approved' },
        OWNER_REJECT: { target: 'rejected' },
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
    gc_review: ['Forward to Owner', 'Reject'],
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
  thisPeriod: number
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
  // All money inputs are dollars; convert to integer cents for the math, convert back for the output shape.
  const ZERO = 0 as Cents
  const originalContractSumC = toCents(originalContractSum * 100)
  const netChangeOrdersC = toCents(approvedChangeOrders * 100)
  const previousCertificatesC = toCents(previousCertificates * 100)
  const contractSumToDateC = addCents(originalContractSumC, netChangeOrdersC)

  const totalCompletedAndStoredC = lineItems.reduce<Cents>(
    (sum, item) => addCents(sum, toCents(item.totalCompletedAndStored * 100)), ZERO,
  )

  const retainageAmountC = applyRateCents(totalCompletedAndStoredC, retainagePercent / 100)
  const totalEarnedLessRetainageC = subtractCents(totalCompletedAndStoredC, retainageAmountC)
  const currentPaymentDueC = subtractCents(totalEarnedLessRetainageC, previousCertificatesC)
  const balanceToFinishC = subtractCents(contractSumToDateC, totalCompletedAndStoredC)

  return {
    applicationNumber: 0,
    periodTo: '',
    projectName: '',
    contractorName: '',
    originalContractSum,
    netChangeOrders: approvedChangeOrders,
    contractSumToDate: fromCents(contractSumToDateC) / 100,
    totalCompletedAndStored: fromCents(totalCompletedAndStoredC) / 100,
    retainagePercent,
    retainageAmount: fromCents(retainageAmountC) / 100,
    totalEarnedLessRetainage: fromCents(totalEarnedLessRetainageC) / 100,
    lessPreviousCertificates: previousCertificates,
    currentPaymentDue: fromCents(currentPaymentDueC) / 100,
    balanceToFinish: fromCents(balanceToFinishC) / 100,
  }
}

export function calculateG703LineItem(
  scheduledValue: number,
  previousCompleted: number,
  thisPeriod: number,
  materialsStored: number,
  retainagePercent: number,
): Omit<G703LineItem, 'itemNumber' | 'costCode' | 'description'> {
  const scheduledC = toCents(scheduledValue * 100)
  const prevC = toCents(previousCompleted * 100)
  const thisC = toCents(thisPeriod * 100)
  const matsC = toCents(materialsStored * 100)

  const totalCompletedAndStoredC = addCents(addCents(prevC, thisC), matsC)
  const percentComplete = scheduledC > 0
    ? Math.round((fromCents(totalCompletedAndStoredC) / fromCents(scheduledC)) * 10000) / 100
    : 0
  const balanceToFinishC = subtractCents(scheduledC, totalCompletedAndStoredC)
  const retainageC = applyRateCents(totalCompletedAndStoredC, retainagePercent / 100)

  return {
    scheduledValue,
    previousCompleted,
    thisPeriod,
    materialsStored,
    totalCompletedAndStored: fromCents(totalCompletedAndStoredC) / 100,
    percentComplete,
    balanceToFinish: fromCents(balanceToFinishC) / 100,
    retainage: fromCents(retainageC) / 100,
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
