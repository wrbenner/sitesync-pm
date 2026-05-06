/**
 * Service-layer types for the Submittal module.
 *
 * Canonical types are aligned with SUBMITTALS_MODULE_BUILD_SPEC_2026-05-06.md
 * Part 3.1.  The 9-state status set per Part 4 supersedes the legacy 8-state
 * machine; legacy values remain in the union so existing rows / callers
 * continue to compile during the D38 refactor window.
 *
 * DB row types (Submittal, SubmittalApproval) live in src/types/entities.ts.
 */

import type { SubmittalApproval } from './entities'

// ── Spec Part 3.1: SubmittalKind ─────────────────────────────────────────────

export type SubmittalKind =
  | 'shop_drawing'
  | 'product_data'
  | 'sample'
  | 'mockup'
  | 'test_report'
  | 'certification'
  | 'qualification'
  | 'closeout'
  | 'warranty'
  | 'leed_credit'
  | 'coordination_drawing'
  | 'maintenance'
  | 'other'

// ── Spec Part 3.1: Disposition codesets ──────────────────────────────────────
// Default is EJCDC 6-code (Walker decision #1 in
// SUBMITTAL_OPEN_QUESTIONS_RESOLUTION_2026-05-06.md). AIA + UFGS + custom
// are alternatives chosen at project setup.

export type SubmittalDispositionEjcdc =
  | 'A_no_exceptions_taken'
  | 'B_make_corrections_noted'
  | 'C_revise_and_resubmit'
  | 'D_rejected'
  | 'E_for_reference_only'
  | 'F_submit_specified_item'

export type SubmittalDispositionAia =
  | 'approved'
  | 'approved_as_noted'
  | 'revise_and_resubmit'
  | 'rejected'
  | 'for_record_only'

export type SubmittalDispositionUfgs =
  | 'approval_recommended'
  | 'approval_not_recommended'
  | 'no_action_taken'
  | 'receipt_acknowledged'

export type SubmittalDisposition =
  | SubmittalDispositionEjcdc
  | SubmittalDispositionAia
  | SubmittalDispositionUfgs

export type SubmittalCodeset = 'ejcdc' | 'aia' | 'ufgs' | 'custom'

// ── Spec Part 3.1: 9-state SubmittalStatus + legacy compat ───────────────────

export type SubmittalStatusCanonical =
  | 'draft'
  | 'sub_uploading'
  | 'gc_review'
  | 'preflight'
  | 'sent_to_reviewer'
  | 'in_review'
  | 'returned'
  | 'distribute'
  | 'closed'
  | 'void'

export type SubmittalStatusLegacy =
  | 'submitted'
  | 'architect_review'
  | 'approved'
  | 'rejected'
  | 'resubmit'

export type SubmittalStatus = SubmittalStatusCanonical | SubmittalStatusLegacy

// ── Spec Part 3.1: SubmittalSpecMapping ──────────────────────────────────────

export interface SubmittalSpecMapping {
  csi_division: string
  csi_section: string
  spec_section_paragraph: string
  spec_pdf_page: number
  spec_pdf_highlight_rect: [number, number, number, number]
}

// ── Spec Part 3.1: SubmittalRequiredOnSiteCalc ───────────────────────────────

export interface SubmittalRequiredOnSiteCalc {
  schedule_activity_id: string | null
  schedule_start_date: string | null
  buffer_days: number
  fab_lead_time_days: number
  ship_lead_time_days: number
  review_duration_days: number
  computed_required_on_site: string | null
  computed_submit_by: string | null
  is_critical_path: boolean
}

// ── Domain Aliases ───────────────────────────────────────────────────────────

export type SubmittalReviewer = SubmittalApproval

// ── Service Input Types ──────────────────────────────────────────────────────

export type CreateSubmittalInput = {
  project_id: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  created_by?: string
  spec_section?: string
  csi_division?: string
  csi_section?: string
  spec_section_paragraph?: string
  spec_pdf_page?: number
  kind?: SubmittalKind
  assigned_to?: string
  subcontractor?: string
  responsible_sub_id?: string
  due_date?: string
  submit_by_date?: string
  required_onsite_date?: string
  required_on_site_date?: string
  lead_time_weeks?: number
  schedule_activity_id?: string
  is_critical_path?: boolean
  is_federal?: boolean
  is_private?: boolean
  parent_submittal_id?: string
}

// ── D38: Disposition / Distribute / Filter / Bulk inputs ─────────────────────

export interface RecordDispositionInput {
  reviewer_id: string
  disposition: SubmittalDisposition
  comment?: string
  stamp_url?: string
}

export interface DistributeInput {
  to_user_ids: string[]
}

export interface SubmittalFilter {
  status?: SubmittalStatus[]
  kind?: SubmittalKind[]
  csi_section?: string[]
  responsible_sub_id?: string[]
  current_reviewer_id?: string[]
  is_critical_path?: boolean
  is_overdue?: boolean
  required_on_site_within_days?: number
  has_iris_preflight_finding?: boolean
  search?: string
}

export interface BulkUpdateInput {
  ids: string[]
  updates: {
    current_reviewer_id?: string
    responsible_sub_id?: string
    submittal_package_id?: string
    is_private?: boolean
    is_critical_path?: boolean
  }
}

// ── Service Result Type ──────────────────────────────────────────────────────

export type SubmittalServiceResult<T = void> = {
  data: T | null
  error: string | null
}
