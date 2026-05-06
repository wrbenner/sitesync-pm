// transcribe-walkthrough — purpose-built audio transcription for the
// Walk-Through capture flow. Distinct from `transcribe-audio` because:
//   • accepts multipart/form-data with the audio blob in-band (no
//     Storage round-trip needed when called from the field), or
//     `audio_storage_path` for already-uploaded blobs
//   • returns a synthesized confidence score (Whisper doesn't expose
//     one natively; we average per-segment avg_logprob and squash
//     into 0..1)
//   • returns a structured 503 (`{ error: 'transcription_unavailable' }`)
//     when OPENAI_API_KEY is missing so the UI can fall back to
//     manual entry
//
// Provider: OpenAI Whisper (whisper-1). Cost ~$0.006/min. See
// docs/WALKTHROUGH_MODE.md for full cost analysis.

import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_MODEL = 'whisper-1'

interface VerboseSegment {
  avg_logprob?: number
  no_speech_prob?: number
}

interface VerboseResponse {
  text?: string
  duration?: number
  language?: string
  segments?: VerboseSegment[]
}

/**
 * Squash whisper's avg_logprob (typically -2 .. 0) into a 0..1
 * confidence band. Handful of heuristics calibrated against the
 * 200-line punch-list corpus we used to validate the classifier.
 */
function synthesizeConfidence(segments: VerboseSegment[] | undefined): number {
  if (!segments || segments.length === 0) return 0.7
  const avg = segments.reduce((sum, s) => sum + (s.avg_logprob ?? -1), 0) / segments.length
  // avg_logprob of  0   → 1.0
  //                -0.5 → 0.85
  //                -1.0 → 0.7
  //                -2.0 → 0.4
  const conf = Math.max(0, Math.min(1, 1 + avg * 0.3))
  return Math.round(conf * 1000) / 1000
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      // Surface a structured 503 so the UI can fall back gracefully.
      return new Response(
        JSON.stringify({ error: 'transcription_unavailable' }),
        { status: 503, headers },
      )
    }

    const { user, supabase } = await authenticateRequest(req)
    void user // membership check happens via storage RLS or the parse endpoint

    const ctype = req.headers.get('Content-Type') ?? ''
    let audioBlob: Blob | null = null

    if (ctype.includes('multipart/form-data')) {
      const form = await req.formData()
      const f = form.get('audio')
      if (!(f instanceof File) && !(f instanceof Blob)) {
        throw new HttpError(400, 'audio field is required')
      }
      audioBlob = f as Blob
    } else if (ctype.includes('application/json')) {
      const body = await req.json() as { audio_storage_path?: string }
      if (!body.audio_storage_path) throw new HttpError(400, 'audio_storage_path required')
      const { data: signed, error: signErr } = await supabase.storage
        .from('walkthrough-audio')
        .createSignedUrl(body.audio_storage_path, 60)
      if (signErr || !signed?.signedUrl) {
        throw new HttpError(404, 'Could not access audio in storage')
      }
      const audioRes = await fetch(signed.signedUrl)
      if (!audioRes.ok) throw new HttpError(502, 'Audio fetch failed')
      audioBlob = await audioRes.blob()
    } else {
      throw new HttpError(415, 'Unsupported Content-Type — use multipart/form-data or application/json')
    }

    if (!audioBlob) throw new HttpError(400, 'No audio supplied')
    if (audioBlob.size > 25 * 1024 * 1024) {
      throw new HttpError(413, 'Audio exceeds 25MB Whisper limit')
    }

    const form = new FormData()
    form.append('file', audioBlob, 'walkthrough-capture.webm')
    form.append('model', WHISPER_MODEL)
    form.append('response_format', 'verbose_json')

    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new HttpError(502, `Whisper failed: ${errText.slice(0, 200)}`)
    }
    const data = await res.json() as VerboseResponse

    return new Response(
      JSON.stringify({
        transcript: data.text ?? '',
        confidence: synthesizeConfidence(data.segments),
        duration: data.duration ?? null,
        language: data.language ?? null,
      }),
      { status: 200, headers },
    )
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
