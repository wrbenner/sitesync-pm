// ────────────────────────────────────────────────────────────────────────────
// IrisInvocation — Phase 1a Context Fabric input shape
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §4.1
//
// Every Iris call describes its intent through this typed object rather than
// hand-rolling a system= prompt string. The Fabric then assembles the
// IrisContext slot-by-slot. This decouples caller intent from prompt
// assembly per ADR-020.

import type {
  EntityType,
  InvocationIntent,
  PersonaSlug,
} from './context'

export interface IrisInvocation {
  // Caller identity (resolved before reaching buildContext)
  user_id: string
  org_id: string
  project_id: string | null

  // What surface initiated this call
  current_page: string // route, e.g. '/rfis/abc-123/detail'
  entity_type: EntityType | null
  entity_id: string | null

  // Why we're calling
  invocation_intent: InvocationIntent

  // Override hierarchy: workflow > persona-override > org-default > system-default
  // Phase 1a stores only workflow_override; org/system defaults resolve via DB.
  workflow_override_persona?: PersonaSlug | null
  caller_override_persona?: PersonaSlug | null // test/eval only; server-side authenticated callers

  // Mobile-only context
  gps_hint?: { lat: number; lng: number } | null
}
