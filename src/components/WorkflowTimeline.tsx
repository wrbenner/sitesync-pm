import React from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function formatLabel(state: string): string {
  return state
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const PULSE_KEYFRAMES = `
@keyframes wf-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.5; }
}
`

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  return (
    <>
      <style>{PULSE_KEYFRAMES}</style>
      <div
        role="progressbar"
        aria-valuenow={currentIndex >= 0 ? currentIndex : 0}
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        aria-label={`Workflow: ${formatLabel(currentState)}`}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 0,
          width: '100%',
          padding: '4px 0',
        }}
      >
        {states.map((state, idx) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isUpcoming = !isCompleted && !isCurrent
          const isLast = idx === states.length - 1
          const canTransitionTo = onTransition && isUpcoming && idx === currentIndex + 1

          // Colors
          const circleColor = isCompleted
            ? colors.statusActive
            : isCurrent
            ? colors.primaryOrange
            : colors.borderDefault
          const labelColor = isCompleted || isCurrent ? colors.textPrimary : colors.textTertiary
          const lineColor = isCompleted ? colors.statusActive : colors.borderSubtle

          const stepLabel = `Step ${idx + 1}: ${formatLabel(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`

          return (
            <React.Fragment key={state}>
              {/* Step node */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  flex: '0 0 auto',
                  minWidth: 56,
                }}
              >
                {/* Circle */}
                <button
                  onClick={canTransitionTo ? () => onTransition!(state) : undefined}
                  disabled={!canTransitionTo}
                  aria-label={stepLabel}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: circleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canTransitionTo ? 'pointer' : 'default',
                    padding: 0,
                    position: 'relative',
                    transition: 'box-shadow 0.15s',
                    boxShadow: isCurrent ? `0 0 0 3px ${colors.primaryOrange}25` : 'none',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (canTransitionTo) {
                      e.currentTarget.style.boxShadow = `0 0 0 5px ${colors.primaryOrange}30`
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = isCurrent
                      ? `0 0 0 3px ${colors.primaryOrange}25`
                      : 'none'
                  }}
                >
                  {isCompleted ? (
                    <Check size={14} color="#fff" strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        animation: 'wf-pulse 1.8s ease-in-out infinite',
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.textTertiary,
                        opacity: 0.5,
                      }}
                    />
                  )}
                </button>

                {/* Label */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    color: labelColor,
                    textAlign: 'center',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    letterSpacing: isCurrent ? '0.01em' : 0,
                  }}
                >
                  {formatLabel(state)}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 2,
                    marginTop: 13,
                    backgroundColor: lineColor,
                    minWidth: 8,
                    transition: 'background-color 0.3s',
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
