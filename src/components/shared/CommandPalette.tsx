import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Command } from 'cmdk'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, Home, LayoutGrid, FileText, HelpCircle, ClipboardList, Calendar,
  DollarSign, Users, CheckSquare, BookOpen, Zap, Eye, Briefcase, ListChecks,
  MessageCircle, Heart, Clock, Plus, Camera, Upload, PenTool,
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions, touchTarget } from '../../styles/theme'
import { searchAll, type SearchResult } from '../../lib/search'
import { registerGlobal } from '../../hooks/useKeyboardShortcuts'

// ---------------------------------------------------------------------------
// Navigation pages
// ---------------------------------------------------------------------------
const pages = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: LayoutGrid, label: 'Tasks', path: '/tasks' },
  { icon: HelpCircle, label: 'RFIs', path: '/rfis' },
  { icon: ClipboardList, label: 'Submittals', path: '/submittals' },
  { icon: Calendar, label: 'Schedule', path: '/schedule' },
  { icon: ListChecks, label: 'Lookahead', path: '/lookahead' },
  { icon: DollarSign, label: 'Budget', path: '/budget' },
  { icon: FileText, label: 'Drawings', path: '/drawings' },
  { icon: Users, label: 'Crews', path: '/crews' },
  { icon: BookOpen, label: 'Daily Log', path: '/daily-log' },
  { icon: CheckSquare, label: 'Punch List', path: '/punch-list' },
  { icon: Briefcase, label: 'Directory', path: '/directory' },
  { icon: Calendar, label: 'Meetings', path: '/meetings' },
  { icon: FileText, label: 'Files', path: '/files' },
  { icon: MessageCircle, label: 'Activity', path: '/activity' },
  { icon: Zap, label: 'AI Copilot', path: '/copilot' },
  { icon: Camera, label: 'Field Capture', path: '/field-capture' },
  { icon: Eye, label: 'Vision', path: '/vision' },
  { icon: Clock, label: 'Time Machine', path: '/time-machine' },
  { icon: Heart, label: 'Project Health', path: '/project-health' },
]

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------
const quickActions = [
  { icon: Plus, label: 'Create RFI', path: '/rfis', subtitle: 'Start a new request for information' },
  { icon: Plus, label: 'Create Task', path: '/tasks', subtitle: 'Add a new task to the board' },
  { icon: BookOpen, label: 'Log Daily Report', path: '/daily-log', subtitle: 'Submit today\'s daily log' },
  { icon: CheckSquare, label: 'Add Punch Item', path: '/punch-list', subtitle: 'Create a new punch list entry' },
  { icon: Upload, label: 'Upload File', path: '/files', subtitle: 'Upload a document or drawing' },
  { icon: PenTool, label: 'Start Meeting Notes', path: '/meetings', subtitle: 'Begin capturing meeting notes' },
  { icon: DollarSign, label: 'New Change Order', path: '/budget', subtitle: 'Submit a change order request' },
]

// ---------------------------------------------------------------------------
// Type badge colors for Orama results
// ---------------------------------------------------------------------------
const typeBadgeColors: Record<string, { bg: string; text: string }> = {
  rfi: { bg: colors.statusInfoSubtle, text: colors.statusInfo },
  submittal: { bg: colors.statusPendingSubtle, text: colors.statusPending },
  punch_item: { bg: colors.statusCriticalSubtle, text: colors.statusCritical },
  drawing: { bg: colors.orangeSubtle, text: colors.primaryOrange },
  task: { bg: colors.statusActiveSubtle, text: colors.statusActive },
  contact: { bg: colors.statusReviewSubtle, text: colors.statusReview },
  file: { bg: colors.statusNeutralSubtle, text: colors.statusNeutral },
}

// ---------------------------------------------------------------------------
// Recent pages helpers
// ---------------------------------------------------------------------------
const RECENT_KEY = 'sitesync-recent-pages'

function getRecentPages(): Array<{ label: string; path: string }> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function addRecentPage(label: string, path: string) {
  const pages = getRecentPages().filter(p => p.path !== path)
  pages.unshift({ label, path })
  localStorage.setItem(RECENT_KEY, JSON.stringify(pages.slice(0, 5)))
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  zIndex: zIndex.command as number,
  display: 'flex',
  justifyContent: 'center',
  paddingTop: '15vh',
}

