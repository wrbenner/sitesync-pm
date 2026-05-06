/**
 * Dashboard tile that renders the PMF metric described in VISION.md:
 * median field-super sessions per day over the last 30 days.
 *
 * Two visual states:
 *   • Hit threshold (≥8/day) → calm green check + "PMF signal"
 *   • Below threshold → muted with "X to target" copy
 *
 * The numbers themselves are diagnostic, not aspirational. We do NOT
 * shame the user when adoption is low — we surface the data so the team
 * can decide whether to invest in onboarding the field crew.
 */

import React from 'react'
import { Activity, CheckCircle2 } from 'lucide-react'
import { useFieldSuperPMF } from '../../hooks/useFieldSuperPMF'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'

export interface FieldSuperPMFPanelProps {
  projectId: string | undefined
}

const TARGET_SESSIONS_PER_DAY = 8

export const FieldSuperPMFPanel: React.FC<FieldSuperPMFPanelProps> = ({ projectId }) => {
  const { data, isLoading } = useFieldSuperPMF(projectId)

  if (isLoading || !data) {
    return (
      <div
        data-skeleton="true"
        style={{
          height: 132,
          borderRadius: borderRadius.xl,
          backgroundColor: colors.surfaceInset,
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
        }}
      />
    )
  }

  const hit = data.hitsPmfThreshold
  const accent = hit ? colors.statusActive : colors.textTertiary
  const subtleBg = hit ? colors.statusActiveSubtle : colors.surfaceInset

  return (
    <section
      role="region"
      aria-label="Field-super PMF signal"
      style={{
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: borderRadius.xl,
        padding: spacing['5'],
        boxShadow: shadows.base,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: borderRadius.full,
            backgroundColor: subtleBg,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {hit ? <CheckCircle2 size={16} /> : <Activity size={16} />}
        </div>
        <span style={{
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Field-super signal · last 30d
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['2'] }}>
        <span
          style={{
            fontSize: 36,
            fontWeight: typography.fontWeight.bold,
            color: accent,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {data.medianSessionsPerDay}
        </span>
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          median sessions/day per active super
        </span>
      </div>

      <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
        {hit
          ? `Hits the ${TARGET_SESSIONS_PER_DAY}+ PMF threshold. ${data.activeUsers} active ${data.activeUsers === 1 ? 'super' : 'supers'}.`
          : data.activeUsers === 0
            ? 'No field activity yet. Onboard your supers to start the signal.'
            : `${TARGET_SESSIONS_PER_DAY - data.medianSessionsPerDay} to target. ${data.activeUsers} active ${data.activeUsers === 1 ? 'super' : 'supers'}.`}
      </div>
    </section>
  )
}

export default FieldSuperPMFPanel
