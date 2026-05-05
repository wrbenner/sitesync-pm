import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function formatLabel(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WorkflowTimeline({
  states,
  currentState,
  completedStates,
  onTransition,
}: WorkflowTimelineProps) {
  const currentIdx = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.max(0, currentIdx)}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        overflowX: 'auto',
        paddingBottom: spacing['1'],
      }}
    >
      {states.map((state, idx) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isLast = idx === states.length - 1
        const canTransition = !!onTransition && isUpcoming && idx === currentIdx + 1

        const circleColor = isCompleted
          ? colors.statusActive
          : isCurrent
          ? colors.primaryOrange
          : colors.borderSubtle

        const labelColor = isCompleted
          ? colors.statusActive
          : isCurrent
          ? colors.textPrimary
          : colors.textTertiary

        const connectorColor = isCompleted || isCurrent
          ? colors.statusActive
          : colors.borderSubtle

        const stepLabel = `Step ${idx + 1}: ${formatLabel(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`

        return (
          <React.Fragment key={state}>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: isLast ? '0 0 auto' : undefined }}
            >
              {/* 56 px transparent hit area satisfies industrial touch-target floor */}
              <button
                aria-label={stepLabel}
                onClick={canTransition ? () => onTransition!(state) : undefined}
                disabled={!canTransition}
                style={{
                  width: 56,
                  height: 56,
                  minWidth: 56,
                  minHeight: 56,
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canTransition ? 'pointer' : 'default',
                  padding: 0,
                  flexShrink: 0,
                  outline: 'none',
                }}
              >
                {/* 32 px visual circle */}
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: circleColor,
                    border: isCurrent ? `2px solid ${colors.primaryOrange}` : '2px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? (
                    <Check size={14} color="#fff" strokeWidth={3} />
                  ) : isCurrent ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        display: 'block',
                        animation: 'pulse 2s ease-in-out infinite',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.textTertiary,
                        display: 'block',
                      }}
                    />
                  )}
                </span>
              </button>
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: labelColor,
                  fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  marginTop: spacing['1'],
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  display: 'block',
                }}
              >
                {formatLabel(state)}
              </span>
            </div>

            {!isLast && (
              <div
                aria-hidden
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 24,
                  backgroundColor: connectorColor,
                  marginBottom: spacing['4'],
                  transition: 'background-color 0.3s ease',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default WorkflowTimeline
