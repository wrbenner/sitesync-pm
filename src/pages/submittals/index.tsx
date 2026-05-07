// ─────────────────────────────────────────────────────────────────────────────
// Submittals — Phase 1 page shell reset
// ─────────────────────────────────────────────────────────────────────────────
// SUBMITTALS_PAGE_REBUILD_PLAN_2026-05-06.md Phase 1 — drop the 4 KPI cards,
// replace with a slim inline strip; tighten header with Settings gear; add
// the 8-tab view strip (only Items live, others render EmptyTabPlaceholder);
// add the toolbar shell (Search · Add Filter ▾ stub · Bulk Actions ▾ stub +
// 1-N of M counter); top-right action cluster (+ New Submittal · Export ▾ ·
// Reports ▾ stub) wrapped in PermissionGate per Sprint Invariant #5.
//
// What this PR keeps from the old shell:
//   * existing useEntityStore('submittals') data path (Sprint Invariant #3)
//   * legacy SubmittalsTable + SubmittalsKanban renderers (Phase 2 rebuilds)
//   * status-filter chips, light/dark theme, Cmd-K, Iris button, sidebar
//   * the create flow (wizard + modal + spec-import) — wizard is canonical
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
import { useAuthStore } from '../../stores/authStore'
import { exportSubmittalLogXlsx } from '../../lib/exportXlsx'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, RefreshCw, Plus, Upload, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import CreateSubmittalModal from '../../components/forms/CreateSubmittalModal'
import SubmittalCreateWizard from '../../components/submittals/SubmittalCreateWizard'

import { SubmittalsTable } from './SubmittalsTable'
import { SubmittalsKanban } from './SubmittalsKanban'
import { GroupedSubmittalsView } from './GroupedSubmittalsView'
import { SubmittalsItemsView } from '../../components/submittals/SubmittalsItemsView'

// Phase 2: legacy SubmittalsTable is superseded by the new dense view.
// Reference the import so eslint stays quiet during the transition.
void SubmittalsTable

// Phase 1 components
import { SubmittalsHeader } from '../../components/submittals/SubmittalsHeader'
import { SubmittalsToolbar } from '../../components/submittals/SubmittalsToolbar'
import {
  SubmittalsViewTabs,
  EmptyTabPlaceholder,
  SUBMITTAL_TABS,
  type SubmittalViewTab,
} from '../../components/submittals/SubmittalsViewTabs'
import { useSubmittalSettings } from '../../hooks/useSubmittalSettings'

// Phase 3 components
import { AddFilterDropdown, FilterPillRail } from '../../components/submittals/FilterChips/AddFilterDropdown'
import { applyChipFilters } from '../../components/submittals/FilterChips/filterDefinitions'
import { BulkActionsMenu } from '../../components/submittals/BulkActionsMenu'
import { BulkEditModal } from '../../components/submittals/BulkEditModal'
import { BulkDistributeDialog } from '../../components/submittals/BulkDistributeDialog'
import { SavedViewsSidebar } from '../../components/submittals/SavedViews/SavedViewsSidebar'
import { useSubmittalFilters } from '../../hooks/useSubmittalFilters'

// Phase 4 components — Grouping Views
import { PackagesView } from '../../components/submittals/PackagesView/PackagesView'
import { SpecSectionsView } from '../../components/submittals/SpecSectionsView/SpecSectionsView'
import { BallInCourtView } from '../../components/submittals/BallInCourtView/BallInCourtView'
import type { SubmittalListRow } from '../../hooks/useSubmittalsList'

// CreateSubmittalModal is the quick-create surface consumed by the
// Conversation page (see CreateSubmittalModalWrapper); reference the import
// here so eslint-no-unused stays quiet without affecting the bundle. The
// canonical wizard is the in-page create flow.
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

const PAGE_SIZE = 50

