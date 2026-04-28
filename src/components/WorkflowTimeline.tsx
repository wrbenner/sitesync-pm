import React from 'react'
import { Check } from 'lucide-react'
import { colors, typography, borderRadius } from '../styles/theme'

export interface WorkflowStep {
  key: string
  label: string
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[]
  currentStep: string
  stepLabels?: Record<string, string>
}

// ── Pre-built step sets for common workflows ────────────────

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
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'executed', label: 'Executed' },
]

export const PUNCH_ITEM_STEPS: WorkflowStep[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'ready_for_inspection', label: 'Ready' },
  { key: 'closed', label: 'Closed' },
]

// ── Component ───────────────────────────────────────────────

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  steps,
  currentStep,
  stepLabels,
}) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <div
      role="status"
      aria-label={`Workflow status: ${stepLabels?.[currentStep] ?? steps[currentIndex]?.label ?? currentStep}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        overflowX: 'auto',
        padding: '4px 0',
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const label = stepLabels?.[step.key] ?? step.label

        return (
          <React.Fragment key={step.key}>
            {/* Step node */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                minWidth: 64,
                flexShrink: 0,
              }}
            >
              {/* Circle */}
              <div
                aria-label={`Step ${index + 1}: ${label} — ${isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}`}
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
                  border: `2px solid ${isCompleted ? colors.statusActive : isCurrent ? colors.primaryOrange : colors.borderDefault}`,
                  position: 'relative',
                  transition: 'background-color 0.2s, border-color 0.2s',
                  flexShrink: 0,
                }}
              >
                {isCompleted ? (
                  <Check size={14} color="#fff" strokeWidth={3} />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      animation: 'wf-pulse 1.8s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: colors.textTertiary,
                    }}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCompleted
                    ? colors.statusActive
                    : isCurrent
                      ? colors.primaryOrange
                      : colors.textTertiary,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label}
              </span>
            </div>

            {/* Connector line (skip after last step) */}
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 20,
                  backgroundColor: index < currentIndex ? colors.statusActive : colors.borderDefault,
                  marginBottom: 22, // offset to align with circle center
                  transition: 'background-color 0.2s',
                }}
              />
            )}
          </React.Fragment>
        )
      })}

      {/* Keyframe for pulse animation — injected once via a style tag */}
      <style>{`
        @keyframes wf-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}

export default WorkflowTimeline
