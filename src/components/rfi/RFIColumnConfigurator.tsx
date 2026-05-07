// ── RFIColumnConfigurator ───────────────────────────────────────────────
// Procore-mirror column configurator: drag handle to reorder, eye toggle
// for visibility, pin button for sticky-left, width input.
//
// Column layout state lives in two places:
//   • per-user `rfi_user_column_prefs` (DB) — survives across sessions.
//   • URL state (per-view) — saved-view application overrides per-user
//     prefs while the view is active.
//
// PermissionGate: any user can configure their own columns. Saved views
// are gated separately in the FilterPanel.

import React, { useState } from 'react'
import { Eye, EyeOff, GripVertical, Pin, PinOff, RotateCcw, X, Save as SaveIcon } from 'lucide-react'
import { toast } from 'sonner'
import { DetailPanel } from '../Primitives'
import { useRFIColumnPrefs, useSaveRFIColumnPrefs, type RFIColumnPref } from '../../hooks/queries/useRFIColumnPrefs'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

export interface RFIColumnDef {
  id: string
  label: string
  defaultWidth: number
}

interface RFIColumnConfiguratorProps {
  open: boolean
  onClose: () => void
  projectId: string
  /** All columns the table can render (canonical set). */
  allColumns: RFIColumnDef[]
}

/** Merge the canonical column set with the user's saved prefs into a
    materialized layout that's safe to render. Order from prefs;
    columns missing from prefs are appended in canonical order. */
export function applyPrefs(
  allColumns: RFIColumnDef[],
  prefs: RFIColumnPref[] | null,
): RFIColumnPref[] {
  const byId: Record<string, RFIColumnPref> = {}
  for (const c of allColumns) {
    byId[c.id] = { id: c.id, visible: true, pinned: false, width: c.defaultWidth }
  }
  if (Array.isArray(prefs)) {
    for (const p of prefs) {
      if (byId[p.id]) {
        byId[p.id] = {
          ...byId[p.id],
          visible: p.visible !== false,
          pinned: !!p.pinned,
          width: p.width ?? byId[p.id].width,
        }
      }
    }
    // Order: prefs order first, then any new canonical columns at end.
    const orderedIds: string[] = []
    for (const p of prefs) {
      if (byId[p.id] && !orderedIds.includes(p.id)) orderedIds.push(p.id)
    }
    for (const c of allColumns) {
      if (!orderedIds.includes(c.id)) orderedIds.push(c.id)
    }
    return orderedIds.map((id) => byId[id])
  }
  return allColumns.map((c) => byId[c.id])
}

export const RFIColumnConfigurator: React.FC<RFIColumnConfiguratorProps> = ({
  open,
  onClose,
  projectId,
  allColumns,
}) => {
  const { data: prefs } = useRFIColumnPrefs(projectId)
  const save = useSaveRFIColumnPrefs()

  const [draft, setDraft] = useState<RFIColumnPref[]>(() => applyPrefs(allColumns, prefs ?? null))
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  React.useEffect(() => {
    if (open) {
      setDraft(applyPrefs(allColumns, prefs ?? null))
    }
  }, [open, prefs, allColumns])

  const labelOf = (id: string) => allColumns.find((c) => c.id === id)?.label ?? id

  const onDragStart = (idx: number) => () => setDragIndex(idx)
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    if (dragIndex == null || dragIndex === idx) return
    e.preventDefault()
  }
  const onDrop = (idx: number) => () => {
    if (dragIndex == null || dragIndex === idx) {
      setDragIndex(null)
      return
    }
    setDraft((d) => {
      const next = [...d]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  const togglePref = (id: string, key: 'visible' | 'pinned') => {
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, [key]: !c[key] } : c)))
  }

  const setWidth = (id: string, n: number) => {
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, width: Number.isFinite(n) ? n : c.width } : c)))
  }

  const handleReset = () => {
    setDraft(allColumns.map((c) => ({ id: c.id, visible: true, pinned: false, width: c.defaultWidth })))
  }

  const handleSave = async () => {
    try {
      await save.mutateAsync({ projectId, columns: draft })
      toast.success('Column layout saved')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    }
  }

  return (
    <DetailPanel open={open} onClose={onClose} title="Configure columns" width="380px">
      <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {draft.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={onDragStart(idx)}
            onDragOver={onDragOver(idx)}
            onDrop={onDrop(idx)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.sm,
              backgroundColor: dragIndex === idx ? colors.surfaceHover : colors.surfaceRaised,
              cursor: 'grab',
            }}
          >
            <GripVertical size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
              {labelOf(col.id)}
            </span>
            <button
              type="button"
              onClick={() => togglePref(col.id, 'visible')}
              aria-label={col.visible ? 'Hide column' : 'Show column'}
              title={col.visible ? 'Hide' : 'Show'}
              style={iconBtnStyle(col.visible ? colors.textSecondary : colors.textTertiary)}
            >
              {col.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              type="button"
              onClick={() => togglePref(col.id, 'pinned')}
              aria-label={col.pinned ? 'Unpin' : 'Pin to left'}
              title={col.pinned ? 'Unpin' : 'Pin to left'}
              style={iconBtnStyle(col.pinned ? colors.primaryOrange : colors.textTertiary)}
            >
              {col.pinned ? <Pin size={13} /> : <PinOff size={13} />}
            </button>
            <input
              type="number"
              min={40}
              max={800}
              value={col.width ?? 0}
              onChange={(e) => setWidth(col.id, Number(e.target.value))}
              style={{ width: 60, ...inputStyle }}
              aria-label={`${labelOf(col.id)} width`}
            />
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
            paddingTop: spacing.md,
            borderTop: `1px solid ${colors.borderSubtle}`,
            marginTop: spacing.md,
          }}
        >
          <button type="button" onClick={handleReset} style={cancelBtnStyle}>
            <RotateCcw size={13} /> Reset
          </button>
          <button type="button" onClick={onClose} style={cancelBtnStyle}>
            <X size={13} /> Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending}
            style={{ ...buttonBaseStyle, background: colors.primaryOrange, color: 'white' }}
          >
            <SaveIcon size={13} /> {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </DetailPanel>
  )
}

const iconBtnStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: 'none',
  borderRadius: borderRadius.sm,
  background: 'transparent',
  color,
  cursor: 'pointer',
})

const inputStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: typography.fontSize.caption,
  color: colors.textPrimary,
  backgroundColor: colors.surfacePage,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  outline: 'none',
  fontFamily: 'inherit',
}

const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  fontSize: typography.fontSize.caption,
  fontWeight: 600,
  border: 'none',
  borderRadius: borderRadius.sm,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'transparent',
  color: colors.textSecondary,
  border: `1px solid ${colors.borderSubtle}`,
}

export default RFIColumnConfigurator
