// ── generate-revision-diff Edge Function ──────────────────────
// Phase 2, Module 5: Adapts overlap_generator.py (image_separator.py) from the
// overlap-image-generation-v2 microservice. Parses architectural scale notation
// (e.g. 1/8" = 1'-0"), computes the scaling factor between two revisions, and
// returns a structured diff description that the client can render via the
// existing RevisionOverlay component.

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

interface ScaleParseResult {
  scale_ratio: number | null
  scale_text: string
  confidence: number
  method: 'backend_provided' | 'number_literal' | 'default_fallback' | 'error_fallback'
}

interface RevisionDiffRequest {
  project_id: string
  drawing_id: string
  old_revision_url: string
  new_revision_url: string
  old_scale?: string | number | null
  new_scale?: string | number | null
  old_label?: string
  new_label?: string
}

// ── parse_scale_info (adapted from image_separator.py) ────────
// Accepts string (e.g. '1/8" = 1\'-0"'), number, or null/undefined.
function parseScaleText(text: string): number | null {
  try {
    // Regex for patterns like: 1/16" = 1'-0"  OR  1" = 20'-5"  OR  1" = 20'
    // Allow variations in inch marks and hyphenation.
    const pattern = /([\d\s/]+)"\s*=\s*(\d+)'\s*-?\s*(\d*)/
    const match = text.replace(/\u2019/g, "'").match(pattern)
    if (!match) return null

    const drawingValRaw = match[1].trim()
    const realFeetRaw = match[2]
    const realInchesRaw = match[3] || '0'

    let drawingVal: number
    if (drawingValRaw.includes('/')) {
      const [num, den] = drawingValRaw.split('/')
      const numFloat = parseFloat(num)
      const denFloat = parseFloat(den)
      if (!Number.isFinite(numFloat) || !Number.isFinite(denFloat) || denFloat === 0) return null
      drawingVal = numFloat / denFloat
    } else {
      drawingVal = parseFloat(drawingValRaw)
    }

    const realFeet = parseFloat(realFeetRaw)
    const realInches = parseFloat(realInchesRaw)

    if (!Number.isFinite(drawingVal) || drawingVal === 0) return null
    if (!Number.isFinite(realFeet)) return null

    const totalRealInches = realFeet * 12 + (Number.isFinite(realInches) ? realInches : 0)
    const scaleRatio = totalRealInches / drawingVal
    return Number.isFinite(scaleRatio) ? scaleRatio : null
  } catch {
    return null
  }
}

function parseScaleInfo(input: string | number | null | undefined): ScaleParseResult {
  if (input === null || input === undefined || input === '') {
    return { scale_ratio: null, scale_text: '', confidence: 0, method: 'default_fallback' }
  }
  if (typeof input === 'number' && Number.isFinite(input)) {
    return {
      scale_ratio: input,
      scale_text: String(input),
      confidence: 1,
      method: 'number_literal',
    }
  }
  if (typeof input === 'string') {
    const ratio = parseScaleText(input)
    return {
      scale_ratio: ratio,
      scale_text: input,
      confidence: ratio !== null ? 1 : 0,
      method: ratio !== null ? 'backend_provided' : 'error_fallback',
    }
  }
  return { scale_ratio: null, scale_text: '', confidence: 0, method: 'error_fallback' }
}

// ── Scale correction ─────────────────────────────────────────
function computeScaleCorrection(
  oldInfo: ScaleParseResult,
  newInfo: ScaleParseResult,
): { scaling_factor: number; notes: string } {
  const oldRatio = oldInfo.scale_ratio
  const newRatio = newInfo.scale_ratio

  if (oldRatio === null || newRatio === null) {
    return {
      scaling_factor: 1,
      notes: 'Scale information unavailable for one or both revisions; no correction applied.',
    }
  }
  if (newRatio === 0) {
    return {
      scaling_factor: 1,
      notes: 'New revision scale ratio is zero; no correction applied.',
    }
  }

  // Factor to apply to the NEW revision so it matches the OLD revision's coordinate system.
  const factor = oldRatio / newRatio
  if (!Number.isFinite(factor) || factor <= 0) {
    return { scaling_factor: 1, notes: 'Computed factor was invalid; no correction applied.' }
  }

  const diffPct = Math.abs(factor - 1) * 100
  const notes = diffPct < 0.5
    ? 'Revisions share the same scale; no correction required.'
    : `Scale difference detected (${diffPct.toFixed(2)}%). Applying factor ${factor.toFixed(4)} to new revision.`

  return { scaling_factor: factor, notes }
}

// ── Handler ──────────────────────────────────────────────────
serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<RevisionDiffRequest>(req)

    const projectId = requireUuid(body.project_id, 'project_id')
    const drawingId = requireUuid(body.drawing_id, 'drawing_id')
    const oldUrl = String(body.old_revision_url ?? '').trim()
    const newUrl = String(body.new_revision_url ?? '').trim()

    if (!oldUrl || !newUrl) {
      throw new HttpError(400, 'old_revision_url and new_revision_url are required')
    }

    await verifyProjectMembership(supabase, user.id, projectId)

    const oldScale = parseScaleInfo(body.old_scale ?? null)
    const newScale = parseScaleInfo(body.new_scale ?? null)
    const correction = computeScaleCorrection(oldScale, newScale)

    const oldLabel = body.old_label?.trim() || 'Previous revision'
    const newLabel = body.new_label?.trim() || 'Current revision'

    // Return the diff description. The actual overlay rendering uses the existing
    // RevisionOverlay component (cyan = old, red = new, blend mode: screen).
    const diff = {
      drawing_id: drawingId,
      project_id: projectId,
      old_revision: {
        url: oldUrl,
        label: oldLabel,
        scale: oldScale,
      },
      new_revision: {
        url: newUrl,
        label: newLabel,
        scale: newScale,
      },
      scale_correction: correction,
      blend_mode: 'screen',
      colors: {
        old: '#00BCD4', // cyan — matches vizColors.revision guidance
        new: '#F44336', // red  — matches vizColors.annotation
      },
      threshold: 200,
      web_scale_factor: 0.75,
      notes: correction.notes,
    }

    return new Response(JSON.stringify(diff), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
