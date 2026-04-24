import React, { useMemo, useState } from 'react'
import { Calendar, Users, AlertTriangle, Download, Briefcase } from 'lucide-react'
import { Card, SectionHeader, Btn, Skeleton, EmptyState } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useCrewSchedules, type CrewScheduleRow } from '../../hooks/queries/crew-schedules'
import { useLaborForecasts, type LaborForecastRow } from '../../hooks/queries/labor-forecasts'
import { exportToXlsx } from '../../lib/exportXlsx'

type Weeks = 1 | 2 | 3 | 4

interface PhaseLike {
  id: string
  name: string
  start_date?: string | null
  end_date?: string | null
  startDate?: string | null
  endDate?: string | null
  percent_complete?: number | null
  progress?: number | null
  status?: string | null
  is_critical_path?: boolean | null
}

interface Props {
  projectId: string | undefined
  projectName?: string | null
  schedulePhases: PhaseLike[]
}

// Monday-start week
function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function phaseStart(p: PhaseLike): string | null {
  return (p.start_date ?? p.startDate) ?? null
}
function phaseEnd(p: PhaseLike): string | null {
  return (p.end_date ?? p.endDate) ?? null
}

export const ScheduleLookahead: React.FC<Props> = ({ projectId, projectName, schedulePhases }) => {
  const [weeks, setWeeks] = useState<Weeks>(3)

  const weekWindows = useMemo(() => {
    const first = startOfWeek(new Date())
    return Array.from({ length: weeks }, (_, i) => {
      const start = addDays(first, i * 7)
      const end = addDays(start, 6)
      return { index: i + 1, start, end, startISO: toISO(start), endISO: toISO(end) }
    })
  }, [weeks])

  const rangeFrom = weekWindows[0].startISO
  const rangeTo = weekWindows[weekWindows.length - 1].endISO

  const { data: crewSchedules = [], isLoading: crewLoading } = useCrewSchedules(projectId)
  const { data: laborForecasts = [], isLoading: laborLoading } = useLaborForecasts(
    projectId,
    { from: rangeFrom, to: rangeTo },
  )

  const perWeek = useMemo(() => {
    return weekWindows.map((w) => {
      const phases = schedulePhases.filter((p) => {
        const s = phaseStart(p)
        const e = phaseEnd(p)
        if (!s || !e) return false
        return s <= w.endISO && e >= w.startISO
      })
      const crews: CrewScheduleRow[] = crewSchedules.filter(
        (c) => c.start_date <= w.endISO && c.end_date >= w.startISO,
      )
      const labor: LaborForecastRow[] = laborForecasts.filter(
        (lf) => lf.week_start >= w.startISO && lf.week_start <= w.endISO,
      )
      const laborHeadcount = labor.reduce((s, lf) => s + (lf.headcount_needed ?? 0), 0)
      const laborHours = labor.reduce((s, lf) => s + (lf.hours_needed ?? 0), 0)
      return { ...w, phases, crews, labor, laborHeadcount, laborHours }
    })
  }, [weekWindows, schedulePhases, crewSchedules, laborForecasts])

  // Same crew_name assigned to ≥2 crew_schedule rows that overlap in the window.
  const crewConflicts = useMemo(() => {
    const windowCrews = crewSchedules.filter((c) => c.end_date >= rangeFrom && c.start_date <= rangeTo)
    const byCrew = new Map<string, CrewScheduleRow[]>()
    for (const c of windowCrews) {
      const list = byCrew.get(c.crew_name) ?? []
      list.push(c)
      byCrew.set(c.crew_name, list)
    }
    const conflicts: Array<{ crew_name: string; rows: CrewScheduleRow[] }> = []
    for (const [name, rows] of byCrew.entries()) {
      if (rows.length < 2) continue
      const sorted = [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date))
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start_date <= sorted[i - 1].end_date) {
          conflicts.push({ crew_name: name, rows: sorted })
          break
        }
      }
    }
    return conflicts
  }, [crewSchedules, rangeFrom, rangeTo])

  const conflictCrewNames = useMemo(
    () => new Set(crewConflicts.map((c) => c.crew_name)),
    [crewConflicts],
  )

  const handleExport = () => {
    const pn = (projectName ?? 'Project').replace(/\s+/g, '_')
    const sheets = [
      {
        name: 'Lookahead Summary',
        headers: ['Week', 'Dates', 'Phases Active', 'Crews', 'Labor Headcount', 'Labor Hours'],
        rows: perWeek.map((w) => [
          `Week ${w.index}`,
          `${w.startISO} to ${w.endISO}`,
          w.phases.length,
          w.crews.length,
          w.laborHeadcount,
          w.laborHours,
        ]) as (string | number)[][],
        columnWidths: [10, 24, 14, 10, 18, 14],
      },
      {
        name: 'Phases',
        headers: ['Week', 'Phase', 'Start', 'End', '% Complete', 'Status', 'Critical Path'],
        rows: perWeek.flatMap((w) =>
          w.phases.map((p): (string | number)[] => [
            `Week ${w.index}`,
            p.name,
            phaseStart(p) ?? '',
            phaseEnd(p) ?? '',
            Number(p.percent_complete ?? p.progress ?? 0),
            p.status ?? '',
            p.is_critical_path ? 'Yes' : 'No',
          ]),
        ),
        columnWidths: [10, 30, 12, 12, 12, 14, 14],
      },
      {
        name: 'Crews',
        headers: ['Week', 'Crew', 'Phase', 'Start', 'End', 'Headcount'],
        rows: perWeek.flatMap((w) =>
          w.crews.map((c): (string | number)[] => [
            `Week ${w.index}`,
            c.crew_name,
            c.phase_name ?? '',
            c.start_date,
            c.end_date,
            c.headcount,
          ]),
        ),
        columnWidths: [10, 24, 24, 12, 12, 12],
      },
      {
        name: 'Labor Forecasts',
        headers: ['Week', 'Trade', 'Headcount Needed', 'Hours Needed', 'Source', 'Confidence'],
        rows: perWeek.flatMap((w) =>
          w.labor.map((lf): (string | number)[] => [
            `Week ${w.index}`,
            lf.trade ?? '',
            lf.headcount_needed ?? 0,
            lf.hours_needed ?? 0,
            lf.source ?? '',
            lf.confidence ?? 0,
          ]),
        ),
        columnWidths: [10, 20, 18, 14, 14, 12],
      },
    ]
    if (crewConflicts.length > 0) {
      sheets.push({
        name: 'Crew Conflicts',
        headers: ['Crew', 'Phase', 'Start', 'End', 'Headcount'],
        rows: crewConflicts.flatMap((c) =>
          c.rows.map((r): (string | number)[] => [
            c.crew_name,
            r.phase_name ?? '',
            r.start_date,
            r.end_date,
            r.headcount,
          ]),
        ),
        columnWidths: [20, 24, 12, 12, 12],
      })
    }
    exportToXlsx({ filename: `${pn}_Schedule_Lookahead`, sheets, projectName: projectName ?? undefined })
  }

  const loading = crewLoading || laborLoading
  const isEmpty = !loading && perWeek.every(
    (w) => w.phases.length === 0 && w.crews.length === 0 && w.labor.length === 0,
  )

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing['4'], flexWrap: 'wrap', gap: spacing['3'],
      }}>
        <div style={{ display: 'flex', gap: 2, background: colors.surfaceInset, borderRadius: borderRadius.full, padding: 3 }}>
          {([1, 2, 3, 4] as Weeks[]).map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              aria-pressed={weeks === w}
              style={{
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none', borderRadius: borderRadius.full,
                background: weeks === w ? colors.white : 'transparent',
                color: weeks === w ? colors.textPrimary : colors.textTertiary,
                fontSize: typography.fontSize.sm,
                fontWeight: weeks === w ? typography.fontWeight.semibold : typography.fontWeight.medium,
                fontFamily: typography.fontFamily, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {w}-Week
            </button>
          ))}
        </div>
        <Btn variant="secondary" onClick={handleExport} disabled={loading}>
          <Download size={14} /> Export XLSX
        </Btn>
      </div>

      {crewConflicts.length > 0 && (
        <Card padding={spacing['3']} style={{ marginBottom: spacing['4'], borderLeft: `3px solid ${colors.statusCritical}`, backgroundColor: colors.statusCriticalSubtle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'], color: colors.statusCritical, fontWeight: typography.fontWeight.semibold }}>
            <AlertTriangle size={16} /> {crewConflicts.length} crew conflict{crewConflicts.length === 1 ? '' : 's'} in the {weeks}-week window
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
            {crewConflicts.map((c) => (
              <div key={c.crew_name} style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                <strong>{c.crew_name}</strong>{' '}on{' '}{c.rows.length}{' '}overlapping entries:{' '}
                {c.rows.map((r) => r.phase_name ?? '(no phase)').join(', ')}
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
          {Array.from({ length: weeks }).map((_, i) => <Skeleton key={i} height="180px" />)}
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<Calendar size={32} color={colors.textTertiary} />}
          title={`Nothing in the ${weeks}-week window`}
          description="No phases, crews, or labor forecasts fall within this window. Add a labor forecast or crew assignment to see them here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {perWeek.map((w) => (
            <Card key={w.startISO} padding={spacing['4']}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'], flexWrap: 'wrap', gap: spacing['2'] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <div>
                    <div style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                      Week {w.index}
                    </div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                      {fmtDate(w.start)} – {fmtDate(w.end)} ({w.startISO} → {w.endISO})
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: spacing['3'], fontSize: typography.fontSize.xs, color: colors.textSecondary, flexWrap: 'wrap' }}>
                  <span><strong style={{ color: colors.textPrimary }}>{w.phases.length}</strong> phase{w.phases.length === 1 ? '' : 's'}</span>
                  <span><strong style={{ color: colors.textPrimary }}>{w.crews.length}</strong> crew{w.crews.length === 1 ? '' : 's'}</span>
                  <span>
                    <Users size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                    <strong style={{ color: colors.textPrimary }}>{w.laborHeadcount}</strong> HC{' '}·{' '}
                    <strong style={{ color: colors.textPrimary }}>{w.laborHours}</strong> h
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: spacing['3'] }}>
                <div>
                  <SectionHeader title="Phases active" />
                  {w.phases.length === 0 ? (
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, padding: spacing['2'] }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: spacing['2'] }}>
                      {w.phases.map((p) => (
                        <div key={p.id} style={{
                          display: 'flex', justifyContent: 'space-between', gap: spacing['2'],
                          padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base,
                          background: colors.surfaceInset, fontSize: typography.fontSize.sm,
                        }}>
                          <span style={{ color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.is_critical_path ? <span style={{ color: colors.statusCritical, marginRight: 4 }}>●</span> : null}
                            {p.name}
                          </span>
                          <span style={{ color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(Number(p.percent_complete ?? p.progress ?? 0))}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <SectionHeader title="Crew assignments" />
                  {w.crews.length === 0 ? (
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, padding: spacing['2'] }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: spacing['2'] }}>
                      {w.crews.map((c) => {
                        const isConflict = conflictCrewNames.has(c.crew_name)
                        return (
                          <div key={c.id} style={{
                            display: 'flex', justifyContent: 'space-between', gap: spacing['2'],
                            padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base,
                            background: isConflict ? colors.statusCriticalSubtle : colors.surfaceInset,
                            fontSize: typography.fontSize.sm,
                          }}>
                            <span style={{ color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isConflict && <AlertTriangle size={11} color={colors.statusCritical} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                              {c.crew_name}{c.phase_name ? ` → ${c.phase_name}` : ''}
                            </span>
                            <span style={{ color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                              {c.headcount} HC
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <SectionHeader title="Labor forecast" />
                  {w.labor.length === 0 ? (
                    <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, padding: spacing['2'] }}>
                      No forecast rows for this week.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: spacing['2'] }}>
                      {w.labor.map((lf) => (
                        <div key={lf.id} style={{
                          display: 'flex', justifyContent: 'space-between', gap: spacing['2'],
                          padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base,
                          background: colors.surfaceInset, fontSize: typography.fontSize.sm,
                        }}>
                          <span style={{ color: colors.textPrimary }}>
                            <Briefcase size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {lf.trade ?? 'All trades'}
                            {lf.source === 'ai_predicted' && (
                              <span style={{ marginLeft: 6, fontSize: 10, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>AI</span>
                            )}
                          </span>
                          <span style={{ color: colors.textTertiary, fontVariantNumeric: 'tabular-nums' }}>
                            {lf.headcount_needed ?? 0} HC · {lf.hours_needed ?? 0} h
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

export default ScheduleLookahead
