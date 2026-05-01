/**
 * PendingPunchStack — the post-walk review surface.
 *
 * Each card represents one capture. The PM can:
 *   • Approve  → flips status='approved' (executor will write a punch_items row)
 *   • Reject   → status='rejected', no punch_items row
 *   • Defer    → status='deferred', stays in queue
 * Plus bulk actions:
 *   • "Approve all"
 *   • "Approve all critical"
 *   • Filter by trade
 *
 * Inline styles only. No Tailwind. Atoms imported from ../atoms.
 */

import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { colors, typography } from '../../styles/theme'
import { OrangeDot, Eyebrow, Hairline, SectionHeading } from '../atoms'
import type { WalkthroughCapture, WalkthroughSeverity } from '../../types/walkthrough'

export interface PendingPunchStackProps {
  captures: ReadonlyArray<WalkthroughCapture>
  onApprove: (capture: WalkthroughCapture) => void | Promise<void>
  onReject: (capture: WalkthroughCapture) => void | Promise<void>
  onDefer: (capture: WalkthroughCapture) => void | Promise<void>
  busyId?: string | null
}

const SEVERITY_LABEL: Record<WalkthroughSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

const SEVERITY_COLOR: Record<WalkthroughSeverity, string> = {
  low: colors.ink3,
  medium: colors.statusInfo,
  high: colors.statusPending,
  critical: colors.statusCritical,
}

