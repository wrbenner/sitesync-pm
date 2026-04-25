import { useEffect, useCallback, useRef } from 'react'

// ── Types ────────────────────────────────────────────────

export interface Shortcut {
  key: string
  meta?: boolean
  shift?: boolean
  description: string
  action: () => void
  category?: 'navigation' | 'actions' | 'list' | 'detail' | 'general'
}

// Chord shortcut: single key ('meta+k') or sequential pair (['g', 'd'])
export interface ChordShortcut {
  keys: string[]
  sequential?: boolean
  action: () => void
  description?: string
  category?: 'navigation' | 'actions' | 'list' | 'detail' | 'general'
}

function parseKeyStr(keyStr: string): { meta: boolean; shift: boolean; key: string } {
  const parts = keyStr.toLowerCase().split('+')
  const meta = parts.includes('meta') || parts.includes('ctrl')
  const shift = parts.includes('shift')
  const key = parts[parts.length - 1]
  return { meta, shift, key }
}

// ── Main Hook ────────────────────────────────────────────

export function useKeyboardShortcuts(shortcuts: Array<Shortcut | ChordShortcut>) {
  const pendingChordRef = useRef<string | null>(null)
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handler = useCallback((e: KeyboardEvent) => {
    if (!e.key) return // guard against synthetic events with no key
    const target = e.target as HTMLElement
    const tagName = target.tagName
    const isTyping = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable

    for (const shortcut of shortcuts) {
      if ('keys' in shortcut) {
        const { keys, sequential, action } = shortcut

        if (sequential && keys.length === 2) {
          // Sequential two-key chord (e.g., g then d within 1000ms)
          if (isTyping) continue
          const first = parseKeyStr(keys[0])
          const second = parseKeyStr(keys[1])
          const pressedKey = e.key.toLowerCase()

          if (pendingChordRef.current === first.key) {
            // Waiting for second key
            if (
              pressedKey === second.key &&
              (second.meta ? e.metaKey || e.ctrlKey : !(e.metaKey || e.ctrlKey)) &&
              (second.shift ? e.shiftKey : !e.shiftKey)
            ) {
              e.preventDefault()
              if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
              pendingChordRef.current = null
              action()
              return
            }
          } else if (
            pressedKey === first.key &&
            (first.meta ? e.metaKey || e.ctrlKey : !(e.metaKey || e.ctrlKey)) &&
            (first.shift ? e.shiftKey : !e.shiftKey)
          ) {
            // Record first key, wait up to 1000ms for second
            pendingChordRef.current = first.key
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
            pendingTimerRef.current = setTimeout(() => {
              pendingChordRef.current = null
            }, 1000)
          }
          continue
        }

        // Single key in new format (e.g., ['meta+k'])
        const parsed = parseKeyStr(keys[0])
        const metaMatch = parsed.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)
        const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey

        if (e.key.toLowerCase() === parsed.key && metaMatch && shiftMatch) {
          if (parsed.meta) {
            e.preventDefault()
            action()
            return
          }
          if (parsed.key === 'escape') {
            e.preventDefault()
            action()
            return
          }
          if (!isTyping) {
            e.preventDefault()
            action()
            return
          }
        }
      } else if ('key' in shortcut && shortcut.key) {
        // Legacy Shortcut format
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey

        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && metaMatch && shiftMatch) {
          if (shortcut.meta) {
            e.preventDefault()
            shortcut.action()
            return
          }
          if (shortcut.key === 'Escape') {
            e.preventDefault()
            shortcut.action()
            return
          }
          if (!isTyping) {
            e.preventDefault()
            shortcut.action()
            return
          }
        }
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
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

// ── Global Shortcut Registry ─────────────────────────────
// Module-level map so components can register shortcuts without raw addEventListener.
// Usage in a component:
//   useEffect(() => registerGlobal('meta+k', handler), [])
// The returned cleanup removes the handler on unmount.

const _globalHandlers = new Map<string, Set<() => void>>()
let _globalActive = false

function _initGlobalListener() {
  if (_globalActive || typeof window === 'undefined') return
  _globalActive = true
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('meta')
    if (e.shiftKey) parts.push('shift')
    parts.push(e.key.toLowerCase())
    const key = parts.join('+')
    const handlers = _globalHandlers.get(key)
    if (handlers?.size) {
      e.preventDefault()
      handlers.forEach(h => h())
    }
  })
}

export function registerGlobal(key: string, handler: () => void): () => void {
  _initGlobalListener()
  const k = key.toLowerCase()
  if (!_globalHandlers.has(k)) _globalHandlers.set(k, new Set())
  _globalHandlers.get(k)!.add(handler)
  return () => {
    _globalHandlers.get(k)?.delete(handler)
  }
}

// ── Global Shortcuts Reference ───────────────────────────

export type GlobalShortcutEntry = Omit<Shortcut, 'action'> & { chord?: [string, string] }

export const globalShortcuts: GlobalShortcutEntry[] = [
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
  // Sequential navigation chords
  { key: 'g d', description: 'Go to Dashboard', category: 'navigation', chord: ['G', 'D'] },
  { key: 'g r', description: 'Go to RFIs', category: 'navigation', chord: ['G', 'R'] },
  { key: 'g b', description: 'Go to Budget', category: 'navigation', chord: ['G', 'B'] },
  { key: 'g s', description: 'Go to Schedule', category: 'navigation', chord: ['G', 'S'] },
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
