// ── Voice Processor ───────────────────────────────────────────
// Core audio engine for SiteSync voice capture:
// 1. MediaRecorder for audio capture + AnalyserNode for waveform
// 2. Web Speech API for real-time transcription
// 3. Language auto-detection (English / Spanish / mixed)
// 4. IndexedDB offline caching for audio blobs
// 5. AI structured extraction via edge function
//
// This is a library module, not a hook. Hooks compose on top of this.

import { supabase, isSupabaseConfigured } from './supabase'

// ── Types ─────────────────────────────────────────────────────

export type SupportedLanguage = 'en-US' | 'es-MX' | 'es-US' | 'auto'

export interface TranscriptWord {
  text: string
  isFinal: boolean
  timestamp: number
  language?: string
}

export interface WaveformData {
  frequencies: number[] // 0-255 values, 32 bands
  volume: number        // 0-1 normalized volume
}

export interface ExtractedEntity {
  type: 'daily_log' | 'rfi_draft' | 'punch_item' | 'safety_observation' | 'general_note'
  data: Record<string, unknown>
  confidence: number
  source: string // which part of transcript generated this
}

export interface ExtractionResult {
  entities: ExtractedEntity[]
  rawTranscript: string
  language: string
  processingTimeMs: number
}

export interface OfflineCapture {
  id: string
  audioBlob: Blob
  transcript: string
  language: string
  timestamp: number
  projectId: string
  gpsLatitude?: number
  gpsLongitude?: number
  photoDataUrl?: string
  synced: boolean
}

// ── Construction Vocabulary ───────────────────────────────────
// Common construction slang → formal terms for better extraction

export const CONSTRUCTION_VOCAB: Record<string, string> = {
  'mud': 'drywall compound',
  'j-box': 'junction box',
  'j box': 'junction box',
  'mudsill': 'foundation plate',
  'mud sill': 'foundation plate',
  'romex': 'NM-B electrical cable',
  'pex': 'PEX tubing',
  'rebar': 'reinforcing steel bar',
  'sheetrock': 'drywall',
  'tapcon': 'concrete screw anchor',
  'tee-bar': 'T-bar ceiling grid',
  'LVL': 'laminated veneer lumber',
  'glulam': 'glued laminated timber',
  'soffit': 'ceiling underside',
  'fascia': 'exterior trim board',
  'flashing': 'waterproofing membrane',
  'thinset': 'tile adhesive mortar',
  'greenboard': 'moisture resistant drywall',
  'hardy board': 'fiber cement board',
  'furring': 'furring strip',
}

// Spanish construction terms
export const SPANISH_CONSTRUCTION_VOCAB: Record<string, string> = {
  'vaciado': 'concrete pour',
  'colado': 'concrete pour',
  'cimbra': 'formwork',
  'varilla': 'rebar',
  'fierro': 'rebar/steel',
  'castillo': 'concrete column',
  'dala': 'concrete beam',
  'tabique': 'brick/block',
  'mezcla': 'mortar mix',
  'plomería': 'plumbing',
  'electricidad': 'electrical',
  'albañilería': 'masonry',
  'yeso': 'plaster/drywall compound',
  'pintura': 'painting',
  'soldadura': 'welding',
  'andamio': 'scaffold',
  'grúa': 'crane',
}

