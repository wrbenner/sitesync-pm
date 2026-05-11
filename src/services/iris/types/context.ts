// ────────────────────────────────────────────────────────────────────────────
// IrisContext — Phase 1a Context Fabric typed shape
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §4.2
// ADR-020: Context Fabric is the single retrieval entrypoint for all Iris calls.
//
// Discriminated unions throughout. All slots are nullable where the underlying
// data may be unavailable; renderContext() drops null slots rather than
// emitting "null" strings.

export type PersonaSlug =
  | 'pm'
  | 'superintendent'
  | 'foreman'
  | 'owner_rep'
  | 'office'

export type ProjectRole =
  | 'gc_pm'
  | 'gc_super'
  | 'gc_foreman'
  | 'sub_pm'
  | 'sub_foreman'
  | 'owner'
  | 'owner_rep'
  | 'architect'
  | 'engineer'
  | 'office'
  | 'admin'
  | 'unknown'

export type EntityType =
  | 'rfi'
  | 'submittal'
  | 'daily_log'
  | 'change_order'
  | 'punch_item'
  | 'schedule_activity'

export type EntityState =
  | 'open'
  | 'pending'
  | 'answered'
  | 'voided'
  | 'closed'
  | 'draft'
  | 'in_review'

export type InvocationIntent =
  | 'draft_email'
  | 'draft_owner_update'
  | 'draft_daily_log'
  | 'draft_lien_waiver'
  | 'verify_math'
  | 'summarize'
  | 'classify'
  | 'recommend_action'

export type PageIntent =
  | 'list_view'
  | 'detail_view'
  | 'create_flow'
  | 'review_inbox'
  | 'dashboard'
  | 'unknown'

export type ProjectPhase =
  | 'schematic'
  | 'design_development'
  | 'construction_documents'
  | 'preconstruction'
  | 'mobilization'
  | 'substructure'
  | 'superstructure'
  | 'enclosure'
  | 'interiors'
  | 'finishes'
  | 'commissioning'
  | 'closeout'

export type ScheduleStatus = 'ahead' | 'on_track' | 'behind' | 'unknown'

export type CyclePosition =
  | 'pay_app_open'
  | 'pay_app_close'
  | 'oac_today'
  | 'normal_week'

export interface RecentAction {
  action: string
  entity_ref: string
  occurred_at: string // ISO
}

export interface ResolvedPermission {
  capability: string
  scope: 'project' | 'org'
  granted: boolean
}

export interface ReportingNode {
  user_id: string
  display_name: string
  role: ProjectRole
}

export interface RelatedEntity {
  entity_type: EntityType
  entity_id: string
  relation: 'sibling' | 'parent' | 'child' | 'linked'
  summary: string
}

export interface WeatherSnapshot {
  temp_f: number
  conditions: string
  precipitation_pct: number
  as_of: string // ISO
}

export interface WeatherDayForecast {
  date: string // YYYY-MM-DD
  high_f: number
  low_f: number
  conditions: string
  precipitation_pct: number
}

export interface PinnedItem {
  kind: 'rfi' | 'submittal' | 'spec' | 'drawing' | 'change_order'
  ref: string
  title: string
}

export interface WhoSlot {
  user_id: string
  persona: PersonaSlug
  role: ProjectRole
  display_name: string
  first_name: string
  recent_actions: RecentAction[]
  permissions: ResolvedPermission[]
  reporting_chain: ReportingNode[]
}

export interface WhatSlot {
  entity_type: EntityType | null
  entity_id: string | null
  entity_state: EntityState | null
  entity_summary: string
  related_entities: RelatedEntity[]
  current_page: string
}

export interface WhenSlot {
  project_phase: ProjectPhase
  days_to_substantial_completion: number | null
  schedule_status: ScheduleStatus
  schedule_variance_days: number | null
  last_user_session_at: string | null
  cycle_position: CyclePosition
}

export interface WhereSlot {
  project_id: string
  project_name: string
  area_id: string | null
  area_name: string | null
  gps_hint: { lat: number; lng: number } | null
  weather_now: WeatherSnapshot | null
  weather_5d_forecast: WeatherDayForecast[] | null
}

export interface WhySlot {
  invocation_intent: InvocationIntent
  page_intent: PageIntent
  recent_query_history: string[]
  pinned_context: PinnedItem[]
}

export type SlotName = 'who' | 'what' | 'when' | 'where' | 'why'

export interface TrimLogEntry {
  slot: SlotName
  reason: 'over_budget' | 'rls_filtered' | 'null_value'
  tokens_dropped: number
  fields_dropped: string[]
}

export type Derivation = 'deterministic' | 'llm_derived' | 'mixed'

export interface ContextMeta {
  fabric_version: string
  built_at: string // ISO
  cache_hit: boolean
  token_counts: Record<SlotName, number>
  trim_log: TrimLogEntry[]
  derivation: Record<SlotName, Derivation>
}

export interface IrisContext {
  who: WhoSlot | null
  what: WhatSlot | null
  when: WhenSlot | null
  where: WhereSlot | null
  why: WhySlot | null
  meta: ContextMeta
}

// Per spec §4.3 — token ceilings enforced at render time, not build time.
export const SLOT_TOKEN_CEILINGS: Record<SlotName, number> = {
  who: 600,
  what: 1200,
  when: 250,
  where: 400,
  why: 500,
} as const

export const TOTAL_FABRIC_TOKEN_BUDGET = 2950 // sum of ceilings; well under 8K soft ceiling

export const FABRIC_VERSION = '1.0.0-phase1a' // bump on slot-shape changes
