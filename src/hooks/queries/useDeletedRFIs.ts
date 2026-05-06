// ── useDeletedRFIs / soft-delete / restore ────────────────────────────────
// Recycle bin querying + lifecycle mutations for RFIs.
//
// Bugatti choices:
//   • Soft-delete sets deleted_at + deleted_by (audit identity preserved).
//     The active SELECT policy filters out deleted_at IS NOT NULL, so
//     deleted RFIs disappear from every existing query without code
//     changes elsewhere.
//   • The Recycle Bin reads via a SECURITY DEFINER RPC (`list_deleted_rfis`)
//     so it bypasses the active filter without RLS-lying-on-its-back.
//   • Restore is a SECURITY DEFINER RPC that re-checks role membership
//     before clearing deleted_at — the active SELECT policy doesn't need
//     to know about restoration semantics.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { invalidateEntity } from '../../api/invalidation'
import posthog from '../../lib/analytics'
import type { RFI } from '../../types/entities'

export function useDeletedRFIs(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['rfis_deleted', projectId ?? '__none__'],
    enabled: !!projectId,
    staleTime: 15_000,
    queryFn: async (): Promise<RFI[]> => {
      if (!projectId) return []
      const { data, error } = await supabase.rpc('list_deleted_rfis', {
        p_project_id: projectId,
      })
      if (error) throw error
      return (data ?? []) as unknown as RFI[]
    },
  })
}

export function useSoftDeleteRFI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await fromTable('rfis')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id ?? null,
        } as never)
        .eq('id', params.id)
        .eq('project_id', params.projectId)
      if (error) throw error
      return params
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ['rfis', params.projectId] })
      qc.invalidateQueries({ queryKey: ['rfis_deleted', params.projectId] })
      invalidateEntity('rfi', params.projectId)
      posthog.capture('rfi_soft_deleted', { rfi_id: params.id })
    },
  })
}

export function useRestoreRFI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await supabase.rpc('restore_rfi', { p_rfi_id: params.id })
      if (error) throw error
      return params
    },
    onSuccess: (params) => {
      qc.invalidateQueries({ queryKey: ['rfis', params.projectId] })
      qc.invalidateQueries({ queryKey: ['rfis_deleted', params.projectId] })
      invalidateEntity('rfi', params.projectId)
      posthog.capture('rfi_restored', { rfi_id: params.id })
    },
  })
}
