import React, { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { Layers, GitCompare, TrendingUp, BarChart3 } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export type BudgetTab = 'overview' | 'wbs' | 'change-orders' | 'earned-value'

interface TabDef {
  id: BudgetTab
  label: string
  icon: React.FC<{ size?: number; color?: string }>
  count?: number
}

interface BudgetTabBarProps {
  activeTab: BudgetTab
  onTabChange: (tab: BudgetTab) => void
  changeOrderCount?: number
}

export const BudgetTabBar: React.FC<BudgetTabBarProps> = ({
  activeTab, onTabChange, changeOrderCount,
}) => {
  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'wbs', label: 'WBS', icon: BarChart3 },
    { id: 'change-orders', label: 'Change Orders', icon: GitCompare, count: changeOrderCount },
    { id: 'earned-value', label: 'Earned Value', icon: TrendingUp },
  ]

  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [hovered, setHovered] = useState<BudgetTab | null>(null)

  // Measure active tab position for sliding indicator
  const updateIndicator = () => {
    const el = tabRefs.current.get(activeTab)
    const container = containerRef.current
    if (el && container) {
      const cRect = container.getBoundingClientRect()
      const tRect = el.getBoundingClientRect()
      setIndicator({ left: tRect.left - cRect.left, width: tRect.width })
    }
  }

  useLayoutEffect(updateIndicator, [activeTab])
  useEffect(() => {
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeTab])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Budget views"
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: 2,
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: 3,
        marginBottom: spacing['5'],
      }}
    >
      {/* Sliding indicator */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          left: indicator.left,
          width: indicator.width,
          height: 'calc(100% - 6px)',
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.md,
          boxShadow: shadows.sm,
          transition: `left 260ms cubic-bezier(0.16, 1, 0.3, 1), width 260ms cubic-bezier(0.16, 1, 0.3, 1)`,
          zIndex: 0,
        }}
      />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const isHov = hovered === tab.id && !isActive
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            ref={(el) => { if (el) tabRefs.current.set(tab.id, el) }}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            onMouseEnter={() => setHovered(tab.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: spacing['1.5'],
              padding: `6px ${spacing['3']}`,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: borderRadius.md,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              fontFamily: typography.fontFamily,
              color: isActive ? colors.textPrimary : isHov ? colors.textSecondary : colors.textTertiary,
              transition: `color ${transitions.quick}`,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon size={14} color={isActive ? colors.primaryOrange : isHov ? colors.textSecondary : colors.textTertiary} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: borderRadius.full,
                backgroundColor: isActive ? colors.primaryOrange + '18' : colors.surfaceInset,
                color: isActive ? colors.primaryOrange : colors.textTertiary,
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
