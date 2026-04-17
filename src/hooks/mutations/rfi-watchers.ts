import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── RFI Watchers ─────────────────────────────────────────

export function useAddRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').insert({ rfi_id: rfiId, user_id: userId })
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('add_rfi_watcher'),
  })
}

export function useRemoveRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').delete().eq('rfi_id', rfiId).eq('user_id', userId)
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('remove_rfi_watcher'),
  })
}
