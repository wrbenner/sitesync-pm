/**
 * Resumable (TUS) uploads for Supabase Storage.
 *
 * Construction drawings routinely exceed 50 MB. The standard
 * `supabase.storage.upload()` fails for files above the bucket's
 * single-request limit. TUS breaks the upload into 6 MB chunks,
 * supports automatic retry/resume, and reports byte-level progress.
 *
 * Uses `tus-js-client` (already installed) against the Supabase
 * Storage TUS endpoint at `/storage/v1/upload/resumable`.
 */
import * as tus from 'tus-js-client'
import { supabase } from './supabase'

// Env-only — no source-level fallbacks. If these are missing the
// Supabase client in ./supabase.ts would have thrown already, so by
// the time this module runs both are guaranteed to be strings.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** 6 MB chunks — Supabase minimum is 5 MB for all chunks except the last. */
const CHUNK_SIZE = 6 * 1024 * 1024

export interface ResumableUploadOptions {
  /** Storage bucket name */
  bucket: string
  /** Object path inside the bucket (e.g. `projectId/drawings/file.pdf`) */
  path: string
  /** The file to upload */
  file: File
  /** Progress callback — percent 0-100 */
  onProgress?: (percent: number) => void
}

export interface ResumableUploadResult {
  /** The full storage path (bucket/path) */
  storagePath: string
  error: string | null
}

/**
 * Upload a file using the TUS resumable protocol.
 * Automatically resumes interrupted uploads.
 */
export function uploadResumable({
  bucket,
  path,
  file,
  onProgress,
}: ResumableUploadOptions): { promise: Promise<ResumableUploadResult>; abort: () => void } {
  let tusUpload: tus.Upload | null = null

  const promise = new Promise<ResumableUploadResult>((resolve) => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        resolve({ storagePath: '', error: 'Not authenticated — please sign in again.' })
        return
      }

      tusUpload = new tus.Upload(file, {
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
        onError(error) {
          console.error('[TUS] Upload error:', error)
          resolve({ storagePath: '', error: error.message || 'Upload failed' })
        },
        onProgress(bytesUploaded, bytesTotal) {
          const pct = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0
          onProgress?.(pct)
        },
        onSuccess() {
          resolve({ storagePath: path, error: null })
        },
      })

      // Try to resume a previous partial upload for this file
      const previousUploads = await tusUpload.findPreviousUploads()
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0])
      }
      tusUpload.start()
    }
    run().catch((err) => {
      resolve({ storagePath: '', error: (err as Error).message || 'Upload setup failed' })
    })
  })

  return {
    promise,
    abort: () => tusUpload?.abort(),
  }
}

/**
 * Smart upload — uses TUS for large files, standard upload for small ones.
 * Threshold: 50 MB.
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

  // Standard single-shot upload for small files
  onProgress?.(0)
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  onProgress?.(100)

  if (error) return { storagePath: '', error: error.message }
  return { storagePath: data?.path ?? path, error: null }
}
