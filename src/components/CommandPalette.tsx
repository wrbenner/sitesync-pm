// ─────────────────────────────────────────────────────────────────────────────
// CommandPalette — role-aware Cmd+K (Tab C / Wave 1)
// ─────────────────────────────────────────────────────────────────────────────
// Wave 1 scope:
//   • Empty state shows the role-filtered nav items as top results
//   • Search: fuzzy match across nav items + recent items (last 20 RFIs by
//     number, submittals by spec, punch by title)
//   • Cmd+K / Ctrl+K to toggle, ↑↓ to move, Enter to navigate, Esc to close
// Out of scope: Iris natural-language queries (Wave 2).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import {
  Search,
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

import { useProjectId } from '../hooks/useProjectId'
import { usePermissions } from '../hooks/usePermissions'
import { useRFIs } from '../hooks/queries/rfis'
import { useSubmittals } from '../hooks/queries/submittals'
import { usePunchItems } from '../hooks/queries/punch-items'
import { toStreamRole } from '../types/stream'
import { getNavForRole, type NavItem } from '../config/navigation'
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/theme'

// Lucide icon registry — kept tight to the 14 nav glyphs so tree-shaking
// doesn't pull the whole icon set just for the palette.
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

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

// ── Recent-item shape — kept tiny, hook-agnostic. ───────────────────────────

interface RecentResult {
  kind: 'rfi' | 'submittal' | 'punch'
  id: string
  title: string
  subtitle: string
  route: string
}

