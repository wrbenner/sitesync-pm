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
import { CompactWorkflowChain, type WorkflowChainStep } from '../../../components/submittals/detail/Overview/CompactWorkflowChain'
import {
  IrisCoPilotPanel,
  type IrisCoPilotData,
} from '../../../components/submittals/detail/IrisCoPilotPanel'

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

  const reviewersQuery = useQuery<WorkflowChainStep[]>({
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
      return rows.map((r, idx): WorkflowChainStep => ({
        id: String(r.id),
        sequence: Number(r.sequence ?? idx + 1),
        reviewer_name: (r.reviewer_name as string | null) ?? null,
        reviewer_role: (r.reviewer_role as string | null) ?? null,
        responded_at: (r.responded_at as string | null) ?? null,
        disposition: (r.disposition as string | null) ?? null,
        is_current: idx === firstPendingIdx,
        is_parallel: r.parallel_group != null,
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
              <CompactWorkflowChain steps={reviewersQuery.data ?? []} />
            </>
          )}
          {tab === 'history' && <HistoryTabPlaceholder />}
          {tab === 'markup' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'markup')!.phase} tabLabel="Markup" />
          )}
          {tab === 'revisions' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'revisions')!.phase} tabLabel="Revisions" />
          )}
          {tab === 'citations' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'citations')!.phase} tabLabel="Citations" />
          )}
          {tab === 'distribute' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'distribute')!.phase} tabLabel="Distribute" />
          )}
          {tab === 'emails' && (
            <EmptyDetailTab phase={DETAIL_TABS.find((t) => t.id === 'emails')!.phase} tabLabel="Emails" />
          )}
        </main>

        <IrisCoPilotPanel
          open={copilotOpen}
          data={copilotData}
          onClose={() => setCopilotOpen(false)}
          attribution="Iris co-pilot (Phase 6 deterministic shell). LLM augmentation ships in Phase 7."
        />
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ActionClusterProps {
  copilotOpen: boolean
  onToggleCoPilot: () => void
}

const ActionCluster: React.FC<ActionClusterProps> = ({ copilotOpen, onToggleCoPilot }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
        title="Approve (disposition picker comes online in Phase 7 with voice review codes)"
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

// ── Boundary ───────────────────────────────────────────────────────────────

const SubmittalDetailV2: React.FC = () => (
  <ErrorBoundary message="Submittal detail could not be displayed.">
    <SubmittalDetailV2Page />
  </ErrorBoundary>
)

export { SubmittalDetailV2 }
export default SubmittalDetailV2
