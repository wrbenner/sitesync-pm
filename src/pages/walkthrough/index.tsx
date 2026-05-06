/**
 * Walk-Through Mode — capture page.
 *
 * "What's wrong with this room?"
 *
 * The page is a single big button. Hold to capture audio + photo + GPS;
 * release and the queue at the right edge gains a new card. The PM
 * reviews on the SessionView page (or on the same device after the walk).
 *
 * Wiring required (see docs/WALKTHROUGH_MODE.md):
 *   • Add route #/walkthrough → this page in src/App.tsx
 *   • Add sidebar entry "Walk" → #/walkthrough
 *   • Create Storage bucket `walkthrough-audio` (private) + `walkthrough-photos`
 *   • Set OPENAI_API_KEY (transcribe-walkthrough), ANTHROPIC_API_KEY (parse)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ProjectGate } from '../../components/ProjectGate'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuthStore } from '../../stores/authStore'
import { colors, typography } from '../../styles/theme'
import {
  Eyebrow,
  Hairline,
  PageQuestion,
  Sliver,
  OrangeDot,
} from '../../components/atoms'
import { CaptureButton } from '../../components/walkthrough/CaptureButton'
import { PendingPunchStack } from '../../components/walkthrough/PendingPunchStack'
import { supabase } from '../../lib/supabase'
import { parseTranscriptToCapture } from '../../lib/walkthrough'
import { toast } from 'sonner'
import type {
  WalkthroughCapture,
  WalkthroughSession,
} from '../../types/walkthrough'

const WalkthroughPage: React.FC = () => {
  const projectId = useProjectId()
  const user = useAuthStore((s) => s.user)

  const [session, setSession] = useState<WalkthroughSession | null>(null)
  const [captures, setCaptures] = useState<WalkthroughCapture[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showStack, setShowStack] = useState(false)

  // ── Start session lazily on first capture ───────────────────
  const ensureSession = useCallback(async (): Promise<WalkthroughSession | null> => {
    if (session) return session
    if (!projectId || !user?.id) return null
    const { data, error } = await supabase
      .from('walkthrough_sessions')
      .insert({
        project_id: projectId,
        started_by_user: user.id,
        attendees: [],
      } as never)
      .select('*')
      .single()
    if (error || !data) {
      toast.error('Could not start walkthrough session')
      return null
    }
    const s = data as unknown as WalkthroughSession
    setSession(s)
    return s
  }, [session, projectId, user?.id])

  // ── Handle a capture from the button ────────────────────────
  const handleCapture = useCallback(
    async (audio: Blob, photo: Blob | null, gps: { lat: number; lon: number } | null) => {
      const s = await ensureSession()
      if (!s) return

      // Optimistic local row so the UI shows the capture immediately.
      const tempId = `temp-${Date.now()}`
      const tempCapture: WalkthroughCapture = {
        id: tempId,
        session_id: s.id,
        project_id: s.project_id,
        captured_at: new Date().toISOString(),
        audio_url: null,
        photo_url: photo ? URL.createObjectURL(photo) : null,
        transcript: null,
        transcript_confidence: null,
        parsed: null,
        gps_lat: gps?.lat ?? null,
        gps_lon: gps?.lon ?? null,
        drawing_id: null,
        drawing_x: null,
        drawing_y: null,
        status: 'pending_transcription',
        executed_punch_item_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setCaptures((prev) => [tempCapture, ...prev])

      try {
        // Upload audio + photo to Storage. We do it in parallel.
        const audioPath = `${s.id}/${tempId}.webm`
        const photoPath = photo ? `${s.id}/${tempId}.jpg` : null
        const uploads: Promise<unknown>[] = [
          supabase.storage.from('walkthrough-audio').upload(audioPath, audio, { upsert: true, contentType: audio.type || 'audio/webm' }),
        ]
        if (photo && photoPath) {
          uploads.push(
            supabase.storage.from('walkthrough-photos').upload(photoPath, photo, { upsert: true, contentType: photo.type || 'image/jpeg' }),
          )
        }
        await Promise.all(uploads)

        // Insert the capture row. The trigger bumps total_drafted on the session.
        const { data: row, error } = await supabase
          .from('walkthrough_captures')
          .insert({
            session_id: s.id,
            project_id: s.project_id,
            audio_storage_path: audioPath,
            photo_storage_path: photoPath,
            gps_lat: gps?.lat ?? null,
            gps_lon: gps?.lon ?? null,
          } as never)
          .select('*')
          .single()
        if (error || !row) {
          toast.error('Could not save capture')
          setCaptures((prev) => prev.filter((c) => c.id !== tempId))
          return
        }
        const saved = row as unknown as WalkthroughCapture

        // Fire-and-forget transcription via the edge function. The
        // function updates the row in-place; we'll see it on the next
        // realtime event. For now, run a light client-side parse so the
        // PM has something useful even if the LLM round-trip is slow.
        try {
          const { data: tx } = await supabase.functions.invoke<{
            transcript?: string
            confidence?: number
          }>('transcribe-walkthrough', {
            body: { audio_storage_path: audioPath },
          })
          if (tx?.transcript) {
            const parse = parseTranscriptToCapture(tx.transcript)
            await supabase
              .from('walkthrough_captures')
              .update({
                transcript: tx.transcript,
                transcript_confidence: tx.confidence ?? null,
                parsed: parse.result,
                status: 'pending_review',
              } as never)
              .eq('id' as never, saved.id)
            setCaptures((prev) =>
              prev.map((c) => c.id === tempId
                ? { ...saved, transcript: tx.transcript ?? null, transcript_confidence: tx.confidence ?? null, parsed: parse.result, status: 'pending_review' }
                : c),
            )
          } else {
            setCaptures((prev) => prev.map((c) => c.id === tempId ? saved : c))
          }
        } catch {
          // Transcription unavailable — PM can still review with manual entry.
          setCaptures((prev) =>
            prev.map((c) => c.id === tempId
              ? { ...saved, status: 'failed' }
              : c),
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Capture upload failed'
        toast.error(msg)
        setCaptures((prev) => prev.filter((c) => c.id !== tempId))
      }
    },
    [ensureSession],
  )

  // ── End session ─────────────────────────────────────────────
  const endSession = useCallback(async () => {
    if (!session) return
    const { error } = await supabase
      .from('walkthrough_sessions')
      .update({ ended_at: new Date().toISOString(), status: 'reviewing' } as never)
      .eq('id' as never, session.id)
    if (error) {
      toast.error('Could not end session')
      return
    }
    toast.success('Walk ended — review captures next')
    // Navigate to review page. Hash router convention used elsewhere in app.
    window.location.hash = `#/walkthrough/${session.id}`
  }, [session])

  // ── Update handlers (no executor — just status flips here) ──
  const updateCaptureStatus = useCallback(
    async (capture: WalkthroughCapture, status: WalkthroughCapture['status']) => {
      setBusyId(capture.id)
      const { error } = await supabase
        .from('walkthrough_captures')
        .update({ status } as never)
        .eq('id' as never, capture.id)
      setBusyId(null)
      if (error) {
        toast.error('Could not update capture')
        return
      }
      setCaptures((prev) => prev.map((c) => c.id === capture.id ? { ...c, status } : c))
    },
    [],
  )

  const handleApprove = useCallback((c: WalkthroughCapture) => updateCaptureStatus(c, 'approved'), [updateCaptureStatus])
  const handleReject = useCallback((c: WalkthroughCapture) => updateCaptureStatus(c, 'rejected'), [updateCaptureStatus])
  const handleDefer = useCallback((c: WalkthroughCapture) => updateCaptureStatus(c, 'deferred'), [updateCaptureStatus])

  // ── Cleanup local URLs on unmount ───────────────────────────
  useEffect(() => () => {
    captures.forEach((c) => {
      if (c.photo_url?.startsWith('blob:')) URL.revokeObjectURL(c.photo_url)
    })
  }, [captures])

  const counts = useMemo(() => ({
    total: captures.length,
    pending: captures.filter((c) => c.status === 'pending_review' || c.status === 'pending_transcription').length,
    approved: captures.filter((c) => c.status === 'approved').length,
  }), [captures])

  if (!projectId) return <ProjectGate />

  return (
    <ErrorBoundary>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: colors.parchment,
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto', width: '100%', padding: '32px 24px 80px' }}>
          <Sliver
            left="WALK-THROUGH"
            right={session ? `${counts.total} captured` : 'Not started'}
          />

          <PageQuestion size="large">
            What is <em>wrong</em> with this room?
          </PageQuestion>

          <Hairline spacing="normal" />

          {/* ── Capture surface ──────────────────────────── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            padding: '24px 0 8px',
          }}>
            <CaptureButton onCapture={handleCapture} />
          </div>

          {/* ── Live counts ──────────────────────────────── */}
          {counts.total > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 20,
                justifyContent: 'center',
                marginTop: 24,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                color: colors.ink3,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <OrangeDot size={6} haloSpread={2} />
                {counts.pending} pending
              </span>
              <span>{counts.approved} approved</span>
              <span>{counts.total} total</span>
            </div>
          )}

          <Hairline spacing="wide" />

          {/* ── Session controls ─────────────────────────── */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowStack((v) => !v)}
              disabled={counts.total === 0}
              style={{
                padding: '10px 16px',
                border: `1px solid ${colors.hairline2}`,
                background: 'transparent',
                color: colors.ink2,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                borderRadius: 6,
                cursor: counts.total === 0 ? 'not-allowed' : 'pointer',
                opacity: counts.total === 0 ? 0.4 : 1,
              }}
            >
              {showStack ? 'Hide queue' : `View queue (${counts.pending})`}
            </button>
            <button
              type="button"
              onClick={endSession}
              disabled={!session}
              style={{
                padding: '10px 16px',
                border: `1px solid ${colors.primaryOrange}`,
                background: session ? colors.primaryOrange : 'transparent',
                color: session ? 'white' : colors.ink4,
                fontFamily: typography.fontFamily,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                borderRadius: 6,
                cursor: session ? 'pointer' : 'not-allowed',
                opacity: session ? 1 : 0.4,
              }}
            >
              End session
            </button>
          </div>
        </div>

        {/* ── Slide-in queue (right edge) ───────────────────── */}
        {showStack && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(420px, 100vw)',
              background: colors.parchment2,
              borderLeft: `1px solid ${colors.hairline2}`,
              boxShadow: '-12px 0 32px rgba(0,0,0,0.12)',
              padding: 20,
              overflow: 'auto',
              zIndex: 50,
            }}
          >
            <Eyebrow style={{ marginBottom: 12 }}>Queue</Eyebrow>
            <PendingPunchStack
              captures={captures}
              onApprove={handleApprove}
              onReject={handleReject}
              onDefer={handleDefer}
              busyId={busyId}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default WalkthroughPage
