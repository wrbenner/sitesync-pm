import React from 'react'
import { AlertCircle, ArrowUpRight } from 'lucide-react'
import { colors, typography, spacing, borderRadius } from '../../styles/theme'
import type {
  IrisInsight,
  IrisInsightSeverity,
} from '../../services/iris/insights'

const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)'

const SEVERITY_DOT: Record<IrisInsightSeverity, string> = {
  critical: colors.statusCritical,
  high: colors.statusWarning,
  medium: colors.statusInfo,
}

const SEVERITY_LABEL: Record<IrisInsightSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Watch',
}

function formatDollars(n: number | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}

function formatDays(n: number | undefined): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  return `+${Math.round(n)}d`
}

function sourceTrailLabel(insight: IrisInsight): string {
  const trail = insight.sourceTrail
  if (!trail || trail.length === 0) return 'Iris detected'
  const head = trail[0]
  const rest = trail.length - 1
  const base = head.title || head.type
  return rest > 0 ? `${base} +${rest}` : base
}

export interface IrisInsightsCardProps {
  insight: IrisInsight
  onSelect?: (insight: IrisInsight) => void
}

export const IrisInsightsCard: React.FC<IrisInsightsCardProps> = ({
  insight,
  onSelect,
}) => {
  const dot = SEVERITY_DOT[insight.severity]
  const dollars = formatDollars(insight.estimatedImpact?.dollars)
  const days = formatDays(insight.estimatedImpact?.scheduleDays)
  const impactLine = insight.impactChain[0] ?? ''
  const trail = sourceTrailLabel(insight)
  const interactive = !!onSelect

  return (
    <button
      type="button"
      onClick={interactive ? () => onSelect(insight) : undefined}
      disabled={!interactive}
      aria-label={`${SEVERITY_LABEL[insight.severity]} risk: ${insight.headline}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[2],
        minWidth: 280,
        maxWidth: 360,
        padding: spacing[4],
        textAlign: 'left',
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${IRIS_INDIGO_BORDER}`,
        borderRadius: borderRadius.md,
        cursor: interactive ? 'pointer' : 'default',
        flexShrink: 0,
        fontFamily: typography.fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: dot,
          }}
        >
          {SEVERITY_LABEL[insight.severity]}
        </span>
        {interactive && (
          <ArrowUpRight
            size={14}
            color={IRIS_INDIGO}
            strokeWidth={2.25}
            aria-hidden
            style={{ marginLeft: 'auto' }}
          />
        )}
      </div>

      <div
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {insight.headline}
      </div>

      {impactLine && (
        <div
          style={{
            fontSize: typography.fontSize.caption,
            color: colors.textSecondary,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={insight.impactChain.join(' → ')}
        >
          {impactLine}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          marginTop: 'auto',
        }}
      >
        {(dollars || days) && (
          <span
            style={{
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {[dollars && `${dollars} exposed`, days && `${days} slip`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}

        <span
          aria-label="Source"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 'auto',
            padding: '2px 7px',
            borderRadius: borderRadius.full ?? 999,
            border: `1px solid ${IRIS_INDIGO_BORDER}`,
            backgroundColor: 'rgba(79, 70, 229, 0.06)',
            color: IRIS_INDIGO,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={trail}
        >
          <AlertCircle size={10} strokeWidth={2.25} aria-hidden />
          {trail}
        </span>
      </div>
    </button>
  )
}

export default IrisInsightsCard
