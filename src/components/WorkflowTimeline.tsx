import React from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of all states in the workflow (happy-path only; terminal exception states like "void" omitted). */
  states: string[]
  /** The current state of the entity. */
  currentState: string
  /** States that have already been completed (all states before the current one in order). */
  completedStates: string[]
  /** Optional display-label overrides keyed by state name. */
  labels?: Record<string, string>
  /** If provided, future-state steps become clickable to trigger a transition. */
  onTransition?: (toState: string) => void
}

function formatLabel(state: string): string {
  return state
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * WorkflowTimeline — horizontal stepper showing an entity's lifecycle journey.
 *
 * Reusable across RFIs, Submittals, Change Orders, Pay Apps, and Punch Items.
 * Renders horizontally with overflow-x scroll on small viewports.
 * Meets 56 px touch targets via the outer hit area on each step node.
 */
export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  labels,
  onTransition,
}) => {
  const currentIndex = Math.max(0, states.indexOf(currentState))

  return (
    <nav
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-valuenow={currentIndex}
      aria-label="Workflow progress"
      style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          minWidth: 'max-content',
          padding: '4px 0 8px',
        }}
      >
        {states.map((state, idx) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isFuture = !isCompleted && !isCurrent
          const isLast = idx === states.length - 1
          const isClickable = isFuture && !!onTransition

          const dotColor = isCompleted
            ? colors.statusSuccess
            : isCurrent
            ? colors.primaryOrange
            : colors.borderSubtle

          const labelColor = isCompleted
            ? colors.textSecondary
            : isCurrent
            ? colors.textPrimary
            : colors.textTertiary

          const label = labels?.[state] ?? formatLabel(state)

          return (
            <React.Fragment key={state}>
              {/* Step node */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  // 56px minimum touch target width via padding
                  minWidth: 56,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={`Step ${idx + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                onClick={isClickable ? () => onTransition!(state) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTransition!(state) } }
                    : undefined
                }
              >
                {/* Dot */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: isCompleted
                      ? colors.statusSuccess
                      : isCurrent
                      ? colors.primaryOrange
                      : colors.surfaceInset,
                    border: `2px solid ${dotColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.25s ease',
                    boxShadow: isCurrent ? `0 0 0 4px ${colors.orangeSubtle}` : 'none',
                  }}
                >
                  {isCompleted ? (
                    <Check size={13} color="#fff" strokeWidth={2.5} aria-hidden />
                  ) : isCurrent ? (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                      }}
                      aria-hidden
                    />
                  ) : null}
                </div>

                {/* Label */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isCurrent ? 600 : 500,
                    color: labelColor,
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.01em',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  aria-hidden
                  style={{
                    flex: 1,
                    minWidth: 24,
                    maxWidth: 72,
                    height: 2,
                    marginTop: 13, // vertically center with 28px dot (28/2 − 2/2 = 13)
                    backgroundColor: isCompleted ? colors.statusSuccess : colors.borderSubtle,
                    transition: 'background-color 0.3s ease',
                    flexShrink: 0,
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </nav>
  )
}

export default WorkflowTimeline
