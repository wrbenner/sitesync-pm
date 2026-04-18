// ── generate-overlap Edge Function ────────────────────────────
// Phase 3, Module 4 Step 4.2: Generates a visual overlay image showing
// edge alignment between arch & struct drawings. Adapted from:
//   services/edge-overlap-service/app.py and helper_functions
//
// Strategy: Render an SVG overlay that composites the arch drawing image
// at the base, draws the architectural edges in one color, structural
// edges in another, and highlights overlaps. Upload the SVG to Supabase
// Storage under `overlap-images/` and write the public URL back to
// drawing_pairs.overlap_image_url.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

interface GenerateOverlapRequest {
  pair_id: string
  arch_image_url?: string | null
  struct_image_url?: string | null
  width?: number
  height?: number
}

interface EdgeBox {
  x: number
  y: number
  w: number
  h: number
  confidence?: number
  label?: string | null
}

interface DetectedEdges {
  arch?: EdgeBox[]
  struct?: EdgeBox[]
  metadata?: Record<string, unknown>
}

const ARCH_COLOR = '#3B82F6'    // blue
const STRUCT_COLOR = '#E74C3C'  // red
const OVERLAP_COLOR = '#10B981' // green
const OVERLAP_IOU_THRESHOLD = 0.3

function iou(a: EdgeBox, b: EdgeBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  if (x2 <= x1 || y2 <= y1) return 0
  const inter = (x2 - x1) * (y2 - y1)
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

function computeOverlaps(arch: EdgeBox[], struct: EdgeBox[]): EdgeBox[] {
  const result: EdgeBox[] = []
  for (const a of arch) {
    for (const s of struct) {
      if (iou(a, s) >= OVERLAP_IOU_THRESHOLD) {
        const x = Math.max(a.x, s.x)
        const y = Math.max(a.y, s.y)
        const x2 = Math.min(a.x + a.w, s.x + s.w)
        const y2 = Math.min(a.y + a.h, s.y + s.h)
        result.push({ x, y, w: x2 - x, h: y2 - y })
      }
    }
  }
  return result
}

function renderSvgOverlay(
  width: number,
  height: number,
  archUrl: string,
  structUrl: string,
  arch: EdgeBox[],
  struct: EdgeBox[],
  overlaps: EdgeBox[],
): string {
  const rects = (boxes: EdgeBox[], color: string, opacity = 0.4) =>
    boxes
      .map(
        (b) =>
          `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-width="2"/>`,
      )
      .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style><![CDATA[
      .legend-text { font: bold 18px sans-serif; fill: #111; }
    ]]></style>
  </defs>
  <image href="${archUrl}" x="0" y="0" width="${width}" height="${height}" opacity="0.55"/>
  <image href="${structUrl}" x="0" y="0" width="${width}" height="${height}" opacity="0.35" style="mix-blend-mode:multiply"/>
  <g id="arch-edges">${rects(arch, ARCH_COLOR, 0.25)}</g>
  <g id="struct-edges">${rects(struct, STRUCT_COLOR, 0.25)}</g>
  <g id="overlaps">${rects(overlaps, OVERLAP_COLOR, 0.45)}</g>
  <g id="legend" transform="translate(20, 20)">
    <rect x="0" y="0" width="220" height="90" fill="white" fill-opacity="0.9" stroke="#333"/>
    <rect x="10" y="14" width="16" height="16" fill="${ARCH_COLOR}"/>
    <text x="32" y="27" class="legend-text">Architectural</text>
    <rect x="10" y="38" width="16" height="16" fill="${STRUCT_COLOR}"/>
    <text x="32" y="51" class="legend-text">Structural</text>
    <rect x="10" y="62" width="16" height="16" fill="${OVERLAP_COLOR}"/>
    <text x="32" y="75" class="legend-text">Aligned</text>
  </g>
</svg>`
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GenerateOverlapRequest>(req)
    const pairId = requireUuid(body.pair_id, 'pair_id')

    const { data: pair, error: pairErr } = await supabase
      .from('drawing_pairs')
      .select('id, project_id, detected_edges, overlap_image_url')
      .eq('id', pairId)
      .single()

    if (pairErr || !pair) {
      throw new HttpError(404, `drawing_pair ${pairId} not found`)
    }

    await verifyProjectMembership(supabase, user.id, pair.project_id)

    const archUrl = (body.arch_image_url ?? '').trim()
    const structUrl = (body.struct_image_url ?? '').trim()
    if (!archUrl || !structUrl) {
      throw new HttpError(400, 'arch_image_url and struct_image_url are required')
    }

    const edges = (pair.detected_edges ?? { arch: [], struct: [] }) as DetectedEdges
    const archEdges = edges.arch ?? []
    const structEdges = edges.struct ?? []
    const overlaps = computeOverlaps(archEdges, structEdges)

    const width = Number(body.width ?? 1280)
    const height = Number(body.height ?? 960)
    const svg = renderSvgOverlay(width, height, archUrl, structUrl, archEdges, structEdges, overlaps)

    const fileName = `${pair.project_id}/overlap-${pairId}-${Date.now()}.svg`
    const uploadRes = await supabase.storage
      .from('drawings')
      .upload(fileName, new Blob([svg], { type: 'image/svg+xml' }), {
        upsert: true,
        contentType: 'image/svg+xml',
      })

    if (uploadRes.error) {
      throw new HttpError(
        500,
        `Failed to upload overlap SVG: ${uploadRes.error.message}`,
      )
    }

    const { data: publicUrlData } = supabase.storage.from('drawings').getPublicUrl(fileName)
    const overlapUrl = publicUrlData?.publicUrl ?? null

    const { error: updateErr } = await supabase
      .from('drawing_pairs')
      .update({
        overlap_image_url: overlapUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pairId)

    if (updateErr) {
      throw new HttpError(500, `Failed to persist overlap_image_url: ${updateErr.message}`)
    }

    return new Response(
      JSON.stringify({
        pair_id: pairId,
        overlap_image_url: overlapUrl,
        overlap_count: overlaps.length,
        arch_edge_count: archEdges.length,
        struct_edge_count: structEdges.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