const dialogStyle: React.CSSProperties = {
  width: '600px',
  maxWidth: '90vw',
  maxHeight: '70vh',
  background: colors.white,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'cmdkScaleIn 160ms ease-out',
}

const inputWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: `${spacing.lg} ${spacing.xl}`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: typography.fontSize.xl,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.normal,
  color: colors.textPrimary,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  letterSpacing: typography.letterSpacing.normal,
  lineHeight: typography.lineHeight.normal,
}

const escBadgeStyle: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.medium,
  color: colors.textTertiary,
  background: colors.surfaceInset,
  padding: `2px ${spacing.sm}`,
  borderRadius: borderRadius.sm,
  letterSpacing: typography.letterSpacing.wide,
  userSelect: 'none',
  flexShrink: 0,
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: spacing.sm,
}


const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: `${spacing.md} ${spacing.lg}`,
  minHeight: touchTarget.field,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.normal,
  color: colors.textPrimary,
  letterSpacing: typography.letterSpacing.normal,
  transition: transitions.instant,
}

const itemIconStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  color: colors.textTertiary,
  flexShrink: 0,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: typography.fontSize.sm,
  color: colors.textTertiary,
  marginTop: '2px',
  letterSpacing: typography.letterSpacing.normal,
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.xl,
  padding: `${spacing.md} ${spacing.lg}`,
  borderTop: `1px solid ${colors.borderSubtle}`,
  fontSize: typography.fontSize.caption,
  color: colors.textTertiary,
  letterSpacing: typography.letterSpacing.wide,
  userSelect: 'none',
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '20px',
  height: '20px',
  padding: `0 ${spacing.xs}`,
  background: colors.surfaceInset,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.caption,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.medium,
  color: colors.textTertiary,
  lineHeight: 1,
}

const typeBadgeStyle = (type: string): React.CSSProperties => {
  const badge = typeBadgeColors[type] || { bg: colors.statusNeutralSubtle, text: colors.statusNeutral }
  return {
    display: 'inline-block',
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    color: badge.text,
    background: badge.bg,
    padding: `2px ${spacing.sm}`,
    borderRadius: borderRadius.full,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'capitalize' as const,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }
}

// ---------------------------------------------------------------------------
// Inject keyframe animation (once)
// ---------------------------------------------------------------------------
const ANIMATION_ID = 'cmdk-palette-keyframes'
function ensureKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(ANIMATION_ID)) return
  const style = document.createElement('style')
  style.id = ANIMATION_ID
  style.textContent = `
    @keyframes cmdkScaleIn {
      from { opacity: 0; transform: scale(0.97) translateY(-4px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    [cmdk-item][data-selected="true"] {
      background: ${colors.surfaceFlat} !important;
    }
  `
  document.head.appendChild(style)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open?: boolean
  onClose?: () => void
}

