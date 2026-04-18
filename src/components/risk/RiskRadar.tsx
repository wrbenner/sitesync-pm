import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, HelpCircle, DollarSign, Calendar } from 'lucide-react'
import { Card, Skeleton, EmptyState } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useRiskScores } from '../../hooks/useRiskScores'
import { riskColor, type ScoredEntity } from '../../lib/riskEngine'

const CATEGORY_ICON: Record<string, React.ElementType> = {
  rfi: HelpCircle,
  budget: DollarSign,
  schedule: Calendar,
  safety: AlertTriangle,
}

const CATEGORY_LABEL: Record<string, string> = {
  rfi: 'RFI',
  budget: 'Budget',
  schedule: 'Schedule',
  safety: 'Safety',
}

export const RiskRadar: React.FC = () => {
  const projectId = useProjectId()
  const navigate = useNavigate()
  const { data, isLoading } = useRiskScores(projectId)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
        <AlertTriangle size={20} color={colors.primaryOrange} />
        <h3 style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold }}>
          Risk Radar — Top 10
        </h3>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height="44px" />
          ))}
        </div>
      ) : !data || data.topRisks.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={32} color={colors.textTertiary} />} title="No risks detected" description="All project indicators are healthy." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          {data.topRisks.map((entry) => (
            <RiskRow key={`${entry.entityType}-${entry.entityId}`} entry={entry} onClick={() => entry.href && navigate(entry.href)} />
          ))}
        </div>
      )}
    </Card>
  )
}

const RiskRow: React.FC<{ entry: ScoredEntity; onClick: () => void }> = ({ entry, onClick }) => {
  const Icon = CATEGORY_ICON[entry.category] ?? AlertTriangle
  const color = riskColor(entry.risk.score)
  const topFactor = entry.risk.factors.slice().sort((a, b) => b.contribution - a.contribution)[0]
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: spacing['3'],
        background: colors.surfaceInset,
        borderRadius: borderRadius.base,
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <Icon size={16} color={colors.textTertiary} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            color: colors.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {entry.entityName}
        </div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          {CATEGORY_LABEL[entry.category]} · {topFactor?.name}
        </div>
      </div>
      <div
        style={{
          minWidth: 56,
          height: 28,
          borderRadius: borderRadius.full,
          background: `${color}22`,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: typography.fontWeight.semibold,
          fontSize: typography.fontSize.label,
        }}
      >
        {entry.risk.score}
      </div>
    </button>
  )
}

export default RiskRadar
