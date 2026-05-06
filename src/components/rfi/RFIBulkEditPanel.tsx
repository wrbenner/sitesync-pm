// ── RFIBulkEditPanel ─────────────────────────────────────────────────────
// Multi-select side-panel form. Procore parity: tick N rows, click the
// pencil-icon "Edit Values" action, see this panel slide in with a count
// badge and a focused 6-field form. Apply writes one update per selected
// RFI.
//
// Bugatti choice (Chain Audit Prep Check 5): we explicitly fan out one
// useUpdateRFI per id rather than batching them in a single SQL UPDATE.
// Each update writes its own audit_log row, so the chain stays one-row-
// per-state-change. The cost is N+1 round trips; the benefit is a
// deposition-grade audit trail.

import React, { useState } from 'react'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { DetailPanel } from '../Primitives'
import { PermissionGate } from '../auth/PermissionGate'
import { UserChipEditor, type UserChipOption } from './UserChipEditor'
import { useUpdateRFI } from '../../hooks/mutations'
import { useAddRFIWatcher } from '../../hooks/queries/useRFIWatchers'
import { useAddRFIDistribution } from '../../hooks/queries/useRFIDistributions'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFIBulkEditPanelProps {
  open: boolean
  onClose: () => void
  selectedIds: string[]
  projectId: string
  onApplied?: () => void
}

interface BulkDraft {
  ball_in_court: string
  due_date: string
  priority: string
  status: string
}

const EMPTY_BULK: BulkDraft = {
  ball_in_court: '',
  due_date: '',
  priority: '',
  status: '',
}

