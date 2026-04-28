import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function label(state: string): string {
  return state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  return (
    <>
      <style>{`
        @keyframes wt-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.25); }
        }
        .wt-step-btn:focus-visible {
          outline: 2px solid ${colors.primaryOrange};
          outline-offset: 2px;
          border-radius: ${borderRadius.full};
        }
        @media (max-width: 767px) {
          .wt-root { flex-direction: column !important; align-items: flex-start !important; }
          .wt-connector { width: 2px !important; height: 24px !important; margin: 0 0 0 27px !important; flex: none !important; }
        }
      `}</style>

      <div
        className="wt-root"
        role="progressbar"
        aria-valuenow={currentIndex}
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        aria-label={`Workflow: step ${currentIndex + 1} of ${states.length} — ${label(currentState)}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 0,
          padding: `${spacing['3']} ${spacing['4']}`,
          overflowX: 'auto',
        }}
      >
        {states.map((state, idx) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isUpcoming = !isCompleted && !isCurrent
          const isNextAvailable = onTransition && idx === currentIndex + 1

          const dotSize = 56
          const circleBg = isCompleted
            ? colors.statusActive
            : isCurrent
            ? colors.primaryOrange
            : colors.surfaceInset
          const circleColor = isCompleted || isCurrent ? colors.white : colors.textTertiary
          const textColor = isCurrent
            ? colors.textPrimary
            : isCompleted
            ? colors.statusActive
            : colors.textTertiary

          return (
            <React.Fragment key={state}>
              {idx > 0 && (
                <div
                  className="wt-connector"
                  aria-hidden="true"
                  style={{
                    flex: '1 1 24px',
                    height: 2,
                    minWidth: 16,
                    background: isCompleted || (completedStates.includes(states[idx - 1]) && isCurrent)
                      ? colors.statusActive
                      : colors.borderSubtle,
                    margin: `0 ${spacing['1']}`,
                    flexShrink: 0,
                  }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing['1.5'],
                  flexShrink: 0,
                }}
              >
                <button
                  className="wt-step-btn"
                  aria-label={`Step ${idx + 1}: ${label(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  disabled={!isNextAvailable}
                  onClick={isNextAvailable ? () => onTransition!(state) : undefined}
                  style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: borderRadius.full,
                    background: circleBg,
                    border: isCurrent
                      ? `2px solid ${colors.primaryOrange}`
                      : isUpcoming
                      ? `2px solid ${colors.borderDefault}`
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isNextAvailable ? 'pointer' : 'default',
                    padding: 0,
                    flexShrink: 0,
                    position: 'relative',
                    transition: 'background 0.2s',
                  }}
                >
                  {isCompleted ? (
                    <Check size={20} color={circleColor} strokeWidth={2.5} aria-hidden="true" />
                  ) : isCurrent ? (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: borderRadius.full,
                        background: colors.white,
                        animation: 'wt-pulse 1.8s ease-in-out infinite',
                      }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        fontSize: typography.fontSize.label,
                        fontWeight: typography.fontWeight.medium,
                        color: circleColor,
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </button>

                <span
                  style={{
                    fontSize: typography.fontSize.caption,
                    fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.regular,
                    color: textColor,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    letterSpacing: isCurrent ? '0.02em' : undefined,
                  }}
                >
                  {label(state)}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
