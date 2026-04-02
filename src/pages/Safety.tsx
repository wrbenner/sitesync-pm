import React, { useState, useEffect, lazy, Suspense } from 'react'
import { AlertTriangle, Camera, ClipboardCheck, Award, Eye, TrendingUp, Users, Plus } from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSafetyInspections, useIncidents, useToolboxTalks, useSafetyCertifications, useSafetyObservations, useDailyLogs } from '../hooks/queries'
import { toast } from 'sonner'

const AIPhotoAnalysis = lazy(() => import('../components/safety/AIPhotoAnalysis').then(m => ({ default: m.AIPhotoAnalysis })))

type TabKey = 'overview' | 'inspections' | 'incidents' | 'toolbox' | 'certifications' | 'observations' | 'ai_analysis'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: TrendingUp },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'observations', label: 'Observations', icon: Eye },
  { key: 'ai_analysis', label: 'AI Photo Analysis', icon: Camera },
]

// Visually hidden helper for screen readers
const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

// ── Column helpers ───────────────────────────────────────────

const inspectionCol = createColumnHelper<any>()
const inspectionColumns = [
  inspectionCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  inspectionCol.accessor('type', {
    header: 'Type',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  inspectionCol.accessor('inspector', {
    header: 'Inspector',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  inspectionCol.accessor('area', {
    header: 'Area',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  inspectionCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const statusColor = v === 'passed' ? colors.statusActive
        : v === 'failed' ? colors.statusCritical
        : v === 'pending' ? colors.statusPending
        : colors.statusInfo
      const statusBg = v === 'passed' ? colors.statusActiveSubtle
        : v === 'failed' ? colors.statusCriticalSubtle
        : v === 'pending' ? colors.statusPendingSubtle
        : colors.statusInfoSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusColor, backgroundColor: statusBg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  inspectionCol.accessor('score', {
    header: 'Score',
    cell: (info) => {
      const score = info.getValue() as number | null
      if (score == null) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const scoreColor = score >= 90 ? colors.statusActive : score >= 70 ? colors.statusPending : colors.statusCritical
      return <span style={{ fontWeight: typography.fontWeight.semibold, color: scoreColor }}>{score}%</span>
    },
  }),
]

const incidentCol = createColumnHelper<any>()
const incidentColumns = [
  incidentCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  incidentCol.accessor('incident_number', {
    header: '#',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
        {info.getValue()}
      </span>
    ),
  }),
  incidentCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ color: colors.textPrimary }}>{v ? v.replace(/_/g, ' ') : ''}</span>
    },
  }),
  incidentCol.accessor('severity', {
    header: 'Severity',
    cell: (info) => {
      const v = info.getValue() as string
      const severityColor = v === 'serious' || v === 'fatality' ? colors.statusCritical
        : v === 'moderate' ? colors.statusPending
        : colors.statusActive
      const severityBg = v === 'serious' || v === 'fatality' ? colors.statusCriticalSubtle
        : v === 'moderate' ? colors.statusPendingSubtle
        : colors.statusActiveSubtle
      const severityLabel = v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : ''
      return (
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            color: severityColor, backgroundColor: severityBg,
          }}
          aria-label={`Severity: ${severityLabel}`}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: severityColor }} aria-hidden="true" />
          <span aria-hidden="true">{severityLabel}</span>
          <span style={srOnly}>{severityLabel}</span>
        </span>
      )
    },
  }),
  incidentCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  incidentCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = info.getValue() as string
      const c = v === 'closed' ? colors.statusActive : v === 'investigating' ? colors.statusPending : colors.statusInfo
      return <span style={{ color: c, fontWeight: typography.fontWeight.medium }}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}</span>
    },
  }),
  incidentCol.accessor('osha_recordable', {
    header: 'OSHA',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <span style={{ color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>Yes</span>
        : <span style={{ color: colors.textTertiary }}>No</span>
    },
  }),
]

