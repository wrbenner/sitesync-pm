import React from 'react'
import { X, FileQuestion, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  zIndex,
} from '../../styles/theme'
import type {
  DrawingDiscrepancy,
  DiscrepancySeverity,
  DrawingPair,
} from '../../types/ai'
import { Btn } from '../Primitives'

// Adapted from SiteSync AI:
//   sitesyncai-web/app/components/DiscrepancyModal/DiscrepancyModal.tsx
// Rewritten to show side-by-side arch/struct images with highlighted conflict
// regions, dimension comparison, severity badge, and action buttons.

interface DiscrepancyDetailModalProps {
  discrepancy: DrawingDiscrepancy | null
  pair?: DrawingPair | null
  archImageUrl?: string | null
  structImageUrl?: string | null
  archOverlayUrl?: string | null
  structOverlayUrl?: string | null
  open: boolean
  onClose: () => void
  onCreateRFI?: (d: DrawingDiscrepancy) => void
  onMarkFalsePositive?: (d: DrawingDiscrepancy) => void
  onAcceptRisk?: (d: DrawingDiscrepancy) => void
}

const SEVERITY_META: Record<
  DiscrepancySeverity,
  { label: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }
> = {
  high: { label: 'HIGH SEVERITY', color: colors.statusCritical, icon: ShieldAlert },
  medium: { label: 'MEDIUM SEVERITY', color: colors.statusPending, icon: AlertTriangle },
  low: { label: 'LOW SEVERITY', color: colors.statusActive, icon: CheckCircle2 },
}

function ImagePanel({
  title,
  src,
  overlay,
  bbox,
}: {
  title: string
  src?: string | null
  overlay?: string | null
  bbox?: { x?: number; y?: number; w?: number; h?: number } | null
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        background: colors.surfaceInset,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: `${spacing['2']} ${spacing['3']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: 'relative',
          aspectRatio: '4 / 3',
          background: colors.surfacePage,
        }}
      >
        {src ? (
          <img
            src={src}
            alt={`${title} drawing`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textTertiary,
              fontSize: typography.fontSize.caption,
            }}
          >
            No image
          </div>
        )}
        {overlay && (
          <img
            src={overlay}
            alt={`${title} conflict overlay`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              mixBlendMode: 'multiply',
            }}
          />
        )}
        {bbox && typeof bbox.x === 'number' && typeof bbox.y === 'number' && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${bbox.x}%`,
              top: `${bbox.y}%`,
              width: `${bbox.w ?? 10}%`,
              height: `${bbox.h ?? 10}%`,
              border: `3px dashed ${colors.statusCritical}`,
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  )
}

export const DiscrepancyDetailModal: React.FC<DiscrepancyDetailModalProps> = ({
  discrepancy,
  archImageUrl,
  structImageUrl,
  archOverlayUrl,
  structOverlayUrl,
  open,
  onClose,
  onCreateRFI,
  onMarkFalsePositive,
  onAcceptRisk,
}) => {
  if (!open || !discrepancy) return null
  const severity = (discrepancy.severity ?? 'low') as DiscrepancySeverity
  const meta = SEVERITY_META[severity]
  const SeverityIcon = meta.icon
  const confidencePct =
    typeof discrepancy.confidence === 'number'
      ? Math.round(discrepancy.confidence * 100)
      : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discrepancy-detail-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: zIndex.modal,
        padding: spacing['4'],
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          width: 'min(960px, 100%)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: shadows.lg,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing['4'],
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <SeverityIcon size={22} color={meta.color} />
            <div>
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: `${meta.color}22`,
                  color: meta.color,
                  fontWeight: typography.fontWeight.bold,
                  fontSize: typography.fontSize.caption,
                  letterSpacing: '0.04em',
                  display: 'inline-block',
                  marginBottom: 4,
                }}
              >
                {meta.label}
              </div>
              <h2
                id="discrepancy-detail-title"
                style={{
                  margin: 0,
                  fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                }}
              >
                Discrepancy Detail
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close discrepancy detail"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              padding: spacing['2'],
            }}
          >
            <X size={20} />
          </button>
        </header>

        <div
          style={{
            padding: spacing['4'],
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing['4'],
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: typography.fontSize.body,
              color: colors.textPrimary,
              lineHeight: 1.5,
            }}
          >
            {discrepancy.description}
          </p>

          {/* Image comparison */}
          <div style={{ display: 'flex', gap: spacing['3'], flexWrap: 'wrap' }}>
            <ImagePanel
              title="Architectural"
              src={archImageUrl}
              overlay={archOverlayUrl}
              bbox={discrepancy.location_on_drawing}
            />
            <ImagePanel
              title="Structural"
              src={structImageUrl}
              overlay={structOverlayUrl}
              bbox={discrepancy.location_on_drawing}
            />
          </div>

          {/* Dimension comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: spacing['3'],
              padding: spacing['3'],
              background: colors.surfaceInset,
              borderRadius: borderRadius.md,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: typography.fontSize.caption,
                  textTransform: 'uppercase',
                  color: colors.textTertiary,
                  marginBottom: 4,
                  letterSpacing: '0.04em',
                }}
              >
                Architectural
              </div>
              <div
                style={{
                  fontSize: typography.fontSize.subtitle,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilyMono,
                }}
              >
                {discrepancy.arch_dimension ?? '—'}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: typography.fontSize.caption,
                  textTransform: 'uppercase',
                  color: colors.textTertiary,
                  marginBottom: 4,
                  letterSpacing: '0.04em',
                }}
              >
                Structural
              </div>
              <div
                style={{
                  fontSize: typography.fontSize.subtitle,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  fontFamily: typography.fontFamilyMono,
                }}
              >
                {discrepancy.struct_dimension ?? '—'}
              </div>
            </div>
          </div>

          {confidencePct !== null && (
            <div
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
              }}
            >
              AI confidence: <strong>{confidencePct}%</strong>
            </div>
          )}
        </div>

        {/* Actions */}
        <footer
          style={{
            padding: spacing['4'],
            borderTop: `1px solid ${colors.borderSubtle}`,
            display: 'flex',
            gap: spacing['2'],
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {onMarkFalsePositive && !discrepancy.is_false_positive && (
            <Btn
              variant="secondary"
              size="md"
              icon={<X size={16} />}
              onClick={() => onMarkFalsePositive(discrepancy)}
            >
              Mark as False Positive
            </Btn>
          )}
          {onAcceptRisk && (
            <Btn
              variant="secondary"
              size="md"
              icon={<CheckCircle2 size={16} />}
              onClick={() => onAcceptRisk(discrepancy)}
            >
              Accept Risk
            </Btn>
          )}
          {onCreateRFI && !discrepancy.auto_rfi_id && (
            <Btn
              variant="primary"
              size="md"
              icon={<FileQuestion size={16} />}
              onClick={() => onCreateRFI(discrepancy)}
            >
              Create RFI
            </Btn>
          )}
        </footer>
      </div>
    </div>
  )
}

export default DiscrepancyDetailModal
