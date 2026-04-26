// Demo data: "Maple Ridge Mixed-Use" — a realistic mid-construction
// fixture used to seed every new organization with a populated read-only
// demo project. The goal is that a sales demo or first-time signup
// experience never lands on an empty dashboard.
//
// Storyline: 5-story mixed-use development in Westlake, NC. ~$24M
// contract value. Currently 12 weeks into a 60-week schedule. Frame
// is up through L3, drywall starting on L1, MEP rough-in active on
// L2-L3. Active issues across disciplines tell a coherent project story.
//
// Used by:
//   - src/services/demoSeed.ts on org creation (one read-only demo project)
//   - "Reset Demo" button in src/pages/admin/ProjectSettings.tsx
//
// All ids below are deterministic strings so re-seeding the same org
// upserts the same rows rather than duplicating them.

// ── Project ─────────────────────────────────────────────────

export const DEMO_PROJECT = {
  id: 'demo-proj-maple-ridge-0001',
  name: 'Maple Ridge Mixed-Use',
  number: 'MRP-2026-001',
  status: 'active' as const,
  contract_value_cents: 23_750_000_00,
  start_date: '2026-02-01',
  substantial_completion_date: '2027-04-15',
  address_line1: '4720 Maple Ridge Boulevard',
  city: 'Westlake',
  state: 'NC',
  postal_code: '27592',
  square_footage: 102_400,
  number_of_floors: 5,
  description:
    'Five-story mixed-use development. Ground floor retail (8 tenants, 14,200 sf), four floors of multifamily housing (84 units), structured parking below grade. Type V-A construction over Type IA podium. LEED Silver target.',
  is_demo: true,
} as const

// ── Team ────────────────────────────────────────────────────

export const DEMO_TEAM = [
  { id: 'demo-user-pm-01',     full_name: 'Sarah Chen',     email: 'sarah.chen@demo.sitesync.app',       role: 'project_manager',   title: 'Senior Project Manager' },
  { id: 'demo-user-super-01',  full_name: 'Marcus Reyes',   email: 'marcus.reyes@demo.sitesync.app',     role: 'superintendent',    title: 'General Superintendent' },
  { id: 'demo-user-pe-01',     full_name: 'Anika Patel',    email: 'anika.patel@demo.sitesync.app',      role: 'project_engineer',  title: 'Project Engineer' },
  { id: 'demo-user-fore-01',   full_name: 'Tomas Kowalski', email: 'tomas.kowalski@demo.sitesync.app',   role: 'foreman',           title: 'Concrete Foreman' },
  { id: 'demo-user-fore-02',   full_name: 'Diane Whitaker', email: 'diane.whitaker@demo.sitesync.app',   role: 'foreman',           title: 'MEP Foreman' },
  { id: 'demo-user-arch-01',   full_name: 'Elena Garcia',   email: 'elena.garcia@arch.demo.sitesync.app',role: 'subcontractor',     title: 'Lead Architect — HKS' },
  { id: 'demo-user-eng-01',    full_name: 'Wei Zhang',      email: 'wei.zhang@struct.demo.sitesync.app', role: 'subcontractor',     title: 'Structural Engineer — Walter P Moore' },
  { id: 'demo-user-owner-01',  full_name: 'Priya Anand',    email: 'priya.anand@owner.demo.sitesync.app',role: 'owner',             title: 'Owner Rep — Maple Ridge LLC' },
] as const

// ── Vendors / Subcontractors ────────────────────────────────

export const DEMO_VENDORS = [
  { id: 'demo-vend-conc-01', name: 'Atlantic Concrete Co.',          trade: 'concrete',     contract_value_cents: 3_240_000_00 },
  { id: 'demo-vend-stl-01',  name: 'Piedmont Structural Steel',       trade: 'structural',   contract_value_cents: 1_890_000_00 },
  { id: 'demo-vend-frm-01',  name: 'Carolina Light Gauge Framing',    trade: 'framing',      contract_value_cents: 1_120_000_00 },
  { id: 'demo-vend-elec-01', name: 'Tidewater Electric LLC',          trade: 'electrical',   contract_value_cents:   985_000_00 },
  { id: 'demo-vend-plum-01', name: 'Eastern Mechanical Services',     trade: 'plumbing',     contract_value_cents:   720_000_00 },
  { id: 'demo-vend-hvac-01', name: 'Cardinal HVAC',                   trade: 'mechanical',   contract_value_cents:   915_000_00 },
  { id: 'demo-vend-glaz-01', name: 'Southern Glass & Glazing',        trade: 'glazing',      contract_value_cents:   612_000_00 },
  { id: 'demo-vend-roof-01', name: 'Apex Roofing Specialists',        trade: 'roofing',      contract_value_cents:   445_000_00 },
] as const