function useRecentItems(): { results: RecentResult[]; loading: boolean } {
  const projectId = useProjectId()
  // Cap each pull at 20 — Wave 1 scope says "last 20 by [identifier]".
  const rfis = useRFIs(projectId ?? undefined, { page: 1, pageSize: 20 })
  const submittals = useSubmittals(projectId ?? undefined, { page: 1, pageSize: 20 })
  const punchItems = usePunchItems(projectId ?? undefined, { page: 1, pageSize: 20 })

  const results = useMemo<RecentResult[]>(() => {
    const out: RecentResult[] = []
    for (const r of rfis.data?.data ?? []) {
      const rec = r as unknown as Record<string, unknown>
      const number = (rec.number as number | string | undefined) ?? ''
      const subject = (rec.subject as string | undefined) ?? (rec.title as string | undefined) ?? 'Untitled RFI'
      out.push({
        kind: 'rfi',
        id: String(rec.id),
        title: number ? `RFI #${number} — ${subject}` : subject,
        subtitle: 'RFI',
        route: `/rfis/${rec.id}`,
      })
    }
    for (const s of submittals.data?.data ?? []) {
      const rec = s as unknown as Record<string, unknown>
      const spec = (rec.spec_section as string | undefined) ?? (rec.specification as string | undefined) ?? ''
      const title = (rec.title as string | undefined) ?? 'Untitled submittal'
      out.push({
        kind: 'submittal',
        id: String(rec.id),
        title: spec ? `${spec} — ${title}` : title,
        subtitle: 'Submittal',
        route: `/submittals/${rec.id}`,
      })
    }
    for (const p of punchItems.data?.data ?? []) {
      const rec = p as unknown as Record<string, unknown>
      const title = (rec.title as string | undefined) ?? (rec.description as string | undefined) ?? 'Punch item'
      out.push({
        kind: 'punch',
        id: String(rec.id),
        title,
        subtitle: 'Punch',
        route: `/punch-list/${rec.id}`,
      })
    }
    return out
  }, [rfis.data, submittals.data, punchItems.data])

  return {
    results,
    loading: rfis.isLoading || submittals.isLoading || punchItems.isLoading,
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  zIndex: zIndex.command as number,
  display: 'flex',
  justifyContent: 'center',
  paddingTop: '15vh',
}

const dialogStyle: React.CSSProperties = {
  width: 600,
  maxWidth: '90vw',
  maxHeight: '70vh',
  background: colors.surfaceRaised,
  borderRadius: borderRadius.xl,
  boxShadow: shadows.panel,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${colors.borderSubtle}`,
}

const inputWrapStyle: React.CSSProperties = {
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
}

const escBadgeStyle: React.CSSProperties = {
  fontSize: typography.fontSize.caption,
  fontFamily: typography.fontFamily,
  fontWeight: typography.fontWeight.medium,
  color: colors.textTertiary,
  background: colors.surfaceInset,
  padding: `2px ${spacing.sm}`,
  borderRadius: borderRadius.sm,
  letterSpacing: '0.04em',
  flexShrink: 0,
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: spacing.sm,
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.md,
  padding: `${spacing.md} ${spacing.lg}`,
  minHeight: 44,
  borderRadius: borderRadius.md,
  cursor: 'pointer',
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: typography.fontSize.sm,
  color: colors.textTertiary,
  marginTop: 2,
}

const SELECTED_STYLE_ID = 'cmdk-palette-selected-style'
function ensureSelectedRowStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SELECTED_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SELECTED_STYLE_ID
  style.textContent = `
    [cmdk-item][data-selected="true"] {
      background: ${colors.surfaceFlat} !important;
    }
    [cmdk-group-heading] {
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: 0.06em !important;
      text-transform: uppercase !important;
      color: ${colors.textTertiary} !important;
      padding: ${spacing.md} ${spacing.lg} ${spacing.xs} !important;
      margin: 0 !important;
    }
  `
  document.head.appendChild(style)
}

// ── Component ───────────────────────────────────────────────────────────────

// Outer is a thin gate — only renders the body when the palette is open.
// Conditional mounting means the body's local state (query, focus) resets
// naturally on each open, with no in-effect setState reset gymnastics.
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  if (!open) return null
  return <CommandPaletteBody onClose={onClose} />
}

const CommandPaletteBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate()
  const { role: projectRole } = usePermissions()
  const streamRole = useMemo(() => toStreamRole(projectRole), [projectRole])
  const navItems = useMemo<NavItem[]>(() => getNavForRole(streamRole), [streamRole])

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const { results: recentResults, loading: recentsLoading } = useRecentItems()

  useEffect(() => {
    ensureSelectedRowStyles()
    const id = window.setTimeout(() => inputRef.current?.focus(), 16)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const goTo = useCallback(
    (route: string) => {
      navigate(route)
      onClose()
    },
    [navigate, onClose],
  )

  const trimmed = query.trim()
  const showRecents = trimmed.length > 0

  return (
    <div style={overlayStyle} onClick={onClose} role="presentation" aria-hidden="true">
      <div style={{ height: 'fit-content' }} onClick={(e) => e.stopPropagation()}>
        <Command label="Search or jump to…" style={dialogStyle} shouldFilter>
          <div style={inputWrapStyle}>
            <Search size={20} color={colors.textTertiary} style={{ flexShrink: 0 }} />
            <Command.Input
              ref={inputRef}
              placeholder="Search for anything — RFIs, sheets, people, pages…"
              value={query}
              onValueChange={setQuery}
              style={inputStyle}
              aria-label="Search nav and recent items"
            />
            {!query && (
              <span style={escBadgeStyle} aria-hidden>
                ⌘K
              </span>
            )}
            <span style={escBadgeStyle}>ESC</span>
          </div>

          <Command.List style={listStyle}>
            <Command.Empty
              style={{
                padding: `${spacing.xl} ${spacing.lg}`,
                textAlign: 'center',
                fontSize: typography.fontSize.body,
                color: colors.textTertiary,
              }}
            >
              {recentsLoading ? 'Loading…' : 'No matches'}
            </Command.Empty>

            <Command.Group heading="Pages">
              {navItems.map((item) => {
                const Icon = ICONS[item.icon] ?? Zap
                return (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.description ?? ''}`}
                    onSelect={() => goTo(item.route)}
                    style={itemStyle}
                  >
                    <Icon size={18} strokeWidth={1.75} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: typography.fontWeight.medium }}>{item.label}</span>
                      {item.description && <span style={subtitleStyle}>{item.description}</span>}
                    </span>
                  </Command.Item>
                )
              })}
            </Command.Group>

            {showRecents && (() => {
              const rfiResults = recentResults.filter((r) => r.kind === 'rfi')
              const submittalResults = recentResults.filter((r) => r.kind === 'submittal')
              const punchResults = recentResults.filter((r) => r.kind === 'punch')
              const renderItem = (r: RecentResult) => (
                <Command.Item
                  key={`${r.kind}-${r.id}`}
                  value={`${r.subtitle} ${r.title}`}
                  onSelect={() => goTo(r.route)}
                  style={itemStyle}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </span>
                </Command.Item>
              )
              return (
                <>
                  {rfiResults.length > 0 && (
                    <Command.Group heading="Recent RFIs">{rfiResults.map(renderItem)}</Command.Group>
                  )}
                  {submittalResults.length > 0 && (
                    <Command.Group heading="Recent Submittals">{submittalResults.map(renderItem)}</Command.Group>
                  )}
                  {punchResults.length > 0 && (
                    <Command.Group heading="Recent Punch">{punchResults.map(renderItem)}</Command.Group>
                  )}
                </>
              )
            })()}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

export default CommandPalette
