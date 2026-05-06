// ─────────────────────────────────────────────────────────────────────────────
// ProjectNow — the right-rail snapshot panel of the cockpit.
// ─────────────────────────────────────────────────────────────────────────────
// Everything ABOUT the project right now, all in one panel:
//   • Pulse strip — schedule, budget, crew, weather (real numbers)
//   • Today's lookahead — schedule activities active today + next 2 days
//   • Owed to you — commitments where the user is the receiving party
//   • Recent photos — 4-thumb strip from field captures
//
// One ZonePanel wraps the whole thing with internal sub-sections separated by
// hairlines. Glanceable. No tabs.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ImageIcon, AlertTriangle } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { useProjectId } from '../../hooks/useProjectId'
import { useProject, useWorkforceMembers } from '../../hooks/queries'
import { useScheduleActivities } from '../../hooks/useScheduleActivities'
import { useBudgetData } from '../../hooks/useBudgetData'
import { useFieldCaptures } from '../../hooks/queries/field-captures'
import { useIncidents } from '../../hooks/queries/incidents'
import { useDailyLogs } from '../../hooks/queries/daily-logs'
import { fetchWeatherForProject, type WeatherSnapshot } from '../../lib/weather'
import { ZonePanel } from './ZonePanel'
import type { StreamItem, StreamRole } from '../../types/stream'

interface ProjectNowProps {
  /** All stream items, used to derive "Owed to you" commitments. */
  items: StreamItem[]
  /** Stream role drives what sections appear and in what order. */
  role: StreamRole
  /** UUID-aware name resolver — UUIDs become display names, free text passes through. */
  resolveName?: (value: string | null | undefined) => string | null
}

// ── Pulse row ──────────────────────────────────────────────────────────────

function PulseRow({
  label,
  value,
  tone = 'neutral',
  href,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'neutral'
  href?: string
}) {
  const navigate = useNavigate()
  const valueColor =
    tone === 'positive' ? '#2D8A6E' : tone === 'negative' ? '#C93B3B' : colors.ink
  return (
    <button
      type="button"
      onClick={href ? () => navigate(href) : undefined}
      disabled={!href}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        width: '100%',
        padding: `${spacing[2]} ${spacing[4]}`,
        background: 'transparent',
        border: 'none',
        cursor: href ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontSize: '12px',
          fontWeight: 500,
          color: colors.ink3,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: typography.fontFamily,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '14px',
          fontWeight: 500,
          color: valueColor,
        }}
      >
        {value}
      </span>
    </button>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: `${spacing[3]} ${spacing[4]} ${spacing[1]}`,
        fontFamily: typography.fontFamily,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: colors.ink3,
        borderTop: `1px solid ${colors.borderSubtle}`,
        marginTop: spacing[2],
      }}
    >
      {label}
    </div>
  )
}

// ── PhotoThumb ─────────────────────────────────────────────────────────────
// 64×64 dignified thumbnail. Real <img> element so we can detect load failure
// and fall back to a labeled placeholder instead of leaving a broken tile.
// Subtle warm shadow + hairline ring; orange ring + 1.5px lift on hover.

