import { colors } from '../../styles/theme'
import type { LienWaiverStatus } from '../../types/api'
import type { G702Data } from '../../machines/paymentMachine'
import type { WaiverState } from '../../components/export/LienWaiverPDF'

export type TabKey = 'applications' | 'lien_waivers' | 'cash_flow' | 'retainage'

export const fmtCurrency = (n: number | null): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

export const fmtDate = (d: string | null): string =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

// ── SOV Draft Row (for CreateEditPayApp drawer) ────────────────

export interface DraftSOVRow {
  key: string
  description: string
  scheduledValue: string
  prevPct: number
  thisPct: string
  storedMaterials: string
  error: string | null
}

export function newBlankRow(index: number): DraftSOVRow {
  return {
    key: `row-${Date.now()}-${index}`,
    description: '',
    scheduledValue: '',
    prevPct: 0,
    thisPct: '0',
    storedMaterials: '0',
    error: null,
  }
}

export function computeRowTotals(row: DraftSOVRow, retainageRatePct: number) {
  const sv = Math.max(0, parseFloat(row.scheduledValue) || 0)
  const prevPct = row.prevPct
  const thisPct = Math.min(100, Math.max(0, parseFloat(row.thisPct) || 0))
  const mats = Math.max(0, parseFloat(row.storedMaterials) || 0)
  const prevAmt = sv * (prevPct / 100)
  const thisAmt = sv * (thisPct / 100)
  const workThisPeriod = thisAmt - prevAmt
  const totalCompleted = thisAmt + mats
  const retainage = totalCompleted * (retainageRatePct / 100)
  const netPayment = totalCompleted - retainage - prevAmt
  return { sv, prevPct, thisPct, mats, prevAmt, workThisPeriod, thisAmt, totalCompleted, retainage, netPayment }
}

export function computeG702FromRows(
  rows: DraftSOVRow[],
  retainageRatePct: number,
  originalContractSum: number,
  netChangeOrders: number,
  lessPrevCerts: number,
): G702Data {
  const totalCompletedAndStored = rows.reduce(
    (s, r) => s + computeRowTotals(r, retainageRatePct).totalCompleted, 0,
  )
  const contractSumToDate = originalContractSum + netChangeOrders
  const retainageAmount = Math.round(totalCompletedAndStored * (retainageRatePct / 100) * 100) / 100
  const totalEarnedLessRetainage = totalCompletedAndStored - retainageAmount
  const currentPaymentDue = totalEarnedLessRetainage - lessPrevCerts
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
    retainagePercent: retainageRatePct,
    retainageAmount,
    totalEarnedLessRetainage,
    lessPreviousCertificates: lessPrevCerts,
    currentPaymentDue,
    balanceToFinish,
  }
}

// ── Waiver config ────────────────────────────────────────────

export type WaiverCollectionStatus = 'received' | 'pending' | 'missing'

export function getWaiverCollectionStatus(waivers: { status: LienWaiverStatus }[]): WaiverCollectionStatus {
  if (waivers.length === 0) return 'missing'
  if (waivers.some((w) => w.status === 'received')) return 'received'
  return 'pending'
}

export function stateToWaiverState(state: string | null | undefined): WaiverState {
  const map: Record<string, WaiverState> = {
    CA: 'california', TX: 'texas', FL: 'florida', NY: 'new_york',
  }
  return (state && map[state.toUpperCase()]) || 'generic'
}

export const LIEN_WAIVER_STATUS_CONFIG: Record<LienWaiverStatus | 'overdue', { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: colors.statusPending,  bg: colors.statusPendingSubtle },
  received: { label: 'Received', color: colors.statusActive,   bg: colors.statusActiveSubtle },
  executed: { label: 'Executed', color: colors.statusInfo,     bg: colors.statusInfoSubtle },
  overdue:  { label: 'Overdue',  color: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

export const WAIVER_COLLECTION_CONFIG: Record<WaiverCollectionStatus, { label: string; color: string; bg: string }> = {
  received: { label: 'Conditional Received', color: colors.statusActive, bg: colors.statusActiveSubtle },
  pending: { label: 'Unconditional Pending', color: colors.statusPending, bg: colors.statusPendingSubtle },
  missing: { label: 'Missing', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

export interface PayAppProject {
  name: string
  address: string | null
  owner_name: string | null
  general_contractor: string | null
  state: string | null
}
