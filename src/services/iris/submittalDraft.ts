// Phase 5 — Iris draft + pre-flight scaffold for the unified create modal.
//
// Two pure-function helpers:
//   1. buildDraftFromContext(...) — derives a draft submittal from whatever
//      seed the user picked (voice transcript / spec section / email body /
//      drawing pin / past similar). Deterministic; no LLM call here. Real
//      LLM extraction lives in the per-method handler.
//   2. runPreflight(...) — renders pre-flight findings against a draft.
//      Phase 5 ships a rule-based pre-flight (deterministic, fast). Phase 7
//      adds the Iris LLM augmentation that adds citation links.

import type { SubmittalKind } from '../../types/submittal'

export type DraftSource =
  | 'manual'
  | 'voice'
  | 'spec'
  | 'drawing_pin'
  | 'email_in'
  | 'magic_link_request'

export interface SubmittalDraft {
  source: DraftSource
  // Quick tier
  title: string
  ball_in_court_user_id: string | null
  due_date: string | null
  // Full tier
  kind: SubmittalKind | null
  csi_section: string | null
  spec_section_paragraph: string | null
  spec_pdf_page: number | null
  description: string | null
  responsible_sub_id: string | null
  schedule_activity_id: string | null
  required_on_site_date: string | null
  submit_by_date: string | null
  lead_time_weeks: number | null
  is_critical_path: boolean
  is_private: boolean
  drawing_pin_ids: string[]
  attachment_ids: string[]
  // Provenance — every Iris-prefilled field is hash-chained via this map
  // so downstream UI can render the "auto" badge selectively.
  provenance: Record<string, DraftSource>
}

export const emptyDraft = (source: DraftSource = 'manual'): SubmittalDraft => ({
  source,
  title: '',
  ball_in_court_user_id: null,
  due_date: null,
  kind: null,
  csi_section: null,
  spec_section_paragraph: null,
  spec_pdf_page: null,
  description: null,
  responsible_sub_id: null,
  schedule_activity_id: null,
  required_on_site_date: null,
  submit_by_date: null,
  lead_time_weeks: null,
  is_critical_path: false,
  is_private: false,
  drawing_pin_ids: [],
  attachment_ids: [],
  provenance: {},
})

// ── Draft construction ──────────────────────────────────────────────────────

export interface BuildDraftFromSpecInput {
  csi_section: string
  spec_section_paragraph?: string | null
  spec_pdf_page?: number | null
  /** When the spec section heading mentions a known kind, pre-fill it. */
  inferred_kind?: SubmittalKind | null
  /** Suggested title from the spec heading (first 80 chars). */
  inferred_title?: string | null
}

/** Pre-fills a draft from a spec-section pivot. Provenance is set so the UI
 *  shows "auto" badges on every Iris-pre-filled field. */
export function buildDraftFromSpec(input: BuildDraftFromSpecInput): SubmittalDraft {
  const draft = emptyDraft('spec')
  draft.csi_section = input.csi_section
  draft.provenance.csi_section = 'spec'

  if (input.spec_section_paragraph) {
    draft.spec_section_paragraph = input.spec_section_paragraph
    draft.provenance.spec_section_paragraph = 'spec'
  }
  if (typeof input.spec_pdf_page === 'number') {
    draft.spec_pdf_page = input.spec_pdf_page
    draft.provenance.spec_pdf_page = 'spec'
  }
  if (input.inferred_kind) {
    draft.kind = input.inferred_kind
    draft.provenance.kind = 'spec'
  }
  if (input.inferred_title) {
    draft.title = input.inferred_title
    draft.provenance.title = 'spec'
  }
  return draft
}

export interface BuildDraftFromVoiceInput {
  /** The raw transcript from the voice FAB. */
  transcript: string
  /** Iris-extracted entities from the transcript (real extraction is
   *  Phase 7's voice-command pipeline; Phase 5 ships the placeholder
   *  shape). */
  entities?: {
    title?: string
    csi_section?: string
    kind?: SubmittalKind
    sub_name?: string
    schedule_activity_name?: string
  }
}

