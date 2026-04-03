import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Home, HelpCircle, ClipboardList, DollarSign, Calendar,
  BookOpen, CheckSquare, FileText, Users, Briefcase, MessageCircle,
  Camera, Zap, Plus, Upload, Eye,
} from 'lucide-react'
import { colors, spacing, typography, shadows, borderRadius, transitions } from '../styles/theme'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string
  label: string
  icon: React.ElementType
  path: string
  category: 'Pages' | 'Actions'
  subtitle?: string
}

const ITEMS: CommandItem[] = [
  // Pages
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard', category: 'Pages' },
  { id: 'rfis', label: 'RFIs', icon: HelpCircle, path: '/rfis', category: 'Pages' },
  { id: 'submittals', label: 'Submittals', icon: ClipboardList, path: '/submittals', category: 'Pages' },
  { id: 'budget', label: 'Budget', icon: DollarSign, path: '/budget', category: 'Pages' },
  { id: 'schedule', label: 'Schedule', icon: Calendar, path: '/schedule', category: 'Pages' },
  { id: 'daily-log', label: 'Daily Log', icon: BookOpen, path: '/daily-log', category: 'Pages' },
  { id: 'punch-list', label: 'Punch List', icon: CheckSquare, path: '/punch-list', category: 'Pages' },
  { id: 'drawings', label: 'Drawings', icon: FileText, path: '/drawings', category: 'Pages' },
  { id: 'crews', label: 'Crews', icon: Users, path: '/crews', category: 'Pages' },
  { id: 'directory', label: 'Directory', icon: Briefcase, path: '/directory', category: 'Pages' },
  { id: 'meetings', label: 'Meetings', icon: MessageCircle, path: '/meetings', category: 'Pages' },
  { id: 'files', label: 'Files', icon: FileText, path: '/files', category: 'Pages' },
  { id: 'field-capture', label: 'Field Capture', icon: Camera, path: '/field-capture', category: 'Pages' },
  { id: 'copilot', label: 'AI Copilot', icon: Zap, path: '/copilot', category: 'Pages' },
  { id: 'vision', label: 'Vision', icon: Eye, path: '/vision', category: 'Pages' },
  // Actions
  { id: 'new-rfi', label: 'New RFI', icon: Plus, path: '/rfis', category: 'Actions', subtitle: 'Start a new request for information' },
  { id: 'new-task', label: 'New Task', icon: Plus, path: '/tasks', category: 'Actions', subtitle: 'Add a new task to the board' },
  { id: 'new-daily-log', label: 'New Daily Log', icon: BookOpen, path: '/daily-log', category: 'Actions', subtitle: 'Submit today\'s daily log' },
  { id: 'upload-file', label: 'Upload File', icon: Upload, path: '/files', category: 'Actions', subtitle: 'Upload a document or drawing' },
]

// ---------------------------------------------------------------------------
// useCommandPalette hook
// ---------------------------------------------------------------------------

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const firstKeyRef = useRef<string | null>(null)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  useEffect(() => {
    const navigate = (path: string) => {
      // We can't call useNavigate here (not in component context),
      // so we dispatch a custom event that CommandPalette listens to.
      window.dispatchEvent(new CustomEvent('sitesync:navigate', { detail: { path } }))
    }

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable

      // Cmd+K / Ctrl+K — toggle palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
        return
      }

      // Two-key combos: G then D/R/B (only when not typing)
      if (!isEditing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'g' || e.key === 'G') {
          firstKeyRef.current = 'g'
          if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
          comboTimerRef.current = setTimeout(() => {
            firstKeyRef.current = null
          }, 500)
          return
        }

        if (firstKeyRef.current === 'g') {
          if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
          firstKeyRef.current = null
          const key = e.key.toLowerCase()
          if (key === 'd') { e.preventDefault(); navigate('/dashboard'); return }
          if (key === 'r') { e.preventDefault(); navigate('/rfis'); return }
          if (key === 'b') { e.preventDefault(); navigate('/budget'); return }
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
    }
  }, [toggle])

  return { isOpen, open, close, toggle }
}

