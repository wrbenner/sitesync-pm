import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { MetricCardsBlock } from './types'

interface Props {
  block: MetricCardsBlock
}

const statusColors: Record<string, { bg: string; accent: string }> = {
  good: { bg: colors.statusActiveSubtle, accent: colors.statusActive },
  warning: { bg: colors.statusPendingSubtle, accent: colors.statusPending },
  critical: { bg: colors.statusCriticalSubtle, accent: colors.statusCritical },
  neutral: { bg: colors.surfaceInset, accent: colors.textTertiary },
}

export const GenMetricCards: React.FC<Props> = React.memo(({ block }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.min(block.cards.length, 4)}, 1fr)`,
    gap: spacing['3'],
  }}>
    {block.cards.map((card, i) => {
      const sc = statusColors[card.status || 'neutral']
      return (
        <div
          key={i}
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            padding: spacing['4'],
            border: `1px solid ${colors.borderSubtle}`,
            borderLeft: `3px solid ${sc.accent}`,
            cursor: card.link ? 'pointer' : 'default',
          }}
          onClick={card.link ? () => { window.location.hash = `#${card.link}` } : undefined}
          role={card.link ? 'link' : undefined}
        >
          <div style={{
            fontSize: typography.fontSize.caption,
            fontWeight: typography.fontWeight.medium,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: typography.letterSpacing.wider,
            marginBottom: spacing['2'],
          }}>
            {card.label}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: spacing['1'],
          }}>
            <span style={{
              fontSize: typography.fontSize['3xl'],
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              lineHeight: typography.lineHeight.none,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {card.value}
            </span>
            {card.unit && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                {card.unit}
              </span>
            )}
          </div>
          {card.change !== undefined && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1'],
              marginTop: spacing['2'],
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              color: card.change > 0 ? colors.statusActive : card.change < 0 ? colors.statusCritical : colors.textTertiary,
            }}>
              {card.change > 0 ? <TrendingUp size={12} /> : card.change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              <span>{card.change > 0 ? '+' : ''}{card.change}%</span>
              {card.changeLabel && <span style={{ color: colors.textTertiary }}>{card.changeLabel}</span>}
            </div>
          )}
        </div>
      )
    })}
  </div>
))
