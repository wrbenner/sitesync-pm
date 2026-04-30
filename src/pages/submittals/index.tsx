// ─────────────────────────────────────────────────────────────────────────────
// Submittals — PM review queue (investor-readiness push)
// ─────────────────────────────────────────────────────────────────────────────
// Mission: PM submittal queue. Procurement chain visible. Reviewer ball-in-
// court. Schedule-risk tag on items whose target activity is approaching.
// Dense, full-viewport, sticky header with filter chips and "+ New Submittal".
// Detail navigation, create flow, approve/reject mutations all preserved.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProjectGate } from '../../components/ProjectGate'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { ExportButton } from '../../components/shared/ExportButton'
import { useSubmittals, useProject } from '../../hooks/queries'
import { useCreateSubmittal, useUpdateSubmittal } from '../../hooks/mutations'
import { useProjectId } from '../../hooks/useProjectId'
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation'
import { useNavigate } from 'react-router-dom'
import { useScheduleActivities } from '../../hooks/useScheduleActivities'
import { useCopilotStore } from '../../stores/copilotStore'
import { exportSubmittalLogXlsx } from '../../lib/exportXlsx'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, RefreshCw, Search, Plus, Upload, LayoutGrid, List } from 'lucide-react'
import { toast } from 'sonner'
import CreateSubmittalModal from '../../components/forms/CreateSubmittalModal'
import SubmittalCreateWizard from '../../components/submittals/SubmittalCreateWizard'

import { SubmittalsTable } from './SubmittalsTable'
import { SubmittalsKanban } from './SubmittalsKanban'
import { GroupedSubmittalsView, GroupBySelector } from './GroupedSubmittalsView'
import type { GroupByMode } from './GroupedSubmittalsView'
import { SubmittalTabBar } from './SubmittalTabBar'
import type { SubmittalStatusFilter } from './SubmittalTabBar'

// CreateSubmittalModal is imported above for type continuity but the live
// create surface is the wizard. Reference the import so eslint-no-unused
// stays quiet without affecting the bundle (the wizard is the canonical
// flow; the modal is kept for any consumer still importing it from here).
void CreateSubmittalModal

