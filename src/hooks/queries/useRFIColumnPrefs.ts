// ── useRFIColumnPrefs ───────────────────────────────────────────────────
// Per-user column layout (visibility / order / pin-left / width). One row
// per (user_id, project_id). Upsert on save.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fromTable } from '../../lib/db/queries'
import { supabase } from '../../lib/supabase'

const from = (table: string) => fromTable(table as never)

export interface RFIColumnPref {
  id: string
  visible: boolean
  pinned: boolean
  width: number | null
}

const QK = (projectId: string | undefined | null) => ['rfi_column_prefs', projectId ?? '__none__']

export function useRFIColumnPrefs(projectId: string | undefined | null) {
  return useQuery({
    queryKey: QK(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async (): Promise<RFIColumnPref[] | null> => {
      if (!projectId) return null
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await from('rfi_user_column_prefs')
        .select('columns')
        .eq('user_id' as never, user.id)
        .eq('project_id' as never, projectId)
        .maybeSingle()
      if (error) return null
      const cols = (data as { columns?: RFIColumnPref[] } | null)?.columns
      return Array.isArray(cols) ? cols : null
    },
  })
}

export function useSaveRFIColumnPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; columns: RFIColumnPref[] }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('not authenticated')
      // Upsert by (user_id, project_id) unique. Try update first; insert if missing.
      const { data: existing } = await from('rfi_user_column_prefs')
        .select('id')
        .eq('user_id' as never, user.id)
        .eq('project_id' as never, params.projectId)
        .maybeSingle()
      if (existing && (existing as { id?: string }).id) {
        const { error } = await from('rfi_user_column_prefs')
          .update({ columns: params.columns } as never)
          .eq('id' as never, (existing as { id: string }).id)
        if (error) throw error
      } else {
        const { error } = await from('rfi_user_column_prefs').insert({
          user_id: user.id,
          project_id: params.projectId,
          columns: params.columns,
        } as never)
        if (error) throw error
      }
      return params
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.projectId) })
    },
  })
}
