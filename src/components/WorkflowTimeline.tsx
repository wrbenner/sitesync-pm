import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, touchTarget } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function formatLabel(state: string): string {
  return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WorkflowTimeline({ states, currentState, completedStates, onTransition }: WorkflowTimelineProps) {
  const currentIndex = states.indexOf(currentState)
  const total = states.length

  return (
    <nav
      role="progressbar"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-label="Workflow progress"
      style={{ width: '100%' }}
    >
      <ol
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing['2'],
          listStyle: 'none',
          margin: 0,
          padding: 0,
          alignItems: 'center',
        }}
      >
        {states.map((state, index) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isUpcoming = !isCompleted && !isCurrent
          const isLast = index === total - 1

          const nextState = states[index + 1]
          const canTransition = isCurrent && nextState && onTransition

          let circleBackground: string
          let circleColor: string
          let circleBorder: string

          if (isCompleted) {
            circleBackground = colors.statusActive
            circleColor = '#ffffff'
            circleBorder = colors.statusActive
          } else if (isCurrent) {
            circleBackground = colors.brand500
            circleColor = '#ffffff'
            circleBorder = colors.brand500
          } else {
            circleBackground = colors.surfacePage
            circleColor = colors.textTertiary
            circleBorder = colors.borderDefault
          }

          const labelState = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'

          return (
            <React.Fragment key={state}>
              <li
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}
              >
                <button
                  type="button"
                  disabled={!canTransition}
                  onClick={canTransition ? () => onTransition!(nextState) : undefined}
                  aria-label={`Step ${index + 1}: ${formatLabel(state)} — ${labelState}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  style={{
                    width: touchTarget.field,
                    height: touchTarget.field,
                    borderRadius: '50%',
                    border: `2px solid ${circleBorder}`,
                    background: circleBackground,
                    color: circleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canTransition ? 'pointer' : 'default',
                    padding: 0,
                    position: 'relative',
                    transition: transitions.default,
                    flexShrink: 0,
                  }}
                >
                  {isCompleted ? (
                    <Check size={20} strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: '#ffffff',
                        }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          inset: -4,
                          borderRadius: '50%',
                          border: `2px solid ${colors.brand500}`,
                          opacity: 0.4,
                          animation: 'wt-pulse 2s ease-in-out infinite',
                        }}
                      />
                    </>
                  ) : (
                    <span
                      style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        color: circleColor,
                        lineHeight: 1,
                      }}
                    >
                      {index + 1}
                    </span>
                  )}
                </button>
                <span
                  aria-hidden="true"
                  style={{
                    marginTop: spacing['1.5'],
                    fontSize: typography.fontSize.caption,
                    fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.regular,
                    color: isCurrent ? colors.brand500 : isCompleted ? colors.textSecondary : colors.textTertiary,
                    textAlign: 'center',
                    maxWidth: 80,
                    lineHeight: 1.3,
                  }}
                >
                  {formatLabel(state)}
                </span>
              </li>

              {/* Connector line between steps */}
              {!isLast && (
                <li
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    minWidth: spacing['6'],
                    height: 2,
                    background: isCompleted ? colors.statusActive : colors.borderDefault,
                    borderRadius: borderRadius.pill,
                    marginBottom: spacing['5'],
                    transition: transitions.default,
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </ol>

      {/* Pulse animation — injected once per page */}
      <style>{`
        @keyframes wt-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0.15; }
        }
      `}</style>
    </nav>
  )
}

export default WorkflowTimeline
