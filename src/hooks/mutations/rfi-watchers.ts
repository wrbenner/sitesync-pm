import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createOnError } from './createAuditedMutation'



import type { Database } from '../../types/database'
import { fromTable } from '../../lib/db/queries'

type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── RFI Watchers ─────────────────────────────────────────

export function useAddRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').insert({ rfi_id: rfiId, user_id: userId } as never)
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
      const { error } = await from('rfi_watchers').delete().eq('rfi_id' as never, rfiId).eq('user_id' as never, userId)
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('remove_rfi_watcher'),
  })
}
