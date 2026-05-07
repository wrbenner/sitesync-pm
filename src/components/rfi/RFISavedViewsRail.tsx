// ── RFISavedViewsRail ───────────────────────────────────────────────────
// Procore-mirror left rail with three sections: Company, Project,
// Personal. Each section lists saved views; clicking applies the view's
// filters/columns/sort/view_mode to the URL state.
//
// The rail itself is collapsible (mobile + small screens). The default
// open state is desktop-wide.

import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Building2, FolderOpen, User, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PermissionGate } from '../auth/PermissionGate'
import { useRFISavedViews, useDeleteRFISavedView, type RFISavedView, type RFIViewScope } from '../../hooks/queries/useRFISavedViews'
import { useAuth } from '../../hooks/useAuth'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface RFISavedViewsRailProps {
  projectId: string
  /** The currently applied view id, for visual selection state. */
  activeViewId: string | null
  onApply: (view: RFISavedView) => void
  onCreate: (scope: RFIViewScope) => void
}

const SCOPE_META: Record<
  RFIViewScope,
  { label: string; icon: React.ReactNode; description: string }
> = {
  company: {
    label: 'Company Views',
    icon: <Building2 size={13} />,
    description: 'Visible to all org members',
  },
  project: {
    label: 'Project Views',
    icon: <FolderOpen size={13} />,
    description: 'Visible to project members',
  },
  personal: {
    label: 'Personal Views',
    icon: <User size={13} />,
    description: 'Only you can see these',
  },
}

export const RFISavedViewsRail: React.FC<RFISavedViewsRailProps> = ({
  projectId,
  activeViewId,
  onApply,
  onCreate,
}) => {
  const { data: views = [] } = useRFISavedViews(projectId)
  const deleteView = useDeleteRFISavedView()
  const { user } = useAuth()

  const [open, setOpen] = useState<Record<RFIViewScope, boolean>>({
    company: true,
    project: true,
    personal: true,
  })

  const grouped = (scope: RFIViewScope) => views.filter((v) => v.scope === scope)

  return (
    <aside
      aria-label="Saved Views"
      style={{
        width: 220,
        flexShrink: 0,
        padding: spacing['3'],
        backgroundColor: colors.surfaceInset,
        borderRight: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: colors.textTertiary,
        }}
      >
        Saved Views
      </div>

      {(['company', 'project', 'personal'] as RFIViewScope[]).map((scope) => {
        const meta = SCOPE_META[scope]
        const list = grouped(scope)
        const isOpen = open[scope]
        return (
          <div key={scope} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [scope]: !o[scope] }))}
              aria-expanded={isOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                background: 'transparent',
                border: 'none',
                color: colors.textSecondary,
                fontSize: typography.fontSize.caption,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {meta.icon}
              <span style={{ flex: 1 }}>{meta.label}</span>
              <span style={{ fontSize: 10, color: colors.textTertiary }}>{list.length}</span>
            </button>
            {isOpen && (
              <ul
                style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                {list.map((view) => {
                  const isActive = view.id === activeViewId
                  const canDelete =
                    scope === 'personal'
                      ? view.owner_id === user?.id
                      : false // admins use the Configure panel; rail keeps a clean primary affordance
                  return (
                    <li key={view.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onApply(view)}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '4px 8px 4px 22px',
                          background: isActive ? colors.orangeSubtle : 'transparent',
                          border: 'none',
                          color: isActive ? colors.primaryOrange : colors.textPrimary,
                          fontSize: typography.fontSize.sm,
                          fontWeight: isActive ? 600 : 400,
                          borderRadius: borderRadius.sm,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {view.name}
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Delete view "${view.name}"?`)) return
                            try {
                              await deleteView.mutateAsync({ id: view.id, projectId })
                              toast.success('View deleted')
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Could not delete')
                            }
                          }}
                          aria-label={`Delete view ${view.name}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: colors.textTertiary,
                            padding: 4,
                            cursor: 'pointer',
                            opacity: 0.4,
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </li>
                  )
                })}
                {list.length === 0 && (
                  <li
                    style={{
                      padding: '4px 8px 4px 22px',
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                      fontStyle: 'italic',
                    }}
                  >
                    No views yet.
                  </li>
                )}
                {/* + Create — gated by scope. Personal: anyone. Project + Company:
                    PermissionGate. */}
                {scope === 'personal' ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => onCreate(scope)}
                      style={createBtnStyle}
                    >
                      <Plus size={11} /> New personal view
                    </button>
                  </li>
                ) : (
                  <PermissionGate permission="rfis.edit">
                    <li>
                      <button
                        type="button"
                        onClick={() => onCreate(scope)}
                        style={createBtnStyle}
                      >
                        <Plus size={11} /> New {scope} view
                      </button>
                    </li>
                  </PermissionGate>
                )}
              </ul>
            )}
          </div>
        )
      })}
    </aside>
  )
}

const createBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px 4px 22px',
  background: 'transparent',
  border: 'none',
  color: colors.textTertiary,
  fontSize: typography.fontSize.caption,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
}

export default RFISavedViewsRail
