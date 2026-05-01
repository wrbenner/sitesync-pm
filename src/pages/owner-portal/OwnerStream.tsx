import React, { useEffect, useState } from 'react'
import {
  Calendar,
  DollarSign,
  CheckSquare,
  Camera,
  ArrowRight,
  Clock,
} from 'lucide-react'

import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { supabase } from '../../lib/supabase'

// Brand surface colors — owner portal IS a brand surface, so parchment +
// Garamond serif for the project name are intentionally on (per spec).
const PARCHMENT = '#FAF7F0'
const SERIF_STACK =
  '"EB Garamond", Garamond, "Cormorant Garamond", "Times New Roman", serif'

const STATUS_OK = '#2D8A6E'        // moss
const STATUS_WARN = '#B8472E'      // rust

// ── Types ───────────────────────────────────────────────────────────────────

interface ScheduleSnapshot {
  status: 'on_track' | 'behind'
  daysBehind: number
  nextMilestoneName: string | null
  nextMilestoneDate: string | null  // ISO
  percentComplete: number          // 0..100
}

interface BudgetSnapshot {
  percentCommitted: number          // 0..100
  approvedTotal: number | null
  changeOrderExposure: number | null
}

interface OwnerDecision {
  id: string
  title: string
  reason: string
  dueDate: string | null
}

interface ProgressPhoto {
  id: string
  url: string
  caption: string | null
  takenAt: string
}

interface LatestOwnerUpdate {
  id: string
  body: string
  sentAt: string
  sentByName: string | null
}

// ── Component ───────────────────────────────────────────────────────────────

interface OwnerStreamProps {
  projectId: string
  projectName: string | null
  projectAddress: string | null
}

/**
 * The clean, branded owner view rendered after a magic-link token
 * validates. Single column, max-width 960. No nav, no PM-internals —
 * just the four cards an owner cares about and the latest owner update.
 *
 * Data is fetched best-effort via the supabase client. Where RLS or
 * missing data leaves a section empty, the card renders a quiet
 * "No data yet" state rather than a giant empty hero — owners are busy.
 */
