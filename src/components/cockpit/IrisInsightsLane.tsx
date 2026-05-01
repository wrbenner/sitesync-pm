import React, { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import type {
  IrisInsight,
  IrisInsightSeverity,
} from '../../services/iris/insights'
import { IrisInsightsCard } from './IrisInsightsCard'

const IRIS_INDIGO = '#4F46E5'
const IRIS_INDIGO_BG = 'rgba(79, 70, 229, 0.04)'
const IRIS_INDIGO_BORDER = 'rgba(79, 70, 229, 0.20)'

const SEVERITY_RANK: Record<IrisInsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
}

export interface IrisInsightsLaneProps {
  insights: IrisInsight[]
  onSelect?: (insight: IrisInsight) => void
  limit?: number
}

export const IrisInsightsLane: React.FC<IrisInsightsLaneProps> = ({
  insights,
  onSelect,
  limit = 3,
}) => {
  const top = useMemo(() => {
    return [...insights]
      .sort((a, b) => {
        const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        if (s !== 0) return s
        return (
          (b.estimatedImpact?.dollars ?? 0) -
          (a.estimatedImpact?.dollars ?? 0)
        )
      })
      .slice(0, limit)
  }, [insights, limit])

  if (top.length === 0) return null

  return (
    <section
      role="region"
      aria-label="Iris insights"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: spacing[3],
        padding: `${spacing[3]} ${spacing[5]}`,
        backgroundColor: IRIS_INDIGO_BG,
        borderBottom: `1px solid ${colors.borderDefault}`,
      }}
    >
      <div
        aria-hidden
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          paddingTop: spacing[1],
          paddingRight: spacing[3],
          borderRight: `1px solid ${IRIS_INDIGO_BORDER}`,
          flexShrink: 0,
          minWidth: 96,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: typography.fontFamily,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: IRIS_INDIGO,
          }}
        >
          <Sparkles size={14} strokeWidth={2.25} />
          Iris
        </span>
        <span
          style={{
            fontFamily: typography.fontFamily,
            fontSize: 11,
            color: colors.textTertiary,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Detected risks
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: spacing[3],
          alignItems: 'stretch',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flex: 1,
          minWidth: 0,
        }}
      >
        {top.map((insight) => (
          <IrisInsightsCard
            key={insight.id}
            insight={insight}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

export default IrisInsightsLane
