import React from 'react'
import { HelpCircle, DollarSign, Calendar, ShieldAlert, TrendingUp } from 'lucide-react'
import { Card, Skeleton } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useRiskScores } from '../../hooks/useRiskScores'
import { riskColor, riskLevel } from '../../lib/riskEngine'

const CATS: Array<{ key: 'rfi' | 'budget' | 'schedule' | 'safety'; label: string; icon: React.ElementType }> = [
  { key: 'rfi', label: 'RFI Risk', icon: HelpCircle },
  { key: 'budget', label: 'Budget Risk', icon: DollarSign },
  { key: 'schedule', label: 'Schedule Risk', icon: Calendar },
  { key: 'safety', label: 'Safety Risk', icon: ShieldAlert },
]

export const ProjectRiskSummary: React.FC = () => {
  const projectId = useProjectId()
  const { data, isLoading } = useRiskScores(projectId)

  if (isLoading) {
    return (
      <Card>
        <Skeleton height="200px" />
      </Card>
    )
  }

  if (!data) return null

  const color = riskColor(data.overallScore)
  const level = riskLevel(data.overallScore)
  const insight = buildInsight(data.categoryAverages)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <TrendingUp size={20} color={colors.primaryOrange} />
        <h3 style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
          Project Risk Summary
        </h3>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], marginBottom: spacing['5'] }}>
        <div
          aria-label={`Overall project risk ${data.overallScore}`}
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: `conic-gradient(${color} ${data.overallScore * 3.6}deg, ${colors.surfaceInset} 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: colors.surfaceRaised,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color }}>
              {data.overallScore}
            </div>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>
              {level}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'] }}>
            AI Insight
          </div>
          <div style={{ fontSize: typography.fontSize.body, color: colors.textPrimary }}>{insight}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: spacing['3'],
        }}
      >
        {CATS.map((c) => {
          const s = data.categoryAverages[c.key]
          const col = riskColor(s)
          const Icon = c.icon
          return (
            <div
              key={c.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: spacing['3'],
                background: colors.surfaceInset,
                borderRadius: borderRadius.base,
              }}
            >
              <Icon size={18} color={col} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: typography.fontSize.label, color: colors.textTertiary }}>{c.label}</div>
                <div style={{ fontSize: typography.fontSize.medium, fontWeight: typography.fontWeight.semibold, color: col }}>
                  {s}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function buildInsight(cats: { rfi: number; budget: number; schedule: number; safety: number }): string {
  const entries = Object.entries(cats) as Array<[keyof typeof cats, number]>
  const worst = entries.sort((a, b) => b[1] - a[1])[0]
  const labels: Record<string, string> = {
    rfi: 'RFI response times',
    budget: 'Budget consumption',
    schedule: 'Schedule slippage',
    safety: 'Safety compliance',
  }
  if (worst[1] <= 25) return 'All risk indicators are within acceptable thresholds.'
  return `${labels[worst[0]]} is the top driver of project risk at ${worst[1]}/100.`
}

export default ProjectRiskSummary
