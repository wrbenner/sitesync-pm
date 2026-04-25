/**
 * Hook to resolve Supabase Storage paths to signed URLs with auto-refresh.
 * Used for displaying thumbnails and viewing drawing files.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
      setUrl(null)
      return
    }

    // Check cache first
    const cached = URL_CACHE.get(storagePath)
    if (cached && cached.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
      setUrl(cached.url)
      return
    }

    let cancelled = false

    supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, EXPIRY_SECONDS)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.signedUrl) {
          setUrl(null)
          return
        }
        const entry = {
          url: data.signedUrl,
          expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
        }
        URL_CACHE.set(storagePath, entry)
        setUrl(data.signedUrl)
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
  const results = await Promise.allSettled(
    toFetch.map(async (path) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, EXPIRY_SECONDS)
      return { path, url: data?.signedUrl ?? null }
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
