import React from 'react'
import { riskColor, riskLevel, type RiskLevel } from '../../lib/riskEngine'
import { spacing, typography, borderRadius } from '../../styles/theme'

interface RiskBadgeProps {
  score: number
  size?: 'sm' | 'md'
  showLabel?: boolean
  title?: string
}

const LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, size = 'sm', showLabel = false, title }) => {
  const color = riskColor(score)
  const level = riskLevel(score)
  const isSmall = size === 'sm'
  return (
    <span
      title={title ?? `Risk ${score}/100 (${LABEL[level]})`}
      role="status"
      aria-label={`Risk score ${score}, level ${LABEL[level]}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing['1'],
        padding: isSmall ? `${spacing['1']} ${spacing['2']}` : `${spacing['2']} ${spacing['3']}`,
        borderRadius: borderRadius.full,
        backgroundColor: `${color}22`,
        color,
        fontSize: isSmall ? typography.fontSize.caption : typography.fontSize.label,
        fontWeight: typography.fontWeight.semibold,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden
        style={{
          width: isSmall ? 6 : 8,
          height: isSmall ? 6 : 8,
          borderRadius: '50%',
          backgroundColor: color,
        }}
      />
      {score}
      {showLabel && <span style={{ fontWeight: typography.fontWeight.medium }}>{LABEL[level]}</span>}
    </span>
  )
}

export default RiskBadge
