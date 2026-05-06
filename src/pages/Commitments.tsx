// ─────────────────────────────────────────────────────────────────────────────
// Commitments — who owes us what, when (Tab Wow-4 crash patch)
// ─────────────────────────────────────────────────────────────────────────────
// The /commitments URL was 404'ing. This is the canonical list page: party,
// commitment, due-date, status indicator. Sources commitments derived from
// RFIs/submittals/meetings (see CommitmentSource in src/types/stream.ts).
//
// Schema graceful degrade: the demo seeder writes to a `commitments` table
// (project_id, party, commitment, due_date, status, source_type, source_id).
// If the table isn't present in this environment, render empty state instead
// of crashing.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, CheckCircle2, FileText } from 'lucide-react'

import { ErrorBoundary } from '../components/ErrorBoundary'
import { ProjectGate } from '../components/ProjectGate'
import { useProjectId } from '../hooks/useProjectId'
import { supabase } from '../lib/supabase'

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
} as const

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

type Status = 'on_track' | 'at_risk' | 'overdue' | 'received'

interface CommitmentRow {
  id: string
  party: string | null
  commitment: string | null
  due_date: string | null
  status: Status | null
  source_type: string | null
  source_id: string | null
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  overdue:   { label: 'Overdue',   color: C.critical, bg: 'rgba(201, 59, 59, 0.10)',  icon: <AlertTriangle size={12} /> },
  at_risk:   { label: 'At risk',   color: C.pending,  bg: 'rgba(196, 133, 12, 0.10)', icon: <Clock size={12} /> },
  on_track:  { label: 'On track',  color: C.active,   bg: 'rgba(45, 138, 110, 0.10)', icon: <Clock size={12} /> },
  received:  { label: 'Received',  color: C.ink2,     bg: 'rgba(92, 85, 80, 0.06)',   icon: <CheckCircle2 size={12} /> },
}

function fmtDue(due: string | null): { label: string; tone: string } {
  if (!due) return { label: '—', tone: C.ink4 }
  const d = new Date(due)
  if (Number.isNaN(d.getTime())) return { label: '—', tone: C.ink4 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ms = d.getTime() - today.getTime()
  const days = Math.round(ms / 86400000)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (days < 0) return { label: `${dateStr} (${Math.abs(days)}d overdue)`, tone: C.critical }
  if (days === 0) return { label: 'Today', tone: C.brandOrange }
  if (days === 1) return { label: 'Tomorrow', tone: C.pending }
  if (days <= 7) return { label: dateStr, tone: C.ink2 }
  return { label: dateStr, tone: C.ink3 }
}

// ── Query ──────────────────────────────────────────────────────────────────
//
// Hand-rolled rather than using a generated typed client because the
// `commitments` table isn't in src/types/database.ts (only weekly_commitments
// is). Returns [] when the table is missing so the page renders empty
// instead of crashing.

function useCommitments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['commitments', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<CommitmentRow[]> => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              order: (k: string, opts: { ascending: boolean; nullsFirst?: boolean }) => Promise<{ data: CommitmentRow[] | null; error: { code?: string; message?: string } | null }>
            }
          }
        }
      })
        .from('commitments')
        .select('id, party, commitment, due_date, status, source_type, source_id')
        .eq('project_id', projectId!)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) {
        // Graceful degrade: missing table or RLS lockdown — show empty.
        if (error.code === 'PGRST205' || error.code === '42P01' || /relation .* does not exist/i.test(error.message ?? '')) {
          return []
        }
        throw new Error(error.message ?? 'Failed to load commitments')
      }
      return data ?? []
    },
    staleTime: 30_000,
  })
}

// ── Page ──────────────────────────────────────────────────────────────────

