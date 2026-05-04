import React from 'react'
import { colors, typography } from '../styles/theme'

export interface WorkflowTimelineProps {
  states: string[]
  currentState: string
  completedStates: string[]
  onTransition?: (nextState: string) => void
  /** Human-readable labels for each state. Falls back to capitalizing the state key. */
  labels?: Record<string, string>
  /** Disables all transition buttons (e.g. while a mutation is in-flight). */
  disabled?: boolean
}

function defaultLabel(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function WorkflowTimeline({
  states,
  currentState,
  completedStates,
  onTransition,
  labels,
  disabled = false,
}: WorkflowTimelineProps) {
  const currentIndex = states.indexOf(currentState)

  return (
    <div
      role="progressbar"
      aria-valuenow={currentIndex >= 0 ? currentIndex : 0}
      aria-valuemin={0}
      aria-valuemax={states.length - 1}
      aria-label={`Workflow: ${defaultLabel(currentState)} (step ${currentIndex + 1} of ${states.length})`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0',
        overflowX: 'auto',
        padding: '8px 0 4px',
      }}
    >
      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
        @media (max-width: 767px) {
          .wf-connector-h { display: none !important; }
          .wf-step-row { flex-direction: column !important; align-items: center !important; gap: 0 !important; }
          .wf-connector-v { display: flex !important; }
        }
        @media (min-width: 768px) {
          .wf-connector-v { display: none !important; }
        }
      `}</style>

      {states.map((state, index) => {
        const isCompleted = completedStates.includes(state)
        const isCurrent = state === currentState
        const isFuture = !isCompleted && !isCurrent
        const label = labels?.[state] ?? defaultLabel(state)
        const isNextTransition = onTransition && isCurrent && index < states.length - 1
          ? states[index + 1]
          : null

        return (
          <div
            key={state}
            className="wf-step-row"
            style={{ display: 'flex', alignItems: 'center', gap: 0, flex: index < states.length - 1 ? '1 1 auto' : '0 0 auto' }}
          >
            {/* Step node */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                minWidth: '56px',
                flexShrink: 0,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
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
                  transition: 'background-color 0.2s, border-color 0.2s',
                  flexShrink: 0,
                }}
                aria-label={`Step ${index + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
              >
                {isCompleted && CHECK_ICON}
                {isCurrent && (
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: colors.white,
                      animation: 'wf-pulse 1.6s ease-in-out infinite',
                    }}
                  />
                )}
                {isFuture && (
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
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
                  fontWeight: isCurrent ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  color: isCompleted
                    ? colors.statusActive
                    : isCurrent
                      ? colors.textPrimary
                      : colors.textTertiary,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: typography.lineHeight.tight,
                }}
              >
                {label}
              </span>

              {/* Transition button (current state only) */}
              {isNextTransition && (
                <button
                  onClick={() => onTransition?.(isNextTransition)}
                  disabled={disabled}
                  aria-label={`Advance to ${labels?.[isNextTransition] ?? defaultLabel(isNextTransition)}`}
                  style={{
                    minHeight: '28px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${colors.primaryOrange}`,
                    backgroundColor: 'transparent',
                    color: colors.primaryOrange,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.medium,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Next →
                </button>
              )}
            </div>

            {/* Horizontal connector (between steps, desktop) */}
            {index < states.length - 1 && (
              <>
                <div
                  className="wf-connector-h"
                  style={{
                    flex: '1 1 auto',
                    height: '2px',
                    minWidth: '16px',
                    backgroundColor: isCompleted ? colors.statusActive : colors.borderDefault,
                    marginBottom: '32px', // align with circle centres
                    transition: 'background-color 0.2s',
                  }}
                />
                {/* Vertical connector (between steps, mobile) */}
                <div
                  className="wf-connector-v"
                  style={{
                    display: 'none',
                    width: '2px',
                    height: '24px',
                    backgroundColor: isCompleted ? colors.statusActive : colors.borderDefault,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    transition: 'background-color 0.2s',
                  }}
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
