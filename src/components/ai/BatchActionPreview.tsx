import React, { memo, useCallback, useState } from 'react'
import {
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, DollarSign, ShieldCheck, ClipboardCheck, Scale, FileSearch,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../../styles/theme'
import type { AgentSuggestedAction, AgentDomain } from '../../types/agents'
import { SPECIALIST_AGENTS } from '../../types/agents'

// ── Constants ─────────────────────────────────────────────────

const AGENT_ICONS: Record<AgentDomain, React.ElementType> = {
  schedule: Calendar,
  cost: DollarSign,
  safety: ShieldCheck,
  quality: ClipboardCheck,
  compliance: Scale,
  document: FileSearch,
}

const IMPACT_COLORS: Record<string, { fg: string; bg: string }> = {
  low: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  medium: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  high: { fg: colors.primaryOrange, bg: colors.orangeSubtle },
  critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
}

const AGENT_ACCENT: Record<AgentDomain, string> = {
  schedule: colors.statusInfo,
  cost: colors.statusActive,
  safety: colors.statusCritical,
  quality: colors.statusPending,
  compliance: colors.statusReview,
  document: colors.statusInfo,
}

// ── Single Action Card ────────────────────────────────────────

interface ActionCardProps {
  action: AgentSuggestedAction
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const ActionCard = memo<ActionCardProps>(({ action, onApprove, onReject }) => {
  const agent = SPECIALIST_AGENTS[action.domain]
  const Icon = AGENT_ICONS[action.domain]
  const impactColor = IMPACT_COLORS[action.impact] || IMPACT_COLORS.medium
  const accent = AGENT_ACCENT[action.domain]

  return (
    <div
      style={{
        padding: spacing['4'],
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.md,
        borderLeft: `3px solid ${accent}`,
        boxShadow: shadows.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.base,
            backgroundColor: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: spacing['0.5'],
          }}
        >
          <Icon size={14} color={colors.white} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              marginBottom: spacing['1'],
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
                color: accent,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
              }}
            >
              {agent.shortName} Agent
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `1px ${spacing['2']}`,
                borderRadius: borderRadius.full,
                backgroundColor: impactColor.bg,
                color: impactColor.fg,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              {action.impact === 'critical' && <AlertTriangle size={9} />}
              {action.impact}
            </span>
            <span
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
                marginLeft: 'auto',
              }}
            >
              {action.confidence}% confidence
            </span>
          </div>

          <p
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              fontWeight: typography.fontWeight.medium,
              margin: 0,
              marginBottom: spacing['3'],
              lineHeight: typography.lineHeight.normal,
            }}
          >
            {action.description}
          </p>

          <div style={{ display: 'flex', gap: spacing['2'] }}>
            <button
              onClick={() => onApprove(action.id)}
              aria-label={`Approve action: ${action.description}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: colors.statusActiveSubtle,
                color: colors.statusActive,
                border: 'none',
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `background-color ${transitions.instant}`,
              }}
            >
              <CheckCircle size={12} /> Approve
            </button>
            <button
              onClick={() => onReject(action.id)}
              aria-label={`Reject action: ${action.description}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1.5']} ${spacing['3']}`,
                backgroundColor: colors.statusCriticalSubtle,
                color: colors.statusCritical,
                border: 'none',
                borderRadius: borderRadius.base,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
                transition: `background-color ${transitions.instant}`,
              }}
            >
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

ActionCard.displayName = 'ActionCard'

// ── Batch Action Preview Panel ────────────────────────────────

interface BatchActionPreviewProps {
  actions: AgentSuggestedAction[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onApproveAll: () => void
  onRejectAll: () => void
}

export const BatchActionPreview = memo<BatchActionPreviewProps>(
  ({ actions, onApprove, onReject, onApproveAll, onRejectAll }) => {
    const [expanded, setExpanded] = useState(true)

    const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])

    if (actions.length === 0) return null

    const criticalCount = actions.filter((a) => a.impact === 'critical' || a.impact === 'high').length

    return (
      <div
        style={{
          backgroundColor: colors.orangeSubtle,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderDefault}`,
          overflow: 'hidden',
        }}
        role="region"
        aria-label={`${actions.length} pending agent actions`}
      >
        {/* Header */}
        <button
          onClick={toggleExpanded}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: typography.fontFamily,
          }}
          aria-expanded={expanded}
        >
          <AlertTriangle size={16} color={colors.primaryOrange} />
          <span
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}
          >
            {actions.length} Pending Action{actions.length !== 1 ? 's' : ''}
          </span>
          {criticalCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `1px ${spacing['2']}`,
                borderRadius: borderRadius.full,
                backgroundColor: colors.statusCriticalSubtle,
                color: colors.statusCritical,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              {criticalCount} high priority
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', color: colors.textTertiary }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {/* Action cards */}
        {expanded && (
          <div
            style={{
              padding: `0 ${spacing['4']} ${spacing['4']}`,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing['3'],
            }}
          >
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}

            {/* Batch actions */}
            {actions.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: spacing['2'],
                  paddingTop: spacing['2'],
                  borderTop: `1px solid ${colors.borderSubtle}`,
                }}
              >
                <button
                  onClick={onRejectAll}
                  aria-label="Reject all pending actions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing['1'],
                    padding: `${spacing['2']} ${spacing['4']}`,
                    backgroundColor: 'transparent',
                    color: colors.textTertiary,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.medium,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    transition: `background-color ${transitions.instant}`,
                  }}
                >
                  <XCircle size={13} /> Reject All
                </button>
                <button
                  onClick={onApproveAll}
                  aria-label="Approve all pending actions"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: spacing['1'],
                    padding: `${spacing['2']} ${spacing['4']}`,
                    backgroundColor: colors.primaryOrange,
                    color: colors.white,
                    border: 'none',
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    transition: `background-color ${transitions.instant}`,
                  }}
                >
                  <CheckCircle size={13} /> Approve All ({actions.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
)

BatchActionPreview.displayName = 'BatchActionPreview'
