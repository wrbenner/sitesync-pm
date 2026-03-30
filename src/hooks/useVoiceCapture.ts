// Voice-first field capture: real-time speech-to-text with AI extraction.
// Converts natural language field reports into structured daily log entries.
// Supports English and Spanish for US construction sites.

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useProjectId } from './useProjectId'
import { useAuth } from './useAuth'

// ── Types ────────────────────────────────────────────────

export interface VoiceCaptureEntry {
  category: string
  location?: string
  description: string
  progress?: number
  headcount?: number
  crew?: string
  weather?: { condition: string; temp_f: number }
  hours?: number
  equipment?: string
  safety?: string
  materials?: string
}

export interface VoiceCaptureResult {
  type: 'daily_log' | 'punch_item' | 'safety_observation' | 'general_note'
  entries: VoiceCaptureEntry[]
  rawTranscript: string
  confidence: number
}

export type VoiceCaptureState = 'idle' | 'recording' | 'transcribing' | 'extracting' | 'ready' | 'error'

// ── Supported Languages ──────────────────────────────────

export type VoiceLanguage = 'en-US' | 'es-MX' | 'es-US'

const LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  'en-US': 'English',
  'es-MX': 'Spanish (Mexico)',
  'es-US': 'Spanish (US)',
}

// ── AI Extraction Prompt ─────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a construction daily log parser. Extract structured data from voice transcripts.

RULES:
1. Identify the type: daily_log, punch_item, safety_observation, or general_note
2. Extract ALL mentioned information into structured entries
3. Each distinct topic becomes a separate entry
4. Normalize locations (e.g., "level 3" → "Level 3", "east wing" → "East Wing")
5. Convert percentage descriptions to numbers (e.g., "about eighty percent" → 80)
6. Identify crew names and headcounts
7. Extract weather information if mentioned
8. Flag any safety observations or violations
9. If the input is in Spanish, translate the output to English but keep proper nouns

