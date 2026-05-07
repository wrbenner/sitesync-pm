// Phase 4 — Delete Package dialog. Typed-DELETE confirmation. Submittals
// are NOT deleted; their submittal_package_id is set to NULL.

import React, { useState } from 'react'
import { toast } from 'sonner'
import { useDeleteSubmittalPackage } from '../../../hooks/useSubmittalPackages'
import {
  DialogShell,
  DialogFooter,
  inputStyle,
  SecondaryBtn,
} from './CreatePackageDialog'
import type { SubmittalPackage } from '../../../services/submittalPackages'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  critical: '#C93B3B',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface DeletePackageDialogProps {
  open: boolean
  projectId: string
  pkg: SubmittalPackage
  memberCount: number
  onClose: () => void
}

export const DeletePackageDialog: React.FC<DeletePackageDialogProps> = ({
  open,
  projectId,
  pkg,
  memberCount,
  onClose,
}) => {
  const [confirm, setConfirm] = useState('')
  const remove = useDeleteSubmittalPackage(projectId)

  if (!open) return null

  const canDelete = confirm.trim().toUpperCase() === 'DELETE'

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canDelete) {
      toast.error('Type DELETE to confirm.')
      return
    }
    try {
      await remove.mutateAsync(pkg.id)
      toast.success(`Package #${pkg.number} deleted. ${memberCount} submittal${memberCount === 1 ? '' : 's'} unpackaged.`)
      onClose()
    } catch (err) {
      toast.error('Failed to delete package: ' + (err as Error).message)
    }
  }

  return (
    <DialogShell title={`Delete Package #${pkg.number}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: C.ink, fontFamily: FONT, lineHeight: 1.5 }}>
          You're about to delete <strong>{pkg.title}</strong>. Submittals belonging to this package
          {memberCount > 0 ? ` (${memberCount})` : ''} will <strong>not</strong> be deleted — they'll move
          to the Unpackaged group on the Items view.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.ink2 }}>
            Type <code style={{ fontFamily: FONT, color: C.critical }}>DELETE</code> to confirm
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoFocus
            style={inputStyle}
            aria-label="Type DELETE to confirm"
          />
        </label>
        <DialogFooter>
          <SecondaryBtn type="button" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </SecondaryBtn>
          <button
            type="submit"
            disabled={!canDelete || remove.isPending}
            style={{
              padding: '7px 14px',
              backgroundColor: canDelete ? C.critical : '#fff',
              color: canDelete ? '#fff' : C.ink3,
              border: `1px solid ${canDelete ? C.critical : C.ink3}`,
              borderRadius: 4,
              cursor: canDelete && !remove.isPending ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: FONT,
            }}
          >
            {remove.isPending ? 'Deleting…' : 'Delete package'}
          </button>
        </DialogFooter>
      </form>
    </DialogShell>
  )
}

export default DeletePackageDialog
