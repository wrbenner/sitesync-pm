/**
 * Osha300Panel — annual OSHA 300 / 300A / 301 generator.
 *
 * Reads `incidents` for the year and feeds the lib's pure builders.
 * Sub-tabs switch between the three forms. ITA portal CSV export.
 *
 * Graceful-degrades when the incidents table is missing the OSHA-specific
 * columns (`days_away`, `days_restricted`, `case_classification`) — older
 * deployments have only `severity` and `description`. The lib's classifier
 * handles `null` + the `default → other_recordable` fall-through.
 */

import React, { useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { spacing, colors, typography, borderRadius } from '../../../styles/theme'
import { Skeleton, EmptyState, Btn } from '../../../components/Primitives'
import { supabase } from '../../../lib/supabase'
import { buildForm300, buildForm300A, exportItaCsv, type IncidentRow, type Form300Row } from '../../../lib/compliance/osha300'
import { KpiTile, StatusPill, DegradedBanner, TableHeaderRow, TableBodyRow } from './_kit'

type SubTab = '300' | '300A' | '301'

const CLASSIFICATION_LABEL: Record<string, { label: string; tone: 'critical' | 'warn' | 'info' | 'neutral' }> = {
  death: { label: 'Death', tone: 'critical' },
  days_away: { label: 'Days away', tone: 'warn' },
  restricted: { label: 'Restricted', tone: 'info' },
  other_recordable: { label: 'Other recordable', tone: 'neutral' },
}

export const Osha300Panel: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const [year, setYear] = useState<number>(() => new Date().getUTCFullYear())
  const [subTab, setSubTab] = useState<SubTab>('300')
  const [hoursWorked, setHoursWorked] = useState<string>('')
  const [avgEmployees, setAvgEmployees] = useState<string>('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['osha-incidents', projectId, year],
    enabled: !!projectId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('incidents')
        .select('id, type, severity, date, location, description, injured_party_name, injured_party_company, injured_party_trade, osha_recordable, days_away, days_restricted, case_classification')
        .eq('project_id', projectId!)
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31T23:59:59Z`)
        .limit(500)
      // PostgREST 42703 = column doesn't exist — fall back to minimal columns
      if (error && /column .* does not exist/i.test(error.message)) {
        const r2 = await supabase
          .from('incidents')
          .select('id, type, severity, date, location, description, injured_party_name, injured_party_company, injured_party_trade, osha_recordable')
          .eq('project_id', projectId!)
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31T23:59:59Z`)
          .limit(500)
        return { rows: (r2.data ?? []) as Record<string, unknown>[], error: r2.error, partial: true }
      }
      return { rows: (rows ?? []) as Record<string, unknown>[], error, partial: false }
    },
  })

  const { project } = useQuery({
    queryKey: ['osha-project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('name').eq('id', projectId!).maybeSingle()
      return { project: data }
    },
  }).data ?? { project: null }

  const incidents = useMemo<IncidentRow[]>(
    () => (data?.rows ?? []).map(r => ({
      id: (r.id as string),
      type: (r.type as string) ?? 'injury',
      severity: (r.severity as IncidentRow['severity']) ?? 'first_aid',
      date: (r.date as string),
      location: (r.location as string | null) ?? null,
      description: (r.description as string) ?? '',
      injured_party_name: (r.injured_party_name as string | null) ?? null,
      injured_party_company: (r.injured_party_company as string | null) ?? null,
      injured_party_trade: (r.injured_party_trade as string | null) ?? null,
      osha_recordable: (r.osha_recordable as boolean) ?? false,
      days_away: (r.days_away as number | null) ?? null,
      days_restricted: (r.days_restricted as number | null) ?? null,
      case_classification: (r.case_classification as IncidentRow['case_classification']) ?? null,
    })),
    [data],
  )

  const rows: Form300Row[] = useMemo(() => buildForm300(incidents), [incidents])
  const summary = useMemo(
    () => buildForm300A(rows, {
      year,
      establishment: (project?.name as string) ?? 'Project',
      totalHoursWorked: hoursWorked.trim() === '' ? null : Number(hoursWorked) || null,
      averageEmployeeCount: avgEmployees.trim() === '' ? null : Number(avgEmployees) || null,
    }),
    [rows, year, project, hoursWorked, avgEmployees],
  )

  const handleExportCsv = () => {
    const csv = exportItaCsv(rows, summary)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OSHA300_${year}.csv`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
  }

  if (isLoading) return <Skeleton width="100%" height="320px" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {error && !data?.partial && (
        <DegradedBanner message="Could not load incidents — check RLS + table presence." />
      )}
      {data?.partial && (
        <DegradedBanner message="Older deployment — incidents missing days_away / days_restricted / case_classification. Builder treats as zero / 'other recordable'." />
      )}

      {/* Header row: year + ITA inputs + export */}
      <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          Year
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              padding: `${spacing['1.5']} ${spacing['2']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.base,
              backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary,
              fontFamily: typography.fontFamily,
              fontSize: typography.fontSize.sm,
            }}
          >
            {[0, 1, 2, 3].map(off => {
              const y = new Date().getUTCFullYear() - off
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          Hours worked
          <input
            type="number"
            min="0"
            value={hoursWorked}
            onChange={e => setHoursWorked(e.target.value)}
            placeholder="optional"
            style={{ width: 110, padding: `${spacing['1.5']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
          Avg employees
          <input
            type="number"
            min="0"
            value={avgEmployees}
            onChange={e => setAvgEmployees(e.target.value)}
            placeholder="optional"
            style={{ width: 90, padding: `${spacing['1.5']} ${spacing['2']}`, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.base, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontFamily: typography.fontFamily, fontSize: typography.fontSize.sm }}
          />
        </label>
        <div style={{ marginLeft: 'auto' }}>
          <Btn variant="primary" size="sm" icon={<FileDown size={14} />} onClick={handleExportCsv} disabled={rows.length === 0}>
            Export ITA CSV
          </Btn>
        </div>
      </div>

      {/* KPIs from 300A summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing['3'] }}>
        <KpiTile label="Total cases" value={summary.totalCases} />
        <KpiTile label="Deaths" value={summary.totalDeaths} tone={summary.totalDeaths > 0 ? 'critical' : 'default'} />
        <KpiTile label="Days away" value={summary.totalDaysAway} tone={summary.totalDaysAway > 0 ? 'warn' : 'default'} />
        <KpiTile label="Restricted" value={summary.totalRestricted} tone={summary.totalRestricted > 0 ? 'info' : 'default'} />
        <KpiTile label="Other recordable" value={summary.totalOtherRecordable} />
      </div>

      {/* Sub-tabs: 300 / 300A / 301 */}
      <div style={{ display: 'flex', gap: spacing['1'], borderBottom: `1px solid ${colors.borderSubtle}`, paddingBottom: spacing['3'] }}>
        {(['300', '300A', '301'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: `${spacing['1.5']} ${spacing['3']}`,
              border: 'none',
              borderRadius: borderRadius.base,
              backgroundColor: subTab === t ? colors.primaryOrange : 'transparent',
              color: subTab === t ? colors.white : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontWeight: subTab === t ? typography.fontWeight.semibold : typography.fontWeight.normal,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Form {t}
          </button>
        ))}
      </div>

      {subTab === '300' && (
        rows.length === 0 ? (
          <EmptyState title={`No recordable cases in ${year}`} description="An incident must have osha_recordable = true to appear on Form 300." />
        ) : (
          <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
            <TableHeaderRow
              template="60px 1.5fr 1fr 110px 1.5fr 1fr 1fr 70px"
              columns={['Case#', 'Worker', 'Job title', 'Date', 'Description', 'Where', 'Class.', 'Days']}
            />
            {rows.map((r, i) => {
              const cls = CLASSIFICATION_LABEL[r.classification] ?? CLASSIFICATION_LABEL.other_recordable
              return (
                <TableBodyRow key={r.caseNumber} template="60px 1.5fr 1fr 110px 1.5fr 1fr 1fr 70px" alt={i % 2 === 0}>
                  <span style={{ fontFamily: typography.fontFamilyMono }}>{r.caseNumber}</span>
                  <span style={{ fontWeight: typography.fontWeight.medium }}>{r.employeeName}</span>
                  <span style={{ color: colors.textSecondary }}>{r.jobTitle}</span>
                  <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>{r.dateOfInjury}</span>
                  <span style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.description}</span>
                  <span style={{ color: colors.textSecondary }}>{r.whereOccurred}</span>
                  <StatusPill tone={cls.tone} label={cls.label} />
                  <span style={{ fontFamily: typography.fontFamilyMono, fontVariantNumeric: 'tabular-nums' as const }}>
                    {r.daysAwayFromWork + r.daysOnJobRestriction}
                  </span>
                </TableBodyRow>
              )
            })}
          </div>
        )
      )}

      {subTab === '300A' && (
        <div style={{
          padding: spacing['5'],
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.lg,
          fontFamily: typography.fontFamily,
        }}>
          <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing['1'] }}>
            Form 300A — Annual Summary
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing['4'] }}>
            Establishment: {summary.establishment} · Year: {summary.year} · Posting: {summary.postingPeriod.from} → {summary.postingPeriod.to}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: spacing['2'], columnGap: spacing['4'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            <span>Total cases</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalCases}</span>
            <span>Deaths</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalDeaths}</span>
            <span>Days-away cases</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalDaysAway}</span>
            <span>Restricted cases</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalRestricted}</span>
            <span>Other recordable</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalOtherRecordable}</span>
            <span>Total days away</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalDaysAwayDays}</span>
            <span>Total restricted days</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalRestrictedDays}</span>
            <span>Total hours worked</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.totalHoursWorked ?? '—'}</span>
            <span>Avg employees</span><span style={{ fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>{summary.averageEmployeeCount ?? '—'}</span>
          </div>
        </div>
      )}

      {subTab === '301' && (
        rows.length === 0 ? (
          <EmptyState title="No 301 detail to render" description="Form 301 needs at least one recordable case." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              Each 301 detail page is per-incident. The lib's <code>buildForm301()</code> takes per-incident text fields (whatHappened / injuryNature / bodyPart / treatment / source) — wire that capture into the incident detail UI to render full 301s here.
            </div>
            <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
              <TableHeaderRow template="60px 1fr 1fr 1fr 1fr" columns={['Case#', 'Worker', 'Date', 'Result', 'Description']} />
              {rows.map((r, i) => {
                const cls = CLASSIFICATION_LABEL[r.classification] ?? CLASSIFICATION_LABEL.other_recordable
                return (
                  <TableBodyRow key={r.caseNumber} template="60px 1fr 1fr 1fr 1fr" alt={i % 2 === 0}>
                    <span style={{ fontFamily: typography.fontFamilyMono }}>{r.caseNumber}</span>
                    <span style={{ fontWeight: typography.fontWeight.medium }}>{r.employeeName}</span>
                    <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>{r.dateOfInjury}</span>
                    <StatusPill tone={cls.tone} label={cls.label} />
                    <span style={{ color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{r.description}</span>
                  </TableBodyRow>
                )
              })}
            </div>
          </div>
        )
      )}
    </div>
  )
}