// ── Audio Recorder ────────────────────────────────────────────

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private animationFrame: number = 0
  private onWaveform: ((data: WaveformData) => void) | null = null

  async start(onWaveform?: (data: WaveformData) => void): Promise<void> {
    this.onWaveform = onWaveform || null
    this.chunks = []

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    })

    // Set up audio analysis for waveform
    this.audioContext = new AudioContext()
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 64
    this.analyser.smoothingTimeConstant = 0.7
    source.connect(this.analyser)

    // Start waveform polling
    if (this.onWaveform) {
      this.pollWaveform()
    }

    // Set up recording
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }
    this.mediaRecorder.start(1000) // Collect chunks every second
  }

  private pollWaveform = (): void => {
    if (!this.analyser || !this.onWaveform) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    // Downsample to 32 bands
    const bands = 32
    const frequencies: number[] = []
    const step = bufferLength / bands
    for (let i = 0; i < bands; i++) {
      const start = Math.floor(i * step)
      const end = Math.floor((i + 1) * step)
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += dataArray[j]
      }
      frequencies.push(Math.round(sum / (end - start)))
    }

    // Calculate volume (RMS of all frequencies)
    const rms = Math.sqrt(
      dataArray.reduce((sum, val) => sum + val * val, 0) / bufferLength,
    )
    const volume = Math.min(rms / 128, 1) // Normalize to 0-1

    this.onWaveform({ frequencies, volume })
    this.animationFrame = requestAnimationFrame(this.pollWaveform)
  }

  stop(): Blob {
    cancelAnimationFrame(this.animationFrame)

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.mediaRecorder = null
    this.onWaveform = null

    return new Blob(this.chunks, { type: 'audio/webm' })
  }

  getAudioBlob(): Blob {
    return new Blob(this.chunks, { type: 'audio/webm' })
  }
}

// ── Speech Recognition Wrapper ────────────────────────────────

// Minimal types for Web Speech API. lib.dom.d.ts excludes these because
// the API has only made it into Chrome/Edge/Safari behind a vendor prefix —
// Firefox does not implement it. We declare just enough here to type the
// runtime checks below.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { readonly transcript: string }
}
interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}
interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultListLike
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

export class SpeechTranscriber {
  private recognition: SpeechRecognitionLike | null = null
  private fullTranscript = ''
  private onTranscript: ((final: string, interim: string) => void) | null = null
  private onLanguageDetect: ((lang: string) => void) | null = null
  private language: SupportedLanguage = 'en-US'
  private isRunning = false

  static isSupported(): boolean {
    return !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    )
  }

  start(
    language: SupportedLanguage,
    onTranscript: (finalText: string, interimText: string) => void,
    onError?: (error: string) => void,
    onLanguageDetect?: (lang: string) => void,
  ): void {
    this.language = language
    this.onTranscript = onTranscript
    this.onLanguageDetect = onLanguageDetect ?? null
    this.fullTranscript = ''

    const SpeechRecognitionClass =
      ((window as unknown as Record<string, unknown>).SpeechRecognition as SpeechRecognitionConstructor | undefined) ||
      ((window as unknown as Record<string, unknown>).webkitSpeechRecognition as SpeechRecognitionConstructor | undefined)

    if (!SpeechRecognitionClass) {
      onError?.('Speech recognition not supported. Use Chrome or Edge.')
      return
    }

    this.recognition = new SpeechRecognitionClass()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.maxAlternatives = 1

    // For auto-detect, start with English and switch if Spanish detected
    this.recognition.lang = language === 'auto' ? 'en-US' : language

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = ''
      let finalChunk = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalChunk += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }

      if (finalChunk) {
        // Auto-detect language from first substantial chunk
        if (this.language === 'auto' && this.fullTranscript.length < 50) {
          const detected = detectLanguage(finalChunk)
          if (detected !== 'en-US' && this.recognition) {
            this.recognition.lang = detected
            this.onLanguageDetect?.(detected)
          }
        }

        this.fullTranscript += finalChunk
        this.onTranscript?.(this.fullTranscript.trim(), interim)
      } else if (interim) {
        this.onTranscript?.(this.fullTranscript.trim(), interim)
      }
    }

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'no-speech') return // Normal timeout, auto-restart handles it
      if (event.error === 'aborted') return // We aborted it
      onError?.(`Speech error: ${event.error}`)
    }

    this.recognition.onend = () => {
      // Auto-restart for continuous recording (browser kills it after ~60s)
      if (this.isRunning && this.recognition) {
        try {
          this.recognition.start()
        } catch {
          // Already running or disposed
        }
      }
    }

    this.isRunning = true
    this.recognition.start()
  }

  stop(): string {
    this.isRunning = false
    if (this.recognition) {
      this.recognition.onend = null
      try {
        this.recognition.stop()
      } catch {
        // Already stopped
      }
      this.recognition = null
    }
    return this.fullTranscript.trim()
  }

  getTranscript(): string {
    return this.fullTranscript.trim()
  }
}

