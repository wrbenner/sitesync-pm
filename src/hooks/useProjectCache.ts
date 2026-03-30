import { useEffect, useRef } from 'react'
import { syncManager } from '../lib/syncManager'
import { getSyncMetadata } from '../lib/offlineDb'

/**
 * On mount (and when projectId changes), caches all project data to Dexie
 * for offline access. Only re-caches if more than 5 minutes have elapsed
 * since last cache for this project.
 */
export function useProjectCache(projectId: string | undefined) {
  const cachingRef = useRef(false)

  useEffect(() => {
    if (!projectId || cachingRef.current) return

    const maybeCache = async () => {
      const lastCacheStr = await getSyncMetadata(`lastSync:${projectId}`)
      if (lastCacheStr) {
        const elapsed = Date.now() - new Date(lastCacheStr).getTime()
        if (elapsed < 5 * 60 * 1000) return // cached within 5 min
      }

      cachingRef.current = true
      await syncManager.cacheProject(projectId)
      cachingRef.current = false
    }

    maybeCache()
  }, [projectId])

  // Also re-cache when coming back online after being offline
  useEffect(() => {
    if (!projectId) return

    const handler = () => {
      if (navigator.onLine && !cachingRef.current) {
        syncManager.cacheProject(projectId)
      }
    }

    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [projectId])
}
