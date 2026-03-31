// ── useVoiceCapture ───────────────────────────────────────────
// Complete voice capture hook integrating:
// - Real audio recording via MediaRecorder + AnalyserNode waveform
// - Web Speech API for live transcription
// - Language auto-detection (English / Spanish / mixed)
// - AI structured extraction via voice-extract edge function
// - Offline caching to IndexedDB when network is unavailable
// - Photo + voice combo support

import { useState, useCallback, useRef, useEffect } from 'react'
import { useProjectId } from './useProjectId'
import {
  AudioRecorder,
  SpeechTranscriber,
  extractFromTranscript,
  cacheOfflineCapture,
  getUnsyncedCaptures,
  markCaptureSynced,
  detectLanguage,
  normalizeTranscript,
} from '../lib/voiceProcessor'
import type {
  SupportedLanguage,
  WaveformData,
  ExtractionResult,
  ExtractedEntity,
  OfflineCapture,
} from '../lib/voiceProcessor'

// ── Types ─────────────────────────────────────────────────────

export type VoiceCapturePhase =
  | 'idle'
  | 'recording'
  | 'processing'  // Transcription finalization + AI extraction
  | 'review'      // User reviewing extracted entities
  | 'saving'      // Confirming and saving entities
  | 'error'

export interface VoiceCaptureState {
  phase: VoiceCapturePhase
  // Audio
  waveform: WaveformData
  elapsed: number
  audioBlob: Blob | null
  audioUrl: string | null
  // Transcription
  transcript: string
  interimText: string
  // Language
  language: SupportedLanguage
  detectedLanguage: string | null
  // Extraction
  extractionResult: ExtractionResult | null
  entities: ExtractedEntity[]
  // Photo combo
  photoDataUrl: string | null
  // Errors
  error: string | null
  // Offline
  pendingSync: number
}

const EMPTY_WAVEFORM: WaveformData = { frequencies: new Array(32).fill(4), volume: 0 }

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  'en-US': 'English',
  'es-MX': 'Español (MX)',
  'es-US': 'Español (US)',
  'auto': 'Auto Detect',
}

// ── Hook ──────────────────────────────────────────────────────

