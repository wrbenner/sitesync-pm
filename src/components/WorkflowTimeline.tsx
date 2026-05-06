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
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
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
      aria-label={`Workflow: step ${currentIndex + 1} of ${states.length} — ${formatLabel(currentState)}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: `${spacing['3']} ${spacing['4']}`,
        overflowX: 'auto',
      }}
    >
      {states.map((state, i) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isLast = i === states.length - 1
        const isNextAfterCurrent = i === currentIndex + 1

        const stepColor = isCompleted
          ? colors.statusActive
          : isCurrent
            ? colors.primaryOrange
            : colors.borderSubtle

        const labelColor = isCompleted
          ? colors.statusActive
          : isCurrent
            ? colors.primaryOrange
            : colors.textTertiary

        const canTransition = !!onTransition && isNextAfterCurrent

        return (
          <React.Fragment key={state}>
            {/* Step node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['1'], flexShrink: 0 }}>
              <button
                aria-label={`Step ${i + 1}: ${formatLabel(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}${canTransition ? ' (click to advance)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!canTransition}
                onClick={canTransition ? () => onTransition(state) : undefined}
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  border: `2px solid ${stepColor}`,
                  backgroundColor: isCompleted ? colors.statusActive : isCurrent ? colors.primaryOrange : 'transparent',
                  cursor: canTransition ? 'pointer' : 'default',
                  padding: 0,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  alignSelf: 'center',
                  outline: 'none',
                }}
                onFocus={canTransition ? (e) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryOrange}40` } : undefined}
                onBlur={canTransition ? (e) => { e.currentTarget.style.boxShadow = 'none' } : undefined}
              >
                {isCompleted ? (
                  <Check size={14} color="#fff" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    animation: 'wf-pulse 1.8s ease-in-out infinite',
                  }} />
                ) : (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isUpcoming ? colors.borderSubtle : 'transparent',
                  }} />
                )}
              </button>

              <span style={{
                fontSize: typography.fontSize.caption,
                fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.normal,
                color: labelColor,
                whiteSpace: 'nowrap',
                letterSpacing: isCurrent ? '-0.01em' : undefined,
              }}>
                {formatLabel(state)}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{
                height: 2,
                flex: 1,
                minWidth: spacing['4'],
                backgroundColor: completedStates.includes(states[i + 1]) || states[i + 1] === currentState
                  ? colors.statusActive
                  : colors.borderSubtle,
                marginBottom: `calc(${typography.fontSize.caption} + ${spacing['1']} + 2px)`,
                transition: 'background-color 0.2s ease',
              }} />
            )}
          </React.Fragment>
        )
      })}

      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