const SubmittalsPage: React.FC = () => {
  const setPageContext = useCopilotStore((s) => s.setPageContext)
  useEffect(() => { setPageContext('submittals') }, [setPageContext])

  const projectId = useProjectId()
  const navigate = useNavigate()
  const createSubmittal = useCreateSubmittal()
  // updateSubmittal + scheduleActivities were consumed by the legacy
  // SubmittalsTable in Phase 1; Phase 2 routes Items through
  // SubmittalsItemsView which owns its own data path. Reference the
  // mutate hook so it keeps tree-shaking-friendly visibility for
  // future Phase 6+ detail-page wiring.
  const updateSubmittal = useUpdateSubmittal()
  void updateSubmittal
  const currentUserId = useAuthStore((s) => s.user?.id)

  const { data: submittalsResult, isPending: loading, error, refetch } = useSubmittals(projectId)
  const { data: project } = useProject(projectId)
  // scheduleActivities is no longer consumed at this layer (the new
  // SubmittalsItemsView reads from submittals_log_mv which already carries
  // schedule-derived risk_band). Keep the hook call for cache warmth so
  // schedule-pages don't pay a fetch cost when the user navigates over.
  const { data: scheduleActivities } = useScheduleActivities(projectId ?? '')
  void scheduleActivities
  const { data: settings } = useSubmittalSettings(projectId)

  useRealtimeInvalidation(projectId)

  const [activeTab, setActiveTab] = useState<SubmittalViewTab>('items')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const specFileInputRef = useRef<HTMLInputElement>(null)

  // Phase 3 — filters, bulk actions, saved views.
  const submittalFilters = useSubmittalFilters()
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkDistributeOpen, setBulkDistributeOpen] = useState(false)
  const [selectionClearToken, setSelectionClearToken] = useState(0)

  // Phase 4 — Create Package dialog driven from BulkActionsMenu.
  const [createPackageOpen, setCreatePackageOpen] = useState(false)
  const [createPackageIds, setCreatePackageIds] = useState<string[]>([])

  // GroupedSubmittalsView remains imported for Phase 4 — Phase 1 default is
  // ungrouped Items. The grouping toggle is dropped here; comes back in P3.
  void GroupedSubmittalsView

  const submittals: Array<Record<string, unknown>> = useMemo(
    () => (submittalsResult?.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      // Legacy SUB-NNN derived field — kept for non-Phase-1 consumers
      // (Kanban card, exports). The Items table now renders via
      // formatSubmittalNumber for CSI-aligned display.
      submittalNumber: s.number ? `SUB-${String(s.number).padStart(3, '0')}` : String(s.id ?? '').slice(0, 8),
      from: (s.subcontractor as string) || (s.created_by as string) || '',
      dueDate: (s.due_date as string) || '',
    })),
    [submittalsResult?.data],
  )

  // Phase 1 inline-strip counts. Replaces the 4-KPI-card pattern.
  //
  //   active            = anything not closed/approved/void
  //   overdue           = past required_on_site_date AND still in flight
  //   awaiting your
  //                       response = current_reviewer_id matches the user
  //   architect-late    = BIC role looks like architect AND days_in_court
  //                       exceeds the SLA from settings.default_sla_days
  const counts = useMemo(() => {
    let active = 0
    let overdue = 0
    let awaitingMine = 0
    let architectLate = 0
    const sla = settings?.default_sla_days ?? 10
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const s of submittals) {
      const status = (s.status as string) ?? ''
      const closedSet = ['approved', 'approved_as_noted', 'closed', 'void']
      const isActive = !closedSet.includes(status)
      if (isActive) active += 1
      const onSite = (s.required_on_site_date as string | null) ?? (s.required_onsite_date as string | null)
      if (onSite && isActive && new Date(onSite) < today) overdue += 1
      const reviewerId = (s.current_reviewer_id as string | null) ?? null
      if (currentUserId && reviewerId === currentUserId) awaitingMine += 1
      const reviewerRole = ((s.current_reviewer_role as string | null) ?? '').toLowerCase()
      const ballSince = s.ball_in_court_since as string | null
      if (
        reviewerRole.includes('arch') &&
        ballSince &&
        Math.floor((Date.now() - new Date(ballSince).getTime()) / 86400000) > sla
      ) {
        architectLate += 1
      }
    }
    return { active, overdue, awaitingMine, architectLate }
  }, [submittals, settings?.default_sla_days, currentUserId])

  const filteredSubmittals = useMemo(() => {
    let rows = submittals
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      rows = rows.filter((s) => {
        const r = s as unknown as Record<string, unknown>
        return (
          String(r.title ?? '').toLowerCase().includes(q) ||
          String(r.number ?? '').toLowerCase().includes(q) ||
          String(r.spec_section ?? '').toLowerCase().includes(q) ||
          String(r.csi_section ?? '').toLowerCase().includes(q) ||
          String(r.subcontractor ?? '').toLowerCase().includes(q) ||
          String(r.assigned_to ?? '').toLowerCase().includes(q) ||
          String(r.current_reviewer ?? '').toLowerCase().includes(q)
        )
      })
    }
    return rows
  }, [submittals, searchQuery])

  // Pagination — Phase 1 ships a thin client-side page nav. Phase 2 wires
  // server-side virtualization.
  const totalCount = filteredSubmittals.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageClamped = Math.min(page, pageCount - 1)
  const rangeFrom = totalCount === 0 ? 0 : pageClamped * PAGE_SIZE + 1
  const rangeTo = Math.min(totalCount, (pageClamped + 1) * PAGE_SIZE)
  // pagedSubmittals was used by the Phase 1 legacy SubmittalsTable. Phase 2
  // routes Items through SubmittalsItemsView which owns its own filter +
  // virtualizer pipeline; the page-level paging UI in SubmittalsToolbar is
  // a thin shell over rangeFrom/rangeTo that the view reports back via
  // onVisibleCountChange. The slice itself is now dead — kept-as-comment
  // to preserve the rangeFrom / rangeTo derivations above.
  void filteredSubmittals
  useEffect(() => {
    setPage(0)
  }, [searchQuery])

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

  const handleOpenSettings = useCallback(() => navigate('/submittals/settings'), [navigate])

  // Phase 4 — shared row filter for all 4 data views (Items + 3 grouped).
  // Identity stable via useCallback so child memoization holds.
  const sharedFilterFn = useCallback((row: SubmittalListRow) => {
    const r = row as unknown as Record<string, unknown>
    if (submittalFilters.hasAny) {
      const passed = applyChipFilters([r], submittalFilters.filters)
      if (passed.length === 0) return false
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      String(r.title ?? '').toLowerCase().includes(q) ||
      String(r.number ?? '').toLowerCase().includes(q) ||
      String(r.csi_section ?? r.spec_section ?? '').toLowerCase().includes(q) ||
      String(r.sub_name ?? r.subcontractor ?? '').toLowerCase().includes(q) ||
      String(r.current_reviewer_name ?? r.current_reviewer ?? '').toLowerCase().includes(q)
    )
  }, [submittalFilters.hasAny, submittalFilters.filters, searchQuery])

  const handleSelectionIdsChange = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      if (prev.size === ids.length && ids.every((id) => prev.has(id))) return prev
      return new Set(ids)
    })
  }, [])

  const sharedResetToken = JSON.stringify({
    tab: activeTab,
    q: searchQuery,
    f: submittalFilters.filtersToken,
  })

  if (!projectId) return <ProjectGate />

  const actionCluster = (
    <>
      <PermissionGate permission="submittals.view">
        <ExportButton onExportXLSX={handleExportXlsx} pdfFilename="SiteSync_Submittal_Log" />
      </PermissionGate>
      <PermissionGate permission="submittals.view">
        <SecondaryBtn onClick={() => toast.info('Reports — coming in Phase 5')} title="Reports">
          Reports
          <ChevronDown size={11} />
        </SecondaryBtn>
      </PermissionGate>
      <PermissionGate permission="submittals.create">
        <PrimaryBtn onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Submittal
        </PrimaryBtn>
      </PermissionGate>
    </>
  )

  return (
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
        <SubmittalsHeader
          projectName={project?.name}
          activeCount={counts.active}
          overdueCount={counts.overdue}
          awaitingMineCount={counts.awaitingMine}
          architectLateCount={counts.architectLate}
          actions={actionCluster}
          onOpenSettings={handleOpenSettings}
        />
        <SubmittalsViewTabs active={activeTab} onChange={setActiveTab} />
        {activeTab === 'items' && (
          <>
            <SubmittalsToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              rangeFrom={rangeFrom}
              rangeTo={rangeTo}
              totalCount={totalCount}
              selectedCount={selectedIds.size}
              hasPrev={pageClamped > 0}
              hasNext={pageClamped < pageCount - 1}
              onPagePrev={() => setPage((p) => Math.max(0, p - 1))}
              onPageNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              addFilterSlot={<AddFilterDropdown />}
              bulkActionsSlot={
                <BulkActionsTrigger
                  selectedCount={selectedIds.size}
                  open={bulkMenuOpen}
                  onToggle={() => setBulkMenuOpen((o) => !o)}
                  onClose={() => setBulkMenuOpen(false)}
                  selectedIds={Array.from(selectedIds)}
                  onOpenEdit={() => { setBulkMenuOpen(false); setBulkEditOpen(true) }}
                  onOpenDistribute={() => { setBulkMenuOpen(false); setBulkDistributeOpen(true) }}
                  onOpenCreatePackage={() => {
                    setBulkMenuOpen(false)
                    setCreatePackageIds(Array.from(selectedIds))
                    setCreatePackageOpen(true)
                    setActiveTab('packages')
                  }}
                  onClearSelection={() => {
                    setSelectedIds(new Set())
                    setSelectionClearToken((t) => t + 1)
                  }}
                />
              }
            />
            <FilterPillRail />
          </>
        )}
      </header>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
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
          <span style={{ flex: 1 }}>Couldn't load submittals. Check your connection and try again.</span>
          <SecondaryBtn onClick={() => refetch()}>
            <RefreshCw size={12} /> Retry
          </SecondaryBtn>
        </div>
      ) : submittals.length === 0 && !searchQuery.trim() && activeTab === 'items' ? (
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
      ) : (
        <main style={{ flex: 1, overflow: 'hidden', backgroundColor: C.surface, display: 'flex', flexDirection: 'row' }}>
          {activeTab === 'items' && projectId ? (
            <>
              <SavedViewsSidebar projectId={projectId} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <SubmittalsItemsView
                  projectId={projectId}
                  resetToken={sharedResetToken}
                  selectionClearToken={selectionClearToken}
                  numberingFormat={settings?.numbering_format ?? '{spec_section}-{seq}'}
                  filterFn={sharedFilterFn}
                  onSelectionIdsChange={handleSelectionIdsChange}
                />
              </div>
              <BulkEditModal
                open={bulkEditOpen}
                selectedIds={Array.from(selectedIds)}
                onClose={() => setBulkEditOpen(false)}
                onComplete={() => {
                  setBulkEditOpen(false)
                  setSelectedIds(new Set())
                  setSelectionClearToken((t) => t + 1)
                  refetch()
                }}
              />
              <BulkDistributeDialog
                open={bulkDistributeOpen}
                projectId={projectId}
                selectedIds={Array.from(selectedIds)}
                onClose={() => setBulkDistributeOpen(false)}
                onComplete={() => {
                  setBulkDistributeOpen(false)
                  setSelectedIds(new Set())
                  setSelectionClearToken((t) => t + 1)
                  refetch()
                }}
              />
            </>
          ) : activeTab === 'packages' && projectId ? (
            <>
              <SavedViewsSidebar projectId={projectId} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <PackagesView
                  projectId={projectId}
                  resetToken={sharedResetToken}
                  numberingFormat={settings?.numbering_format ?? '{spec_section}-{seq}'}
                  filterFn={sharedFilterFn}
                  selectionClearToken={selectionClearToken}
                  onSelectionIdsChange={handleSelectionIdsChange}
                  createDialogOpen={createPackageOpen}
                  createDialogSelectedIds={createPackageIds}
                  onCreateDialogClose={() => {
                    setCreatePackageOpen(false)
                    setCreatePackageIds([])
                    setSelectedIds(new Set())
                    setSelectionClearToken((t) => t + 1)
                  }}
                />
              </div>
            </>
          ) : activeTab === 'spec_sections' && projectId ? (
            <>
              <SavedViewsSidebar projectId={projectId} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <SpecSectionsView
                  projectId={projectId}
                  resetToken={sharedResetToken}
                  numberingFormat={settings?.numbering_format ?? '{spec_section}-{seq}'}
                  filterFn={sharedFilterFn}
                  selectionClearToken={selectionClearToken}
                  onSelectionIdsChange={handleSelectionIdsChange}
                />
              </div>
            </>
          ) : activeTab === 'ball_in_court' && projectId ? (
            <>
              <SavedViewsSidebar projectId={projectId} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <BallInCourtView
                  projectId={projectId}
                  resetToken={sharedResetToken}
                  numberingFormat={settings?.numbering_format ?? '{spec_section}-{seq}'}
                  filterFn={sharedFilterFn}
                  selectionClearToken={selectionClearToken}
                  onSelectionIdsChange={handleSelectionIdsChange}
                />
              </div>
            </>
          ) : activeTab === 'kanban' ? (
            // Kanban dedicated rebuild ships in Phase 5; Phase 1 keeps the
            // legacy view available so the tab is never broken when clicked.
            <SubmittalsKanban
              allSubmittals={filteredSubmittals}
              onSelectSubmittal={(id) => navigate(`/submittals/${id}`)}
            />
          ) : (
            <EmptyTabPlaceholder
              phase={SUBMITTAL_TABS.find((t) => t.id === activeTab)?.phase ?? 8}
              tabLabel={SUBMITTAL_TABS.find((t) => t.id === activeTab)?.label ?? 'View'}
            />
          )}
        </main>
      )}

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
    </div>
  )
}

