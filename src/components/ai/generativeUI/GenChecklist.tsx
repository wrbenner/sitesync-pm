import React, { useState, useCallback } from 'react'
import { colors, spacing, typography, borderRadius, transitions } from '../../../styles/theme'
import type { ChecklistBlock } from './types'

interface Props {
  block: ChecklistBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export const GenChecklist: React.FC<Props> = React.memo(({ block, onAction }) => {
  const [checked, setChecked] = useState<Set<string>>(() =>
    new Set(block.items.filter(i => i.checked).map(i => i.id))
  )

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    const item = block.items.find(i => i.id === id)
    if (item) {
      onAction?.('toggle_checklist', { id, checked: !checked.has(id), entity_type: item.entity_type, entity_id: item.entity_id })
    }
  }, [block.items, checked, onAction])

  const total = block.items.length
  const completed = checked.size
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      fontFamily: typography.fontFamily,
      overflow: 'hidden',
    }}>
      {/* Header with progress */}
      <div style={{
        padding: `${spacing['3']} ${spacing['4']}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
        }}>
          {block.title || 'Checklist'}
        </span>
        <span style={{
          fontSize: typography.fontSize.caption,
          color: pct === 100 ? colors.statusActive : colors.textTertiary,
          fontWeight: typography.fontWeight.medium,
        }}>
          {completed}/{total} ({pct}%)
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, backgroundColor: colors.surfaceInset }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: pct === 100 ? colors.statusActive : colors.primaryOrange,
          transition: `width ${transitions.smooth}`,
        }} />
      </div>

      {/* Items */}
      {block.items.map((item) => {
        const isChecked = checked.has(item.id)
        return (
          <label
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['3'],
              padding: `${spacing['2']} ${spacing['4']}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              cursor: 'pointer',
              transition: `background-color ${transitions.instant}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceHover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggle(item.id)}
              style={{ width: 16, height: 16, accentColor: colors.primaryOrange, cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{
              fontSize: typography.fontSize.sm,
              color: isChecked ? colors.textTertiary : colors.textPrimary,
              textDecoration: isChecked ? 'line-through' : 'none',
              transition: `all ${transitions.instant}`,
            }}>
              {item.label}
            </span>
          </label>
        )
      })}
    </div>
  )
})
