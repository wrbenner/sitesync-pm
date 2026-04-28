import React from 'react'
import { Check } from 'lucide-react'
import { colors, spacing, typography } from '../styles/theme'

export interface WorkflowStep {
  key: string
  label: string
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[]
  currentStep: string
  stepLabels?: Record<string, string>
}

export const RFI_STEPS: WorkflowStep[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'answered', label: 'Answered' },
  { key: 'closed', label: 'Closed' },
]

export const SUBMITTAL_STEPS: WorkflowStep[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'gc_review', label: 'GC Review' },
  { key: 'architect_review', label: 'A/E Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'closed', label: 'Closed' },
]

export const CHANGE_ORDER_STEPS: WorkflowStep[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'executed', label: 'Executed' },
]

export const PUNCH_ITEM_STEPS: WorkflowStep[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready_for_inspection', label: 'Ready' },
  { key: 'closed', label: 'Closed' },
]

export function WorkflowTimeline({ steps, currentStep, stepLabels }: WorkflowTimelineProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  const currentLabel = stepLabels?.[currentStep]
    ?? steps.find((s) => s.key === currentStep)?.label
    ?? currentStep

  return (
    <div
      role="status"
      aria-label={`Workflow status: ${currentLabel}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        flexWrap: 'nowrap',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: spacing['1'],
      }}
    >
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex
        const isCurrent = i === currentIndex

        const label = stepLabels?.[step.key] ?? step.label

        const dotSize = 20
        const touchSize = 56

        let dotBg: string
        let dotBorder: string
        let dotColor: string

        if (isCompleted) {
          dotBg = colors.statusActive
          dotBorder = colors.statusActive
          dotColor = '#ffffff'
        } else if (isCurrent) {
          dotBg = colors.primaryOrange
          dotBorder = colors.primaryOrange
          dotColor = '#ffffff'
        } else {
          dotBg = colors.surfaceInset
          dotBorder = colors.borderDefault
          dotColor = colors.textTertiary
        }

        const stepState = isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'

        return (
          <React.Fragment key={step.key}>
            {/* Step node */}
            <div
              aria-label={`Step ${i + 1}: ${label} — ${stepState}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: touchSize,
                minHeight: touchSize,
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  backgroundColor: dotBg,
                  border: `2px solid ${dotBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {isCompleted && <Check size={11} color={dotColor} strokeWidth={3} />}
                {isCurrent && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      animation: 'sitesync-pulse 2s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
              {/* Label */}
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  color: isCurrent
                    ? colors.textPrimary
                    : isCompleted
                    ? colors.textSecondary
                    : colors.textTertiary,
                  fontWeight: isCurrent
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.normal,
                  marginTop: spacing['1'],
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {i < steps.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  height: 2,
                  flex: '1 1 16px',
                  minWidth: 12,
                  maxWidth: 48,
                  backgroundColor:
                    i < currentIndex ? colors.statusActive : colors.borderSubtle,
                  marginBottom: spacing['4'],
                  flexShrink: 0,
                }}
              />
            )}
          </React.Fragment>
        )
      })}

      {/* Pulse keyframe — injected once, scoped to this component */}
      <style>{`
        @keyframes sitesync-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
