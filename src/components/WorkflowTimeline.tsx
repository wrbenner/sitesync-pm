import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useMediaQuery } from '../hooks/useMediaQuery'

export interface WorkflowState {
  /** Stable machine state key (e.g. "submitted") */
  key: string
  /** Human label shown in the stepper */
  label: string
  /** Optional shorter label rendered on narrow viewports */
  mobileLabel?: string
}

export interface WorkflowTimelineProps {
  /** Ordered list of states the workflow can pass through */
  states: ReadonlyArray<WorkflowState | string>
  /** The current state key */
  currentState: string
  /** Optional explicit list of completed state keys. Defaults to every
   *  state preceding `currentState` in the `states` array. */
  completedStates?: string[]
  /** Optional click-to-jump handler for ops/admin views */
  onTransition?: (nextStateKey: string) => void
  /** Override the visual label for the current step */
  ariaLabel?: string
}

const normalize = (s: WorkflowState | string): WorkflowState =>
  typeof s === 'string' ? { key: s, label: titleCase(s) } : s

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Visual workflow stepper. One component, every workflow.
 *
 * Used by RFIs, Submittals, Change Orders, Pay Apps, and Punch Items.
 * Renders horizontally on tablets/desktop and stacks vertically on
 * phones so labels stay legible without truncation.
 *
 * Accessibility:
 *   - Outer wrapper is `role="progressbar"` with aria-valuenow/min/max
 *   - Each step has aria-label describing its position and status
 *   - Completed steps render a Check icon with text fallback for SR
 */
export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  states,
  currentState,
  completedStates,
  onTransition,
  ariaLabel,
}) => {
  const isNarrow = useMediaQuery('(max-width: 768px)')

  const normalized = states.map(normalize)
  const currentIndex = Math.max(
    0,
    normalized.findIndex(s => s.key === currentState),
  )

  const completedSet = new Set<string>(
    completedStates ?? normalized.slice(0, currentIndex).map(s => s.key),
  )

  const total = normalized.length

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel ?? 'Workflow progress'}
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuenow={currentIndex}
      style={{
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        alignItems: isNarrow ? 'stretch' : 'center',
        gap: 0,
        width: '100%',
      }}
    >
      {normalized.map((state, idx) => {
        const isCurrent = idx === currentIndex
        const isCompleted = completedSet.has(state.key) || idx < currentIndex
        const isFuture = !isCompleted && !isCurrent

        const stepStatus = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'
        const stepAriaLabel = `Step ${idx + 1} of ${total}: ${state.label} — ${stepStatus}`

        const dotColor = isCompleted
          ? colors.statusActive
          : isCurrent
            ? colors.primaryOrange
            : colors.borderDefault

        const dotBg = isCompleted
          ? colors.statusActive
          : isCurrent
            ? colors.primaryOrange
            : colors.surfaceRaised

        const labelColor = isCurrent
          ? colors.textPrimary
          : isCompleted
            ? colors.textSecondary
            : colors.textTertiary

        const isClickable = !!onTransition && !isCurrent
        const Tag = isClickable ? 'button' : 'div'

        return (
          <React.Fragment key={state.key}>
            <Tag
              aria-label={stepAriaLabel}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={isClickable ? () => onTransition(state.key) : undefined}
              style={{
                display: 'flex',
                flexDirection: isNarrow ? 'row' : 'column',
                alignItems: 'center',
                gap: isNarrow ? spacing['3'] : spacing['2'],
                flex: isNarrow ? '0 0 auto' : '0 0 auto',
                minWidth: isNarrow ? 'auto' : 80,
                padding: isNarrow ? `${spacing['2']} 0` : 0,
                background: 'transparent',
                border: 'none',
                cursor: isClickable ? 'pointer' : 'default',
                fontFamily: typography.fontFamily,
                color: labelColor,
                textAlign: isNarrow ? 'left' : 'center',
                position: 'relative',
                transition: `color ${transitions.instant}`,
              }}
              onMouseEnter={(e) => {
                if (!isClickable) return
                ;(e.currentTarget as HTMLElement).style.opacity = '0.85'
              }}
              onMouseLeave={(e) => {
                if (!isClickable) return
                ;(e.currentTarget as HTMLElement).style.opacity = '1'
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: borderRadius.full,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dotBg,
                  border: `2px solid ${dotColor}`,
                  boxShadow: isCurrent
                    ? `0 0 0 4px ${colors.orangeSubtle}`
                    : 'none',
                  transition: `all ${transitions.instant}`,
                  flexShrink: 0,
                }}
              >
                {isCompleted ? (
                  <Check size={16} strokeWidth={3} color={colors.white} />
                ) : (
                  <span
                    style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: isCurrent ? colors.white : colors.textTertiary,
                      lineHeight: 1,
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  fontWeight: isCurrent
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.medium,
                  color: labelColor,
                  whiteSpace: isNarrow ? 'normal' : 'nowrap',
                  letterSpacing: typography.letterSpacing.normal,
                }}
              >
                {isNarrow && state.mobileLabel ? state.mobileLabel : state.label}
              </span>
              {isFuture && !isNarrow && (
                <span
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                >
                  upcoming
                </span>
              )}
            </Tag>

            {idx < total - 1 && (
              <div
                aria-hidden
                style={
                  isNarrow
                    ? {
                        width: 2,
                        height: spacing['4'],
                        marginLeft: 13,
                        backgroundColor: idx < currentIndex
                          ? colors.statusActive
                          : colors.borderSubtle,
                        flexShrink: 0,
                      }
                    : {
                        flex: 1,
                        height: 2,
                        margin: `0 ${spacing['2']}`,
                        backgroundColor: idx < currentIndex
                          ? colors.statusActive
                          : colors.borderSubtle,
                        marginTop: -22, // align with circle center
                      }
                }
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default WorkflowTimeline
