/**
 * SessionView — post-walk review page.
 *
 * Route shape: #/walkthrough/:sessionId
 *
 * The PM lands here after ending a walk (or by clicking a session in the
 * dashboard). They bulk-approve / reject / defer captures, then click
 * "Generate PDF" to snapshot the walk for the owner record.
 *
 * Wiring required: route registration in src/App.tsx (see WALKTHROUGH_MODE.md).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ProjectGate } from '../../components/ProjectGate'
import { useProjectId } from '../../hooks/useProjectId'
import { colors, typography } from '../../styles/theme'
import {
  Eyebrow,
  Hairline,
  PageQuestion,
  Sliver,
  SectionHeading,
} from '../../components/atoms'
import { PendingPunchStack } from '../../components/walkthrough/PendingPunchStack'
import { SessionPdfExport } from '../../components/walkthrough/SessionPdfExport'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { toast } from 'sonner'
import type {
  WalkthroughCapture,
  WalkthroughSession,
} from '../../types/walkthrough'

export interface SessionViewProps {
  sessionId: string
}

const SessionView: React.FC<SessionViewProps> = ({ sessionId }) => {
  const projectId = useProjectId()
  const [session, setSession] = useState<WalkthroughSession | null>(null)
  const [captures, setCaptures] = useState<WalkthroughCapture[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Load on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [sRes, cRes] = await Promise.all([
        fromTable('walkthrough_sessions').select('*').eq('id' as never, sessionId).single(),
        fromTable('walkthrough_captures').select('*').eq('session_id' as never, sessionId).order('captured_at', { ascending: false }),
      ])
      if (cancelled) return
      if (sRes.data) setSession(sRes.data as unknown as WalkthroughSession)
      if (cRes.data) setCaptures(cRes.data as unknown as WalkthroughCapture[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [sessionId])

  const updateCaptureStatus = useCallback(
    async (capture: WalkthroughCapture, status: WalkthroughCapture['status']) => {
      setBusyId(capture.id)
      const { error } = await fromTable('walkthrough_captures')
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

  const handlePdfGenerated = useCallback((url: string) => {
    setSession((prev) => prev ? { ...prev, pdf_export_url: url } : prev)
  }, [])

  const counts = useMemo(() => ({
    total: captures.length,
    pending: captures.filter((c) => c.status === 'pending_review').length,
    approved: captures.filter((c) => c.status === 'approved').length,
    rejected: captures.filter((c) => c.status === 'rejected').length,
    deferred: captures.filter((c) => c.status === 'deferred').length,
  }), [captures])

  if (!projectId) return <ProjectGate />

  return (
    <ErrorBoundary>
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: colors.parchment,
        minHeight: 0,
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px 64px' }}>
          <Sliver
            left="WALK-THROUGH · REVIEW"
            right={session ? new Date(session.started_at).toLocaleDateString() : ''}
          />

          <PageQuestion size="large">
            Which findings are <em>real</em>?
          </PageQuestion>

          <Hairline spacing="normal" />

          {/* ── Counts ──────────────────────────────────── */}
          <div style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            fontFamily: typography.fontFamily,
            fontSize: 12,
            color: colors.ink3,
            marginBottom: 12,
          }}>
            <CountChip label="Captured" value={counts.total} />
            <CountChip label="Pending" value={counts.pending} highlight />
            <CountChip label="Approved" value={counts.approved} />
            <CountChip label="Rejected" value={counts.rejected} />
            <CountChip label="Deferred" value={counts.deferred} />
          </div>

          <Hairline spacing="tight" />

          {/* ── PDF export ──────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Owner record</Eyebrow>
            <SessionPdfExport
              sessionId={sessionId}
              existingUrl={session?.pdf_export_url ?? null}
              onGenerated={handlePdfGenerated}
            />
          </div>

          {/* ── Stack ───────────────────────────────────── */}
          {loading ? (
            <div style={{
              padding: 40,
              textAlign: 'center',
              fontFamily: typography.fontFamilySerif,
              fontStyle: 'italic',
              color: colors.ink3,
            }}>
              Loading captures…
            </div>
          ) : (
            <>
              <SectionHeading level={3}>Captures</SectionHeading>
              <div style={{ marginTop: 12 }}>
                <PendingPunchStack
                  captures={captures}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDefer={handleDefer}
                  busyId={busyId}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}

const CountChip: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
    <span style={{
      fontFamily: typography.fontFamily,
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: highlight ? colors.primaryOrange : colors.ink4,
      fontWeight: 600,
    }}>
      {label}
    </span>
    <span style={{
      fontFamily: typography.fontFamilySerif,
      fontSize: 22,
      color: highlight ? colors.primaryOrange : colors.ink,
      lineHeight: 1.1,
    }}>
      {value}
    </span>
  </div>
)

export default SessionView
