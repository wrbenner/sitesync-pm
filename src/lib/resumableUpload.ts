/**
 * Resumable (TUS) uploads for Supabase Storage.
 *
 * Construction drawings routinely exceed 50 MB. The standard
 * `supabase.storage.upload()` fails for files above the bucket's
 * single-request limit. TUS breaks the upload into 6 MB chunks,
 * supports automatic retry/resume, and reports byte-level progress.
 *
 * `tus-js-client` is loaded dynamically so the build succeeds even when
 * the package is only a transitive dep. If TUS is unavailable at runtime
 * smartUpload falls back to single-shot upload for all file sizes.
 */
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** 6 MB chunks — Supabase minimum is 5 MB for all chunks except the last. */
const CHUNK_SIZE = 6 * 1024 * 1024

export interface ResumableUploadOptions {
  bucket: string
  path: string
  file: File
  onProgress?: (percent: number) => void
}

export interface ResumableUploadResult {
  storagePath: string
  error: string | null
}

interface TusUploadInstance {
  start(): void
  abort(): void
  findPreviousUploads(): Promise<unknown[]>
  resumeFromPreviousUpload(prev: unknown): void
}

interface TusModule {
  Upload: new (
    file: File,
    options: {
      endpoint: string
      retryDelays: number[]
      chunkSize: number
      headers: Record<string, string>
      uploadDataDuringCreation: boolean
      removeFingerprintOnSuccess: boolean
      metadata: Record<string, string>
      onError: (error: Error) => void
      onProgress: (bytesUploaded: number, bytesTotal: number) => void
      onSuccess: () => void
    },
  ) => TusUploadInstance
}

// Dynamically load tus-js-client so this module compiles even when the
// package is only reachable as a transitive dep (pnpm strict hoisting).
async function tryLoadTus() {
  try {
    return await import('tus-js-client') as unknown as TusModule
  } catch {
    return null
  }
}

/**
 * Upload a file using the TUS resumable protocol.
 * Automatically resumes interrupted uploads.
 * Falls back to standard upload if tus-js-client is unavailable.
 */
export function uploadResumable({
  bucket,
  path,
  file,
  onProgress,
}: ResumableUploadOptions): { promise: Promise<ResumableUploadResult>; abort: () => void } {
  let abortFn: (() => void) | null = null

  const promise = (async (): Promise<ResumableUploadResult> => {
    const tus = await tryLoadTus()

    if (!tus) {
      // tus-js-client not available — fall back to standard upload
      onProgress?.(0)
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      onProgress?.(100)
      if (error) return { storagePath: '', error: error.message }
      return { storagePath: data?.path ?? path, error: null }
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return { storagePath: '', error: 'Not authenticated — please sign in again.' }
    }

    return new Promise<ResumableUploadResult>((resolve) => {
      const tusUpload = new tus.Upload(file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        chunkSize: CHUNK_SIZE,
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
          'x-upsert': 'true',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError(error: Error) {
          resolve({ storagePath: '', error: error.message || 'Upload failed' })
        },
        onProgress(bytesUploaded: number, bytesTotal: number) {
          const pct = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0
          onProgress?.(pct)
        },
        onSuccess() {
          resolve({ storagePath: path, error: null })
        },
      })

      abortFn = () => tusUpload.abort()

      tusUpload.findPreviousUploads().then((prev: unknown[]) => {
        if (prev.length > 0) tusUpload.resumeFromPreviousUpload(prev[0])
        tusUpload.start()
      }).catch(() => {
        tusUpload.start()
      })
    })
  })()

  return {
    promise,
    abort: () => abortFn?.(),
  }
}

/**
 * Smart upload — uses TUS for large files (>50 MB), standard upload for small ones.
 */
export const RESUMABLE_THRESHOLD = 50 * 1024 * 1024

export async function smartUpload(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; error: string | null }> {
  if (file.size > RESUMABLE_THRESHOLD) {
    const { promise } = uploadResumable({ bucket, path, file, onProgress })
    return promise
  }

  onProgress?.(0)
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  onProgress?.(100)

  if (error) return { storagePath: '', error: error.message }
  return { storagePath: data?.path ?? path, error: null }
}
