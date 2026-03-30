import React, { useState, useMemo } from 'react'
import { Leaf, Recycle, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSustainabilityMetrics, useWasteLogs } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'leed' | 'waste'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'leed', label: 'LEED Scorecard', icon: Leaf },
  { key: 'waste', label: 'Waste Tracking', icon: Recycle },
]

// ── Waste Log Columns ──────────────────────────────────────

const wasteCol = createColumnHelper<any>()
const wasteColumns = [
  wasteCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  wasteCol.accessor('material_type', {
    header: 'Material Type',
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
  wasteCol.accessor('weight_tons', {
    header: 'Weight (tons)',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{v != null ? v.toFixed(2) : ''}</span>
    },
  }),
  wasteCol.accessor('disposition', {
    header: 'Disposition',
    cell: (info) => {
      const v = info.getValue() as string
      let badgeColor = colors.textTertiary
      let badgeBg = colors.surfaceInset
      if (v === 'recycled') { badgeColor = colors.statusActive; badgeBg = colors.statusActiveSubtle }
      else if (v === 'landfill') { badgeColor = colors.statusCritical; badgeBg = colors.statusCriticalSubtle }
      else if (v === 'reused') { badgeColor = colors.statusInfo; badgeBg = colors.statusInfoSubtle }
      else if (v === 'donated') { badgeColor = colors.statusPending; badgeBg = colors.statusPendingSubtle }
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
  wasteCol.accessor('hauler', {
    header: 'Hauler',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue() || ''}</span>,
  }),
  wasteCol.accessor('manifest_number', {
    header: 'Manifest #',
    cell: (info) => (
      <span style={{ color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
        {info.getValue() || ''}
      </span>
    ),
  }),
]

// ── Certification Levels ──────────────────────────────────

function getCertLevel(score: number) {
  if (score >= 80) return { label: 'Platinum', color: '#7C3AED' }
  if (score >= 60) return { label: 'Gold', color: '#D97706' }
  if (score >= 50) return { label: 'Silver', color: '#6B7280' }
  if (score >= 40) return { label: 'Certified', color: colors.statusActive }
  return { label: 'Not Certified', color: colors.textTertiary }
}

// ── Main Component ──────────────────────────────────────────

export const Sustainability: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('leed')
  const projectId = useProjectId()
  const { data: metrics, isLoading: metricsLoading } = useSustainabilityMetrics(projectId)
  const { data: wasteLogs, isLoading: wasteLoading } = useWasteLogs(projectId)

  const isLoading = metricsLoading || wasteLoading

  // Group metrics by category
  const grouped = useMemo(() => {
    if (!metrics) return {}
    const groups: Record<string, any[]> = {}
    for (const m of metrics) {
      const cat = m.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    }
    return groups
  }, [metrics])

  // Total score
  const totalScore = useMemo(() => {
    if (!metrics) return 0
    return metrics.reduce((sum: number, m: any) => sum + (m.points_achieved || 0), 0)
  }, [metrics])

  const totalPossible = useMemo(() => {
    if (!metrics) return 0
    return metrics.reduce((sum: number, m: any) => sum + (m.points_possible || 0), 0)
  }, [metrics])

  const certLevel = getCertLevel(totalScore)

  // Waste stats
  const totalWaste = useMemo(() => {
    if (!wasteLogs) return 0
    return wasteLogs.reduce((sum: number, w: any) => sum + (w.weight_tons || 0), 0)
  }, [wasteLogs])

  const diverted = useMemo(() => {
    if (!wasteLogs) return 0
    return wasteLogs.filter((w: any) => w.disposition !== 'landfill').reduce((sum: number, w: any) => sum + (w.weight_tons || 0), 0)
  }, [wasteLogs])

  const diversionRate = totalWaste > 0 ? Math.round((diverted / totalWaste) * 100) : 0

  const handleAddWaste = () => {
    toast.info('Waste log entry requires backend configuration')
  }

  return (
    <PageContainer
      title="Sustainability"
      subtitle="LEED tracking, waste management, and environmental compliance"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Sustainability_Report" />
          {activeTab === 'waste' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAddWaste}>
              Log Waste
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
                color: isActive ? colors.primaryOrange : colors.textSecondary,
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

      {/* LEED Scorecard Tab */}
      {activeTab === 'leed' && !isLoading && (
        <>
          {/* Score Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Score" value={`${totalScore} / ${totalPossible}`} />
            <MetricBox label="Certification Level" value={certLevel.label} />
            <MetricBox label="Categories Tracked" value={Object.keys(grouped).length} />
            <MetricBox label="Credits Evaluated" value={metrics?.length || 0} />
          </div>

          {/* Certification Badge */}
          <Card padding={spacing['5']} >
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 80, height: 80, borderRadius: '50%',
              backgroundColor: certLevel.color + '15',
              marginBottom: spacing['3'],
            }}>
              <Leaf size={36} color={certLevel.color} />
            </div>
            <h2 style={{
              fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold,
              color: certLevel.color, margin: 0, marginBottom: spacing['1'],
            }}>
              LEED {certLevel.label}
            </h2>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
              {totalScore} points achieved out of {totalPossible} possible
            </p>
          </Card>

          {/* Category Breakdown */}
          {Object.entries(grouped).map(([category, items]) => {
            const catPoints = items.reduce((s: number, m: any) => s + (m.points_achieved || 0), 0)
            const catPossible = items.reduce((s: number, m: any) => s + (m.points_possible || 0), 0)
            return (
              <Card key={category} padding={spacing['4']} >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['3'] }}>
                  <SectionHeader title={category} />
                  <span style={{
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                    color: colors.primaryOrange,
                  }}>
                    {catPoints} / {catPossible} pts
                  </span>
                </div>
                {items.map((item: any) => {
                  const pct = item.points_possible > 0 ? Math.round((item.points_achieved / item.points_possible) * 100) : 0
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: `${spacing['2']} 0`,
                      borderBottom: `1px solid ${colors.borderSubtle}`,
                    }}>
                      <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                        {item.credit_name || item.metric_name || 'Credit'}
                      </span>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, minWidth: 60, textAlign: 'right' as const }}>
                        {item.points_achieved} / {item.points_possible}
                      </span>
                      <div style={{ width: 80, height: 6, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          backgroundColor: pct >= 80 ? colors.statusActive : pct >= 50 ? colors.statusPending : colors.statusCritical,
                          borderRadius: borderRadius.full,
                        }} />
                      </div>
                    </div>
                  )
                })}
              </Card>
            )
          })}

          {metrics && metrics.length === 0 && (
            <Card padding={spacing['4']}>
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: 0 }}>
                No sustainability metrics tracked yet.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Waste Tracking Tab */}
      {activeTab === 'waste' && !isLoading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
            <MetricBox label="Total Waste" value={`${totalWaste.toFixed(1)} tons`} />
            <MetricBox label="Diverted" value={`${diverted.toFixed(1)} tons`} />
            <MetricBox label="Diversion Rate" value={`${diversionRate}%`} change={diversionRate >= 75 ? 1 : diversionRate >= 50 ? 0 : -1} />
            <MetricBox label="Log Entries" value={wasteLogs?.length || 0} />
          </div>

          <Card padding={spacing['4']}>
            <SectionHeader title="Waste Log" />
            {wasteLogs && wasteLogs.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                <DataTable columns={wasteColumns} data={wasteLogs} />
              </div>
            ) : (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
                No waste logs recorded yet.
              </p>
            )}
          </Card>
        </>
      )}
    </PageContainer>
  )
}

export default Sustainability
