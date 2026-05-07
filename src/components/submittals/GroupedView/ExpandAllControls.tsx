// Phase 4 — toolbar control "Expand all" / "Collapse all" + group count.
// Persists per (project, view-type) via localStorage.

import React from 'react'
import { ChevronsDown, ChevronsUp } from 'lucide-react'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface ExpandAllControlsProps {
  groupCount: number
  expandedCount: number
  onExpandAll: () => void
  onCollapseAll: () => void
}

export const ExpandAllControls: React.FC<ExpandAllControlsProps> = ({
  groupCount,
  expandedCount,
  onExpandAll,
  onCollapseAll,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderBottom: `1px solid ${C.border}`,
      fontFamily: FONT,
      fontSize: 12,
      color: C.ink2,
      backgroundColor: '#fff',
    }}
  >
    <span style={{ color: C.ink3, fontSize: 11 }}>
      {groupCount} group{groupCount === 1 ? '' : 's'} · {expandedCount} expanded
    </span>
    <div style={{ flex: 1 }} />
    <button
      type="button"
      onClick={onExpandAll}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        border: `1px solid ${C.border}`,
        backgroundColor: '#fff',
        color: C.ink,
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        borderRadius: 3,
      }}
    >
      <ChevronsDown size={11} /> Expand all
    </button>
    <button
      type="button"
      onClick={onCollapseAll}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        border: `1px solid ${C.border}`,
        backgroundColor: '#fff',
        color: C.ink,
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        borderRadius: 3,
      }}
    >
      <ChevronsUp size={11} /> Collapse all
    </button>
  </div>
)

export interface ExpandedGroupState {
  expanded: Set<string>
  toggle: (id: string) => void
  expandAll: (ids: string[]) => void
  collapseAll: () => void
  isExpanded: (id: string) => boolean
}

const STORAGE_PREFIX = 'sitesync.submittals.groupExpand.'

/**
 * Persisted expand/collapse state for a grouped view. Default is "all
 * expanded" on first visit; subsequent visits restore localStorage.
 *
 * URL also serializes ?expanded=id1,id2 so a saved view can capture the
 * exact open/closed shape — the URL takes precedence over localStorage
 * when present.
 */
export function useGroupExpandState(opts: {
  projectId: string | null | undefined
  viewType: string
  groupIds: string[]
  urlExpanded?: string | null
}): ExpandedGroupState {
  const { projectId, viewType, groupIds, urlExpanded } = opts
  const storageKey = projectId ? `${STORAGE_PREFIX}${projectId}.${viewType}` : null

  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    if (urlExpanded != null) return new Set(urlExpanded.split(',').filter(Boolean))
    if (typeof window === 'undefined' || !storageKey) return new Set(groupIds)
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return new Set(groupIds)
      const parsed = JSON.parse(raw) as { expanded?: string[] }
      return new Set(parsed.expanded ?? groupIds)
    } catch {
      return new Set(groupIds)
    }
  })

  // Persist on change.
  React.useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ expanded: Array.from(expanded) }))
    } catch { /* ignore quota errors */ }
  }, [expanded, storageKey])

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const expandAll = React.useCallback((ids: string[]) => setExpanded(new Set(ids)), [])
  const collapseAll = React.useCallback(() => setExpanded(new Set()), [])
  const isExpanded = React.useCallback((id: string) => expanded.has(id), [expanded])

  return { expanded, toggle, expandAll, collapseAll, isExpanded }
}

export default ExpandAllControls