// ---------------------------------------------------------------------------
// CommandPalette component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Navigate via custom event from the hook (outside component context)
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path
      navigate(path)
    }
    window.addEventListener('sitesync:navigate', handler)
    return () => window.removeEventListener('sitesync:navigate', handler)
  }, [navigate])

  // Filter items by query
  const filtered = query.trim()
    ? ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : ITEMS

  // Group filtered items
  const groups: Array<{ category: string; items: CommandItem[] }> = []
  const categories = ['Pages', 'Actions'] as const
  for (const cat of categories) {
    const items = filtered.filter(i => i.category === cat)
    if (items.length > 0) groups.push({ category: cat, items })
  }

  // Flat list of visible items for keyboard navigation
  const flatItems = groups.flatMap(g => g.items)

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, flatItems.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatItems[activeIndex]
        if (item) { navigate(item.path); onClose() }
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, flatItems, activeIndex, navigate, onClose])

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Command palette"
    >
      <div
        style={{
          maxWidth: '560px',
          width: '90%',
          background: colors.surfaceRaised,
          borderRadius: '12px',
          boxShadow: shadows.panel,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          padding: `0 ${spacing.lg}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <Search size={18} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions, and commands..."
            style={{
              height: '48px',
              fontSize: '16px',
              border: 'none',
              padding: '0',
              width: '100%',
              outline: 'none',
              background: 'transparent',
              color: colors.textPrimary,
              fontFamily: typography.fontFamily,
            }}
          />
          <span style={{
            fontSize: typography.fontSize.caption,
            color: colors.textTertiary,
            background: colors.surfaceInset,
            padding: `2px ${spacing.sm}`,
            borderRadius: borderRadius.sm,
            fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.medium,
            flexShrink: 0,
            userSelect: 'none',
          }}>
            ESC
          </span>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: spacing.sm,
          }}
        >
          {flatItems.length === 0 ? (
            <div style={{
              padding: `${spacing.xl} ${spacing.lg}`,
              textAlign: 'center',
              fontSize: typography.fontSize.body,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
            }}>
              No results found
            </div>
          ) : groups.map(group => (
            <div key={group.category}>
              <div style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textTertiary,
                fontFamily: typography.fontFamily,
                letterSpacing: typography.letterSpacing.wider,
                textTransform: 'uppercase',
                padding: `${spacing.sm} ${spacing.lg}`,
                marginTop: spacing.xs,
              }}>
                {group.category}
              </div>
              {group.items.map(item => {
                const idx = flatIndex++
                const isActive = idx === activeIndex
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    ref={el => { itemRefs.current[idx] = el }}
                    onClick={() => { navigate(item.path); onClose() }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      width: '100%',
                      border: 'none',
                      borderRadius: borderRadius.md,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: typography.fontFamily,
                      fontSize: typography.fontSize.body,
                      color: colors.textPrimary,
                      background: isActive ? colors.surfaceHover : 'transparent',
                      transition: transitions.instant,
                    }}
                  >
                    <Icon size={18} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span>{item.label}</span>
                      {item.subtitle && (
                        <span style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textTertiary,
                          marginTop: '1px',
                        }}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xl,
          padding: `${spacing.md} ${spacing.lg}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          fontFamily: typography.fontFamily,
          userSelect: 'none',
        }}>
          {[
            { keys: ['↑', '↓'], label: 'navigate' },
            { keys: ['↵'], label: 'select' },
            { keys: ['esc'], label: 'close' },
          ].map(hint => (
            <span key={hint.label} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              {hint.keys.map(k => (
                <span key={k} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '20px',
                  height: '20px',
                  padding: `0 ${spacing.xs}`,
                  background: colors.surfaceInset,
                  borderRadius: borderRadius.sm,
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textTertiary,
                  lineHeight: 1,
                }}>
                  {k}
                </span>
              ))}
              <span style={{ marginLeft: '2px' }}>{hint.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
