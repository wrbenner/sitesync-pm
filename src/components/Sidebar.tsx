// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — role-filtered nav (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Flat list of nav items, filtered by the user's StreamRole. Two visual modes:
//   - collapsed (72px) : icon column with hover tooltip
//   - expanded  (252px): icon + label
// Default is collapsed on /day, otherwise the user's last preference.
//
// Mobile rendering delegates to <MobileTabBar/>; the App shell already swaps
// in MobileLayout on small viewports, so the desktop branch here is the
// primary surface.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  // Nav icons keyed by NAV_ITEMS[].icon
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
import { useNavigate, useLocation } from 'react-router-dom'

import { useUiStore, useAuthStore } from '../stores'
import { useProjects } from '../hooks/queries'
import { useProjectContext } from '../stores/projectContextStore'
import { usePermissions } from '../hooks/usePermissions'
import { CreateProjectModal } from './forms/CreateProjectModal'
import { MobileTabBar } from './MobileTabBar'
import { colors, spacing, typography, borderRadius, zIndex, layout } from '../styles/theme'
import { toStreamRole, type StreamRole } from '../types/stream'
import {
  getNavForRole,
  STREAM_ROLE_LABEL,
  type NavItem,
} from '../config/navigation'

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
  mode?: 'overlay'
  onClose?: () => void
}

// ── Icon registry — string → component ──────────────────────────────────────
// Kept inside the component module so tree-shaking still drops icons no nav
// item references; growing the registry is just adding a key here + bumping
// NAV_ITEMS.

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

const COLLAPSED_W = 72
const EXPANDED_W = 252
const SIDEBAR_PREF_KEY = 'sitesync-sidebar-collapsed'

function readStoredCollapsed(fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(SIDEBAR_PREF_KEY)
    if (raw == null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}

function writeStoredCollapsed(v: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_PREF_KEY, String(v))
  } catch {
    /* storage full / disabled — non-critical */
  }
}

// ── Project switcher (compact) ──────────────────────────────────────────────

