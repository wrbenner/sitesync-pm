// =============================================================================
// auto-link-media — runs the linker post-upload
// =============================================================================
// Body shape:
//   { media_id: uuid, media_type: 'photo_pin' | 'field_capture' }
//
// The function:
//   1. Verifies the caller is a project member of the photo's project
//   2. Loads the photo + ctx (drawings, today's daily log, undisputed
//      checkins, open punch items, open RFIs)
//   3. Runs runPhotoLinker() (pure)
//   4. Upserts media_links rows with onConflict on the active-edge unique index
//
// Idempotent: re-invoking for the same photo never duplicates an active edge.
// Soft-deleted edges are preserved so a manual unlink isn't undone.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
import { runPhotoLinker, writeLinks } from '../shared/linkage/photoLinker.ts'
import { classifyGpsStatus } from '../shared/linkage/geo.ts'
import type { MediaInput } from '../shared/linkage/types.ts'

interface RequestBody {
  media_id: string
  media_type: 'photo_pin' | 'field_capture'
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.media_id, 'media_id')
    if (body.media_type !== 'photo_pin' && body.media_type !== 'field_capture') {
      throw new HttpError(400, 'Invalid media_type')
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── 1. Load the media row ───────────────────────────────
    let projectId: string
    let media: MediaInput

    if (body.media_type === 'photo_pin') {
      const { data: photo, error } = await supabase
        .from('photo_pins')
        .select('id, project_id, taken_at, location_x, location_y, location_z, gps_status, gps_accuracy_m, metadata')
        .eq('id', body.media_id)
        .maybeSingle()
      if (error) throw error
      if (!photo) throw new HttpError(404, 'photo_pin not found')

      projectId = photo.project_id
      const lat = photo.location_x  // location_x stores lat for GPS-tagged photos
      const lng = photo.location_y
      const acc = photo.gps_accuracy_m as number | null
      media = {
        mediaId: photo.id,
        mediaType: 'photo_pin',
        projectId,
        takenAt: photo.taken_at as string,
        lat: lat || null,
        lng: lng || null,
        gpsAccuracyMeters: acc ?? null,
        gpsStatus: (photo.gps_status as MediaInput['gpsStatus']) ?? classifyGpsStatus(acc),
        specSection: (photo.metadata as { spec_section?: string } | null)?.spec_section ?? null,
      }
    } else {
      const { data: cap, error } = await supabase
        .from('field_captures')
        .select('id, project_id, created_at, location, ai_tags')
        .eq('id', body.media_id)
        .maybeSingle()
      if (error) throw error
      if (!cap) throw new HttpError(404, 'field_capture not found')

      projectId = cap.project_id
      // field_captures store location as text; the engine treats this as
      // GPS-unavailable for v1 and falls back to crew/daily-log/RFI links.
      media = {
        mediaId: cap.id,
        mediaType: 'field_capture',
        projectId,
        takenAt: (cap.created_at as string),
        lat: null,
        lng: null,
        gpsStatus: 'unavailable',
        specSection: null,
      }
    }

    // ── 2. AuthZ ────────────────────────────────────────────
    await verifyProjectMembership(supabase, user.id, projectId)

    // ── 3. Load context ─────────────────────────────────────
    const dayStart = new Date(media.takenAt)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const [drawingsRes, checkinsRes, crewsRes, dailyLogRes, punchRes, rfiRes] = await Promise.all([
      supabase
        .from('drawings')
        .select('id, project_id, origin_set, origin_lat, origin_lng, sheet_extent_m, north_offset_deg, sheet_number')
        .eq('project_id', projectId)
        .eq('origin_set', true),
      supabase
        .from('crew_checkins')
        .select('id, crew_id, checked_in_at, checked_out_at, disputed_at')
        .eq('project_id', projectId)
        .lte('checked_in_at', dayEnd.toISOString())
        .or(`checked_out_at.is.null,checked_out_at.gte.${dayStart.toISOString()}`),
      supabase
        .from('crews')
        .select('id, trade')
        .eq('project_id', projectId),
      supabase
        .from('daily_logs')
        .select('id, log_date')
        .eq('project_id', projectId)
        .eq('log_date', media.takenAt.slice(0, 10))
        .maybeSingle(),
      // punch_items don't carry geo today; we feed an empty list and let the
      // engine's radius filter no-op. The migration will add geo columns later.
      Promise.resolve({ data: [] as Array<{ id: string; geo_lat: number | null; geo_lng: number | null; status: string | null }>, error: null }),
      supabase
        .from('rfis')
        .select('id, drawing_reference, status')
        .eq('project_id', projectId)
        .in('status', ['open', 'under_review']),
    ])

    if (drawingsRes.error) throw drawingsRes.error
    if (checkinsRes.error) throw checkinsRes.error
    if (crewsRes.error) throw crewsRes.error
    if (dailyLogRes.error && dailyLogRes.error.code !== 'PGRST116') throw dailyLogRes.error
    if (rfiRes.error) throw rfiRes.error

    const crewsById = new Map<string, { id: string; trade: string | null }>()
    for (const c of crewsRes.data ?? []) crewsById.set(c.id, c)

    const links = runPhotoLinker(media, {
      drawings: drawingsRes.data ?? [],
      checkins: checkinsRes.data ?? [],
      crewsById,
      todaysDailyLog: dailyLogRes.data ?? null,
      openPunchItems: punchRes.data,
      openRfis: rfiRes.data ?? [],
    })

    // ── 4. Persist ──────────────────────────────────────────
    const result = await writeLinks(supabase, media, links)

    return new Response(
      JSON.stringify({
        media_id: media.mediaId,
        proposed: links.length,
        written: result.written,
        skipped_user_unlinked: result.skipped,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'content-type': 'application/json' },
      },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
