import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

interface WorkflowTimelineProps {
  /** Ordered list of state keys (e.g. ['draft','open','under_review','answered','closed']) */
  states: string[]
  /** Display labels for each state, keyed by state value */
  labels?: Record<string, string>
  /** The current active state */
  currentState: string
  /** States that have been fully completed (before currentState in normal flow) */
  completedStates: string[]
  /** If provided, clicking a future step fires this callback */
  onTransition?: (nextState: string) => void
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  labels,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)

  const getLabel = (s: string) =>
    labels?.[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <>
      <style>{`
        @keyframes wft-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.5; }
        }
      `}</style>
      <div
        role="progressbar"
        aria-label="Workflow progress"
        aria-valuenow={Math.max(0, currentIndex)}
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          padding: `${spacing['2']} 0`,
        }}
      >
        {states.map((state, index) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isFuture = !isCompleted && !isCurrent
          const isClickable = isFuture && !!onTransition

          const dotSize = 28
          const minTouchSize = 56

          return (
            <React.Fragment key={state}>
              {/* Step node */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing['1.5'],
                  minWidth: minTouchSize,
                  flexShrink: 0,
                  cursor: isClickable ? 'pointer' : 'default',
                  padding: `${spacing['1']} ${spacing['2']}`,
                  borderRadius: borderRadius.md,
                  transition: 'background 0.12s',
                }}
                onClick={isClickable ? () => onTransition!(state) : undefined}
                role={isClickable ? 'button' : undefined}
                aria-label={`Step ${index + 1}: ${getLabel(state)} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTransition!(state) } } : undefined}
              >
                {/* Dot */}
                <div style={{ position: 'relative', width: dotSize, height: dotSize }}>
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      backgroundColor: `${colors.primaryOrange}30`,
                      animation: 'wft-pulse 2s ease-in-out infinite',
                    }} />
                  )}
                  <div style={{
                    width: dotSize,
                    height: dotSize,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    backgroundColor: isCompleted
                      ? colors.statusActive
                      : isCurrent
                        ? colors.primaryOrange
                        : colors.surfaceInset,
                    border: `2px solid ${
                      isCompleted
                        ? colors.statusActive
                        : isCurrent
                          ? colors.primaryOrange
                          : colors.borderDefault
                    }`,
                    transition: 'all 0.2s',
                  }}>
                    {isCompleted ? (
                      <Check size={14} color={colors.white} strokeWidth={2.5} />
                    ) : isCurrent ? (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.white,
                      }} />
                    ) : (
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: colors.gray400,
                      }} />
                    )}
                  </div>
                </div>

                {/* Label */}
                <span style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  color: isCompleted
                    ? colors.statusActive
                    : isCurrent
                      ? colors.primaryOrange
                      : colors.textTertiary,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  letterSpacing: typography.letterSpacing.wide,
                  textTransform: 'uppercase',
                }}>
                  {getLabel(state)}
                </span>
              </div>

              {/* Connector line */}
              {index < states.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 2,
                  minWidth: 16,
                  marginBottom: 18,
                  backgroundColor: completedStates.includes(states[index + 1]) || states[index + 1] === currentState
                    ? colors.statusActive
                    : colors.borderSubtle,
                  transition: 'background-color 0.3s',
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
