// ────────────────────────────────────────────────────────────────────────────
// legacyAdapters — bridge from legacy template.buildPrompt() to Context Fabric
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §5.2
// ADR-020: Context Fabric is the single retrieval entrypoint.
//
// Phase 1b cutover wrapper. When the `irisUseFabric` flag is on, callers
// (drafts.ts and the 3 highest-volume Iris surfaces) route through this
// adapter which:
//   1. Maps the legacy StreamItem + ProjectContextSnapshot into an
//      IrisInvocation + slot overrides.
//   2. Calls buildContext() to assemble the typed IrisContext.
//   3. Renders the system prompt via renderContext().
//   4. Concatenates the legacy template's user prompt with the Fabric system
//      prompt (or returns them separately for callers that can pass `system=`).
//
// Phase 1b accepts pre-Phase-1-Days-2-8 slot fidelity: who/where/why are
// populated from existing client-side data, what is built from the StreamItem,
// and when is null until the per-project Days 6 work lands. Each slot the
// renderer can't fill is dropped — no "null" strings leak.

import type { StreamItem, IrisDraftType } from '../../types/stream'

import { buildContext, type BuildContextOverrides } from './contextFabric'
import { renderContext } from './renderContext'
import { personaForRole } from './personas'
import type { ProjectContextSnapshot } from './types'
import type {
  EntityType,
  InvocationIntent,
  PersonaSlug,
  ProjectRole,
} from './types/context'
import type { IrisInvocation } from './types/invocation'

export interface AdaptOptions {
  /** Caller-resolved persona override (rare; used by Phase 2 specialists). */
  personaOverride?: PersonaSlug | null
  /** Workflow-pinned persona (per ADR-019). */
  workflowOverride?: PersonaSlug | null
  /** Authenticated user id (from useAuthStore on the client). */
  userId: string
  /** Authenticated user's project role; used for the persona fallback. */
  userRole?: ProjectRole | null
  /** Org id (from useAuthStore). */
  orgId: string
  /** Optional current page route — defaults to /iris-call. */
  currentPage?: string
}

export interface AdaptedCall {
  /** The IrisInvocation we built for telemetry. */
  invocation: IrisInvocation
  /** The Fabric-resolved persona. */
  persona: PersonaSlug
  /** The rendered system prompt — pass as `system=` to iris-call. */
  systemPrompt: string
  /** Token estimate of the rendered prompt for budget tracking. */
  promptTokens: number
  /** Whether the prompt was truncated. */
  truncated: boolean
}

// Map the existing 6 draft types to their Fabric invocation intent so the
// router (Phase 2) and the per-persona telemetry can group calls correctly.
const DRAFT_TYPE_TO_INTENT: Record<IrisDraftType, InvocationIntent> = {
  follow_up_email: 'draft_email',
  daily_log: 'draft_daily_log',
  rfi_response: 'draft_email',
  submittal_review: 'draft_email',
  schedule_suggestion: 'recommend_action',
  owner_update: 'draft_owner_update',
}

// Map the StreamItem id prefix to a Fabric entity type. Mirrors the legacy
// entityRefFromItemId() in drafts.ts but returns the Fabric enum rather
// than a free-text string.
function inferEntityType(itemId: string): EntityType | null {
  const prefix = itemId.split('-')[0]
  switch (prefix) {
    case 'rfi':
      return 'rfi'
    case 'submittal':
      return 'submittal'
    case 'dailyLog':
    case 'dl':
      return 'daily_log'
    case 'co':
    case 'changeOrder':
      return 'change_order'
    case 'punch':
      return 'punch_item'
    case 'schedule':
    case 'activity':
      return 'schedule_activity'
    default:
      return null
  }
}

export function adaptStreamItemToFabric(
  item: StreamItem,
  projectContext: ProjectContextSnapshot,
  draftType: IrisDraftType,
  opts: AdaptOptions,
): AdaptedCall {
  const entityType = inferEntityType(item.id)
  const entityId = item.id.includes('-') ? item.id.slice(item.id.indexOf('-') + 1) : item.id

  const invocation: IrisInvocation = {
    user_id: opts.userId,
    org_id: opts.orgId,
    project_id: projectContext.projectId,
    current_page: opts.currentPage ?? `/${entityType ?? 'iris'}/${entityId}`,
    entity_type: entityType,
    entity_id: entityId,
    invocation_intent: DRAFT_TYPE_TO_INTENT[draftType],
    workflow_override_persona: opts.workflowOverride ?? null,
    caller_override_persona: opts.personaOverride ?? null,
  }

  const fallbackPersona: PersonaSlug = opts.userRole
    ? personaForRole(opts.userRole)
    : 'pm'

  const overrides: BuildContextOverrides = {
    who: {
      user_id: opts.userId,
      persona: invocation.caller_override_persona ?? invocation.workflow_override_persona ?? fallbackPersona,
      role: opts.userRole ?? 'unknown',
      display_name: projectContext.userName ?? 'Project team',
      first_name: projectContext.userFirstName ?? projectContext.userName?.split(/\s+/)[0] ?? '',
      recent_actions: [],
      permissions: [],
      reporting_chain: [],
    },
    what: entityType
      ? {
          entity_type: entityType,
          entity_id: entityId,
          entity_state: null, // Phase 1 Day 4 populates from row
          entity_summary: item.title ?? '',
          related_entities: [],
          current_page: invocation.current_page,
        }
      : null,
    when: null, // Phase 1 Day 6 populates from project_metrics MV
    where: projectContext.projectId
      ? {
          project_id: projectContext.projectId,
          project_name: projectContext.projectName ?? '(unspecified)',
          area_id: null,
          area_name: null,
          gps_hint: null,
          weather_now: projectContext.weather
            ? {
                temp_f: projectContext.weather.tempF ?? 0,
                conditions: projectContext.weather.summary,
                precipitation_pct: 0,
                as_of: new Date().toISOString(),
              }
            : null,
          weather_5d_forecast: null,
        }
      : null,
    why: {
      invocation_intent: invocation.invocation_intent,
      page_intent: 'detail_view',
      recent_query_history: [],
      pinned_context: [],
    },
  }

  const { context, resolved_persona } = buildContext(invocation, overrides)
  const rendered = renderContext(context, resolved_persona)

  return {
    invocation,
    persona: resolved_persona,
    systemPrompt: rendered.prompt,
    promptTokens: rendered.tokens_estimated,
    truncated: rendered.trim_log.length > 0,
  }
}