const CommitmentsPage: React.FC = () => {
  const projectId = useProjectId()
  const { data: rows, isPending, isError, error } = useCommitments(projectId)

  // Hooks must run before any early return — sort first, gate render below.
  const sorted = useMemo(() => {
    const STATUS_RANK: Record<Status, number> = { overdue: 0, at_risk: 1, on_track: 2, received: 3 }
    return [...(rows ?? [])].sort((a, b) => {
      const ar = STATUS_RANK[(a.status ?? 'on_track') as Status] ?? 9
      const br = STATUS_RANK[(b.status ?? 'on_track') as Status] ?? 9
      if (ar !== br) return ar - br
      const ad = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bd = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      return ad - bd
    })
  }, [rows])

  const counts = useMemo(() => {
    const c = { all: 0, overdue: 0, at_risk: 0, on_track: 0, received: 0 }
    for (const r of rows ?? []) {
      c.all++
      const s = (r.status ?? 'on_track') as Status
      if (s in c) (c as Record<string, number>)[s]++
    }
    return c
  }, [rows])

  if (!projectId) return <ProjectGate />

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.surface, fontFamily: FONT }}>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          padding: '14px 20px 12px',
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: C.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.ink }}>
            Commitments
          </h1>
          <span style={{ fontSize: 12, color: C.ink3 }}>
            Who owes us what, when. Derived from RFIs, submittals, meetings.
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.ink3, fontVariantNumeric: 'tabular-nums' }}>
            {counts.all} {counts.all === 1 ? 'item' : 'items'}
            {counts.overdue > 0 && (
              <span style={{ marginLeft: 12, color: C.critical, fontWeight: 600 }}>
                {counts.overdue} overdue
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 20 }}>
        {isPending ? (
          <SkeletonRows />
        ) : isError ? (
          <EmptyState
            icon={<AlertTriangle size={28} color={C.critical} />}
            title="Couldn't load commitments"
            description={error instanceof Error ? error.message : 'Unknown error'}
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} color={C.ink4} />}
            title="No commitments yet"
            description="Commitments are derived from RFIs, submittals, and meeting follow-ups. They'll appear here as the team works."
          />
        ) : (
          <div
            role="table"
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#FFF',
            }}
          >
            <div
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 140px 110px 96px',
                padding: '8px 14px',
                backgroundColor: C.surfaceAlt,
                borderBottom: `1px solid ${C.border}`,
                fontSize: 11,
                fontWeight: 600,
                color: C.ink3,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              <div role="columnheader">Party</div>
              <div role="columnheader">Commitment</div>
              <div role="columnheader">Due</div>
              <div role="columnheader">Status</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>Source</div>
            </div>
            {sorted.map((r, i) => (
              <CommitmentRowView key={r.id} row={r} isLast={i === sorted.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────

const CommitmentRowView: React.FC<{ row: CommitmentRow; isLast: boolean }> = ({ row, isLast }) => {
  const status = (row.status ?? 'on_track') as Status
  const meta = STATUS_META[status] ?? STATUS_META.on_track
  const due = fmtDue(row.due_date)
  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr 140px 110px 96px',
        padding: '10px 14px',
        borderBottom: isLast ? 'none' : `1px solid ${C.borderSubtle}`,
        fontSize: 13,
        color: C.ink,
        alignItems: 'center',
      }}
    >
      <div role="cell" style={{ color: C.ink, fontWeight: 500 }}>
        {row.party ?? '—'}
      </div>
      <div role="cell" style={{ color: C.ink2 }}>
        {row.commitment ?? '—'}
      </div>
      <div role="cell" style={{ color: due.tone, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
        {due.label}
      </div>
      <div role="cell">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: meta.bg,
            color: meta.color,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {meta.icon}
          {meta.label}
        </span>
      </div>
      <div role="cell" style={{ textAlign: 'right', color: C.ink3, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {row.source_type ?? '—'}
      </div>
    </div>
  )
}

// ── States ────────────────────────────────────────────────────────────────

const SkeletonRows: React.FC = () => (
  <div
    style={{
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#FFF',
    }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        style={{
          padding: '12px 14px',
          borderBottom: i === 5 ? 'none' : `1px solid ${C.borderSubtle}`,
          display: 'grid',
          gridTemplateColumns: '180px 1fr 140px 110px 96px',
          gap: 12,
        }}
      >
        {[140, 280, 80, 70, 60].map((w, j) => (
          <div
            key={j}
            style={{
              height: 12,
              width: w,
              maxWidth: '100%',
              backgroundColor: C.surfaceAlt,
              borderRadius: 4,
              animation: 'commitments-pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    ))}
    <style>{`@keyframes commitments-pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 0.8 } }`}</style>
  </div>
)

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '56px 20px',
      backgroundColor: '#FFF',
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      textAlign: 'center',
    }}
  >
    {icon}
    <h2 style={{ margin: '12px 0 4px', fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</h2>
    <p style={{ margin: 0, fontSize: 12, color: C.ink3, maxWidth: 420, lineHeight: 1.5 }}>{description}</p>
  </div>
)

// ── Boundary ──────────────────────────────────────────────────────────────

export const Commitments: React.FC = () => (
  <ErrorBoundary message="Commitments could not be displayed. Check your connection and try again.">
    <CommitmentsPage />
  </ErrorBoundary>
)

export default Commitments
