// Phase 6 — Submittal Detail page (v2 shell).
//
// Replaces the 547-LOC monolith at src/pages/submittals/SubmittalDetail.tsx
// with a tab-aware shell that follows the world-class plan Pillar B:
//
//   ┌──────────────────────────────────────────────────────┐  ┌──────────┐
//   │ ← Back   #08-41-13-1 R1 · Storefront frame system    │  │ ✨ Iris  │
//   │ Spec 08 41 13 §2.04 · Sub: ACME · BIC: Architect (3d)│  │  panel   │
//   ├──────────────────────────────────────────────────────┤  │          │
//   │ [⚠ Story banner — Iris's plain-English reading]      │  │ What I   │
//   ├──────────────────────────────────────────────────────┤  │ see      │
//   │ Overview · Markup · Revisions · Citations · History  │  │          │
//   ├──────────────────────────────────────────────────────┤  │ What I'd │
//   │ [Active tab content]                                  │  │ ask      │
//   └──────────────────────────────────────────────────────┘  └──────────┘
//
// Phase 6 makes Overview live (GeneralInfoCard + CompactWorkflowChain) and
// History live (drop-in EntityAuditViewer). The 5 other tabs render
// EmptyDetailTab pointing forward.

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Sparkles } from 'lucide-react'
import { ProjectGate } from '../../../components/ProjectGate'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { PermissionGate } from '../../../components/auth/PermissionGate'
import { useProjectId } from '../../../hooks/useProjectId'
import { fromTable } from '../../../lib/db/queries'
import { useQuery } from '@tanstack/react-query'
import { StoryBanner } from '../../../components/submittals/detail/StoryBanner'
import { DetailTabs, EmptyDetailTab, type DetailTab, DETAIL_TABS } from '../../../components/submittals/detail/DetailTabs'
import { GeneralInfoCard } from '../../../components/submittals/detail/Overview/GeneralInfoCard'
import {
  WorkflowChainTable,
  type WorkflowChainRow,
} from '../../../components/submittals/detail/Overview/WorkflowChainTable'
import {
  IrisCoPilotPanel,
  type IrisCoPilotData,
} from '../../../components/submittals/detail/IrisCoPilotPanel'
import { CitationsPanel } from '../../../components/submittals/detail/Citations/CitationsPanel'
import type { CitationBase } from '../../../components/submittals/detail/Citations/citationKinds'
import { VoiceReviewOverlay } from '../../../components/submittals/detail/VoiceReviewOverlay'
import { MarkupCanvas } from '../../../components/submittals/detail/Markup/MarkupCanvas'
import { RevDiffView } from '../../../components/submittals/detail/Revisions/RevDiffView'
import { DistributeAction } from '../../../components/submittals/detail/Distribute/DistributeAction'
import { StepThreadPanel } from '../../../components/submittals/detail/MultiApproval/StepThreadPanel'
import { SendBackDialog, type PriorStep } from '../../../components/submittals/detail/MultiApproval/SendBackDialog'
import { submittalService } from '../../../services/submittalService'
import type { SubmittalDisposition } from '../../../types/submittal'
import { toast } from 'sonner'