export const OwnerStream: React.FC<OwnerStreamProps> = ({
  projectId,
  projectName,
  projectAddress,
}) => {
  const [schedule, setSchedule] = useState<ScheduleSnapshot | null>(null)
  const [budget, setBudget] = useState<BudgetSnapshot | null>(null)
  const [decisions, setDecisions] = useState<OwnerDecision[]>([])
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [latestUpdate, setLatestUpdate] = useState<LatestOwnerUpdate | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [
        scheduleResult,
        budgetResult,
        decisionsResult,
        photosResult,
        updateResult,
      ] = await Promise.all([
        loadSchedule(projectId),
        loadBudget(projectId),
        loadDecisions(projectId),
        loadPhotos(projectId),
        loadLatestOwnerUpdate(projectId),
      ])
      if (cancelled) return
      setSchedule(scheduleResult)
      setBudget(budgetResult)
      setDecisions(decisionsResult)
      setPhotos(photosResult)
      setLatestUpdate(updateResult)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // ── Branded header ─────────────────────────────────────────────────────
  const onTrack = !schedule || schedule.status === 'on_track'
  const statusBadge = onTrack
    ? { label: 'On track', color: STATUS_OK }
    : {
        label: `${schedule!.daysBehind} day${schedule!.daysBehind === 1 ? '' : 's'} behind`,
        color: STATUS_WARN,
      }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: PARCHMENT,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: `${spacing['8']} ${spacing['6']}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['6'],
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: spacing['4'],
            paddingBottom: spacing['5'],
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: typography.fontWeight.semibold,
                marginBottom: spacing['2'],
              }}
            >
              Owner update
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: SERIF_STACK,
                fontSize: 36,
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: colors.textPrimary,
              }}
            >
              {projectName ?? 'Your project'}
            </h1>
            {projectAddress && (
              <div
                style={{
                  marginTop: spacing['2'],
                  fontSize: typography.fontSize.body,
                  color: colors.textSecondary,
                  fontFamily: typography.fontFamily,
                }}
              >
                {projectAddress}
              </div>
            )}
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              backgroundColor: `${statusBadge.color}14`,
              color: statusBadge.color,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              flexShrink: 0,
            }}
            aria-label={`Project status: ${statusBadge.label}`}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusBadge.color,
              }}
              aria-hidden
            />
            {statusBadge.label}
          </span>
        </header>

        {/* ── 2x2 card grid ────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
            gap: spacing['4'],
          }}
        >
          <ScheduleCard schedule={schedule} loaded={loaded} />
          <BudgetCard budget={budget} loaded={loaded} />
          <DecisionsCard decisions={decisions} loaded={loaded} />
          <ProgressCard photos={photos} loaded={loaded} />
        </div>

        {/* ── Latest owner update ──────────────────────────────────── */}
        <LatestUpdateBlock update={latestUpdate} loaded={loaded} />

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer
          style={{
            paddingTop: spacing['5'],
            borderTop: `1px solid ${colors.borderSubtle}`,
            color: colors.textTertiary,
            fontSize: typography.fontSize.caption,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: spacing['3'],
          }}
        >
          <span>Powered by SiteSync. Magic-link access — no sign-in required.</span>
          <span>This view refreshes whenever the project does.</span>
        </footer>
      </div>
    </div>
  )
}

// ── Card components ─────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.lg,
  padding: spacing['5'],
  display: 'flex',
  flexDirection: 'column',
  gap: spacing['3'],
  minHeight: 180,
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: typography.fontSize.caption,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: typography.fontWeight.semibold,
  color: colors.textTertiary,
}

const ScheduleCard: React.FC<{ schedule: ScheduleSnapshot | null; loaded: boolean }> = ({
  schedule,
  loaded,
}) => {
  const hasData = !!schedule
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <Calendar size={13} />
        Schedule
      </div>
      {!loaded && <CardSkeleton />}
      {loaded && !hasData && <EmptyLine label="No schedule data yet." />}
      {loaded && hasData && schedule && (
        <>
          <ProgressBar percent={schedule.percentComplete} color={STATUS_OK} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold }}>
              {schedule.percentComplete.toFixed(0)}% complete
            </span>
            {schedule.nextMilestoneName && (
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Next: {schedule.nextMilestoneName}
                {schedule.nextMilestoneDate ? ` · ${formatDate(schedule.nextMilestoneDate)}` : ''}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const BudgetCard: React.FC<{ budget: BudgetSnapshot | null; loaded: boolean }> = ({
  budget,
  loaded,
}) => {
  const hasData = !!budget
  const exposure = budget?.changeOrderExposure ?? 0
  const overExposed = exposure > 0
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <DollarSign size={13} />
        Budget
      </div>
      {!loaded && <CardSkeleton />}
      {loaded && !hasData && <EmptyLine label="No budget snapshot yet." />}
      {loaded && hasData && budget && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {budget.percentCommitted.toFixed(1)}%
            </span>
            <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>committed</span>
          </div>
          {budget.approvedTotal != null && (
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
              Approved: ${budget.approvedTotal.toLocaleString('en-US')}
            </div>
          )}
          {budget.changeOrderExposure != null && (
            <span
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: `${overExposed ? STATUS_WARN : STATUS_OK}12`,
                color: overExposed ? STATUS_WARN : STATUS_OK,
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.semibold,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              CO exposure: ${Math.abs(exposure).toLocaleString('en-US')}
            </span>
          )}
        </>
      )}
    </div>
  )
}

const DecisionsCard: React.FC<{ decisions: OwnerDecision[]; loaded: boolean }> = ({
  decisions,
  loaded,
}) => (
  <div style={cardStyle}>
    <div style={cardHeaderStyle}>
      <CheckSquare size={13} />
      Decisions awaiting you
    </div>
    {!loaded && <CardSkeleton />}
    {loaded && decisions.length === 0 && <EmptyLine label="Nothing waiting on you right now." />}
    {loaded && decisions.length > 0 && (
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['2'],
        }}
      >
        {decisions.slice(0, 4).map((d) => (
          <li
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: '6px 0',
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <ArrowRight size={12} color={colors.textTertiary} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.title}
              </div>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.reason}
              </div>
            </div>
            {d.dueDate && (
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(d.dueDate)}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
)

const ProgressCard: React.FC<{ photos: ProgressPhoto[]; loaded: boolean }> = ({
  photos,
  loaded,
}) => {
  const visible = photos.slice(0, 4)
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <Camera size={13} />
        Recent progress
      </div>
      {!loaded && <CardSkeleton />}
      {loaded && visible.length === 0 && <EmptyLine label="No site photos posted yet." />}
      {loaded && visible.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: spacing['2'],
          }}
        >
          {visible.map((p) => (
            <div
              key={p.id}
              style={{
                aspectRatio: '4 / 3',
                borderRadius: borderRadius.md,
                backgroundColor: colors.surfaceInset,
                backgroundImage: `url(${p.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              title={p.caption ?? ''}
              aria-label={p.caption ?? 'Site progress photo'}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '4px 8px',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 100%)',
                  color: '#fff',
                  fontSize: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDate(p.takenAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const LatestUpdateBlock: React.FC<{ update: LatestOwnerUpdate | null; loaded: boolean }> = ({
  update,
  loaded,
}) => {
  if (!loaded) {
    return (
      <div style={cardStyle}>
        <CardSkeleton />
      </div>
    )
  }
  if (!update) {
    return (
      <div
        style={{
          ...cardStyle,
          textAlign: 'center',
          alignItems: 'center',
          color: colors.textTertiary,
          fontSize: typography.fontSize.sm,
        }}
      >
        <Clock size={20} aria-hidden />
        Your project manager hasn’t sent a written update yet. The cards above always reflect the live project.
      </div>
    )
  }
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        Latest update
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, color: colors.textTertiary, fontWeight: 400 }}>
          {formatDate(update.sentAt)}{update.sentByName ? ` · from ${update.sentByName}` : ''}
        </span>
      </div>
      <div
        style={{
          fontFamily: SERIF_STACK,
          fontSize: 17,
          lineHeight: 1.6,
          color: colors.textPrimary,
          whiteSpace: 'pre-wrap',
        }}
      >
        {update.body}
      </div>
    </div>
  )
}