const talkCol = createColumnHelper<any>()
const talkColumns = [
  talkCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  talkCol.accessor('title', {
    header: 'Title',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  talkCol.accessor('topic', {
    header: 'Topic',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  talkCol.accessor('presenter', {
    header: 'Presenter',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  talkCol.accessor('attendee_count', {
    header: 'Attendees',
    cell: (info) => <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{info.getValue()}</span>,
  }),
  talkCol.accessor('duration_minutes', {
    header: 'Duration',
    cell: (info) => {
      const v = info.getValue() as number | null
      return <span style={{ color: colors.textSecondary }}>{v ? `${v} min` : ''}</span>
    },
  }),
]

const certCol = createColumnHelper<any>()
const certColumns = [
  certCol.accessor('worker_name', {
    header: 'Worker',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  certCol.accessor('company', {
    header: 'Company',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  certCol.accessor('certification_type', {
    header: 'Type',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  certCol.accessor('certification_number', {
    header: 'Cert #',
    cell: (info) => <span style={{ color: colors.textTertiary, fontFamily: 'monospace', fontSize: typography.fontSize.caption }}>{info.getValue()}</span>,
  }),
  certCol.accessor('issue_date', {
    header: 'Issued',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  certCol.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'N/A'}
      </span>
    ),
  }),
  certCol.display({
    id: 'cert_status',
    header: 'Status',
    cell: (info) => {
      const expDate = info.row.original.expiration_date
      if (!expDate) return <span style={{ color: colors.textTertiary }}>N/A</span>
      const now = new Date()
      const exp = new Date(expDate)
      const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      let label: string
      let color: string
      let bg: string
      if (daysUntil < 0) {
        label = 'Expired'
        color = colors.statusCritical
        bg = colors.statusCriticalSubtle
      } else if (daysUntil <= 60) {
        label = 'Expiring Soon'
        color = colors.statusPending
        bg = colors.statusPendingSubtle
      } else {
        label = 'Valid'
        color = colors.statusActive
        bg = colors.statusActiveSubtle
      }
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color, backgroundColor: bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color }} />
          {label}
        </span>
      )
    },
  }),
]

const obsCol = createColumnHelper<any>()
const obsColumns = [
  obsCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : ''}
      </span>
    ),
  }),
  obsCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      const isPositive = v === 'safe'
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: isPositive ? colors.statusActive : colors.statusCritical,
          backgroundColor: isPositive ? colors.statusActiveSubtle : colors.statusCriticalSubtle,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: isPositive ? colors.statusActive : colors.statusCritical }} />
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : ''}
        </span>
      )
    },
  }),
  obsCol.accessor('category', {
    header: 'Category',
    cell: (info) => <span style={{ color: colors.textPrimary }}>{info.getValue()}</span>,
  }),
  obsCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ color: colors.textSecondary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
        {info.getValue()}
      </span>
    ),
  }),
  obsCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  obsCol.accessor('follow_up_required', {
    header: 'Follow Up',
    cell: (info) => {
      const v = info.getValue()
      return v
        ? <span style={{ color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>Required</span>
        : <span style={{ color: colors.textTertiary }}>None</span>
    },
  }),
]

// ── Main Component ───────────────────────────────────────────

export const Safety: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const projectId = useProjectId()
  const { data: inspections, isLoading: loadingInspections } = useSafetyInspections(projectId)
  const { data: incidents, isLoading: loadingIncidents } = useIncidents(projectId)
  const { data: talks, isLoading: loadingTalks } = useToolboxTalks(projectId)
  const { data: certifications, isLoading: loadingCerts } = useSafetyCertifications(projectId)
  const { data: observations, isLoading: loadingObs } = useSafetyObservations(projectId)
  const { data: dailyLogsResult } = useDailyLogs(projectId)
  const dailyLogs = dailyLogsResult?.data


  // ── KPIs ───────────────────────────────────────────────────

  const lastIncident = incidents?.find(i => i.severity !== 'first_aid')
  const daysSinceIncident = lastIncident
    ? Math.floor((Date.now() - new Date(lastIncident.date).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  const totalHours = dailyLogs?.reduce((s: number, l: any) => s + (l.total_hours || 0), 0) || 1
  const recordableIncidents = incidents?.filter((i: any) => i.osha_recordable).length || 0
  const trir = ((recordableIncidents * 200000) / totalHours).toFixed(2)

  const nearMisses = incidents?.filter((i: any) => i.type === 'near_miss').length || 0
  const totalIncidents = incidents?.length || 1
  const nearMissRatio = `${nearMisses}:${totalIncidents - nearMisses}`

  const totalCerts = certifications?.length || 0
  const validCerts = certifications?.filter((c: any) => c.expiration_date && new Date(c.expiration_date) > new Date()).length || 0
  const certCompliance = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 100

  const now = new Date()
  const expiringCerts = certifications?.filter((c: any) => {
    if (!c.expiration_date) return false
    const exp = new Date(c.expiration_date)
    const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 60
  }).length || 0

  // ── Tab actions ────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    overview: '',
    inspections: 'New Inspection',
    incidents: 'Report Incident',
    toolbox: 'New Talk',
    certifications: 'Add Certification',
    observations: 'Add Observation',
  }

  const handleAdd = () => {
    toast.info('Form submission requires backend configuration')
  }

  // ── Render ─────────────────────────────────────────────────

  const isLoading = loadingInspections || loadingIncidents || loadingTalks || loadingCerts || loadingObs

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = windowWidth < 768

  return (
    <PageContainer
      title="Safety"
      subtitle="Site safety management, inspections, incidents, and compliance tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Safety_Report" />
          {activeTab !== 'overview' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd}>
              {addButtonLabel[activeTab]}
            </Btn>
          )}
        </div>
      }
    >
      {/* AI insights come from Supabase ai_insights table via PageInsightBanners */}

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
          const Icon = tab.icon
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
              {React.createElement(Icon, { size: 14 })}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && !isLoading && (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: spacing['2xl'] }}>
            <div
              style={{ minWidth: 280, flex: 1 }}
              role="status"
              aria-live="polite"
              aria-label={`Days Without Incident: ${daysSinceIncident > 900 ? '999 or more' : daysSinceIncident}`}
            >
              <MetricBox
                label="Days Without Incident"
                value={daysSinceIncident > 900 ? '999+' : daysSinceIncident}
                change={daysSinceIncident > 30 ? 1 : -1}
                changeLabel="recordable"
              />
            </div>
            <div
              style={{ minWidth: 280, flex: 1 }}
              aria-label={`Total Recordable Incident Rate: ${trir}`}
            >
              <MetricBox
                label="TRIR"
                value={trir}
                changeLabel="per 200K hours"
              />
            </div>
            <div style={{ minWidth: 280, flex: 1 }}>
              <MetricBox
                label="Open Inspections"
                value={inspections?.filter((i: any) => i.status === 'pending' || i.status === 'in_progress').length || 0}
              />
            </div>
            <div style={{ minWidth: 280, flex: 1 }}>
              <MetricBox
                label="Near Miss Ratio"
                value={nearMissRatio}
                changeLabel="near misses to incidents"
              />
            </div>
            <div style={{ minWidth: 280, flex: 1 }}>
              <MetricBox
                label="Cert Compliance"
                value={`${certCompliance}%`}
                change={certCompliance >= 90 ? 1 : -1}
              />
            </div>
            <div style={{ minWidth: 280, flex: 1 }}>
              <MetricBox
                label="Expiring Certs"
                value={expiringCerts}
                changeLabel="within 60 days"
              />
            </div>
          </div>

          {/* Recent Inspections */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Recent Inspections" />
            {inspections && inspections.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                {inspections.slice(0, 5).map((insp: any, idx: number) => (
                  <div
                    key={insp.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing['3']} 0`,
                      borderBottom: idx < Math.min(inspections.length, 5) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        {insp.type} {insp.area ? `\u2014 ${insp.area}` : ''}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                        {insp.inspector} &middot; {new Date(insp.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: insp.status === 'passed' ? colors.statusActive : insp.status === 'failed' ? colors.statusCritical : colors.statusPending,
                    }}>
                      {insp.status ? insp.status.charAt(0).toUpperCase() + insp.status.slice(1) : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
                No inspections recorded yet.
              </p>
            )}
          </Card>

          {/* Recent Incidents */}
          <Card padding={spacing['4']}>
            <SectionHeader title="Recent Incidents" />
            {incidents && incidents.length > 0 ? (
              <div style={{ marginTop: spacing['3'] }}>
                {incidents.slice(0, 5).map((inc: any, idx: number) => (
                  <div
                    key={inc.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: `${spacing['3']} 0`,
                      borderBottom: idx < Math.min(incidents.length, 5) - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                        #{inc.incident_number} {inc.type ? inc.type.replace(/_/g, ' ') : ''}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                        {inc.location} &middot; {new Date(inc.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: inc.severity === 'serious' ? colors.statusCritical : inc.severity === 'moderate' ? colors.statusPending : colors.statusActive,
                    }}>
                      {inc.severity ? inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1) : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm, margin: `${spacing['3']} 0 0` }}>
                No incidents recorded. Great job keeping the site safe!
              </p>
            )}
          </Card>

          {/* Certification Expirations */}
          {expiringCerts > 0 && (
            <Card>
              <SectionHeader title="Upcoming Certification Expirations" />
              <div style={{ marginTop: spacing['3'] }}>
                {certifications
                  ?.filter((c: any) => {
                    if (!c.expiration_date) return false
                    const exp = new Date(c.expiration_date)
                    const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    return daysUntil > 0 && daysUntil <= 60
                  })
                  .map((cert: any, idx: number) => (
                    <div
                      key={cert.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: `${spacing['3']} 0`,
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                          {cert.worker_name}
                        </p>
                        <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginTop: 2 }}>
                          {cert.certification_type} &middot; {cert.company}
                        </p>
                      </div>
                      <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: colors.statusPending }}>
                        Expires {new Date(cert.expiration_date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Inspections Tab */}
      {activeTab === 'inspections' && !isLoading && (
        <div style={{ overflowX: 'auto' }}>
          <style>{`.insp-table-wrap td:first-child,.insp-table-wrap th:first-child{position:sticky;left:0;background:white;z-index:1}`}</style>
          <div className="insp-table-wrap">
            <Card>
              <DataTable
                columns={inspectionColumns}
                data={inspections || []}
                enableSorting
              />
            </Card>
          </div>
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && !isLoading && (
        isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {(incidents || []).length === 0 && (
              <p style={{ color: colors.textTertiary, fontSize: typography.fontSize.sm }}>No incidents recorded.</p>
            )}
            {(incidents || []).map((inc: any, idx: number) => {
              const severityColor = inc.severity === 'serious' || inc.severity === 'fatality' ? colors.statusCritical
                : inc.severity === 'moderate' ? colors.statusPending
                : colors.statusActive
              const severityBg = inc.severity === 'serious' || inc.severity === 'fatality' ? colors.statusCriticalSubtle
                : inc.severity === 'moderate' ? colors.statusPendingSubtle
                : colors.statusActiveSubtle
              const statusColor = inc.status === 'closed' ? colors.statusActive : inc.status === 'investigating' ? colors.statusPending : colors.statusInfo
              return (
                <Card key={inc.id || idx} padding={spacing['4']}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.orangeText }}>
                      {inc.incident_number}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                        padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
                        fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                        color: severityColor, backgroundColor: severityBg,
                      }}
                      aria-label={`Severity: ${inc.severity ? inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1) : 'Unknown'}`}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: severityColor }} aria-hidden="true" />
                      <span aria-hidden="true">{inc.severity ? inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1) : ''}</span>
                      <span style={srOnly}>{inc.severity ? inc.severity.charAt(0).toUpperCase() + inc.severity.slice(1) : ''}</span>
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                    {inc.type ? inc.type.replace(/_/g, ' ') : ''}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['2'] }}>
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                      {inc.date ? new Date(inc.date).toLocaleDateString() : ''}
                    </span>
                    <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: statusColor }}>
                      {inc.status ? inc.status.charAt(0).toUpperCase() + inc.status.slice(1) : ''}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <DataTable
              columns={incidentColumns}
              data={incidents || []}
              enableSorting
            />
          </Card>
        )
      )}

      {/* Toolbox Talks Tab */}
      {activeTab === 'toolbox' && !isLoading && (
        <Card>
          <DataTable
            columns={talkColumns}
            data={talks || []}
            enableSorting
          />
        </Card>
      )}

      {/* Certifications Tab */}
      {activeTab === 'certifications' && !isLoading && (
        <Card>
          <DataTable
            columns={certColumns}
            data={certifications || []}
            enableSorting
          />
        </Card>
      )}

      {/* Observations Tab */}
      {activeTab === 'observations' && !isLoading && (
        <Card>
          <DataTable
            columns={obsColumns}
            data={observations || []}
            enableSorting
          />
        </Card>
      )}

      {activeTab === 'ai_analysis' && (
        <Suspense fallback={<Skeleton height="300px" />}>
          <AIPhotoAnalysis />
        </Suspense>
      )}
    </PageContainer>
  )
}

export default Safety
