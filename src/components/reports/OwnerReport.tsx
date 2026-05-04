// OwnerReport — Auto-generated owner/OAC meeting report.
// Moment 5 from the product vision: the PM walks into the meeting with
// better insight than any human could compile manually.
//
// Sections:
// 1. Progress narrative (AI-generated)
// 2. Schedule dashboard (days ahead/behind, milestones, critical path)
// 3. Budget summary (committed vs spent, change orders, forecast)
// 4. Risk flags (overdue RFIs, stalled submittals, sub performance)
// 5. Photo comparison (this week vs last week)
// 6. 3-week lookahead (upcoming milestones with risk indicators)
// 7. Export PDF button

import React, { useState, useEffect, useCallback } from 'react'
import {
  Download, Calendar, DollarSign, AlertTriangle,
  CheckCircle, XCircle,
  TrendingUp, RefreshCw, Sparkles,
  AlertCircle,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { Card, Btn, SectionHeader, Tag, ProgressBar } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { ProgressTimeline } from './ProgressTimeline'
import { PhotoComparison } from './PhotoComparison'
import {
  generateOwnerReport,
  type OwnerReportData, type RiskFlag, type LookaheadItem,
} from '../../services/reportService'
import { useProjectId } from '../../hooks/useProjectId'
import { toast } from 'sonner'

// ── Helpers ──────────────────────────────────────────────

function compactDollars(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 10_000) return `$${Math.round(amount / 1000)}K`
  return `$${amount.toLocaleString()}`
}

const RISK_SEVERITY_COLORS: Record<RiskFlag['severity'], { fg: string; bg: string; icon: React.ReactNode }> = {
  critical: { fg: '#EF4444', bg: '#FEE2E2', icon: <XCircle size={16} /> },
  warning: { fg: '#F59E0B', bg: '#FEF3C7', icon: <AlertTriangle size={16} /> },
  info: { fg: '#3B82F6', bg: '#DBEAFE', icon: <AlertCircle size={16} /> },
}

const RISK_LEVEL_COLORS: Record<LookaheadItem['riskLevel'], string> = {
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  on_track: { label: 'On Track', color: '#22C55E' },
  at_risk: { label: 'At Risk', color: '#F59E0B' },
  behind: { label: 'Behind Schedule', color: '#EF4444' },
  ahead: { label: 'Ahead of Schedule', color: '#3B82F6' },
}

// ── Main Component ───────────────────────────────────────

