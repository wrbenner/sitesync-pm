// ────────────────────────────────────────────────────────────────────────────
// Drafter specialist — Phase 2a, ADR-018 conformant
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md
// ADR: docs/audits/ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md
//
// The Drafter is the FIRST of the 4 Phase 2 specialists. It owns the
// "produce a draft of a communication" surface (RFI follow-up, submittal
// review, daily-log, owner update, schedule recommendation, lien waiver).
//
// Phase 2a scope: the contract surface + deterministic gate + dispatch
// shell. The LLM call goes through the existing iris-call edge function
// via the Phase 1b Fabric adapter; future PRs can swap in specialist-
// specific prompt templates and remove the templates.ts indirection.
//
// Boundary (per ADR-018):
//   - Deterministic check: required schema fields are present on the
//     StreamItem (title, due date or other anchor, addressee resolution).
//   - LLM scope: generative — the LLM authors the artifact body.
//   - Write scope: NONE in this file. Drafts are committed by the
//     drafted-action executor (Phase 2e or follow-up).
//   - Tool allow-list: cite_* tools only (8 citation kinds).
//   - Audit fields: BASE_AUDIT_FIELDS + draft_type + persona + truncated.

import type { StreamItem, IrisDraftType } from '../../../types/stream'
import type { IrisContext, PersonaSlug } from '../types/context'
import type { ProjectContextSnapshot } from '../types'

import {
  assertAuditFieldsComplete,
  BASE_AUDIT_FIELDS,
  type DeterministicResult,
  type SpecialistDecl,
} from './types'

export interface DrafterInput {
  /** The StreamItem the draft is for. */
  item: StreamItem
  /** Caller-resolved project context (legacy adapter shape). */
  project_context: ProjectContextSnapshot
  /** What kind of draft to produce. */
  draft_type: IrisDraftType
  /** The persona that should author. Resolved by the router (Phase 2e). */
  persona: PersonaSlug
}

const DRAFTER_VERSION = '0.1.0' as const
const DRAFTER_PROMPT_VERSION = 'phase-2a.0' as const

// Per ADR-018: deterministic gate runs FIRST. Returns ok=false to short-circuit
// before any LLM call. The check is intentionally narrow: only fields the
// drafter cannot fabricate. Token-budget + length sanity live downstream in
// the renderer.
export function drafterDeterministicCheck(
  input: DrafterInput,
  _ctx: IrisContext,
): DeterministicResult {
  const blockers: string[] = []
  const warnings: string[] = []

  if (!input.item.id) blockers.push('item.id is required')
  if (!input.item.title || input.item.title.trim().length === 0) {
    blockers.push('item.title is required (the draft references it in the subject line)')
  }
  if (!input.project_context.projectId) {
    blockers.push('project_context.projectId is required (audit linkage)')
  }

  // Draft-type-specific gates
  switch (input.draft_type) {
    case 'follow_up_email':
    case 'submittal_review':
      // Caller must supply an addressee path. Fallback (sign-off as "the
      // project team") is fine but we want to know if it'll fire.
      if (!input.project_context.recipientName && !input.item.assignedTo) {
        warnings.push(
          'Neither recipientName nor item.assignedTo present — the draft will sign off generically.',
        )
      }
      break
    case 'daily_log':
      // No additional gates today — Phase 4 wires weather + crew gates.
      break
    case 'rfi_response':
      // Phase 2 spec defers full RFI response gating to a sub-spec; today we
      // only block on missing item.id + title (above).
      break
    case 'owner_update':
      if (
        input.project_context.reportingPeriodDays == null
        || input.project_context.reportingPeriodDays <= 0
      ) {
        blockers.push('owner_update requires project_context.reportingPeriodDays > 0')
      }
      break
    case 'schedule_suggestion':
      // No additional gates today — Schedule specialist (2c) owns the deep gating.
      break
  }

  return {
    ok: blockers.length === 0,
    blockers: blockers.length ? blockers : undefined,
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * Drafter declaration — exported for the router (Phase 2e), the CI audit
 * script (Phase 2 follow-up), and the test harness.
 */
export const DRAFTER_DECL: SpecialistDecl<DrafterInput> = {
  name: 'drafter',
  version: DRAFTER_VERSION,
  deterministicCheck: drafterDeterministicCheck,
  llmScope: 'generative',
  modelTier: 'sonnet',
  promptVersion: DRAFTER_PROMPT_VERSION,
  // Drafter is read-only; the drafted_action_executor (Phase 2e) commits.
  writeScope: [],
  latencyBudgetMs: { p50: 3000, p95: 6000 },
  auditFields: [
    ...BASE_AUDIT_FIELDS,
    'draft_type',
    'persona',
    'truncated',
  ],
  toolAllowList: [
    // 8 citation kinds (Iris citations spec). No drafting tools — the model
    // produces text directly through the Fabric prompt.
    'cite_rfi_reference',
    'cite_submittal_reference',
    'cite_drawing_coordinate',
    'cite_spec_reference',
    'cite_change_order',
    'cite_budget_line',
    'cite_daily_log_excerpt',
    'cite_schedule_phase',
    'cite_photo_observation',
  ],
}

// Fail loudly at module load if the declaration drifts from the base contract.
assertAuditFieldsComplete(DRAFTER_DECL)

/**
 * High-level Drafter entry point used by the router + tests.
 * Returns the deterministic-check result. The router calls this BEFORE any
 * LLM dispatch; the LLM-side dispatch (Fabric prompt assembly + iris-call)
 * happens in the existing `generateIrisDraft` path until Phase 2e cuts it
 * over to a specialist-driven executor.
 */
export function drafterShouldRun(input: DrafterInput, ctx: IrisContext): DeterministicResult {
  return drafterDeterministicCheck(input, ctx)
}