export function useVoiceCapture() {
  const projectId = useProjectId()

  const [phase, setPhase] = useState<VoiceCapturePhase>('idle')
  const [waveform, setWaveform] = useState<WaveformData>(EMPTY_WAVEFORM)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [language, setLanguage] = useState<SupportedLanguage>('en-US')
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [entities, setEntities] = useState<ExtractedEntity[]>([])
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingSync, setPendingSync] = useState(0)

  const recorderRef = useRef<AudioRecorder | null>(null)
  const transcriberRef = useRef<SpeechTranscriber | null>(null)
  const timerRef = useRef<number>(0)

  // Check for unsynced captures on mount
  useEffect(() => {
    getUnsyncedCaptures()
      .then((captures) => setPendingSync(captures.length))
      .catch(() => {})
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      recorderRef.current?.stop()
      transcriberRef.current?.stop()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  // ── Start Recording ─────────────────────────────────────

  const startRecording = useCallback(async () => {
    setError(null)
    setTranscript('')
    setInterimText('')
    setElapsed(0)
    setExtractionResult(null)
    setEntities([])
    setDetectedLanguage(null)
    setWaveform(EMPTY_WAVEFORM)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)

    try {
      // Start audio recorder with waveform callback
      const recorder = new AudioRecorder()
      await recorder.start((data) => setWaveform(data))
      recorderRef.current = recorder

      // Start speech transcription
      const transcriber = new SpeechTranscriber()
      transcriberRef.current = transcriber

      if (SpeechTranscriber.isSupported()) {
        transcriber.start(
          language,
          (finalText, interim) => {
            setTranscript(finalText)
            setInterimText(interim)
          },
          (err) => setError(err),
          (detected) => setDetectedLanguage(detected),
        )
      }

      // Start elapsed timer
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => prev + 0.1)
      }, 100)

      setPhase('recording')
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone access denied. Please allow microphone access in your browser settings.')
      } else {
        setError(`Failed to start recording: ${message}`)
      }
      setPhase('error')
    }
  }, [language, audioUrl])

  // ── Stop Recording & Extract ────────────────────────────

  const stopRecording = useCallback(async () => {
    clearInterval(timerRef.current)

    // Stop speech recognition
    const finalTranscript = transcriberRef.current?.stop() || transcript
    transcriberRef.current = null

    // Stop audio recording and get blob
    const blob = recorderRef.current?.stop() || null
    recorderRef.current = null

    setWaveform(EMPTY_WAVEFORM)
    setInterimText('')

    if (blob) {
      setAudioBlob(blob)
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    }

    const cleanTranscript = finalTranscript.trim()
    if (!cleanTranscript) {
      setPhase('idle')
      return
    }

    setTranscript(cleanTranscript)
    setPhase('processing')

    // Normalize transcript with construction vocabulary
    const lang: SupportedLanguage = (detectedLanguage as SupportedLanguage) || language
    const normalized = normalizeTranscript(cleanTranscript, lang)

    // Check if we're online
    if (!navigator.onLine) {
      // Cache for later processing
      const capture: OfflineCapture = {
        id: `voice-${Date.now()}`,
        audioBlob: blob || new Blob(),
        transcript: normalized,
        language: lang,
        timestamp: Date.now(),
        projectId: projectId || '',
        photoDataUrl: photoDataUrl || undefined,
        synced: false,
      }
      await cacheOfflineCapture(capture)
      setPendingSync((prev) => prev + 1)

      // Still do fallback extraction locally
      const result = await extractFromTranscript(normalized, {
        photoDataUrl: photoDataUrl || undefined,
        projectId: projectId || undefined,
        language: lang,
      })
      setExtractionResult(result)
      setEntities(result.entities)
      setPhase('review')
      return
    }

    // Online: run AI extraction
    try {
      const result = await extractFromTranscript(normalized, {
        photoDataUrl: photoDataUrl || undefined,
        projectId: projectId || undefined,
        language: lang,
      })
      setExtractionResult(result)
      setEntities(result.entities)
      setPhase('review')
    } catch (err) {
      setError(`Extraction failed: ${(err as Error).message}`)
      setPhase('error')
    }
  }, [transcript, language, detectedLanguage, projectId, photoDataUrl])

  // ── Cancel ──────────────────────────────────────────────

  const cancelRecording = useCallback(() => {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
    recorderRef.current = null
    transcriberRef.current?.stop()
    transcriberRef.current = null
    setWaveform(EMPTY_WAVEFORM)
    setPhase('idle')
    setTranscript('')
    setInterimText('')
    setElapsed(0)
  }, [])

  // ── Reset to Idle ───────────────────────────────────────

  const reset = useCallback(() => {
    cancelRecording()
    setError(null)
    setExtractionResult(null)
    setEntities([])
    setPhotoDataUrl(null)
    setDetectedLanguage(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
  }, [cancelRecording, audioUrl])

  // ── Update Entity (user edits extracted data) ───────────

  const updateEntity = useCallback((index: number, updated: ExtractedEntity) => {
    setEntities((prev) => prev.map((e, i) => (i === index ? updated : e)))
  }, [])

  // ── Remove Entity ───────────────────────────────────────

  const removeEntity = useCallback((index: number) => {
    setEntities((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Attach Photo ────────────────────────────────────────

  const attachPhoto = useCallback((dataUrl: string) => {
    setPhotoDataUrl(dataUrl)
  }, [])

  // ── Sync Offline Captures ───────────────────────────────

  const syncOfflineCaptures = useCallback(async (): Promise<number> => {
    if (!navigator.onLine) return 0

    const captures = await getUnsyncedCaptures()
    let synced = 0

    for (const capture of captures) {
      try {
        await extractFromTranscript(capture.transcript, {
          photoDataUrl: capture.photoDataUrl,
          projectId: capture.projectId,
          language: capture.language,
        })
        await markCaptureSynced(capture.id)
        synced++
      } catch {
        // Will retry next time
      }
    }

    setPendingSync((prev) => Math.max(0, prev - synced))
    return synced
  }, [])

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (pendingSync > 0) {
        syncOfflineCaptures()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [pendingSync, syncOfflineCaptures])

  return {
    // State
    phase,
    waveform,
    elapsed,
    audioBlob,
    audioUrl,
    transcript,
    interimText,
    language,
    detectedLanguage,
    extractionResult,
    entities,
    photoDataUrl,
    error,
    pendingSync,
    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    setLanguage,
    updateEntity,
    removeEntity,
    attachPhoto,
    syncOfflineCaptures,
    setPhase,
    // Utilities
    languageOptions: Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({
      value: value as SupportedLanguage,
      label,
    })),
    isSupported: SpeechTranscriber.isSupported(),
  }
}

// Re-export types for consumers
export type { SupportedLanguage, WaveformData, ExtractionResult, ExtractedEntity }