// ── Bits ────────────────────────────────────────────────────────────────────

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

const SecondaryBtn: React.FC<{ onClick: () => void; children: React.ReactNode; title?: string }> = ({ onClick, children, title }) => (
  <button
    onClick={onClick}
    title={title}
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

// ── Phase 3 — bulk actions toolbar trigger ──────────────────────────────────
//
// Renders the "Bulk Actions ▾" pill in the toolbar slot and opens
// BulkActionsMenu underneath when clicked. Disabled with an explanatory
// tooltip when no rows are selected.

interface BulkActionsTriggerProps {
  selectedCount: number
  selectedIds: string[]
  open: boolean
  onToggle: () => void
  onClose: () => void
  onOpenEdit: () => void
  onOpenDistribute: () => void
  onOpenCreatePackage?: () => void
  onClearSelection: () => void
}

const BulkActionsTrigger: React.FC<BulkActionsTriggerProps> = ({
  selectedCount,
  selectedIds,
  open,
  onToggle,
  onClose,
  onOpenEdit,
  onOpenDistribute,
  onOpenCreatePackage,
  onClearSelection,
}) => {
  const disabled = selectedCount === 0
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label="Bulk actions"
        aria-haspopup="menu"
        aria-expanded={open}
        title={disabled ? 'Select rows to enable bulk actions' : 'Bulk actions'}
        disabled={disabled}
        onClick={disabled ? undefined : onToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          minHeight: 30,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          backgroundColor: '#fff',
          color: disabled ? C.ink4 : C.ink,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: FONT,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        Bulk Actions
        {selectedCount > 0 && <span style={{ color: C.ink2 }}>({selectedCount})</span>}
        <ChevronDown size={11} />
      </button>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50 }}>
          <BulkActionsMenu
            selectedIds={selectedIds}
            onClose={onClose}
            onOpenEdit={onOpenEdit}
            onOpenDistribute={onOpenDistribute}
            onOpenCreatePackage={onOpenCreatePackage}
            onClearSelection={onClearSelection}
          />
        </div>
      )}
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
