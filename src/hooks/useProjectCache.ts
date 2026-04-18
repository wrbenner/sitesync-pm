import { useEffect, useRef } from 'react'
import { syncManager } from '../lib/syncManager'
import { getSyncMetadata } from '../lib/offlineDb'
import { fetchAndBuildProjectContext } from '../lib/aiPrompts'

interface ContextCacheEntry {
  context: string
  fetchedAt: number
}

const contextCache = new Map<string, ContextCacheEntry>()
const CONTEXT_TTL_MS = 5 * 60 * 1000

export async function getCachedProjectContext(projectId: string): Promise<string> {
  if (!projectId) return ''
  const entry = contextCache.get(projectId)
  if (entry && Date.now() - entry.fetchedAt < CONTEXT_TTL_MS) {
    return entry.context
  }
  try {
    const context = await fetchAndBuildProjectContext(projectId)
    contextCache.set(projectId, { context, fetchedAt: Date.now() })
    return context
  } catch {
    return entry?.context ?? ''
  }
}

export function invalidateProjectContext(projectId: string): void {
  contextCache.delete(projectId)
}

// ── Entity label cache (for activity feed enrichment) ────────

interface EntityLabelCacheEntry {
  label: string
  fetchedAt: number
}

const entityLabelCache = new Map<string, EntityLabelCacheEntry>()
const ENTITY_LABEL_TTL_MS = 5 * 60 * 1000

/** Returns a cached label for the given cache key, or undefined if expired/missing. */
export function getCachedEntityLabel(key: string): string | undefined {
  const entry = entityLabelCache.get(key)
  if (entry && Date.now() - entry.fetchedAt < ENTITY_LABEL_TTL_MS) return entry.label
  return undefined
}

/** Stores a resolved entity label into the cache. */
export function setCachedEntityLabel(key: string, label: string): void {
  entityLabelCache.set(key, { label, fetchedAt: Date.now() })
}

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
      try {
        const lastCacheStr = await getSyncMetadata(`lastSync:${projectId}`)
        if (lastCacheStr) {
          const elapsed = Date.now() - new Date(lastCacheStr).getTime()
          if (elapsed < 5 * 60 * 1000) return
        }

        cachingRef.current = true
        await syncManager.cacheProject(projectId)
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[useProjectCache] cache error:', err)
      } finally {
        cachingRef.current = false
      }
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