export const OwnerReport: React.FC = () => {
  const projectId = useProjectId()
  const [report, setReport] = useState<OwnerReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const loadReport = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await generateOwnerReport(projectId)
      setReport(data)
    } catch (err) {
      setError('Failed to generate report. Please try again.')
      if (import.meta.env.DEV) console.error('Owner report generation failed:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleExportPDF = async () => {
    if (!report) return
    setExporting(true)
    const toastId = toast.loading('Generating owner report PDF…')
    try {
      const blob = await pdf(<OwnerReportPdfDoc data={report} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Owner_Report_${report.projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Owner report PDF downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`PDF export failed: ${msg}`, { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  // ── Loading State ───────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: spacing['12'], gap: spacing['4'],
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `3px solid ${colors.surfaceInset}`,
          borderTopColor: colors.primaryOrange,
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0 }}>
          Generating owner report...
        </p>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
          Compiling schedule, budget, and risk data
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Error State ─────────────────────────────────────────
  if (error || !report) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: spacing['12'], gap: spacing['3'],
      }}>
        <AlertTriangle size={36} color={colors.statusCritical} />
        <p style={{ fontSize: typography.fontSize.body, color: colors.textPrimary, margin: 0 }}>
          {error || 'Unable to load report data'}
        </p>
        <Btn variant="secondary" icon={<RefreshCw size={16} />} onClick={loadReport}>
          Retry
        </Btn>
      </div>
    )
  }

  const { scheduleSummary, budgetSummary, riskFlags, progressPhotos, lookahead, milestones, narrative } = report
  const statusInfo = STATUS_LABELS[report.overallStatus] ?? STATUS_LABELS.on_track

  // Budget waterfall chart data
  const waterfallData = [
    { name: 'Original Contract', value: budgetSummary.originalContract, fill: '#3B82F6' },
    { name: 'Change Orders', value: budgetSummary.approvedChanges, fill: budgetSummary.approvedChanges >= 0 ? '#F59E0B' : '#22C55E' },
    { name: 'Current Contract', value: budgetSummary.currentContract, fill: '#6366F1' },
    { name: 'Spent to Date', value: budgetSummary.spent, fill: '#EF4444' },
    { name: 'Committed', value: budgetSummary.committed, fill: '#F97316' },
  ]

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: spacing['8'],
        flexWrap: 'wrap',
        gap: spacing['4'],
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['2'] }}>
            <h1 style={{
              fontSize: typography.fontSize.display,
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              letterSpacing: typography.letterSpacing.tighter,
              lineHeight: typography.lineHeight.tight,
            }}>
              Owner Report
            </h1>
            <div style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              backgroundColor: statusInfo.color + '18',
              borderRadius: borderRadius.full,
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: statusInfo.color,
              }} />
              <span style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: statusInfo.color,
              }}>
                {statusInfo.label}
              </span>
            </div>
          </div>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: 0,
          }}>
            {report.projectName}{report.projectAddress ? ` \u2014 ${report.projectAddress}` : ''}
          </p>
          <p style={{
            fontSize: typography.fontSize.sm,
            color: colors.textTertiary,
            margin: 0, marginTop: spacing['1'],
          }}>
            Generated {report.reportDate}
          </p>
        </div>

        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={loadReport}
          >
            Refresh
          </Btn>
          <Btn
            variant="primary"
            icon={<Download size={16} />}
            onClick={handleExportPDF}
            loading={exporting}
          >
            Export PDF
          </Btn>
        </div>
      </div>

      {/* ── 1. Progress Narrative ──────────────────────────── */}
      <Card padding={spacing['6']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['4'] }}>
          <Sparkles size={18} color={colors.primaryOrange} />
          <h2 style={{
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            margin: 0,
          }}>
            Executive Summary
          </h2>
          <Tag
            label="AI Generated"
            color={colors.primaryOrange}
            backgroundColor={colors.orangeSubtle}
            fontSize={typography.fontSize.caption}
          />
        </div>
        <p style={{
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.normal,
          color: colors.textPrimary,
          margin: 0,
          lineHeight: typography.lineHeight.relaxed,
          letterSpacing: typography.letterSpacing.normal,
        }}>
          {narrative}
        </p>
      </Card>

      {/* ── Key Metrics Row ───────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing['4'], marginTop: spacing['5'],
      }}>
        <MetricTile
          icon={<TrendingUp size={20} />}
          label="Overall Progress"
          value={`${report.percentComplete}%`}
          sub={statusInfo.label}
          color={statusInfo.color}
        />
        <MetricTile
          icon={<Calendar size={20} />}
          label="Schedule"
          value={`${Math.abs(scheduleSummary.daysAheadBehind)}d`}
          sub={scheduleSummary.daysAheadBehind >= 0 ? 'Ahead' : 'Behind'}
          color={scheduleSummary.daysAheadBehind >= 0 ? '#22C55E' : '#EF4444'}
        />
        <MetricTile
          icon={<DollarSign size={20} />}
          label="Budget Spent"
          value={compactDollars(budgetSummary.spent)}
          sub={`of ${compactDollars(budgetSummary.currentContract)}`}
          color={budgetSummary.spent > budgetSummary.currentContract * 0.9 ? '#EF4444' : '#3B82F6'}
        />
        <MetricTile
          icon={<AlertTriangle size={20} />}
          label="Risk Flags"
          value={String(riskFlags.length)}
          sub={riskFlags.filter((r) => r.severity === 'critical').length > 0
            ? `${riskFlags.filter((r) => r.severity === 'critical').length} critical`
            : 'No critical items'
          }
          color={riskFlags.filter((r) => r.severity === 'critical').length > 0 ? '#EF4444' : '#22C55E'}
        />
      </div>

      {/* ── 2. Schedule Dashboard ─────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Schedule Dashboard" />
        <Card padding={spacing['5']}>
          {/* Phase counts */}
          <div style={{ display: 'flex', gap: spacing['6'], marginBottom: spacing['5'], flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0, lineHeight: 1 }}>
                {scheduleSummary.completedPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>Completed</p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: '#3B82F6', margin: 0, lineHeight: 1 }}>
                {scheduleSummary.inProgressPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>In Progress</p>
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.display, fontWeight: typography.fontWeight.bold, color: colors.textTertiary, margin: 0, lineHeight: 1 }}>
                {scheduleSummary.totalPhases - scheduleSummary.completedPhases - scheduleSummary.inProgressPhases}
              </p>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, marginTop: spacing['1'] }}>Remaining</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: spacing['5'] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                Phase completion
              </span>
              <span style={{
                fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary, fontVariantNumeric: 'tabular-nums',
              }}>
                {scheduleSummary.totalPhases > 0
                  ? Math.round((scheduleSummary.completedPhases / scheduleSummary.totalPhases) * 100)
                  : 0}%
              </span>
            </div>
            <ProgressBar
              value={scheduleSummary.completedPhases}
              max={scheduleSummary.totalPhases || 1}
              height={6}
            />
          </div>

          {/* Critical path items */}
          {scheduleSummary.criticalPathItems.length > 0 && (
            <div>
              <p style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                margin: 0, marginBottom: spacing['3'],
              }}>
                Critical Path
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                {scheduleSummary.criticalPathItems.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['2.5']} ${spacing['3']}`,
                    backgroundColor: colors.surfaceInset,
                    borderRadius: borderRadius.md,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: item.status === 'complete' ? '#22C55E'
                        : item.status === 'in_progress' ? '#3B82F6' : colors.textTertiary,
                    }} />
                    <span style={{
                      flex: 1, fontSize: typography.fontSize.sm,
                      color: colors.textPrimary, fontWeight: typography.fontWeight.medium,
                    }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {item.percentComplete}%
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary,
                      whiteSpace: 'nowrap',
                    }}>
                      Due {item.endDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Milestone Timeline ────────────────────────────── */}
      <div style={{ marginTop: spacing['5'] }}>
        <Card padding={spacing['5']}>
          <SectionHeader title="Project Timeline" />
          <ProgressTimeline milestones={milestones} />
        </Card>
      </div>

      {/* ── 3. Budget Summary ─────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Budget Summary" />
        <Card padding={spacing['5']}>
          {/* Budget bar chart */}
          <div style={{ height: 280, marginBottom: spacing['5'] }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.borderSubtle} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: colors.textTertiary }}
                  axisLine={{ stroke: colors.borderSubtle }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: colors.textTertiary }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => compactDollars(v)}
                />
                <Tooltip
                  formatter={((value: number) => [compactDollars(value), 'Amount']) as never}
                  contentStyle={{
                    backgroundColor: colors.surfaceRaised,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.sm,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Change orders table */}
          {budgetSummary.changeOrders.length > 0 && (
            <div>
              <p style={{
                fontSize: typography.fontSize.label,
                fontWeight: typography.fontWeight.medium,
                color: colors.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: typography.letterSpacing.wider,
                margin: 0, marginBottom: spacing['3'],
              }}>
                Change Orders
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {budgetSummary.changeOrders.slice(0, 8).map((co, idx) => (
                  <div key={idx} style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 100px 80px',
                    gap: spacing['3'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: idx % 2 === 0 ? colors.surfaceInset : 'transparent',
                    borderRadius: borderRadius.sm,
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      fontFamily: typography.fontFamilyMono,
                    }}>
                      {co.number}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      color: colors.textSecondary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {co.description}
                    </span>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: co.amount >= 0 ? '#EF4444' : '#22C55E',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {co.amount >= 0 ? '+' : ''}{compactDollars(Math.abs(co.amount))}
                    </span>
                    <Tag
                      label={co.status}
                      color={co.status === 'approved' ? '#22C55E' : co.status === 'pending' ? '#F59E0B' : colors.textTertiary}
                      backgroundColor={co.status === 'approved' ? '#DCFCE7' : co.status === 'pending' ? '#FEF3C7' : colors.surfaceInset}
                      fontSize={typography.fontSize.caption}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── 4. Risk Flags ─────────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Risk Flags" />
        {riskFlags.length === 0 ? (
          <Card padding={spacing['5']}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              padding: spacing['3'],
            }}>
              <CheckCircle size={20} color="#22C55E" />
              <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
                No active risk flags. All items within acceptable thresholds.
              </span>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {riskFlags.map((flag, idx) => {
              const sc = RISK_SEVERITY_COLORS[flag.severity]
              return (
                <Card key={idx} padding={spacing['4']}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: borderRadius.md,
                      backgroundColor: sc.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: sc.fg, flexShrink: 0,
                    }}>
                      {sc.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['1'] }}>
                        <span style={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary,
                        }}>
                          {flag.title}
                        </span>
                        <Tag
                          label={flag.severity}
                          color={sc.fg}
                          backgroundColor={sc.bg}
                          fontSize={typography.fontSize.caption}
                        />
                      </div>
                      <p style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        margin: 0,
                        lineHeight: typography.lineHeight.normal,
                      }}>
                        {flag.detail}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 5. Photo Comparison ────────────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="Progress Photos" />
        <Card padding={spacing['5']}>
          <PhotoComparison photos={progressPhotos} />
        </Card>
      </div>

      {/* ── 6. Three-Week Lookahead ───────────────────────── */}
      <div style={{ marginTop: spacing['8'] }}>
        <SectionHeader title="3-Week Lookahead" />
        {lookahead.length === 0 ? (
          <Card padding={spacing['5']}>
            <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0, textAlign: 'center' }}>
              No upcoming milestones in the next 3 weeks
            </p>
          </Card>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: spacing['3'],
          }}>
            {lookahead.map((item, idx) => (
              <Card key={idx} padding={spacing['4']}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                  {/* Risk indicator */}
                  <div style={{
                    width: 4, alignSelf: 'stretch', borderRadius: 2,
                    backgroundColor: RISK_LEVEL_COLORS[item.riskLevel],
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      margin: 0, marginBottom: spacing['1'],
                      lineHeight: typography.lineHeight.snug,
                    }}>
                      {item.name}
                    </p>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      marginBottom: item.blockers.length > 0 ? spacing['2'] : 0,
                    }}>
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                      }}>
                        {item.startDate} \u2192 {item.endDate}
                      </span>
                    </div>
                    {/* Blockers */}
                    {item.blockers.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                        {item.blockers.map((b, bIdx) => (
                          <div key={bIdx} style={{
                            display: 'flex', alignItems: 'center', gap: spacing['1.5'],
                          }}>
                            <AlertTriangle size={11} color={RISK_LEVEL_COLORS[item.riskLevel]} />
                            <span style={{
                              fontSize: typography.fontSize.caption,
                              color: RISK_LEVEL_COLORS[item.riskLevel],
                              fontWeight: typography.fontWeight.medium,
                            }}>
                              {b}
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
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{
        marginTop: spacing['10'],
        paddingTop: spacing['5'],
        borderTop: `1px solid ${colors.borderSubtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: spacing['3'],
      }}>
        <p style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          margin: 0,
        }}>
          Report generated by SiteSync PM on {report.reportDate}. Data reflects the latest project state.
        </p>
        <Btn
          variant="primary"
          icon={<Download size={16} />}
          onClick={handleExportPDF}
          loading={exporting}
        >
          Export PDF
        </Btn>
      </div>
    </div>
  )
}