export const PendingPunchStack: React.FC<PendingPunchStackProps> = ({
  captures,
  onApprove,
  onReject,
  onDefer,
  busyId = null,
}) => {
  const [tradeFilter, setTradeFilter] = useState<string | 'all'>('all')

  const visible = useMemo(() => {
    const pending = captures.filter((c) => c.status === 'pending_review' || c.status === 'pending_transcription')
    if (tradeFilter === 'all') return pending
    return pending.filter((c) => (c.parsed?.trade ?? '') === tradeFilter)
  }, [captures, tradeFilter])

  const trades = useMemo(() => {
    const t = new Set<string>()
    captures.forEach((c) => { if (c.parsed?.trade) t.add(c.parsed.trade) })
    return Array.from(t).sort()
  }, [captures])

  const criticalCount = visible.filter((c) => c.parsed?.severity === 'critical').length

  const approveAll = () => visible.forEach((c) => { void onApprove(c) })
  const approveCritical = () =>
    visible.filter((c) => c.parsed?.severity === 'critical').forEach((c) => { void onApprove(c) })

  if (captures.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Eyebrow color="muted">Nothing captured yet</Eyebrow>
        <div style={{
          fontFamily: typography.fontFamilySerif,
          fontStyle: 'italic',
          fontSize: 16,
          color: colors.ink3,
          marginTop: 12,
        }}>
          Hold the button. Walk. Speak. The list builds itself.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 12,
      }}>
        <SectionHeading level={3}>
          {visible.length} <em>pending</em>
        </SectionHeading>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {trades.length > 0 && (
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              style={{
                fontFamily: typography.fontFamily,
                fontSize: 12,
                padding: '6px 10px',
                border: `1px solid ${colors.hairline2}`,
                borderRadius: 6,
                background: 'transparent',
                color: colors.ink2,
              }}
            >
              <option value="all">All trades</option>
              {trades.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={approveCritical}
            disabled={criticalCount === 0}
            style={toolbarButtonStyle(criticalCount === 0)}
          >
            Approve {criticalCount} critical
          </button>
          <button
            type="button"
            onClick={approveAll}
            disabled={visible.length === 0}
            style={toolbarButtonStyle(visible.length === 0, true)}
          >
            Approve all
          </button>
        </div>
      </div>

      <Hairline spacing="tight" />

      {/* ── Stack ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visible.map((c) => (
          <CaptureCard
            key={c.id}
            capture={c}
            onApprove={onApprove}
            onReject={onReject}
            onDefer={onDefer}
            busy={busyId === c.id}
          />
        ))}
      </div>
    </div>
  )
}

// ── CaptureCard ──────────────────────────────────────────────

interface CaptureCardProps {
  capture: WalkthroughCapture
  onApprove: PendingPunchStackProps['onApprove']
  onReject: PendingPunchStackProps['onReject']
  onDefer: PendingPunchStackProps['onDefer']
  busy: boolean
}

const CaptureCard: React.FC<CaptureCardProps> = ({ capture, onApprove, onReject, onDefer, busy }) => {
  const [expanded, setExpanded] = useState(false)
  const parsed = capture.parsed
  const severity = parsed?.severity ?? 'medium'
  const isPendingTranscription = capture.status === 'pending_transcription'

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: capture.photo_url ? '120px 1fr' : '1fr',
        gap: 16,
        padding: 16,
        border: `1px solid ${colors.hairline2}`,
        borderRadius: 8,
        background: colors.surfaceRaised,
      }}
    >
      {capture.photo_url && (
        <img
          src={capture.photo_url}
          alt="Capture"
          style={{
            width: 120,
            height: 120,
            objectFit: 'cover',
            borderRadius: 6,
            background: colors.surfaceInset,
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {severity === 'critical' && <OrangeDot size={8} haloSpread={3} />}
          <span style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: 18,
            color: colors.ink,
            fontWeight: 500,
          }}>
            {parsed?.title ?? (isPendingTranscription ? 'Transcribing…' : 'Untitled capture')}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Eyebrow style={{ color: SEVERITY_COLOR[severity] }}>
            {SEVERITY_LABEL[severity]}
          </Eyebrow>
          {parsed?.trade && <Eyebrow color="muted">{parsed.trade}</Eyebrow>}
          {parsed?.location_hint && (
            <span style={{ fontFamily: typography.fontFamily, fontSize: 12, color: colors.ink3 }}>
              {parsed.location_hint}
            </span>
          )}
        </div>

        {capture.transcript && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              alignSelf: 'flex-start',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: typography.fontFamily,
              fontSize: 11,
              color: colors.ink4,
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
            }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Transcript
          </button>
        )}
        {expanded && capture.transcript && (
          <div style={{
            fontFamily: typography.fontFamilySerif,
            fontSize: 14,
            fontStyle: 'italic',
            color: colors.ink2,
            background: colors.surfaceInset,
            padding: 12,
            borderRadius: 4,
          }}>
            {capture.transcript}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onApprove(capture)}
            disabled={busy || isPendingTranscription}
            style={actionButtonStyle('primary', busy || isPendingTranscription)}
          >
            <CheckCircle2 size={14} /> Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(capture)}
            disabled={busy}
            style={actionButtonStyle('secondary', busy)}
          >
            <XCircle size={14} /> Reject
          </button>
          <button
            type="button"
            onClick={() => onDefer(capture)}
            disabled={busy}
            style={actionButtonStyle('ghost', busy)}
          >
            <Clock size={14} /> Defer
          </button>
        </div>
      </div>
    </article>
  )
}

// ── Style helpers ─────────────────────────────────────────────

function toolbarButtonStyle(disabled: boolean, primary = false): React.CSSProperties {
  return {
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '6px 12px',
    border: `1px solid ${primary ? colors.primaryOrange : colors.hairline2}`,
    background: primary && !disabled ? colors.primaryOrange : 'transparent',
    color: primary && !disabled ? 'white' : colors.ink2,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
}

function actionButtonStyle(
  variant: 'primary' | 'secondary' | 'ghost',
  disabled: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    border: '1px solid',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }
  if (variant === 'primary') {
    return {
      ...base,
      borderColor: colors.primaryOrange,
      background: colors.primaryOrange,
      color: 'white',
    }
  }
  if (variant === 'secondary') {
    return {
      ...base,
      borderColor: colors.hairline2,
      background: 'transparent',
      color: colors.ink2,
    }
  }
  return {
    ...base,
    border: 'none',
    background: 'transparent',
    color: colors.ink3,
  }
}

export default PendingPunchStack
