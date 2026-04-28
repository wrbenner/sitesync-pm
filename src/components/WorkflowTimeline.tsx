import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of state names to display */
  states: string[]
  /** The current active state */
  currentState: string
  /** States already completed (before the current) */
  completedStates: string[]
  /** Optional labels to display instead of raw state names */
  labels?: Record<string, string>
  /** Callback when user clicks an available transition */
  onTransition?: (nextState: string) => void
}

function formatLabel(state: string, labels?: Record<string, string>): string {
  if (labels?.[state]) return labels[state]
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  labels,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)
  const totalSteps = states.length

  return (
    <nav
      aria-label="Workflow status"
      role="progressbar"
      aria-valuenow={Math.max(0, currentIndex)}
      aria-valuemin={0}
      aria-valuemax={totalSteps - 1}
      aria-valuetext={`Step ${currentIndex + 1} of ${totalSteps}: ${formatLabel(currentState, labels)}`}
      style={{ width: '100%' }}
    >
      {/* Desktop / tablet: horizontal row */}
      <div
        className="workflow-timeline-desktop"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
        }}
      >
        {states.map((state, idx) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isUpcoming = !isCompleted && !isCurrent
          const isLast = idx === states.length - 1

          return (
            <React.Fragment key={state}>
              {/* Step node */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing['1'],
                  flex: '0 0 auto',
                  minWidth: 56,
                }}
              >
                {/* Circle */}
                <div
                  role="img"
                  aria-label={`Step ${idx + 1}: ${formatLabel(state, labels)} — ${
                    isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'
                  }`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    ...(isCompleted
                      ? {
                          backgroundColor: colors.statusSuccess,
                          border: `2px solid ${colors.statusSuccess}`,
                        }
                      : isCurrent
                      ? {
                          backgroundColor: colors.primaryOrange,
                          border: `2px solid ${colors.primaryOrange}`,
                          boxShadow: `0 0 0 4px ${colors.orangeSubtle}`,
                          animation: 'wf-pulse 2s ease-in-out infinite',
                        }
                      : {
                          backgroundColor: 'transparent',
                          border: `2px solid ${colors.borderDefault}`,
                        }),
                  }}
                >
                  {isCompleted ? (
                    <Check size={14} color="#fff" strokeWidth={2.5} />
                  ) : isCurrent ? (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: colors.borderDefault,
                      }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: isCurrent ? 700 : isCompleted ? 500 : 400,
                    color: isCompleted
                      ? colors.statusSuccess
                      : isCurrent
                      ? colors.primaryOrange
                      : colors.textTertiary,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {formatLabel(state, labels)}
                </span>
              </div>

              {/* Connector line (not after last) */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 2,
                    marginBottom: 18, // align with circle centers (label pushes down)
                    backgroundColor: isCompleted
                      ? colors.statusSuccess
                      : colors.borderSubtle,
                    transition: 'background-color 0.3s ease',
                    minWidth: 8,
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Mobile: vertical stack (via CSS @media) */}
      <style>{`
        @keyframes wf-pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${colors.orangeSubtle}; }
          50% { box-shadow: 0 0 0 7px ${colors.orangeLight}; }
        }
        @media (max-width: 480px) {
          .workflow-timeline-desktop {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0 !important;
          }
          .workflow-timeline-desktop > * {
            width: 100%;
          }
        }
      `}</style>
    </nav>
  )
}
