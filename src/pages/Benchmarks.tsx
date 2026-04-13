import React, { useState, memo } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Users,
  ShieldCheck, Package, Star,
  Lock,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, Btn, Skeleton, EmptyState } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme'
import { useBenchmarkComparisons, useSubcontractorProfiles, useMaterialPriceTrends } from '../hooks/usePlatformIntel'
import { BENCHMARK_LABELS, PROJECT_TYPE_LABELS, MATERIAL_LABELS } from '../types/platformIntel'
import type { BenchmarkComparison, SubcontractorProfile, MaterialPriceTrend, ProjectType } from '../types/platformIntel'

// ── Formatters ────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

// ── Tab Types ─────────────────────────────────────────────────

type TabKey = 'benchmarks' | 'subs' | 'materials'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { key: 'subs', label: 'Sub Reputation', icon: Users },
  { key: 'materials', label: 'Material Prices', icon: Package },
]

// ── Benchmark Comparison Card ─────────────────────────────────

const BenchmarkCard = memo<{ comparison: BenchmarkComparison }>(({ comparison }) => {
  const meta = BENCHMARK_LABELS[comparison.metric]
  const TrendIcon = comparison.trend === 'better' ? TrendingUp : comparison.trend === 'worse' ? TrendingDown : Minus
  const trendColor = comparison.trend === 'better' ? colors.statusActive : comparison.trend === 'worse' ? colors.statusCritical : colors.textTertiary
  const trendLabel = comparison.trend === 'better' ? 'Above average' : comparison.trend === 'worse' ? 'Below average' : 'Average'

  // Position indicator on the benchmark bar
  const barPosition = Math.min(100, Math.max(0, comparison.percentile))

  return (
    <Card padding={spacing['5']}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div>
          <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            {meta.label}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['1'] }}>
            <TrendIcon size={13} color={trendColor} />
            <span style={{ fontSize: typography.fontSize.caption, color: trendColor, fontWeight: typography.fontWeight.medium }}>{trendLabel}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              · {comparison.sampleSize} projects
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
            {comparison.yourValue} <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.normal, color: colors.textTertiary }}>{meta.unit}</span>
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            Avg: {comparison.benchmarkMedian} {meta.unit}
          </p>
        </div>
      </div>

      {/* Benchmark bar */}
      <div style={{ position: 'relative', marginTop: spacing['3'] }}>
        {/* Background bar with quartile zones */}
        <div style={{ display: 'flex', height: 8, borderRadius: borderRadius.full, overflow: 'hidden' }}>
          <div style={{ flex: 1, backgroundColor: colors.statusActiveSubtle }} />
          <div style={{ flex: 1, backgroundColor: colors.statusPendingSubtle }} />
          <div style={{ flex: 1, backgroundColor: colors.orangeSubtle }} />
          <div style={{ flex: 1, backgroundColor: colors.statusCriticalSubtle }} />
        </div>

        {/* Your position indicator */}
        <div style={{
          position: 'absolute', top: -4,
          left: `${barPosition}%`, transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          backgroundColor: colors.primaryOrange, border: `3px solid ${colors.surfaceRaised}`,
          boxShadow: shadows.card,
        }} />

        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: spacing['2'] }}>
          <span style={{ fontSize: '9px', color: colors.statusActive }}>Best (P25)</span>
          <span style={{ fontSize: '9px', color: colors.textTertiary }}>Median</span>
          <span style={{ fontSize: '9px', color: colors.statusCritical }}>Worst (P75)</span>
        </div>
      </div>
    </Card>
  )
})
BenchmarkCard.displayName = 'BenchmarkCard'

// ── Subcontractor Profile Card ────────────────────────────────