Respond with ONLY valid JSON matching this schema:
{
  "type": "daily_log" | "punch_item" | "safety_observation" | "general_note",
  "entries": [
    {
      "category": "concrete | electrical | mechanical | plumbing | steel | carpentry | general_labor | equipment | weather | safety | materials | inspection",
      "location": "string or null",
      "description": "string",
      "progress": "number 0-100 or null",
      "headcount": "number or null",
      "crew": "string or null",
      "weather": { "condition": "string", "temp_f": number } | null,
      "hours": "number or null",
      "equipment": "string or null",
      "safety": "string or null",
      "materials": "string or null"
    }
  ],
  "confidence": 0.0-1.0
}`

// ── Hook ─────────────────────────────────────────────────

export function useVoiceCapture() {
  const projectId = useProjectId()
  const { user } = useAuth()

  const [state, setState] = useState<VoiceCaptureState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [result, setResult] = useState<VoiceCaptureResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [language, setLanguage] = useState<VoiceLanguage>('en-US')

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<number>(0)
  const fullTranscriptRef = useRef('')

  // ── Start Recording ────────────────────────────────

  const startRecording = useCallback(() => {
    setError(null)
    setResult(null)
    setTranscript('')
    setInterimTranscript('')
    setElapsed(0)
    fullTranscriptRef.current = ''

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      setState('error')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      if (final) {
        fullTranscriptRef.current += final
        setTranscript(fullTranscriptRef.current.trim())
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return // Normal timeout
      setError(`Speech recognition error: ${event.error}`)
      setState('error')
    }

    recognition.onend = () => {
      // Auto-restart if we're still in recording state (handles browser timeout)
      if (recognitionRef.current && state === 'recording') {
        try { recognition.start() } catch { /* already running */ }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('recording')

    // Timer
    timerRef.current = window.setInterval(() => {
      setElapsed((p) => p + 0.1)
    }, 100)
  }, [language, state])

  // ── Stop Recording & Extract ───────────────────────

  const stopRecording = useCallback(async () => {
    clearInterval(timerRef.current)

    if (recognitionRef.current) {
      recognitionRef.current.onend = null // Prevent auto-restart
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    const finalTranscript = fullTranscriptRef.current.trim()
    if (!finalTranscript) {
      setState('idle')
      return
    }

    setTranscript(finalTranscript)
    setInterimTranscript('')
    setState('extracting')

    try {
      const extracted = await extractStructuredData(finalTranscript)
      setResult({ ...extracted, rawTranscript: finalTranscript })
      setState('ready')
    } catch (err) {
      setError((err as Error).message)
      setState('error')
    }
  }, [])

  // ── Cancel Recording ───────────────────────────────

  const cancelRecording = useCallback(() => {
    clearInterval(timerRef.current)
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setState('idle')
    setTranscript('')
    setInterimTranscript('')
    setResult(null)
    setElapsed(0)
  }, [])

  // ── Reset ──────────────────────────────────────────

  const reset = useCallback(() => {
    cancelRecording()
    setError(null)
    setResult(null)
  }, [cancelRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      }
    }
  }, [])

  return {
    state,
    transcript,
    interimTranscript,
    result,
    error,
    elapsed,
    language,
    setLanguage,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    languageOptions: Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value: value as VoiceLanguage, label })),
  }
}

// ── AI Extraction ────────────────────────────────────────

async function extractStructuredData(transcript: string): Promise<Omit<VoiceCaptureResult, 'rawTranscript'>> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    // Fallback extraction without AI (basic keyword matching)
    return fallbackExtraction(transcript)
  }

  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: `Parse this field report transcript into structured data:\n\n"${transcript}"` },
      ],
      projectContext: {
        projectId: 'voice-extraction',
        page: 'field-capture',
        entityContext: EXTRACTION_SYSTEM_PROMPT,
      },
    }),
  })

  if (!response.ok) {
    throw new Error('AI extraction failed. Please try again.')
  }

  const data = await response.json()
  const content = data.content || ''

  // Try to parse JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        type: parsed.type || 'daily_log',
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      }
    } catch { /* fall through to fallback */ }
  }

  return fallbackExtraction(transcript)
}

// ── Fallback Extraction (no AI) ──────────────────────────

function fallbackExtraction(transcript: string): Omit<VoiceCaptureResult, 'rawTranscript'> {
  const lower = transcript.toLowerCase()
  const entries: VoiceCaptureEntry[] = []

  // Weather detection
  const weatherMatch = lower.match(/(?:weather|temp|temperature|degrees?|fahrenheit)\s*(?:was|is)?\s*(?:about|around)?\s*(\w+)?\s*(?:and|,)?\s*(\d+)\s*(?:degrees?)?/i)
  if (weatherMatch) {
    entries.push({
      category: 'weather',
      description: `Weather: ${weatherMatch[1] || 'clear'}, ${weatherMatch[2]}°F`,
      weather: { condition: weatherMatch[1] || 'clear', temp_f: parseInt(weatherMatch[2]) },
    })
  }

  // Worker/crew detection
  const crewMatch = lower.match(/(\d+)\s*(?:workers?|guys?|people|men)\s*(?:from|with)?\s*([\w\s]+?)(?:\s+on\s+site|\s*$|,)/i)
  if (crewMatch) {
    entries.push({
      category: 'general_labor',
      description: `${crewMatch[1]} workers from ${crewMatch[2].trim()}`,
      headcount: parseInt(crewMatch[1]),
      crew: crewMatch[2].trim(),
    })
  }

  // Progress detection
  const progressMatch = lower.match(/(?:completed?|done|finished|progress)\s*(?:about|around)?\s*(\d+)\s*(?:percent|%)/i)
  if (progressMatch) {
    entries.push({
      category: 'general_labor',
      description: `Work progress: ${progressMatch[1]}%`,
      progress: parseInt(progressMatch[1]),
    })
  }

  // If no entries detected, create a general note
  if (entries.length === 0) {
    entries.push({
      category: 'general_labor',
      description: transcript,
    })
  }

  return {
    type: 'daily_log',
    entries,
    confidence: 0.4,
  }
}
