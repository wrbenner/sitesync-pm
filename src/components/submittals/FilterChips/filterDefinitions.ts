// Phase 3 — single source of truth for the 20 filter chips.
//
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 3 §A:
//   - 16 Procore parity: Approver, Ball In Court, Created By, Current
//     Revision, Division, Location, Number, Private, Received From,
//     Response, Responsible Contractor, Spec Section, Status, Submittal
//     Manager, Submittal Package, Type
//   - 4 SiteSync-only: Iris Pre-flight Finding, Schedule Activity At
//     Risk, Required-on-Site Within N Days, On Critical Path
//
// Each chip defines:
//   * id        — URL key (snake_case)
//   * label     — human label rendered in the dropdown + pill
//   * group     — 'people' | 'taxonomy' | 'date' | 'flag' | 'iris' (renderer family)
//   * inputKind — what UI the operand picker uses
//   * decode    — parses URL string → typed value (for filter application)
//   * encode    — typed value → URL string (for share-link round-trip)
//   * matches   — predicate for filtering rows client-side
//
// The same registry is consumed by AddFilterDropdown (UI), useSubmittalFilters
// (URL state), and SubmittalsItemsView's filterFn prop (row-level apply).
// Server-side filtering goes through filterSubmittals (D38 endpoint) — Phase 3
// reuses the existing endpoint via additional query params.

import type { SubmittalKind, SubmittalStatus } from '../../../types/submittal'

// ── Input kinds the chip dropdown supports ──────────────────────────────────

export type ChipInputKind =
  | 'people-multi'         // people picker, multi
  | 'org-multi'            // organization picker, multi
  | 'csi-division-multi'   // CSI Div 00-49, multi
  | 'csi-section-multi'    // CSI section picker (with prefix-match), multi
  | 'location-hierarchy'   // hierarchical location picker (project locations)
  | 'package-multi'        // submittal package picker, multi
  | 'kind-multi'           // SubmittalKind multi
  | 'status-multi'         // SubmittalStatus multi (9-state set)
  | 'disposition-multi'    // codeset-aware disposition multi
  | 'rev-number-range'     // numeric range
  | 'days-input'           // number input + quick presets
  | 'text-contains'        // free-form contains
  | 'boolean'              // true / false / unset
  | 'iris-finding'         // 'has_p0' | 'has_p1' | 'none' | 'specific_finding_id'

export type ChipGroup = 'people' | 'taxonomy' | 'date' | 'flag' | 'iris'

// ── Chip definitions ────────────────────────────────────────────────────────

export interface ChipDefinition<TValue = unknown> {
  /** URL key. snake_case. Stable. */
  id: string
  /** Dropdown label + pill prefix. */
  label: string
  /** Group for the dropdown grouping header. */
  group: ChipGroup
  /** Operand UI. */
  inputKind: ChipInputKind
  /** Source of truth for whether this chip is Procore-parity (16) or SiteSync-only (4). */
  procoreParity: boolean
  /** URL → typed. Returns undefined when the URL value is absent or invalid. */
  decode: (raw: string | null | undefined) => TValue | undefined
  /** Typed → URL. Returns null to clear the param. */
  encode: (value: TValue) => string | null
  /** True iff the row passes this chip's filter for the given value. */
  matches: (row: Record<string, unknown>, value: TValue) => boolean
  /** Short pill summary (e.g. "Status: in review, sent to reviewer"). */
  pillSummary: (value: TValue) => string
}

// ── Helpers used by multiple chips ──────────────────────────────────────────

