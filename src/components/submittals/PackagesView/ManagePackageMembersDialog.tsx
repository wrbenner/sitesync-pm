// Phase 4 — Manage Package Members dialog.
//
// Replaces the package's membership with a checked-set picker over all
// project submittals. Submittals already in the package start checked;
// other unpackaged + same-section candidates are listed below for easy
// addition. Submittals belonging to other packages are NOT shown to avoid
// accidental cross-package moves (use Items view → Bulk Edit for that).

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useSetPackageMembers } from '../../../hooks/useSubmittalPackages'
import {
  DialogShell,
  DialogFooter,
  inputStyle,
  PrimaryBtn,
  SecondaryBtn,
} from './CreatePackageDialog'
import type { SubmittalPackage } from '../../../services/submittalPackages'
import type { SubmittalListRow } from '../../../hooks/useSubmittalsList'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface ManagePackageMembersDialogProps {
  open: boolean
  projectId: string
  pkg: SubmittalPackage
  /** All submittals in the project (caller passes useSubmittalsList output). */
  allRows: SubmittalListRow[]
  onClose: () => void
}

export const ManagePackageMembersDialog: React.FC<ManagePackageMembersDialogProps> = ({
  open,
  projectId,
  pkg,
  allRows,
  onClose,
}) => {
  const candidateRows = useMemo(() => {
    return allRows.filter((r) => {
      const pid = (r.submittal_package_id as string | null | undefined) ?? null
      // already in this package OR unpackaged
      return pid === pkg.id || pid == null
    })
  }, [allRows, pkg.id])

  const initialIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of allRows) {
      if ((r.submittal_package_id as string | null | undefined) === pkg.id) {
        ids.add(String(r.id))
      }
    }
    return ids
  }, [allRows, pkg.id])

  const [checked, setChecked] = useState<Set<string>>(new Set(initialIds))
  const [search, setSearch] = useState('')
  const setMembers = useSetPackageMembers(projectId)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return candidateRows
    return candidateRows.filter((r) => {
      return (
        String(r.title ?? '').toLowerCase().includes(q) ||
        String(r.number ?? '').toLowerCase().includes(q) ||
        String(r.csi_section ?? '').toLowerCase().includes(q) ||
        String(r.sub_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [candidateRows, search])

  if (!open) return null

  const toggle = (id: string): void => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await setMembers.mutateAsync({ packageId: pkg.id, submittalIds: Array.from(checked) })
      const added = Array.from(checked).filter((id) => !initialIds.has(id)).length
      const removed = Array.from(initialIds).filter((id) => !checked.has(id)).length
      toast.success(`Members updated: +${added} / -${removed}`)
      onClose()
    } catch (err) {
      toast.error('Failed to update members: ' + (err as Error).message)
    }
  }

  return (
    <DialogShell title={`Manage members: Package #${pkg.number}`} onClose={onClose} width={580}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by number, title, spec, or sub…"
          style={inputStyle}
          aria-label="Search submittals"
        />
        <div
          role="listbox"
          aria-label="Package members"
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            maxHeight: 320,
            overflow: 'auto',
            backgroundColor: '#fff',
          }}
        >
          {filteredRows.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: C.ink3, fontSize: 12 }}>
              No matching submittals.
            </div>
          ) : (
            filteredRows.map((r) => {
              const id = String(r.id)
              const isChecked = checked.has(id)
              const inOther = (r.submittal_package_id as string | null | undefined) != null
                && r.submittal_package_id !== pkg.id
              return (
                <label
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderBottom: `1px solid ${C.borderSubtle}`,
                    cursor: inOther ? 'not-allowed' : 'pointer',
                    backgroundColor: isChecked ? C.surfaceInset : 'transparent',
                    fontFamily: FONT,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={inOther}
                    onChange={() => toggle(id)}
                    aria-label={`Toggle ${r.title}`}
                  />
                  <span style={{ width: 80, color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>
                    {String(r.number ?? '')}
                  </span>
                  <span style={{ color: C.ink3, width: 90 }}>{(r.csi_section as string | null) ?? '—'}</span>
                  <span style={{ flex: 1, color: C.ink, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {String(r.title ?? '')}
                  </span>
                </label>
              )
            })
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.ink3 }}>
          <span>{checked.size} selected</span>
          <span>{filteredRows.length} of {candidateRows.length} shown</span>
        </div>
        <DialogFooter>
          <SecondaryBtn type="button" onClick={onClose} disabled={setMembers.isPending}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn type="submit" disabled={setMembers.isPending}>
            {setMembers.isPending ? 'Saving…' : 'Save members'}
          </PrimaryBtn>
        </DialogFooter>
      </form>
    </DialogShell>
  )
}

export default ManagePackageMembersDialog
