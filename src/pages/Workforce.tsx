import React, { useState } from 'react'
import { Users, Clock, Calendar, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useWorkforceMembers, useTimeEntries } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'roster' | 'time' | 'forecast'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'roster', label: 'Roster', icon: Users },
  { key: 'time', label: 'Time Tracking', icon: Clock },
  { key: 'forecast', label: 'Forecast', icon: Calendar },
]

// ── Column helpers ───────────────────────────────────────────

const rosterCol = createColumnHelper<any>()
const rosterColumns = [
  rosterCol.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  rosterCol.accessor('company', {
    header: 'Company',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('trade', {
    header: 'Trade',
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
  rosterCol.accessor('role', {
    header: 'Role',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('crew', {
    header: 'Crew',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  rosterCol.accessor('hourly_rate', {
    header: 'Hourly Rate',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? `$${v.toFixed(2)}` : ''}</span>
    },
  }),
  rosterCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'active' ? colors.statusActive
        : v === 'inactive' ? colors.textTertiary
        : v === 'on_leave' ? colors.statusPending
        : colors.statusInfo
      const statusBg = v === 'active' ? colors.statusActiveSubtle
        : v === 'inactive' ? colors.surfaceInset
        : v === 'on_leave' ? colors.statusPendingSubtle
        : colors.statusInfoSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''}
        </span>
      )
    },
  }),
]

const timeCol = createColumnHelper<any>()
const timeColumns = [
  timeCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  timeCol.accessor('worker_name', {
    header: 'Worker',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  timeCol.accessor('clock_in', {
    header: 'Clock In',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  timeCol.accessor('clock_out', {
    header: 'Clock Out',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  timeCol.accessor('regular_hours', {
    header: 'Regular Hrs',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? v.toFixed(1) : ''}</span>
    },
  }),
  timeCol.accessor('overtime_hours', {
    header: 'OT Hrs',
    cell: (info) => {
      const v = info.getValue() as number | null
      if (!v) return <span style={{ color: colors.textTertiary }}>0.0</span>
      return <span style={{ color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>{v.toFixed(1)}</span>
    },
  }),
  timeCol.accessor('cost_code', {
    header: 'Cost Code',
    cell: (info) => <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{info.getValue()}</span>,
  }),
  timeCol.accessor('approved', {
    header: 'Approved',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <span style={{ color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>&#10003;</span>
        : <span style={{ color: colors.textTertiary }}>&#10005;</span>
    },
  }),
]

// ── Main Component ───────────────────────────────────────────

export const Workforce: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('roster')
  const projectId = useProjectId()
  const { data: members, isLoading: loadingMembers } = useWorkforceMembers(projectId)
  const { data: timeEntries, isLoading: loadingTime } = useTimeEntries(projectId)

  const totalWorkers = members?.length || 0
  const activeToday = members?.filter((m: any) => m.status === 'active').length || 0
  const totalRegularHrs = timeEntries?.reduce((s: number, e: any) => s + (e.regular_hours || 0), 0) || 0
  const totalOTHrs = timeEntries?.reduce((s: number, e: any) => s + (e.overtime_hours || 0), 0) || 0

  const isLoading = loadingMembers || loadingTime

  // Group members by trade for forecast
  const tradeGroups: Record<string, number> = {}
  members?.forEach((m: any) => {
    const trade = m.trade || 'Unassigned'
    tradeGroups[trade] = (tradeGroups[trade] || 0) + 1
  })

  const addButtonLabel: Record<TabKey, string> = {
    roster: 'Add Worker',
    time: 'New Entry',
    forecast: '',
  }

  const handleAdd = () => {
    toast.info('Form submission requires backend configuration')
  }

  return (
    <PageContainer
      title="Workforce"
      subtitle="Manage your crew roster, track time, and plan labor needs"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Workforce_Report" />
          {activeTab !== 'forecast' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {addButtonLabel[activeTab]}
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
        {tabs.map((tab) => {
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
          <MetricBox label="Total Workers" value={totalWorkers} />
          <MetricBox label="Active Today" value={activeToday} change={activeToday > 0 ? 1 : 0} />
          <MetricBox label="Hours This Week" value={totalRegularHrs.toFixed(0)} />
          <MetricBox label="OT Hours" value={totalOTHrs.toFixed(1)} change={totalOTHrs > 40 ? -1 : 0} changeLabel="overtime" />
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === 'roster' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Crew Roster" />
          {members && members.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={rosterColumns} data={members} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No workforce members added yet.
            </p>
          )}
        </Card>
      )}

      {/* Time Tracking Tab */}
      {activeTab === 'time' && !isLoading && (
        <Card padding={spacing['4']}>
          <SectionHeader title="Time Entries" />
          {timeEntries && timeEntries.length > 0 ? (
            <div style={{ marginTop: spacing['3'] }}>
              <DataTable columns={timeColumns} data={timeEntries} />
            </div>
          ) : (
            <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
              No time entries recorded yet.
            </p>
          )}
        </Card>
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && !isLoading && (
        <>
          <SectionHeader title="Labor Forecast by Trade" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing['4'], marginTop: spacing['3'] }}>
            {Object.entries(tradeGroups).length > 0 ? Object.entries(tradeGroups).map(([trade, count]) => (
              <Card key={trade} padding={spacing['4']}>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: spacing['1'] }}>
                  {trade}
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                  {count}
                </p>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: spacing['1'] }}>
                  workers assigned
                </p>
              </Card>
            )) : (
              <Card padding={spacing['4']}>
                <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: 0 }}>
                  No workforce data available for forecasting.
                </p>
              </Card>
            )}
          </div>
        </>
      )}
    </PageContainer>
  )
}

export default Workforce
