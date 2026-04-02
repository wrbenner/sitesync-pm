import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
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

  const recordableSeverities = ['medical_treatment', 'lost_time', 'fatality']

  // Days Since Last Incident: only recordable severity levels count
  const lastRecordableIncident = incidents?.find((i: any) => recordableSeverities.includes(i.severity))
  const daysSinceIncident = lastRecordableIncident
    ? Math.floor((Date.now() - new Date(lastRecordableIncident.date).getTime()) / 86400000)
    : null

  // TRIR: uses recordable severity filter; null when no hours have been logged
  const totalHoursWorked = dailyLogs?.reduce((s: number, l: any) => s + (l.total_hours || 0), 0) ?? 0
  const recordableCount = incidents?.filter((i: any) => recordableSeverities.includes(i.severity)).length ?? 0
  const trir = totalHoursWorked > 0 ? ((recordableCount * 200000) / totalHoursWorked).toFixed(2) : null

  const nearMisses = incidents?.filter((i: any) => i.type === 'near_miss').length || 0
  const totalIncidents = incidents?.length || 1
  const nearMissRatio = `${nearMisses}:${totalIncidents - nearMisses}`

  const totalCerts = certifications?.length || 0
  const validCerts = certifications?.filter((c: any) => c.expiration_date && new Date(c.expiration_date) > new Date()).length || 0
  const certCompliance = totalCerts > 0 ? Math.round((validCerts / totalCerts) * 100) : 100

  const now = new Date()
  // Expiring within 30 days
  const expiringCerts = certifications?.filter((c: any) => {
    if (!c.expiration_date) return false
    const exp = new Date(c.expiration_date)
    const daysUntil = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 30
  }).length ?? 0

  // Open corrective actions: any incident not yet closed
  const openCorrectiveActions = incidents?.filter((i: any) => i.status !== 'closed').length ?? 0

  // Inspections This Week: Monday through Sunday of the current week
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7) // next Monday (exclusive)
  const inspectionsThisWeek = inspections?.filter((insp: any) => {
    if (!insp.date) return false
    const d = new Date(insp.date)
    return d >= weekStart && d < weekEnd
  }).length ?? 0

  // Detect when queries have settled but returned no data (tables not yet seeded)
  const isSampleData = !loadingIncidents && incidents === null

  // ── Incident form state ────────────────────────────────────

  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    date: '',
    location: '',
    description: '',
    severity: '',
    involved_persons: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const dateRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const severityRef = useRef<HTMLSelectElement>(null)
  const involvedPersonsRef = useRef<HTMLInputElement>(null)

  const requiredFields: { key: keyof typeof incidentForm; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description' },
    { key: 'severity', label: 'Severity' },
    { key: 'involved_persons', label: 'Involved persons' },
  ]

  const validateField = (key: string, value: string): string => {
    if (!value.trim()) {
      const found = requiredFields.find((f) => f.key === key)
      return found ? `${found.label} is required` : 'This field is required'
    }
    return ''
  }

  const handleFieldBlur = (key: string, value: string) => {
    const error = validateField(key, value)
    setFieldErrors((prev) => ({ ...prev, [key]: error }))
  }

  const handleIncidentSubmit = () => {
    const errors: Record<string, string> = {}
    requiredFields.forEach(({ key }) => {
      const err = validateField(key, incidentForm[key])
      if (err) errors[key] = err
    })
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast.error('Please complete all required fields')
      // Focus first invalid field
      if (errors.date) dateRef.current?.focus()
      else if (errors.location) locationRef.current?.focus()
      else if (errors.description) descriptionRef.current?.focus()
      else if (errors.severity) severityRef.current?.focus()
      else if (errors.involved_persons) involvedPersonsRef.current?.focus()
      return
    }

    toast.info('Form submission requires backend configuration')
    setShowIncidentModal(false)
    setIncidentForm({ date: '', location: '', description: '', severity: '', involved_persons: '' })
    setFieldErrors({})
  }

  const handleCloseModal = () => {
    setShowIncidentModal(false)
    setIncidentForm({ date: '', location: '', description: '', severity: '', involved_persons: '' })
    setFieldErrors({})
  }

  // ── Tab actions ────────────────────────────────────────────

  const addButtonLabel: Record<TabKey, string> = {
    overview: '',
    inspections: 'New Inspection',
    incidents: 'Report Incident',
    toolbox: 'New Talk',
    certifications: 'Add Certification',
    observations: 'Add Observation',
    ai_analysis: '',
  }

  const handleAdd = () => {
    if (activeTab === 'incidents') {
      setShowIncidentModal(true)
    } else {
      toast.info('Form submission requires backend configuration')
    }
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
  const isSmallMobile = windowWidth < 480

  return (
    <PageContainer
      title="Safety"
      subtitle="Site safety management, inspections, incidents, and compliance tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Safety_Report" />
          {activeTab !== 'overview' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={handleAdd} style={{ minHeight: 44, minWidth: 44 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} width="100%" height="100px" />)}
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && !isLoading && (
        <>
          {/* KPI Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: isMobile ? spacing.md : spacing.lg,
            marginBottom: spacing['2xl'],
          }}>
            <div
              role="status"
              aria-live="polite"
              aria-label={`Days Without Incident: ${daysSinceIncident ?? 'No recordable incidents'}`}
            >
              <MetricBox
                label="Days Without Incident"
                value={daysSinceIncident ?? 'No incidents recorded'}
                change={daysSinceIncident !== null ? (daysSinceIncident > 30 ? 1 : -1) : 1}
                changeLabel={daysSinceIncident === null ? undefined : 'recordable'}
                colorOverride={
                  daysSinceIncident === null ? 'success'
                  : daysSinceIncident > 30 ? 'success'
                  : daysSinceIncident > 0 ? 'warning'
                  : 'danger'
                }
                warning={isSampleData ? 'Sample data. Connect backend to see live metrics.' : undefined}
              />
            </div>
            <div
              aria-label={`Total Recordable Incident Rate: ${trir ?? 'N/A'}`}
            >
              <MetricBox
                label="TRIR"
                value={trir ?? 'N/A'}
                changeLabel={trir === null ? 'log crew hours to calculate' : 'per 200K hours'}
                colorOverride={
                  trir === null ? undefined
                  : parseFloat(trir) > 3.0 ? 'danger'
                  : parseFloat(trir) > 2.0 ? 'warning'
                  : 'success'
                }
                warning={isSampleData ? 'Sample data. Connect backend to see live metrics.' : undefined}
              />
            </div>
            <div>
              <MetricBox
                label="Open Corrective Actions"
                value={openCorrectiveActions}
                colorOverride={
                  openCorrectiveActions === 0 ? 'success'
                  : openCorrectiveActions <= 5 ? 'warning'
                  : 'danger'
                }
                warning={isSampleData ? 'Sample data. Connect backend to see live metrics.' : undefined}
              />
            </div>
            <div>
              <MetricBox
                label="Inspections This Week"
                value={inspectionsThisWeek}
                changeLabel="Mon to Sun"
                colorOverride={inspectionsThisWeek > 0 ? 'success' : 'warning'}
                warning={isSampleData ? 'Sample data. Connect backend to see live metrics.' : undefined}
              />
            </div>
            <div>
              <MetricBox
                label="Near Miss Ratio"
                value={nearMissRatio}
                changeLabel="near misses to incidents"
              />
            </div>
            <div>
              <MetricBox
                label="Cert Compliance"
                value={`${certCompliance}%`}
                change={certCompliance >= 90 ? 1 : -1}
              />
            </div>
            <div>
              <MetricBox
                label="Expiring Certs"
                value={expiringCerts}
                changeLabel="within 30 days"
                warning={isSampleData ? 'Sample data. Connect backend to see live metrics.' : undefined}
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
                    return daysUntil > 0 && daysUntil <= 30
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

      {/* Incident Creation Modal */}
      {showIncidentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report Incident"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal() }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: borderRadius.lg,
            padding: spacing['6'],
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['5'] }}>
              <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Report Incident
              </h2>
              <button
                onClick={handleCloseModal}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: colors.textSecondary, lineHeight: 1, padding: 4,
                  minHeight: '44px', minWidth: '44px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Date */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Date<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <input
                ref={dateRef}
                type="date"
                value={incidentForm.date}
                onChange={(e) => setIncidentForm((p) => ({ ...p, date: e.target.value }))}
                onBlur={(e) => handleFieldBlur('date', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.date ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  outline: 'none',
                }}
              />
              {fieldErrors.date && (
                <p style={{ color: '#E74C3C', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{fieldErrors.date}</p>
              )}
            </div>

            {/* Location */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Location<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <input
                ref={locationRef}
                type="text"
                placeholder="e.g. Level 3 stairwell"
                value={incidentForm.location}
                onChange={(e) => setIncidentForm((p) => ({ ...p, location: e.target.value }))}
                onBlur={(e) => handleFieldBlur('location', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.location ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  outline: 'none',
                }}
              />
              {fieldErrors.location && (
                <p style={{ color: '#E74C3C', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{fieldErrors.location}</p>
              )}
            </div>

            {/* Severity */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Severity<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <select
                ref={severityRef}
                value={incidentForm.severity}
                onChange={(e) => setIncidentForm((p) => ({ ...p, severity: e.target.value }))}
                onBlur={(e) => handleFieldBlur('severity', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.severity ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: incidentForm.severity ? colors.textPrimary : colors.textTertiary,
                  backgroundColor: '#fff',
                  outline: 'none',
                }}
              >
                <option value="" disabled>Select severity</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
                <option value="fatality">Fatality</option>
              </select>
              {fieldErrors.severity && (
                <p style={{ color: '#E74C3C', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{fieldErrors.severity}</p>
              )}
            </div>

            {/* Involved Persons */}
            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Involved Persons<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <input
                ref={involvedPersonsRef}
                type="text"
                placeholder="Names or crew"
                value={incidentForm.involved_persons}
                onChange={(e) => setIncidentForm((p) => ({ ...p, involved_persons: e.target.value }))}
                onBlur={(e) => handleFieldBlur('involved_persons', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.involved_persons ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  outline: 'none',
                }}
              />
              {fieldErrors.involved_persons && (
                <p style={{ color: '#E74C3C', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{fieldErrors.involved_persons}</p>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Description<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <textarea
                ref={descriptionRef}
                rows={4}
                placeholder="Describe what happened"
                value={incidentForm.description}
                onChange={(e) => setIncidentForm((p) => ({ ...p, description: e.target.value }))}
                onBlur={(e) => handleFieldBlur('description', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.description ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  color: colors.textPrimary,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              {fieldErrors.description && (
                <p style={{ color: '#E74C3C', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{fieldErrors.description}</p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
              <Btn variant="ghost" onClick={handleCloseModal} style={{ minHeight: '44px', minWidth: '44px' }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleIncidentSubmit} style={{ minHeight: '44px', minWidth: '44px' }}>Submit Incident</Btn>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default Safety
