/**
 * Voice parser — deterministic transcript → ParsedCapture, plus a thin
 * client wrapper around the `transcribe-walkthrough` edge function.
 *
 * Two functions exported:
 *   • parseTranscriptToCapture — pure; uses severityClassifier + a small
 *     trade-keyword bank. Produces a usable ParsedCapture without ever
 *     calling the LLM. The edge function `parse-walkthrough-capture` will
 *     re-do the parse with Sonnet 4.6 server-side; this function is the
 *     fallback when the LLM is unavailable, *and* the optimistic UI value
 *     so the PM sees something the moment Whisper returns.
 *
 *   • transcribeAudio — calls the supabase edge function. Documented here:
 *     provider is OpenAI Whisper (whisper-1) at $0.006/min, chosen because
 *     it handles construction jargon (rebar, shoring, soffit) better than
 *     mainstream alternatives we tested. Cost analysis lives in
 *     docs/WALKTHROUGH_MODE.md.
 *
 * Keep parseTranscriptToCapture pure (no I/O, no Supabase) — it's tested
 * in __tests__/voiceParser.test.ts and runs in browser, server, and tests.
 */

import { classifySeverity } from './severityClassifier'
import type { ParsedCapture } from '../../types/walkthrough'
import { supabase } from '../supabase'

// ── Trade keyword bank ─────────────────────────────────────────
//
// Lowercase trade keys map to the canonical trade label we want stored
// in the parsed capture. Multi-word keys are matched as substrings;
// single words use word boundaries.

const TRADE_BANK: ReadonlyArray<{ trade: string; keywords: ReadonlyArray<string> }> = [
  { trade: 'electrical', keywords: ['electrical', 'electric', 'outlet', 'breaker', 'wiring', 'fixture', 'switch'] },
  { trade: 'plumbing',   keywords: ['plumbing', 'pipe', 'leak', 'leaking', 'faucet', 'toilet', 'drain', 'water'] },
  { trade: 'mech',       keywords: ['mechanical', 'hvac', 'duct', 'ductwork', 'thermostat', 'unit', 'vent'] },
  { trade: 'mep',        keywords: ['mep'] },
  { trade: 'finishes',   keywords: ['paint', 'painted', 'drywall', 'baseboard', 'trim', 'stained', 'scratched', 'flooring', 'tile'] },
  { trade: 'structural', keywords: ['structural', 'beam', 'column', 'foundation', 'framing'] },
  { trade: 'casework',   keywords: ['casework', 'cabinet', 'cabinetry', 'millwork'] },
  { trade: 'landscape',  keywords: ['landscape', 'landscaping', 'planter', 'sod', 'irrigation'] },
]

// Phrases that mean "ignore the previous capture" / "amend the previous one".
const MODIFY_PREVIOUS_PHRASES: ReadonlyArray<string> = [
  "actually that one's",
  'actually that ones',
  'scratch that',
  'ignore the last',
  "don't include the previous",
  'do not include the previous',
  'never mind the last',
  'ignore that last one',
  'cancel the last one',
]

// ── parseTranscriptToCapture ───────────────────────────────────

export interface ParseTranscriptOptions {
  /** Useful for the modify-previous case: lets us reference the prior parsed capture. */
  previousCapture?: ParsedCapture
}

export interface ParseTranscriptResult {
  result: ParsedCapture
  /** True if the transcript wants to amend / discard the previous capture. */
  modify_previous: boolean
}

/**
 * Pure parser. Given a Whisper transcript, return our best-effort
 * ParsedCapture *without* hitting the LLM. The server-side edge
 * function may overwrite this with a richer Sonnet pass.
 */