// ── Metric Tile ──────────────────────────────────────────

interface MetricTileProps {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}

// ── PDF Document ─────────────────────────────────────────
// Inline @react-pdf/renderer template. Mirrors the on-screen owner
// report sections (narrative, metrics, schedule, budget, risks,
// lookahead) in a printable format.

const PDF_NAVY = '#0F1629'
const PDF_ORANGE = '#F47820'
const PDF_GRAY = '#6B7280'
const PDF_LGRAY = '#F3F4F6'
const PDF_BORDER = '#E5E7EB'

const pdfStyles = StyleSheet.create({
  page:        { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: PDF_NAVY },
  brand:       { backgroundColor: PDF_ORANGE, padding: 22, marginBottom: 18 },
  brandText:   { color: '#FFFFFF', fontSize: 18, fontWeight: 700, letterSpacing: 2 },
  title:       { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle:    { fontSize: 11, color: PDF_GRAY, marginBottom: 12 },
  metaBlock:   { borderTop: `1pt solid ${PDF_BORDER}`, paddingTop: 8, marginBottom: 14 },
  metaRow:     { flexDirection: 'row', marginBottom: 3 },
  metaLabel:   { width: 110, color: PDF_GRAY, fontSize: 9 },
  metaValue:   { fontSize: 9, color: PDF_NAVY },
  section:     { marginTop: 14, marginBottom: 6 },
  sectionH:    { fontSize: 12, fontWeight: 700, marginBottom: 8, color: PDF_NAVY },
  narrative:   { fontSize: 10, lineHeight: 1.5, color: PDF_NAVY },
  grid:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cell:        { flex: 1, padding: 10, backgroundColor: PDF_LGRAY, borderRadius: 4 },
  cellNum:     { fontSize: 18, fontWeight: 700, color: PDF_NAVY },
  cellLabel:   { fontSize: 8, color: PDF_GRAY, marginTop: 2, textTransform: 'uppercase' },
  tableHeader: { flexDirection: 'row', backgroundColor: PDF_NAVY, padding: 6 },
  thCell:      { color: '#FFFFFF', fontSize: 8, fontWeight: 700 },
  tableRow:    { flexDirection: 'row', padding: 6, borderBottom: `0.5pt solid ${PDF_BORDER}` },
  tableRowAlt: { backgroundColor: PDF_LGRAY },
  tdCell:      { fontSize: 9, color: PDF_NAVY },
  tdLight:     { fontSize: 9, color: PDF_GRAY },
  riskRow:     { flexDirection: 'row', padding: 8, marginBottom: 4, borderRadius: 3, borderLeft: `3pt solid ${PDF_GRAY}` },
  footer:      { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 8, color: PDF_GRAY, flexDirection: 'row', justifyContent: 'space-between' },
})

function dollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

const RISK_PDF_COLORS: Record<RiskFlag['severity'], string> = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
}