const ProjectSwitcher: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const setActiveProject = useProjectContext((s) => s.setActiveProject)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const activeProject = projects?.find((p) => p.id === activeProjectId)
  const hasProjects = !!projects && projects.length > 0
  const initial = activeProject?.name?.[0]?.toUpperCase() ?? '+'
  const showSearch = (projects?.length ?? 0) > 5
  const filtered = useMemo(() => {
    if (!projects) return []
    const q = filter.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name?.toLowerCase().includes(q))
  }, [projects, filter])

  // Reset the search whenever the dropdown closes so the next open starts fresh.
  useEffect(() => {
    if (!open) setFilter('')
  }, [open])

  if (collapsed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: `${spacing['3']} 0` }}>
        <button
          onClick={() => setCreateOpen(true)}
          aria-label={activeProject ? `Project: ${activeProject.name}` : 'Create project'}
          title={activeProject?.name ?? 'Create project'}
          style={{
            width: 36,
            height: 36,
            borderRadius: borderRadius.md,
            border: 'none',
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
            color: colors.white,
            fontSize: 14,
            fontWeight: typography.fontWeight.bold,
            fontFamily: typography.fontFamily,
          }}
        >
          {initial}
        </button>
        <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </div>
    )
  }

  return (
    <div style={{ padding: `${spacing['3']} ${spacing['3']} ${spacing['2']}`, position: 'relative' }}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: `${spacing['2']} ${spacing['2.5']}`,
          minHeight: 36,
          backgroundColor: colors.surfaceFlat,
          border: `1px solid ${open ? colors.primaryOrange : colors.borderSubtle}`,
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          color: colors.textPrimary,
          textAlign: 'left',
          transition: 'border-color 120ms ease',
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: borderRadius.sm,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
            color: colors.white,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: typography.fontWeight.bold,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeProject?.name ?? 'Select project'}
        </span>
        <ChevronDown
          size={14}
          color={colors.textTertiary}
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }}
        />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            aria-hidden
          />
          <div
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: spacing['3'],
              right: spacing['3'],
              marginTop: spacing['1'],
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              zIndex: 100,
              maxHeight: 280,
              overflowY: 'auto',
              padding: spacing['1'],
            }}
          >
            {showSearch && (
              <div style={{ padding: `${spacing['1']} ${spacing['1']}` }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `6px ${spacing['2']}`,
                    backgroundColor: colors.surfaceFlat,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  <Search size={12} color={colors.textTertiary} />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search projects…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Search projects"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamily,
                      color: colors.textPrimary,
                      minWidth: 0,
                    }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => {
                // Project creation now lives at /onboarding — owned by the
                // T-Onboarding tab and styled to match the cockpit. The
                // legacy modal stays mounted (line below) for callers that
                // still open createOpen=true, but the sidebar's primary
                // entry point now goes to the full-page flow.
                setOpen(false)
                navigate('/onboarding')
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['1.5']} ${spacing['2']}`,
                minHeight: 32,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
                color: colors.primaryOrange,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                textAlign: 'left',
              }}
            >
              <Plus size={14} />
              <span style={{ fontWeight: typography.fontWeight.medium }}>New project</span>
            </button>
            {hasProjects && filtered.length === 0 && (
              <div
                style={{
                  padding: `${spacing['2']} ${spacing['2']}`,
                  fontSize: typography.fontSize.caption,
                  color: colors.textTertiary,
                  textAlign: 'center',
                }}
              >
                No matches.
              </div>
            )}
            {hasProjects && filtered.map((p) => {
              const isActive = p.id === activeProjectId
              return (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveProject(p.id)
                    setOpen(false)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing['2'],
                    padding: `${spacing['1.5']} ${spacing['2']}`,
                    minHeight: 32,
                    backgroundColor: isActive ? colors.surfaceSelected : 'transparent',
                    border: 'none',
                    borderRadius: borderRadius.sm,
                    cursor: 'pointer',
                    color: isActive ? colors.primaryOrange : colors.textPrimary,
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: borderRadius.sm,
                      background: isActive
                        ? `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`
                        : colors.surfaceInset,
                      color: isActive ? colors.white : colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: typography.fontWeight.bold,
                    }}
                  >
                    {p.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

// ── Nav button ──────────────────────────────────────────────────────────────

interface NavButtonProps {
  item: NavItem
  Icon: LucideIcon
  collapsed: boolean
  isActive: boolean
  onClick: () => void
}

const NavButton: React.FC<NavButtonProps> = ({ item, Icon, collapsed, isActive, onClick }) => {
  const [hovered, setHovered] = useState(false)

  const baseColor = isActive
    ? colors.textPrimary
    : hovered
      ? colors.textPrimary
      : colors.textSecondary
  const baseBg = isActive ? colors.surfaceSelected : hovered ? colors.surfaceHover : 'transparent'
  const iconColor = isActive ? colors.primaryOrange : baseColor

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2.5'],
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? `10px 0` : `8px ${spacing['3']}`,
        minHeight: 40,
        margin: '1px 0',
        backgroundColor: baseBg,
        color: baseColor,
        border: 'none',
        borderRadius: borderRadius.md,
        cursor: 'pointer',
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
        fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
        textAlign: 'left',
        transition: 'background-color 80ms ease, color 80ms ease',
      }}
    >
      {isActive && (
        <motion.span
          layoutId="sidebarActiveRail"
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            backgroundColor: colors.primaryOrange,
            borderRadius: '0 2px 2px 0',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <Icon size={18} strokeWidth={1.75} color={iconColor} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </span>
      )}
    </button>
  )
}

// ── User strip (bottom of sidebar) ──────────────────────────────────────────

const UserStrip: React.FC<{ collapsed: boolean; streamRole: StreamRole }> = ({
  collapsed,
  streamRole,
}) => {
  const navigate = useNavigate()
  const authProfile = useAuthStore((s) => s.profile)
  const authUser = useAuthStore((s) => s.user)
  const fullName = authProfile?.full_name?.trim() || ''
  const email = authUser?.email?.trim() || ''
  const emailLocal = email.split('@')[0] ?? ''
  const derivedFromEmail = emailLocal
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const displayName = fullName || derivedFromEmail || 'You'
  const initials =
    (displayName.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() ||
    displayName.slice(0, 1).toUpperCase() ||
    'Y'
  const roleLabel = STREAM_ROLE_LABEL[streamRole]

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.borderSubtle}`,
        padding: collapsed ? `${spacing['2']} 0` : `${spacing['2']} ${spacing['3']}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing['2'],
        justifyContent: collapsed ? 'center' : 'space-between',
      }}
    >
      <button
        onClick={() => navigate('/profile')}
        aria-label={`Profile — ${displayName}, ${roleLabel}`}
        title={collapsed ? `${displayName} · ${roleLabel}` : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['2'],
          padding: collapsed ? 0 : `4px ${spacing['1']}`,
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: borderRadius.md,
          cursor: 'pointer',
          color: colors.textPrimary,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.sm,
          minWidth: 0,
          flex: collapsed ? '0 0 auto' : 1,
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: colors.surfaceInset,
            color: colors.textPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: typography.fontWeight.bold,
            flexShrink: 0,
          }}
        >
          {initials}
        </span>
        {!collapsed && (
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
            <span
              style={{
                fontWeight: typography.fontWeight.medium,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                alignSelf: 'flex-start',
                display: 'inline-block',
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textSecondary,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 999,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              {roleLabel}
            </span>
          </span>
        )}
      </button>
      {!collapsed && (
        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          title="Settings"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: borderRadius.md,
            cursor: 'pointer',
            color: colors.textSecondary,
          }}
        >
          <Settings size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, mode, onClose }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const isOverlay = mode === 'overlay'
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore()
  const { role: projectRole } = usePermissions()
  const streamRole: StreamRole = useMemo(() => toStreamRole(projectRole), [projectRole])
  const navItems = useMemo(() => getNavForRole(streamRole), [streamRole])

  // Mobile detection — when present we render <MobileTabBar/>; the App shell
  // already prefers MobileLayout, so this is the safety net.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Default-collapse on /day; on every other page, reapply the user's last
  // preference from localStorage. Track the prior pathname in a ref so we
  // only re-sync when it actually changes (avoids cascading re-renders that
  // a state-tracked previous value would cause).
  const lastPathRef = useRef(location.pathname)
  useEffect(() => {
    if (location.pathname === lastPathRef.current) return
    lastPathRef.current = location.pathname
    if (location.pathname === '/day') {
      setSidebarCollapsed(true)
      return
    }
    setSidebarCollapsed(readStoredCollapsed(false))
  }, [location.pathname, setSidebarCollapsed])

  // Persist user-driven changes — but only when they happen on a non-/day
  // page so the auto-collapse on /day doesn't poison the preference.
  useEffect(() => {
    if (location.pathname === '/day') return
    writeStoredCollapsed(sidebarCollapsed)
  }, [sidebarCollapsed, location.pathname])

  // Keyboard: `[` toggles the sidebar (light-touch chord). Cmd+\ is the
  // platform-standard sidebar toggle and works even while typing in an
  // input. Cmd+B remains wired by App.tsx for the legacy chord.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      // Cmd/Ctrl + \ — works regardless of focus target
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
        return
      }
      // Bare `[` — only when not typing in a field
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarCollapsed, setSidebarCollapsed])

  if (isMobile) {
    return <MobileTabBar streamRole={streamRole} activeView={activeView} onNavigate={onNavigate} />
  }

  const collapsed = sidebarCollapsed
  const width = isOverlay ? layout.sidebarWidth : collapsed ? COLLAPSED_W : EXPANDED_W

  return (
    <nav
      aria-label="Main navigation"
      style={{
        ...(isOverlay
          ? { position: 'relative', height: '100%', width }
          : {
              position: 'sticky',
              top: 0,
              alignSelf: 'start',
              height: '100vh',
              width: '100%',
              zIndex: zIndex.sticky,
            }),
        backgroundColor: colors.surfaceSidebar,
        borderRight: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Brand row */}
      <div
        style={{
          padding: collapsed ? `${spacing['3']} 0` : `${spacing['3']} ${spacing['3']}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: spacing['2'],
        }}
      >
        {collapsed ? (
          <button
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar ([)"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceFlat,
              border: 'none',
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              color: colors.textSecondary,
            }}
          >
            <PanelLeftOpen size={18} strokeWidth={1.75} />
          </button>
        ) : (
          <>
            <span
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: 800,
                color: colors.textPrimary,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              SiteSync
            </span>
            <button
              onClick={() => (isOverlay && onClose ? onClose() : setSidebarCollapsed(true))}
              aria-label={isOverlay ? 'Close navigation' : 'Collapse sidebar'}
              title={isOverlay ? 'Close' : 'Collapse sidebar (])'}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: borderRadius.sm,
                cursor: 'pointer',
                color: colors.textSecondary,
              }}
            >
              <PanelLeftClose size={16} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      <ProjectSwitcher collapsed={collapsed} />

      {/* Search affordance — opens the command palette on click (App handles ⌘K) */}
      {!collapsed && (
        <div style={{ padding: `${spacing['1']} ${spacing['3']} ${spacing['2']}` }}>
          <button
            onClick={() => {
              if (typeof window === 'undefined') return
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['2.5']}`,
              minHeight: 36,
              backgroundColor: colors.surfaceFlat,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              cursor: 'pointer',
              color: colors.textTertiary,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              textAlign: 'left',
            }}
          >
            <Search size={14} />
            <span style={{ flex: 1 }}>Search or jump to…</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                backgroundColor: colors.surfaceInset,
                padding: '2px 6px',
                borderRadius: borderRadius.sm,
                letterSpacing: '0.04em',
              }}
            >
              ⌘K
            </span>
          </button>
        </div>
      )}

      {/* Nav list */}
      <div
        style={{
          flex: 1,
          padding: collapsed ? `${spacing['1']} ${spacing['2']}` : `${spacing['1']} ${spacing['2']}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {navItems.map((item) => {
          const Icon = ICONS[item.icon] ?? Zap
          // Active when the route prefix matches — handles nested detail
          // pages (e.g. /rfis/123 still highlights RFIs) without needing a
          // separate "section" concept.
          const isActive =
            item.id === 'command'
              ? location.pathname === '/' || location.pathname === '/day'
              : location.pathname === item.route ||
                location.pathname.startsWith(`${item.route}/`)
          return (
            <NavButton
              key={item.id}
              item={item}
              Icon={Icon}
              collapsed={collapsed}
              isActive={isActive}
              onClick={() => {
                onNavigate(item.id)
                navigate(item.route)
              }}
            />
          )
        })}
      </div>

      <UserStrip collapsed={collapsed} streamRole={streamRole} />
    </nav>
  )
}

export default Sidebar
