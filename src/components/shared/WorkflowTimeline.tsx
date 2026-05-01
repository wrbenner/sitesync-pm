import React, { useMemo } from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography } from '../../styles/theme'

export interface WorkflowTimelineProps {
  /** Ordered list of state keys */
  states: string[]
  /** Display labels (same order as states; falls back to capitalizing state keys) */
  labels?: string[]
  currentState: string
  /** Optional: explicit list of completed states. Defaults to all states before currentState. */
  completedStates?: string[]
  onTransition?: (nextState: string) => void
  className?: string
}

function toLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  labels,
  currentState,
  completedStates,
  onTransition,
  className,
}) => {
  const currentIdx = states.indexOf(currentState)

  const resolved = useMemo(() => {
    return states.map((state, idx) => {
      const isCompleted = completedStates
        ? completedStates.includes(state)
        : idx < currentIdx
      const isCurrent = state === currentState
      const isUpcoming = !isCompleted && !isCurrent
      const label = labels?.[idx] ?? toLabel(state)
      return { state, idx, isCompleted, isCurrent, isUpcoming, label }
    })
  }, [states, labels, currentState, currentIdx, completedStates])

  const stepCount = states.length

  return (
    <>
      <style>{`
        @keyframes wft-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${colors.primaryOrange}40; }
          50% { box-shadow: 0 0 0 6px ${colors.primaryOrange}00; }
        }
        .wft-root {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 0;
          width: 100%;
        }
        @media (max-width: 767px) {
          .wft-root {
            flex-direction: column;
            align-items: stretch;
          }
          .wft-connector { display: none !important; }
          .wft-connector-v { display: block !important; }
        }
        .wft-connector-v { display: none; }
      `}</style>
      <div
        className={`wft-root${className ? ` ${className}` : ''}`}
        role="progressbar"
        aria-valuenow={currentIdx >= 0 ? currentIdx : 0}
        aria-valuemin={0}
        aria-valuemax={stepCount - 1}
        aria-label={`Workflow progress: step ${currentIdx + 1} of ${stepCount} — ${currentState}`}
      >
        {resolved.map((step, i) => {
          const isLast = i === stepCount - 1

          const circleStyle: React.CSSProperties = {
            width: 32,
            height: 32,
            minWidth: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, border-color 0.2s',
            flexShrink: 0,
            ...(step.isCompleted && {
              backgroundColor: colors.statusActive,
              border: `2px solid ${colors.statusActive}`,
            }),
            ...(step.isCurrent && {
              backgroundColor: colors.primaryOrange,
              border: `2px solid ${colors.primaryOrange}`,
              animation: 'wft-pulse 2s ease-in-out infinite',
            }),
            ...(step.isUpcoming && {
              backgroundColor: colors.surfaceInset,
              border: `2px solid ${colors.borderDefault}`,
            }),
          }

          const labelStyle: React.CSSProperties = {
            fontSize: typography.fontSize.xs,
            fontWeight: step.isCurrent
              ? (typography.fontWeight.semibold as React.CSSProperties['fontWeight'])
              : (typography.fontWeight.medium as React.CSSProperties['fontWeight']),
            color: step.isCompleted
              ? colors.statusActive
              : step.isCurrent
              ? colors.primaryOrange
              : colors.textTertiary,
            textAlign: 'center',
            marginTop: spacing['1'],
            lineHeight: 1.3,
            transition: 'color 0.2s',
          }

          const connectorStyle: React.CSSProperties = {
            flex: 1,
            height: 2,
            marginTop: 15,
            backgroundColor: step.isCompleted || (step.isCurrent && i < stepCount - 1)
              ? colors.statusActive
              : colors.borderDefault,
            transition: 'background 0.2s',
          }

          const ariaLabel = `Step ${i + 1}: ${step.label} — ${
            step.isCompleted ? 'completed' : step.isCurrent ? 'current' : 'upcoming'
          }`

          return (
            <React.Fragment key={step.state}>
              {/* Step column */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                  paddingBottom: spacing['2'],
                }}
              >
                {/* Circle — if onTransition + upcoming sibling of current: clickable */}
                {onTransition && step.isUpcoming && i === currentIdx + 1 ? (
                  <button
                    onClick={() => onTransition(step.state)}
                    aria-label={ariaLabel}
                    style={{
                      ...circleStyle,
                      cursor: 'pointer',
                      background: 'none',
                      padding: 0,
                      /* 56px tap area via padding trick */
                      width: 56,
                      height: 56,
                      minWidth: 56,
                    }}
                  >
                    <span style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceInset,
                      border: `2px solid ${colors.borderDefault}`,
                      fontSize: typography.fontSize.xs,
                      color: colors.textTertiary,
                      fontWeight: typography.fontWeight.medium as React.CSSProperties['fontWeight'],
                    }}>
                      {i + 1}
                    </span>
                  </button>
                ) : (
                  <div style={circleStyle} aria-label={ariaLabel} aria-current={step.isCurrent ? 'step' : undefined}>
                    {step.isCompleted && <Check size={14} color={colors.white ?? '#fff'} strokeWidth={2.5} />}
                    {step.isCurrent && (
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.white ?? '#fff',
                        display: 'block',
                      }} />
                    )}
                    {step.isUpcoming && (
                      <span style={{
                        fontSize: '10px',
                        color: colors.textTertiary,
                        fontWeight: typography.fontWeight.medium as React.CSSProperties['fontWeight'],
                      }}>
                        {i + 1}
                      </span>
                    )}
                  </div>
                )}
                <span style={labelStyle}>{step.label}</span>
              </div>

              {/* Horizontal connector between steps */}
              {!isLast && (
                <div className="wft-connector" style={connectorStyle} aria-hidden />
              )}

              {/* Vertical connector (mobile) */}
              {!isLast && (
                <div
                  className="wft-connector-v"
                  style={{
                    width: 2,
                    height: 16,
                    marginLeft: 27,
                    backgroundColor: step.isCompleted ? colors.statusActive : colors.borderDefault,
                  }}
                  aria-hidden
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
