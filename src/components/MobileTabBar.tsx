// ─────────────────────────────────────────────────────────────────────────────
// MobileTabBar — bottom tab bar (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Per-role 4 primary tabs + a "More" sheet with the rest of the role's nav
// items. Uses iOS safe-area inset padding so the bar floats above the home
// indicator. Renders only on small viewports — Sidebar.tsx swaps in this
// component when a media query reports mobile width.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  MoreHorizontal,
  X,
  Zap,
  MessageCircle,
  FileCheck,
  Calendar,
  DollarSign,
  Layers,
  BookOpen,
  CheckCircle,
  Camera,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Handshake,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { getMobileMoreItems, getMobileTabs, type NavItem } from '../config/navigation'
import type { StreamRole } from '../types/stream'

const ICONS: Record<string, LucideIcon> = {
  Zap,
  MessageCircle,
  FileCheck,
  Calendar,
  DollarSign,
  Layers,
  BookOpen,
  CheckCircle,
  Camera,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Handshake,
  BarChart3,
}

interface MobileTabBarProps {
  streamRole: StreamRole
  activeView: string
  onNavigate: (view: string) => void
}

function isItemActive(item: NavItem, activeView: string): boolean {
  if (item.id === 'command') {
    return activeView === '' || activeView === 'day' || activeView === '/'
  }
  // activeView is the view-id (no leading slash); fall back to comparing
  // against the route's last segment so legacy hash routes still match.
  const routeId = item.route.replace(/^\//, '').split('/')[0]
  return activeView === item.id || activeView === routeId
}

const TabButton: React.FC<{
  item: NavItem
  isActive: boolean
  onClick: () => void
}> = ({ item, isActive, onClick }) => {
  const Icon = ICONS[item.icon] ?? Zap
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minHeight: 56,
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: isActive ? colors.primaryOrange : colors.textTertiary,
        position: 'relative',
        padding: 0,
      }}
    >
      <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />
      <span
        style={{
          fontSize: 10,
          fontFamily: typography.fontFamily,
          fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
          lineHeight: 1,
        }}
      >
        {item.label}
      </span>
      {isActive && (
        <motion.span
          layoutId="mobileTabActive"
          style={{
            position: 'absolute',
            top: 0,
            width: 28,
            height: 2,
            backgroundColor: colors.primaryOrange,
            borderRadius: '0 0 2px 2px',
          }}
        />
      )}
    </button>
  )
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ streamRole, activeView, onNavigate }) => {
  const navigate = useNavigate()
  const tabs = useMemo(() => getMobileTabs(streamRole), [streamRole])
  const moreItems = useMemo(() => getMobileMoreItems(streamRole), [streamRole])
  const [moreOpen, setMoreOpen] = useState(false)

  // Close the more-sheet on Escape (e.g. external bluetooth keyboard).
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [moreOpen])

  const goTo = (item: NavItem) => {
    onNavigate(item.id)
    navigate(item.route)
    setMoreOpen(false)
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: `calc(56px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 1000,
          backgroundColor: colors.surfaceRaised,
          borderTop: `1px solid ${colors.borderSubtle}`,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {tabs.map((item) => (
          <TabButton
            key={item.id}
            item={item}
            isActive={isItemActive(item, activeView)}
            onClick={() => goTo(item)}
          />
        ))}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation items"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              minHeight: 56,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              padding: 0,
            }}
          >
            <MoreHorizontal size={22} strokeWidth={1.75} />
            <span
              style={{
                fontSize: 10,
                fontFamily: typography.fontFamily,
                fontWeight: typography.fontWeight.medium,
                lineHeight: 1,
              }}
            >
              More
            </span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayScrim }}
              aria-hidden
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{
                position: 'relative',
                backgroundColor: colors.surfaceRaised,
                borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
                paddingTop: spacing['4'],
                paddingBottom: `calc(${spacing['8']} + env(safe-area-inset-bottom, 0px))`,
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing['4'] }}>
                <span
                  aria-hidden
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: borderRadius.full,
                    backgroundColor: colors.borderDefault,
                  }}
                />
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: spacing['4'],
                  right: spacing['4'],
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceInset,
                  border: 'none',
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                <X size={16} />
              </button>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: spacing['2'],
                  padding: `0 ${spacing['4']}`,
                }}
              >
                {moreItems.map((item) => {
                  const Icon = ICONS[item.icon] ?? Zap
                  const isActive = isItemActive(item, activeView)
                  return (
                    <button
                      key={item.id}
                      onClick={() => goTo(item)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing['1.5'],
                        minHeight: 72,
                        padding: `${spacing['3']} ${spacing['2']}`,
                        backgroundColor: isActive ? colors.surfaceSelected : colors.surfaceInset,
                        border: `1px solid ${isActive ? colors.primaryOrange : 'transparent'}`,
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        color: isActive ? colors.primaryOrange : colors.textPrimary,
                      }}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: typography.fontFamily,
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

export default MobileTabBar