// Page-local design tokens — see specs/homepage-redesign/DESIGN-RESET.md.
const C = {
  surface: '#FCFCFA',
  surfaceAlt: '#F5F5F1',
  surfaceHover: '#F0EFEB',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  ink4: '#C4BDB4',
  brandOrange: '#F47820',
  critical: '#C93B3B',
  high: '#B8472E',
  pending: '#C4850C',
  active: '#2D8A6E',
  indigo: '#4F46E5',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const SubmittalsPage: React.FC = () => {
  const setPageContext = useCopilotStore((s) => s.setPageContext)
  useEffect(() => { setPageContext('submittals') }, [setPageContext])

  const projectId = useProjectId()
  const navigate = useNavigate()
  const createSubmittal = useCreateSubmittal()
  const updateSubmittal = useUpdateSubmittal()

  const { data: submittalsResult, isPending: loading, error, refetch } = useSubmittals(projectId)
  const { data: project } = useProject(projectId)
  const { data: scheduleActivities } = useScheduleActivities(projectId ?? '')

  useRealtimeInvalidation(projectId)

  const [statusFilter, setStatusFilter] = useState<SubmittalStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByMode>('none')
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const specFileInputRef = useRef<HTMLInputElement>(null)

  const submittals: Array<Record<string, unknown>> = useMemo(
    () => (submittalsResult?.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : String(s.id ?? '').slice(0, 8),
      from: (s.subcontractor as string) || (s.created_by as string) || '',
      dueDate: (s.due_date as string) || '',
    })),
    [submittalsResult?.data],
  )

  const counts = useMemo(() => {
    const c = { all: submittals.length, pending: 0, in_review: 0, approved: 0, rejected: 0, revise_resubmit: 0 }
    for (const s of submittals) {
      const st = (s.status as string) ?? ''
      if (st === 'submitted' || st === 'review_in_progress') c.pending++
      if (st === 'submitted' || st === 'review_in_progress' || st === 'under_review') c.in_review++
      if (st === 'approved' || st === 'approved_as_noted') c.approved++
      if (st === 'rejected') c.rejected++
      if (st === 'revise_resubmit') c.revise_resubmit++
    }
    return c
  }, [submittals])

  const overdueCount = useMemo(() =>
    submittals.filter((s) => {
      const due = (s.due_date as string | undefined) || (s.dueDate as string | undefined)
      if (!due) return false
      return s.status !== 'approved' && s.status !== 'approved_as_noted' && new Date(due) < new Date()
    }).length,
    [submittals],
  )

  const filteredSubmittals = useMemo(() => {
    let rows = submittals
    if (statusFilter === 'in_review') {
      rows = rows.filter((s) => s.status === 'submitted' || s.status === 'review_in_progress' || s.status === 'under_review')
    } else if (statusFilter !== 'all') {
      rows = rows.filter((s) => s.status === statusFilter)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((s) => {
        const r = s as Record<string, unknown>
        return (
          String(r.title ?? '').toLowerCase().includes(q) ||
          String(r.number ?? '').toLowerCase().includes(q) ||
          String(r.spec_section ?? '').toLowerCase().includes(q) ||
          String(r.subcontractor ?? '').toLowerCase().includes(q) ||
          String(r.assigned_to ?? '').toLowerCase().includes(q) ||
          String(r.current_reviewer ?? '').toLowerCase().includes(q)
        )
      })
    }
    return rows
  }, [submittals, statusFilter, searchQuery])

  const handleExportXlsx = useCallback(() => {
    const projectName = project?.name ?? 'Project'
    const rows = (submittalsResult?.data ?? []).map((s: Record<string, unknown>) => ({
      number: String(s.number ?? s.id ?? ''),
      title: (s.title as string) ?? '',
      specSection: (s.spec_section as string) ?? '',
      subcontractor: (s.subcontractor as string) ?? (s.assigned_to as string) ?? '',
      status: (s.status as string) ?? '',
      revision: String(s.revision_number ?? ''),
      leadTime: String(s.lead_time_weeks ?? ''),
      dueDate: (s.due_date as string) ?? '',
    }))
    exportSubmittalLogXlsx(projectName, rows)
  }, [project?.name, submittalsResult?.data])

  const handleSpecImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    const storagePath = `${projectId}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('submittal-specs').upload(storagePath, file)
    if (uploadErr) toast.error('Failed to upload spec: ' + uploadErr.message)
    else toast.success(`Spec uploaded: ${file.name}`)
    e.target.value = ''
  }, [projectId])

  if (!projectId) return <ProjectGate />

  if (loading) {
    return (
      <Shell projectName={project?.name} viewMode={viewMode} setViewMode={setViewMode} groupBy={groupBy} setGroupBy={setGroupBy} statusFilter={statusFilter} setStatusFilter={setStatusFilter} counts={counts} overdueCount={overdueCount} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        actions={
          <PermissionGate permission="submittals.create">
            <PrimaryBtn onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Submittal
            </PrimaryBtn>
          </PermissionGate>
        }
      >
        <SkeletonRows />
      </Shell>
    )
  }

  if (error) {
    return (
      <Shell projectName={project?.name} viewMode={viewMode} setViewMode={setViewMode} groupBy={groupBy} setGroupBy={setGroupBy} statusFilter={statusFilter} setStatusFilter={setStatusFilter} counts={counts} overdueCount={overdueCount} searchQuery={searchQuery} setSearchQuery={setSearchQuery}>
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            backgroundColor: 'rgba(201, 59, 59, 0.06)',
            color: C.critical,
            borderBottom: `1px solid ${C.borderSubtle}`,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={14} />
          <span style={{ flex: 1 }}>Couldn’t load submittals. Check your connection and try again.</span>
          <SecondaryBtn onClick={() => refetch()}>
            <RefreshCw size={12} /> Retry
          </SecondaryBtn>
        </div>
      </Shell>
    )
  }

  if (submittals.length === 0 && statusFilter === 'all' && !searchQuery.trim()) {
    return (
      <Shell projectName={project?.name} viewMode={viewMode} setViewMode={setViewMode} groupBy={groupBy} setGroupBy={setGroupBy} statusFilter={statusFilter} setStatusFilter={setStatusFilter} counts={counts} overdueCount={overdueCount} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        actions={
          <PermissionGate permission="submittals.create">
            <PrimaryBtn onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Submittal
            </PrimaryBtn>
          </PermissionGate>
        }
      >
        <EmptyState
          title="No submittals yet"
          body="Track material approvals to keep procurement on schedule."
          actions={
            <>
              <PermissionGate permission="submittals.create">
                <PrimaryBtn onClick={() => setShowCreate(true)}>Create submittal</PrimaryBtn>
              </PermissionGate>
              <SecondaryBtn onClick={() => specFileInputRef.current?.click()}>
                <Upload size={14} /> Import from spec
              </SecondaryBtn>
              <input ref={specFileInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" style={{ display: 'none' }} onChange={handleSpecImport} />
            </>
          }
        />
        <SubmittalCreateWizard
          projectId={projectId}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await createSubmittal.mutateAsync({ projectId, data: { ...data, project_id: projectId } })
            toast.success('Submittal created: ' + (data.title || 'New Submittal'))
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell
      projectName={project?.name}
      viewMode={viewMode}
      setViewMode={setViewMode}
      groupBy={groupBy}
      setGroupBy={setGroupBy}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      counts={counts}
      overdueCount={overdueCount}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      actions={
        <>
          <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Submittal_Log" />
          <PermissionGate permission="submittals.create">
            <PrimaryBtn onClick={() => setShowCreate(true)}>
              <Plus size={14} /> New Submittal
            </PrimaryBtn>
          </PermissionGate>
        </>
      }
    >
      <div style={{ flex: 1, overflow: 'auto', backgroundColor: C.surface }}>
        {viewMode === 'table' && groupBy !== 'none' ? (
          <GroupedSubmittalsView
            filteredSubmittals={filteredSubmittals}
            groupBy={groupBy}
            onRowClick={(sub) => navigate(`/submittals/${(sub as Record<string, unknown>).id}`)}
          />
        ) : viewMode === 'table' ? (
          <SubmittalsTable
            filteredSubmittals={filteredSubmittals}
            allSubmittals={submittals}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            loading={loading}
            onRowClick={(sub) => navigate(`/submittals/${(sub as Record<string, unknown>).id}`)}
            clearFilters={() => { setStatusFilter('all'); setSearchQuery('') }}
            projectId={projectId}
            updateSubmittalMutateAsync={updateSubmittal.mutateAsync}
            scheduleActivities={scheduleActivities ?? []}
          />
        ) : (
          <SubmittalsKanban
            allSubmittals={filteredSubmittals}
            onSelectSubmittal={(id) => navigate(`/submittals/${id}`)}
          />
        )}
      </div>

      <SubmittalCreateWizard
        projectId={projectId}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data) => {
          await createSubmittal.mutateAsync({ projectId, data: { ...data, project_id: projectId } })
          toast.success('Submittal created: ' + (data.title || 'New Submittal'))
        }}
      />

      <input ref={specFileInputRef} type="file" accept=".pdf,.docx,.xlsx,.csv" style={{ display: 'none' }} onChange={handleSpecImport} />
    </Shell>
  )
}

// ── Shell — sticky header + body slot ───────────────────────────────────────

interface ShellProps {
  children: React.ReactNode
  actions?: React.ReactNode
  projectName?: string
  viewMode: 'table' | 'kanban'
  setViewMode: (v: 'table' | 'kanban') => void
  groupBy: GroupByMode
  setGroupBy: (m: GroupByMode) => void
  statusFilter: SubmittalStatusFilter
  setStatusFilter: (f: SubmittalStatusFilter) => void
  counts: Record<SubmittalStatusFilter, number>
  overdueCount: number
  searchQuery: string
  setSearchQuery: (q: string) => void
}

const Shell: React.FC<ShellProps> = ({
  children,
  actions,
  projectName,
  viewMode,
  setViewMode,
  groupBy,
  setGroupBy,
  statusFilter,
  setStatusFilter,
  counts,
  overdueCount,
  searchQuery,
  setSearchQuery,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100%',
      backgroundColor: C.surface,
      color: C.ink,
      fontFamily: FONT,
    }}
  >
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: C.ink,
            }}
          >
            Submittals
          </h1>
          <CountChip count={counts.all} />
          {overdueCount > 0 && <OverdueChip count={overdueCount} />}
          {projectName && (
            <span
              style={{
                fontSize: 13,
                color: C.ink3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 320,
              }}
            >
              {projectName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          {actions}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px 12px',
          flexWrap: 'wrap',
        }}
      >
        <SubmittalTabBar activeTab={statusFilter} onTabChange={setStatusFilter} counts={counts} />

        <div style={{ flex: 1 }} />

        <div style={{ position: 'relative', width: 260 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.ink3,
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search submittals…"
            aria-label="Search submittals"
            style={{
              width: '100%',
              padding: '6px 12px 6px 30px',
              minHeight: 32,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 13,
              fontFamily: FONT,
              backgroundColor: '#fff',
              color: C.ink,
              outline: 'none',
            }}
          />
        </div>

        {viewMode === 'table' && <GroupBySelector value={groupBy} onChange={setGroupBy} />}
      </div>
    </header>

    {children}
  </div>
)

// ── Bits ────────────────────────────────────────────────────────────────────

const CountChip: React.FC<{ count: number }> = ({ count }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 22,
      height: 22,
      padding: '0 8px',
      borderRadius: 999,
      backgroundColor: '#fff',
      border: `1px solid ${C.border}`,
      color: C.ink2,
      fontSize: 11,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    {count}
  </span>
)

const OverdueChip: React.FC<{ count: number }> = ({ count }) => (
  <span
    title={`${count} submittals past their due-back date`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 999,
      backgroundColor: 'rgba(201, 59, 59, 0.08)',
      color: C.critical,
      fontSize: 11,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    <AlertTriangle size={11} />
    {count} overdue
  </span>
)

const ViewToggle: React.FC<{ value: 'table' | 'kanban'; onChange: (v: 'table' | 'kanban') => void }> = ({ value, onChange }) => (
  <div
    role="tablist"
    aria-label="View mode"
    style={{
      display: 'inline-flex',
      padding: 2,
      backgroundColor: C.surfaceAlt,
      borderRadius: 6,
      border: `1px solid ${C.borderSubtle}`,
    }}
  >
    {[
      { v: 'table' as const, label: 'List', Icon: List },
      { v: 'kanban' as const, label: 'Board', Icon: LayoutGrid },
    ].map(({ v, label, Icon }) => {
      const active = value === v
      return (
        <button
          key={v}
          role="tab"
          aria-selected={active}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 32,
            minHeight: 28,
            padding: '0 8px',
            border: 'none',
            backgroundColor: active ? '#fff' : 'transparent',
            color: active ? C.ink : C.ink2,
            borderRadius: 4,
            cursor: 'pointer',
            boxShadow: active ? '0 1px 1px rgba(0,0,0,0.03)' : 'none',
          }}
        >
          <Icon size={14} />
        </button>
      )
    })}
  </div>
)

const PrimaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      minHeight: 32,
      backgroundColor: C.brandOrange,
      color: '#fff',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
      fontFamily: FONT,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '-0.005em',
    }}
  >
    {children}
  </button>
)

const SecondaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      minHeight: 30,
      backgroundColor: '#fff',
      color: C.ink,
      border: `1px solid ${C.border}`,
      borderRadius: 4,
      cursor: 'pointer',
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '-0.005em',
    }}
  >
    {children}
  </button>
)

const EmptyState: React.FC<{ title: string; body: string; actions?: React.ReactNode }> = ({ title, body, actions }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      height: '60vh',
      padding: 32,
      gap: 8,
      fontFamily: FONT,
      color: C.ink2,
      textAlign: 'center',
    }}
  >
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.ink }}>{title}</h2>
    <p style={{ margin: 0, fontSize: 13, color: C.ink3, maxWidth: 360 }}>{body}</p>
    {actions && (
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>{actions}</div>
    )}
  </div>
)

const SkeletonRows: React.FC = () => {
  const rows = Array.from({ length: 8 })
  return (
    <div style={{ padding: 16, fontFamily: FONT }}>
      {rows.map((_, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 160px 120px 100px 100px 130px 110px 80px',
            gap: 12,
            alignItems: 'center',
            padding: '10px 8px',
            borderBottom: `1px solid ${C.borderSubtle}`,
          }}
        >
          {Array.from({ length: 9 }).map((__, j) => (
            <div
              key={j}
              style={{
                height: 12,
                width: j === 1 ? '70%' : '60%',
                backgroundColor: C.surfaceAlt,
                borderRadius: 3,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Boundary ────────────────────────────────────────────────────────────────

const Submittals: React.FC = () => (
  <ErrorBoundary message="Submittals could not be displayed. Check your connection and try again.">
    <SubmittalsPage />
  </ErrorBoundary>
)

export { Submittals }
export default Submittals
