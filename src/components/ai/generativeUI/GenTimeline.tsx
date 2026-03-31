import React from 'react'
import { CheckCircle, Clock, Circle } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { TimelineBlock } from './types'

interface Props {
  block: TimelineBlock
}

const statusIcon = (status?: string) => {
  switch (status) {
    case 'complete': return <CheckCircle size={16} color={colors.statusActive} />
    case 'active': return <Clock size={16} color={colors.statusInfo} />
    default: return <Circle size={16} color={colors.textTertiary} />
  }
}

const statusDotColor = (status?: string) => {
  switch (status) {
    case 'complete': return colors.statusActive
    case 'active': return colors.statusInfo
    default: return colors.borderDefault
  }
}

export const GenTimeline: React.FC<Props> = React.memo(({ block }) => (
  <div style={{
    backgroundColor: colors.surfaceRaised,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.borderSubtle}`,
    padding: spacing['4'],
    fontFamily: typography.fontFamily,
  }}>
    {block.title && (
      <div style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing['4'],
      }}>
        {block.title}
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {block.events.map((event, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: spacing['3'],
            position: 'relative',
            paddingBottom: i < block.events.length - 1 ? spacing['4'] : 0,
          }}
        >
          {/* Timeline line */}
          {i < block.events.length - 1 && (
            <div style={{
              position: 'absolute',
              left: 7,
              top: 20,
              bottom: 0,
              width: 2,
              backgroundColor: statusDotColor(event.status),
            }} />
          )}

          {/* Icon */}
          <div style={{ flexShrink: 0, paddingTop: 1 }}>
            {statusIcon(event.status)}
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              marginBottom: spacing['0.5'],
            }}>
              {event.title}
            </div>
            {event.description && (
              <div style={{
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
                lineHeight: typography.lineHeight.relaxed,
                marginBottom: spacing['1'],
              }}>
                {event.description}
              </div>
            )}
            <div style={{
              fontSize: '10px',
              color: colors.textTertiary,
              fontWeight: typography.fontWeight.medium,
            }}>
              {event.date}
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
))
