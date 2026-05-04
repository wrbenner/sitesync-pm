import { colors } from '../../styles/theme'
import type { LienWaiverStatus } from '../../types/api'
import type { G702Data } from '../../machines/paymentMachine'
import type { WaiverState } from '../../components/export/LienWaiverPDF'
import {
  type Cents,
  addCents,
  applyRateCents,
  dollarsToCents,
  fromCents,
  subtractCents,
} from '../../types/money'

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

// Money discipline: input boundary parses UI strings → integer cents; all
// arithmetic is on Cents (per src/types/money.ts); output boundary returns
// dollar floats so existing consumers (rendering, paymentMachine.G702Data)
// keep their current shape. Internal float drift cannot accumulate because
// every multiplication and sum runs on integers.
export function computeRowTotals(row: DraftSOVRow, retainageRatePct: number) {
  const svDollars = Math.max(0, parseFloat(row.scheduledValue) || 0)
  const prevPct = row.prevPct
  const thisPct = Math.min(100, Math.max(0, parseFloat(row.thisPct) || 0))
  const matsDollars = Math.max(0, parseFloat(row.storedMaterials) || 0)

  const svC: Cents = dollarsToCents(svDollars)
  const matsC: Cents = dollarsToCents(matsDollars)
  const prevAmtC: Cents = applyRateCents(svC, prevPct / 100)
  const thisAmtC: Cents = applyRateCents(svC, thisPct / 100)
  const workThisPeriodC: Cents = subtractCents(thisAmtC, prevAmtC)
  const totalCompletedC: Cents = addCents(thisAmtC, matsC)
  const retainageC: Cents = applyRateCents(totalCompletedC, retainageRatePct / 100)
  const netPaymentC: Cents = subtractCents(subtractCents(totalCompletedC, retainageC), prevAmtC)

  return {
    sv: svDollars,
    prevPct,
    thisPct,
    mats: matsDollars,
    prevAmt: fromCents(prevAmtC) / 100,
    workThisPeriod: fromCents(workThisPeriodC) / 100,
    thisAmt: fromCents(thisAmtC) / 100,
    totalCompleted: fromCents(totalCompletedC) / 100,
    retainage: fromCents(retainageC) / 100,
    netPayment: fromCents(netPaymentC) / 100,
  }
}

export function computeG702FromRows(
  rows: DraftSOVRow[],
  retainageRatePct: number,
  originalContractSum: number,
  netChangeOrders: number,
  lessPrevCerts: number,
): G702Data {
  const totalCompletedAndStoredC: Cents = rows.reduce<Cents>((acc, r) => {
    const sv = dollarsToCents(Math.max(0, parseFloat(r.scheduledValue) || 0))
    const mats = dollarsToCents(Math.max(0, parseFloat(r.storedMaterials) || 0))
    const thisPct = Math.min(100, Math.max(0, parseFloat(r.thisPct) || 0))
    const thisAmt = applyRateCents(sv, thisPct / 100)
    return addCents(acc, addCents(thisAmt, mats))
  }, 0 as Cents)
  const originalC: Cents = dollarsToCents(originalContractSum)
  const netCoC: Cents = dollarsToCents(netChangeOrders)
  const lessPrevC: Cents = dollarsToCents(lessPrevCerts)
  const contractSumToDateC: Cents = addCents(originalC, netCoC)
  const retainageC: Cents = applyRateCents(totalCompletedAndStoredC, retainageRatePct / 100)
  const totalEarnedLessRetainageC: Cents = subtractCents(totalCompletedAndStoredC, retainageC)
  const currentPaymentDueC: Cents = subtractCents(totalEarnedLessRetainageC, lessPrevC)
  const balanceToFinishC: Cents = subtractCents(contractSumToDateC, totalCompletedAndStoredC)
  return {
    applicationNumber: 0,
    periodTo: '',
    projectName: '',
    contractorName: '',
    originalContractSum,
    netChangeOrders,
    contractSumToDate: fromCents(contractSumToDateC) / 100,
    totalCompletedAndStored: fromCents(totalCompletedAndStoredC) / 100,
    retainagePercent: retainageRatePct,
    retainageAmount: fromCents(retainageC) / 100,
    totalEarnedLessRetainage: fromCents(totalEarnedLessRetainageC) / 100,
    lessPreviousCertificates: lessPrevCerts,
    currentPaymentDue: fromCents(currentPaymentDueC) / 100,
    balanceToFinish: fromCents(balanceToFinishC) / 100,
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
  missing:  { label: 'Missing',  color: colors.statusCritical, bg: colors.statusCriticalSubtle },
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
