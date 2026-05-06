/**
 * WorkflowStep — a single node in the visual workflow builder.
 * Click to edit; drag to reposition. No external dnd library.
 */

import React from 'react'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { OrangeDot } from '../atoms'
import type { WorkflowStep as StepShape } from '../../types/workflows'

export interface WorkflowStepProps {
  step: StepShape
  position: { x: number; y: number }
  selected?: boolean
  hasError?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onClick?: () => void
}

export const WorkflowStep: React.FC<WorkflowStepProps> = ({
  step,
  position,
  selected = false,
  hasError = false,
  onPointerDown,
  onClick,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        minWidth: 180,
        padding: spacing['3'],
        backgroundColor: colors.surfaceRaised,
        border: hasError
          ? `2px solid ${colors.statusCritical}`
          : selected
          ? `2px solid ${colors.primaryOrange}`
          : `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.lg,
        cursor: 'grab',
        userSelect: 'none',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
        {step.terminal && <OrangeDot size={6} haloSpread={2} />}
        <span
          style={{
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {step.terminal ? 'Terminal' : 'Step'}
        </span>
      </div>
      <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
        {step.name}
      </div>
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
        {step.id}
      </div>
      {step.required_role && step.required_role.length > 0 && (
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, marginTop: spacing['1'] }}>
          Role: {step.required_role.join(', ')}
        </div>
      )}
      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
        {step.transitions.length} outgoing
      </div>
    </div>
  )
}

export default WorkflowStep
