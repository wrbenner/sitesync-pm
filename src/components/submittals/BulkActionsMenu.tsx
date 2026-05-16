// Phase 3 — Bulk Actions menu.
//
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 3 §B.
// Six menu items, each PermissionGate-wrapped:
//   1. Edit                  — opens BulkEditModal
//   2. Apply Workflow        — opens workflow picker (Phase 4 placeholder for now)
//   3. Delete                — typed-confirm "DELETE", admin-only
//   4. Re-run Iris Pre-flight — disabled (P2 of submittal spec, Phase 4+)
//   5. Distribute to Field   — calls submittal_distribute RPC per row
//   6. Generate Stamp PDF    — disabled (P2 of submittal spec)
//
// The trigger lives in SubmittalsToolbar. This component is the dropdown
// content shown when selectedCount ≥ 1 and the toolbar trigger fires.

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Pencil,
  GitBranch,
  Trash2,
  Sparkles,
  Send,
  FileSignature,
  Package,
} from 'lucide-react'
import { PermissionGate } from '../auth/PermissionGate'
import { submittalService } from '../../services/submittalService'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface BulkActionsMenuProps {
  /** Selected submittal ids. The menu shows count in section header. */
  selectedIds: string[]
  onClose: () => void
  /** Open the bulk edit modal. Page-level — composes with BulkEditModal. */
  onOpenEdit: () => void
  /** Open the bulk distribute dialog. Page mounts BulkDistributeDialog. */
  onOpenDistribute: () => void
  /** Open the workflow apply modal. Phase 4 wires the modal; Phase 3 stubs. */
  onOpenApplyWorkflow?: () => void
  /** Open the Create Package dialog with the current selection (Phase 4). */
  onOpenCreatePackage?: () => void
  /** Selection cleared by the page after a successful bulk action. */
  onClearSelection: () => void
}

export const BulkActionsMenu: React.FC<BulkActionsMenuProps> = ({
  selectedIds,
  onClose,
  onOpenEdit,
  onOpenDistribute,
  onOpenApplyWorkflow,
  onOpenCreatePackage,
  onClearSelection,
}) => {
  const [busy, setBusy] = useState<string | null>(null)
  const count = selectedIds.length

  const handleDelete = async () => {
    const confirmation = window.prompt(
      `This will void ${count} submittal${count === 1 ? '' : 's'}. Type DELETE to confirm.`,
    )
    if (confirmation !== 'DELETE') {
      toast.info('Delete cancelled. Confirmation phrase did not match.')
      return
    }
    setBusy('delete')
    try {
      let ok = 0
      let failed = 0
      for (const id of selectedIds) {
        const result = await submittalService.deleteSubmittal(id)
        if (result.error) failed += 1
        else ok += 1
      }
      if (failed === 0) {
        toast.success(`Voided ${ok} submittal${ok === 1 ? '' : 's'}.`)
      } else if (ok === 0) {
        toast.error(`Delete failed for all ${failed} submittal${failed === 1 ? '' : 's'}.`)
      } else {
        toast.warning(`Voided ${ok}; ${failed} failed.`)
      }
      onClearSelection()
      onClose()
    } finally {
      setBusy(null)
    }
  }

  const handleDistribute = () => {
    onClose()
    onOpenDistribute()
  }

  return (
    <div
      role="menu"
      aria-label={`Bulk actions for ${count} submittal${count === 1 ? '' : 's'}`}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        minWidth: 260,
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        boxShadow: '0 10px 24px rgba(0,0,0,0.10)',
        zIndex: 30,
        fontFamily: FONT,
        fontSize: 12,
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.borderSubtle}`,
          fontSize: 11,
          fontWeight: 600,
          color: C.ink3,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {count} selected
      </div>

      <PermissionGate permission="submittals.edit">
        <MenuItem icon={<Pencil size={12} />} onClick={() => { onOpenEdit(); onClose() }}>
          Edit
        </MenuItem>
        <MenuItem
          icon={<Package size={12} />}
          onClick={() => {
            if (onOpenCreatePackage) onOpenCreatePackage()
            else toast.info('Create Package: Phase 4 not wired')
            onClose()
          }}
        >
          Create Package from Selected
        </MenuItem>
        <MenuItem
          icon={<GitBranch size={12} />}
          onClick={() => {
            if (onOpenApplyWorkflow) onOpenApplyWorkflow()
            else toast.info('Apply Workflow: coming in Phase 4')
            onClose()
          }}
        >
          Apply Workflow
        </MenuItem>
      </PermissionGate>

      <PermissionGate permission="submittals.delete">
        <MenuItem
          icon={<Trash2 size={12} />}
          tone="danger"
          disabled={busy === 'delete'}
          onClick={handleDelete}
        >
          {busy === 'delete' ? 'Deleting…' : 'Delete'}
        </MenuItem>
      </PermissionGate>

      <Divider />

      <PermissionGate permission="submittals.edit">
        <MenuItem
          icon={<Sparkles size={12} />}
          disabled
          title="Available in P2 of submittals — coming in Phase 4"
        >
          Re-run Iris Pre-flight
        </MenuItem>
        <MenuItem
          icon={<Send size={12} />}
          onClick={handleDistribute}
        >
          Distribute to Field…
        </MenuItem>
        <MenuItem
          icon={<FileSignature size={12} />}
          disabled
          title="Available in P2 of submittals — coming in Phase 4"
        >
          Generate Stamp PDF
        </MenuItem>
      </PermissionGate>
    </div>
  )
}

const MenuItem: React.FC<{
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  title?: string
}> = ({ icon, children, onClick, tone = 'default', disabled, title }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '8px 12px',
      background: 'transparent',
      border: 'none',
      borderRadius: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 12,
      fontWeight: 500,
      color: disabled ? C.ink4 : tone === 'danger' ? C.critical : C.ink,
      textAlign: 'left',
      opacity: disabled ? 0.65 : 1,
    }}
    onMouseEnter={(e) => {
      if (!disabled) e.currentTarget.style.backgroundColor = C.surfaceInset
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent'
    }}
  >
    {icon}
    {children}
  </button>
)

const Divider: React.FC = () => (
  <div role="separator" style={{ height: 1, backgroundColor: C.borderSubtle, margin: '4px 0' }} />
)

export default BulkActionsMenu