// ── Schedule phases ─────────────────────────────────────────

export const DEMO_PHASES = [
  { id: 'demo-ph-01', name: 'Site Mobilization',                start: '2026-02-01', end: '2026-02-12', status: 'completed',   pct: 100 },
  { id: 'demo-ph-02', name: 'Excavation & Underground Utilities',start:'2026-02-13', end: '2026-03-10', status: 'completed',   pct: 100 },
  { id: 'demo-ph-03', name: 'Foundation & Podium Slab',         start: '2026-03-11', end: '2026-04-08', status: 'completed',   pct: 100 },
  { id: 'demo-ph-04', name: 'Wood Frame — L1 to L3',             start: '2026-04-09', end: '2026-05-06', status: 'in_progress', pct: 75  },
  { id: 'demo-ph-05', name: 'Wood Frame — L4 to L5',             start: '2026-04-30', end: '2026-05-27', status: 'in_progress', pct: 25  },
  { id: 'demo-ph-06', name: 'MEP Rough-In',                      start: '2026-04-23', end: '2026-06-24', status: 'in_progress', pct: 35  },
  { id: 'demo-ph-07', name: 'Building Envelope',                 start: '2026-05-21', end: '2026-07-22', status: 'upcoming',    pct: 0   },
  { id: 'demo-ph-08', name: 'Drywall & Interior Finishes',       start: '2026-06-18', end: '2026-09-30', status: 'upcoming',    pct: 0   },
  { id: 'demo-ph-09', name: 'Site Work & Hardscape',             start: '2026-08-12', end: '2026-10-15', status: 'upcoming',    pct: 0   },
  { id: 'demo-ph-10', name: 'Final MEP Trim & Fixtures',         start: '2026-10-01', end: '2027-01-15', status: 'upcoming',    pct: 0   },
  { id: 'demo-ph-11', name: 'Commissioning & Punch List',        start: '2027-01-16', end: '2027-03-15', status: 'upcoming',    pct: 0   },
  { id: 'demo-ph-12', name: 'Closeout & Substantial Completion', start: '2027-03-16', end: '2027-04-15', status: 'upcoming',    pct: 0   },
] as const

// ── RFIs (30) ───────────────────────────────────────────────

