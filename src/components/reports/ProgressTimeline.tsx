// ProgressTimeline — Horizontal milestone timeline for the Owner Report.
// Color-coded: green (complete), blue (on track), yellow (at risk), red (behind).
// Current date marker, percentage complete per phase.

import React, { useRef, useEffect, useState } from 'react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import type { MilestoneItem } from '../../services/reportService'

interface ProgressTimelineProps {
  milestones: MilestoneItem[]
}

const STATUS_COLORS: Record<MilestoneItem['status'], { fill: string; bg: string; label: string }> = {
  complete: { fill: '#22C55E', bg: '#DCFCE7', label: 'Complete' },
  on_track: { fill: '#3B82F6', bg: '#DBEAFE', label: 'On Track' },
  at_risk: { fill: '#F59E0B', bg: '#FEF3C7', label: 'At Risk' },
  behind: { fill: '#EF4444', bg: '#FEE2E2', label: 'Behind' },
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ milestones }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Auto-scroll to current date marker on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const marker = scrollRef.current.querySelector('[data-current-marker]')
    if (marker) {
      marker.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [milestones])

  if (milestones.length === 0) {
    return (
      <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textTertiary }}>
        <p style={{ fontSize: typography.fontSize.body, margin: 0 }}>No milestones to display</p>
      </div>
    )
  }

  // Find index closest to "today" for the current date marker
  const now = new Date()
  let currentIdx = milestones.findIndex((m) => {
    const d = new Date(m.date)
    return d >= now
  })
  if (currentIdx === -1) currentIdx = milestones.length - 1

  return (
    <div style={{ width: '100%' }}>
      {/* Legend */}
      <div style={{
        display: 'flex', gap: spacing['4'], marginBottom: spacing['4'],
        flexWrap: 'wrap',
      }}>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'] }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: val.fill,
            }} />
            <span style={{
              fontSize: typography.fontSize.caption,
              color: colors.textSecondary,
              fontWeight: typography.fontWeight.medium,
            }}>
              {val.label}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline scroll container */}
      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          paddingBottom: spacing['4'],
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          minWidth: Math.max(milestones.length * 160, 600),
          position: 'relative',
          paddingTop: spacing['8'],
          paddingBottom: spacing['2'],
        }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute',
            top: 42,
            left: 40,
            right: 40,
            height: 3,
            backgroundColor: colors.surfaceInset,
            borderRadius: 2,
          }} />

          {/* Progress fill */}
          {milestones.length > 1 && (
            <div style={{
              position: 'absolute',
              top: 42,
              left: 40,
              height: 3,
              backgroundColor: colors.primaryOrange,
              borderRadius: 2,
              width: `${(currentIdx / (milestones.length - 1)) * (100 - (80 / (milestones.length * 160)) * 100)}%`,
              transition: 'width 0.6s ease',
            }} />
          )}

          {milestones.map((milestone, idx) => {
            const sc = STATUS_COLORS[milestone.status]
            const isHovered = hoveredIdx === idx
            const isCurrent = idx === currentIdx

            return (
              <div
                key={idx}
                data-current-marker={isCurrent ? '' : undefined}
                style={{
                  flex: '1 0 140px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  cursor: 'default',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Current date indicator */}
                {isCurrent && (
                  <div style={{
                    position: 'absolute',
                    top: -4,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.primaryOrange,
                    whiteSpace: 'nowrap',
                    letterSpacing: typography.letterSpacing.wider,
                    textTransform: 'uppercase',
                  }}>
                    TODAY
                  </div>
                )}

                {/* Node */}
                <div style={{
                  width: isHovered ? 22 : 18,
                  height: isHovered ? 22 : 18,
                  borderRadius: '50%',
                  backgroundColor: sc.fill,
                  border: `3px solid ${colors.surfaceRaised}`,
                  boxShadow: isHovered ? `0 0 0 3px ${sc.fill}40` : 'none',
                  transition: 'all 0.2s ease',
                  zIndex: 1,
                  marginTop: isCurrent ? 8 : 12,
                }} />

                {/* Percentage */}
                <div style={{
                  marginTop: spacing['2'],
                  fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.bold,
                  color: sc.fill,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {milestone.percentComplete}%
                </div>

                {/* Name */}
                <div style={{
                  marginTop: spacing['1'],
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary,
                  textAlign: 'center',
                  lineHeight: typography.lineHeight.snug,
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {milestone.name}
                </div>

                {/* Date */}
                <div style={{
                  marginTop: spacing['1'],
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  whiteSpace: 'nowrap',
                }}>
                  {milestone.date}
                </div>

                {/* Hover tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    top: -48,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.md,
                    padding: `${spacing['1.5']} ${spacing['3']}`,
                    boxShadow: shadows.dropdown,
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                  }}>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: sc.fill,
                    }}>
                      {sc.label}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
