import React, { useMemo, memo } from 'react'
import {
  ShieldCheck, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Award, ClipboardCheck, Eye,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'
import { calculateSafetyScore } from '../../lib/safetyScoring'
import type { SafetyScoreInput } from '../../lib/safetyScoring'

// ── Score Ring ────────────────────────────────────────────────

const ScoreRing = memo<{ score: number; grade: string; size?: number }>(
  ({ score, grade, size = 120 }) => {
    const strokeWidth = 8
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const progress = (score / 100) * circumference
    const color =
      score >= 90 ? colors.statusActive :
      score >= 70 ? colors.statusPending :
      score >= 50 ? colors.primaryOrange : colors.statusCritical

    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={colors.surfaceInset}
            strokeWidth={strokeWidth}
          />
          {/* Score ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: `stroke-dashoffset ${transitions.smooth}` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: size > 100 ? typography.fontSize.heading : typography.fontSize.title,
            fontWeight: typography.fontWeight.bold, color,
            lineHeight: typography.lineHeight.none,
          }}>
            {score}
          </span>
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary, marginTop: spacing['0.5'],
          }}>
            Grade {grade}
          </span>
        </div>
      </div>
    )
  },
)
ScoreRing.displayName = 'ScoreRing'

// ── Component Row ─────────────────────────────────────────────

const ComponentRow = memo<{
  icon: React.ElementType
  label: string
  score: number
  detail: string
  weight?: number
}>(({ icon: Icon, label, score, detail }) => {
  const barColor =
    score >= 80 ? colors.statusActive :
    score >= 60 ? colors.statusPending : colors.statusCritical

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['3'],
      padding: `${spacing['2']} 0`,
    }}>
      <Icon size={14} color={colors.textTertiary} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['1'] }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
            {label}
          </span>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {detail}
          </span>
        </div>
        <div style={{ height: 4, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${score}%`,
            backgroundColor: barColor, borderRadius: borderRadius.full,
            transition: `width ${transitions.smooth}`,
          }} />
        </div>
      </div>
      <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: barColor, minWidth: 28, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  )
})
ComponentRow.displayName = 'ComponentRow'

// ── Main Safety Score Card ────────────────────────────────────

interface SafetyScoreCardProps {
  input: SafetyScoreInput
  compact?: boolean
}

export const SafetyScoreCard = memo<SafetyScoreCardProps>(({ input, compact }) => {
  const score = useMemo(() => calculateSafetyScore(input), [input])

  const TrendIcon = score.trend === 'improving' ? TrendingUp : score.trend === 'declining' ? TrendingDown : Minus
  const trendColor = score.trend === 'improving' ? colors.statusActive : score.trend === 'declining' ? colors.statusCritical : colors.textTertiary
  const trendLabel = score.trend === 'improving' ? 'Improving' : score.trend === 'declining' ? 'Declining' : 'Stable'

  const riskColor =
    score.riskLevel === 'low' ? colors.statusActive :
    score.riskLevel === 'moderate' ? colors.statusPending :
    score.riskLevel === 'high' ? colors.primaryOrange : colors.statusCritical

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, boxShadow: shadows.card,
      }}>
        <ScoreRing score={score.overall} grade={score.grade} size={64} />
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Safety Score
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['0.5'] }}>
            <TrendIcon size={12} color={trendColor} />
            <span style={{ fontSize: typography.fontSize.caption, color: trendColor, fontWeight: typography.fontWeight.medium }}>{trendLabel}</span>
            <span style={{
              padding: `1px ${spacing['2']}`, borderRadius: borderRadius.full,
              backgroundColor: `${riskColor}14`, color: riskColor,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            }}>
              {score.riskLevel} risk
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg,
      boxShadow: shadows.card, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['4'],
        padding: spacing['5'],
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <ScoreRing score={score.overall} grade={score.grade} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <ShieldCheck size={16} color={colors.textSecondary} />
            <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Safety Score
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <TrendIcon size={14} color={trendColor} />
              <span style={{ fontSize: typography.fontSize.sm, color: trendColor, fontWeight: typography.fontWeight.medium }}>{trendLabel}</span>
            </div>
            <span style={{
              padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
              backgroundColor: `${riskColor}14`, color: riskColor,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            }}>
              {score.riskLevel.charAt(0).toUpperCase() + score.riskLevel.slice(1)} Risk
            </span>
            <span style={{
              fontSize: typography.fontSize.caption, color: colors.textTertiary,
            }}>
              TRIR: {score.components.incidentRate.trir}
            </span>
          </div>
        </div>
      </div>

      {/* Component breakdown */}
      <div style={{ padding: `${spacing['3']} ${spacing['5']}` }}>
        <ComponentRow
          icon={AlertTriangle}
          label="Incident Rate"
          score={score.components.incidentRate.score}
          detail={`TRIR ${score.components.incidentRate.trir}`}
          weight={score.components.incidentRate.weight}
        />
        <ComponentRow
          icon={CheckCircle}
          label="Corrective Actions"
          score={score.components.correctiveActions.score}
          detail={`${score.components.correctiveActions.closureRate}% closed`}
          weight={score.components.correctiveActions.weight}
        />
        <ComponentRow
          icon={Eye}
          label="PPE Compliance"
          score={score.components.ppeCompliance.score}
          detail={`${score.components.ppeCompliance.complianceRate}% compliant`}
          weight={score.components.ppeCompliance.weight}
        />
        <ComponentRow
          icon={ClipboardCheck}
          label="Inspections"
          score={score.components.inspections.score}
          detail={`${score.components.inspections.passRate}% passed`}
          weight={score.components.inspections.weight}
        />
        <ComponentRow
          icon={Award}
          label="Certifications"
          score={score.components.certifications.score}
          detail={`${score.components.certifications.complianceRate}% valid`}
          weight={score.components.certifications.weight}
        />
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div style={{
          padding: `${spacing['3']} ${spacing['5']} ${spacing['5']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}>
          <p style={{
            margin: 0, marginBottom: spacing['2'],
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textTertiary, textTransform: 'uppercase',
            letterSpacing: typography.letterSpacing.wider,
          }}>
            Recommendations
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
            {score.recommendations.map((rec, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['2'] }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: colors.primaryOrange, marginTop: spacing['1.5'], flexShrink: 0 }} />
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
                  {rec}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
SafetyScoreCard.displayName = 'SafetyScoreCard'
