// transcribe-audio — Transcribe an uploaded audio blob via OpenAI Whisper.
// Accepts either { audio_url } pointing to a file in Storage, or a direct multipart upload.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-1'

interface TranscribeBody {
  project_id?: string
  audio_url?: string
  language?: string
}

async function fetchAudio(url: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new HttpError(400, `Audio fetch failed (${res.status})`)
  const blob = await res.blob()
  const ct = res.headers.get('content-type') || 'audio/webm'
  let ext = 'webm'
  if (ct.includes('mp4') || ct.includes('m4a')) ext = 'm4a'
  else if (ct.includes('mpeg') || ct.includes('mp3')) ext = 'mp3'
  else if (ct.includes('wav')) ext = 'wav'
  else if (ct.includes('ogg')) ext = 'ogg'
  return { blob, filename: `audio.${ext}` }
}

serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<TranscribeBody>(req)
    const projectId = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, projectId)

    if (!body.audio_url) throw new HttpError(400, 'audio_url is required')

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY not configured')

    const { blob, filename } = await fetchAudio(body.audio_url)
    if (blob.size > 25 * 1024 * 1024) {
      throw new HttpError(413, 'Audio exceeds 25MB Whisper limit')
    }

    const form = new FormData()
    form.append('file', blob, filename)
    form.append('model', WHISPER_MODEL)
    if (body.language) form.append('language', body.language)
    form.append('response_format', 'verbose_json')

    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      const err = await res.text()
      throw new HttpError(502, `Whisper failed: ${err.slice(0, 200)}`)
    }
    const data = await res.json()

    return new Response(
      JSON.stringify({
        transcript: data.text || '',
        duration: data.duration || null,
        language: data.language || null,
      }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