const splitCsv = (raw: string | null | undefined): string[] => {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

const joinCsv = (items: string[]): string | null => {
  if (!items.length) return null
  return items.map((s) => s.trim()).filter(Boolean).join(',')
}

const decodeBool = (raw: string | null | undefined): boolean | undefined => {
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  return undefined
}

const encodeBool = (v: boolean): string => (v ? 'true' : 'false')

const decodeNum = (raw: string | null | undefined): number | undefined => {
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

const stringFieldMatchesAny = (
  row: Record<string, unknown>,
  fieldKeys: string[],
  ids: string[],
): boolean => {
  if (!ids.length) return true
  for (const k of fieldKeys) {
    const v = row[k]
    if (typeof v === 'string' && ids.includes(v)) return true
  }
  return false
}

const truthyStr = (v: unknown): string => (v == null ? '' : String(v))

// ── Chip registry ───────────────────────────────────────────────────────────

const STR_LIST_CHIP = (
  id: string,
  label: string,
  group: ChipGroup,
  inputKind: ChipInputKind,
  procoreParity: boolean,
  rowFields: string[],
): ChipDefinition<string[]> => ({
  id,
  label,
  group,
  inputKind,
  procoreParity,
  decode: (raw) => {
    const items = splitCsv(raw)
    return items.length ? items : undefined
  },
  encode: (v) => joinCsv(v),
  matches: (row, ids) => stringFieldMatchesAny(row, rowFields, ids),
  pillSummary: (v) => `${label}: ${v.length === 1 ? v[0] : `${v.length} selected`}`,
})

const BOOL_CHIP = (
  id: string,
  label: string,
  group: ChipGroup,
  procoreParity: boolean,
  rowField: string,
): ChipDefinition<boolean> => ({
  id,
  label,
  group,
  inputKind: 'boolean',
  procoreParity,
  decode: decodeBool,
  encode: encodeBool,
  matches: (row, val) => Boolean(row[rowField]) === val,
  pillSummary: (v) => `${label}: ${v ? 'yes' : 'no'}`,
})

// ── 16 Procore parity ──────────────────────────────────────────────────────

export const CHIP_APPROVER = STR_LIST_CHIP(
  'approver', 'Approver', 'people', 'people-multi', true,
  ['current_reviewer_id', 'current_reviewer'],
)

export const CHIP_BALL_IN_COURT: ChipDefinition<string[]> = {
  id: 'ball_in_court',
  label: 'Ball In Court',
  group: 'people',
  inputKind: 'people-multi',
  procoreParity: true,
  decode: (raw) => {
    const items = splitCsv(raw)
    return items.length ? items : undefined
  },
  encode: (v) => joinCsv(v),
  matches: (row, val) => {
    if (!val.length) return true
    const reviewer = truthyStr(row.current_reviewer_id ?? row.current_reviewer)
    const role = truthyStr(row.current_reviewer_role).toLowerCase()
    for (const v of val) {
      if (v === '__unassigned__' && !reviewer) return true
      if (v === '__architect_side__' && /arch/.test(role)) return true
      if (v === '__sub_side__' && /sub|contractor/.test(role)) return true
      if (v === reviewer) return true
    }
    return false
  },
  pillSummary: (v) => `BIC: ${v.length === 1 ? v[0] : `${v.length} selected`}`,
}

export const CHIP_CREATED_BY = STR_LIST_CHIP(
  'created_by', 'Created By', 'people', 'people-multi', true, ['created_by'],
)

export const CHIP_CURRENT_REVISION: ChipDefinition<{ min?: number; max?: number }> = {
  id: 'current_revision',
  label: 'Current Revision',
  group: 'taxonomy',
  inputKind: 'rev-number-range',
  procoreParity: true,
  decode: (raw) => {
    if (!raw) return undefined
    const m = raw.match(/^(\d*)-(\d*)$/)
    if (!m) return undefined
    const min = m[1] ? Number(m[1]) : undefined
    const max = m[2] ? Number(m[2]) : undefined
    if (min === undefined && max === undefined) return undefined
    return { min, max }
  },
  encode: (v) => `${v.min ?? ''}-${v.max ?? ''}`,
  matches: (row, val) => {
    const r = (row.rev_number as number | null) ?? 0
    if (val.min !== undefined && r < val.min) return false
    if (val.max !== undefined && r > val.max) return false
    return true
  },
  pillSummary: (v) => `Rev: ${v.min ?? '0'}–${v.max ?? '∞'}`,
}

export const CHIP_DIVISION = STR_LIST_CHIP(
  'division', 'Division', 'taxonomy', 'csi-division-multi', true, ['csi_division'],
)

export const CHIP_LOCATION = STR_LIST_CHIP(
  'location', 'Location', 'taxonomy', 'location-hierarchy', true, ['location_id'],
)

export const CHIP_NUMBER: ChipDefinition<string> = {
  id: 'number',
  label: 'Number',
  group: 'taxonomy',
  inputKind: 'text-contains',
  procoreParity: true,
  decode: (raw) => (raw ? raw : undefined),
  encode: (v) => v || null,
  matches: (row, val) => {
    if (!val) return true
    return truthyStr(row.number).toLowerCase().includes(val.toLowerCase())
  },
  pillSummary: (v) => `# contains "${v}"`,
}

export const CHIP_PRIVATE = BOOL_CHIP('private', 'Private', 'flag', true, 'is_private')

export const CHIP_RECEIVED_FROM = STR_LIST_CHIP(
  'received_from', 'Received From', 'people', 'people-multi', true,
  ['responsible_sub_id', 'subcontractor', 'created_by'],
)

export const CHIP_RESPONSE = STR_LIST_CHIP(
  'response', 'Response', 'taxonomy', 'disposition-multi', true,
  ['disposition'],
)

export const CHIP_RESPONSIBLE_CONTRACTOR = STR_LIST_CHIP(
  'responsible_contractor', 'Responsible Contractor', 'people', 'org-multi', true,
  ['responsible_sub_id'],
)

export const CHIP_SPEC_SECTION: ChipDefinition<string[]> = {
  id: 'spec_section',
  label: 'Spec Section',
  group: 'taxonomy',
  inputKind: 'csi-section-multi',
  procoreParity: true,
  decode: (raw) => {
    const items = splitCsv(raw)
    return items.length ? items : undefined
  },
  encode: (v) => joinCsv(v),
  matches: (row, val) => {
    if (!val.length) return true
    const sec = truthyStr(row.csi_section ?? row.spec_section)
    for (const pattern of val) {
      // Trailing * = prefix match (Procore parity: 08* matches 08 41 13)
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1).replace(/\s+/g, '')
        if (sec.replace(/\s+/g, '').startsWith(prefix)) return true
      } else if (sec === pattern) {
        return true
      }
    }
    return false
  },
  pillSummary: (v) => `Spec §: ${v.length === 1 ? v[0] : `${v.length} sections`}`,
}

