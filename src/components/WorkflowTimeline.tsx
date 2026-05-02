import React from 'react'
import { Check } from 'lucide-react'
import { colors, typography } from '../styles/theme'

interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
  className?: string
}

function formatLabel(state: string): string {
  return state
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function WorkflowTimeline({
  states,
  currentState,
  completedStates,
  onTransition,
  className,
}: WorkflowTimelineProps) {
  const currentIndex = states.indexOf(currentState)

  return (
    <nav
      role="progressbar"
      aria-valuenow={currentIndex >= 0 ? currentIndex : 0}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-label="Workflow progress"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0',
        padding: '12px 16px',
        backgroundColor: colors.surfaceRaised,
        borderRadius: '10px',
        border: `1px solid ${colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {states.map((state, i) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isLast = i === states.length - 1

        let dotBg = colors.borderDefault
        let dotBorder = colors.borderDefault
        let labelColor = colors.textTertiary
        let labelWeight = 400

        if (isCompleted) {
          dotBg = colors.statusActive
          dotBorder = colors.statusActive
          labelColor = colors.textSecondary
          labelWeight = 500
        } else if (isCurrent) {
          dotBg = colors.primaryOrange
          dotBorder = colors.primaryOrange
          labelColor = colors.primaryOrange
          labelWeight = 700
        }

        const canTransition = !!onTransition && isUpcoming && i === currentIndex + 1

        return (
          <React.Fragment key={state}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {/* Step indicator */}
              <button
                type="button"
                aria-label={`Step ${i + 1}: ${formatLabel(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                disabled={!canTransition}
                onClick={canTransition ? () => onTransition!(state) : undefined}
                style={{
                  width: 28,
                  height: 28,
                  minHeight: 28,
                  borderRadius: '50%',
                  border: `2px solid ${dotBorder}`,
                  backgroundColor: isCompleted || isCurrent ? dotBg : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canTransition ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                  position: 'relative',
                  outline: 'none',
                  padding: 0,
                }}
                onFocus={e => {
                  if (canTransition) e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.orangeSubtle}`
                }}
                onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                {isCompleted ? (
                  <Check size={14} color={colors.white} strokeWidth={2.5} />
                ) : isCurrent ? (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: colors.white,
                    animation: 'pulse 2s ease-in-out infinite',
                  }} />
                ) : (
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: colors.borderDefault,
                  }} />
                )}
              </button>

              {/* Label */}
              <span
                style={{
                  marginTop: 6,
                  fontSize: '11px',
                  fontWeight: labelWeight,
                  color: labelColor,
                  fontFamily: typography.fontFamily,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  textAlign: 'center',
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
                  flex: '1 0 12px',
                  height: 2,
                  backgroundColor: isCompleted ? colors.statusActive : colors.borderSubtle,
                  marginBottom: 20,
                  transition: 'background-color 0.2s ease',
                }}
              />
            )}
          </React.Fragment>
        )
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>
    </nav>
  )
}

export default WorkflowTimeline