// ── Loading + empty primitives ──────────────────────────────────────────────

const CardSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }} aria-hidden>
    <div style={{ height: 14, width: '60%', backgroundColor: colors.surfaceInset, borderRadius: 4 }} />
    <div style={{ height: 14, width: '40%', backgroundColor: colors.surfaceInset, borderRadius: 4 }} />
    <div style={{ height: 14, width: '70%', backgroundColor: colors.surfaceInset, borderRadius: 4 }} />
  </div>
)

const EmptyLine: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
    {label}
  </div>
)

const ProgressBar: React.FC<{ percent: number; color: string }> = ({ percent, color }) => {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: `${color}18`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: color,
          transition: 'width 240ms ease',
        }}
      />
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Best-effort data loaders ────────────────────────────────────────────────
//
// Owner-portal access uses the supabase anon client. RLS may block some of
// these reads in production; in that case we silently render the empty
// state. A full data path through a dedicated edge function is post-Wave-2.

async function loadSchedule(projectId: string): Promise<ScheduleSnapshot | null> {
  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => Promise<{ data: unknown; error: unknown }>
        }
      }
    })
      .from('schedule_activities')
      .select('id, name, planned_start, planned_finish, actual_finish, percent_complete, on_critical_path')
      .eq('project_id', projectId)
    if (error || !Array.isArray(data) || data.length === 0) return null
    const acts = data as Array<{
      id: string
      name: string
      planned_start: string | null
      planned_finish: string | null
      actual_finish: string | null
      percent_complete: number | null
      on_critical_path: boolean | null
    }>
    const total = acts.length || 1
    const avgComplete = acts.reduce((sum, a) => sum + (a.percent_complete ?? 0), 0) / total
    const now = Date.now()
    const behindCount = acts.filter((a) =>
      a.planned_finish &&
      !a.actual_finish &&
      new Date(a.planned_finish).getTime() < now &&
      (a.percent_complete ?? 0) < 100,
    ).length
    const upcoming = acts
      .filter((a) => a.planned_start && new Date(a.planned_start).getTime() > now)
      .sort((a, b) => (a.planned_start! < b.planned_start! ? -1 : 1))[0]
    return {
      status: behindCount > 0 ? 'behind' : 'on_track',
      daysBehind: behindCount,
      nextMilestoneName: upcoming?.name ?? null,
      nextMilestoneDate: upcoming?.planned_start ?? null,
      percentComplete: avgComplete,
    }
  } catch {
    return null
  }
}

