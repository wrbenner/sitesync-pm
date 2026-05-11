// ────────────────────────────────────────────────────────────────────────────
// usePersona — resolved Iris persona for the current user × project
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md §5.4
// ADR-019 override hierarchy:
//   workflow > iris_user_personas(project) > iris_user_personas(org) > role map > 'pm'
//
// The hook calls the server-side `resolve_persona` RPC (Phase 1d migration
// 20260722010000_role_to_default_persona.sql) so persona stays consistent
// between the browser and the iris-call edge function. Result is cached via
// TanStack Query — refetch on stale-after-30-seconds, since persona binding
// rarely changes mid-session.
//
// The hook never returns null; on error or while loading the result is 'pm'
// (the system fallback) and the consumer renders the "we defaulted you to
// Project Manager view" banner per spec §6.1.

import { useQuery } from '@tanstack/react-query'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useProjectStore } from '../stores/projectStore'
import type { PersonaSlug } from '../services/iris/types/context'

const ALL_PERSONA_SLUGS: ReadonlySet<PersonaSlug> = new Set([
  'pm',
  'superintendent',
  'foreman',
  'owner_rep',
  'office',
])

function isPersonaSlug(value: unknown): value is PersonaSlug {
  return typeof value === 'string' && ALL_PERSONA_SLUGS.has(value as PersonaSlug)
}

export interface UsePersonaResult {
  persona: PersonaSlug
  // True when the resolver returned a value from the DB (not a fallback).
  resolved: boolean
  // True while the RPC is in flight.
  loading: boolean
}

export function usePersona(): UsePersonaResult {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const projectId = useProjectStore((s) => s.activeProject?.id ?? null)

  const query = useQuery({
    queryKey: ['iris_persona', userId, projectId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<PersonaSlug | null> => {
      if (!userId) return null
      // The `resolve_persona` RPC ships in migration
      // 20260722010000_role_to_default_persona.sql (this PR). Until
      // db-types:write regenerates database.ts against staging, supabase.rpc's
      // overload set does not include the new function, so we cast through
      // a function-typed wrapper. Replace with the typed call after the
      // regen lands.
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await rpc('resolve_persona', {
        p_user_id: userId,
        p_project_id: projectId,
      })
      if (error) {
        if (import.meta.env.DEV) {
          console.warn('[usePersona] resolve_persona RPC failed:', error.message)
        }
        return null
      }
      return isPersonaSlug(data) ? data : null
    },
  })

  if (query.data && isPersonaSlug(query.data)) {
    return { persona: query.data, resolved: true, loading: false }
  }
  return { persona: 'pm', resolved: false, loading: query.isLoading }
}