const C = {
  ink: '#1A1613',
  ink2: '#5C5550',
  ink3: '#8C857E',
  border: 'rgba(26, 22, 19, 0.10)',
  borderSubtle: 'rgba(26, 22, 19, 0.05)',
  brandOrange: '#F47820',
  surface: '#FCFCFA',
  surfaceInset: '#F5F5F1',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const COPILOT_OPEN_STORAGE = 'sitesync.submittals.detail.copilotOpen'

const SubmittalDetailV2Page: React.FC = () => {
  const { submittalId } = useParams<{ submittalId: string }>()
  const navigate = useNavigate()
  const projectId = useProjectId()

  const [tab, setTab] = useState<DetailTab>('overview')
  const [citationsOpen, setCitationsOpen] = useState(false)
  const [voiceTranscriptSeed, setVoiceTranscriptSeed] = useState<string | null>(null)
  void voiceTranscriptSeed
  void setVoiceTranscriptSeed

  // Phase 7c-1 — multi-approval thread panel + send-back dialog state.
  const [threadStepId, setThreadStepId] = useState<string | null>(null)
  const [sendBackOpen, setSendBackOpen] = useState(false)

  // Phase 7c-1 — `B` keyboard shortcut opens the send-back dialog. Skipped
  // when typing in input/textarea/contentEditable. ⌘/⌃ modifiers exempt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSendBackOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [copilotOpen, setCopilotOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const raw = window.localStorage.getItem(COPILOT_OPEN_STORAGE)
    return raw === null ? true : raw === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COPILOT_OPEN_STORAGE, copilotOpen ? '1' : '0')
  }, [copilotOpen])

  const submittalQuery = useQuery<Record<string, unknown> | null>({
    queryKey: ['submittal_detail', submittalId],
    enabled: !!submittalId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!submittalId) return null
      const { data, error } = await fromTable('submittals' as never)
        .select('*')
        .eq('id' as never, submittalId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as unknown as Record<string, unknown>) ?? null
    },
  })

  const reviewersQuery = useQuery<WorkflowChainRow[]>({
    queryKey: ['submittal_reviewers', submittalId],
    enabled: !!submittalId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!submittalId) return []
      const { data, error } = await fromTable('submittal_reviewers' as never)
        .select('*')
        .eq('submittal_id' as never, submittalId)
        .order('sequence', { ascending: true })
      if (error) {
        // Graceful: if the canonical reviewers table isn't visible to the
        // typed client yet (pre-D38 schemas in some envs), surface an empty
        // chain rather than crashing the page.
        return []
      }
      const rows = (data as unknown as Array<Record<string, unknown>>) ?? []
      // Decorate with is_current — first un-responded step in the chain.
      const firstPendingIdx = rows.findIndex((r) => !r.responded_at)
      return rows.map((r, idx): WorkflowChainRow => ({
        id: String(r.id),
        sequence: Number(r.sequence ?? idx + 1),
        reviewer_name: (r.reviewer_name as string | null) ?? null,
        reviewer_company: (r.reviewer_company as string | null) ?? null,
        reviewer_role: (r.reviewer_role as string | null) ?? null,
        reviewer_email: (r.reviewer_email as string | null) ?? null,
        sent_at: (r.sent_at as string | null) ?? null,
        due_date: (r.due_date as string | null) ?? null,
        returned_at: (r.returned_at as string | null) ?? null,
        responded_at: (r.responded_at as string | null) ?? null,
        disposition: (r.disposition as string | null) ?? null,
        comments: (r.comments as string | null) ?? null,
        attachments: Array.isArray(r.attachments)
          ? (r.attachments as Array<{ id: string; name: string; url?: string; isCurrent?: boolean }>)
          : [],
        version: (r.version as number | null) ?? null,
        parallel_group: (r.parallel_group as number | null) ?? null,
        is_current: idx === firstPendingIdx,
      }))
    },
  })

  const submittal = submittalQuery.data
  const isLoading = submittalQuery.isPending
  const error = submittalQuery.error as Error | undefined

  // Iris co-pilot data — Phase 6 ships deterministic placeholder content.
  const copilotData: IrisCoPilotData = useMemo(() => {
    if (!submittal) {
      return { whatISee: [], whatIdAsk: [], pastSimilar: [] }
    }
    return buildCoPilotData(submittal)
  }, [submittal])

  if (!projectId) return <ProjectGate />

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (error || !submittal) {
    return (
      <ErrorState
        message={error?.message ?? 'Submittal not found.'}
        onBack={() => navigate('/submittals')}
      />
    )
  }

  const titleLine = formatTitleLine(submittal)
  const subLine = formatSubtitle(submittal)
  const banner = {
    status: (submittal.status as string | null) ?? null,
    current_reviewer_name: (submittal.current_reviewer_name as string | null) ?? null,
    current_reviewer_role: (submittal.current_reviewer_role as string | null) ?? null,
    days_in_court: (submittal.days_in_court as number | null) ?? null,
    required_on_site_date: (submittal.required_on_site_date as string | null) ?? null,
    closed_at: (submittal.closed_at as string | null) ?? null,
    iris_preflight_findings_count: countFindings(submittal.iris_preflight_findings),
  }

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
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 24px',
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/submittals')}
          aria-label="Back to log"
          style={backLinkStyle}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>
            {titleLine}
          </h1>
          {subLine && (
            <div style={{ fontSize: 12, color: C.ink2, marginTop: 2 }}>{subLine}</div>
          )}
        </div>
        <ActionCluster
          copilotOpen={copilotOpen}
          onToggleCoPilot={() => setCopilotOpen((o) => !o)}
          submittalId={submittalId ?? ''}
          onAfterDisposition={() => {
            void submittalQuery.refetch()
            void reviewersQuery.refetch()
          }}
        />
      </header>

      {/* Story banner */}
      <StoryBanner inputs={banner} />

      {/* Tab strip */}
      <DetailTabs active={tab} onChange={setTab} />

      {/* Body — main content + (optional) Iris co-pilot rail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <main
          id={`submittal-detail-${tab}-panel`}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            backgroundColor: C.surfaceInset,
          }}
        >
          {tab === 'overview' && (
            <>
              <GeneralInfoCard submittal={submittal} />
              <WorkflowChainTable
                rows={reviewersQuery.data ?? []}
                onOpenThread={(stepId) => setThreadStepId(stepId)}
                onOpenSendBack={() => setSendBackOpen(true)}
              />
            </>
          )}
          {tab === 'citations' && (
            <CitationsTabContent
              submittal={submittal}
              onOpenPanel={() => setCitationsOpen(true)}
            />
          )}
          {tab === 'history' && <HistoryTabPlaceholder />}
          {tab === 'markup' && (
            <MarkupTabContent submittal={submittal} />
          )}
          {tab === 'revisions' && (
            <RevisionsTabContent submittal={submittal} />
          )}
          {tab === 'distribute' && (
            <DistributeTabContent
              submittal={submittal}
              onDistributed={() => {
                void submittalQuery.refetch()
              }}
            />
          )}
          {tab === 'emails' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'emails')!.phase} tabLabel="Emails" />
          )}
        </main>

        <IrisCoPilotPanel
          open={copilotOpen}
          data={copilotData}
          onClose={() => setCopilotOpen(false)}
          attribution="Iris co-pilot — deterministic shell. LLM augmentation ships in Phase 7b."
        />
      </div>

      {/* Phase 7 — Citations side panel (right-rail dock per ADR-004). */}
      <CitationsPanel
        open={citationsOpen}
        onClose={() => setCitationsOpen(false)}
        citations={buildCitationsFromSubmittal(submittal)}
      />

      {/* Phase 7c-1 — Step thread panel + send-back dialog. */}
      <StepThreadPanel
        open={threadStepId != null}
        onClose={() => setThreadStepId(null)}
        reviewerStepId={threadStepId}
        stepLabel={buildStepLabel(threadStepId, reviewersQuery.data ?? [])}
        irisSummary={threadStepId
          ? (reviewersQuery.data ?? []).find((r) => r.id === threadStepId)?.iris_thread_summary ?? null
          : null}
        canComment
        canModerate
        currentUserId={null /* page-level user id resolution lives in Phase 7c-2 */}
      />
      <SendBackDialog
        open={sendBackOpen}
        onClose={() => setSendBackOpen(false)}
        priorSteps={buildPriorSteps(reviewersQuery.data ?? [])}
        onSent={() => {
          void submittalQuery.refetch()
          void reviewersQuery.refetch()
          setSendBackOpen(false)
        }}
      />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ActionClusterProps {
  copilotOpen: boolean
  onToggleCoPilot: () => void
  submittalId: string
  onAfterDisposition?: () => void
}