export const DEMO_RFIS = [
  { id: 'demo-rfi-001', number: 1,  title: 'Underground utility conflict at column line C-12', status: 'closed',      priority: 'high',   discipline: 'civil',         due_date: '2026-03-01', closed_date: '2026-02-26' },
  { id: 'demo-rfi-002', number: 2,  title: 'Rebar spacing clarification — podium slab edge',   status: 'closed',      priority: 'medium', discipline: 'structural',    due_date: '2026-03-15', closed_date: '2026-03-12' },
  { id: 'demo-rfi-003', number: 3,  title: 'Acoustic separation detail — party walls',         status: 'closed',      priority: 'medium', discipline: 'architectural', due_date: '2026-03-20', closed_date: '2026-03-18' },
  { id: 'demo-rfi-004', number: 4,  title: 'Embedded steel coordination at L1 ceiling',        status: 'closed',      priority: 'high',   discipline: 'structural',    due_date: '2026-03-25', closed_date: '2026-03-23' },
  { id: 'demo-rfi-005', number: 5,  title: 'Door hardware spec discrepancy — units 102/202',   status: 'closed',      priority: 'low',    discipline: 'architectural', due_date: '2026-04-01', closed_date: '2026-03-29' },
  { id: 'demo-rfi-006', number: 6,  title: 'Plumbing chase routing — L2 to L3',                status: 'closed',      priority: 'medium', discipline: 'plumbing',      due_date: '2026-04-05', closed_date: '2026-04-04' },
  { id: 'demo-rfi-007', number: 7,  title: 'Electrical panel sizing — retail tenant 4',        status: 'closed',      priority: 'medium', discipline: 'electrical',    due_date: '2026-04-10', closed_date: '2026-04-09' },
  { id: 'demo-rfi-008', number: 8,  title: 'Window flashing detail at corner condition',       status: 'closed',      priority: 'medium', discipline: 'architectural', due_date: '2026-04-12', closed_date: '2026-04-11' },
  { id: 'demo-rfi-009', number: 9,  title: 'Stair stringer connection at L4 landing',          status: 'closed',      priority: 'high',   discipline: 'structural',    due_date: '2026-04-15', closed_date: '2026-04-14' },
  { id: 'demo-rfi-010', number: 10, title: 'HVAC duct routing conflict with sprinkler main',   status: 'closed',      priority: 'high',   discipline: 'mechanical',    due_date: '2026-04-18', closed_date: '2026-04-17' },
  { id: 'demo-rfi-011', number: 11, title: 'Beam pocket dimension — gridline B at L2',         status: 'closed',      priority: 'medium', discipline: 'structural',    due_date: '2026-04-20', closed_date: '2026-04-19' },
  { id: 'demo-rfi-012', number: 12, title: 'Concrete mix design — exterior balcony slabs',     status: 'closed',      priority: 'low',    discipline: 'structural',    due_date: '2026-04-21', closed_date: '2026-04-20' },
  { id: 'demo-rfi-013', number: 13, title: 'Window head height — units 305-308',               status: 'in_review',   priority: 'medium', discipline: 'architectural', due_date: '2026-04-29' },
  { id: 'demo-rfi-014', number: 14, title: 'Curtain wall anchor at slab edge — typical',       status: 'in_review',   priority: 'high',   discipline: 'structural',    due_date: '2026-05-02' },
  { id: 'demo-rfi-015', number: 15, title: 'Fire-rated assembly at electrical room — code',    status: 'in_review',   priority: 'high',   discipline: 'architectural', due_date: '2026-05-04' },
  { id: 'demo-rfi-016', number: 16, title: 'Plumbing vent termination — roof penetrations',    status: 'in_review',   priority: 'medium', discipline: 'plumbing',      due_date: '2026-05-06' },
  { id: 'demo-rfi-017', number: 17, title: 'ADA clearance at retail entry 2 vestibule',        status: 'in_review',   priority: 'high',   discipline: 'architectural', due_date: '2026-05-08' },
  { id: 'demo-rfi-018', number: 18, title: 'Mechanical roof unit weight — structural review',  status: 'in_review',   priority: 'high',   discipline: 'structural',    due_date: '2026-05-10' },
  { id: 'demo-rfi-019', number: 19, title: 'Ceiling height conflict with HVAC return — corridor', status: 'in_review',priority: 'medium', discipline: 'mechanical',    due_date: '2026-05-11' },
  { id: 'demo-rfi-020', number: 20, title: 'Shower drain alignment — units 206 ADA',           status: 'in_review',   priority: 'medium', discipline: 'plumbing',      due_date: '2026-05-12' },
  { id: 'demo-rfi-021', number: 21, title: 'Embedded conduit routing at L3 slab',              status: 'open',        priority: 'high',   discipline: 'electrical',    due_date: '2026-05-13' },
  { id: 'demo-rfi-022', number: 22, title: 'Exterior trim profile — gable returns',            status: 'open',        priority: 'low',    discipline: 'architectural', due_date: '2026-05-14' },
  { id: 'demo-rfi-023', number: 23, title: 'Stair pressurization fan sizing',                  status: 'open',        priority: 'medium', discipline: 'mechanical',    due_date: '2026-05-15' },
  { id: 'demo-rfi-024', number: 24, title: 'Garage drain elevation conflict with utility',     status: 'open',        priority: 'high',   discipline: 'civil',         due_date: '2026-05-16' },
  { id: 'demo-rfi-025', number: 25, title: 'Backing requirement — grab bars in ADA bathrooms', status: 'open',        priority: 'medium', discipline: 'framing',       due_date: '2026-05-17' },
  { id: 'demo-rfi-026', number: 26, title: 'Window operable opening egress — bedroom B',       status: 'open',        priority: 'high',   discipline: 'architectural', due_date: '2026-05-18' },
  { id: 'demo-rfi-027', number: 27, title: 'Roof slope at scupper — ponding concern',          status: 'open',        priority: 'medium', discipline: 'roofing',       due_date: '2026-05-19' },
  { id: 'demo-rfi-028', number: 28, title: 'Sprinkler head spacing — open ceiling units',      status: 'open',        priority: 'medium', discipline: 'plumbing',      due_date: '2026-05-20' },
  { id: 'demo-rfi-029', number: 29, title: 'Elevator shaft tolerance — landing alignment',     status: 'open',        priority: 'high',   discipline: 'structural',    due_date: '2026-05-21' },
  { id: 'demo-rfi-030', number: 30, title: 'Brick coursing at podium transition',              status: 'open',        priority: 'low',    discipline: 'architectural', due_date: '2026-05-22' },
] as const

