/**
 * WorkflowTimeline — horizontal stepper showing state-machine progress.
 * Used across RFIs, Submittals, Change Orders, Pay Apps, and Punch Items.
 */
import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  /** Optional human-readable labels keyed by state name. Falls back to capitalised state. */
  labels?: Record<string, string>
  onTransition?: (nextState: string) => void
}

function label(state: string, labels?: Record<string, string>): string {
  if (labels?.[state]) return labels[state]
  return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  labels,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-valuenow={Math.max(0, currentIndex)}
      aria-label={`Workflow progress: ${label(currentState, labels)}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        overflowX: 'auto',
        padding: `${spacing['3']} 0`,
        // Vertical stack on mobile via media-query workaround using flexWrap
      }}
    >
      {states.map((state, i) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isLast = i === states.length - 1

        let dotBg = colors.surfaceRaised
        let dotBorder = colors.borderDefault
        let dotColor = colors.textTertiary
        let textColor = colors.textTertiary
        let fontWeight = typography.fontWeight.regular

        if (isCompleted) {
          dotBg = colors.statusActive
          dotBorder = colors.statusActive
          dotColor = '#fff'
          textColor = colors.textPrimary
          fontWeight = typography.fontWeight.medium
        } else if (isCurrent) {
          dotBg = colors.orangeText
          dotBorder = colors.orangeText
          dotColor = '#fff'
          textColor = colors.textPrimary
          fontWeight = typography.fontWeight.semibold
        }

        return (
          <div
            key={state}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: isLast ? '0 0 auto' : '1 1 0',
              minWidth: 0,
            }}
          >
            {/* Step node */}
            <button
              aria-label={`Step ${i + 1}: ${label(state, labels)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
              aria-current={isCurrent ? 'step' : undefined}
              disabled={!onTransition || isCompleted || isCurrent}
              onClick={() => onTransition?.(state)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['1'],
                background: 'none',
                border: 'none',
                padding: `0 ${spacing['2']}`,
                cursor: onTransition && !isCompleted && !isCurrent ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: dotBg,
                  border: `2px solid ${dotBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'background-color 0.2s, border-color 0.2s',
                  flexShrink: 0,
                }}
              >
                {isCompleted ? (
                  <Check size={14} color={dotColor} strokeWidth={3} />
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor }} />
                )}
                {/* Pulsing ring for current state */}
                {isCurrent && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      border: `2px solid ${colors.orangeText}`,
                      opacity: 0.35,
                      animation: 'wt-pulse 1.8s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
              {/* Label */}
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight,
                  color: textColor,
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {label(state, labels)}
              </span>
            </button>

            {/* Connector line (except after last node) */}
            {!isLast && (
              <div
                aria-hidden
                style={{
                  flex: 1,
                  height: 2,
                  marginBottom: 20, // align with circle centers
                  backgroundColor: isCompleted ? colors.statusActive : colors.borderDefault,
                  transition: 'background-color 0.3s',
                  minWidth: 16,
                }}
              />
            )}
          </div>
        )
      })}

      {/* Keyframe injection — scoped to this component's usage */}
      <style>{`
        @keyframes wt-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.3); opacity: 0.1; }
        }
      `}</style>
    </div>
  )
}
