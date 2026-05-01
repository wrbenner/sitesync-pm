/**
 * CaptureButton — the single primary action of Walk-Through Mode.
 *
 * Press-and-hold (touch / pointer) → record audio + snap a still photo
 * frame from a `getUserMedia({ video: true })` stream + grab GPS via
 * geolocation. Release → call `onCapture(audio, photo, gps)` and reset.
 *
 * Why a single big button? The owner walk is a stream of distractions;
 * the GC's super wants *one* gesture per finding. Bigger target = fewer
 * misses with gloves on.
 *
 * Feature-detection rules:
 *   • If `navigator.mediaDevices` is undefined (jsdom, old browser, or
 *     iframe without `microphone` permission) → render a disabled state.
 *     Never throw at module-load time. Tests must be able to render the
 *     parent page without a mock.
 *   • Geolocation is best-effort; failure resolves with gps=null.
 *   • If video stream fails (permission, no camera) but audio succeeds,
 *     we still call onCapture with photo=null. Audio-only walks beat
 *     no-walks.
 *
 * Recording state is local — there's no global walkthrough store. The
 * page coordinates state for the queue.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { colors, typography } from '../../styles/theme'
import { OrangeDot } from '../atoms'

export interface CaptureButtonProps {
  onCapture: (
    audio: Blob,
    photo: Blob | null,
    gps: { lat: number; lon: number } | null,
  ) => void | Promise<void>
  /** Caller can override the default copy ("Hold to capture"). */
  label?: string
  disabled?: boolean
}

type CaptureState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'stopping' }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'error'; message: string }

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  onCapture,
  label = 'Hold to capture',
  disabled = false,
}) => {
  // Feature-detect once on mount. We do this in state (not at module
  // scope) so jsdom doesn't crash imports and the component re-evaluates
  // when re-mounted in a different environment (e.g. SSR hydration).
  const [state, setState] = useState<CaptureState>(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { kind: 'unsupported', reason: 'Microphone unavailable in this context.' }
    }
    return { kind: 'idle' }
  })

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const photoRef = useRef<Blob | null>(null)
  const gpsRef = useRef<{ lat: number; lon: number } | null>(null)

  // Cleanup on unmount: stop any tracks left dangling.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const startCapture = useCallback(async () => {
    if (state.kind !== 'idle' || disabled) return
    setState({ kind: 'starting' })
    chunksRef.current = []
    photoRef.current = null
    gpsRef.current = null

    // Geolocation in parallel — best-effort, swallow failures.
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        },
        () => { /* ignore — gps stays null */ },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
      )
    }

    let stream: MediaStream
    try {
      // Audio is required; video is best-effort (we use it for a single
      // still frame — letting it fail gracefully means audio-only walks
      // still produce captures).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'environment' },
      }).catch(async () => {
        // Fall back to audio-only.
        return navigator.mediaDevices.getUserMedia({ audio: true })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone permission denied.'
      setState({ kind: 'error', message })
      return
    }

    streamRef.current = stream

    // Pull a single still from the video track if we have one.
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack && typeof window !== 'undefined' && 'ImageCapture' in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ImageCaptureCtor = (window as any).ImageCapture as new (track: MediaStreamTrack) => {
          takePhoto: () => Promise<Blob>
        }
        const ic = new ImageCaptureCtor(videoTrack)
        ic.takePhoto().then((b) => { photoRef.current = b }).catch(() => { /* no-op */ })
      } catch {
        // ImageCapture unsupported on this browser — the audio-only path
        // still works; UI shows "no photo" badge.
      }
    }

    try {
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type ?? 'audio/webm' })
        // Tear down stream tracks once we've stopped.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        // Hand off to the page. Errors in the callback shouldn't break us.
        try {
          void Promise.resolve(onCapture(audio, photoRef.current, gpsRef.current))
        } catch {
          /* swallowed — page should toast its own error */
        }
        setState({ kind: 'idle' })
      }
      recorder.start()
      recorderRef.current = recorder
      setState({ kind: 'recording', startedAt: Date.now() })
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const message = err instanceof Error ? err.message : 'Could not start recording.'
      setState({ kind: 'error', message })
    }
  }, [state, disabled, onCapture])

  const stopCapture = useCallback(() => {
    if (state.kind !== 'recording') return
    setState({ kind: 'stopping' })
    try {
      recorderRef.current?.stop()
    } catch {
      // If stop throws (already stopped, etc.) just reset.
      setState({ kind: 'idle' })
    }
  }, [state])

  // ── Render ──────────────────────────────────────────────────

  if (state.kind === 'unsupported') {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: 20,
          maxWidth: 320,
          textAlign: 'center',
          fontFamily: typography.fontFamily,
        }}
      >
        <MicOff size={28} color={colors.ink4} />
        <div style={{
          fontFamily: typography.fontFamilySerif,
          fontStyle: 'italic',
          fontSize: 16,
          color: colors.ink2,
          lineHeight: 1.4,
        }}>
          {state.reason}
        </div>
      </div>
    )
  }

  const isRecording = state.kind === 'recording'
  const isBusy = state.kind === 'starting' || state.kind === 'stopping'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={isRecording}
        disabled={disabled || isBusy}
        onPointerDown={(e) => {
          // Only start on left/touch press, not right-click context menus.
          if (e.button !== 0) return
          e.preventDefault()
          void startCapture()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          stopCapture()
        }}
        onPointerLeave={() => {
          // If the finger slides off, end the capture cleanly.
          if (state.kind === 'recording') stopCapture()
        }}
        style={{
          width: 168,
          height: 168,
          borderRadius: '50%',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: isRecording
            ? 'var(--color-primary)'
            : 'var(--color-surfaceRaised)',
          boxShadow: isRecording
            ? '0 0 0 8px var(--color-primary-light), 0 12px 32px rgba(0,0,0,0.15)'
            : '0 6px 18px rgba(0,0,0,0.10)',
          transition: 'box-shadow 180ms ease, background 180ms ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          color: isRecording ? 'white' : colors.ink,
          touchAction: 'manipulation',
          userSelect: 'none',
        }}
      >
        <Mic size={36} />
        <span style={{
          fontFamily: typography.fontFamily,
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {isRecording ? 'Recording' : isBusy ? '…' : 'Hold'}
        </span>
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: typography.fontFamily,
        fontSize: 13,
        color: colors.ink3,
      }}>
        {isRecording && <OrangeDot size={8} haloSpread={3} />}
        <span>{isRecording ? 'Speak — release to save' : label}</span>
      </div>

      {state.kind === 'error' && (
        <div
          role="alert"
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 12,
            color: colors.statusCritical,
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {state.message}
        </div>
      )}
    </div>
  )
}

export default CaptureButton