function PhotoThumb({
  src,
  alt,
  onClick,
}: {
  src: string | null
  alt: string
  onClick: () => void
}) {
  const [errored, setErrored] = React.useState(false)
  const showImage = !!src && !errored
  return (
    <button
      onClick={onClick}
      type="button"
      aria-label={alt}
      title={alt}
      style={{
        width: 64,
        height: 64,
        borderRadius: 8,
        border: `1px solid ${colors.borderSubtle}`,
        background: colors.surfaceInset,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 1px 2px rgba(26, 22, 19, 0.06), 0 0 0 1px rgba(26, 22, 19, 0.04)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1.5px)'
        e.currentTarget.style.boxShadow =
          '0 4px 12px rgba(26, 22, 19, 0.10), 0 0 0 1px rgba(244, 120, 32, 0.45)'
        e.currentTarget.style.borderColor = colors.primaryOrange
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(26, 22, 19, 0.06), 0 0 0 1px rgba(26, 22, 19, 0.04)'
        e.currentTarget.style.borderColor = colors.borderSubtle
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setErrored(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: colors.ink3,
          }}
        >
          <ImageIcon size={18} strokeWidth={1.5} />
        </span>
      )}
    </button>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export const ProjectNow: React.FC<ProjectNowProps> = ({ items, role, resolveName }) => {
  const navigate = useNavigate()
  const projectId = useProjectId()
  const isField = role === 'superintendent'

  const { data: project } = useProject(projectId)
  const { data: scheduleActs } = useScheduleActivities(projectId ?? '')
  const { budgetItems } = useBudgetData()
  const { data: workforce } = useWorkforceMembers(projectId)
  const { data: photos } = useFieldCaptures(projectId)
  const { data: incidents } = useIncidents(isField ? projectId : undefined)
  const { data: dailyLogPage } = useDailyLogs(
    isField ? projectId : undefined,
    { page: 1, pageSize: 5 },
  )
  const { data: weather } = useQuery<WeatherSnapshot>({
    queryKey: ['cockpit_weather', projectId],
    queryFn: () =>
      fetchWeatherForProject(
        projectId!,
        project?.latitude ?? undefined,
        project?.longitude ?? undefined,
      ),
    enabled: !!projectId,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Schedule status
  const scheduleStatus = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const behind = (scheduleActs ?? []).filter(
      (a) =>
        a.is_critical_path &&
        a.end_date &&
        a.end_date < today &&
        (a.percent_complete ?? 0) < 100,
    ).length
    return {
      value: behind === 0 ? 'On track' : `${behind} behind`,
      tone: (behind === 0 ? 'positive' : 'negative') as 'positive' | 'negative',
    }
  }, [scheduleActs])

  // Budget %
  const budgetStatus = useMemo(() => {
    const totals = budgetItems.reduce(
      (acc, b) => {
        const approved = Number(b.original_amount ?? 0)
        const committed = Number(
          (b as unknown as Record<string, unknown>).committed_amount ?? b.actual_amount ?? 0,
        )
        acc.approved += approved
        acc.committed += committed
        return acc
      },
      { approved: 0, committed: 0 },
    )
    const pct = totals.approved > 0 ? Math.round((totals.committed / totals.approved) * 100) : 0
    return {
      value: totals.approved > 0 ? `${pct}% committed` : '—',
      tone: (pct > 100 ? 'negative' : 'neutral') as 'negative' | 'neutral',
    }
  }, [budgetItems])

  const crewValue = `${(workforce ?? []).length} on site`
  const weatherValue = weather
    ? `${weather.conditions.toLowerCase().includes('rain') ? '🌧' : weather.conditions.toLowerCase().includes('cloud') ? '☁' : '☀'} ${weather.temperature_high}°`
    : '—'

  // Lookahead — schedule activities active today, tomorrow, day-after.
  const lookahead = useMemo(() => {
    const today = startOfDay(new Date())
    const out: { id: string; name: string; when: string }[] = []
    for (const a of scheduleActs ?? []) {
      if (!a.start_date || !a.end_date) continue
      const start = startOfDay(new Date(a.start_date))
      const end = startOfDay(new Date(a.end_date))
      const todayMs = today.getTime()
      const day = 86_400_000
      if (start.getTime() <= todayMs + 2 * day && end.getTime() >= todayMs) {
        out.push({
          id: a.id,
          name: a.name,
          when:
            start.getTime() <= todayMs ? 'in progress' :
            start.getTime() === todayMs + day ? 'tomorrow' : 'in 2d',
        })
      }
      if (out.length >= 4) break
    }
    return out
  }, [scheduleActs])

  // Owed to you — commitment-type stream items.
  const owedToYou = useMemo(
    () => items.filter((i) => i.type === 'commitment' || i.cardType === 'commitment').slice(0, 4),
    [items],
  )

  // Photo thumbs — top 4 most recent with file_url.
  const photoStrip = useMemo(
    () => (photos ?? []).filter((p) => !!p.file_url).slice(0, 4),
    [photos],
  )

  // Super-only: open safety items (incidents not closed).
  const openSafety = useMemo(() => {
    if (!isField) return []
    return (incidents ?? [])
      .filter((i) => {
        const status = (i as { status?: string | null }).status
        return !status || !['closed', 'resolved'].includes(status.toLowerCase())
      })
      .slice(0, 3)
  }, [incidents, isField])

  // Super-only: today's daily log status.
  const dailyLogStatus = useMemo(() => {
    if (!isField) return null
    const todayIso = new Date().toISOString().split('T')[0]
    const logs = (dailyLogPage as { data?: Array<{ log_date?: string; status?: string }> } | undefined)?.data ?? []
    const todays = logs.find((l) => l.log_date === todayIso)
    if (!todays) return { label: 'Not started', tone: 'negative' as const }
    const status = (todays.status ?? '').toLowerCase()
    if (status === 'submitted' || status === 'approved') {
      return { label: status === 'approved' ? 'Approved' : 'Submitted', tone: 'positive' as const }
    }
    return { label: 'Drafting', tone: 'neutral' as const }
  }, [dailyLogPage, isField])

  return (
    <ZonePanel
      title="Project Now"
      subtitle={project?.name ?? undefined}
      contentStyle={{ padding: 0 }}
    >
      {/* Pulse — order changes per role: PM leads with money/schedule;
          Super leads with weather + crew (the field's lived metrics). */}
      <div style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}>
        {isField ? (
          <>
            <PulseRow label="Weather" value={weatherValue} />
            <PulseRow label="Crew" value={crewValue} href="/workforce" />
            <PulseRow
              label="Schedule"
              value={scheduleStatus.value}
              tone={scheduleStatus.tone}
              href="/schedule"
            />
            {dailyLogStatus && (
              <PulseRow
                label="Today's Log"
                value={dailyLogStatus.label}
                tone={dailyLogStatus.tone}
                href="/daily-log"
              />
            )}
          </>
        ) : (
          <>
            <PulseRow
              label="Schedule"
              value={scheduleStatus.value}
              tone={scheduleStatus.tone}
              href="/schedule"
            />
            <PulseRow
              label="Budget"
              value={budgetStatus.value}
              tone={budgetStatus.tone}
              href="/budget"
            />
            <PulseRow label="Crew" value={crewValue} href="/workforce" />
            <PulseRow label="Weather" value={weatherValue} />
          </>
        )}
      </div>

      <SectionDivider label={isField ? "Today's Field Plan" : "Today's Lookahead"} />
      <div style={{ padding: `${spacing[1]} ${spacing[4]} ${spacing[3]}` }}>
        {lookahead.length === 0 ? (
          <span style={{ fontSize: '13px', color: colors.ink3, fontFamily: typography.fontFamily }}>
            Nothing scheduled.
          </span>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {lookahead.map((a) => (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: spacing[2],
                  padding: `${spacing[1]} 0`,
                  fontFamily: typography.fontFamily,
                  fontSize: '13px',
                }}
              >
                <span
                  style={{
                    color: colors.ink2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </span>
                <span style={{ color: colors.ink3, fontSize: '12px' }}>{a.when}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isField ? (
        <>
          <SectionDivider label="Open safety" />
          <div style={{ padding: `${spacing[1]} ${spacing[4]} ${spacing[3]}` }}>
            {openSafety.length === 0 ? (
              <span style={{ fontSize: '13px', color: colors.ink3, fontFamily: typography.fontFamily }}>
                No open incidents. Keep it that way.
              </span>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {openSafety.map((i) => {
                  const inc = i as unknown as { id: string; type?: string | null; description?: string | null; date?: string | null }
                  return (
                    <li
                      key={inc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: spacing[2],
                        padding: `${spacing[1]} 0`,
                        fontFamily: typography.fontFamily,
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: colors.ink2, display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <AlertTriangle size={12} color="#C93B3B" strokeWidth={2} aria-hidden />
                        {inc.type ?? 'Incident'} · {inc.description ?? '—'}
                      </span>
                      <span style={{ color: colors.ink3, fontSize: '12px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {inc.date ? formatDateShort(inc.date) : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <SectionDivider label="Owed to you" />
          <div style={{ padding: `${spacing[1]} ${spacing[4]} ${spacing[3]}` }}>
            {owedToYou.length === 0 ? (
              <span style={{ fontSize: '13px', color: colors.ink3, fontFamily: typography.fontFamily }}>
                No outstanding commitments.
              </span>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {owedToYou.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: spacing[2],
                      padding: `${spacing[1]} 0`,
                      fontFamily: typography.fontFamily,
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: colors.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(resolveName ? resolveName(c.party ?? c.assignedTo) : (c.party ?? c.assignedTo)) ?? '—'} · {c.commitment ?? c.title}
                    </span>
                    <span style={{ color: c.overdue ? '#C93B3B' : colors.ink3, fontSize: '12px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {c.dueDate ? formatDateShort(c.dueDate) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <SectionDivider label="Recent photos" />
      <div style={{ padding: `${spacing[1]} ${spacing[4]} ${spacing[4]}` }}>
        {photoStrip.length === 0 ? (
          <span style={{ fontSize: '13px', color: colors.ink3, fontFamily: typography.fontFamily }}>
            No photos yet.
          </span>
        ) : (
          <div style={{ display: 'flex', gap: spacing[2] }}>
            {photoStrip.map((p) => (
              <PhotoThumb
                key={p.id}
                src={p.file_url ?? null}
                alt={p.content ?? 'Field capture'}
                onClick={() => navigate('/field-capture')}
              />
            ))}
            <button
              onClick={() => navigate('/field-capture')}
              type="button"
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                border: `1px dashed ${colors.borderDefault}`,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.ink3,
                flexShrink: 0,
                transition: 'border-color 160ms ease, color 160ms ease, transform 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primaryOrange
                e.currentTarget.style.color = colors.primaryOrange
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.borderDefault
                e.currentTarget.style.color = colors.ink3
              }}
              aria-label="Open photos"
              title="See all field photos"
            >
              <ArrowUpRight size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {photoStrip.length === 0 && (
        <button
          onClick={() => navigate('/field-capture')}
          type="button"
          style={{
            margin: `0 ${spacing[4]} ${spacing[4]}`,
            padding: `${spacing[2]} ${spacing[3]}`,
            background: colors.surfaceInset,
            border: `1px dashed ${colors.borderDefault}`,
            borderRadius: 6,
            color: colors.ink3,
            fontFamily: typography.fontFamily,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <ImageIcon size={13} strokeWidth={1.75} />
          Capture a field photo
        </button>
      )}
    </ZonePanel>
  )
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function formatDateShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default ProjectNow
