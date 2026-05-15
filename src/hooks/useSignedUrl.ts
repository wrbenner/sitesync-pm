/**
 * Hook to resolve Supabase Storage paths to signed URLs with auto-refresh.
 * Used for displaying thumbnails and viewing drawing files.
 *
 * FMEA L.SIGNED.1 (wave 3): all signed-URL issuance is routed through
 * createScopedSignedUrl(), which normalizes the path (rejects `..`,
 * `%2e%2e`, backslash) before calling Supabase Storage.
 */
import { useState, useEffect } from 'react'
import { createScopedSignedUrl } from '../lib/storage/scopedSignedUrl'

const URL_CACHE = new Map<string, { url: string; expiresAt: number }>()
const EXPIRY_SECONDS = 3600 // 1 hour
const REFRESH_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 min before expiry

/**
 * Get a signed URL for a Supabase Storage path.
 * Returns null while loading, the URL string when ready, or null on error.
 */
export function useSignedUrl(
  storagePath: string | null | undefined,
  bucket = 'project-files',
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!storagePath) return null
    const cached = URL_CACHE.get(storagePath)
    if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
      return cached.url
    }
    return null
  })

  useEffect(() => {
    if (!storagePath) {
      // No path — schedule clear so the effect body is pure (no
      // synchronous setState). queueMicrotask defers to the next
      // microtask, matching React 19's preferred async-clear pattern.
      queueMicrotask(() => setUrl(null))
      return
    }

    let cancelled = false

    // Check cache (async-deferred to keep effect body pure).
    queueMicrotask(() => {
      if (cancelled) return
      const cached = URL_CACHE.get(storagePath)
      if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
        setUrl(cached.url)
        return
      }

      createScopedSignedUrl(bucket, storagePath, EXPIRY_SECONDS).then((result) => {
        if (cancelled) return
        if (!result.ok) {
          setUrl(null)
          return
        }
        const entry = {
          url: result.signedUrl,
          expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
        }
        URL_CACHE.set(storagePath, entry)
        setUrl(result.signedUrl)
      })
    })

    return () => { cancelled = true }
  }, [storagePath, bucket])

  return url
}

/**
 * Batch resolve multiple storage paths to signed URLs.
 * More efficient than individual hooks for list views.
 */
export async function batchSignedUrls(
  paths: string[],
  bucket = 'project-files',
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const toFetch: string[] = []

  for (const path of paths) {
    const cached = URL_CACHE.get(path)
    if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
      result.set(path, cached.url)
    } else {
      toFetch.push(path)
    }
  }

  // Supabase doesn't have a batch signed URL API, so parallel fetch
  // through the scoped wrapper (each path is normalized + traversal-rejected).
  const results = await Promise.allSettled(
    toFetch.map(async (path) => {
      const result = await createScopedSignedUrl(bucket, path, EXPIRY_SECONDS)
      return { path, url: result.ok ? result.signedUrl : null }
    }),
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.url) {
      const entry = { url: r.value.url, expiresAt: Date.now() + EXPIRY_SECONDS * 1000 }
      URL_CACHE.set(r.value.path, entry)
      result.set(r.value.path, r.value.url)
    }
  }

  return result
}
