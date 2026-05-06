/**
 * Service-layer types for the Submittal module.
 *
 * Canonical DB row types (Submittal, SubmittalApproval) live in
 * src/types/entities.ts. This file adds:
 *   - SubmittalStatus: lifecycle state union matching submittalMachine.ts
 *   - SubmittalReviewer: domain alias for the DB approval record
 *   - Service input and result shapes
 */

import type { SubmittalApproval } from './entities'

// ── Lifecycle States ─────────────────────────────────────────────────────────

/**
 * Lifecycle state union for submittals.
 * Must stay in sync with SubmittalState in src/machines/submittalMachine.ts.
 *
 * Workflow: draft -> submitted -> gc_review -> architect_review -> approved -> closed
 *           At any review stage the package can be rejected or marked for revision.
 */
export type SubmittalStatus =
  | 'draft'
  | 'submitted'
  | 'gc_review'
  | 'architect_review'
  | 'approved'
  | 'rejected'
  | 'resubmit'
  | 'closed'

// ── Domain Aliases ────────────────────────────────────────────────────────────

/**
 * The DB table is submittal_approvals. In the domain we call each record
 * a reviewer to match the workflow language used in the field.
 */
export type SubmittalReviewer = SubmittalApproval

// ── Service Input Types ───────────────────────────────────────────────────────

/**
 * Fields accepted when creating a new submittal.
 * Only includes columns that actually exist in the submittals DB table.
 * Status is always set to 'draft' by the service and not accepted here.
 */
export type CreateSubmittalInput = {
  project_id: string
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  created_by?: string
  spec_section?: string
  assigned_to?: string
  subcontractor?: string
  due_date?: string
  submit_by_date?: string
  required_onsite_date?: string
  lead_time_weeks?: number
  parent_submittal_id?: string
}

// ── Service Result Type ───────────────────────────────────────────────────────

/**
 * Uniform return shape for all submittalService methods.
 * Mirrors RfiServiceResult from src/services/rfiService.ts.
 */
export type SubmittalServiceResult<T = void> = {
  data: T | null
  error: string | null
}
