// Phase 4 — Packages view.
//
// Groups submittals under their submittal_package_id. Submittals not in any
// package are grouped under a synthetic "Unpackaged" bucket. Inline package
// CRUD actions live in the group header (Edit / Members / Delete); a global
// "+ Create Package" pivot lives in the Bulk Actions menu when ≥1 row is
// selected (see pages/submittals/index.tsx).

import React, { useMemo, useState } from 'react'
import { Edit2, Users, Trash2, Eye } from 'lucide-react'
import { useSubmittalsList, type SubmittalListRow } from '../../../hooks/useSubmittalsList'
import { useSubmittalPackages } from '../../../hooks/useSubmittalPackages'
import { GroupedSubmittalsView, type GroupBucket } from '../GroupedView/GroupedSubmittalsView'
import { CreatePackageDialog } from './CreatePackageDialog'
import { EditPackageDialog } from './EditPackageDialog'
import { ManagePackageMembersDialog } from './ManagePackageMembersDialog'
import { DeletePackageDialog } from './DeletePackageDialog'
import { PermissionGate } from '../../auth/PermissionGate'
import type { SubmittalPackage } from '../../../services/submittalPackages'

const C = {
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface PackagesViewProps {
  projectId: string
  resetToken: string
  numberingFormat: string
  filterFn?: (row: SubmittalListRow) => boolean
  selectionClearToken?: number
  onSelectionIdsChange?: (ids: string[]) => void
  /**
   * Page-level "Create Package" trigger — when set, opens the create dialog.
   * Phase 4 wires Bulk Actions → Create Package by toggling this flag.
   */
  createDialogOpen?: boolean
  /** Submittal ids selected at the page level when Create was triggered. */
  createDialogSelectedIds?: string[]
  onCreateDialogClose?: () => void
}

export const PackagesView: React.FC<PackagesViewProps> = ({
  projectId,
  resetToken,
  numberingFormat,
  filterFn,
  selectionClearToken,
  onSelectionIdsChange,
  createDialogOpen = false,
  createDialogSelectedIds = [],
  onCreateDialogClose,
}) => {
  const { rows, loading: rowsLoading } = useSubmittalsList(projectId)
  const { packages, loading: pkgLoading } = useSubmittalPackages(projectId)

  const [editPkg, setEditPkg] = useState<SubmittalPackage | null>(null)
  const [membersPkg, setMembersPkg] = useState<SubmittalPackage | null>(null)
  const [deletePkg, setDeletePkg] = useState<SubmittalPackage | null>(null)

  const filteredRows = useMemo(() => {
    if (!filterFn) return rows
    return rows.filter(filterFn)
  }, [rows, filterFn])

  const groups = useMemo<GroupBucket[]>(() => {
    const byPackage = new Map<string, SubmittalListRow[]>()
    const unpackaged: SubmittalListRow[] = []
    for (const row of filteredRows) {
      const pid = (row.submittal_package_id as string | null | undefined) ?? null
      if (!pid) {
        unpackaged.push(row)
        continue
      }
      const list = byPackage.get(pid)
      if (list) list.push(row)
      else byPackage.set(pid, [row])
    }

    const buckets: GroupBucket[] = packages.map((pkg) => {
      const subs = byPackage.get(pkg.id) ?? []
      const overdue = subs.filter((r) => {
        const onSite = (r.required_on_site_date as string | null) ?? null
        if (!onSite) return false
        const d = new Date(onSite)
        return !Number.isNaN(d.getTime()) && d < new Date(new Date().setHours(0, 0, 0, 0))
      }).length
      const subtitle =
        [
          pkg.csi_section ? `Spec ${pkg.csi_section}` : null,
          pkg.description ? pkg.description : null,
          overdue > 0 ? `${overdue} overdue` : null,
        ].filter(Boolean).join(' · ') || null

      return {
        id: pkg.id,
        label: `#${pkg.number}: ${pkg.title}`,
        subtitle,
        rows: subs,
        actions: (
          <PackageHeaderActions
            onEdit={() => setEditPkg(pkg)}
            onMembers={() => setMembersPkg(pkg)}
            onDelete={() => setDeletePkg(pkg)}
            onView={() => setEditPkg(pkg)}
          />
        ),
      }
    })

    if (unpackaged.length > 0) {
      buckets.push({
        id: '__unpackaged__',
        label: 'Unpackaged',
        subtitle: 'Submittals not assigned to any package — select rows on the Items view to bundle them.',
        rows: unpackaged,
      })
    }

    return buckets
  }, [packages, filteredRows])

  const loading = rowsLoading || pkgLoading

  const emptyState = (
    <div style={{ textAlign: 'center', maxWidth: 460, fontFamily: FONT }}>
      <h3 style={{ margin: 0, fontSize: 14, color: C.ink2, fontWeight: 600 }}>No packages yet</h3>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.ink3, lineHeight: 1.5 }}>
        Create one from the Items view by selecting submittals → Bulk Actions → Create Package.
      </p>
    </div>
  )

  return (
    <>
      <GroupedSubmittalsView
        projectId={projectId}
        viewType="packages"
        resetToken={resetToken}
        numberingFormat={numberingFormat}
        groups={groups}
        selectionClearToken={selectionClearToken}
        onSelectionIdsChange={onSelectionIdsChange}
        emptyState={emptyState}
        loading={loading}
      />

      <CreatePackageDialog
        open={createDialogOpen}
        projectId={projectId}
        preselectedSubmittalIds={createDialogSelectedIds}
        onClose={() => onCreateDialogClose?.()}
      />
      {editPkg && (
        <EditPackageDialog
          open
          projectId={projectId}
          pkg={editPkg}
          onClose={() => setEditPkg(null)}
        />
      )}
      {membersPkg && (
        <ManagePackageMembersDialog
          open
          projectId={projectId}
          pkg={membersPkg}
          allRows={rows}
          onClose={() => setMembersPkg(null)}
        />
      )}
      {deletePkg && (
        <DeletePackageDialog
          open
          projectId={projectId}
          pkg={deletePkg}
          memberCount={(rows.filter((r) => r.submittal_package_id === deletePkg.id)).length}
          onClose={() => setDeletePkg(null)}
        />
      )}
    </>
  )
}

