import React from 'react'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { ComparisonBlock } from './types'

interface Props {
  block: ComparisonBlock
}

const highlightColors: Record<string, { bg: string; color: string }> = {
  better: { bg: colors.statusActiveSubtle, color: colors.statusActive },
  worse: { bg: colors.statusCriticalSubtle, color: colors.statusCritical },
  neutral: { bg: 'transparent', color: colors.textPrimary },
}

export const GenComparison: React.FC<Props> = React.memo(({ block }) => (
  <div style={{
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
    fontFamily: typography.fontFamily,
  }}>
    {block.title && (
      <div style={{
        padding: `${spacing['3']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
      }}>
        {block.title}
      </div>
    )}

    {/* Column headers */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: `160px repeat(${block.columns.length}, 1fr)`,
      padding: `${spacing['2']} ${spacing['4']}`,
      backgroundColor: colors.surfaceInset,
      borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <div />
      {block.columns.map((col, i) => (
        <div key={i} style={{
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: typography.letterSpacing.wider,
          textAlign: 'center',
        }}>
          {col}
        </div>
      ))}
    </div>

    {/* Rows */}
    {block.rows.map((row, i) => {
      const hl = highlightColors[row.highlight || 'neutral']
      return (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: `160px repeat(${block.columns.length}, 1fr)`,
            padding: `${spacing['2']} ${spacing['4']}`,
            borderBottom: i < block.rows.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            backgroundColor: hl.bg,
          }}
        >
          <div style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: colors.textPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: spacing['1'],
          }}>
            {row.highlight === 'better' && <ArrowUp size={12} color={colors.statusActive} />}
            {row.highlight === 'worse' && <ArrowDown size={12} color={colors.statusCritical} />}
            {row.highlight === 'neutral' && <Minus size={12} color={colors.textTertiary} />}
            {row.label}
          </div>
          {row.values.map((val, j) => (
            <div key={j} style={{
              fontSize: typography.fontSize.sm,
              color: hl.color,
              fontWeight: typography.fontWeight.medium,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {val}
            </div>
          ))}
        </div>
      )
    })}
  </div>
))