export const RFIBulkEditPanel: React.FC<RFIBulkEditPanelProps> = ({
  open, onClose, selectedIds, projectId, onApplied,
}) => {
  const updateRFI = useUpdateRFI()
  const addWatcher = useAddRFIWatcher()
  const addDistribution = useAddRFIDistribution()
  const { data: directory } = useProjectDirectory(projectId)

  const [draft, setDraft] = useState<BulkDraft>(EMPTY_BULK)
  const [addedWatchers, setAddedWatchers] = useState<string[]>([])
  const [addedRecipients, setAddedRecipients] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setDraft(EMPTY_BULK)
    setAddedWatchers([])
    setAddedRecipients([])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const distributionOptions: UserChipOption[] = (directory?.members ?? [])
    .filter((m) => m.sublabel)
    .map((m) => ({ value: m.sublabel!, label: m.label, sublabel: m.sublabel }))

  const memberOptions: UserChipOption[] = directory?.members ?? []

  // Build the patch — only include keys that the user actually touched.
  const patch: Record<string, unknown> = {}
  if (draft.ball_in_court.trim()) patch.ball_in_court = draft.ball_in_court.trim()
  if (draft.due_date) patch.due_date = draft.due_date
  if (draft.priority) patch.priority = draft.priority
  if (draft.status) patch.status = draft.status

  const hasChanges =
    Object.keys(patch).length > 0 ||
    addedWatchers.length > 0 ||
    addedRecipients.length > 0

  const handleApply = async () => {
    if (selectedIds.length === 0 || !hasChanges) return
    setSaving(true)
    try {
      // 1. Per-RFI patch — fan out, capture failures, surface aggregate.
      let updateFailed = 0
      if (Object.keys(patch).length > 0) {
        const updateResults = await Promise.allSettled(
          selectedIds.map((id) => updateRFI.mutateAsync({ id, updates: patch, projectId })),
        )
        updateFailed = updateResults.filter((r) => r.status === 'rejected').length
      }

      // 2. Per-RFI per-watcher fan-out
      let watcherFailed = 0
      if (addedWatchers.length > 0) {
        const watcherResults = await Promise.allSettled(
          selectedIds.flatMap((rfiId) =>
            addedWatchers.map((userId) => addWatcher.mutateAsync({ rfiId, userId, projectId })),
          ),
        )
        watcherFailed = watcherResults.filter((r) => r.status === 'rejected').length
      }

      // 3. Per-RFI per-recipient fan-out
      let distFailed = 0
      if (addedRecipients.length > 0) {
        const distResults = await Promise.allSettled(
          selectedIds.flatMap((rfiId) =>
            addedRecipients.map((email) =>
              addDistribution.mutateAsync({
                rfiId,
                projectId,
                recipient_email: email,
                recipient_name: null,
                message: null,
              }),
            ),
          ),
        )
        distFailed = distResults.filter((r) => r.status === 'rejected').length
      }

      // Aggregate user-facing report
      const totalFailed = updateFailed + watcherFailed + distFailed
      if (totalFailed === 0) {
        toast.success(`Updated ${selectedIds.length} RFI${selectedIds.length > 1 ? 's' : ''}`)
      } else {
        toast.warning(
          `Applied with ${totalFailed} error${totalFailed > 1 ? 's' : ''} — check the History panel for the failed rows.`,
        )
      }
      reset()
      onApplied?.()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bulk update failed'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const setField = <K extends keyof BulkDraft>(k: K, v: BulkDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const titleStr = `Edit Values · ${selectedIds.length} RFI${selectedIds.length > 1 ? 's' : ''} selected`

  return (
    <DetailPanel open={open} onClose={handleClose} title={titleStr} width="500px">
      <div style={{ padding: spacing.xl, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Empty fields are not changed. Apply writes per-RFI updates with one audit_log row per RFI.
        </p>

        <FieldRow label="Ball in Court">
          <input
            type="text"
            value={draft.ball_in_court}
            onChange={(e) => setField('ball_in_court', e.target.value)}
            style={inputStyle}
            aria-label="Ball in Court"
            placeholder="(no change)"
          />
        </FieldRow>

        <FieldRow label="Due Date">
          <input
            type="date"
            value={draft.due_date}
            onChange={(e) => setField('due_date', e.target.value)}
            style={inputStyle}
            aria-label="Due Date"
          />
        </FieldRow>

        <FieldRow label="Priority">
          <select
            value={draft.priority}
            onChange={(e) => setField('priority', e.target.value)}
            style={inputStyle}
            aria-label="Priority"
          >
            <option value="">(no change)</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </FieldRow>

        <FieldRow label="Status">
          <select
            value={draft.status}
            onChange={(e) => setField('status', e.target.value)}
            style={inputStyle}
            aria-label="Status"
          >
            <option value="">(no change)</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>
        </FieldRow>

        <FieldRow label="Add Watchers" hint="Adds these users as watchers on every selected RFI.">
          <UserChipEditor
            value={addedWatchers}
            onChange={setAddedWatchers}
            options={memberOptions}
            placeholder="Search project members…"
            ariaLabel="Add Watchers"
          />
        </FieldRow>

        <FieldRow label="Add Distribution Recipients" hint="Each email is added once per selected RFI.">
          <UserChipEditor
            value={addedRecipients}
            onChange={setAddedRecipients}
            options={distributionOptions}
            roleGroups={directory?.roleGroups}
            placeholder="email@example.com"
            ariaLabel="Add Distribution"
            onFreeText={(raw) => {
              const trimmed = raw.trim()
              if (!trimmed.includes('@')) return null
              return { value: trimmed, label: trimmed }
            }}
          />
        </FieldRow>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: spacing['2'],
            paddingTop: spacing.lg,
            borderTop: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            style={cancelBtnStyle}
          >
            <X size={14} /> Cancel
          </button>
          <PermissionGate permission="rfis.edit">
            <button
              type="button"
              onClick={handleApply}
              disabled={saving || !hasChanges}
              style={applyBtnStyle(saving || !hasChanges)}
            >
              <Save size={14} /> {saving ? 'Applying…' : `Apply to ${selectedIds.length}`}
            </button>
          </PermissionGate>
        </div>
      </div>
    </DetailPanel>
  )
}

interface FieldRowProps {
  label: string
  hint?: string
  children: React.ReactNode
}

const FieldRow: React.FC<FieldRowProps> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: typography.fontSize.caption, fontWeight: 600, color: colors.textSecondary }}>
      {label}
    </label>
    {children}
    {hint && (
      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{hint}</span>
    )}
  </div>
)

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  outline: 'none',
  fontFamily: 'inherit',
}

const cancelBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: typography.fontSize.sm,
  fontWeight: 500,
  color: colors.textSecondary,
  backgroundColor: 'transparent',
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  cursor: 'pointer',
}

const applyBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: typography.fontSize.sm,
  fontWeight: 600,
  color: 'white',
  backgroundColor: disabled ? colors.borderSubtle : colors.primaryOrange,
  border: 'none',
  borderRadius: borderRadius.base,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
})

export default RFIBulkEditPanel
