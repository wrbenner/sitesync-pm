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
      const { data, error } = await supabase.rpc('resolve_persona', {
        p_user_id: userId,
        // The RPC accepts NULL server-side (treated as "no active project,
        // resolve from org or system default"). The generated type is strict
        // `string`; cast through unknown so the wire-format null is still sent.
        p_project_id: projectId as unknown as string,
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
