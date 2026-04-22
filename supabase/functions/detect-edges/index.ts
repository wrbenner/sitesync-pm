// ── detect-edges Edge Function ────────────────────────────────
// Phase 3, Module 4 Step 4.2: Runs the Roboflow edge-detection model
// against a drawing pair. Adapted from:
//   services/edge-detection-v2/helper_functions/ai_edge_detector.py
//   services/edge-detection-v2/app.py
// Persists edge coordinates into drawing_pairs.detected_edges and advances
// the pair.status through the pipeline.


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

interface DetectEdgesRequest {
  pair_id: string
  arch_image_url?: string | null
  struct_image_url?: string | null
}

interface RoboflowPrediction {
  x: number
  y: number
  width: number
  height: number
  confidence: number
  class?: string
}

interface RoboflowResponse {
  predictions?: RoboflowPrediction[]
  image?: { width?: number; height?: number }
}

const ROBOFLOW_BASE = 'https://detect.roboflow.com'
const DEFAULT_MODEL_ID = 'sitesync-v2-xdr4c/6'
const DEFAULT_CONFIDENCE = 0.4
const DEFAULT_OVERLAP = 0.3

async function callRoboflow(
  apiKey: string,
  modelId: string,
  imageUrl: string,
  confidence: number,
  overlap: number,
): Promise<RoboflowResponse> {
  const endpoint = `${ROBOFLOW_BASE}/${modelId}?api_key=${encodeURIComponent(
    apiKey,
  )}&image=${encodeURIComponent(imageUrl)}&confidence=${Math.round(
    confidence * 100,
  )}&overlap=${Math.round(overlap * 100)}`

  const res = await fetch(endpoint, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text()
    throw new HttpError(502, `Roboflow error ${res.status}: ${text.slice(0, 300)}`)
  }
  return (await res.json()) as RoboflowResponse
}

function convertPredictions(resp: RoboflowResponse) {
  const preds = resp.predictions ?? []
  return preds.map((p) => ({
    // Roboflow returns center-based coords; convert to top-left for clients
    x: Math.round(p.x - p.width / 2),
    y: Math.round(p.y - p.height / 2),
    w: Math.round(p.width),
    h: Math.round(p.height),
    confidence: Number(p.confidence.toFixed(4)),
    label: p.class ?? null,
  }))
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<DetectEdgesRequest>(req)
    const pairId = requireUuid(body.pair_id, 'pair_id')

    const { data: pair, error: fetchErr } = await supabase
      .from('drawing_pairs')
      .select(
        'id, project_id, arch_drawing_id, struct_drawing_id, status, detected_edges',
      )
      .eq('id', pairId)
      .single()

    if (fetchErr || !pair) {
      throw new HttpError(404, `drawing_pair ${pairId} not found`)
    }

    await verifyProjectMembership(supabase, user.id, pair.project_id)

    const archUrl = (body.arch_image_url ?? '').trim()
    const structUrl = (body.struct_image_url ?? '').trim()
    if (!archUrl || !structUrl) {
      throw new HttpError(400, 'arch_image_url and struct_image_url are required')
    }
    if (!/^https?:\/\//i.test(archUrl) || !/^https?:\/\//i.test(structUrl)) {
      throw new HttpError(400, 'image URLs must be http(s)')
    }

    const apiKey = Deno.env.get('ROBOFLOW_API_KEY')
    if (!apiKey) {
      throw new HttpError(500, 'ROBOFLOW_API_KEY not configured')
    }
    const modelId = Deno.env.get('ROBOFLOW_MODEL_ID') ?? DEFAULT_MODEL_ID
    const confidence = Number(Deno.env.get('AI_CONFIDENCE') ?? DEFAULT_CONFIDENCE)
    const overlap = Number(Deno.env.get('AI_OVERLAP') ?? DEFAULT_OVERLAP)

    // Mark pair as detecting_edges.
    await supabase
      .from('drawing_pairs')
      .update({ status: 'detecting_edges', updated_at: new Date().toISOString() })
      .eq('id', pairId)

    try {
      const [archResp, structResp] = await Promise.all([
        callRoboflow(apiKey, modelId, archUrl, confidence, overlap),
        callRoboflow(apiKey, modelId, structUrl, confidence, overlap),
      ])

      const detectedEdges = {
        arch: convertPredictions(archResp),
        struct: convertPredictions(structResp),
        metadata: {
          model_id: modelId,
          confidence_threshold: confidence,
          overlap_threshold: overlap,
          arch_image: { width: archResp.image?.width ?? null, height: archResp.image?.height ?? null },
          struct_image: { width: structResp.image?.width ?? null, height: structResp.image?.height ?? null },
          detected_at: new Date().toISOString(),
        },
      }

      const { error: updateErr } = await supabase
        .from('drawing_pairs')
        .update({
          detected_edges: detectedEdges,
          status: 'edges_detected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pairId)

      if (updateErr) {
        throw new HttpError(500, `Failed to persist edges: ${updateErr.message}`)
      }

      return new Response(
        JSON.stringify({
          pair_id: pairId,
          arch_edges: detectedEdges.arch.length,
          struct_edges: detectedEdges.struct.length,
          status: 'edges_detected',
          detected_edges: detectedEdges,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    } catch (err) {
      await supabase
        .from('drawing_pairs')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', pairId)
      throw err
    }
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
