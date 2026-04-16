import React, { useState } from 'react'
import { ShieldCheck, AlertTriangle, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useWarranties, useWarrantyClaims } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'warranties' | 'claims'

const tabsList: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'warranties', label: 'Warranties', icon: ShieldCheck },
  { key: 'claims', label: 'Claims', icon: AlertTriangle },
]

// ── Warranty Columns ────────────────────────────────────────

const warCol = createColumnHelper<unknown>()
const warrantyColumns = [
  warCol.accessor('item_name', {
    header: 'Item',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  warCol.accessor('category', {
    header: 'Category',
    cell: (info) => {
      const v = info.getValue() as string
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusInfo, backgroundColor: colors.statusInfoSubtle,
        }}>
          {v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
        </span>
      )
    },
  }),
  warCol.accessor('subcontractor', {
    header: 'Subcontractor',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  warCol.accessor('manufacturer', {
    header: 'Manufacturer',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  warCol.accessor('warranty_type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return (
        <span style={{ color: colors.textSecondary }}>
          {v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
        </span>
      )
    },
  }),
  warCol.accessor('start_date', {
    header: 'Start',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  warCol.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const exp = new Date(v)
      const daysUntil = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      const expColor = daysUntil < 0 ? colors.statusCritical : daysUntil <= 90 ? colors.statusPending : colors.textSecondary
      return <span style={{ color: expColor }}>{exp.toLocaleDateString()}</span>
    },
  }),
  warCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      let statusColor = colors.textTertiary
      let statusBg = colors.surfaceInset
      if (v === 'active') { statusColor = colors.statusActive; statusBg = colors.statusActiveSubtle }
      else if (v === 'expiring_soon') { statusColor = colors.statusPending; statusBg = colors.statusPendingSubtle }
      else if (v === 'expired') { statusColor = colors.statusCritical; statusBg = colors.statusCriticalSubtle }
      else if (v === 'claimed') { statusColor = colors.statusInfo; statusBg = colors.statusInfoSubtle }

      const label = v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {label}
        </span>
      )
    },
  }),
]

// ── Claims Columns ──────────────────────────────────────────

const claimCol = createColumnHelper<unknown>()
const claimColumns = [
  claimCol.accessor('claim_date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  claimCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  claimCol.accessor('warranty_item', {
    header: 'Warranty Item',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  claimCol.accessor('severity', {
    header: 'Severity',
    cell: (info) => {
      const v = info.getValue() as string
      let badgeColor = colors.textTertiary
      let badgeBg = colors.surfaceInset
      if (v === 'critical') { badgeColor = colors.statusCritical; badgeBg = colors.statusCriticalSubtle }
      else if (v === 'high') { badgeColor = colors.statusPending; badgeBg = colors.statusPendingSubtle }
      else if (v === 'medium') { badgeColor = colors.statusInfo; badgeBg = colors.statusInfoSubtle }
      else if (v === 'low') { badgeColor = colors.statusActive; badgeBg = colors.statusActiveSubtle }
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: badgeColor, backgroundColor: badgeBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: badgeColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  claimCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      let statusColor = colors.textTertiary
      let statusBg = colors.surfaceInset
      if (v === 'open') { statusColor = colors.statusInfo; statusBg = colors.statusInfoSubtle }
      else if (v === 'in_progress') { statusColor = colors.statusPending; statusBg = colors.statusPendingSubtle }
      else if (v === 'resolved') { statusColor = colors.statusActive; statusBg = colors.statusActiveSubtle }
      else if (v === 'denied') { statusColor = colors.statusCritical; statusBg = colors.statusCriticalSubtle }

      const label = v ? v.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {label}
        </span>
      )
    },
  }),
  claimCol.accessor('resolution', {
    header: 'Resolution',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() || ''}
      </span>
    ),
  }),
]

// ── Main Component ──────────────────────────────────────────

export const Warranties: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('warranties')
  const projectId = useProjectId()
  const { data: warranties, isLoading: warLoading } = useWarranties(projectId)
  const { data: claims, isLoading: claimsLoading } = useWarrantyClaims(projectId)

  const isLoading = warLoading || claimsLoading

  const now = new Date()
  const activeWarranties = warranties?.filter((w: unknown) => {
    if (!w.expiration_date) return true
    return new Date(w.expiration_date) > now
  }).length || 0

  const expiringSoon = warranties?.filter((w: unknown) => {
    if (!w.expiration_date) return false
    const exp = new Date(w.expiration_date)
    const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 90
  }).length || 0

  const expired = warranties?.filter((w: unknown) => {
    if (!w.expiration_date) return false
    return new Date(w.expiration_date) <= now
  }).length || 0

  const openClaims = claims?.filter((c: unknown) => c.status === 'open' || c.status === 'in_progress').length || 0

  const handleAddWarranty = () => {
    toast.info('Submission requires backend configuration')
  }

  const handleAddClaim = () => {
    toast.info('Submission requires backend configuration')
  }

  return (
    <PageContainer
      title="Warranties"
      subtitle="Track warranties, coverage periods, and claims"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Warranties_Report" />
          {activeTab === 'warranties' ? (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAddWarranty}>
              Add Warranty
            </Btn>
          ) : (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAddClaim}>
              File Claim
            </Btn>
          )}
        </div>
      }
    >
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: spacing['1'],
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.lg,
        padding: spacing['1'],
        marginBottom: spacing['2xl'],
        overflowX: 'auto',
      }}>
        {tabsList.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                border: 'none',
                borderRadius: borderRadius.base,
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`,
                whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          <MetricBox label="Active Warranties" value={activeWarranties} />
          <MetricBox label="Expiring Soon" value={expiringSoon} change={expiringSoon > 0 ? -1 : 0} changeLabel="within 90 days" />
          <MetricBox label="Expired" value={expired} />
          <MetricBox label="Open Claims" value={openClaims} change={openClaims > 0 ? -1 : 0} />
        </div>
      )}

      {/* Warranties Tab */}
      {activeTab === 'warranties' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="All Warranties" />
          {warranties && warranties.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={warrantyColumns} data={warranties} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No warranties added yet.
            </p>
          )}
        </Card>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Warranty Claims" />
          {claims && claims.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={claimColumns} data={claims} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No warranty claims filed yet.
            </p>
          )}
        </Card>
      )}
    </PageContainer>
  )
}

export default Warranties
