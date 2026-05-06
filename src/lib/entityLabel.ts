// ── entityLabel ───────────────────────────────────────────────────────
// Canonical pretty-printer for entity-type tokens like 'rfi',
// 'change_order', 'pay_app', 'daily_log'. Title-cases multi-word tokens
// and uppercases known acronyms.
//
// Required because direct rendering of entity_type with .replace('_', ' ')
// leaks lowercase technical tokens into user-facing copy ("for this rfi"
// — the deep-dive's complaint #2). Use this everywhere an entity_type
// appears in JSX or copy strings.

const ACRONYMS = new Set([
  'rfi',
  'co',
  'po',
  'mep',
  'ada',
  'rfp',
  'rfq',
  'sub',  // intentionally NOT acronym-cased — "Sub" reads naturally
  'pdf',
  'osha',
  'ppe',
  'jha',
  'ptp',
])

const SPECIAL_CASES: Record<string, string> = {
  rfi: 'RFI',
  rfis: 'RFIs',
  submittal: 'Submittal',
  submittals: 'Submittals',
  change_order: 'Change Order',
  change_orders: 'Change Orders',
  pay_app: 'Pay App',
  pay_apps: 'Pay Apps',
  punch_item: 'Punch Item',
  punch_items: 'Punch Items',
  daily_log: 'Daily Log',
  daily_logs: 'Daily Logs',
  meeting: 'Meeting',
  meetings: 'Meetings',
  drawing: 'Drawing',
  drawings: 'Drawings',
  task: 'Task',
  tasks: 'Tasks',
  field_capture: 'Field Capture',
  field_captures: 'Field Captures',
  schedule_phase: 'Schedule Phase',
  schedule_phases: 'Schedule Phases',
  budget_item: 'Budget Item',
  budget_items: 'Budget Items',
  safety_inspection: 'Safety Inspection',
  safety_inspections: 'Safety Inspections',
  jha: 'JHA',
  ptp: 'PTP',
}

function titleCaseWord(word: string): string {
  if (!word) return word
  if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase()
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/**
 * Pretty-print an entity_type token for user-facing copy.
 *   entityLabel('rfi')          → 'RFI'
 *   entityLabel('rfis')         → 'RFIs'
 *   entityLabel('change_order') → 'Change Order'
 *   entityLabel('Daily Log')    → 'Daily Log'  (idempotent)
 */
export function entityLabel(token: string | null | undefined): string {
  if (!token) return ''
  const normalized = token.trim()
  // Fast path: known canonical strings.
  const lower = normalized.toLowerCase().replace(/\s+/g, '_')
  if (SPECIAL_CASES[lower]) return SPECIAL_CASES[lower]
  // Generic: split on _ or space, titlecase each, uppercase known acronyms.
  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ')
}

/** Plural form, suitable for "23 RFIs", "3 Daily Logs". */
export function entityLabelPlural(token: string | null | undefined): string {
  if (!token) return ''
  const lower = token.toLowerCase().replace(/\s+/g, '_')
  if (SPECIAL_CASES[lower + 's']) return SPECIAL_CASES[lower + 's']
  const singular = entityLabel(token)
  if (!singular) return ''
  // Naive English pluralization: enough for the entity-type vocabulary.
  if (singular.endsWith('y')) return singular.slice(0, -1) + 'ies'
  if (singular.endsWith('s') || singular.endsWith('x')) return singular + 'es'
  return singular + 's'
}
