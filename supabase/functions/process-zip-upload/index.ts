// ── process-zip-upload Edge Function ──────────────────────
// Accepts a ZIP file previously uploaded to `project-files` storage,
// extracts PDFs and images, uploads each extracted file back to the bucket,
// and inserts one `documents` row per extracted file.
//
// Supports nested ZIPs (one level deep) and tracks progress by updating
// `zip_upload_jobs.progress_pct` so the client can poll.
//
// Adapted from sitesyncai-backend/src/extraction/extraction.service.ts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import JSZip from 'https://esm.sh/jszip@3.10.1'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface ProcessZipRequest {
  project_id: string
  storage_path: string // e.g. "project-xxx/uploads/drawings-2026-04-18.zip"
  job_id?: string
  bucket?: string // default: project-files
  document_type?: string // default: drawing
}

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp']
const DRAWING_EXT = ['.pdf', ...IMAGE_EXT]

function extOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx).toLowerCase()
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 128)
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<ProcessZipRequest>(req)
    requireUuid(body.project_id, 'project_id')

    if (!body.storage_path) {
      throw new HttpError(400, 'storage_path is required', 'validation_error')
    }

    await verifyProjectMembership(supabase, user.id, body.project_id)

    const bucket = body.bucket ?? 'project-files'
    const docType = body.document_type ?? 'drawing'
    const jobId = body.job_id ?? null

    const updateJob = async (patch: Record<string, unknown>) => {
      if (!jobId) return
      try {
        await supabase.from('zip_upload_jobs').update(patch).eq('id', jobId)
      } catch {
        /* ignore — job tracking is best-effort */
      }
    }

    await updateJob({ status: 'downloading', progress_pct: 5 })

    // 1. Download the ZIP
    const { data: blob, error: dlError } = await supabase.storage
      .from(bucket)
      .download(body.storage_path)
    if (dlError || !blob) {
      throw new HttpError(400, `Failed to download ZIP: ${dlError?.message ?? 'no data'}`)
    }

    const buf = new Uint8Array(await blob.arrayBuffer())

    // 2. Parse ZIP
    await updateJob({ status: 'extracting', progress_pct: 15 })
    const zip = await JSZip.loadAsync(buf)

    interface ExtractedEntry {
      path: string // full path inside zip
      name: string // base name
      ext: string
      data: Uint8Array
    }
    const entries: ExtractedEntry[] = []

    const gather = async (z: JSZip, prefix: string) => {
      const fileNames = Object.keys(z.files)
      for (const fn of fileNames) {
        const entry = z.files[fn]
        if (entry.dir) continue
        const ext = extOf(fn)
        // Recurse into nested ZIPs (one level)
        if (ext === '.zip' && prefix === '') {
          const nestedBuf = await entry.async('uint8array')
          try {
            const nested = await JSZip.loadAsync(nestedBuf)
            await gather(nested, fn + '/')
          } catch {
            // skip unreadable nested zip
          }
          continue
        }
        if (!DRAWING_EXT.includes(ext)) continue
        const data = await entry.async('uint8array')
        const base = sanitizeName(fn.split('/').pop() ?? 'file')
        entries.push({ path: prefix + fn, name: base, ext, data })
      }
    }

    await gather(zip, '')

    if (entries.length === 0) {
      await updateJob({ status: 'completed', progress_pct: 100, error: 'No drawing files found in ZIP' })
      return new Response(
        JSON.stringify({ success: true, extracted_count: 0, documents: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // 3. Upload extracted files + insert document rows
    await updateJob({ status: 'uploading', progress_pct: 30, total_files: entries.length })

    interface InsertedDoc {
      id: string
      file_name: string
      storage_path: string
    }
    const inserted: InsertedDoc[] = []
    const failures: Array<{ file: string; error: string }> = []
    const timestamp = Date.now()

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const storagePath = `${body.project_id}/zip-extract/${timestamp}/${i}-${e.name}`

      try {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(storagePath, e.data, {
            contentType: contentTypeFor(e.ext),
            upsert: false,
          })
        if (upErr) {
          failures.push({ file: e.path, error: upErr.message })
          continue
        }

        const { data: doc, error: insErr } = await supabase
          .from('documents')
          .insert({
            project_id: body.project_id,
            file_name: e.name,
            storage_path: storagePath,
            document_type: docType,
            file_size: e.data.byteLength,
            uploaded_by: user.id,
            source: 'zip_extract',
            metadata: { original_path: e.path, job_id: jobId },
          })
          .select('id, file_name, storage_path')
          .single()

        if (insErr) {
          failures.push({ file: e.path, error: insErr.message })
          continue
        }

        inserted.push(doc as InsertedDoc)
      } catch (err) {
        failures.push({
          file: e.path,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      // Progress: 30% → 95%
      const pct = 30 + Math.round(((i + 1) / entries.length) * 65)
      if (i % 3 === 0 || i === entries.length - 1) {
        await updateJob({ progress_pct: pct, processed_files: i + 1 })
      }
    }

    await updateJob({
      status: 'completed',
      progress_pct: 100,
      processed_files: inserted.length,
      failed_files: failures.length,
    })

    return new Response(
      JSON.stringify({
        success: true,
        extracted_count: inserted.length,
        failed_count: failures.length,
        documents: inserted,
        failures,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