export function CommandPalette({ open: controlledOpen, onClose }: CommandPaletteProps = {}) {
  const navigate = useNavigate()
  const location = useLocation()

  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    setInternalOpen(false)
    onClose?.()
  }, [onClose])

  // Inject keyframes on mount
  useEffect(() => {
    ensureKeyframes()
  }, [])

  // ---- Register Cmd+K globally only when uncontrolled ----
  useEffect(() => {
    if (controlledOpen !== undefined) return
    return registerGlobal('meta+k', () => setInternalOpen(prev => !prev))
  }, [controlledOpen])

  // ---- Escape closes the palette ----
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleClose])

  // ---- Track recent pages on route changes ----
  useEffect(() => {
    const match = pages.find(p => p.path === location.pathname)
    if (match) {
      addRecentPage(match.label, match.path)
    }
  }, [location.pathname])

  // ---- Debounced Orama search ----
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAll(query.trim(), 10)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // ---- Reset query when closing ----
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSearchResults([])
    }
  }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Helpers ----
  const goTo = useCallback((path: string) => {
    navigate(path)
    handleClose()
  }, [navigate, handleClose])

  const recentPages = getRecentPages()

  if (!open) return null

  return (
    <div style={overlayStyle} onClick={handleClose} role="presentation" aria-hidden="true">
      <div style={{ height: 'fit-content' }} onClick={e => e.stopPropagation()}>
        <Command
          label="Search or jump to..."
          style={dialogStyle}
          shouldFilter={!query.trim() || searchResults.length === 0}
        >
          {/* Search input */}
          <div style={inputWrapperStyle}>
            <Search size={20} style={{ color: colors.textTertiary, flexShrink: 0 }} />
            <Command.Input
              placeholder="Search or jump to..."
              value={query}
              onValueChange={setQuery}
              style={inputStyle}
            />
            <span style={escBadgeStyle}>ESC</span>
          </div>

          {/* Results list */}
          <Command.List style={listStyle}>
            <Command.Empty style={{
              padding: `${spacing.xl} ${spacing.lg}`,
              textAlign: 'center' as const,
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
            }}>
              {searching ? 'Searching...' : 'No results found'}
            </Command.Empty>

            {/* --- When query is empty: show Recent, Pages, Quick Actions --- */}
            {!query.trim() && (
              <>
                {/* Recent pages */}
                {recentPages.length > 0 && (
                  <Command.Group heading="Recent">
                    {recentPages.map(rp => {
                      const pageMatch = pages.find(p => p.path === rp.path)
                      const Icon = pageMatch?.icon || Clock
                      return (
                        <Command.Item
                          key={`recent-${rp.path}`}
                          value={`recent ${rp.label}`}
                          onSelect={() => goTo(rp.path)}
                          style={itemStyle}
                        >
                          <Icon size={20} style={itemIconStyle} />
                          <span>{rp.label}</span>
                        </Command.Item>
                      )
                    })}
                  </Command.Group>
                )}

                {/* Pages */}
                <Command.Group heading="Pages">
                  {pages.map(page => (
                    <Command.Item
                      key={page.path}
                      value={page.label}
                      onSelect={() => goTo(page.path)}
                      style={itemStyle}
                    >
                      <page.icon size={20} style={itemIconStyle} />
                      <span>{page.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Quick actions */}
                <Command.Group heading="Quick Actions">
                  {quickActions.map(action => (
                    <Command.Item
                      key={`action-${action.label}`}
                      value={`${action.label} ${action.subtitle}`}
                      onSelect={() => goTo(action.path)}
                      style={itemStyle}
                    >
                      <action.icon size={20} style={itemIconStyle} />
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        <span>{action.label}</span>
                        <span style={subtitleStyle}>{action.subtitle}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            )}

            {/* --- When query is present: filtered pages, actions, and Orama results --- */}
            {query.trim() && (
              <>
                {/* Matching pages */}
                <Command.Group heading="Pages">
                  {pages.map(page => (
                    <Command.Item
                      key={page.path}
                      value={page.label}
                      onSelect={() => goTo(page.path)}
                      style={itemStyle}
                    >
                      <page.icon size={20} style={itemIconStyle} />
                      <span>{page.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Matching quick actions */}
                <Command.Group heading="Quick Actions">
                  {quickActions.map(action => (
                    <Command.Item
                      key={`action-${action.label}`}
                      value={`${action.label} ${action.subtitle}`}
                      onSelect={() => goTo(action.path)}
                      style={itemStyle}
                    >
                      <action.icon size={20} style={itemIconStyle} />
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        <span>{action.label}</span>
                        <span style={subtitleStyle}>{action.subtitle}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>

                {/* Orama project data results */}
                {searchResults.length > 0 && (
                  <Command.Group heading="Project Data">
                    {searchResults.map(result => (
                      <Command.Item
                        key={`${result.type}-${result.id}`}
                        value={`${result.type} ${result.title} ${result.subtitle}`}
                        onSelect={() => { navigate(result.link); handleClose() }}
                        style={itemStyle}
                      >
                        <span style={typeBadgeStyle(result.type)}>
                          {result.type.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, minWidth: 0 }}>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {result.title}
                          </span>
                          <span style={subtitleStyle}>{result.subtitle}</span>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {searching && searchResults.length === 0 && (
                  <div style={{
                    padding: `${spacing.md} ${spacing.lg}`,
                    fontSize: typography.fontSize.sm,
                    color: colors.textTertiary,
                    textAlign: 'center' as const,
                  }}>
                    Searching project data...
                  </div>
                )}
              </>
            )}
          </Command.List>

          {/* Footer with keyboard hints */}
          <div style={footerStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <span style={kbdStyle}>↑</span>
              <span style={kbdStyle}>↓</span>
              <span style={{ marginLeft: '2px' }}>navigate</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <span style={kbdStyle}>↵</span>
              <span style={{ marginLeft: '2px' }}>select</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <span style={kbdStyle}>esc</span>
              <span style={{ marginLeft: '2px' }}>close</span>
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