const SubProfileCard = memo<{ profile: SubcontractorProfile }>(({ profile }) => {
  const scoreColor = profile.overallScore >= 80 ? colors.statusActive : profile.overallScore >= 60 ? colors.statusPending : colors.statusCritical

  return (
    <Card padding={spacing['4']}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        {/* Score ring */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          border: `3px solid ${scoreColor}`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: scoreColor }}>
            {profile.overallScore}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              {profile.companyName}
            </p>
            {profile.featured && (
              <Star size={12} color={colors.primaryOrange} fill={colors.primaryOrange} />
            )}
            {profile.verified && (
              <ShieldCheck size={12} color={colors.statusActive} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginTop: spacing['0.5'] }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{profile.trade}</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>·</span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{profile.projectCount} project{profile.projectCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Metric bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing['1']} ${spacing['4']}`, marginTop: spacing['3'] }}>
            {[
              { label: 'On Time', value: profile.onTimeRate * 100, suffix: '%' },
              { label: 'Safety', value: profile.safetyScore, suffix: '' },
              { label: 'Rework', value: (1 - profile.reworkRate) * 100, suffix: '%' },
              { label: 'RFI Response', value: Math.max(0, 100 - profile.rfiResponseDays * 5), suffix: '' },
            ].map((m) => {
              const barColor = m.value >= 80 ? colors.statusActive : m.value >= 60 ? colors.statusPending : colors.statusCritical
              return (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['0.5'] }}>
                    <span style={{ fontSize: '9px', color: colors.textTertiary }}>{m.label}</span>
                    <span style={{ fontSize: '9px', fontWeight: typography.fontWeight.semibold, color: colors.textSecondary }}>{Math.round(m.value)}{m.suffix}</span>
                  </div>
                  <div style={{ height: 3, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full }}>
                    <div style={{ height: '100%', width: `${m.value}%`, backgroundColor: barColor, borderRadius: borderRadius.full }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
})
SubProfileCard.displayName = 'SubProfileCard'

// ── Material Price Row ────────────────────────────────────────

const MaterialPriceRow = memo<{ trend: MaterialPriceTrend }>(({ trend }) => {
  const meta = MATERIAL_LABELS[trend.materialType]
  if (!meta) return null
  const DirectionIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus
  const dirColor = trend.direction === 'up' ? colors.statusCritical : trend.direction === 'down' ? colors.statusActive : colors.textTertiary

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['4'],
      padding: `${spacing['3']} 0`, borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{meta.label}</p>
        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{meta.unit}</p>
      </div>
      <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, minWidth: 80, textAlign: 'right' }}>
        {fmtCurrency(trend.current)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], minWidth: 90 }}>
        <DirectionIcon size={13} color={dirColor} />
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: dirColor }}>
          {trend.changePct > 0 ? '+' : ''}{trend.changePct}%
        </span>
      </div>
      {/* Mini sparkline */}
      <div style={{ display: 'flex', alignItems: 'end', gap: 1, height: 24, minWidth: 60 }}>
        {trend.history.slice(-12).map((point, i) => {
          const max = Math.max(...trend.history.slice(-12).map((p) => p.price))
          const min = Math.min(...trend.history.slice(-12).map((p) => p.price))
          const range = max - min || 1
          const height = ((point.price - min) / range) * 20 + 4
          return (
            <div key={i} style={{
              width: 4, height: `${height}px`, borderRadius: 1,
              backgroundColor: i === trend.history.slice(-12).length - 1 ? dirColor : colors.surfaceInset,
            }} />
          )
        })}
      </div>
    </div>
  )
})
MaterialPriceRow.displayName = 'MaterialPriceRow'

// ── Main Page ─────────────────────────────────────────────────

export const Benchmarks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('benchmarks')
  const [projectType, setProjectType] = useState<ProjectType | undefined>(undefined)

  const { data: comparisons, isLoading: loadingBm } = useBenchmarkComparisons(projectType)
  const { data: subProfiles, isLoading: loadingSubs } = useSubcontractorProfiles()
  const { data: materialTrends, isLoading: loadingMat } = useMaterialPriceTrends()

  return (
    <PageContainer
      title="Platform Intelligence"
      subtitle="Cross project benchmarks, subcontractor reputation network, and material price trends"
    >
      {/* Privacy notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['3'],
        padding: `${spacing['3']} ${spacing['4']}`, marginBottom: spacing['4'],
        backgroundColor: colors.statusInfoSubtle, borderRadius: borderRadius.base,
        borderLeft: `3px solid ${colors.statusInfo}`,
      }}>
        <Lock size={14} color={colors.statusInfo} style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, lineHeight: typography.lineHeight.normal }}>
          All benchmark data is <strong>anonymized and aggregated</strong>. Individual project data is never shared across organizations. Participation is opt in.
        </p>
      </div>

      {/* Tab Switcher */}
      <div
        role="tablist"
        aria-label="Platform intelligence navigation"
        style={{
          display: 'flex', gap: spacing['1'],
          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
          padding: spacing['1'], marginBottom: spacing['2xl'], overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              role="tab"
              aria-selected={isActive}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['4']}`,
                minHeight: 56,
                border: 'none', borderRadius: borderRadius.base, cursor: 'pointer',
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                color: isActive ? colors.orangeText : colors.textSecondary,
                backgroundColor: isActive ? colors.surfaceRaised : 'transparent',
                transition: `all ${transitions.instant}`, whiteSpace: 'nowrap',
              }}
            >
              {React.createElement(tab.icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Benchmarks Tab ─────────────────────────────────── */}
      {activeTab === 'benchmarks' && (
        <div>
          {/* Project type filter */}
          <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
            <button
              onClick={() => setProjectType(undefined)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: `${spacing['1']} ${spacing['3']}`,
                minHeight: 56,
                backgroundColor: !projectType ? colors.primaryOrange : 'transparent',
                color: !projectType ? colors.white : colors.textSecondary,
                border: `1px solid ${!projectType ? colors.primaryOrange : colors.borderDefault}`,
                borderRadius: borderRadius.full, cursor: 'pointer',
                fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                fontFamily: typography.fontFamily,
              }}
            >
              All Types
            </button>
            {(['commercial_office', 'residential_multifamily', 'healthcare', 'industrial'] as const).map((pt) => (
              <button
                key={pt}
                onClick={() => setProjectType(pt)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: `${spacing['1']} ${spacing['3']}`,
                  minHeight: 56,
                  backgroundColor: projectType === pt ? colors.primaryOrange : 'transparent',
                  color: projectType === pt ? colors.white : colors.textSecondary,
                  border: `1px solid ${projectType === pt ? colors.primaryOrange : colors.borderDefault}`,
                  borderRadius: borderRadius.full, cursor: 'pointer',
                  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                }}
              >
                {PROJECT_TYPE_LABELS[pt]}
              </button>
            ))}
          </div>

          {loadingBm ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing['4'] }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} width="100%" height="180px" />)}
            </div>
          ) : comparisons && comparisons.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: spacing['4'] }}>
              {comparisons.map((c) => <BenchmarkCard key={c.metric} comparison={c} />)}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 size={32} color={colors.textTertiary} />}
              title="No benchmark data available"
              description="Benchmark comparisons will appear here once enough anonymized data is available from projects on the platform. Enable benchmarking in your organization settings to participate."
              action={<Btn onClick={() => {}} size="sm">Enable Benchmarking</Btn>}
            />
          )}
        </div>
      )}

      {/* ── Sub Reputation Tab ─────────────────────────────── */}
      {activeTab === 'subs' && (
        <div>
          {loadingSubs ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: spacing['4'] }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="200px" />)}
            </div>
          ) : subProfiles && subProfiles.length > 0 ? (
            <>
              {/* Featured subs */}
              {subProfiles.filter((s) => s.featured).length > 0 && (
                <div style={{ marginBottom: spacing['5'] }}>
                  <SectionHeader title="Top Performers" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: spacing['4'], marginTop: spacing['3'] }}>
                    {subProfiles.filter((s) => s.featured).map((p) => (
                      <SubProfileCard key={p.companyId} profile={p} />
                    ))}
                  </div>
                </div>
              )}
              <SectionHeader title="All Subcontractors" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: spacing['4'], marginTop: spacing['3'] }}>
                {subProfiles.map((p) => (
                  <SubProfileCard key={p.companyId} profile={p} />
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Users size={32} color={colors.textTertiary} />}
              title="No subcontractor data yet"
              description="Subcontractor reputation profiles build automatically as your projects progress on SiteSync. The more projects, the richer the data."
            />
          )}
        </div>
      )}

      {/* ── Material Prices Tab ────────────────────────────── */}
      {activeTab === 'materials' && (
        <div>
          {loadingMat ? (
            <Skeleton width="100%" height="400px" />
          ) : materialTrends && materialTrends.length > 0 ? (
            <Card padding={spacing['5']}>
              <SectionHeader title="Material Price Index" />
              <div style={{ marginTop: spacing['2'] }}>
                {materialTrends.map((trend) => (
                  <MaterialPriceRow key={trend.materialType} trend={trend} />
                ))}
              </div>
              <p style={{ margin: `${spacing['3']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                Prices aggregated from anonymized project budget data across the SiteSync platform. Updated quarterly.
              </p>
            </Card>
          ) : (
            <EmptyState
              icon={<Package size={32} color={colors.textTertiary} />}
              title="No material price data yet"
              description="Material price intelligence builds as more projects contribute anonymized cost data to the platform."
            />
          )}
        </div>
      )}
    </PageContainer>
  )
}

export default Benchmarks
