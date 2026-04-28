/**
 * WorkflowTimeline — horizontal status stepper for workflow-driven pages.
 *
 * Used by RFIs, Submittals, Change Orders, Pay Apps, and Punch Items.
 * Renders completed states with a check, current state pulsing, future states muted.
 * Responsive: horizontal on tablet/desktop, vertical stack on mobile.
 */

import React from 'react'
import { Check } from 'lucide-react'
import { colors } from '../styles/theme'

export interface WorkflowStep {
  key: string
  label: string
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[]
  currentStep: string
  /** Override labels for display (key → display label). Defaults to step.label. */
  stepLabels?: Record<string, string>
}

function getStepStatus(
  stepKey: string,
  currentStep: string,
  stepKeys: string[],
): 'completed' | 'current' | 'upcoming' {
  const currentIdx = stepKeys.indexOf(currentStep)
  const stepIdx = stepKeys.indexOf(stepKey)
  if (stepIdx < currentIdx) return 'completed'
  if (stepIdx === currentIdx) return 'current'
  return 'upcoming'
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  steps,
  currentStep,
  stepLabels,
}) => {
  const stepKeys = steps.map(s => s.key)
  const currentIdx = stepKeys.indexOf(currentStep)

  return (
    <>
      <style>{`
        @keyframes wt-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${colors.primaryOrange}40; }
          50% { box-shadow: 0 0 0 5px ${colors.primaryOrange}00; }
        }
        @media (max-width: 640px) {
          .wt-root { flex-direction: column !important; gap: 0 !important; }
          .wt-connector { width: 2px !important; height: 20px !important; align-self: center; }
        }
      `}</style>
      <div
        className="wt-root"
        role="status"
        aria-label={`Workflow status: ${steps[currentIdx]?.label ?? currentStep}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 0,
          width: '100%',
        }}
      >
        {steps.map((step, idx) => {
          const status = getStepStatus(step.key, currentStep, stepKeys)
          const label = stepLabels?.[step.key] ?? step.label
          const isLast = idx === steps.length - 1

          const dotColor =
            status === 'completed' ? colors.statusActive
            : status === 'current' ? colors.primaryOrange
            : colors.borderDefault

          const dotBg =
            status === 'completed' ? colors.statusActive
            : status === 'current' ? colors.primaryOrange
            : colors.surfaceInset

          const labelColor =
            status === 'completed' ? colors.statusActive
            : status === 'current' ? colors.primaryOrange
            : colors.textTertiary

          const connectorColor =
            idx < currentIdx ? colors.statusActive
            : colors.borderSubtle

          return (
            <React.Fragment key={step.key}>
              {/* Step node */}
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}
                aria-label={`Step ${idx + 1}: ${label} — ${status}`}
              >
                {/* Dot */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: dotBg,
                    border: `2px solid ${dotColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    animation: status === 'current' ? 'wt-pulse 2s ease-in-out infinite' : undefined,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {status === 'completed' ? (
                    <Check size={13} color={colors.white} strokeWidth={2.5} />
                  ) : status === 'current' ? (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors.white,
                    }} />
                  ) : null}
                </div>

                {/* Label */}
                <span style={{
                  marginTop: 5,
                  fontSize: '11px',
                  fontWeight: status === 'current' ? 700 : 500,
                  color: labelColor,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                  letterSpacing: status === 'current' ? '-0.01em' : 0,
                }}>
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="wt-connector"
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: connectorColor,
                    marginTop: -14, // visually align with dot center
                    minWidth: 12,
                    transition: 'background-color 0.2s ease',
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

// ── Pre-built step sets for each workflow ───────────────

export const RFI_STEPS: WorkflowStep[] = [
  { key: 'draft',       label: 'Draft' },
  { key: 'open',        label: 'Open' },
  { key: 'under_review', label: 'In Review' },
  { key: 'answered',    label: 'Answered' },
  { key: 'closed',      label: 'Closed' },
]

export const SUBMITTAL_STEPS: WorkflowStep[] = [
  { key: 'draft',     label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'in_review', label: 'In Review' },
  { key: 'approved',  label: 'Approved' },
  { key: 'closed',    label: 'Closed' },
]

export const CHANGE_ORDER_STEPS: WorkflowStep[] = [
  { key: 'draft',    label: 'Draft' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export const PUNCH_ITEM_STEPS: WorkflowStep[] = [
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
  { key: 'verified',    label: 'Verified' },
  { key: 'closed',      label: 'Closed' },
]
