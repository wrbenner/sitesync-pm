import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Card, Btn, ProgressBar } from '../../Primitives'
import { PermissionGate } from '../../auth/PermissionGate'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import type { CostBreakdownBlock, CostLineItem } from './types'

interface GenCostBreakdownProps {
  block: CostBreakdownBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

const STATUS_CONFIG: Record<CostLineItem['status'], { color: string; label: string }> = {
  under_budget: { color: colors.statusActive, label: 'Under Budget' },
  on_budget: { color: colors.statusInfo, label: 'On Budget' },
  at_risk: { color: colors.statusPending, label: 'At Risk' },
  over_budget: { color: colors.statusCritical, label: 'Over Budget' },
}

const fmt = (n: number) => `$${Math.abs(n).toLocaleString()}`

export const GenCostBreakdown: React.FC<GenCostBreakdownProps> = React.memo(({ block, onAction }) => {
  const overBudgetCount = useMemo(
    () => block.line_items.filter((i) => i.status === 'over_budget').length,
    [block.line_items],
  )

  const varianceColor = block.total_variance >= 0 ? colors.statusActive : colors.statusCritical

  return (
    <Card padding="0">
      {/* Header */}
      <div style={{ padding: spacing['4'], borderBottom: `1px solid ${colors.borderDefault}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['3'] }}>
          <div>
            <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              {block.title}
            </p>
            {block.cost_code && (
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>
                Cost Code: {block.cost_code}
              </p>
            )}
          </div>
          {block.last_updated && (
            <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>
              Updated {new Date(block.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['3'] }}>
          {[
            { label: 'Budget', value: fmt(block.total_budget), color: colors.textPrimary },
            { label: 'Spent', value: fmt(block.total_spent), color: colors.textPrimary },
            { label: 'Variance', value: `${block.total_variance >= 0 ? '+' : '-'}${fmt(block.total_variance)}`, color: varianceColor },
            { label: '% Spent', value: `${block.percent_spent}%`, color: colors.textPrimary },
          ].map((m) => (
            <div key={m.label}>
              <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0, marginBottom: spacing['1'] }}>{m.label}</p>
              <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: m.color, margin: 0 }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div style={{ marginTop: spacing['3'] }}>
          <ProgressBar value={block.percent_spent} max={100} height={4} color={block.percent_spent > 90 ? colors.statusCritical : colors.primaryOrange} />
        </div>
      </div>

      {/* Over-budget warning */}
      {overBudgetCount > 0 && (
        <div style={{
          display: 'flex', gap: spacing['2'], padding: `${spacing['2']} ${spacing['4']}`,
          backgroundColor: `${colors.statusCritical}08`, borderLeft: `3px solid ${colors.statusCritical}`,
        }}>
          <AlertTriangle size={14} color={colors.statusCritical} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical }}>
            {overBudgetCount} line item{overBudgetCount !== 1 ? 's' : ''} over budget
          </span>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }} role="table">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: colors.surfaceInset }}>
              {['Description', 'Qty', 'Unit Price', 'Budget', 'Spent', 'Variance', 'Status'].map((h, i) => (
                <th key={h} style={{
                  padding: `${spacing['2']} ${spacing['3']}`, textAlign: i === 0 ? 'left' : i === 6 ? 'center' : 'right',
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, borderBottom: `1px solid ${colors.borderDefault}`,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.line_items.map((item) => {
              const cfg = STATUS_CONFIG[item.status]
              return (
                <tr key={item.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
                    {item.description}
                    {item.trade && <span style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 1 }}>{item.trade}</span>}
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'right', fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'right', fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                    ${item.unit_price.toFixed(2)}
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'right', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {fmt(item.budget)}
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'right', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {fmt(item.spent)}
                  </td>
                  <td style={{
                    padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'right',
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                    color: item.variance >= 0 ? colors.statusActive : colors.statusCritical,
                  }}>
                    {item.variance >= 0 ? '+' : '-'}{fmt(item.variance)}
                  </td>
                  <td style={{ padding: `${spacing['3']} ${spacing['3']}`, textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                      color: cfg.color, backgroundColor: `${cfg.color}12`,
                      padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.sm,
                    }}>
                      {item.variance >= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {onAction && (
        <div style={{ padding: spacing['3'], borderTop: `1px solid ${colors.borderDefault}`, display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
          <Btn variant="secondary" size="sm" onClick={() => onAction('export_cost_data', { cost_code: block.cost_code })}>
            Export
          </Btn>
          <PermissionGate permission="budget.approve">
            <Btn variant="primary" size="sm" onClick={() => onAction('approve_budget', { cost_code: block.cost_code })}>
              Approve
            </Btn>
          </PermissionGate>
        </div>
      )}
    </Card>
  )
})

GenCostBreakdown.displayName = 'GenCostBreakdown'
