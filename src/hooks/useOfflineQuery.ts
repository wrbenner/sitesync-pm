import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useIsOnline } from './useOfflineStatus'
import { getFromCache, getOneFromCache } from '../lib/offlineDb'

/**
 * Wraps TanStack React Query with offline fallback from Dexie.
 * When online: fetches from Supabase as normal, updates Dexie cache via cacheProjectData.
 * When offline: reads from Dexie local cache.
 */
export function useOfflineQuery<T>(
  options: UseQueryOptions<T, Error> & {
    offlineTable?: string
    offlineProjectId?: string
    offlineId?: string
  }
) {
  const isOnline = useIsOnline()
  const { offlineTable, offlineProjectId, offlineId, ...queryOptions } = options

  return useQuery<T, Error>({
    ...queryOptions,
    queryFn: async () => {
      // If online, use the normal query function
      if (isOnline && queryOptions.queryFn) {
        return (queryOptions.queryFn as () => Promise<T>)()
      }

      // If offline and we have a cache table, read from Dexie
      if (offlineTable) {
        if (offlineId) {
          const item = await getOneFromCache<T>(offlineTable, offlineId)
          if (item) return item
        } else {
          const items = await getFromCache<T>(offlineTable, offlineProjectId)
          if (items && (items as unknown[]).length > 0) return items as T
        }
      }

      // If we can't get data from either source, throw
      throw new Error('No network connection and no cached data available')
    },
    // When offline, don't retry failed requests
    retry: isOnline ? (queryOptions.retry ?? 3) : false,
    // Prevent background refetches when offline
    refetchOnWindowFocus: isOnline,
    refetchOnReconnect: true,
    // Keep stale data available longer when offline
    staleTime: isOnline ? (queryOptions.staleTime ?? 60_000) : Infinity,
  })
}
