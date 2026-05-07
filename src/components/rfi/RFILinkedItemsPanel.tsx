// ── RFILinkedItemsPanel ─────────────────────────────────────────────────
// Cross-module links surface for RFI Detail + Edit panel.
//
// Bugatti choices:
//   • One panel mounts in two surfaces; consistent UX everywhere.
//   • Typeahead is type-segmented (Submittal / Drawing / etc.) so the
//     query path is narrow and indexed.
//   • Per-link audit row on add + remove.
//   • PermissionGate `rfis.edit` wraps add + remove triggers.

import React, { useMemo, useState } from 'react'
import { Plus, X, ExternalLink, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { PermissionGate } from '../auth/PermissionGate'
import { fromTable } from '../../lib/db/queries'
import { useQuery } from '@tanstack/react-query'
import { useRFILinksByRFI, useAddRFILink, useRemoveRFILink, type RFILink, type RFILinkTarget, type RFILinkKind } from '../../hooks/queries/useRFILinks'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFILinkedItemsPanelProps {
  rfiId: string
  projectId: string
  /** Compact rendering for the Edit panel; richer for Detail. */
  compact?: boolean
}

const TARGET_LABELS: Record<RFILinkTarget, string> = {
  submittal: 'Submittal',
  drawing: 'Drawing',
  schedule_phase: 'Schedule Phase',
  budget_item: 'Budget Item',
  punch_item: 'Punch Item',
  daily_log: 'Daily Log',
  meeting: 'Meeting',
  rfi: 'RFI',
  change_order: 'Change Order',
}

const TARGET_ROUTE: Record<RFILinkTarget, (id: string) => string> = {
  submittal: (id) => `/submittals/${id}`,
  drawing: (id) => `/drawings/${id}`,
  schedule_phase: (id) => `/plan/phases/${id}`,
  budget_item: (id) => `/ledger/budget/${id}`,
  punch_item: (id) => `/punch-list/${id}`,
  daily_log: (id) => `/daily-logs/${id}`,
  meeting: (id) => `/meetings/${id}`,
  rfi: (id) => `/rfis/${id}`,
  change_order: (id) => `/change-orders/${id}`,
}

const LINK_KINDS: Array<{ value: RFILinkKind; label: string }> = [
  { value: 'related', label: 'Related' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'blocked_by', label: 'Blocked by' },
  { value: 'derived_from', label: 'Derived from' },
  { value: 'converts_to', label: 'Converts to' },
]

const TARGET_TABLE: Record<RFILinkTarget, { table: string; titleField: string; numberField?: string }> = {
  submittal: { table: 'submittals', titleField: 'title', numberField: 'number' },
  drawing: { table: 'drawings', titleField: 'title', numberField: 'sheet_number' },
  schedule_phase: { table: 'project_phases', titleField: 'name' },
  budget_item: { table: 'budget_items', titleField: 'name', numberField: 'code' },
  punch_item: { table: 'punch_items', titleField: 'title', numberField: 'number' },
  daily_log: { table: 'daily_logs', titleField: 'log_date' },
  meeting: { table: 'meetings', titleField: 'title' },
  rfi: { table: 'rfis', titleField: 'title', numberField: 'number' },
  change_order: { table: 'change_orders', titleField: 'title', numberField: 'number' },
}

interface TargetSearchResult {
  id: string
  label: string
  number: string | null
}

function useTargetSearch(projectId: string, type: RFILinkTarget, query: string) {
  return useQuery({
    queryKey: ['rfi_link_target_search', projectId, type, query],
    enabled: query.trim().length >= 1,
    queryFn: async (): Promise<TargetSearchResult[]> => {
      const meta = TARGET_TABLE[type]
      const sel = meta.numberField
        ? `id, ${meta.titleField}, ${meta.numberField}`
        : `id, ${meta.titleField}`
      const q = fromTable(meta.table as never)
        .select(sel)
        .eq('project_id' as never, projectId)
        .limit(10)
      const { data } = await q
      const rows = (data ?? []) as Array<Record<string, unknown>>
      const lower = query.toLowerCase()
      return rows
        .map((r) => {
          const id = String(r.id)
          const title = String(r[meta.titleField] ?? '')
          const num = meta.numberField ? r[meta.numberField] : null
          const numStr = num != null ? String(num) : null
          return { id, label: title, number: numStr }
        })
        .filter((r) => r.label.toLowerCase().includes(lower) || (r.number ?? '').toLowerCase().includes(lower))
        .slice(0, 8)
    },
  })
}

export const RFILinkedItemsPanel: React.FC<RFILinkedItemsPanelProps> = ({ rfiId, projectId, compact }) => {
  const navigate = useNavigate()
  const { data: links = [] } = useRFILinksByRFI(rfiId)
  const addLink = useAddRFILink()
  const removeLink = useRemoveRFILink()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerType, setPickerType] = useState<RFILinkTarget>('submittal')
  const [pickerKind, setPickerKind] = useState<RFILinkKind>('related')
  const [pickerQuery, setPickerQuery] = useState('')
  const { data: matches = [] } = useTargetSearch(projectId, pickerType, pickerQuery)

  const grouped = useMemo(() => {
    const m = new Map<RFILinkTarget, RFILink[]>()
    for (const l of links) {
      const arr = m.get(l.target_type) ?? []
      arr.push(l)
      m.set(l.target_type, arr)
    }
    return m
  }, [links])

  const handleAdd = async (targetId: string) => {
    try {
      await addLink.mutateAsync({
        rfiId,
        projectId,
        targetType: pickerType,
        targetId,
        linkKind: pickerKind,
      })
      toast.success('Link added')
      setPickerQuery('')
      setPickerOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add link')
    }
  }

  const handleRemove = async (link: RFILink) => {
    if (!window.confirm(`Remove this ${TARGET_LABELS[link.target_type].toLowerCase()} link?`)) return
    try {
      await removeLink.mutateAsync({
        id: link.id,
        rfiId,
        projectId,
        targetType: link.target_type,
        targetId: link.target_id,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link2 size={13} color={colors.textTertiary} />
          <strong style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
            Linked items
          </strong>
        </div>
      )}

      {grouped.size === 0 && !pickerOpen && (
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontStyle: 'italic' }}>
          No linked items yet.
        </div>
      )}

      {/* Render groups */}
      {Array.from(grouped.entries()).map(([type, group]) => (
        <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {TARGET_LABELS[type]}
          </span>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {group.map((link) => (
              <li
                key={link.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  background: colors.surfaceInset,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 12,
                  fontSize: 11,
                  color: colors.textPrimary,
                }}
              >
                <button
                  type="button"
                  onClick={() => navigate(TARGET_ROUTE[link.target_type](link.target_id))}
                  title={`${LINK_KINDS.find((k) => k.value === link.link_kind)?.label}: ${link.target_id.slice(0, 8)}…`}
                  style={{ background: 'transparent', border: 'none', color: colors.primaryOrange, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                >
                  <span style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 600 }}>
                    {link.link_kind.replace(/_/g, ' ')}
                  </span>
                  <ExternalLink size={10} />
                  {link.target_id.slice(0, 8)}…
                </button>
                <PermissionGate permission="rfis.edit">
                  <button
                    type="button"
                    onClick={() => handleRemove(link)}
                    aria-label="Remove link"
                    style={{ background: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', padding: 0 }}
                  >
                    <X size={10} />
                  </button>
                </PermissionGate>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Add picker */}
      <PermissionGate permission="rfis.edit">
        {!pickerOpen ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              border: `1px dashed ${colors.borderDefault}`,
              borderRadius: borderRadius.sm,
              background: 'transparent',
              color: colors.textTertiary,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            <Plus size={11} /> Link an item
          </button>
        ) : (
          <div
            style={{
              padding: spacing['2'],
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              background: colors.surfaceRaised,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <select
                value={pickerType}
                onChange={(e) => setPickerType(e.target.value as RFILinkTarget)}
                style={selectStyle}
                aria-label="Link target type"
              >
                {(Object.keys(TARGET_LABELS) as RFILinkTarget[]).map((t) => (
                  <option key={t} value={t}>{TARGET_LABELS[t]}</option>
                ))}
              </select>
              <select
                value={pickerKind}
                onChange={(e) => setPickerKind(e.target.value as RFILinkKind)}
                style={selectStyle}
                aria-label="Link kind"
              >
                {LINK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={`Search ${TARGET_LABELS[pickerType].toLowerCase()}…`}
              style={inputStyle}
              autoFocus
            />
            {matches.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 160, overflowY: 'auto' }}>
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => handleAdd(m.id)}
                      style={pickerRowStyle}
                    >
                      {m.number && (
                        <span style={{ fontFamily: typography.fontFamilyMono, fontSize: 10, color: colors.primaryOrange, marginRight: 6 }}>
                          {m.number}
                        </span>
                      )}
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              <button
                type="button"
                onClick={() => { setPickerOpen(false); setPickerQuery('') }}
                style={cancelBtnStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </PermissionGate>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  fontSize: 11,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  fontFamily: 'inherit',
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  fontFamily: 'inherit',
}

const pickerRowStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '4px 6px',
  background: 'transparent',
  border: 'none',
  borderRadius: borderRadius.sm,
  color: colors.textPrimary,
  fontSize: 12,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  background: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.sm,
  color: colors.textSecondary,
  cursor: 'pointer',
}

export default RFILinkedItemsPanel