export const CHIP_STATUS: ChipDefinition<SubmittalStatus[]> = {
  id: 'status',
  label: 'Status',
  group: 'taxonomy',
  inputKind: 'status-multi',
  procoreParity: true,
  decode: (raw) => {
    const items = splitCsv(raw) as SubmittalStatus[]
    return items.length ? items : undefined
  },
  encode: (v) => joinCsv(v as string[]),
  matches: (row, val) => val.includes(truthyStr(row.status) as SubmittalStatus),
  pillSummary: (v) => `Status: ${v.length === 1 ? v[0] : `${v.length} states`}`,
}

export const CHIP_SUBMITTAL_MANAGER = STR_LIST_CHIP(
  'submittal_manager', 'Submittal Manager', 'people', 'people-multi', true,
  ['submittal_manager_id'],
)

export const CHIP_SUBMITTAL_PACKAGE = STR_LIST_CHIP(
  'submittal_package', 'Submittal Package', 'taxonomy', 'package-multi', true,
  ['submittal_package_id'],
)

export const CHIP_TYPE: ChipDefinition<SubmittalKind[]> = {
  id: 'type',
  label: 'Type',
  group: 'taxonomy',
  inputKind: 'kind-multi',
  procoreParity: true,
  decode: (raw) => {
    const items = splitCsv(raw) as SubmittalKind[]
    return items.length ? items : undefined
  },
  encode: (v) => joinCsv(v as string[]),
  matches: (row, val) => val.includes(truthyStr(row.kind ?? row.type) as SubmittalKind),
  pillSummary: (v) => `Type: ${v.length === 1 ? v[0] : `${v.length} kinds`}`,
}

// ── 4 SiteSync-only ────────────────────────────────────────────────────────

export const CHIP_IRIS_FINDING: ChipDefinition<'has_p0' | 'has_p1' | 'none' | string> = {
  id: 'iris_finding',
  label: 'Iris Pre-flight Finding',
  group: 'iris',
  inputKind: 'iris-finding',
  procoreParity: false,
  decode: (raw) => (raw && raw.length ? raw : undefined),
  encode: (v) => v || null,
  matches: (row, val) => {
    const findings = row.iris_preflight_findings as Array<{ severity?: string; id?: string }> | null | undefined
    if (val === 'none') return !findings || findings.length === 0
    if (!findings || !findings.length) return false
    if (val === 'has_p0') return findings.some((f) => f.severity === 'P0')
    if (val === 'has_p1') return findings.some((f) => f.severity === 'P1')
    return findings.some((f) => f.id === val)
  },
  pillSummary: (v) => {
    if (v === 'has_p0') return 'Iris: has P0 finding'
    if (v === 'has_p1') return 'Iris: has P1 finding'
    if (v === 'none') return 'Iris: no findings'
    return `Iris: ${v}`
  },
}

