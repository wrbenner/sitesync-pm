/**
 * CoiGapsPanel — COI expirations / gaps for the active project.
 *
 * Reads from `insurance_certificates` (the canonical table). Three KPIs:
 * Active / Expiring (≤30d) / Expired. Filterable table below. Graceful-
 * degrades if the table is missing on this deployment.
 */

import React, { useMemo, useState } from 'react'
import { Mail, FileDown } from 'lucide-react'
import { spacing, colors, typography, borderRadius } from '../../../styles/theme'
import { Skeleton, EmptyState, Btn } from '../../../components/Primitives'
import { useInsuranceCertificates, getCOIStatus, type InsuranceCertificate } from '../../../hooks/queries/insurance-certificates'
import { KpiTile, StatusPill, DegradedBanner, TableHeaderRow, TableBodyRow } from './_kit'

type Filter = 'expiring_30d' | 'all' | 'expired_only'

export const CoiGapsPanel: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const { data: rows, isLoading, error } = useInsuranceCertificates(projectId)
  const [filter, setFilter] = useState<Filter>('expiring_30d')

  const certs = useMemo<InsuranceCertificate[]>(() => rows ?? [], [rows])

  const stats = useMemo(() => {
    let active = 0, expiring = 0, expired = 0
    for (const c of certs) {
      const s = getCOIStatus(c.expiration_date)
      if (s.severity === 'expired') expired += 1
      else if (s.severity === 'expiring') expiring += 1
      else if (s.severity === 'current') active += 1
    }
    return { active, expiring, expired, total: certs.length }
  }, [certs])

  const visible = useMemo(() => {
    return certs.filter(c => {
      const s = getCOIStatus(c.expiration_date)
      if (filter === 'all') return true
      if (filter === 'expired_only') return s.severity === 'expired'
      return s.severity === 'expired' || s.severity === 'expiring'
    })
  }, [certs, filter])

  if (isLoading) {
    return <Skeleton width="100%" height="320px" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      {/* Graceful-degrade banner when the table itself errors (missing column / RLS). */}
      {error && (
        <DegradedBanner message="Could not load insurance_certificates — showing cached data if any. Verify RLS policy + table presence." />
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['3'] }}>
        <KpiTile label="Active COI" value={stats.active} hint={`of ${stats.total} contractors`} tone="success" />
        <KpiTile label="Expiring ≤30d" value={stats.expiring} tone="warn" />
        <KpiTile label="Expired" value={stats.expired} tone="critical" />
        <KpiTile label="Coverage" value={`${stats.total === 0 ? 0 : Math.round((stats.active / stats.total) * 100)}%`} hint="active / total" />
      </div>

      {/* Filter + actions row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: spacing['1'] }}>
          {([
            { k: 'expiring_30d', label: 'Expiring (default)' },
            { k: 'expired_only', label: 'Expired only' },
            { k: 'all', label: 'All' },
          ] as const).map(opt => (
            <button
              key={opt.k}
              onClick={() => setFilter(opt.k as Filter)}
              style={{
                padding: `${spacing['1.5']} ${spacing['3']}`,
                border: 'none',
                borderRadius: borderRadius.base,
                backgroundColor: filter === opt.k ? colors.primaryOrange : 'transparent',
                color: filter === opt.k ? colors.white : colors.textSecondary,
                fontSize: typography.fontSize.sm,
                fontWeight: filter === opt.k ? typography.fontWeight.semibold : typography.fontWeight.normal,
                cursor: 'pointer',
                fontFamily: typography.fontFamily,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing['2'] }}>
          <Btn variant="secondary" size="sm" icon={<Mail size={14} />}>Email reminder</Btn>
          <Btn variant="ghost" size="sm" icon={<FileDown size={14} />}>Export CSV</Btn>
        </div>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <EmptyState
          title="No COI gaps detected."
          description={
            filter === 'expired_only'
              ? `No expired certificates as of ${new Date().toLocaleDateString()}.`
              : `All ${stats.total} contractors current as of ${new Date().toLocaleDateString()}.`
          }
        />
      ) : (
        <div style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg, overflow: 'hidden' }}>
          <TableHeaderRow
            template="2fr 1fr 1fr 1fr 1fr"
            columns={['Company', 'Coverage', 'Expires', 'Days', 'Status']}
          />
          {visible.map((c, i) => {
            const s = getCOIStatus(c.expiration_date)
            const tone = s.severity === 'expired' ? 'critical'
              : s.severity === 'expiring' ? 'warn'
              : s.severity === 'current' ? 'success'
              : 'neutral'
            return (
              <TableBodyRow key={c.id} template="2fr 1fr 1fr 1fr 1fr" alt={i % 2 === 0}>
                <span style={{ fontWeight: typography.fontWeight.medium }}>{c.company}</span>
                <span style={{ color: colors.textSecondary, textTransform: 'capitalize' as const }}>
                  {(c.policy_type ?? '—').replace(/_/g, ' ')}
                </span>
                <span style={{ fontFamily: typography.fontFamilyMono, color: colors.textSecondary }}>
                  {c.expiration_date ?? '—'}
                </span>
                <span style={{ fontFamily: typography.fontFamilyMono, fontVariantNumeric: 'tabular-nums' as const }}>
                  {s.daysUntil == null ? '—' : `${s.daysUntil}d`}
                </span>
                <StatusPill tone={tone} label={s.label} />
              </TableBodyRow>
            )
          })}
        </div>
      )}
    </div>
  )
}
