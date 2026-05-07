// Phase 4 — Edit Package dialog. Edits name + description + responsible sub +
// CSI section. Cannot move/remove submittals (use ManagePackageMembersDialog).

import React, { useState } from 'react'
import { toast } from 'sonner'
import { useUpdateSubmittalPackage } from '../../../hooks/useSubmittalPackages'
import {
  DialogShell,
  DialogFooter,
  Field,
  inputStyle,
  PrimaryBtn,
  SecondaryBtn,
} from './CreatePackageDialog'
import type { SubmittalPackage } from '../../../services/submittalPackages'

export interface EditPackageDialogProps {
  open: boolean
  projectId: string
  pkg: SubmittalPackage
  onClose: () => void
}

export const EditPackageDialog: React.FC<EditPackageDialogProps> = ({
  open,
  projectId,
  pkg,
  onClose,
}) => {
  const [title, setTitle] = useState(pkg.title)
  const [description, setDescription] = useState(pkg.description ?? '')
  const [csiSection, setCsiSection] = useState(pkg.csi_section ?? '')
  const update = useUpdateSubmittalPackage(projectId)

  if (!open) return null

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Package name is required')
      return
    }
    try {
      await update.mutateAsync({
        id: pkg.id,
        title: title.trim(),
        description: description.trim() || null,
        responsibleSubId: pkg.responsible_sub_id,
        csiSection: csiSection.trim() || null,
      })
      toast.success(`Package #${pkg.number} updated`)
      onClose()
    } catch (err) {
      toast.error('Failed to update package: ' + (err as Error).message)
    }
  }

  return (
    <DialogShell title={`Edit Package #${pkg.number}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Package name" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          />
        </Field>
        <Field label="CSI section">
          <input
            type="text"
            value={csiSection}
            onChange={(e) => setCsiSection(e.target.value)}
            placeholder="03 30 00"
            style={inputStyle}
          />
        </Field>
        <DialogFooter>
          <SecondaryBtn type="button" onClick={onClose} disabled={update.isPending}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn type="submit" disabled={!title.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </PrimaryBtn>
        </DialogFooter>
      </form>
    </DialogShell>
  )
}

export default EditPackageDialog
