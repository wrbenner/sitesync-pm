// =============================================================================
// Linkage Engine — orchestrator
// =============================================================================
// Public API:
//
//   const links = await runPhotoLinker(media, ctx)
//   await writeLinks(supabase, media, links)
//
// The engine is split intentionally: `runPhotoLinker` is pure — it takes the
// photo + a context bag of pre-fetched rows and returns the proposed edges.
// `writeLinks` is the only side-effecting half. This split lets the edge
// function batch IO once per photo, and lets us test the resolution rules
// without a database.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { haversineMeters } from './geo'
import { resolveDrawingLinks, type DrawingRow } from './drawingPinResolver'
import { resolveSubLinks, type CrewCheckinRow, type CrewRow } from './subResolver'
import type { EntityLink, MediaInput } from './types'

const PUNCH_RADIUS_M = 5

interface PunchItemRow {
  id: string
  /** Stored as text 'lat,lng' or null. Kept narrow so the engine doesn't
   *  depend on a particular row shape — the edge function passes only what
   *  the resolver reads. */
  geo_lat: number | null
  geo_lng: number | null
  status: string | null
}

interface DailyLogRow {
  id: string
  log_date: string
}

interface RfiRow {
  id: string
  drawing_reference: string | null
}

export interface LinkerContext {
  drawings: DrawingRow[]
  checkins: CrewCheckinRow[]
  crewsById: Map<string, CrewRow>
  /** Today's daily log for the project (or null if none yet). */
  todaysDailyLog: DailyLogRow | null
  /** Open punch items in the project. The resolver applies the radius filter. */
  openPunchItems: PunchItemRow[]
  /** Open RFIs whose drawing_reference mentions the resolved drawing's sheet number. */
  openRfis: RfiRow[]
}

function resolvePunchLinks(media: MediaInput, items: PunchItemRow[]): EntityLink[] {
  if (media.lat == null || media.lng == null) return []
  const links: EntityLink[] = []
  for (const p of items) {
    if (p.geo_lat == null || p.geo_lng == null) continue
    const d = haversineMeters(media.lat, media.lng, p.geo_lat, p.geo_lng)
    if (d > PUNCH_RADIUS_M) continue
    links.push({
      entityType: 'punch_item',
      entityId: p.id,
      confidence: d <= 2 ? 'high' : 'medium',
      source: 'auto',
      notes: `within ${d.toFixed(1)}m of punch item`,
    })
  }
  return links
}

function resolveDailyLogLink(media: MediaInput, log: DailyLogRow | null): EntityLink[] {
  if (!log) return []
  const photoDay = new Date(media.takenAt).toISOString().slice(0, 10)
  if (photoDay !== log.log_date) return []
  return [{
    entityType: 'daily_log',
    entityId: log.id,
    confidence: 'high',
    source: 'auto',
    notes: `same-day daily log (${log.log_date})`,
  }]
}

function resolveRfiLinks(
  drawingLinks: EntityLink[],
  drawingsById: Map<string, DrawingRow>,
  rfis: RfiRow[],
  drawingsBySheetNum: Map<string, DrawingRow>,
): EntityLink[] {
  if (drawingLinks.length === 0) return []
  const linkedSheetNums = new Set<string>()
  for (const dl of drawingLinks) {
    const d = drawingsById.get(dl.entityId)
    if (d && (d as DrawingRow & { sheet_number?: string | null }).sheet_number) {
      linkedSheetNums.add(((d as DrawingRow & { sheet_number?: string }).sheet_number as string).toLowerCase())
    }
  }
  if (linkedSheetNums.size === 0) return []
  // Cross-link to drawings is implicit — pull in only RFIs whose drawing_reference
  // explicitly mentions one of the linked sheet numbers. This is a conservative
  // join: false positives in RFI cross-link are particularly bad in legal disputes.
  const out: EntityLink[] = []
  for (const r of rfis) {
    const ref = (r.drawing_reference ?? '').toLowerCase()
    let hit = false
    for (const sn of linkedSheetNums) {
      if (ref.includes(sn)) { hit = true; break }
    }
    if (hit) {
      out.push({
        entityType: 'rfi',
        entityId: r.id,
        confidence: 'medium',
        source: 'auto',
        notes: `RFI drawing_reference mentions linked sheet`,
      })
    }
  }
  // Hint to the linter that the unused parameter is intentional — kept in the
  // signature so future implementations can fall back to sheet-number lookup.
  void drawingsBySheetNum
  return out
}

/**
 * Pure: takes a photo + a context bag, returns the proposed edges.
 * No database access. Idempotent — same input always yields the same output.
 */
export function runPhotoLinker(media: MediaInput, ctx: LinkerContext): EntityLink[] {
  const drawingLinks = resolveDrawingLinks(media, { drawings: ctx.drawings })
  const subLinks = resolveSubLinks(media, {
    checkins: ctx.checkins,
    crewsById: ctx.crewsById,
  })
  const punchLinks = resolvePunchLinks(media, ctx.openPunchItems)
  const dailyLogLinks = resolveDailyLogLink(media, ctx.todaysDailyLog)

  const drawingsById = new Map<string, DrawingRow>(ctx.drawings.map(d => [d.id, d]))
  const drawingsBySheetNum = new Map<string, DrawingRow>()
  for (const d of ctx.drawings) {
    const sn = (d as DrawingRow & { sheet_number?: string | null }).sheet_number
    if (sn) drawingsBySheetNum.set(sn.toLowerCase(), d)
  }
  const rfiLinks = resolveRfiLinks(drawingLinks, drawingsById, ctx.openRfis, drawingsBySheetNum)

  return [...drawingLinks, ...subLinks, ...punchLinks, ...dailyLogLinks, ...rfiLinks]
}

/**
 * Persist proposed links. Uses the (media_id, media_type, entity_id, entity_type)
 * partial unique index to be naturally idempotent — re-running the linker
 * for the same photo never duplicates an active edge.
 *
 * deleted (soft-deleted) edges are preserved — if the user unlinked something,
 * we don't silently re-link it on a subsequent linker run.
 */
export async function writeLinks(
  supabase: SupabaseClient,
  media: MediaInput,
  links: EntityLink[],
): Promise<{ written: number; skipped: number }> {
  if (links.length === 0) return { written: 0, skipped: 0 }

  // Pull the soft-deleted edges so we don't re-create something the user
  // explicitly unlinked. The unique index only covers active edges.
  const { data: existingDeleted, error: lookupErr } = await supabase
    .from('media_links')
    .select('entity_id, entity_type')
    .eq('media_id', media.mediaId)
    .eq('media_type', media.mediaType)
    .not('deleted_at', 'is', null)

  if (lookupErr) throw lookupErr

  const blocked = new Set<string>(
    (existingDeleted ?? []).map(r => `${r.entity_type}:${r.entity_id}`),
  )

  const rows = links
    .filter(l => !blocked.has(`${l.entityType}:${l.entityId}`))
    .map(l => ({
      project_id: media.projectId,
      media_id: media.mediaId,
      media_type: media.mediaType,
      entity_id: l.entityId,
      entity_type: l.entityType,
      pin_x: l.pinX ?? null,
      pin_y: l.pinY ?? null,
      confidence: l.confidence,
      source: l.source,
      notes: l.notes ?? null,
    }))

  if (rows.length === 0) return { written: 0, skipped: links.length }

  const { error } = await supabase
    .from('media_links')
    .upsert(rows, {
      onConflict: 'media_id,media_type,entity_id,entity_type',
      ignoreDuplicates: true,
    })

  if (error) throw error

  return { written: rows.length, skipped: links.length - rows.length }
}
