// ── RFIAssigneePicker ───────────────────────────────────────────────────
// Multi-assignee chips with a per-person "responded" checkbox.
//
// Mirrors Procore's Assignees block: one chip per assigned user with a
// checkbox state. Checked = the assignee has cleared their pending. The
// derived ball-in-court collapses to the unchecked assignees in order.
//
// Persistence is direct — adding a chip writes to rfi_assignees, ticking
// a checkbox writes to rfi_assignees (responded_at + response_id). No
// staging; that keeps the audit chain accurate (one row per change).

import React, { useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGate } from '../auth/PermissionGate'
import { UserName } from '../UserName'
import {
  useRFIAssignees,
  useAddRFIAssignee,
  useRemoveRFIAssignee,
  useToggleRFIAssigneeResponded,
} from '../../hooks/queries/useRFIAssignees'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIAssigneePickerProps {
  rfiId: string
  projectId: string
}

export const RFIAssigneePicker: React.FC<RFIAssigneePickerProps> = ({ rfiId, projectId }) => {
  const { data: assignees = [] } = useRFIAssignees(rfiId)
  const { data: directory } = useProjectDirectory(projectId)
  const addAssignee = useAddRFIAssignee()
  const removeAssignee = useRemoveRFIAssignee()
  const toggleResponded = useToggleRFIAssigneeResponded()

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const assignedIds = useMemo(() => new Set(assignees.map((a) => a.user_id)), [assignees])
  const candidates = useMemo(() => {
    const all = directory?.members ?? []
    const q = search.trim().toLowerCase()
    return all
      .filter((m) => !assignedIds.has(m.value))
      .filter((m) => !q || m.label.toLowerCase().includes(q) || (m.sublabel ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [directory, assignedIds, search])

  const handleAdd = async (userId: string) => {
    try {
      await addAssignee.mutateAsync({ rfiId, projectId, userId })
      setSearch('')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add assignee')
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await removeAssignee.mutateAsync({ rfiId, projectId, userId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove assignee')
    }
  }

  const handleToggle = async (assigneeId: string, currentlyResponded: boolean) => {
    try {
      await toggleResponded.mutateAsync({
        assigneeId,
        rfiId,
        projectId,
        responded: !currentlyResponded,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
      {/* Existing assignees */}
      {assignees.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {assignees.map((a) => (
            <li
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['1']} ${spacing['2']}`,
                border: `1px solid ${a.responded_at ? colors.statusActive : colors.borderSubtle}`,
                borderRadius: borderRadius.base,
                backgroundColor: a.responded_at ? `${colors.statusActive}10` : colors.surfaceRaised,
              }}
            >
              <PermissionGate
                permission="rfis.edit"
                fallback={
                  <span
                    aria-label={a.responded_at ? 'Responded' : 'Pending'}
                    style={checkboxBoxStyle(!!a.responded_at)}
                  >
                    {a.responded_at && <Check size={11} color="white" />}
                  </span>
                }
              >
                <button
                  type="button"
                  onClick={() => handleToggle(a.id, !!a.responded_at)}
                  aria-label={a.responded_at ? 'Mark as not responded' : 'Mark as responded'}
                  title={a.responded_at ? 'Mark as not responded' : 'Mark as responded'}
                  style={{
                    ...checkboxBoxStyle(!!a.responded_at),
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {a.responded_at && <Check size={11} color="white" />}
                </button>
              </PermissionGate>
              <span
                style={{
                  flex: 1,
                  fontSize: typography.fontSize.sm,
                  color: colors.textPrimary,
                  textDecoration: a.responded_at ? 'line-through' : 'none',
                }}
              >
                <UserName userId={a.user_id} fallback="—" />
                {a.responded_at && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: colors.statusActive }}>
                    Responded
                  </span>
                )}
              </span>
              <PermissionGate permission="rfis.edit">
                <button
                  type="button"
                  onClick={() => handleRemove(a.user_id)}
                  aria-label="Remove assignee"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: colors.textTertiary,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <X size={12} />
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      {/* Add control */}
      <PermissionGate permission="rfis.edit">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={search}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value)
              setOpen(true)
            }}
            onBlur={() => {
              // Delay close so a click on the dropdown registers first.
              window.setTimeout(() => setOpen(false), 120)
            }}
            placeholder="Add assignee…"
            aria-label="Add assignee"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.base,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {open && candidates.length > 0 && (
            <ul
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                listStyle: 'none',
                padding: 4,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: borderRadius.base,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 5,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {candidates.map((c) => (
                <li key={c.value} role="option">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void handleAdd(c.value)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: `${spacing['1']} ${spacing['2']}`,
                      border: 'none',
                      borderRadius: borderRadius.sm,
                      background: 'transparent',
                      color: colors.textPrimary,
                      fontSize: typography.fontSize.sm,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>{c.label}</span>
                    {c.sublabel && (
                      <span style={{ marginLeft: 6, color: colors.textTertiary, fontSize: 11 }}>
                        {c.sublabel}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PermissionGate>
    </div>
  )
}

const checkboxBoxStyle = (checked: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  borderRadius: 4,
  flexShrink: 0,
  backgroundColor: checked ? colors.statusActive : 'transparent',
  border: `1.5px solid ${checked ? colors.statusActive : colors.borderDefault}`,
})

export default RFIAssigneePicker