export const CHIP_SCHEDULE_AT_RISK: ChipDefinition<boolean> = {
  id: 'schedule_at_risk',
  label: 'Schedule Activity At Risk',
  group: 'iris',
  inputKind: 'boolean',
  procoreParity: false,
  decode: decodeBool,
  encode: encodeBool,
  matches: (row, val) => {
    const band = truthyStr(row.risk_band)
    const atRisk = band === 'overdue' || band === 'at_risk' || band === 'submit_overdue'
    return atRisk === val
  },
  pillSummary: (v) => `Schedule risk: ${v ? 'yes' : 'no'}`,
}

export const CHIP_REQUIRED_WITHIN_N_DAYS: ChipDefinition<number> = {
  id: 'required_within_n_days',
  label: 'Required-on-Site Within N Days',
  group: 'date',
  inputKind: 'days-input',
  procoreParity: false,
  decode: decodeNum,
  encode: (v) => String(v),
  matches: (row, val) => {
    const onSite = (row.required_on_site_date as string | null) ?? null
    if (!onSite) return false
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + val)
    return new Date(onSite) <= cutoff
  },
  pillSummary: (v) => `Required ≤ ${v} day${v === 1 ? '' : 's'}`,
}

export const CHIP_CRITICAL_PATH = BOOL_CHIP(
  'critical_path', 'On Critical Path', 'flag', false, 'is_critical_path',
)

// ── Registry ────────────────────────────────────────────────────────────────

export const CHIPS: ChipDefinition[] = [
  CHIP_APPROVER,
  CHIP_BALL_IN_COURT,
  CHIP_CREATED_BY,
  CHIP_CURRENT_REVISION,
  CHIP_DIVISION,
  CHIP_LOCATION,
  CHIP_NUMBER,
  CHIP_PRIVATE,
  CHIP_RECEIVED_FROM,
  CHIP_RESPONSE,
  CHIP_RESPONSIBLE_CONTRACTOR,
  CHIP_SPEC_SECTION,
  CHIP_STATUS,
  CHIP_SUBMITTAL_MANAGER,
  CHIP_SUBMITTAL_PACKAGE,
  CHIP_TYPE,
  // SiteSync-only
  CHIP_IRIS_FINDING,
  CHIP_SCHEDULE_AT_RISK,
  CHIP_REQUIRED_WITHIN_N_DAYS,
  CHIP_CRITICAL_PATH,
] as ChipDefinition[]

export const CHIPS_BY_ID: Record<string, ChipDefinition> = Object.fromEntries(
  CHIPS.map((c) => [c.id, c]),
)

export const PROCORE_PARITY_COUNT = CHIPS.filter((c) => c.procoreParity).length // 16
export const SITESYNC_ONLY_COUNT = CHIPS.length - PROCORE_PARITY_COUNT          // 4

// ── Active filter state shape ───────────────────────────────────────────────

export type ActiveFilters = Record<string, unknown>

export function applyChipFilters(
  rows: Record<string, unknown>[],
  filters: ActiveFilters,
): Record<string, unknown>[] {
  const active = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null)
  if (!active.length) return rows
  return rows.filter((row) => {
    for (const [chipId, value] of active) {
      const chip = CHIPS_BY_ID[chipId]
      if (!chip) continue
      // The chip's matches() expects its own value type — we typed it as
      // unknown at the registry level so any-cast here is unavoidable.
      if (!(chip as ChipDefinition<unknown>).matches(row, value)) return false
    }
    return true
  })
}

export function decodeFiltersFromUrl(params: URLSearchParams): ActiveFilters {
  const out: ActiveFilters = {}
  for (const chip of CHIPS) {
    const raw = params.get(`filter[${chip.id}]`)
    const decoded = chip.decode(raw)
    if (decoded !== undefined) out[chip.id] = decoded
  }
  return out
}

export function encodeFiltersToUrl(
  base: URLSearchParams,
  filters: ActiveFilters,
): URLSearchParams {
  const next = new URLSearchParams(base)
  for (const chip of CHIPS) {
    next.delete(`filter[${chip.id}]`)
    const v = filters[chip.id]
    if (v === undefined || v === null) continue
    const raw = (chip as ChipDefinition<unknown>).encode(v)
    if (raw !== null && raw !== '') next.set(`filter[${chip.id}]`, raw)
  }
  return next
}
