import React, { useCallback } from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography } from '../styles/theme'

interface WorkflowTimelineProps {
  /** Ordered list of state keys in the workflow */
  states: string[]
  /** Display labels for each state key (falls back to capitalising the key) */
  stateLabels?: Record<string, string>
  /** The current active state */
  currentState: string
  /** States already completed. Defaults to all states before currentState. */
  completedStates?: string[]
  /** If provided, clicking a future step fires this callback */
  onTransition?: (nextState: string) => void
}

const label = (key: string, labels?: Record<string, string>): string =>
  labels?.[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

/**
 * Horizontal progress stepper for multi-stage workflows.
 * Reusable across RFIs, Submittals, Change Orders, Pay Apps, and Punch Items.
 *
 * Accessibility: role="progressbar" with aria-valuenow/min/max.
 * Each step has aria-label indicating name + status.
 * Touch targets are ≥ 56px (industrial gloved-use standard).
 * Responsive: horizontal on ≥ 640px, vertical stack below.
 */
export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  stateLabels,
  currentState,
  completedStates,
  onTransition,
}) => {
  const currentIndex = states.indexOf(currentState)
  const resolved: string[] =
    completedStates ?? states.slice(0, Math.max(0, currentIndex))

  const isCompleted = useCallback(
    (s: string) => resolved.includes(s),
    [resolved],
  )
  const isCurrent = useCallback((s: string) => s === currentState, [currentState])
  const isFuture = useCallback(
    (s: string) => !resolved.includes(s) && s !== currentState,
    [resolved, currentState],
  )

  const stepColor = useCallback(
    (s: string) => {
      if (isCompleted(s)) return colors.statusActive
      if (isCurrent(s)) return colors.primaryOrange
      return colors.textTertiary
    },
    [isCompleted, isCurrent],
  )

  const connectorColor = useCallback(
    (index: number) => {
      const s = states[index]
      return isCompleted(s) || isCurrent(s) ? colors.statusActive : colors.borderSubtle
    },
    [states, isCompleted, isCurrent],
  )

  if (states.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        .wf-step-btn:hover .wf-step-label { color: var(--color-primary) !important; }
        .wf-step-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 8px; }
        @media (max-width: 639px) {
          .wf-root { flex-direction: column !important; align-items: flex-start !important; }
          .wf-connector { width: 2px !important; height: 20px !important; flex: none !important; margin: 0 !important; align-self: flex-start; margin-left: 27px !important; }
          .wf-step { flex-direction: row !important; align-items: center !important; gap: 12px !important; }
          .wf-step-label { text-align: left !important; }
        }
      `}</style>
      <nav
        role="progressbar"
        aria-label="Workflow progress"
        aria-valuenow={Math.max(0, currentIndex)}
        aria-valuemin={0}
        aria-valuemax={states.length - 1}
        style={{
          padding: `${spacing.md} ${spacing.lg}`,
          borderRadius: '12px',
          backgroundColor: colors.surfaceInset,
          border: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <div
          className="wf-root"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {states.map((s, i) => {
            const completed = isCompleted(s)
            const current = isCurrent(s)
            const future = isFuture(s)
            const clickable = !!onTransition && future
            const color = stepColor(s)
            const stepLabel = label(s, stateLabels)

            return (
              <React.Fragment key={s}>
                {/* Step */}
                <button
                  className={`wf-step-btn${clickable ? '' : ''}`}
                  disabled={!clickable}
                  onClick={clickable ? () => onTransition!(s) : undefined}
                  aria-label={`Step ${i + 1}: ${stepLabel} — ${completed ? 'completed' : current ? 'current' : 'upcoming'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    flex: '0 0 auto',
                    background: 'none',
                    border: 'none',
                    cursor: clickable ? 'pointer' : 'default',
                    padding: '4px',
                    minWidth: 56,
                    minHeight: 56,
                    justifyContent: 'center',
                  }}
                >
                  <div className="wf-step" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {/* Circle */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: completed
                          ? colors.statusActive
                          : current
                          ? colors.primaryOrange
                          : colors.surfaceRaised,
                        border: future
                          ? `2px solid ${colors.borderSubtle}`
                          : 'none',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        position: 'relative',
                      }}
                    >
                      {completed && (
                        <Check size={14} color={colors.white} strokeWidth={2.5} />
                      )}
                      {current && (
                        <>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: colors.white,
                          }} />
                          {/* Pulsing halo */}
                          <div style={{
                            position: 'absolute',
                            inset: -4,
                            borderRadius: '50%',
                            border: `2px solid ${colors.primaryOrange}`,
                            animation: 'wf-pulse 2s ease-in-out infinite',
                            opacity: 0.5,
                          }} />
                        </>
                      )}
                      {future && (
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: colors.textTertiary,
                          opacity: 0.5,
                        }} />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className="wf-step-label"
                      style={{
                        fontSize: typography.fontSize.xs,
                        fontWeight: current ? 700 : completed ? 500 : 400,
                        color,
                        lineHeight: 1.2,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        transition: 'color 0.2s ease',
                        maxWidth: 72,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {stepLabel}
                    </span>
                  </div>
                </button>

                {/* Connector line between steps */}
                {i < states.length - 1 && (
                  <div
                    className="wf-connector"
                    aria-hidden="true"
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: connectorColor(i),
                      marginBottom: 20,
                      transition: 'background-color 0.3s ease',
                      minWidth: 12,
                    }}
                  />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default WorkflowTimeline
