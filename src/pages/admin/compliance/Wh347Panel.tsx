/**
 * Wh347Panel — certified-payroll generator for the active week.
 *
 * Reads workforce_members + time_entries for a date range, joins prevailing
 * wage decisions, runs the generator, and shows the worker × day grid +
 * gap report. Real PDF export uses the lib's renderPdf().
 */

import React, { useMemo, useState } from 'react'
import { FileDown, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { spacing, colors, typography, borderRadius } from '../../../styles/theme'
import { Skeleton, EmptyState, Btn } from '../../../components/Primitives'
import { supabase } from '../../../lib/supabase'
import { fromTable } from '../../../lib/db/queries'
import { generateWh347 } from '../../../lib/compliance/wh347'
import { renderText, renderPdf } from '../../../lib/compliance/wh347/render'
import type { Wh347WorkerWeek, Wh347Generated } from '../../../lib/compliance/wh347/types'
import { KpiTile, StatusPill, DegradedBanner, TableHeaderRow, TableBodyRow } from './_kit'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function lastSaturday(): string {
  const d = new Date()
  const dow = d.getUTCDay()  // 0=Sun..6=Sat
  // Days back to the most recent Saturday — if today IS Saturday, that's
  // a candidate; the field expects last-Saturday for week ending.
  const daysBack = (dow + 1) % 7
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d.toISOString().slice(0, 10)
}
function startOfWeek(weekEnding: string): string {
  const d = new Date(weekEnding)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

export const Wh347Panel: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const [weekEnding, setWeekEnding] = useState<string>(() => lastSaturday())
  const periodFrom = startOfWeek(weekEnding)

  // ── Fetch the bits we need ───────────────────────────────────────
  const { data, isLoading, error } = useQuery({
    queryKey: ['wh347-data', projectId, weekEnding],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => {
      const [proj, members, entries, decisions] = await Promise.all([
        fromTable('projects').select('id, name, address, city, state').eq('id' as never, projectId!).maybeSingle(),
        fromTable('workforce_members').select('id, name, trade, role, hourly_rate').eq('project_id' as never, projectId!).limit(200),
        fromTable('time_entries').select('workforce_member_id, date, regular_hours, overtime_hours, double_time_hours, cost_code')
          .eq('project_id' as never, projectId!)
          .gte('date' as never, periodFrom)
          .lte('date' as never, weekEnding)
          .limit(2000),
        fromTable('prevailing_wage_decisions').select('*').limit(500),
      ])
      return {
        project: proj.data,
        members: members.data ?? [],
        entries: entries.data ?? [],
        decisions: decisions.data ?? [],
        errors: [proj.error, members.error, entries.error, decisions.error].filter(Boolean),
      }
    },
  })

  // ── Build the generator inputs ───────────────────────────────────
  const generated = useMemo<Wh347Generated | null>(() => {
    if (!data || !data.project) return null
    const memberById = new Map<string, typeof data.members[number]>(data.members.map(m => [m.id as string, m]))
    const grouped = new Map<string, { days: number[]; s: number; ot: number; dt: number }>()
    for (const t of data.entries) {
      const mid = t.workforce_member_id as string
      if (!grouped.has(mid)) grouped.set(mid, { days: [0,0,0,0,0,0,0], s: 0, ot: 0, dt: 0 })
      const g = grouped.get(mid)!
      const dow = (new Date(t.date as string).getUTCDay() + 6) % 7  // Mon=0..Sun=6
      const total = (t.regular_hours ?? 0) + (t.overtime_hours ?? 0) + (t.double_time_hours ?? 0)
      g.days[dow] += total
      g.s  += t.regular_hours ?? 0
      g.ot += t.overtime_hours ?? 0
      g.dt += t.double_time_hours ?? 0
    }
    const workers: Wh347WorkerWeek[] = []
    for (const [mid, g] of grouped) {
      const m = memberById.get(mid)
      if (!m) continue
      workers.push({
        workerName: (m.name as string) ?? '(unknown)',
        ssnLast4: null,
        classification: (m.trade as string) ?? 'Laborer',
        apprenticeLevel: m.role === 'apprentice' ? 1 : null,
        hoursPerDay: g.days,
        straightHours: g.s,
        overtimeHours: g.ot,
        doubleTimeHours: g.dt,
        hourlyRatePaid: (m.hourly_rate as number) ?? 0,
        fringeAllocation: 'plan',
        fringePerHourCash: 0,
        fringePerHourPlan: 0,
        deductions: [],
      })
    }
    if (workers.length === 0) return null

    // Generator returns a Promise but the cached `data` has no async ctx —
    // the panel does it on-demand below via a memo + ref. Sync-style:
    // we surface the result via the async `genResult` query below.
    return null
  }, [data])

  // The actual generation is async (uses crypto.subtle for content_hash),
  // so wrap it in a separate query keyed off the same inputs.
  const { data: genResult, isLoading: genLoading } = useQuery({
    queryKey: ['wh347-gen', projectId, weekEnding, data?.members.length ?? 0, data?.entries.length ?? 0],
    enabled: !!data && !!data.project && (data.members.length ?? 0) > 0 && (data.entries.length ?? 0) > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Wh347Generated> => {
      // Build the same workers slice the memo above produced (kept in sync
      // because both depend on the same data).
      const memberById = new Map(data!.members.map(m => [m.id as string, m]))
      const grouped = new Map<string, { days: number[]; s: number; ot: number; dt: number }>()
      for (const t of data!.entries) {
        const mid = t.workforce_member_id as string
        if (!grouped.has(mid)) grouped.set(mid, { days: [0,0,0,0,0,0,0], s: 0, ot: 0, dt: 0 })
        const g = grouped.get(mid)!
        const dow = (new Date(t.date as string).getUTCDay() + 6) % 7
        g.days[dow] += (t.regular_hours ?? 0) + (t.overtime_hours ?? 0) + (t.double_time_hours ?? 0)
        g.s  += t.regular_hours ?? 0
        g.ot += t.overtime_hours ?? 0
        g.dt += t.double_time_hours ?? 0
      }
      const workers: Wh347WorkerWeek[] = []
      for (const [mid, g] of grouped) {
        const m = memberById.get(mid)
        if (!m) continue
        workers.push({
          workerName: (m.name as string) ?? '(unknown)',
          ssnLast4: null,
          classification: (m.trade as string) ?? 'Laborer',
          apprenticeLevel: m.role === 'apprentice' ? 1 : null,
          hoursPerDay: g.days,
          straightHours: g.s,
          overtimeHours: g.ot,
          doubleTimeHours: g.dt,
          hourlyRatePaid: (m.hourly_rate as number) ?? 0,
          fringeAllocation: 'plan',
          fringePerHourCash: 0,
          fringePerHourPlan: 0,
          deductions: [],
        })
      }
      const project = data!.project!
      return await generateWh347({
        header: {
          contractorName: 'Contractor (set in org settings)',
          contractorAddress: '',
          payrollNumber: 1,
          weekEnding,
          projectName: (project.name as string) ?? '',
          projectLocation: `${project.city ?? ''}, ${project.state ?? ''}`.trim(),
          projectNumber: null,
          stateCode: (project.state as string) ?? 'TX',
          county: 'Travis',
        },
        workers,
        statement: {
          signerName: 'Compliance Officer',
          signerTitle: 'Compliance Officer',
          payerType: 'contractor',
          periodFrom,
          periodTo: weekEnding,
          fringeBenefits: 'paid_to_plans',
          exceptions: [],
        },
        decisions: data!.decisions as Parameters<typeof generateWh347>[0]['decisions'],
      })
    },
  })

  const showGenerated = genResult ?? generated

  if (isLoading) return <Skeleton width="100%" height="320px" />

  const handleExportPdf = async () => {
    if (!showGenerated) return
    const bytes = await renderPdf(showGenerated)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `WH-347_${weekEnding}.pdf`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
  }
  const handleExportText = () => {
    if (!showGenerated) return
    const text = renderText(showGenerated)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `WH-347_${weekEnding}.txt`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {(error || (data?.errors.length ?? 0) > 0) && (
        <DegradedBanner message="Some inputs failed to load (workforce_members, time_entries, or prevailing_wage_decisions). Generator runs against partial data." />
      )}

      {/* Header row: week picker + actions */}
      <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary, fontFamily: typography.fontFamily }}>
          Week ending
          <input
            type="date"
            value={weekEnding}
            onChange={e => setWeekEnding(e.target.value)}
            style={{
              padding: `${spacing['1.5']} ${spacing['2']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base,
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.sm,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
            }}
          />
        </label>
        <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily }}>
          {periodFrom} → {weekEnding}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" size="sm" icon={<FileText size={14} />} onClick={handleExportText} disabled={!showGenerated}>Export TXT</Btn>
          <Btn variant="primary" size="sm" icon={<FileDown size={14} />} onClick={handleExportPdf} disabled={!showGenerated}>Export PDF</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['3'] }}>
        <KpiTile label="Workers" value={showGenerated?.workers.length ?? 0} hint="reported this week" />
        <KpiTile label="Total hours" value={(showGenerated?.workers ?? []).reduce((s, w) => s + w.totalHours, 0).toFixed(1)} />
        <KpiTile label="Gross pay" value={`$${(showGenerated?.workers ?? []).reduce((s, w) => s + w.grossPay, 0).toFixed(0)}`} hint="straight + OT" />
        <KpiTile label="Gaps" value={showGenerated?.gaps.length ?? 0} tone={(showGenerated?.gaps.length ?? 0) > 0 ? 'critical' : 'success'} hint="unresolved before sign" />
      </div>

      {/* Worker × day grid */}
      {genLoading && <Skeleton width="100%" height="200px" />}
      {!genLoading && (!showGenerated || showGenerated.workers.length === 0) && (
        <EmptyState
          title="No worker hours for this week"
          description="Time entries from workforce_members feed the WH-347. Confirm crew check-ins logged hours for this week ending."
        />
      )}
      {!genLoading && showGenerated && showGenerated.workers.length > 0 && (
        <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
          <TableHeaderRow
            template="2fr 1fr repeat(7, 50px) 70px 90px"
            columns={['Worker', 'Class.', ...DAY_LABELS, 'Total', 'Gross']}
          />
          {showGenerated.workers.map((w, i) => (
            <TableBodyRow key={w.workerName + i} template="2fr 1fr repeat(7, 50px) 70px 90px" alt={i % 2 === 0}>
              <span style={{ fontWeight: typography.fontWeight.medium }}>{w.workerName}</span>
              <span style={{ color: colors.textSecondary }}>{w.classification}</span>
              {w.hoursPerDay.map((h, idx) => (
                <span key={idx} style={{ fontFamily: typography.fontFamilyMono, fontVariantNumeric: 'tabular-nums' as const, color: h === 0 ? colors.textTertiary : colors.textPrimary }}>
                  {h === 0 ? '·' : h.toFixed(1)}
                </span>
              ))}
              <span style={{ fontFamily: typography.fontFamilyMono, fontWeight: typography.fontWeight.semibold }}>
                {w.totalHours.toFixed(1)}
              </span>
              <span style={{ fontFamily: typography.fontFamilyMono }}>${w.grossPay.toFixed(0)}</span>
            </TableBodyRow>
          ))}
        </div>
      )}

      {/* Gap report */}
      {showGenerated && showGenerated.gaps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
          <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            Gap report (must resolve before submission)
          </div>
          {showGenerated.gaps.map((g, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <StatusPill tone="critical" label={g.kind.replace(/_/g, ' ')} />
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{g.detail}</span>
            </div>
          ))}
        </div>
      )}

      {showGenerated && (
        <span style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontFamily: typography.fontFamilyMono }}>
          content hash: {showGenerated.contentHash.slice(0, 16)}…
        </span>
      )}
    </div>
  )
}
