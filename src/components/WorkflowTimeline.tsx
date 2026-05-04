import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
  stateLabels?: Record<string, string>
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
  stateLabels,
}) => {
  const currentIdx = states.indexOf(currentState)

  const getLabel = (s: string) =>
    stateLabels?.[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const isCompleted = (s: string) => completedStates.includes(s)
  const isCurrent = (s: string) => s === currentState
  const isUpcoming = (s: string) => !isCompleted(s) && !isCurrent(s)

  return (
    <nav
      role="progressbar"
      aria-valuenow={currentIdx}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-label="Workflow progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: `${spacing['3']} ${spacing['4']}`,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {states.map((state, idx) => {
        const completed = isCompleted(state)
        const current = isCurrent(state)
        const upcoming = isUpcoming(state)
        const isLast = idx === states.length - 1

        const stepColor = completed
          ? colors.statusActive
          : current
          ? colors.primaryOrange
          : colors.textTertiary

        const bgColor = completed
          ? colors.statusActiveSubtle
          : current
          ? colors.orangeSubtle
          : colors.surfaceInset

        return (
          <React.Fragment key={state}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['1'],
                minWidth: 80,
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                disabled={upcoming || !onTransition}
                onClick={() => onTransition && !upcoming && !current && onTransition(state)}
                aria-label={`Step ${idx + 1}: ${getLabel(state)} — ${completed ? 'completed' : current ? 'current' : 'upcoming'}`}
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  borderRadius: '50%',
                  border: `2px solid ${stepColor}`,
                  backgroundColor: bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: upcoming || !onTransition ? 'default' : 'pointer',
                  transition: 'box-shadow 0.15s',
                  boxShadow: current ? `0 0 0 3px ${colors.orangeLight}` : 'none',
                  padding: 0,
                  outline: 'none',
                }}
              >
                {completed ? (
                  <Check size={14} color={colors.statusActive} strokeWidth={3} />
                ) : current ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.primaryOrange,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.textTertiary,
                    }}
                  />
                )}
              </button>
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: current ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  color: stepColor,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                }}
              >
                {getLabel(state)}
              </span>
            </div>

            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 20,
                  backgroundColor: completed ? colors.statusActive : colors.borderSubtle,
                  marginBottom: 18,
                  transition: 'background-color 0.2s',
                }}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default WorkflowTimeline
