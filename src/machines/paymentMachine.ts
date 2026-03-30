// AIA G702/G703 Payment Application workflow state machine.
// Manages the lifecycle: draft → submitted → gc_review → owner_review → approved → paid.

import { setup, assign } from 'xstate'

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
    draft: { label: 'Draft', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    submitted: { label: 'Submitted', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    gc_review: { label: 'GC Review', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    owner_review: { label: 'Owner Review', color: '#7C5DC7', bg: 'rgba(124,93,199,0.08)' },
    approved: { label: 'Approved', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    rejected: { label: 'Rejected', color: '#C93B3B', bg: 'rgba(201,59,59,0.08)' },
    paid: { label: 'Paid', color: '#2D8A6E', bg: 'rgba(45,138,110,0.12)' },
    void: { label: 'Void', color: '#8C8580', bg: 'rgba(140,133,128,0.04)' },
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
    pending: { label: 'Pending', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    conditional: { label: 'Conditional', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    unconditional: { label: 'Unconditional', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    final: { label: 'Final', color: '#2D8A6E', bg: 'rgba(45,138,110,0.12)' },
    waived: { label: 'Waived', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
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