export const OwnerReportPdfDoc: React.FC<{ data: OwnerReportData }> = ({ data }) => {
  const { projectName, projectAddress, reportDate, narrative, percentComplete, overallStatus, scheduleSummary, budgetSummary, riskFlags, lookahead } = data

  return (
    <Document title={`Owner Report — ${projectName}`}>
      <Page size="LETTER" style={pdfStyles.page}>
        <View style={pdfStyles.brand}>
          <Text style={pdfStyles.brandText}>SITESYNC PM</Text>
        </View>
        <Text style={pdfStyles.title}>Owner Report</Text>
        <Text style={pdfStyles.subtitle}>{projectName}</Text>

        <View style={pdfStyles.metaBlock}>
          {projectAddress ? (
            <View style={pdfStyles.metaRow}>
              <Text style={pdfStyles.metaLabel}>Project Address</Text>
              <Text style={pdfStyles.metaValue}>{projectAddress}</Text>
            </View>
          ) : null}
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Report Date</Text>
            <Text style={pdfStyles.metaValue}>{reportDate}</Text>
          </View>
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Overall Status</Text>
            <Text style={pdfStyles.metaValue}>{overallStatus}</Text>
          </View>
          <View style={pdfStyles.metaRow}>
            <Text style={pdfStyles.metaLabel}>Progress</Text>
            <Text style={pdfStyles.metaValue}>{percentComplete}%</Text>
          </View>
        </View>

        {narrative ? (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionH}>Executive Summary</Text>
            <Text style={pdfStyles.narrative}>{narrative}</Text>
          </View>
        ) : null}

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionH}>Key Metrics</Text>
          <View style={pdfStyles.grid}>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{percentComplete}%</Text>
              <Text style={pdfStyles.cellLabel}>Overall Progress</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{Math.abs(scheduleSummary.daysAheadBehind)}d</Text>
              <Text style={pdfStyles.cellLabel}>{scheduleSummary.daysAheadBehind >= 0 ? 'Ahead' : 'Behind'}</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{dollars(budgetSummary.spent)}</Text>
              <Text style={pdfStyles.cellLabel}>Spent of {dollars(budgetSummary.currentContract)}</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{riskFlags.length}</Text>
              <Text style={pdfStyles.cellLabel}>Risk Flags</Text>
            </View>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionH}>Schedule</Text>
          <View style={pdfStyles.grid}>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{scheduleSummary.completedPhases}</Text>
              <Text style={pdfStyles.cellLabel}>Completed phases</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{scheduleSummary.inProgressPhases}</Text>
              <Text style={pdfStyles.cellLabel}>In progress</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{scheduleSummary.totalPhases}</Text>
              <Text style={pdfStyles.cellLabel}>Total phases</Text>
            </View>
          </View>
          {scheduleSummary.criticalPathItems.length > 0 ? (
            <View>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.thCell, { width: '55%' }]}>CRITICAL PATH ITEM</Text>
                <Text style={[pdfStyles.thCell, { width: '20%' }]}>STATUS</Text>
                <Text style={[pdfStyles.thCell, { width: '10%' }]}>% DONE</Text>
                <Text style={[pdfStyles.thCell, { width: '15%' }]}>DUE</Text>
              </View>
              {scheduleSummary.criticalPathItems.map((item, i) => (
                <View key={i} style={[pdfStyles.tableRow, i % 2 === 1 ? pdfStyles.tableRowAlt : {}]} wrap={false}>
                  <Text style={[pdfStyles.tdCell, { width: '55%' }]}>{item.name}</Text>
                  <Text style={[pdfStyles.tdLight, { width: '20%' }]}>{item.status}</Text>
                  <Text style={[pdfStyles.tdLight, { width: '10%' }]}>{item.percentComplete}%</Text>
                  <Text style={[pdfStyles.tdLight, { width: '15%' }]}>{item.endDate}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={pdfStyles.section} wrap={false}>
          <Text style={pdfStyles.sectionH}>Budget</Text>
          <View style={pdfStyles.grid}>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{dollars(budgetSummary.originalContract)}</Text>
              <Text style={pdfStyles.cellLabel}>Original contract</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{dollars(budgetSummary.approvedChanges)}</Text>
              <Text style={pdfStyles.cellLabel}>Approved CO</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{dollars(budgetSummary.currentContract)}</Text>
              <Text style={pdfStyles.cellLabel}>Current contract</Text>
            </View>
            <View style={pdfStyles.cell}>
              <Text style={pdfStyles.cellNum}>{dollars(budgetSummary.committed)}</Text>
              <Text style={pdfStyles.cellLabel}>Committed</Text>
            </View>
          </View>
          {budgetSummary.changeOrders.length > 0 ? (
            <View>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.thCell, { width: '14%' }]}>CO #</Text>
                <Text style={[pdfStyles.thCell, { width: '51%' }]}>DESCRIPTION</Text>
                <Text style={[pdfStyles.thCell, { width: '20%' }]}>AMOUNT</Text>
                <Text style={[pdfStyles.thCell, { width: '15%' }]}>STATUS</Text>
              </View>
              {budgetSummary.changeOrders.slice(0, 8).map((co, i) => (
                <View key={i} style={[pdfStyles.tableRow, i % 2 === 1 ? pdfStyles.tableRowAlt : {}]} wrap={false}>
                  <Text style={[pdfStyles.tdCell, { width: '14%', fontFamily: 'Courier' }]}>{co.number}</Text>
                  <Text style={[pdfStyles.tdCell, { width: '51%' }]}>{co.description}</Text>
                  <Text style={[pdfStyles.tdCell, { width: '20%', fontFamily: 'Courier' }]}>{dollars(co.amount)}</Text>
                  <Text style={[pdfStyles.tdLight, { width: '15%' }]}>{co.status}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {riskFlags.length > 0 ? (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionH}>Risk Flags</Text>
            {riskFlags.map((f, i) => (
              <View
                key={i}
                style={[pdfStyles.riskRow, { borderLeftColor: RISK_PDF_COLORS[f.severity], backgroundColor: PDF_LGRAY }]}
                wrap={false}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: PDF_NAVY, marginBottom: 2 }}>
                    [{f.severity.toUpperCase()}] {f.title}
                  </Text>
                  <Text style={{ fontSize: 9, color: PDF_GRAY }}>{f.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {lookahead.length > 0 ? (
          <View style={pdfStyles.section} wrap={false}>
            <Text style={pdfStyles.sectionH}>3-Week Lookahead</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.thCell, { width: '48%' }]}>ACTIVITY</Text>
              <Text style={[pdfStyles.thCell, { width: '18%' }]}>START</Text>
              <Text style={[pdfStyles.thCell, { width: '18%' }]}>END</Text>
              <Text style={[pdfStyles.thCell, { width: '16%' }]}>RISK</Text>
            </View>
            {lookahead.slice(0, 16).map((item: LookaheadItem, i) => (
              <View key={i} style={[pdfStyles.tableRow, i % 2 === 1 ? pdfStyles.tableRowAlt : {}]} wrap={false}>
                <Text style={[pdfStyles.tdCell, { width: '48%' }]}>{item.name}</Text>
                <Text style={[pdfStyles.tdLight, { width: '18%' }]}>{item.startDate}</Text>
                <Text style={[pdfStyles.tdLight, { width: '18%' }]}>{item.endDate}</Text>
                <Text style={[pdfStyles.tdCell, { width: '16%', color: item.riskLevel === 'red' ? '#DC2626' : item.riskLevel === 'yellow' ? '#D97706' : '#059669' }]}>
                  {item.riskLevel.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View
          fixed
          style={pdfStyles.footer}
          render={({ pageNumber, totalPages }) => (
            <>
              <Text>SiteSync PM — {projectName} — Owner Report {reportDate}</Text>
              <Text>Page {pageNumber} of {totalPages}</Text>
            </>
          )}
        />
      </Page>
    </Document>
  )
}

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, sub, color }) => (
  <Card padding={spacing['5']}>
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
      <span style={{ color: colors.textTertiary }}>{icon}</span>
      <span style={{
        fontSize: typography.fontSize.label,
        fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: typography.letterSpacing.wider,
      }}>
        {label}
      </span>
    </div>
    <p style={{
      fontSize: typography.fontSize.display,
      fontWeight: typography.fontWeight.bold,
      color,
      margin: 0,
      lineHeight: typography.lineHeight.none,
      letterSpacing: typography.letterSpacing.tighter,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </p>
    <p style={{
      fontSize: typography.fontSize.sm,
      color: colors.textTertiary,
      margin: 0,
      marginTop: spacing['1'],
    }}>
      {sub}
    </p>
  </Card>
)
