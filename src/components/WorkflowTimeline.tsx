import React from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'
import { useMediaQuery } from '../hooks/useMediaQuery'

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
  const isMobile = useMediaQuery('(max-width: 768px)')

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
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'flex-start',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
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
                  flexDirection: isMobile ? 'row' : 'column',
                  alignItems: 'center',
                  gap: isMobile ? 12 : 6,
                  flex: '0 0 auto',
                  minWidth: isMobile ? undefined : 56,
                }}
              >
                {/* 56×56 touch-target button (industrial-glove compliant) wrapping the 28×28 visual circle */}
                <button
                  onClick={canTransitionTo ? () => onTransition!(state) : undefined}
                  disabled={!canTransitionTo}
                  aria-label={stepLabel}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canTransitionTo ? 'pointer' : 'default',
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  {/* Visual circle (28×28) */}
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: circleColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isCurrent ? `0 0 0 3px ${colors.primaryOrange}25` : 'none',
                      pointerEvents: 'none',
                    }}
                  >
                    {isCompleted ? (
                      <Check size={14} color={colors.white} strokeWidth={2.5} />
                    ) : isCurrent ? (
                      <div
                        aria-hidden="true"
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          backgroundColor: colors.white,
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
                  </span>
                </button>

                {/* Label */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    color: labelColor,
                    textAlign: isMobile ? 'left' : 'center',
                    lineHeight: 1.25,
                    whiteSpace: isMobile ? 'normal' : 'nowrap',
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
                  style={isMobile ? {
                    // Vertical connector: left-aligned under the circle center
                    width: 2,
                    height: 16,
                    marginLeft: 27, // (56 / 2) - 1 = centers under the 28px circle
                    backgroundColor: lineColor,
                    transition: 'background-color 0.3s',
                  } : {
                    // Horizontal connector: vertically centered on the circle
                    flex: 1,
                    height: 2,
                    marginTop: 27, // (56 / 2) - 1 = centers on the 28px circle
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
