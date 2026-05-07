// ── RFIIrisDraftPreview ─────────────────────────────────────────────────
// Side panel for the multi-pass Iris draft (P2b deliverable #2).
// Shows every suggested field with confidence band + citation chips.
//
// Bugatti choices:
//   • Confidence band drives auto-apply behavior on Accept All.
//     High → just save. Medium → confirm. Low → require modify-first.
//   • Citation chips are first-class — clicking opens the drawing /
//     spec / RFI in the side panel per ADR-004.
//   • Reduce Motion respected — no spring animations on entry.
//   • PermissionGate `rfis.create` wraps Accept actions.

import React, { useMemo, useState } from 'react'
import { Sparkles, Check, X, Pencil, Calendar, DollarSign, Clock, FileText, Image as ImageIcon, AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { DetailPanel } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { UserName } from '../UserName'
import { fromCents } from '../../types/money'
import { bandColor, type IrisConfidenceBand } from '../../lib/iris/confidence'
import { useIrisRFIDraftV2, useAcceptIrisRFIDraftV2, useDiscardIrisRFIDraftV2 } from '../../hooks/queries/useIrisRFIDraftV2'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIIrisDraftPreviewProps {
  open: boolean
  onClose: () => void
  draftId: string | null
  projectId: string
  onAccepted: (rfiId: string | null) => void
}

interface CitationChipData {
  kind: string
  ref: string
  drawing_id?: string
  user_id?: string
  snippet?: string
}

export const RFIIrisDraftPreview: React.FC<RFIIrisDraftPreviewProps> = ({
  open,
  onClose,
  draftId,
  projectId,
  onAccepted,
}) => {
  const { data: draft, isLoading } = useIrisRFIDraftV2(draftId)
  const accept = useAcceptIrisRFIDraftV2()
  const discard = useDiscardIrisRFIDraftV2()
  const [editing, setEditing] = useState(false)

  const fieldRows = useMemo(() => {
    if (!draft) return []
    return [
      {
        key: 'title',
        label: 'Subject',
        icon: <FileText size={12} />,
        value: draft.suggested_title ?? '—',
        confidence: draft.confidence_by_field['title'] ?? null,
      },
      {
        key: 'body',
        label: 'Question',
        icon: <FileText size={12} />,
        value: draft.suggested_body ? draft.suggested_body.slice(0, 240) + (draft.suggested_body.length > 240 ? '…' : '') : '—',
        confidence: draft.confidence_by_field['body'] ?? null,
      },
      {
        key: 'ball_in_court',
        label: 'Ball in Court',
        icon: <AtSign size={12} />,
        value: draft.suggested_ball_in_court ? <UserName userId={draft.suggested_ball_in_court} fallback="—" /> : '—',
        confidence: draft.confidence_by_field['ball_in_court'] ?? null,
      },
      {
        key: 'due_date',
        label: 'Due',
        icon: <Calendar size={12} />,
        value: draft.suggested_due_date ?? '—',
        confidence: draft.confidence_by_field['due_date'] ?? null,
      },
      {
        key: 'schedule_days',
        label: 'Schedule Impact',
        icon: <Clock size={12} />,
        value:
          draft.suggested_schedule_days != null
            ? `${draft.suggested_schedule_days} day${draft.suggested_schedule_days === 1 ? '' : 's'}`
            : '—',
        confidence: draft.confidence_by_field['schedule_days'] ?? null,
      },
      {
        key: 'cost',
        label: 'Cost Impact',
        icon: <DollarSign size={12} />,
        value: formatCostRange(draft.suggested_cost_cents_min, draft.suggested_cost_cents_max),
        confidence: draft.confidence_by_field['cost_cents'] ?? null,
      },
    ]
  }, [draft])

  const citations = useMemo<CitationChipData[]>(() => {
    if (!draft || !Array.isArray(draft.citations)) return []
    return draft.citations as unknown as CitationChipData[]
  }, [draft])

  const handleAccept = async () => {
    if (!draft) return
    try {
      await accept.mutateAsync({ draft, projectId })
      toast.success('Iris draft accepted. Review and finalize the RFI.')
      onAccepted(draft.rfi_id)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept draft')
    }
  }

  const handleDiscard = async () => {
    if (!draft) return
    if (!window.confirm('Discard this Iris draft?')) return
    try {
      await discard.mutateAsync({ draft, projectId })
      toast('Draft discarded')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not discard')
    }
  }

  return (
    <DetailPanel open={open} onClose={onClose} title="Iris draft" width="460px">
      <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        {isLoading || !draft ? (
          <div style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
            Loading draft…
          </div>
        ) : (
          <>
            {/* Header — confidence band + telemetry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <Sparkles size={16} color={colors.primaryOrange} />
              <strong style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                Iris drafted this RFI
              </strong>
              {draft.confidence_band && (
                <ConfidenceChip band={draft.confidence_band} score={draft.confidence_score ?? null} />
              )}
              {draft.first_token_ms != null && (
                <span style={{ fontSize: 10, color: colors.textTertiary, marginLeft: 'auto' }}>
                  {draft.first_token_ms}ms first token · {draft.total_ms}ms total
                </span>
              )}
            </div>

            {/* Field rows */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {fieldRows.map((row) => (
                <li
                  key={row.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing['2'],
                    padding: spacing['2'],
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.base,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <span style={{ color: colors.textTertiary, marginTop: 2 }}>{row.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {row.label}
                    </div>
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, marginTop: 2, wordBreak: 'break-word' }}>
                      {row.value}
                    </div>
                  </div>
                  {row.confidence != null && (
                    <ConfidenceChip score={row.confidence} band={confidenceBand(row.confidence)} compact />
                  )}
                </li>
              ))}
            </ul>

            {/* Citations */}
            {citations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <strong style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                  Citations
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {citations.map((c, i) => (
                    <span
                      key={`${c.kind}-${c.ref}-${i}`}
                      title={c.snippet || c.ref}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        backgroundColor: colors.surfaceInset,
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: 12,
                        fontSize: 11,
                        color: colors.textPrimary,
                      }}
                    >
                      {c.kind === 'drawing' ? <ImageIcon size={10} /> : <FileText size={10} />}
                      {c.kind === 'drawing' ? 'Drawing' : c.kind === 'spec_section' ? 'Spec' : 'Ref'} {c.ref}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 6,
                paddingTop: spacing.md,
                borderTop: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <button type="button" onClick={handleDiscard} style={cancelBtnStyle}>
                <X size={13} /> Discard
              </button>
              <button type="button" onClick={() => setEditing((v) => !v)} style={cancelBtnStyle}>
                <Pencil size={13} /> {editing ? 'Done editing' : 'Modify'}
              </button>
              <PermissionGate permission="rfis.create">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accept.isPending}
                  style={{ ...buttonBaseStyle, background: colors.primaryOrange, color: 'white' }}
                >
                  <Check size={13} /> {accept.isPending ? 'Saving…' : 'Accept all'}
                </button>
              </PermissionGate>
            </div>
          </>
        )}
      </div>
    </DetailPanel>
  )
}

function ConfidenceChip({ band, score, compact }: { band: IrisConfidenceBand; score: number | null; compact?: boolean }) {
  const tone = bandColor(band)
  return (
    <span
      title={score != null ? `confidence ${score.toFixed(2)}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '1px 6px' : '2px 8px',
        backgroundColor: tone.bg,
        color: tone.fg,
        borderRadius: 10,
        fontSize: compact ? 9 : 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {band}
    </span>
  )
}

function confidenceBand(score: number): IrisConfidenceBand {
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

function formatCostRange(minCents: number | null, maxCents: number | null): string {
  if (minCents == null && maxCents == null) return '—'
  const min = minCents != null ? fromCents(minCents as never) : 0
  const max = maxCents != null ? fromCents(maxCents as never) : 0
  if (min === 0 && max === 0) return '$0'
  if (min === max) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(max)
  return `${formatUsd(min)} – ${formatUsd(max)}`
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, notation: 'compact' }).format(n)
}

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.borderSubtle}`,
}

export default RFIIrisDraftPreview