// ── Submittals (12) ─────────────────────────────────────────

export const DEMO_SUBMITTALS = [
  { id: 'demo-sub-001', spec_section: '03 30 00', title: 'Cast-in-place concrete mix design',           type: 'product_data',  status: 'approved',          submitted_date: '2026-02-15', approved_date: '2026-02-22' },
  { id: 'demo-sub-002', spec_section: '03 21 00', title: 'Reinforcing steel shop drawings',             type: 'shop_drawing',  status: 'approved',          submitted_date: '2026-02-20', approved_date: '2026-03-01' },
  { id: 'demo-sub-003', spec_section: '05 12 00', title: 'Structural steel shop drawings — frames A-D', type: 'shop_drawing',  status: 'approved',          submitted_date: '2026-03-05', approved_date: '2026-03-15' },
  { id: 'demo-sub-004', spec_section: '06 17 00', title: 'I-joist product data + connection details',   type: 'product_data',  status: 'approved',          submitted_date: '2026-03-10', approved_date: '2026-03-18' },
  { id: 'demo-sub-005', spec_section: '08 41 13', title: 'Aluminum storefront — retail facade',         type: 'shop_drawing',  status: 'approved_as_noted', submitted_date: '2026-04-05', approved_date: '2026-04-14' },
  { id: 'demo-sub-006', spec_section: '07 21 16', title: 'Wall insulation — R-21 batt',                 type: 'product_data',  status: 'approved',          submitted_date: '2026-04-10', approved_date: '2026-04-17' },
  { id: 'demo-sub-007', spec_section: '23 31 13', title: 'Sheet metal ductwork shop drawings — L2-L3',  type: 'shop_drawing',  status: 'in_review',         submitted_date: '2026-04-22' },
  { id: 'demo-sub-008', spec_section: '26 27 26', title: 'Wiring devices — receptacles, switches',      type: 'product_data',  status: 'in_review',         submitted_date: '2026-04-23' },
  { id: 'demo-sub-009', spec_section: '08 14 00', title: 'Wood doors — interior unit doors',            type: 'product_data',  status: 'in_review',         submitted_date: '2026-04-24' },
  { id: 'demo-sub-010', spec_section: '09 21 16', title: 'Gypsum drywall — Type X assemblies',          type: 'product_data',  status: 'in_review',         submitted_date: '2026-04-25' },
  { id: 'demo-sub-011', spec_section: '07 53 23', title: 'TPO roof system + warranty',                  type: 'product_data',  status: 'draft',             submitted_date: null },
  { id: 'demo-sub-012', spec_section: '32 31 13', title: 'Site fencing — chain link permanent',         type: 'product_data',  status: 'draft',             submitted_date: null },
] as const

// ── Change Orders (6) ───────────────────────────────────────