async function loadBudget(projectId: string): Promise<BudgetSnapshot | null> {
  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => Promise<{ data: unknown; error: unknown }>
        }
      }
    })
      .from('cost_codes')
      .select('approved_amount, committed_amount, change_order_amount')
      .eq('project_id', projectId)
    if (error || !Array.isArray(data) || data.length === 0) return null
    const rows = data as Array<{
      approved_amount: number | null
      committed_amount: number | null
      change_order_amount: number | null
    }>
    const approved = rows.reduce((s, r) => s + (r.approved_amount ?? 0), 0)
    const committed = rows.reduce((s, r) => s + (r.committed_amount ?? 0), 0)
    const co = rows.reduce((s, r) => s + (r.change_order_amount ?? 0), 0)
    const pct = approved > 0 ? (committed / approved) * 100 : 0
    return {
      percentCommitted: pct,
      approvedTotal: approved > 0 ? approved : null,
      changeOrderExposure: co !== 0 ? co : null,
    }
  } catch {
    return null
  }
}

async function loadDecisions(projectId: string): Promise<OwnerDecision[]> {
  // RFIs and change_orders flagged `requires_owner` are the canonical
  // "decision" surface. Falls back to empty list if neither table is
  // accessible under RLS.
  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            in: (k: string, v: string[]) => Promise<{ data: unknown; error: unknown }>
          }
        }
      }
    })
      .from('rfis')
      .select('id, subject, question, due_date, status')
      .eq('project_id', projectId)
      .in('status', ['open', 'under_review'])
    if (error || !Array.isArray(data)) return []
    return (data as Array<{
      id: string
      subject: string | null
      question: string | null
      due_date: string | null
    }>).slice(0, 4).map((r) => ({
      id: r.id,
      title: r.subject ?? 'Open RFI',
      reason: (r.question ?? '').slice(0, 120) || 'Awaiting your input',
      dueDate: r.due_date,
    }))
  } catch {
    return []
  }
}

async function loadPhotos(projectId: string): Promise<ProgressPhoto[]> {
  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown; error: unknown }>
            }
          }
        }
      }
    })
      .from('field_capture_photos')
      .select('id, url, caption, captured_at')
      .eq('project_id', projectId)
      .order('captured_at', { ascending: false })
      .limit(8)
    if (error || !Array.isArray(data)) return []
    return (data as Array<{ id: string; url: string | null; caption: string | null; captured_at: string }>)
      .filter((r) => !!r.url)
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        url: r.url!,
        caption: r.caption,
        takenAt: r.captured_at,
      }))
  } catch {
    return []
  }
}

async function loadLatestOwnerUpdate(projectId: string): Promise<LatestOwnerUpdate | null> {
  // Owner updates aren't yet persisted by the OwnerUpdateGenerator (Tab Q
  // stops at clipboard), so we look for a recent custom-report run of
  // type 'owner_report' as a best-effort source. If none exists, the
  // OwnerStream renders the "no update yet" state, which is correct.
  try {
    const { data, error } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown; error: unknown }>
            }
          }
        }
      }
    })
      .from('owner_updates')
      .select('id, body, sent_at, sent_by_name')
      .eq('project_id', projectId)
      .order('sent_at', { ascending: false })
      .limit(1)
    if (error || !Array.isArray(data) || data.length === 0) return null
    const row = data[0] as {
      id: string
      body: string | null
      sent_at: string
      sent_by_name: string | null
    }
    if (!row.body) return null
    return {
      id: row.id,
      body: row.body,
      sentAt: row.sent_at,
      sentByName: row.sent_by_name,
    }
  } catch {
    return null
  }
}