export function parseTranscriptToCapture(
  transcript: string,
  opts: ParseTranscriptOptions = {},
): ParseTranscriptResult {
  const text = (transcript ?? '').trim()
  const lower = text.toLowerCase()

  const modify_previous = MODIFY_PREVIOUS_PHRASES.some((p) => lower.includes(p))

  // If the speaker is amending the previous capture, we don't try to
  // extract a fresh title — instead we surface the previous capture's
  // title with a "(amended)" suffix so the PM sees the link clearly.
  if (modify_previous && opts.previousCapture) {
    return {
      result: {
        ...opts.previousCapture,
        title: `${opts.previousCapture.title} (amended)`,
        description: text || opts.previousCapture.description,
        modify_previous: true,
      },
      modify_previous: true,
    }
  }

  const trade = inferTrade(lower)
  const sev = classifySeverity(text)
  const title = buildTitle(text)
  const location_hint = inferLocationHint(text)

  return {
    result: {
      title,
      description: text,
      trade,
      severity: sev.severity,
      location_hint,
      modify_previous,
    },
    modify_previous,
  }
}

// ── transcribeAudio ───────────────────────────────────────────

export interface TranscribeAudioOptions {
  /** If provided, used as the threshold below which the UI marks the transcript "low confidence". */
  confidenceThreshold?: number
}

export interface TranscribeAudioResult {
  transcript: string
  confidence: number
}

/**
 * Upload an audio blob to the `transcribe-walkthrough` edge function and
 * return the Whisper transcript + a synthesized confidence score.
 *
 * The edge function prefers OpenAI Whisper (whisper-1). If the OPENAI_API_KEY
 * is missing, the function returns 503 with body { error: 'transcription_unavailable' };
 * callers should surface a "manual entry" UX in that case.
 */
export async function transcribeAudio(
  audio: Blob,
  _opts: TranscribeAudioOptions = {},
): Promise<TranscribeAudioResult> {
  const form = new FormData()
  form.append('audio', audio, 'walkthrough-capture.webm')

  // We could also use the supabase JS client's functions.invoke, but
  // multipart bodies need the raw fetch — invoke serializes JSON.
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseUrl = (supabase as any).functionsUrl
    || `${(supabase as any).supabaseUrl}/functions/v1`

  const res = await fetch(`${baseUrl}/transcribe-walkthrough`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  })

  if (res.status === 503) {
    // Transcription service unavailable — caller should fall back to manual entry.
    throw new Error('transcription_unavailable')
  }
  if (!res.ok) {
    throw new Error(`Transcription failed (${res.status})`)
  }
  const json = (await res.json()) as { transcript?: string; confidence?: number }
  return {
    transcript: json.transcript ?? '',
    confidence: typeof json.confidence === 'number' ? json.confidence : 0.7,
  }
}

// ── Internals ──────────────────────────────────────────────────

/**
 * First sentence trimmed to ~80 chars, with leading punctuation cleaned up.
 * Builds a one-liner suitable for the PM's review card.
 */
function buildTitle(text: string): string {
  if (!text) return 'Untitled capture'
  const firstSentence = text.split(/[.!?]\s/)[0] ?? text
  const trimmed = firstSentence.trim()
  if (trimmed.length <= 80) return trimmed
  return trimmed.slice(0, 77).trimEnd() + '…'
}

function inferTrade(lower: string): string | undefined {
  for (const bank of TRADE_BANK) {
    for (const kw of bank.keywords) {
      if (kw.includes(' ') || kw.includes('-')) {
        if (lower.includes(kw)) return bank.trade
      } else {
        const re = new RegExp(`\\b${kw}\\b`)
        if (re.test(lower)) return bank.trade
      }
    }
  }
  return undefined
}

/**
 * Lightweight location hint extractor. Looks for "in the X" / "near the X"
 * patterns (X up to 4 words). This is intentionally crude — Sonnet 4.6
 * does the real extraction server-side.
 */
function inferLocationHint(text: string): string | undefined {
  const re = /(?:in the|near the|at the|by the)\s+([A-Za-z][A-Za-z0-9 ]{2,40})/i
  const m = text.match(re)
  if (!m) return undefined
  return m[1].trim().replace(/[.,;:]+$/, '')
}
