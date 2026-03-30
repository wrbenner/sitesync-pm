// Project Closeout state machine.
// Manages the lifecycle of each closeout item from contract requirement to final approval.

import { setup } from 'xstate'

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
    required: { label: 'Required', color: '#8C8580', bg: 'rgba(140,133,128,0.08)' },
    requested: { label: 'Requested', color: '#3A7BC8', bg: 'rgba(58,123,200,0.08)' },
    submitted: { label: 'Submitted', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    under_review: { label: 'Under Review', color: '#7C5DC7', bg: 'rgba(124,93,199,0.08)' },
    approved: { label: 'Approved', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    rejected: { label: 'Rejected', color: '#C93B3B', bg: 'rgba(201,59,59,0.08)' },
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

interface CloseoutTemplate {
  category: CloseoutCategory
  title: string
  description: string
  specSection?: string
  trade?: string
}

const BASE_CLOSEOUT_ITEMS: CloseoutTemplate[] = [
  // Documentation
  { category: 'om_manual', title: 'HVAC O&M Manual', description: 'Operation and maintenance manual for all HVAC systems', specSection: '23 00 00', trade: 'Mechanical' },
  { category: 'om_manual', title: 'Electrical O&M Manual', description: 'Operation and maintenance manual for electrical systems', specSection: '26 00 00', trade: 'Electrical' },
  { category: 'om_manual', title: 'Plumbing O&M Manual', description: 'Operation and maintenance manual for plumbing systems', specSection: '22 00 00', trade: 'Plumbing' },
  { category: 'om_manual', title: 'Fire Protection O&M Manual', description: 'Operation and maintenance for fire suppression and alarm', specSection: '21 00 00', trade: 'Fire Protection' },
  { category: 'om_manual', title: 'Elevator O&M Manual', description: 'Elevator maintenance and inspection records', specSection: '14 00 00', trade: 'Elevator' },
  { category: 'om_manual', title: 'Building Automation O&M', description: 'BAS/BMS operation manual and point list', specSection: '25 00 00', trade: 'Controls' },

  // As-Built Drawings
  { category: 'as_built', title: 'Architectural As Builts', description: 'Marked up architectural drawings showing field conditions', trade: 'General' },
  { category: 'as_built', title: 'Structural As Builts', description: 'Structural drawing redlines and field modifications', trade: 'Structural' },
  { category: 'as_built', title: 'MEP As Builts', description: 'Mechanical, electrical, and plumbing as built drawings', trade: 'MEP' },
  { category: 'as_built', title: 'Site/Civil As Builts', description: 'Site and civil engineering as built drawings', trade: 'Civil' },

  // Warranties
  { category: 'warranty', title: 'Roofing Warranty', description: 'Manufacturer and contractor roofing warranty', specSection: '07 50 00', trade: 'Roofing' },
  { category: 'warranty', title: 'Waterproofing Warranty', description: 'Below grade and above grade waterproofing warranty', specSection: '07 10 00', trade: 'Waterproofing' },
  { category: 'warranty', title: 'HVAC Equipment Warranty', description: 'Major HVAC equipment manufacturer warranties', specSection: '23 00 00', trade: 'Mechanical' },
  { category: 'warranty', title: 'Elevator Warranty', description: 'Elevator manufacturer and maintenance warranty', specSection: '14 00 00', trade: 'Elevator' },
  { category: 'warranty', title: 'Window/Curtain Wall Warranty', description: 'Glazing and curtain wall system warranty', specSection: '08 44 00', trade: 'Glazing' },
  { category: 'warranty', title: 'Painting Warranty', description: 'Interior and exterior painting warranty', specSection: '09 91 00', trade: 'Painting' },
  { category: 'warranty', title: 'Flooring Warranty', description: 'All flooring materials warranty', specSection: '09 60 00', trade: 'Flooring' },
  { category: 'warranty', title: 'Fire Protection Warranty', description: 'Fire sprinkler and alarm system warranty', specSection: '21 00 00', trade: 'Fire Protection' },

  // Lien Waivers
  { category: 'lien_waiver', title: 'Final Unconditional Lien Waiver (GC)', description: 'General contractor final lien waiver', trade: 'General' },
  { category: 'lien_waiver', title: 'Final Unconditional Lien Waivers (Subs)', description: 'All subcontractor final lien waivers', trade: 'All Trades' },

  // Certificates
  { category: 'substantial_completion', title: 'Certificate of Substantial Completion', description: 'AIA G704 or equivalent', trade: 'General' },
  { category: 'certificate_occupancy', title: 'Certificate of Occupancy', description: 'Temporary or final CO from building department', trade: 'General' },
  { category: 'certificate_occupancy', title: 'Fire Department Approval', description: 'Fire marshal inspection and approval letter', trade: 'General' },

  // Training
  { category: 'training', title: 'HVAC Systems Training', description: 'Owner training on HVAC operation and maintenance', trade: 'Mechanical' },
  { category: 'training', title: 'Fire/Life Safety Training', description: 'Fire alarm, sprinkler, and evacuation training', trade: 'Fire Protection' },
  { category: 'training', title: 'Building Automation Training', description: 'BAS/BMS training for facility staff', trade: 'Controls' },
  { category: 'training', title: 'Elevator Training', description: 'Elevator emergency procedures and basic operation', trade: 'Elevator' },

  // Spare Parts & Attic Stock
  { category: 'spare_parts', title: 'HVAC Spare Parts', description: 'Filters, belts, and replacement components', trade: 'Mechanical' },
  { category: 'attic_stock', title: 'Ceiling Tile Attic Stock', description: 'Matching ceiling tiles for future repairs', trade: 'Ceiling' },
  { category: 'attic_stock', title: 'Flooring Attic Stock', description: 'Matching flooring material for repairs', trade: 'Flooring' },
  { category: 'attic_stock', title: 'Paint Attic Stock', description: 'Touch up paint with color codes', trade: 'Painting' },

  // Commissioning
  { category: 'commissioning', title: 'HVAC Commissioning Report', description: 'Functional performance test results for all HVAC systems', trade: 'Commissioning' },
  { category: 'commissioning', title: 'TAB Report', description: 'Testing, adjusting, and balancing report', trade: 'Mechanical' },
  { category: 'commissioning', title: 'Electrical Testing Report', description: 'Switchgear, transformer, and panel testing results', trade: 'Electrical' },

  // Testing
  { category: 'testing', title: 'Fire Alarm Acceptance Test', description: 'Complete fire alarm system acceptance test', trade: 'Fire Protection' },
  { category: 'testing', title: 'Sprinkler Hydrostatic Test', description: 'Fire sprinkler system pressure test results', trade: 'Fire Protection' },
  { category: 'testing', title: 'Plumbing Pressure Test', description: 'Domestic water system pressure test', trade: 'Plumbing' },

  // Final Items
  { category: 'punch_list', title: 'Final Punch List Completion', description: 'All punch items verified and closed', trade: 'General' },
  { category: 'final_payment', title: 'Final Payment Application', description: 'AIA G702 final application for payment', trade: 'General' },
  { category: 'consent_surety', title: 'Consent of Surety to Final Payment', description: 'Surety company consent for final payment release', trade: 'General' },
  { category: 'permit_closeout', title: 'Building Permit Closeout', description: 'Final inspection sign off and permit closure', trade: 'General' },
  { category: 'insurance', title: 'Final Insurance Certificates', description: 'Completed operations insurance certificates', trade: 'General' },
]

// Additional items by project type
const PROJECT_TYPE_ITEMS: Record<ProjectType, CloseoutTemplate[]> = {
  commercial: [
    { category: 'commissioning', title: 'Building Envelope Commissioning', description: 'Air and water infiltration testing', trade: 'Envelope' },
    { category: 'testing', title: 'Acoustic Testing', description: 'Sound transmission and noise level testing', trade: 'Acoustic' },
  ],
  residential: [
    { category: 'warranty', title: 'Appliance Warranties', description: 'All residential appliance warranties', trade: 'General' },
    { category: 'om_manual', title: 'Homeowner Manual', description: 'Homeowner guide for all systems', trade: 'General' },
  ],
  industrial: [
    { category: 'commissioning', title: 'Process Equipment Commissioning', description: 'Industrial process system testing and startup', trade: 'Process' },
    { category: 'testing', title: 'Environmental Compliance Testing', description: 'Air quality, water discharge, noise testing', trade: 'Environmental' },
    { category: 'permit_closeout', title: 'Environmental Permits Closeout', description: 'EPA and state environmental permit compliance', trade: 'Environmental' },
  ],
  healthcare: [
    { category: 'commissioning', title: 'Medical Gas Commissioning', description: 'Medical gas system verification and testing', trade: 'Medical Gas' },
    { category: 'testing', title: 'Infection Control Risk Assessment', description: 'ICRA documentation and air quality testing', trade: 'HVAC' },
    { category: 'inspection', title: 'Joint Commission Readiness', description: 'Pre inspection checklist for Joint Commission', trade: 'General' },
    { category: 'training', title: 'Medical Equipment Training', description: 'Staff training on medical equipment operation', trade: 'Medical Equipment' },
  ],
  education: [
    { category: 'inspection', title: 'ADA Compliance Verification', description: 'Accessibility compliance inspection', trade: 'General' },
    { category: 'testing', title: 'Indoor Air Quality Testing', description: 'IAQ testing per school district requirements', trade: 'HVAC' },
  ],
  mixed_use: [
    { category: 'commissioning', title: 'Building Envelope Commissioning', description: 'Air and water infiltration testing', trade: 'Envelope' },
    { category: 'om_manual', title: 'Common Area O&M Manual', description: 'Shared systems operation guide', trade: 'General' },
  ],
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
    active: { label: 'Active', color: '#2D8A6E', bg: 'rgba(45,138,110,0.08)' },
    expiring_soon: { label: 'Expiring Soon', color: '#C4850C', bg: 'rgba(196,133,12,0.08)' },
    expired: { label: 'Expired', color: '#C93B3B', bg: 'rgba(201,59,59,0.08)' },
    claimed: { label: 'Claimed', color: '#7C5DC7', bg: 'rgba(124,93,199,0.08)' },
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