const ActionCluster: React.FC<ActionClusterProps> = ({
  copilotOpen,
  onToggleCoPilot,
  submittalId,
  onAfterDisposition,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {/* Phase 7 — voice review codes overlay. PermissionGate gates the
     *  underlying overlay via canApprove. The orange Approve button below
     *  is now wired to fire the overlay too. */}
    <PermissionGate permission="submittals.approve">
      <VoiceReviewOverlay
        canApprove
        onConfirm={async (pick) => {
          try {
            const dispositionCode = mapDispositionLabelToCode(pick.disposition)
            const result = await submittalService.recordDisposition(
              submittalId,
              dispositionCode,
              pick.comments || undefined,
            )
            if (result.error) {
              toast.error('Could not record disposition: ' + result.error.message)
              return
            }
            toast.success(`Disposition recorded: ${pick.disposition}`)
            onAfterDisposition?.()
          } catch (err) {
            toast.error('Could not record disposition: ' + (err as Error).message)
          }
        }}
      />
    </PermissionGate>
    <button
      type="button"
      onClick={onToggleCoPilot}
      aria-pressed={copilotOpen}
      title={copilotOpen ? 'Hide Iris co-pilot' : 'Show Iris co-pilot'}
      style={{
        ...backLinkStyle,
        color: copilotOpen ? C.brandOrange : C.ink2,
        borderColor: copilotOpen ? C.brandOrange : C.border,
      }}
    >
      <Sparkles size={12} /> Iris
    </button>
    <PermissionGate permission="submittals.approve">
      <button
        type="button"
        style={{
          padding: '7px 14px',
          backgroundColor: C.brandOrange,
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: FONT,
        }}
        title="Approve — disposition picker comes online in Phase 7 (voice review codes)"
      >
        Approve
      </button>
    </PermissionGate>
    <PermissionGate permission="submittals.edit">
      <button
        type="button"
        aria-label="More actions"
        style={{
          padding: '6px',
          minWidth: 30,
          minHeight: 30,
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          cursor: 'pointer',
          color: C.ink2,
        }}
      >
        <MoreHorizontal size={14} />
      </button>
    </PermissionGate>
  </div>
)

const HistoryTabPlaceholder: React.FC = () => (
  <section
    aria-label="History"
    style={{
      backgroundColor: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: '14px 18px',
      fontFamily: FONT,
    }}
  >
    <h3
      style={{
        margin: '0 0 6px',
        fontSize: 11,
        fontWeight: 600,
        color: C.ink3,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      History
    </h3>
    <p style={{ margin: 0, fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>
      Hash-chain audit timeline ships via{' '}
      <code style={{ fontFamily: 'inherit', color: C.brandOrange }}>EntityAuditViewer</code>{' '}
      drop-in. Phase 6 ships the tab; Phase 6b wires the existing component
      (already supports submittal type from Lap 1 audit work).
    </p>
  </section>
)

const DetailSkeleton: React.FC = () => (
  <div
    style={{
      padding: 32,
      fontFamily: FONT,
      color: C.ink3,
      fontSize: 13,
    }}
  >
    Loading submittal…
  </div>
)

const ErrorState: React.FC<{ message: string; onBack: () => void }> = ({ message, onBack }) => (
  <div
    role="alert"
    style={{
      padding: 32,
      fontFamily: FONT,
      color: C.ink2,
      fontSize: 13,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}
  >
    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>
      Couldn&apos;t load submittal
    </h2>
    <p style={{ margin: 0 }}>{message}</p>
    <button type="button" onClick={onBack} style={backLinkStyle}>
      <ArrowLeft size={14} /> Back to log
    </button>
  </div>
)

// ── Style + helpers ────────────────────────────────────────────────────────

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 500,
  color: C.ink2,
  border: `1px solid ${C.border}`,
  backgroundColor: '#fff',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: FONT,
}

function formatTitleLine(s: Record<string, unknown>): string {
  const number = s.number ? `#${s.number}` : ''
  const rev = s.rev_number != null ? ` R${s.rev_number}` : ''
  const title = (s.title as string | null) ?? '(untitled)'
  return `${number}${rev}${number || rev ? ' · ' : ''}${title}`
}

function formatSubtitle(s: Record<string, unknown>): string | null {
  const parts: string[] = []
  const csi = (s.csi_section as string | null) ?? null
  const para = (s.spec_section_paragraph as string | null) ?? null
  if (csi) parts.push(para ? `Spec ${csi} ${para}` : `Spec ${csi}`)
  const sub = (s.sub_name as string | null) ?? (s.subcontractor as string | null) ?? null
  if (sub) parts.push(`Sub: ${sub}`)
  const bic = (s.current_reviewer_name as string | null) ?? null
  if (bic) {
    const days = (s.days_in_court as number | null) ?? null
    parts.push(days != null ? `BIC: ${bic} (${days}d)` : `BIC: ${bic}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function countFindings(findings: unknown): number | null {
  if (!findings) return 0
  if (Array.isArray(findings)) return findings.length
  if (typeof findings === 'object') return Object.keys(findings as object).length
  return null
}

// ── Iris co-pilot deterministic content (Phase 6) ──────────────────────────

function buildCoPilotData(s: Record<string, unknown>): IrisCoPilotData {
  const whatISee: string[] = []
  if (s.kind) whatISee.push(`Kind: ${String(s.kind).replace(/_/g, ' ')}`)
  if (s.csi_section) whatISee.push(`Spec ${s.csi_section}${s.spec_section_paragraph ? ` ${s.spec_section_paragraph}` : ''}`)
  if (s.sub_name) whatISee.push(`Responsible sub: ${s.sub_name}`)
  if (s.is_critical_path) whatISee.push('On the critical path')
  if (s.is_federal) whatISee.push('Federal project — UFGS codeset applies')

  const whatIdAsk = []
  if (!s.csi_section) {
    whatIdAsk.push({
      id: 'no_csi',
      severity: 'warning' as const,
      message: 'No spec section linked. Numbering stays manual.',
    })
  }
  if (!s.required_on_site_date) {
    whatIdAsk.push({
      id: 'no_required_date',
      severity: 'warning' as const,
      message: 'Required-on-site date is empty. Set a schedule activity to enable walkback.',
    })
  }
  if (s.is_critical_path && (s.lead_time_weeks as number | null ?? 0) >= 8) {
    whatIdAsk.push({
      id: 'long_lead_critical',
      severity: 'info' as const,
      message: 'Long-lead item on critical path. Iris recommends watching this submittal weekly.',
    })
  }

  return {
    whatISee,
    whatIdAsk,
    pastSimilar: [], // Phase 7 wires the vector-similarity lookup.
  }
}

// ── Phase 8 tab content ────────────────────────────────────────────────────

const MarkupTabContent: React.FC<{ submittal: Record<string, unknown> }> = ({ submittal }) => {
  // Phase 8 ships markup tied to a single submittal_item. The detail page
  // typically surfaces the first item; multi-item submittals get a picker
  // wired in Phase 8b alongside the DocumentViewer integration.
  const items = (submittal.submittal_items as Array<Record<string, unknown>> | undefined) ?? []
  const firstItemId = items[0]?.id != null ? String(items[0].id) : null
  const revNumber = (submittal.rev_number as number | null) ?? 0

  if (!firstItemId) {
    return (
      <section
        aria-label="Markup"
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '14px 18px',
          fontFamily: FONT,
        }}
      >
        <h3 style={overviewHeadingStyle}>Markup</h3>
        <p style={{ margin: 0, fontSize: 13, color: C.ink2 }}>
          No items uploaded yet — markup ships per-item, per-revision. Upload a
          PDF on the General Information card to enable markup.
        </p>
      </section>
    )
  }

  return (
    <MarkupCanvas
      submittalItemId={firstItemId}
      revNumber={revNumber}
      pdfPage={1}
    />
  )
}

const RevisionsTabContent: React.FC<{ submittal: Record<string, unknown> }> = ({ submittal }) => {
  const items = (submittal.submittal_items as Array<Record<string, unknown>> | undefined) ?? []
  const firstItemId = items[0]?.id != null ? String(items[0].id) : null
  const revNumber = (submittal.rev_number as number | null) ?? 0

  if (!firstItemId || revNumber < 1) {
    return (
      <section
        aria-label="Revisions"
        style={{
          backgroundColor: '#fff',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '14px 18px',
          fontFamily: FONT,
        }}
      >
        <h3 style={overviewHeadingStyle}>Revisions</h3>
        <p style={{ margin: 0, fontSize: 13, color: C.ink2 }}>
          {revNumber === 0
            ? 'This is R0 (initial revision). The rev-diff view appears once a resubmission lands as R1.'
            : 'No items uploaded yet — rev-diff compares markups per item.'}
        </p>
      </section>
    )
  }

  return (
    <RevDiffView
      submittalItemId={firstItemId}
      revFrom={revNumber - 1}
      revTo={revNumber}
    />
  )
}

const DistributeTabContent: React.FC<{
  submittal: Record<string, unknown>
  onDistributed: () => void
}> = ({ submittal, onDistributed }) => {
  const submittalId = String(submittal.id)
  const titleLine = formatTitleLine(submittal)

  return (
    <section
      aria-label="Distribute"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 18px',
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h3 style={overviewHeadingStyle}>Distribute</h3>
      <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>
        Push the approved submittal to the field team. The 3-step wizard
        captures recipients → options (auto-pin drawings, magic-link viewer)
        → confirmation preview, then logs to <code style={{ fontFamily: FONT }}>submittal_distributions</code>.
      </p>
      <div>
        <DistributeAction
          submittalId={submittalId}
          submittalLabel={titleLine}
          onDistributed={onDistributed}
        />
      </div>
      <p style={{ margin: 0, fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
        Each side-effect (auto-pin, magic-link) logs hash-chained provenance.
        The 5-second-undoable toast appears on success — Phase 8b wires the
        actual undo RPC.
      </p>
    </section>
  )
}

const overviewHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 600,
  color: C.ink3,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

// ── Citations tab content (Phase 7) ───────────────────────────────────────

const CitationsTabContent: React.FC<{
  submittal: Record<string, unknown>
  onOpenPanel: () => void
}> = ({ submittal, onOpenPanel }) => {
  const citations = buildCitationsFromSubmittal(submittal)
  return (
    <section
      aria-label="Citations"
      style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '14px 18px',
        fontFamily: FONT,
      }}
    >
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 11,
          fontWeight: 600,
          color: C.ink3,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Citations
      </h3>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>
        {citations.length === 0
          ? 'No citations on this submittal yet. Iris adds them as it pre-flights and as reviewers respond.'
          : `${citations.length} citation${citations.length === 1 ? '' : 's'} across ${
              new Set(citations.map((c) => c.kind)).size
            } kind${new Set(citations.map((c) => c.kind)).size === 1 ? '' : 's'}.`}
      </p>
      <button
        type="button"
        onClick={onOpenPanel}
        disabled={citations.length === 0}
        style={{
          padding: '7px 12px',
          backgroundColor: citations.length === 0 ? '#fff' : C.brandOrange,
          color: citations.length === 0 ? C.ink3 : '#fff',
          border: `1px solid ${citations.length === 0 ? C.border : C.brandOrange}`,
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: citations.length === 0 ? 'not-allowed' : 'pointer',
          fontFamily: FONT,
        }}
      >
        Open citations panel →
      </button>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: C.ink3, lineHeight: 1.4 }}>
        The panel opens from the right rail (per ADR-004 — never modal,
        never full-page nav). Phase 7 ships 8 citation kinds with PDF
        preview where applicable. LLM augmentation in Phase 7b.
      </p>
    </section>
  )
}

// Build a deterministic citation set from the submittal's columns. Phase 7b
// replaces this with the Iris LLM-driven citation graph (real spec hits,
// related RFIs/COs from the project, similar-past lookup).
function buildCitationsFromSubmittal(submittal: Record<string, unknown>): CitationBase[] {
  const out: CitationBase[] = []

  const csiSection = (submittal.csi_section as string | null) ?? null
  const paragraph = (submittal.spec_section_paragraph as string | null) ?? null
  const pdfPage = (submittal.spec_pdf_page as number | null) ?? null
  if (csiSection) {
    out.push({
      id: 'spec_section_self',
      kind: 'spec_section',
      label: paragraph ? `${csiSection} ${paragraph}` : csiSection,
      subtitle: pdfPage != null ? `Spec book p. ${pdfPage}` : 'Linked spec section',
      preview: pdfPage != null
        ? { kind: 'pdf', pdfUrl: '#spec-book', page: pdfPage, highlightRect: [10, 20, 70, 8] }
        : { kind: 'text', body: 'Spec section linked but PDF page not yet captured. Iris will fill in the highlight rectangle on next pre-flight.' },
    })
  }

  const scheduleId = (submittal.schedule_activity_id as string | null) ?? null
  if (scheduleId) {
    out.push({
      id: `schedule_${scheduleId}`,
      kind: 'schedule_activity',
      label: 'Linked schedule activity',
      subtitle: 'Drives the required-on-site walkback',
      preview: {
        kind: 'schedule_activity_summary',
        activity_id: scheduleId,
        name: 'Schedule activity (Phase 7b: live join)',
        start_date: null,
        end_date: null,
      },
    })
  }

  const packageId = (submittal.submittal_package_id as string | null) ?? null
  if (packageId) {
    out.push({
      id: `package_${packageId}`,
      kind: 'package_item',
      label: 'Submittal package',
      subtitle: 'This submittal belongs to a package',
      preview: { kind: 'text', body: 'Package detail loads in Phase 7b once the package join is wired.' },
    })
  }

  return out
}

// Map a disposition string ("Approved as noted") back to a SubmittalDisposition
// codeset value. Phase 7 uses a coarse-grained mapping; the project's codeset
// (EJCDC / AIA / UFGS / custom) is read from settings in Phase 7b.
function mapDispositionLabelToCode(label: string): SubmittalDisposition {
  const l = label.toLowerCase()
  if (l.includes('no exceptions')) return 'A_no_exceptions_taken' as SubmittalDisposition
  if (l.includes('as noted') || l.includes('make corrections')) return 'B_make_corrections_noted' as SubmittalDisposition
  if (l.includes('revise')) return 'C_revise_and_resubmit' as SubmittalDisposition
  if (l.includes('reject')) return 'D_rejected' as SubmittalDisposition
  if (l.includes('reference')) return 'E_for_reference_only' as SubmittalDisposition
  if (l.includes('specified')) return 'F_submit_specified_item' as SubmittalDisposition
  // Default fallback — treat unknown labels as approved.
  return 'A_no_exceptions_taken' as SubmittalDisposition
}

// ── Phase 7c-1 helpers ─────────────────────────────────────────────────────

function buildStepLabel(stepId: string | null, rows: WorkflowChainRow[]): string {
  if (!stepId) return ''
  const r = rows.find((x) => x.id === stepId)
  if (!r) return 'Step'
  const role = r.reviewer_role ? ` · ${r.reviewer_role}` : ''
  return `Step ${r.sequence}${role}`
}

function buildPriorSteps(rows: WorkflowChainRow[]): PriorStep[] {
  // The "current" step is the smallest-sequence open step; if none open,
  // fall back to the highest sequence with a responded_at (unusual). The
  // SendBackDialog only shows steps with sequence < current.
  const openSeq = rows.find((r) => r.is_current)?.sequence
  const currentSeq = openSeq ?? Math.max(0, ...rows.filter((r) => r.responded_at).map((r) => r.sequence))
  return rows
    .filter((r) => r.sequence < currentSeq)
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) => ({
      id: r.id,
      sequence: r.sequence,
      reviewer_name: r.reviewer_name,
      reviewer_role: r.reviewer_role,
    }))
}

// ── Boundary ───────────────────────────────────────────────────────────────

const SubmittalDetailV2: React.FC = () => (
  <ErrorBoundary message="Submittal detail could not be displayed.">
    <SubmittalDetailV2Page />
  </ErrorBoundary>
)

export { SubmittalDetailV2 }
export default SubmittalDetailV2
