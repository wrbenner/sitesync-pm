import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of all state identifiers in workflow sequence */
  states: string[]
  /** The currently active state */
  currentState: string
  /** States that have already been passed through */
  completedStates: string[]
  /** Optional human-readable label overrides keyed by state id */
  labels?: Record<string, string>
  /** Called when the user clicks a future step (only if provided) */
  onTransition?: (nextState: string) => void
}

function toLabel(state: string): string {
  return state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * WorkflowTimeline — horizontal progress stepper for XState-driven workflows.
 *
 * Responsive: row on ≥769px, column on ≤768px.
 * Accessible: role=progressbar, per-step aria-label, keyboard-navigable transitions.
 * Touch: each step node is ≥56px tall (industrial gloved-use compliant).
 * Reusable across RFIs, Submittals, Change Orders, Pay Apps, Punch Items.
 */
export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  labels,
  onTransition,
}) => {
  const currentIdx = Math.max(0, states.indexOf(currentState))

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes wt-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${colors.primaryOrange}40; }
          50%       { box-shadow: 0 0 0 6px ${colors.primaryOrange}00; }
        }
        .wt-root {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          width: 100%;
        }
        .wt-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 56px;
          flex-shrink: 0;
          position: relative;
        }
        .wt-step-label {
          margin-top: ${spacing['1.5']};
          text-align: center;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .wt-connector {
          flex: 1;
          height: 2px;
          min-width: ${spacing['4']};
          align-self: auto;
          margin-top: 19px;
          transition: background-color 0.3s ease;
        }
        @media (max-width: 768px) {
          .wt-root {
            flex-direction: column;
            align-items: flex-start;
          }
          .wt-step {
            flex-direction: row;
            align-items: center;
            gap: ${spacing['3']};
            width: 100%;
            min-height: 56px;
            padding: ${spacing['1']} 0;
          }
          .wt-step-label {
            margin-top: 0;
            text-align: left;
            max-width: none;
            white-space: normal;
          }
          .wt-connector {
            width: 2px;
            height: ${spacing['5']};
            min-width: 0;
            flex: 0 0 auto;
            margin-top: 0;
            margin-left: 13px;
            align-self: auto;
          }
        }
      `}</style>

      <div
        className="wt-root"
        role="progressbar"
        aria-valuenow={currentIdx}
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        aria-label={`Workflow progress: step ${currentIdx + 1} of ${states.length} — ${toLabel(currentState)}`}
      >
        {states.map((state, i) => {
          const isCompleted = completedStates.includes(state)
          const isCurrent = state === currentState
          const isFuture = !isCompleted && !isCurrent
          const isClickable = isFuture && !!onTransition
          const label = labels?.[state] ?? toLabel(state)

          const circleBackground = isCompleted
            ? colors.statusActive
            : isCurrent
              ? colors.primaryOrange
              : colors.surfaceInset

          const circleBorder = isCompleted
            ? colors.statusActive
            : isCurrent
              ? colors.primaryOrange
              : colors.borderDefault

          const connectorColor = i < currentIdx ? colors.statusActive : colors.borderSubtle

          return (
            <React.Fragment key={state}>
              <div
                className="wt-step"
                aria-label={`Step ${i + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={isClickable ? () => onTransition!(state) : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTransition!(state) } } : undefined}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                {/* Step circle */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: borderRadius.full,
                    backgroundColor: circleBackground,
                    border: `2px solid ${circleBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                    animation: isCurrent ? 'wt-pulse 2s ease-out infinite' : 'none',
                  }}
                >
                  {isCompleted && (
                    <Check size={14} color={colors.white} strokeWidth={2.5} />
                  )}
                  {isCurrent && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: borderRadius.full,
                      backgroundColor: colors.white,
                    }} />
                  )}
                </div>

                {/* Step label */}
                <div
                  className="wt-step-label"
                  style={{
                    fontSize: typography.fontSize.label,
                    fontWeight: isCurrent
                      ? typography.fontWeight.semibold
                      : typography.fontWeight.normal,
                    color: isCurrent
                      ? colors.textPrimary
                      : isCompleted
                        ? colors.textSecondary
                        : colors.textTertiary,
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </div>
              </div>

              {/* Connector line between steps */}
              {i < states.length - 1 && (
                <div
                  className="wt-connector"
                  aria-hidden="true"
                  style={{ backgroundColor: connectorColor }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default WorkflowTimeline
