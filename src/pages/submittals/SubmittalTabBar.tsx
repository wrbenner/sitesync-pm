import React, { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { Layers, ClipboardList, Timer, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme'

export type SubmittalStatusFilter = 'all' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'revise_resubmit'

interface TabDef {
  id: SubmittalStatusFilter
  label: string
  icon: React.FC<{ size?: number; color?: string }>
  isAlert?: boolean
}

interface SubmittalTabBarProps {
  activeTab: SubmittalStatusFilter
  onTabChange: (tab: SubmittalStatusFilter) => void
  counts: Record<SubmittalStatusFilter, number>
}

const TABS: TabDef[] = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'pending', label: 'Pending', icon: ClipboardList },
  { id: 'in_review', label: 'In Review', icon: Timer },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle, isAlert: true },
  { id: 'revise_resubmit', label: 'Resubmit', icon: RotateCcw, isAlert: true },
]

export const SubmittalTabBar: React.FC<SubmittalTabBarProps> = ({
  activeTab, onTabChange, counts,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [hovered, setHovered] = useState<SubmittalStatusFilter | null>(null)

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
      aria-label="Filter submittals by status"
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: 2,
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: 3,
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

      {TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const isHov = hovered === tab.id && !isActive
        const count = counts[tab.id] || 0
        const isAlertTab = tab.isAlert && count > 0
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
              color: isActive
                ? colors.textPrimary
                : isAlertTab
                  ? colors.statusCritical
                  : isHov
                    ? colors.textSecondary
                    : colors.textTertiary,
              transition: `color ${transitions.quick}`,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon
              size={14}
              color={
                isActive
                  ? colors.primaryOrange
                  : isAlertTab
                    ? colors.statusCritical
                    : isHov
                      ? colors.textSecondary
                      : colors.textTertiary
              }
            />
            {tab.label}
            {count > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: borderRadius.full,
                backgroundColor: isActive
                  ? colors.primaryOrange + '18'
                  : isAlertTab
                    ? `${colors.statusCritical}12`
                    : colors.surfaceInset,
                color: isActive
                  ? colors.primaryOrange
                  : isAlertTab
                    ? colors.statusCritical
                    : colors.textTertiary,
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
