import React, { useState, useMemo } from 'react'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useInsuranceCertificates } from '../hooks/queries'
import { toast } from 'sonner'
import { PermissionGate } from '../components/auth/PermissionGate'

const columnHelper = createColumnHelper<any>()

function getStatus(expirationDate: string | null) {
  if (!expirationDate) return 'unknown'
  const now = new Date()
  const exp = new Date(expirationDate)
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 60) return 'expiring'
  return 'valid'
}

function statusColor(status: string) {
  if (status === 'valid') return colors.statusActive
  if (status === 'expiring') return colors.statusPending
  if (status === 'expired') return colors.statusCritical
  return colors.statusNeutral
}

function statusBg(status: string) {
  if (status === 'valid') return colors.statusActiveSubtle
  if (status === 'expiring') return colors.statusPendingSubtle
  if (status === 'expired') return colors.statusCriticalSubtle
  return colors.statusNeutralSubtle
}

const columns = [
  columnHelper.accessor('company_name', {
    header: 'Company',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor('policy_type', {
    header: 'Policy Type',
    cell: (info) => {
      const v = info.getValue() as string
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        }}>
          {v || ''}
        </span>
      )
    },
  }),
  columnHelper.accessor('carrier', {
    header: 'Carrier',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('policy_number', {
    header: 'Policy #',
    cell: (info) => <span style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('coverage_amount', {
    header: 'Coverage',
    cell: (info) => {
      const val = info.getValue() as number | null
      return (
        <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
          {val != null ? `$${val.toLocaleString()}` : ''}
        </span>
      )
    },
  }),
  columnHelper.accessor('effective_date', {
    header: 'Effective',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  columnHelper.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  columnHelper.accessor((row) => getStatus(row.expiration_date), {
    id: 'status',
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const sc = statusColor(v)
      const sb = statusBg(v)
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: sc, backgroundColor: sb,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: sc }} />
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </span>
      )
    },
  }),
  columnHelper.accessor('verified', {
    header: 'Verified',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <CheckCircle size={16} style={{ color: colors.statusActive }} />
        : <XCircle size={16} style={{ color: colors.textTertiary }} />
    },
  }),
  columnHelper.accessor('additional_insured', {
    header: 'Additional Insured',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <CheckCircle size={16} style={{ color: colors.statusActive }} />
        : <XCircle size={16} style={{ color: colors.textTertiary }} />
    },
  }),
]

export const Insurance: React.FC = () => {
  const projectId = useProjectId()
  const { data: certificates, isLoading } = useInsuranceCertificates(projectId)

  const [filterCompany, setFilterCompany] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const companies = useMemo(() => {
    if (!certificates) return []
    const set = new Set(certificates.map((c: any) => c.company_name).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [certificates])

  const policyTypes = useMemo(() => {
    if (!certificates) return []
    const set = new Set(certificates.map((c: any) => c.policy_type).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [certificates])

  const filtered = useMemo(() => {
    if (!certificates) return []
    return certificates.filter((c: any) => {
      if (filterCompany && c.company_name !== filterCompany) return false
      if (filterType !== 'all' && c.policy_type !== filterType) return false
      if (filterStatus !== 'all') {
        const s = getStatus(c.expiration_date)
        if (filterStatus !== s) return false
      }
      return true
    })
  }, [certificates, filterCompany, filterType, filterStatus])

  const metrics = useMemo(() => {
    if (!certificates) return { total: 0, compliant: 0, expiring: 0, expired: 0 }
    let compliant = 0, expiring = 0, expired = 0
    certificates.forEach((c: any) => {
      const s = getStatus(c.expiration_date)
      if (s === 'valid') compliant++
      else if (s === 'expiring') expiring++
      else if (s === 'expired') expired++
    })
    return { total: certificates.length, compliant, expiring, expired }
  }, [certificates])

  if (isLoading) {
    return (
      <PageContainer title="Insurance Certificates" subtitle="Track and manage insurance compliance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
        <div style={{ marginTop: spacing.lg }}><Skeleton width="100%" height="400px" /></div>
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Insurance Certificates" subtitle="Track and manage insurance compliance across all subcontractors">
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md, marginBottom: spacing.lg }}>
        <MetricBox label="Total Certificates" value={metrics.total} />
        <MetricBox label="Compliant" value={metrics.compliant} />
        <MetricBox label="Expiring Soon" value={metrics.expiring} />
        <MetricBox label="Expired" value={metrics.expired} />
      </div>

      {/* Filters and Actions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <SectionHeader title="All Certificates" />
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <ExportButton onExportCSV={() => toast.success('Insurance certificates exported')} pdfFilename="SiteSync_Insurance" />
            <PermissionGate permission="project.settings"><Btn onClick={() => toast.info('Certificate upload requires backend configuration')}>
              <Plus size={14} />
              Add Certificate
            </Btn></PermissionGate>
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderDefault}`,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <option value="">All Companies</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderDefault}`,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <option value="all">All Policy Types</option>
            {policyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: borderRadius.base,
              border: `1px solid ${colors.borderDefault}`,
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <option value="all">All Statuses</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <DataTable columns={columns} data={filtered || []} />
      </Card>
    </PageContainer>
  )
}

export default Insurance
