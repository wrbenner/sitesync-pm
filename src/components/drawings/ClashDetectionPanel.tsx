import React from 'react'
import { AlertTriangle, Check, FileQuestion, X } from 'lucide-react'
import { colors, spacing } from '../../styles/theme'
import { Btn } from '../Primitives'
import type { DrawingDiscrepancy, DiscrepancySeverity } from '../../types/ai'
import {
  useConfirmDiscrepancy,
  useDismissDiscrepancy,
} from '../../hooks/useDrawingIntelligence'
import { useLogCorrection } from '../../hooks/useAITrainingCorrections'

interface ClashDetectionPanelProps {
  projectId: string
  drawingId?: string
  discrepancies: DrawingDiscrepancy[]
  loading?: boolean
  onCreateRFI?: (d: DrawingDiscrepancy) => void
  onViewDetail?: (d: DrawingDiscrepancy) => void
  onClose?: () => void
}

const SEVERITY_COLOR: Record<DiscrepancySeverity, string> = {
  high: colors.statusCritical,
  medium: colors.statusPending,
  low: colors.statusActive,
}

const SEVERITY_LABEL: Record<DiscrepancySeverity, string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
}

export const ClashDetectionPanel: React.FC<ClashDetectionPanelProps> = ({
  projectId,
  drawingId,
  discrepancies,
  loading,
  onCreateRFI,
  onViewDetail,
  onClose,
}) => {
  const confirmMutation = useConfirmDiscrepancy()
  const dismissMutation = useDismissDiscrepancy()
  const logCorrection = useLogCorrection()

  const active = discrepancies.filter((d) => !d.is_false_positive)

  return (
    <aside
      aria-label="Clash detection panel"
      style={{
        width: '100%',
        minHeight: 240,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: 8,
        padding: spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} color={colors.primaryOrange} />
          <span style={{ fontWeight: 600, color: colors.textPrimary }}>
            Clash Detection
          </span>
          <span
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              backgroundColor: colors.surfacePage,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {active.length}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close clash panel"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        )}
      </header>

      {loading && (
        <div style={{ fontSize: 13, color: colors.textSecondary }}>Loading discrepancies…</div>
      )}

      {!loading && active.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            padding: spacing.md,
            textAlign: 'center',
          }}
        >
          No discrepancies detected. Drawings look aligned.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
        {active.map((d) => {
          const severity = (d.severity ?? 'low') as DiscrepancySeverity
          const color = SEVERITY_COLOR[severity] ?? colors.statusPending
          const confidencePct =
            typeof d.confidence === 'number' ? Math.round(d.confidence * 100) : null
          return (
            <article
              key={d.id}
              style={{
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 8,
                padding: spacing.md,
                backgroundColor: colors.surfacePage,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.sm,
                opacity: d.user_confirmed ? 1 : 0.96,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: `${color}22`,
                    color,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: 0.4,
                  }}
                >
                  {SEVERITY_LABEL[severity]}
                </span>
                {d.user_confirmed && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: `${colors.statusActive}22`,
                      color: colors.statusActive,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Confirmed
                  </span>
                )}
                {d.auto_rfi_id && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      backgroundColor: `${colors.primaryOrange}22`,
                      color: colors.primaryOrange,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    RFI drafted
                  </span>
                )}
                {confidencePct !== null && (
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>
                    {confidencePct}% confidence
                  </span>
                )}
              </div>

              <div style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 600 }}>
                {d.description}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: spacing.sm,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: colors.textPrimary }}>Arch</div>
                  <div>{d.arch_dimension ?? '—'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: colors.textPrimary }}>Struct</div>
                  <div>{d.struct_dimension ?? '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
                {onViewDetail && (
                  <Btn
                    variant="ghost"
                    size="sm"
                    aria-label="View discrepancy detail"
                    onClick={() => onViewDetail(d)}
                  >
                    View Detail
                  </Btn>
                )}
                {!d.auto_rfi_id && onCreateRFI && (
                  <Btn
                    variant="primary"
                    size="sm"
                    icon={<FileQuestion size={14} />}
                    aria-label="Create RFI for this discrepancy"
                    onClick={() => onCreateRFI(d)}
                  >
                    Create RFI
                  </Btn>
                )}
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<Check size={14} />}
                  aria-label="Confirm discrepancy"
                  disabled={d.user_confirmed || confirmMutation.isPending}
                  onClick={() => {
                    confirmMutation.mutate({ id: d.id, projectId, drawingId })
                    logCorrection.mutate({
                      correctionType: 'discrepancy',
                      projectId,
                      drawingId: drawingId ?? null,
                      sourceTable: 'drawing_discrepancies',
                      sourceRecordId: d.id,
                      originalValue: { severity: d.severity, user_confirmed: false, is_false_positive: false },
                      correctedValue: { user_confirmed: true, is_false_positive: false, label: 'correct' },
                    })
                  }}
                >
                  Correct
                </Btn>
                <Btn
                  variant="secondary"
                  size="sm"
                  icon={<X size={14} />}
                  aria-label="Dismiss as false positive"
                  disabled={d.is_false_positive || dismissMutation.isPending}
                  onClick={() => {
                    dismissMutation.mutate({ id: d.id, projectId, drawingId })
                    logCorrection.mutate({
                      correctionType: 'discrepancy',
                      projectId,
                      drawingId: drawingId ?? null,
                      sourceTable: 'drawing_discrepancies',
                      sourceRecordId: d.id,
                      originalValue: { severity: d.severity, user_confirmed: false, is_false_positive: false },
                      correctedValue: { is_false_positive: true, label: 'false_positive' },
                    })
                  }}
                >
                  Dismiss
                </Btn>
              </div>
            </article>
          )
        })}
      </div>
    </aside>
  )
}

export default ClashDetectionPanel
