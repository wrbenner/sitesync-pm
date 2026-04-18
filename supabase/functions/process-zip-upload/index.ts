// ── process-zip-upload Edge Function ─────────────────────────
// Adapted from sitesyncai-backend extraction.service. Takes a ZIP
// file that's already been uploaded to `project-files` storage,
// extracts each entry, auto-classifies PDFs, organizes by discipline,
// skips duplicates by SHA-256, and inserts `documents` rows.
//
// Uses JSR jsr:@zip-js/zip-js equivalent via esm.sh since Deno runtime.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// zip.js runs in Deno via the browser build
import * as zip from 'https://esm.sh/@zip.js/zip.js@2.7.45?target=deno'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface RequestBody {
  project_id: string
  /** Storage path to the ZIP in `project-files` bucket */
  zip_path: string
  /** Destination bucket for extracted files (default `project-files`) */
  dest_bucket?: string
  /** Optional user-chosen prefix under the bucket (default is derived from discipline) */
  dest_prefix?: string
  /** If true, call classify-drawing for each PDF */
  auto_classify?: boolean
}

// Discipline detection from common sheet prefixes
const DISC_RX: Array<[RegExp, string]> = [
  [/^A[-\s]?\d/i, 'Architectural'],
  [/^S[-\s]?\d/i, 'Structural'],
  [/^M[-\s]?\d/i, 'Mechanical'],
  [/^E[-\s]?\d/i, 'Electrical'],
  [/^P[-\s]?\d/i, 'Plumbing'],
  [/^C[-\s]?\d/i, 'Civil'],
  [/^L[-\s]?\d/i, 'Landscape'],
  [/^FP[-\s]?\d/i, 'FireProtection'],
]

function disciplineFor(name: string): string {
  for (const [rx, d] of DISC_RX) if (rx.test(name)) return d
  return 'Uncategorized'
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    if (!body.project_id) throw new HttpError(400, 'project_id required', 'validation_error')
    if (!body.zip_path) throw new HttpError(400, 'zip_path required', 'validation_error')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      throw new HttpError(500, 'Storage credentials missing', 'config_error')
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const destBucket = body.dest_bucket ?? 'project-files'
    const autoClassify = body.auto_classify ?? true

    // Download ZIP
    const { data: zipBlob, error: dlErr } = await supabase.storage
      .from('project-files').download(body.zip_path)
    if (dlErr || !zipBlob) throw new HttpError(404, `ZIP not found: ${dlErr?.message}`, 'not_found')

    // Existing hashes for duplicate skip
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('sha256')
      .eq('project_id', body.project_id)
      .not('sha256', 'is', null)
    const existingHashes = new Set<string>((existingDocs ?? []).map((r) => r.sha256 as string))

    // Extract entries
    const reader = new zip.ZipReader(new zip.BlobReader(zipBlob))
    const entries = await reader.getEntries()

    const results: Array<{ name: string; status: 'uploaded' | 'duplicate' | 'skipped' | 'error'; error?: string; path?: string; document_id?: string }> = []

    for (const entry of entries) {
      if (entry.directory) continue
      const lower = entry.filename.toLowerCase()
      const isPdf = lower.endsWith('.pdf')
      const isImg = /\.(jpg|jpeg|png|webp)$/i.test(lower)
      if (!isPdf && !isImg) {
        results.push({ name: entry.filename, status: 'skipped', error: 'Unsupported type' })
        continue
      }
      if (!entry.getData) {
        results.push({ name: entry.filename, status: 'error', error: 'No data accessor' })
        continue
      }
      const writer = new zip.Uint8ArrayWriter()
      const buf = (await entry.getData(writer)) as Uint8Array
      const hash = await sha256Hex(buf)
      if (existingHashes.has(hash)) {
        results.push({ name: entry.filename, status: 'duplicate' })
        continue
      }

      const base = entry.filename.split('/').pop() ?? entry.filename
      const discipline = isPdf ? disciplineFor(base) : 'Photos'
      const prefix = body.dest_prefix ?? `projects/${body.project_id}/${discipline}`
      const safeName = base.replace(/[^A-Za-z0-9._-]+/g, '_')
      const destPath = `${prefix}/${Date.now()}-${safeName}`

      const { error: upErr } = await supabase.storage.from(destBucket).upload(destPath, buf, {
        contentType: isPdf ? 'application/pdf' : 'image/jpeg',
        upsert: false,
      })
      if (upErr) {
        results.push({ name: entry.filename, status: 'error', error: upErr.message })
        continue
      }

      const { data: doc, error: insErr } = await supabase.from('documents').insert({
        project_id: body.project_id,
        name: base,
        storage_path: destPath,
        bucket: destBucket,
        size_bytes: buf.byteLength,
        mime_type: isPdf ? 'application/pdf' : 'image/jpeg',
        sha256: hash,
        discipline,
      }).select('id').single()

      if (insErr) {
        results.push({ name: entry.filename, status: 'error', error: insErr.message, path: destPath })
        continue
      }
      existingHashes.add(hash)

      // Fire-and-forget classify-drawing for PDFs
      if (isPdf && autoClassify && doc?.id) {
        fetch(`${supabaseUrl}/functions/v1/classify-drawing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            project_id: body.project_id,
            document_id: doc.id,
            storage_path: destPath,
          }),
        }).catch(() => { /* best-effort */ })
      }

      // Broadcast progress via Realtime
      try {
        await supabase.channel(`zip-upload:${body.project_id}`).send({
          type: 'broadcast',
          event: 'progress',
          payload: { zip_path: body.zip_path, processed: results.length + 1, current: base, discipline },
        })
      } catch { /* ignore */ }

      results.push({ name: entry.filename, status: 'uploaded', path: destPath, document_id: doc?.id })
    }

    await reader.close()

    const summary = {
      total: results.length,
      uploaded: results.filter((r) => r.status === 'uploaded').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
