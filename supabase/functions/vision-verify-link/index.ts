// =============================================================================
// vision-verify-link — sanity-check a photo's auto-link
// =============================================================================
// POST { media_link_id } → vision-model verifies the inferred link, writes
// verification metadata back onto the media_links row.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, parseJsonBody,
  HttpError, errorResponse, requireUuid, verifyProjectMembership,
} from '../shared/auth.ts'
import { routeAI } from '../shared/aiRouter.ts'
import { buildVerificationPrompt, classifyConfidence } from '../shared/platinumField/visionVerify.ts'

interface RequestBody { media_link_id: string }

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { user, supabaseUrl, serviceKey } = await authenticateRequest(req)
    const body = await parseJsonBody<RequestBody>(req)
    requireUuid(body.media_link_id, 'media_link_id')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: link, error } = await supabase
      .from('media_links')
      .select('id, project_id, media_id, media_type, entity_type, entity_id, notes')
      .eq('id', body.media_link_id)
      .maybeSingle()
    if (error) throw error
    if (!link) throw new HttpError(404, 'media link not found')
    await verifyProjectMembership(supabase, user.id, link.project_id)

    const { data: photo } = await supabase
      .from('photo_pins')
      .select('photo_url, caption')
      .eq('id', link.media_id)
      .maybeSingle()

    let inferredTrade: string | null = null
    if (link.entity_type === 'crew') {
      const { data: crew } = await supabase
        .from('crews')
        .select('trade')
        .eq('id', link.entity_id)
        .maybeSingle()
      inferredTrade = crew?.trade ?? null
    }

    const { system, user: prompt } = buildVerificationPrompt({
      photoUrl: photo?.photo_url ?? '',
      inferredTrade,
      inferredAreaDescription: link.notes ?? null,
      drawingContext: null,
    })

    const aiResp = await routeAI({
      task: 'vision',
      system,
      messages: [{ role: 'user', content: prompt }],
      images: photo?.photo_url ? [{ url: photo.photo_url, media_type: 'image/jpeg' }] : undefined,
      max_tokens: 250,
      temperature: 0.1,
    })

    let parsed: { verdict?: string; confidence?: number; reasoning?: string }
    try {
      parsed = JSON.parse(aiResp.content.trim().replace(/^```json|```$/g, '').trim())
    } catch {
      throw new HttpError(502, 'Vision model returned non-JSON')
    }

    const verdict = classifyConfidence(parsed.verdict ?? '', Number(parsed.confidence ?? 0))
    const newConfidence = verdict === 'verified' ? 'high'
      : verdict === 'mismatch' ? 'low'
      : 'medium'

    const { error: updErr } = await supabase
      .from('media_links')
      .update({
        confidence: newConfidence,
        notes: `${link.notes ?? ''} | vision: ${verdict} (${parsed.reasoning ?? ''})`.slice(0, 1000),
      } as never)
      .eq('id', link.id)
    if (updErr) throw updErr

    return new Response(
      JSON.stringify({ verdict, confidence: parsed.confidence, reasoning: parsed.reasoning, model: aiResp.model }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