// ── Language Detection ────────────────────────────────────────

const SPANISH_INDICATORS = [
  'el ', 'la ', 'los ', 'las ', 'un ', 'una ', 'del ', 'de ',
  'en ', 'por ', 'para ', 'con ', 'que ', 'es ', 'fue ', 'está ',
  'nivel', 'piso', 'ala ', 'completado', 'terminado', 'trabajadores',
  'concreto', 'vaciado', 'pared', 'techo', 'piso',
]

export function detectLanguage(text: string): SupportedLanguage {
  const lower = text.toLowerCase()
  let spanishScore = 0
  for (const indicator of SPANISH_INDICATORS) {
    if (lower.includes(indicator)) spanishScore++
  }
  // If more than 3 Spanish indicators found, it's likely Spanish
  return spanishScore >= 3 ? 'es-US' : 'en-US'
}

// ── Transcript Normalizer ─────────────────────────────────────

export function normalizeTranscript(text: string, language: SupportedLanguage): string {
  let normalized = text

  // Apply construction vocabulary normalization
  const vocab = language.startsWith('es') ? SPANISH_CONSTRUCTION_VOCAB : CONSTRUCTION_VOCAB
  for (const [slang, formal] of Object.entries(vocab)) {
    const regex = new RegExp(`\\b${slang}\\b`, 'gi')
    normalized = normalized.replace(regex, formal)
  }

  return normalized
}

// ── AI Structured Extraction ──────────────────────────────────



















































export async function extractFromTranscript(
  transcript: string,
  options?: {
    photoDataUrl?: string
    projectId?: string
    language?: string
  },
): Promise<ExtractionResult> {
  const startTime = Date.now()

  if (!isSupabaseConfigured) {
    return fallbackExtraction(transcript, startTime)
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    const messages: Array<{ role: string; content: unknown }> = []

    // If there's a photo, include it for Claude Vision analysis
    if (options?.photoDataUrl) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: options.photoDataUrl.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
          {
            type: 'text',
            text: `Analyze this construction site photo and combine with the following voice description to extract structured data:\n\n"${transcript}"`,
          },
        ],
      })
    } else {
      messages.push({
        role: 'user',
        content: `Parse this construction field report transcript into structured entities:\n\n"${transcript}"`,
      })
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/voice-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        transcript,
        messages,
        hasPhoto: !!options?.photoDataUrl,
        projectId: options?.projectId,
        language: options?.language || 'en',
      }),
    })

    if (!response.ok) {
      throw new Error(`Extraction failed: ${response.status}`)
    }

    const data = await response.json()

    return {
      entities: Array.isArray(data.entities) ? data.entities : [],
      rawTranscript: transcript,
      language: data.detected_language || options?.language || 'en',
      processingTimeMs: Date.now() - startTime,
    }
  } catch {
    return fallbackExtraction(transcript, startTime)
  }
}

// ── Fallback Extraction ───────────────────────────────────────

