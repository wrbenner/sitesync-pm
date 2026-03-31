// Project Closeout state machine.
// Manages the lifecycle of each closeout item from contract requirement to final approval.

import { setup } from 'xstate'
import { BASE_CLOSEOUT_ITEMS, PROJECT_TYPE_ITEMS } from '../constants/closeoutTemplates'
import { colors } from '../styles/theme'

// ── Types ────────────────────────────────────────────────

export type CloseoutItemStatus = 'required' | 'requested' | 'submitted' | 'under_review' | 'approved' | 'rejected'
export type CloseoutCategory =
  | 'om_manual' | 'as_built' | 'warranty' | 'lien_waiver'
  | 'substantial_completion' | 'certificate_occupancy' | 'training'
  | 'spare_parts' | 'attic_stock' | 'commissioning' | 'punch_list'
  | 'final_payment' | 'consent_surety' | 'testing' | 'inspection'
  | 'permit_closeout' | 'insurance' | 'other'

export type ProjectType = 'commercial' | 'residential' | 'industrial' | 'healthcare' | 'education' | 'mixed_use'

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'claimed'

// ── State Machine ────────────────────────────────────────

export const closeoutItemMachine = setup({
  types: {
    context: {} as {
      itemId: string
      projectId: string
      error: string | null
    },
    events: {} as
      | { type: 'REQUEST'; contactId: string }
      | { type: 'SUBMIT'; documentIds: string[] }
      | { type: 'START_REVIEW' }
      | { type: 'APPROVE'; reviewerId: string }
      | { type: 'REJECT'; comments: string; reviewerId: string }
      | { type: 'RESUBMIT'; documentIds: string[] },
  },
}).createMachine({
  id: 'closeoutItem',
  initial: 'required',
  context: { itemId: '', projectId: '', error: null },
  states: {
    required: {
      on: { REQUEST: { target: 'requested' } },
    },
    requested: {
      on: { SUBMIT: { target: 'submitted' } },
    },
    submitted: {
      on: {
        START_REVIEW: { target: 'under_review' },
        APPROVE: { target: 'approved' },
      },
    },
    under_review: {
      on: {
        APPROVE: { target: 'approved' },
        REJECT: { target: 'rejected' },
      },
    },
    approved: {
      type: 'final',
    },
    rejected: {
      on: {
        RESUBMIT: { target: 'submitted' },
      },
    },
  },
})

// ── Transition Helpers ───────────────────────────────────

export function getValidCloseoutTransitions(status: CloseoutItemStatus): string[] {
  const map: Record<CloseoutItemStatus, string[]> = {
    required: ['Send Request'],
    requested: ['Mark Submitted'],
    submitted: ['Start Review', 'Approve'],
    under_review: ['Approve', 'Reject'],
    approved: [],
    rejected: ['Resubmit'],
  }
  return map[status] || []
}

export function getCloseoutStatusConfig(status: CloseoutItemStatus) {
  const config: Record<CloseoutItemStatus, { label: string; color: string; bg: string }> = {
    required: { label: 'Required', color: colors.statusNeutral, bg: colors.statusNeutralSubtle },
    requested: { label: 'Requested', color: colors.statusInfo, bg: colors.statusInfoSubtle },
    submitted: { label: 'Submitted', color: colors.statusPending, bg: colors.statusPendingSubtle },
    under_review: { label: 'Under Review', color: colors.statusReview, bg: colors.statusReviewSubtle },
    approved: { label: 'Approved', color: colors.statusActive, bg: colors.statusActiveSubtle },
    rejected: { label: 'Rejected', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
  }
  return config[status] || config.required
}

export function getCloseoutCategoryConfig(category: CloseoutCategory) {
  const config: Record<CloseoutCategory, { label: string; icon: string }> = {
    om_manual: { label: 'O&M Manual', icon: 'BookOpen' },
    as_built: { label: 'As Built Drawing', icon: 'FileText' },
    warranty: { label: 'Warranty Letter', icon: 'ShieldCheck' },
    lien_waiver: { label: 'Lien Waiver', icon: 'FileCheck' },
    substantial_completion: { label: 'Substantial Completion', icon: 'Award' },
    certificate_occupancy: { label: 'Certificate of Occupancy', icon: 'Building' },
    training: { label: 'Training Record', icon: 'GraduationCap' },
    spare_parts: { label: 'Spare Parts', icon: 'Package' },
    attic_stock: { label: 'Attic Stock', icon: 'Archive' },
    commissioning: { label: 'Commissioning Report', icon: 'Activity' },
    punch_list: { label: 'Final Punch List', icon: 'CheckSquare' },
    final_payment: { label: 'Final Payment', icon: 'DollarSign' },
    consent_surety: { label: 'Consent of Surety', icon: 'Shield' },
    testing: { label: 'Testing Report', icon: 'Thermometer' },
    inspection: { label: 'Final Inspection', icon: 'Search' },
    permit_closeout: { label: 'Permit Closeout', icon: 'Stamp' },
    insurance: { label: 'Insurance Certificate', icon: 'FileShield' },
    other: { label: 'Other', icon: 'File' },
  }
  return config[category] || config.other
}

// ── Closeout List Generator ──────────────────────────────

export interface CloseoutTemplate {
  category: CloseoutCategory
  title: string
  description: string
  specSection?: string
  trade?: string
}

export function generateCloseoutList(projectType: ProjectType): CloseoutTemplate[] {
  const items = [...BASE_CLOSEOUT_ITEMS]
  const typeSpecific = PROJECT_TYPE_ITEMS[projectType] || []
  items.push(...typeSpecific)
  return items
}

// ── Warranty Tracking ────────────────────────────────────

export function getWarrantyStatusConfig(status: WarrantyStatus) {
  const config: Record<WarrantyStatus, { label: string; color: string; bg: string }> = {
    active: { label: 'Active', color: colors.statusActive, bg: colors.statusActiveSubtle },
    expiring_soon: { label: 'Expiring Soon', color: colors.statusPending, bg: colors.statusPendingSubtle },
    expired: { label: 'Expired', color: colors.statusCritical, bg: colors.statusCriticalSubtle },
    claimed: { label: 'Claimed', color: colors.statusReview, bg: colors.statusReviewSubtle },
  }
  return config[status] || config.active
}

export function computeWarrantyStatus(endDate: string): WarrantyStatus {
  const end = new Date(endDate)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  return 'active'
}

// Standard warranty periods by trade (months)
export const STANDARD_WARRANTY_PERIODS: Record<string, number> = {
  'Roofing': 240, // 20 years (manufacturer) + 2 years (contractor)
  'Waterproofing': 120, // 10 years
  'HVAC Equipment': 60, // 5 years
  'Elevator': 12, // 1 year
  'Glazing': 120, // 10 years
  'Painting': 24, // 2 years
  'Flooring': 60, // 5 years
  'Fire Protection': 12, // 1 year
  'Electrical': 12, // 1 year
  'Plumbing': 12, // 1 year
  'General': 12, // 1 year (standard)
}
