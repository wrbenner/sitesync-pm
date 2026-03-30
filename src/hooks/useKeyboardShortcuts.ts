import { useEffect, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────

export interface Shortcut {
  key: string
  meta?: boolean
  shift?: boolean
  description: string
  action: () => void
  category?: 'navigation' | 'actions' | 'list' | 'detail' | 'general'
}

// ── Main Hook ────────────────────────────────────────────

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const tagName = target.tagName
    const isTyping = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable

    for (const shortcut of shortcuts) {
      const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey

      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && metaMatch && shiftMatch) {
        // Meta shortcuts (Cmd+K, Cmd+S) always fire, even in inputs
        if (shortcut.meta) {
          e.preventDefault()
          shortcut.action()
          return
        }
        // Escape always fires (for closing modals from inputs)
        if (shortcut.key === 'Escape') {
          e.preventDefault()
          shortcut.action()
          return
        }
        // Non-meta shortcuts (J, K, E, etc.) only fire when NOT typing
        if (!isTyping) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}

// ── List Navigation Hook ─────────────────────────────────

interface ListNavOptions<T> {
  items: T[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
  onOpen: (item: T) => void
  onToggleSelect?: (index: number) => void
  onSelectAll?: () => void
  enabled?: boolean
}

export function useListNavigation<T>(options: ListNavOptions<T>) {
  const { items, selectedIndex, onSelectIndex, onOpen, onToggleSelect, onSelectAll, enabled = true } = options

  const shortcuts: Shortcut[] = enabled ? [
    { key: 'j', description: 'Move down', category: 'list', action: () => onSelectIndex(Math.min(selectedIndex + 1, items.length - 1)) },
    { key: 'k', description: 'Move up', category: 'list', action: () => onSelectIndex(Math.max(selectedIndex - 1, 0)) },
    { key: 'Enter', description: 'Open selected', category: 'list', action: () => { if (items[selectedIndex]) onOpen(items[selectedIndex]) } },
    ...(onToggleSelect ? [{ key: 'x', description: 'Toggle select', category: 'list' as const, action: () => onToggleSelect(selectedIndex) }] : []),
    ...(onSelectAll ? [{ key: 'a', meta: true, description: 'Select all', category: 'list' as const, action: () => onSelectAll() }] : []),
  ] : []

  useKeyboardShortcuts(shortcuts)
}

// ── Detail View Shortcuts Hook ───────────────────────────

interface DetailShortcutOptions {
  onEdit?: () => void
  onApprove?: () => void
  onReject?: () => void
  onComment?: () => void
  onSaveAndClose?: () => void
  onCancel?: () => void
  enabled?: boolean
}

export function useDetailShortcuts(options: DetailShortcutOptions) {
  const { onEdit, onApprove, onReject, onComment, onSaveAndClose, onCancel, enabled = true } = options

  const shortcuts: Shortcut[] = enabled ? [
    ...(onEdit ? [{ key: 'e', description: 'Edit', category: 'detail' as const, action: onEdit }] : []),
    ...(onApprove ? [{ key: 'a', description: 'Approve', category: 'detail' as const, action: onApprove }] : []),
    ...(onReject ? [{ key: 'r', description: 'Reject', category: 'detail' as const, action: onReject }] : []),
    ...(onComment ? [{ key: 'c', description: 'Comment', category: 'detail' as const, action: onComment }] : []),
    ...(onSaveAndClose ? [{ key: 'Enter', meta: true, description: 'Save and close', category: 'detail' as const, action: onSaveAndClose }] : []),
    ...(onCancel ? [{ key: 'Escape', description: 'Cancel', category: 'detail' as const, action: onCancel }] : []),
  ] : []

  useKeyboardShortcuts(shortcuts)
}

// ── Global Shortcuts Reference ───────────────────────────

export const globalShortcuts: Omit<Shortcut, 'action'>[] = [
  { key: 'k', meta: true, description: 'Search or jump to...', category: 'navigation' },
  { key: 'n', meta: true, description: 'New item (context aware)', category: 'navigation' },
  { key: '/', meta: true, description: 'Keyboard shortcuts', category: 'navigation' },
  { key: '.', meta: true, description: 'Toggle AI panel', category: 'navigation' },
  { key: 'b', meta: true, description: 'Toggle sidebar', category: 'navigation' },
  { key: 'f', meta: true, description: 'Focus search', category: 'navigation' },
  { key: '1', meta: true, description: 'Dashboard', category: 'navigation' },
  { key: '2', meta: true, description: 'Tasks', category: 'navigation' },
  { key: '3', meta: true, description: 'Schedule', category: 'navigation' },
  { key: '4', meta: true, description: 'Budget', category: 'navigation' },
  { key: '5', meta: true, description: 'RFIs', category: 'navigation' },
  { key: '6', meta: true, description: 'Submittals', category: 'navigation' },
  { key: '7', meta: true, description: 'Daily Log', category: 'navigation' },
  { key: '8', meta: true, description: 'Punch List', category: 'navigation' },
  { key: '9', meta: true, description: 'Drawings', category: 'navigation' },
  { key: 'Escape', description: 'Close modal or panel', category: 'general' },
  { key: 's', meta: true, description: 'Save current form', category: 'general' },
  { key: 'e', meta: true, description: 'Export', category: 'general' },
  { key: '?', description: 'Keyboard shortcuts help', category: 'general' },
  { key: 'j', description: 'Move down in list', category: 'list' },
  { key: 'k', description: 'Move up in list', category: 'list' },
  { key: 'Enter', description: 'Open selected item', category: 'list' },
  { key: 'x', description: 'Select/deselect item', category: 'list' },
  { key: 'e', description: 'Edit', category: 'detail' },
  { key: 'a', description: 'Approve', category: 'detail' },
  { key: 'r', description: 'Reject', category: 'detail' },
  { key: 'c', description: 'Comment', category: 'detail' },
  { key: 'Enter', meta: true, description: 'Save and close', category: 'detail' },
]

// ── Format Shortcut for Display ──────────────────────────

const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')

export function formatShortcut(shortcut: { key: string; meta?: boolean; shift?: boolean }): string {
  const parts: string[] = []
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift')
  const keyMap: Record<string, string> = { Enter: '↵', Escape: 'Esc', '/': '/', '.': '.', '?': '?' }
  parts.push(keyMap[shortcut.key] ?? shortcut.key.toUpperCase())
  return parts.join(isMac ? '' : '+')
}