export function buildDraftFromVoice(input: BuildDraftFromVoiceInput): SubmittalDraft {
  const draft = emptyDraft('voice')
  const e = input.entities ?? {}

  if (e.title) {
    draft.title = e.title
    draft.provenance.title = 'voice'
  } else if (input.transcript) {
    // Fallback: first 60 chars of the transcript become the title; user
    // edits before send.
    draft.title = input.transcript.trim().split(/[.!?]/)[0].slice(0, 60)
    draft.provenance.title = 'voice'
  }
  if (e.csi_section) {
    draft.csi_section = e.csi_section
    draft.provenance.csi_section = 'voice'
  }
  if (e.kind) {
    draft.kind = e.kind
    draft.provenance.kind = 'voice'
  }
  // sub_name + schedule_activity_name are name-strings; downstream handler
  // resolves them to ids via project lookup.
  return draft
}

export interface BuildDraftFromPinInput {
  drawing_pin_id: string
  sheet_number: string | null
  sheet_title: string | null
  /** When the pin landed on a sheet whose CSI section is known, pre-fill. */
  csi_section?: string | null
}

export function buildDraftFromPin(input: BuildDraftFromPinInput): SubmittalDraft {
  const draft = emptyDraft('drawing_pin')
  draft.drawing_pin_ids = [input.drawing_pin_id]
  draft.provenance.drawing_pin_ids = 'drawing_pin'

  if (input.sheet_number || input.sheet_title) {
    const label = [input.sheet_number, input.sheet_title].filter(Boolean).join(' — ')
    draft.title = `Pin reference — ${label}`.slice(0, 80)
    draft.provenance.title = 'drawing_pin'
  }
  if (input.csi_section) {
    draft.csi_section = input.csi_section
    draft.provenance.csi_section = 'drawing_pin'
  }
  return draft
}

// ── Pre-flight (rule-based, deterministic) ─────────────────────────────────

export type PreflightSeverity = 'info' | 'warning' | 'block'

export interface PreflightFinding {
  id: string
  severity: PreflightSeverity
  /** One-line message rendered in the inline preview card. */
  message: string
  /** When the finding maps to a fix the user can click in the modal. */
  fixAction?: 'attach_file' | 'pick_sub' | 'pick_reviewer' | 'set_date' | 'set_kind'
  /** Optional link target for "view spec" / "open similar past". */
  link?: { kind: 'spec' | 'past_submittal' | 'industry_standard'; href: string }
}

/**
 * Deterministic pre-flight rules. The full Iris pre-flight (with citations
 * + similar-past lookups) lands in Phase 7; Phase 5 ships these baseline
 * checks so the inline preview card has something to render today.
 */
export function runPreflight(draft: SubmittalDraft): PreflightFinding[] {
  const findings: PreflightFinding[] = []

  if (!draft.title.trim()) {
    findings.push({
      id: 'title_required',
      severity: 'block',
      message: 'Title is required.',
      fixAction: 'set_date',
    })
  }
  if (!draft.ball_in_court_user_id) {
    findings.push({
      id: 'bic_missing',
      severity: 'warning',
      message: 'No ball-in-court selected. The submittal will sit in your queue until assigned.',
      fixAction: 'pick_reviewer',
    })
  }
  if (!draft.due_date) {
    findings.push({
      id: 'due_date_missing',
      severity: 'warning',
      message: 'No due date set. Iris recommends 7 days from today as the default.',
      fixAction: 'set_date',
    })
  }
  if (!draft.kind) {
    findings.push({
      id: 'kind_missing',
      severity: 'info',
      message: 'No submittal type set. Pre-fill from spec section or pick manually.',
      fixAction: 'set_kind',
    })
  }
  if (!draft.csi_section) {
    findings.push({
      id: 'csi_section_missing',
      severity: 'info',
      message: 'No spec section linked. Numbering stays manual until set.',
    })
  }
  if (draft.attachment_ids.length === 0) {
    findings.push({
      id: 'no_attachments',
      severity: 'warning',
      message: 'No attachments yet. Most subs include cut sheets at submission.',
      fixAction: 'attach_file',
    })
  }
  if (draft.kind === 'shop_drawing' && (draft.lead_time_weeks ?? 0) < 4) {
    findings.push({
      id: 'shop_drawing_short_lead',
      severity: 'warning',
      message: 'Shop drawings typically have ≥4 week lead times. Verify with the sub.',
    })
  }

  return findings
}

export const previewSeverityRank: Record<PreflightSeverity, number> = {
  block: 3,
  warning: 2,
  info: 1,
}
