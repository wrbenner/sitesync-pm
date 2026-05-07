// transcribe-voice — base64 audio → text via OpenAI Whisper
//
// P2b deliverable #4 ships this so the FAB voice path can complete
// end-to-end. The body is intentionally small: validate auth + project
// scope, decode the base64, POST to Whisper, return the transcript.
//
// Errors fail loud — no silent fallbacks. The FAB's state machine
// surfaces the message to the user.

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

interface TranscribeRequest {
  project_id: string
  /** Base64-encoded audio (any container Whisper accepts: webm, m4a, mp3, wav). */
  audio_base64: string
  /** Optional MIME hint; defaults to audio/webm. */
  mime_type?: string
}

const MAX_BASE64_BYTES = 25 * 1024 * 1024 // Whisper's 25 MB cap, raw byte budget

Deno.serve(async (req) => {
  const corsCheck = handleCors(req)
  if (corsCheck) return corsCheck
  const corsHeaders = getCorsHeaders(req)

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<TranscribeRequest>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    if (!body.audio_base64 || typeof body.audio_base64 !== 'string') {
      throw new HttpError(400, 'audio_base64 is required', 'validation_error')
    }
    if (body.audio_base64.length * 0.75 > MAX_BASE64_BYTES) {
      throw new HttpError(413, 'audio too large (max 25 MB)', 'too_large')
    }
    await verifyProjectMembership(supabase, user.id, projectId)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY not configured', 'config_error')

    // Decode base64 → bytes.
    const bin = atob(body.audio_base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const mime = body.mime_type ?? 'audio/webm'

    const form = new FormData()
    form.append('file', new Blob([bytes], { type: mime }), 'voice.webm')
    form.append('model', 'whisper-1')
    form.append('response_format', 'json')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new HttpError(res.status, `whisper error ${res.status}: ${errText.slice(0, 300)}`, 'whisper_error')
    }
    const data = (await res.json()) as { text?: string }
    return new Response(
      JSON.stringify({ transcript: (data.text ?? '').trim() }),
      { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
