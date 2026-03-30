import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { useIsOnline } from './useOfflineStatus'
import { syncManager } from '../lib/syncManager'
import { writeToCache } from '../lib/offlineDb'
import { toast } from 'sonner'

interface OfflineMutationOptions<TData, TVariables> {
  // Supabase table name (e.g. 'rfis', 'tasks')
  table: string
  // The operation type
  operation: 'insert' | 'update' | 'delete'
  // Online mutation function (runs when connected)
  mutationFn: (variables: TVariables) => Promise<TData>
  // Query keys to invalidate on success
  invalidateKeys?: unknown[][]
  // Extract the data payload to queue offline
  getOfflinePayload: (variables: TVariables) => Record<string, unknown>
  // PostHog event name
  analyticsEvent?: string
  // Additional onSuccess
  onSuccess?: (data: TData | null, variables: TVariables) => void
}

export function useOfflineMutation<TData = unknown, TVariables = unknown>(
  options: OfflineMutationOptions<TData, TVariables>
) {
  const isOnline = useIsOnline()
  const queryClient = useQueryClient()

  return useMutation<TData | null, Error, TVariables>({
    mutationFn: async (variables) => {
      if (isOnline) {
        return options.mutationFn(variables)
      }

      // Queue for offline sync
      const payload = options.getOfflinePayload(variables)
      await syncManager.queueOfflineMutation(options.table, options.operation, payload)

      // Write optimistically to local cache
      if (options.operation !== 'delete') {
        await writeToCache(options.table, payload)
      }

      toast.info('Saved offline. Will sync when connected.')
      return null
    },
    onSuccess: (data, variables) => {
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key })
        }
      }
      options.onSuccess?.(data, variables)
    },
  })
}