function fallbackExtraction(transcript: string, startTime: number): ExtractionResult {
  const lower = transcript.toLowerCase()
  const entities: ExtractedEntity[] = []

  // Detect weather
  const weatherMatch = lower.match(
    /(?:weather|temp|degrees?)\s*(?:was|is)?\s*(?:about|around)?\s*(\w+)?\s*(?:and|,)?\s*(\d+)\s*(?:degrees?|°)?/i,
  )

  // Detect crew
  const crewMatch = lower.match(
    /(\d+)\s*(?:workers?|guys?|people|men|crew)\s*(?:from|with)?\s*([\w\s]+?)(?:\.|,|$)/i,
  )

  // Detect progress
  const progressMatch = lower.match(
    /(?:about|around)?\s*(\d+)\s*(?:percent|%)\s*(?:done|complete|finished)?/i,
  )

  // Detect RFI triggers
  const rfiMatch = lower.match(
    /(?:need|requires?|should)\s*(?:an?)?\s*(?:rfi|clarification|question)\s*(?:on|about|for|regarding)\s*(.+?)(?:\.|,|$)/i,
  )

  // Detect safety concerns
  const safetyMatch = lower.match(
    /(?:safety|hazard|violation|unsafe|danger|ppe|hard hat|fall protection|guardrail)/i,
  )

  // Build daily log entity
  const dailyLogData: Record<string, unknown> = {
    activities: [{
      trade: detectTrade(lower),
      location: detectLocation(lower),
      description: transcript.substring(0, 200),
      progress: progressMatch ? parseInt(progressMatch[1]) : null,
    }],
    crew: crewMatch
      ? [{ company: crewMatch[2].trim(), headcount: parseInt(crewMatch[1]), trade: detectTrade(lower) }]
      : null,
    weather: weatherMatch
      ? { condition: weatherMatch[1] || 'clear', temp_f: parseInt(weatherMatch[2]) }
      : null,
  }

  entities.push({
    type: 'daily_log',
    data: dailyLogData,
    confidence: 0.5,
    source: transcript,
  })

  // Add RFI if detected
  if (rfiMatch) {
    entities.push({
      type: 'rfi_draft',
      data: {
        subject: rfiMatch[1].trim().substring(0, 100),
        location: detectLocation(lower),
        question: `Please clarify: ${rfiMatch[1].trim()}`,
        priority: 'high',
      },
      confidence: 0.6,
      source: rfiMatch[0],
    })
  }

  // Add safety observation if detected
  if (safetyMatch) {
    entities.push({
      type: 'safety_observation',
      data: {
        description: transcript,
        location: detectLocation(lower),
        severity: 'medium',
      },
      confidence: 0.5,
      source: safetyMatch[0],
    })
  }

  return {
    entities,
    rawTranscript: transcript,
    language: detectLanguage(transcript).startsWith('es') ? 'es' : 'en',
    processingTimeMs: Date.now() - startTime,
  }
}

function detectTrade(text: string): string {
  const tradeMap: Record<string, string[]> = {
    Concrete: ['concrete', 'pour', 'rebar', 'formwork', 'slab'],
    Electrical: ['electrical', 'wire', 'conduit', 'panel', 'outlet', 'switch', 'j-box'],
    Mechanical: ['hvac', 'duct', 'mechanical', 'air handler', 'chiller'],
    Plumbing: ['plumbing', 'pipe', 'drain', 'fixture', 'water'],
    'Structural Steel': ['steel', 'beam', 'column', 'iron', 'welding'],
    Drywall: ['drywall', 'sheetrock', 'mud', 'taping', 'framing'],
    Painting: ['paint', 'primer', 'coating'],
    Roofing: ['roof', 'membrane', 'flashing'],
  }

  for (const [trade, keywords] of Object.entries(tradeMap)) {
    if (keywords.some((kw) => text.includes(kw))) return trade
  }
  return 'General'
}

function detectLocation(text: string): string {
  const locationMatch = text.match(
    /(?:on|at|in|near)?\s*(?:level|floor|story|storey)\s*(\d+)\s*(?:,?\s*(?:east|west|north|south)\s*(?:wing|side|elevation)?)?/i,
  )
  if (locationMatch) {
    const floor = locationMatch[1]
    const direction = text.match(/(?:east|west|north|south)\s*(?:wing|side)?/i)?.[0] || ''
    return `Level ${floor}${direction ? ' ' + direction.charAt(0).toUpperCase() + direction.slice(1) : ''}`
  }
  return ''
}

// ── IndexedDB Offline Cache ───────────────────────────────────

const DB_NAME = 'sitesync-voice-cache'
const STORE_NAME = 'captures'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('synced', 'synced', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheOfflineCapture(capture: OfflineCapture): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(capture)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getUnsyncedCaptures(): Promise<OfflineCapture[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const index = tx.objectStore(STORE_NAME).index('synced')
    // IDBValidKey type excludes booleans, but Chrome/Firefox/Safari all
    // accept boolean keys at runtime. Cast at the boundary.
    const request = index.getAll(false as unknown as IDBValidKey)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function markCaptureSynced(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, synced: true })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearSyncedCaptures(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('synced')
    const request = index.openCursor(true as unknown as IDBValidKey)
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