export const DEMO_CHANGE_ORDERS = [
  { id: 'demo-co-001', number: 1, title: 'Unforeseen rock at column line C-12 — additional excavation', amount_cents:  87_500_00, status: 'approved',       type: 'co',  reason: 'unforeseen_condition', approved_date: '2026-03-01' },
  { id: 'demo-co-002', number: 2, title: 'Owner-requested upgrade to LED retail signage allowance',     amount_cents:  42_300_00, status: 'approved',       type: 'co',  reason: 'owner_requested',      approved_date: '2026-03-22' },
  { id: 'demo-co-003', number: 3, title: 'PCO — added structural steel angle at gridline B/4',          amount_cents:  18_900_00, status: 'pending_review', type: 'pco', reason: 'design_clarification' },
  { id: 'demo-co-004', number: 4, title: 'COR — accelerated steel delivery to recover schedule',         amount_cents:  31_200_00, status: 'pending_review', type: 'cor', reason: 'schedule_recovery' },
  { id: 'demo-co-005', number: 5, title: 'PCO — fire-rated assembly upgrade per RFI #15',                amount_cents:  24_600_00, status: 'draft',          type: 'pco', reason: 'code_compliance' },
  { id: 'demo-co-006', number: 6, title: 'PCO — additional MEP coordination per RFI #10',                amount_cents:   9_800_00, status: 'draft',          type: 'pco', reason: 'design_clarification' },
] as const

// ── Punch items (60) — generated programmatically for breadth ──

const PUNCH_TEMPLATES = [
  { trade: 'painting',     items: ['Touch-up wall paint', 'Re-coat ceiling', 'Spot-prime patched drywall', 'Caulk corner trim', 'Repaint door frame'] },
  { trade: 'electrical',   items: ['Replace damaged faceplate', 'Re-aim recessed lights', 'Tighten panel connections', 'Test GFCI receptacle', 'Adjust switch height'] },
  { trade: 'plumbing',     items: ['Re-set toilet wax ring', 'Adjust faucet flow', 'Tighten supply line', 'Caulk shower base', 'Replace damaged escutcheon'] },
  { trade: 'mechanical',   items: ['Balance air register', 'Tighten ductwork strap', 'Replace pleated filter', 'Adjust thermostat sensor', 'Insulate exposed pipe'] },
  { trade: 'carpentry',    items: ['Re-hang sticking door', 'Plane cabinet door reveal', 'Adjust drawer slide', 'Re-shim door frame', 'Replace damaged base trim'] },
  { trade: 'flooring',     items: ['Replace cracked tile', 'Re-stretch carpet seam', 'Repair LVT gap', 'Polish concrete spot', 'Patch transition strip'] },
  { trade: 'glazing',      items: ['Re-caulk window perimeter', 'Replace scratched glazing', 'Adjust window operator', 'Reseat sash gasket', 'Touch up frame paint'] },
] as const

export const DEMO_PUNCH_ITEMS = (() => {
  const out: { id: string; number: number; title: string; trade: string; status: string; floor: string; priority: string }[] = []
  let n = 1
  for (const tmpl of PUNCH_TEMPLATES) {
    for (let i = 0; i < tmpl.items.length; i++) {
      for (let f = 1; f <= 2; f++) {
        const statuses = ['open', 'in_progress', 'sub_complete', 'verified']
        const status = statuses[(n + i + f) % statuses.length]
        const priorities = ['low', 'medium', 'high']
        const priority = priorities[(n + f) % priorities.length]
        out.push({
          id: `demo-punch-${String(n).padStart(3, '0')}`,
          number: n,
          title: `${tmpl.items[i]} — Unit ${100 * f + i + 1}`,
          trade: tmpl.trade,
          status,
          floor: `L${f}`,
          priority,
        })
        n++
        if (out.length >= 60) break
      }
      if (out.length >= 60) break
    }
    if (out.length >= 60) break
  }
  return out
})()

// ── Daily logs (last 14 days, anchored to demo "today") ─────

