import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
}

function formatLabel(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function WorkflowTimeline({
  states,
  currentState,
  completedStates,
  onTransition,
}: WorkflowTimelineProps) {
  const currentIndex = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-label="Workflow progress"
      aria-valuenow={currentIndex}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 0,
        width: '100%',
        overflowX: 'auto',
        // Vertical on mobile via media query applied inline via a wrapper
      }}
    >
      {states.map((state, i) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isLast = i === states.length - 1
        const label = formatLabel(state)
        const stepLabel = `Step ${i + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`

        const dotBg = isCompleted
          ? colors.statusActive
          : isCurrent
          ? colors.primaryOrange
          : colors.borderDefault

        const dotBorder = isCompleted
          ? colors.statusActive
          : isCurrent
          ? colors.primaryOrange
          : colors.borderDefault

        const textColor = isCompleted
          ? colors.statusActive
          : isCurrent
          ? colors.primaryOrange
          : colors.textTertiary

        const connectorBg = isCompleted
          ? colors.statusActive
          : colors.borderSubtle

        const canClick = !!onTransition && !isCurrent && !isUpcoming

        return (
          <div
            key={state}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              flexShrink: 0,
              flexGrow: isLast ? 0 : 1,
            }}
          >
            {/* Step */}
            <button
              onClick={canClick ? () => onTransition?.(state) : undefined}
              disabled={!canClick}
              aria-label={stepLabel}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['2'],
                background: 'none',
                border: 'none',
                cursor: canClick ? 'pointer' : 'default',
                padding: `${spacing['3']} ${spacing['2']}`,
                minWidth: 56,
                minHeight: 56,
                borderRadius: borderRadius.md,
                transition: transitions.quick,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: dotBg,
                  border: `2px solid ${dotBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  boxShadow: isCurrent
                    ? `0 0 0 4px var(--color-primary-subtle, rgba(230, 100, 0, 0.15))`
                    : undefined,
                  transition: transitions.quick,
                }}
              >
                {isCompleted ? (
                  <Check size={14} color="#fff" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      animation: 'wf-pulse 2s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.textTertiary,
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontFamily: typography.fontFamily,
                  fontWeight: isCurrent
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.normal,
                  color: textColor,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: transitions.quick,
                }}
              >
                {label}
              </span>
            </button>

            {/* Connector line */}
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  height: 2,
                  flexGrow: 1,
                  backgroundColor: connectorBg,
                  marginTop: '-28px', // align with dot center
                  transition: transitions.quick,
                }}
              />
            )}
          </div>
        )
      })}

      {/* Pulse animation injected once */}
      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}
