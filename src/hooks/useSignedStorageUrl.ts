// useSignedStorageUrl — resolves a Supabase Storage path (or legacy
// /public/<bucket>/<path> URL) to a signed URL with a module-level cache.
//
// Why this exists: the `daily-log-photos` bucket is private with project-
// scoped RLS, so `getPublicUrl(...)` returns a 400/403-yielding URL that
// fails silently in <img> tags. `createSignedUrl(...)` is the correct
// surface for these buckets. We accept legacy public URLs as input so
// existing rows (which stored the broken public URL into a JSON column)
// keep rendering without a DB backfill.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const EXPIRY_SECONDS = 3600;
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

const PUBLIC_URL_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:\?.*)?$/;

export interface UseSignedStorageUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
}

interface Resolved {
  bucket: string;
  path: string;
}

function resolveBucketAndPath(bucket: string, pathOrUrl: string | null | undefined): Resolved | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.includes('/storage/v1/object/')) {
    const match = pathOrUrl.match(PUBLIC_URL_RE);
    if (match) return { bucket: match[1], path: decodeURIComponent(match[2]) };
    return null;
  }
  return { bucket, path: pathOrUrl };
}

function freshCacheHit(key: string): CacheEntry | null {
  const cached = cache.get(key);
  if (!cached) return null;
  return cached.expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS ? cached : null;
}

async function fetchSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}:${path}`;
  const fresh = freshCacheHit(key);
  if (fresh) return fresh.url;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, EXPIRY_SECONDS);
      if (error || !data?.signedUrl) return null;
      cache.set(key, {
        url: data.signedUrl,
        expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
      });
      return data.signedUrl;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

interface AsyncState {
  key: string;
  url: string | null;
  error: string | null;
}

export function useSignedStorageUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
): UseSignedStorageUrlResult {
  const resolved = useMemo(
    () => resolveBucketAndPath(bucket, pathOrUrl),
    [bucket, pathOrUrl],
  );
  const cacheKey = resolved ? `${resolved.bucket}:${resolved.path}` : null;

  const [asyncState, setAsyncState] = useState<AsyncState>({ key: '', url: null, error: null });

  useEffect(() => {
    if (!resolved || !cacheKey) return;
    if (freshCacheHit(cacheKey)) return;
    let cancelled = false;
    fetchSignedUrl(resolved.bucket, resolved.path)
      .then((signed) => {
        if (cancelled) return;
        setAsyncState({
          key: cacheKey,
          url: signed,
          error: signed ? null : 'Could not sign storage URL',
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAsyncState({ key: cacheKey, url: null, error: 'Could not sign storage URL' });
      });
    return () => {
      cancelled = true;
    };
  }, [resolved, cacheKey]);

  if (!resolved || !cacheKey) {
    return {
      url: null,
      loading: false,
      error: pathOrUrl ? 'Could not resolve storage path' : null,
    };
  }
  const cached = freshCacheHit(cacheKey);
  if (cached) return { url: cached.url, loading: false, error: null };
  if (asyncState.key === cacheKey) {
    return { url: asyncState.url, loading: false, error: asyncState.error };
  }
  return { url: null, loading: true, error: null };
}