export const DEMO_DAILY_LOGS = (() => {
  // Anchor to a fixed "today" so the demo data stays stable regardless
  // of when the seeder runs. Update annually as the demo storyline ages.
  const anchor = new Date('2026-04-25')
  const logs: Array<{
    id: string
    log_date: string
    weather: string
    temperature_high: number
    temperature_low: number
    workers_onsite: number
    work_summary: string
    safety_notes: string
    delays: string
  }> = []

  const summaries = [
    'Frame crew progressing on L4 walls north quad. Concrete crew finished topping slab pour at L3. MEP rough-in continuing on L2.',
    'Drywall delivery arrived. Frame crew on L4 east elevation. Plumbing rough-in started in core.',
    'Steel erector completed connections at gridline B/4. Mechanical roof curbs set on L5 deck.',
    'Concrete inspector approved L3 slab. Wood frame crew started L5 walls. Electrical pulled feeders to retail panels.',
    'Window vendor on site for storefront measure-up. Drywall hangers continuing L1 retail. HVAC duct riser routed to L4.',
    'Heavy rain morning — exterior framing paused 0700–1100. MEP rough-in continued indoors. Site mud cleanup at end of day.',
    'Roofer mobilized for L5 deck. Frame crew completed L5 north quad. Plumbing tested at L2 — no leaks.',
    'Drywall hangers finished L1. Tape and finish crew started L1. Electrical inspection scheduled for L2 next week.',
    'Concrete saw cutting at podium for added utility chase. Frame crew on L5 south quad. MEP coordination meeting completed.',
    'Window storefront frames arrived. Set L1 retail east elevation. Drywall continuing on L1 corridor.',
    'Frame crew completed L5 walls. Sheathing crew started roof deck. MEP rough-in inspection passed L2.',
    'TPO roof underlayment installed L5. Drywall hangers on L2 corridor. Painting crew started prime coat on L1 retail.',
    'Roofer completed underlayment. Membrane delivery scheduled tomorrow. Window frames installed at L1 retail east.',
    'TPO membrane installation started. Drywall finishing crew on L2 corridor. Site clean-up day-of-week.',
  ]

  for (let i = 13; i >= 0; i--) {
    const d = new Date(anchor)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    logs.push({
      id: `demo-dl-${dateStr}`,
      log_date: dateStr,
      weather: ['clear', 'partly_cloudy', 'overcast', 'rain'][i % 4],
      temperature_high: 68 + (i % 8),
      temperature_low: 48 + (i % 6),
      workers_onsite: 18 + ((i * 3) % 12),
      work_summary: summaries[summaries.length - 1 - i] ?? summaries[0],
      safety_notes: i % 5 === 0 ? 'Weekly toolbox talk: ladder safety. All crews attended.' : '',
      delays: i === 5 ? 'Heavy rain delayed exterior framing 4 hours.' : '',
    })
  }
  return logs
})()

// ── Drawings (5) ────────────────────────────────────────────

export const DEMO_DRAWINGS = [
  { id: 'demo-dwg-001', sheet_number: 'A-101', discipline: 'architectural', title: 'Floor Plan — Level 1 Retail',     revision: '2', status: 'current' },
  { id: 'demo-dwg-002', sheet_number: 'A-201', discipline: 'architectural', title: 'Floor Plan — Typical Residential', revision: '2', status: 'current' },
  { id: 'demo-dwg-003', sheet_number: 'S-301', discipline: 'structural',    title: 'Framing Plan — L3 Wood Frame',     revision: '1', status: 'current' },
  { id: 'demo-dwg-004', sheet_number: 'M-401', discipline: 'mechanical',    title: 'HVAC Layout — L2',                  revision: '3', status: 'current' },
  { id: 'demo-dwg-005', sheet_number: 'E-501', discipline: 'electrical',    title: 'Power Plan — Retail Panels',        revision: '2', status: 'current' },
] as const

// ── Convenience: full demo bundle ───────────────────────────

export const DEMO_BUNDLE = {
  project: DEMO_PROJECT,
  team: DEMO_TEAM,
  vendors: DEMO_VENDORS,
  phases: DEMO_PHASES,
  rfis: DEMO_RFIS,
  submittals: DEMO_SUBMITTALS,
  change_orders: DEMO_CHANGE_ORDERS,
  punch_items: DEMO_PUNCH_ITEMS,
  daily_logs: DEMO_DAILY_LOGS,
  drawings: DEMO_DRAWINGS,
} as const

export type DemoBundle = typeof DEMO_BUNDLE
