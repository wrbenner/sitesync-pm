import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function stateLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Pulsing ring around the current-state dot
const PulseRing: React.FC = () => (
  <span
    style={{
      position: 'absolute', inset: -4,
      borderRadius: '50%',
      border: `2px solid ${colors.primaryOrange}`,
      animation: 'wt-pulse 1.8s ease-in-out infinite',
      pointerEvents: 'none',
    }}
    aria-hidden
  />
)

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIdx = states.indexOf(currentState)

  return (
    <>
      {/* Keyframe injected once */}
      <style>{`
        @keyframes wt-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.5); }
        }
        @media (max-width: 767px) {
          .wt-root { flex-direction: column !important; gap: 0 !important; }
          .wt-connector { width: 2px !important; height: 24px !important; margin: 0 0 0 27px !important; flex: none !important; }
        }
      `}</style>

      <div
        className="wt-root"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        aria-valuenow={Math.max(0, currentIdx)}
        aria-label="Workflow progress"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 0,
          width: '100%',
          padding: `${spacing[3]} ${spacing[2]}`,
        }}
      >
        {states.map((state, idx) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isFuture = !isCompleted && !isCurrent
          const isClickable = !!onTransition && isFuture && idx === currentIdx + 1
          const isLast = idx === states.length - 1

          const stepStatus = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'

          // Node size 28px; wrapper needs ≥56px to meet touch target requirement
          return (
            <React.Fragment key={state}>
              <div
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={`Step ${idx + 1}: ${stateLabel(state)} — ${stepStatus}`}
                onClick={isClickable ? () => onTransition!(state) : undefined}
                onKeyDown={isClickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onTransition!(state)
                  }
                } : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: spacing[1],
                  minWidth: 56,
                  minHeight: 56,
                  justifyContent: 'center',
                  cursor: isClickable ? 'pointer' : 'default',
                  flexShrink: 0,
                  outline: 'none',
                  borderRadius: borderRadius.base,
                  padding: `${spacing[1]} ${spacing[2]}`,
                  // Keyboard focus ring
                  WebkitTapHighlightColor: 'transparent',
                }}
                // Focus-visible ring via CSS — can't use :focus-visible inline,
                // so apply via onFocus/onBlur states
              >
                {/* Dot / check */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCompleted
                        ? colors.statusActive
                        : isCurrent
                        ? colors.primaryOrange
                        : colors.surfaceInset,
                      border: isFuture
                        ? `2px solid ${colors.borderDefault}`
                        : 'none',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    {isCompleted ? (
                      <Check size={14} color={colors.white} strokeWidth={2.5} />
                    ) : isCurrent ? (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: colors.white,
                      }} />
                    ) : (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        backgroundColor: colors.borderDefault,
                      }} />
                    )}
                  </div>
                  {isCurrent && <PulseRing />}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.regular,
                  color: isCompleted
                    ? colors.statusActive
                    : isCurrent
                    ? colors.primaryOrange
                    : colors.textTertiary,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {stateLabel(state)}
                </span>
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  className="wt-connector"
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 2,
                    minWidth: 12,
                    backgroundColor: isCompleted || isCurrent
                      ? colors.statusActive
                      : colors.borderSubtle,
                    marginBottom: 20, // lift line to center of dots (dot + label offset)
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

export default WorkflowTimeline