interface PackageHeaderActionsProps {
  onView: () => void
  onEdit: () => void
  onMembers: () => void
  onDelete: () => void
}

const PackageHeaderActions: React.FC<PackageHeaderActionsProps> = ({ onView, onEdit, onMembers, onDelete }) => (
  <>
    <PermissionGate permission="submittals.view">
      <ActionBtn onClick={onView} label="View" Icon={Eye} />
    </PermissionGate>
    <PermissionGate permission="submittals.edit">
      <ActionBtn onClick={onEdit} label="Edit" Icon={Edit2} />
    </PermissionGate>
    <PermissionGate permission="submittals.edit">
      <ActionBtn onClick={onMembers} label="Members" Icon={Users} />
    </PermissionGate>
    <PermissionGate permission="submittals.delete">
      <ActionBtn onClick={onDelete} label="Delete" Icon={Trash2} tone="danger" />
    </PermissionGate>
  </>
)

interface ActionBtnProps {
  onClick: () => void
  label: string
  Icon: React.ComponentType<{ size?: number }>
  tone?: 'default' | 'danger'
}

const ActionBtn: React.FC<ActionBtnProps> = ({ onClick, label, Icon, tone = 'default' }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick() }}
    title={label}
    aria-label={label}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '4px 6px',
      border: `1px solid ${C.border}`,
      backgroundColor: '#fff',
      color: tone === 'danger' ? '#C93B3B' : C.ink2,
      cursor: 'pointer',
      borderRadius: 3,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: FONT,
    }}
  >
    <Icon size={11} /> {label}
  </button>
)

export default PackagesView
