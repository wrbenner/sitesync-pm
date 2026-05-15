/**
 * FMEA L.SIGNED.1 (wave 3) — project-wide signed-URL wrapper.
 *
 * Centralizes Supabase Storage `createSignedUrl` invocations behind a
 * single helper that normalizes the path before issuing the token.
 * The normalizer rejects path-traversal patterns (`..`, encoded `%2e%2e`,
 * backslash separators) and strips leading slashes so callers cannot
 * accidentally escape the bucket scope.
 *
 * Callers throughout the app should migrate to this helper instead of
 * invoking `supabase.storage.from(bucket).createSignedUrl(path, ttl)`
 * directly — wave-3 ships the wrapper + 1 caller migration; the rest
 * is tracked as a follow-up sweep (catalog entry L.SIGNED.1 remains
 * PARTIAL until the full sweep lands).
 */
import { supabase } from '../supabase'

export type ScopedSignedUrlResult =
  | { ok: true; signedUrl: string }
  | { ok: false; reason: 'invalid_path' | 'storage_error'; message: string }

/**
 * Normalizes a storage path or returns null when the path contains a
 * traversal pattern. Exported for tests; production callers should use
 * `createScopedSignedUrl` instead.
 */
export function normalizeStoragePath(path: string): string | null {
  if (typeof path !== 'string') return null
  if (path.length === 0) return null
  if (path.includes('..')) return null
  if (/%2e%2e/i.test(path)) return null
  if (path.includes('\\')) return null
  if (path.includes('\0')) return null
  // Strip leading slashes — Supabase Storage treats paths as relative
  // to the bucket root, leading `/` is at best ignored and at worst
  // resolves to an unexpected object key.
  return path.replace(/^\/+/, '')
}

/**
 * Issue a signed URL for `bucket/path` with `expiresIn` seconds. Always
 * normalizes the path first. Never throws — returns a discriminated
 * union so callers can render an inline error without try/catch noise.
 */
export async function createScopedSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number,
): Promise<ScopedSignedUrlResult> {
  const safe = normalizeStoragePath(path)
  if (safe === null) {
    return { ok: false, reason: 'invalid_path', message: 'Path failed normalization (traversal segment, encoded escape, or backslash).' }
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(safe, expiresIn)
  if (error || !data?.signedUrl) {
    return {
      ok: false,
      reason: 'storage_error',
      message: error?.message ?? 'Storage returned no signed URL.',
    }
  }
  return { ok: true, signedUrl: data.signedUrl }
}
