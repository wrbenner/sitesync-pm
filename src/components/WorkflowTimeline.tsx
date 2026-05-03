import React from 'react'
import { Check } from 'lucide-react'
import { colors, typography, spacing } from '../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of all states in the workflow */
  states: string[]
  /** Human-readable label for each state (keyed by state value) */
  labels?: Record<string, string>
  /** The currently active state */
  currentState: string
  /** States that have already been completed */
  completedStates: string[]
  /** Optional — called when the user clicks an upcoming state step */
  onTransition?: (nextState: string) => void
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  labels,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-label="Workflow progress"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        overflowX: 'auto',
        padding: `${spacing['3']} 0`,
      }}
    >
      {states.map((state, idx) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isClickable = isUpcoming && !!onTransition
        const label = labels?.[state] ?? capitalize(state)

        const dotColor = isCompleted
          ? colors.statusActive
          : isCurrent
            ? colors.primaryOrange
            : colors.gray400

        const labelColor = isCompleted
          ? colors.textSecondary
          : isCurrent
            ? colors.primaryOrange
            : colors.textTertiary

        return (
          <React.Fragment key={state}>
            {/* Step */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
                minWidth: 72,
              }}
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={isClickable ? () => onTransition!(state) : undefined}
                aria-label={`Step ${idx + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                aria-current={isCurrent ? 'step' : undefined}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: isCurrent
                    ? `2px solid ${colors.primaryOrange}`
                    : isCompleted
                      ? 'none'
                      : `2px solid ${colors.gray300}`,
                  backgroundColor: isCompleted
                    ? colors.statusActive
                    : isCurrent
                      ? colors.orangeSubtle
                      : colors.surfaceInset,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isClickable ? 'pointer' : 'default',
                  padding: 0,
                  transition: 'all 0.2s',
                  outline: 'none',
                  // Ensure accessible focus ring
                  boxShadow: undefined,
                  position: 'relative',
                  // 56px total touch target (padding + invisible zone via ::before)
                  // We use marginY to create the minimum 56px tap area
                  margin: '12px auto',
                }}
                onFocus={e => {
                  if (isClickable) e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryOrange}40`
                }}
                onBlur={e => { e.currentTarget.style.boxShadow = '' }}
              >
                {isCompleted ? (
                  <Check size={14} color={colors.white} strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: colors.primaryOrange,
                      display: 'block',
                      animation: 'wt-pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: dotColor,
                      display: 'block',
                    }}
                  />
                )}
              </button>

              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent ? 700 : 500,
                  color: labelColor,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  maxWidth: 72,
                  paddingTop: 4,
                  transition: 'color 0.2s',
                  wordBreak: 'break-word',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {idx < states.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 16,
                  backgroundColor: completedStates.includes(states[idx + 1]) || states[idx + 1] === currentState
                    ? colors.statusActive
                    : colors.gray300,
                  marginTop: 28, // align with center of 32px dot + 12px top margin
                  transition: 'background-color 0.3s',
                }}
              />
            )}
          </React.Fragment>
        )
      })}

      <style>{`
        @keyframes wt-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

export default WorkflowTimeline
