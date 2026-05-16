// Phase 3 — Saved Views sidebar.
//
// Per SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 3 §C.
// Four scopes — My / Project / Company / Iris-Suggested. Iris views are
// read-only (the migration RLS blocks user writes). Sidebar open/closed
// state persists in localStorage keyed by project id.

import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  Sparkles,
  User,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
} from 'lucide-react'
import { useSavedViews } from '../../../hooks/useSavedViews'
import { useSubmittalFilters } from '../../../hooks/useSubmittalFilters'
import { PermissionGate } from '../../auth/PermissionGate'
import type { SavedView, SavedViewScope } from '../../../services/submittalsSavedViews'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
  brandOrange: '#F47820',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const STORAGE_KEY_PREFIX = 'submittals:saved_views:open:'

const SCOPE_META: Record<SavedViewScope, { label: string; icon: React.ReactNode; description: string }> = {
  my:      { label: 'My Views',      icon: <User size={12} />,     description: 'Private to you' },
  project: { label: 'Project Views', icon: <Users size={12} />,    description: 'Shared with this project' },
  company: { label: 'Company Views', icon: <Building2 size={12} />, description: 'Shared org-wide' },
  iris:    { label: 'Iris Suggested', icon: <Sparkles size={12} />, description: 'Auto-generated, read-only' },
}

export interface SavedViewsSidebarProps {
  projectId: string
}

export const SavedViewsSidebar: React.FC<SavedViewsSidebarProps> = ({ projectId }) => {
  const storageKey = STORAGE_KEY_PREFIX + projectId
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(storageKey) === '1'
  })
  const setOpenWithPersist = useCallback((v: boolean) => {
    setOpen(v)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, v ? '1' : '0')
    }
  }, [storageKey])

  const { byScope, loading, remove } = useSavedViews(projectId)
  const filters = useSubmittalFilters()
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  return (
    <aside
      aria-label="Saved views"
      style={{
        flex: open ? '0 0 240px' : '0 0 36px',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${C.border}`,
        backgroundColor: C.surface,
        fontFamily: FONT,
        transition: 'flex-basis 120ms ease',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        aria-label={open ? 'Collapse saved views' : 'Expand saved views'}
        onClick={() => setOpenWithPersist(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          padding: open ? '10px 12px' : '10px 0',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${C.borderSubtle}`,
          color: C.ink,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: FONT,
        }}
      >
        {open && <span>Saved Views</span>}
        {open ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>

      {open && (
        <>
          {filters.hasAny && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  width: '100%',
                  border: `1px solid ${C.brandOrange}`,
                  borderRadius: 4,
                  backgroundColor: 'rgba(244, 120, 32, 0.08)',
                  color: C.brandOrange,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: FONT,
                }}
              >
                <Save size={11} />
                Save current view…
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
            {(Object.keys(SCOPE_META) as SavedViewScope[]).map((scope) => {
              const list = byScope[scope]
              return (
                <ScopeSection
                  key={scope}
                  scope={scope}
                  views={list}
                  loading={loading}
                  onApply={(state) => {
                    if (state.filters) filters.applySavedFilters(state.filters as Record<string, unknown>)
                    else filters.clearAll()
                  }}
                  onDelete={remove}
                />
              )
            })}
          </div>
        </>
      )}

      {showSaveDialog && (
        <SaveViewDialog
          projectId={projectId}
          currentFilters={filters.filters}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </aside>
  )
}

const ScopeSection: React.FC<{
  scope: SavedViewScope
  views: SavedView[]
  loading: boolean
  onApply: (state: SavedView['view_state']) => void
  onDelete: (id: string) => Promise<boolean>
}> = ({ scope, views, loading, onApply, onDelete }) => {
  const meta = SCOPE_META[scope]
  return (
    <section style={{ marginBottom: 6 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px 4px',
          color: C.ink3,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {meta.icon}
        {meta.label}
      </header>
      {loading && views.length === 0 && (
        <div style={{ padding: '4px 12px', color: C.ink4, fontSize: 11 }}>Loading…</div>
      )}
      {!loading && views.length === 0 && (
        <div style={{ padding: '4px 12px', color: C.ink4, fontSize: 11, fontStyle: 'italic' }}>
          {scope === 'iris' ? 'Iris will suggest views.' : meta.description}
        </div>
      )}
      {views.map((v) => (
        <ViewRow key={v.id} view={v} onApply={() => onApply(v.view_state)} onDelete={onDelete} />
      ))}
    </section>
  )
}

const ViewRow: React.FC<{
  view: SavedView
  onApply: () => void
  onDelete: (id: string) => Promise<boolean>
}> = ({ view, onApply, onDelete }) => {
  const isIris = view.scope === 'iris'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        margin: '0 4px',
        borderRadius: 4,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surfaceInset }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <button
        type="button"
        onClick={onApply}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '4px 4px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          color: C.ink,
          fontFamily: FONT,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={view.description ?? view.name}
      >
        {view.name}
      </button>
      {!isIris && (
        <button
          type="button"
          aria-label={`Delete ${view.name}`}
          onClick={async (e) => {
            e.stopPropagation()
            if (!window.confirm(`Delete saved view "${view.name}"?`)) return
            const ok = await onDelete(view.id)
            if (ok) toast.success(`Deleted "${view.name}"`)
            else toast.error('Delete failed')
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.ink3,
            cursor: 'pointer',
            padding: 4,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}

const SaveViewDialog: React.FC<{
  projectId: string
  currentFilters: Record<string, unknown>
  onClose: () => void
}> = ({ projectId, currentFilters, onClose }) => {
  const { create } = useSavedViews(projectId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<SavedViewScope>('my')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    setBusy(true)
    const result = await create({
      project_id: projectId,
      scope,
      name: name.trim(),
      description: description.trim() || undefined,
      view_state: { filters: currentFilters },
    })
    setBusy(false)
    if (result) {
      toast.success(`Saved "${name}"`)
      onClose()
    } else {
      toast.error('Could not save view (check your permissions).')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: '92vw',
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 20,
          fontFamily: FONT,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Save current view</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name"
          autoFocus
          style={{
            padding: '6px 10px',
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            fontSize: 12,
            fontFamily: FONT,
            outline: 'none',
          }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          style={{
            padding: '6px 10px',
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            fontSize: 12,
            fontFamily: FONT,
            outline: 'none',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {(['my', 'project', 'company'] as const).map((s) => {
            const active = scope === s
            const inner = (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  border: `1px solid ${active ? C.brandOrange : C.border}`,
                  borderRadius: 4,
                  background: active ? 'rgba(244,120,32,0.08)' : '#fff',
                  color: active ? C.brandOrange : C.ink2,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {SCOPE_META[s].label}
              </button>
            )
            if (s === 'project' || s === 'company') {
              return (
                <PermissionGate key={s} permission="submittals.edit" fallback={null}>
                  {inner}
                </PermissionGate>
              )
            }
            return inner
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '6px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: '#fff',
              color: C.ink,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            style={{
              padding: '6px 14px',
              backgroundColor: C.brandOrange,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: FONT,
              opacity: busy || !name.trim() ? 0.6 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SavedViewsSidebar
