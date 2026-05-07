// ── RFIVoiceFAB ─────────────────────────────────────────────────────────
// P2b deliverable #4 — press-and-hold floating action button that
// captures audio, transcribes via the existing transcribe-voice edge
// function (Whisper), and pipes the transcript into the multi-pass
// Iris draft pipeline (ai-rfi-draft-v2). Result: a fully-drafted RFI
// from a 30-second voice memo.
//
// Bugatti choices:
//   • Press-and-hold (mousedown / pointerdown), release ends recording.
//     Mobile-first; long-press on touch devices behaves the same.
//   • Reduce-Motion respected — the recording-state pulse is gated on
//     the user's preference.
//   • aria-label "Hold to record an RFI by voice" — assistive tech
//     reads the gesture verbatim.
//   • PermissionGate `rfis.create` wraps the FAB.
//   • The 8-second target latency budget for first preview is tracked
//     end-to-end via the draft's first_token_ms field; this component
//     just keeps the recorder UI responsive.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { PermissionGate } from '../auth/PermissionGate'
import { useCreateIrisRFIDraftV2 } from '../../hooks/queries/useIrisRFIDraftV2'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIVoiceFABProps {
  projectId: string
  /** Optional drawing context if the user is on a sheet. */
  drawingId?: string | null
  /** Fired with the new draft id when the pipeline completes. */
  onDraftReady: (draftId: string) => void
}

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'drafting'

export const RFIVoiceFAB: React.FC<RFIVoiceFABProps> = ({ projectId, drawingId, onDraftReady }) => {
  const reduceMotion = useReducedMotion()
  const createDraft = useCreateIrisRFIDraftV2()
  const [state, setState] = useState<RecordingState>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopTracks(), [stopTracks])

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice capture unavailable on this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        stopTracks()
        if (blob.size === 0) {
          setState('idle')
          return
        }
        await transcribeAndDraft(blob)
      }
      recorderRef.current = recorder
      recorder.start()
      setState('recording')
    } catch (err) {
      stopTracks()
      setState('idle')
      toast.error(err instanceof Error ? err.message : 'Microphone permission denied')
    }
  }, [state, stopTracks])

  const stopRecording = useCallback(() => {
    const r = recorderRef.current
    if (!r || state !== 'recording') return
    setState('transcribing')
    r.stop()
  }, [state])

  const transcribeAndDraft = useCallback(
    async (blob: Blob) => {
      try {
        const base64 = await blobToBase64(blob)
        // Step 1 — transcribe.
        const { data: transcribeData, error: transcribeErr } = await supabase.functions.invoke('transcribe-voice', {
          body: { audio_base64: base64, project_id: projectId },
        })
        if (transcribeErr) throw transcribeErr
        const transcript = (transcribeData as { transcript?: string } | null)?.transcript?.trim()
        if (!transcript) throw new Error('Empty transcript — please speak louder or longer.')
        // Step 2 — drive the multi-pass draft.
        setState('drafting')
        const { draftId } = await createDraft.mutateAsync({
          projectId,
          description: transcript,
          drawingId,
        })
        onDraftReady(draftId)
        toast.success('Iris drafted your RFI from voice')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Voice draft failed')
      } finally {
        setState('idle')
      }
    },
    [projectId, drawingId, createDraft, onDraftReady],
  )

  // Cancel mid-recording on Esc.
  useEffect(() => {
    if (state !== 'recording') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        recorderRef.current?.stop()
        chunksRef.current = []
        setState('idle')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const isBusy = state !== 'idle'
  const recording = state === 'recording'

  const label = recording
    ? 'Release to draft RFI'
    : state === 'transcribing'
      ? 'Transcribing…'
      : state === 'drafting'
        ? 'Iris is drafting…'
        : 'Hold to record an RFI by voice'

  return (
    <PermissionGate permission="rfis.create">
      <motion.button
        type="button"
        aria-label={label}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={() => { if (recording) stopRecording() }}
        onTouchStart={(e) => { e.preventDefault(); startRecording() }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
        disabled={isBusy && !recording}
        animate={
          reduceMotion
            ? undefined
            : recording
              ? { scale: [1, 1.06, 1], boxShadow: ['0 4px 16px rgba(244,120,32,0.35)', '0 6px 22px rgba(244,120,32,0.5)', '0 4px 16px rgba(244,120,32,0.35)'] }
              : { scale: 1 }
        }
        transition={reduceMotion ? undefined : { duration: 1.4, repeat: recording ? Infinity : 0, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          right: spacing.xl,
          bottom: spacing.xl,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: recording ? '#C93B3B' : colors.primaryOrange,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isBusy && !recording ? 'wait' : 'pointer',
          boxShadow: '0 4px 16px rgba(244,120,32,0.35)',
          zIndex: 50,
          touchAction: 'none',
        }}
      >
        {state === 'transcribing' || state === 'drafting' ? (
          <Loader2 size={20} className="rfi-voice-spin" />
        ) : recording ? (
          <Square size={18} />
        ) : (
          <Mic size={20} />
        )}
        {state !== 'idle' && (
          <span
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              right: 64,
              padding: '4px 10px',
              backgroundColor: 'rgba(26,22,19,0.92)',
              color: 'white',
              fontSize: typography.fontSize.caption,
              fontWeight: 600,
              borderRadius: borderRadius.sm,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {label}
          </span>
        )}
      </motion.button>
      <style>{`@keyframes rfi-voice-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .rfi-voice-spin { animation: rfi-voice-spin 1s linear infinite; }`}</style>
    </PermissionGate>
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default RFIVoiceFAB
