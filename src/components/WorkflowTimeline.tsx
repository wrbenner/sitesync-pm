import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
  /** Human-readable labels for each state (falls back to state key if omitted) */
  labels?: Record<string, string>
}

function label(state: string, labels?: Record<string, string>): string {
  if (labels?.[state]) return labels[state]
  return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
  labels,
}) => {
  const currentIndex = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.max(0, currentIndex)}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-label="Workflow progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        overflowX: 'auto',
        paddingBottom: spacing['1'],
      }}
    >
      {states.map((state, idx) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isUpcoming = !isCompleted && !isCurrent
        const isClickable = onTransition && !isCurrent
        const isLast = idx === states.length - 1

        let dotBg = colors.surfaceInset
        let dotBorder = `2px solid ${colors.borderLight ?? 'rgba(255,255,255,0.1)'}`
        let labelColor = colors.textTertiary
        let dotContent: React.ReactNode = null

        if (isCompleted) {
          dotBg = colors.statusActive
          dotBorder = `2px solid ${colors.statusActive}`
          labelColor = colors.textSecondary
          dotContent = <Check size={12} color="#fff" strokeWidth={3} />
        } else if (isCurrent) {
          dotBg = colors.indigo
          dotBorder = `2px solid ${colors.indigo}`
          labelColor = colors.textPrimary
          dotContent = (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#fff',
                animation: 'sitesync-pulse 1.5s ease-in-out infinite',
              }}
            />
          )
        }

        return (
          <React.Fragment key={state}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing['2'],
                minWidth: 72,
                cursor: isClickable && !isUpcoming ? 'pointer' : 'default',
                opacity: isUpcoming ? 0.5 : 1,
              }}
              onClick={() => isClickable && !isUpcoming && onTransition?.(state)}
              aria-label={`Step ${idx + 1}: ${label(state, labels)} - ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
            >
              {/* Dot */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: dotBg,
                  border: dotBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  minWidth: 44,
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
              >
                {dotContent}
              </div>
              {/* Label */}
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.regular,
                  color: labelColor,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}
              >
                {label(state, labels)}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 16,
                  backgroundColor: isCompleted ? colors.statusActive : colors.surfaceInset,
                  marginBottom: 22,
                  transition: 'background-color 0.3s',
                }}
              />
            )}
          </React.Fragment>
        )
      })}

      {/* Pulse animation keyframes injected once */}
      <style>{`
        @keyframes sitesync-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
