import type { CloseoutTemplate, ProjectType } from '../machines/closeoutMachine'

// ── Base Closeout Items ──────────────────────────────────
// Standard closeout deliverables required on all project types.
// These are industry-standard template items, not mock data.

export const BASE_CLOSEOUT_ITEMS: CloseoutTemplate[] = [
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

// ── Project Type Specific Items ──────────────────────────
// Additional closeout items required for specific project types.

export const PROJECT_TYPE_ITEMS: Record<ProjectType, CloseoutTemplate[]> = {
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
