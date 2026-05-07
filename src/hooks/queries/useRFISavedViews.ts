// ── useRFISavedViews ────────────────────────────────────────────────────
// Read + write hooks for the rfi_saved_views table.
//
// The list page uses these for:
//   • Left rail rendering (Company / Project / Personal sections)
//   • Save-as-View action
//   • Apply view → URL state diff
//
// RLS handles scope visibility, so the SELECT just queries by project
// and the server returns only what this user can see.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'
import type { RFIListFilters, ViewMode } from '../../lib/rfi/listFilters'

const from = (table: string) => fromTable(table as never)

export type RFIViewScope = 'company' | 'project' | 'personal'

export interface RFISavedView {
  id: string
  project_id: string
  owner_id: string | null
  scope: RFIViewScope
  name: string
  filters: RFIListFilters
  columns: Array<{ id: string; visible?: boolean; pinned?: boolean; width?: number }>
  sort: Array<{ id: string; dir: 'asc' | 'desc' }>
  color_by: string | null
  view_mode: ViewMode
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

const QK = (projectId: string | undefined | null) => ['rfi_saved_views', projectId ?? '__none__']

export function useRFISavedViews(projectId: string | undefined | null) {
  return useQuery({
    queryKey: QK(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async (): Promise<RFISavedView[]> => {
      if (!projectId) return []
      const { data, error } = await from('rfi_saved_views')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('scope' as never, { ascending: true })
        .order('name' as never, { ascending: true })
      if (error) return []
      return (data ?? []) as unknown as RFISavedView[]
    },
  })
}

export function useCreateRFISavedView() {
  const qc = useQueryClient()
  // AUDIT-EXEMPT: A saved view stores filter + column + sort + view-mode
  // configuration, not RFI data. It changes how a list is presented to
  // the owner; it does not change what data is accessible. Personal-scope
  // views are user-private; team/project-scope views affect default
  // presentation only — the underlying RLS still controls visibility.
  return useMutation({
    mutationFn: async (params: {
      projectId: string
      scope: RFIViewScope
      name: string
      filters: RFIListFilters
      columns?: Array<{ id: string; visible?: boolean; pinned?: boolean; width?: number }>
      sort?: Array<{ id: string; dir: 'asc' | 'desc' }>
      view_mode?: ViewMode
      color_by?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await from('rfi_saved_views')
        .insert({
          project_id: params.projectId,
          scope: params.scope,
          owner_id: params.scope === 'personal' ? user?.id ?? null : null,
          name: params.name,
          filters: params.filters as unknown as Record<string, unknown>,
          columns: params.columns ?? [],
          sort: params.sort ?? [],
          view_mode: params.view_mode ?? 'table',
          color_by: params.color_by ?? null,
          created_by: user?.id ?? null,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data as unknown as RFISavedView
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.projectId) })
    },
  })
}

export function useUpdateRFISavedView() {
  const qc = useQueryClient()
  // AUDIT-EXEMPT: Saved-view patch — see useCreateRFISavedView rationale.
  return useMutation({
    mutationFn: async (params: {
      id: string
      projectId: string
      patch: Partial<Omit<RFISavedView, 'id' | 'project_id' | 'created_at' | 'updated_at'>>
    }) => {
      const { error } = await from('rfi_saved_views')
        .update(params.patch as never)
        .eq('id' as never, params.id)
      if (error) throw error
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.projectId) })
    },
  })
}

export function useDeleteRFISavedView() {
  const qc = useQueryClient()
  // AUDIT-EXEMPT: Saved-view delete — see useCreateRFISavedView rationale.
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await from('rfi_saved_views')
        .delete()
        .eq('id' as never, params.id)
      if (error) throw error
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.projectId) })
    },
  })
}
