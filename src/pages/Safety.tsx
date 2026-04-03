import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, ClipboardCheck, Award, Users, Plus, ShieldCheck, Shield } from 'lucide-react'
import { PageContainer, Card, Btn, Skeleton, MetricBox } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSafetyInspections, useIncidents, useToolboxTalks, useSafetyCertifications, useCorrectiveActions, useDailyLogs } from '../hooks/queries'
import { toast } from 'sonner'

type TabKey = 'incidents' | 'inspections' | 'toolbox' | 'certifications'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'certifications', label: 'Certifications', icon: Award },
]

// OSHA incident severity — dot and badge colors per design spec
const OSHA_SEVERITY: Record<string, { fg: string; bg: string; label: string }> = {
  near_miss:          { fg: '#6B7280', bg: '#F3F4F6', label: 'Near Miss' },
  first_aid:          { fg: '#F5A623', bg: '#FEF9C3', label: 'First Aid' },
  medical_treatment:  { fg: '#E67E22', bg: '#FFF7ED', label: 'Medical Treatment' },
  lost_time:          { fg: '#E74C3C', bg: '#FEF2F2', label: 'Lost Time' },
  fatality:           { fg: '#1A1A2E', bg: '#F3F4F6', label: 'Fatality' },
}

function getSeverityStyle(severity: string | null): { fg: string; bg: string; label: string } {
  if (!severity) return { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: 'Unknown' }
  return OSHA_SEVERITY[severity] ?? { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: severity.replace(/_/g, ' ') }
}

// Realistic construction safety mock data for prototype display
const MOCK_INCIDENTS = [
  {
    id: 'm1',
    date: '2026-02-19',
    type: 'medical_treatment',
    severity: 'medical_treatment',
    location: 'Level 4 Formwork Area',
    investigation_status: 'closed',
    assigned_to: 'Dave Martinez',
    injured_party_name: 'Dave Martinez',
  },
  {
    id: 'm2',
    date: '2026-01-31',
    type: 'near_miss',
    severity: 'first_aid',
    location: 'Tower Crane Staging Area',
    investigation_status: 'closed',
    assigned_to: 'Jake Thompson',
    injured_party_name: '',
  },
  {
    id: 'm3',
    date: '2026-01-14',
    type: 'first_aid',
    severity: 'first_aid',
    location: 'South Entrance Scaffold',
    investigation_status: 'closed',
    assigned_to: 'Carlos Rivera',
    injured_party_name: 'Carlos Rivera',
  },
  {
    id: 'm4',
    date: '2025-12-22',
    type: 'near_miss',
    severity: 'first_aid',
    location: 'Basement Excavation',
    investigation_status: 'closed',
    assigned_to: 'Sarah Chen',
    injured_party_name: '',
  },
  {
    id: 'm5',
    date: '2025-11-08',
    type: 'lost_time',
    severity: 'lost_time',
    location: 'Level 2 Stairwell B',
    investigation_status: 'closed',
    assigned_to: 'Mike Johnson',
    injured_party_name: 'Mike Johnson',
  },
  {
    id: 'm6',
    date: '2025-10-15',
    type: 'first_aid',
    severity: 'first_aid',
    location: 'Rooftop Mechanical Level',
    investigation_status: 'closed',
    assigned_to: 'Aisha Williams',
    injured_party_name: 'Aisha Williams',
  },
  {
    id: 'm7',
    date: '2025-09-29',
    type: 'near_miss',
    severity: 'first_aid',
    location: 'Loading Dock',
    investigation_status: 'investigating',
    assigned_to: 'Bobby Kim',
    injured_party_name: '',
  },
  {
    id: 'm8',
    date: '2025-08-20',
    type: 'medical_treatment',
    severity: 'medical_treatment',
    location: 'Electrical Room Level 1',
    investigation_status: 'closed',
    assigned_to: 'Tom Garcia',
    injured_party_name: 'Tom Garcia',
  },
]

// ── Column helpers ───────────────────────────────────────────

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
      const { fg, bg, label } = getSeverityStyle(info.getValue() as string | null)
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: fg, backgroundColor: bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: fg }} />
          {label}
        </span>
      )
    },
  }),
  incidentCol.accessor('location', {
    header: 'Location',
    cell: (info) => <span style={{ color: colors.textSecondary }}>{info.getValue()}</span>,
  }),
  incidentCol.accessor('investigation_status', {
    header: 'Status',
    cell: (info) => {
      const v = (info.getValue() as string) || 'open'
      const c = v === 'closed' ? colors.statusActive
        : v === 'investigating' ? colors.statusPending
        : colors.statusInfo
      return (
        <span style={{ color: c, fontWeight: typography.fontWeight.medium }}>
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </span>
      )
    },
  }),
  incidentCol.accessor('assigned_to', {
    header: 'Assigned To',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>{info.getValue() || '\u2014'}</span>
    ),
  }),
]

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
  talkCol.accessor('attendance_count', {
    header: 'Attendees',
    cell: (info) => (
      <span style={{ color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
        {info.getValue() ?? 0}
      </span>
    ),
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
  certCol.accessor('expiration_date', {
    header: 'Expires',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString() : 'No expiry'}
      </span>
    ),
  }),
  certCol.display({
    id: 'cert_status',
    header: 'Status',
    cell: (info) => {
      const expDate = info.row.original.expiration_date
      if (!expDate) return <span style={{ color: colors.textTertiary }}>No expiry</span>
      const daysUntil = (new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysUntil < 0) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
            color: '#FFFFFF', backgroundColor: colors.statusCritical,
            letterSpacing: '0.05em',
          }}>
            EXPIRED
          </span>
        )
      }
      if (daysUntil <= 30) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            color: colors.statusPending, backgroundColor: colors.statusPendingSubtle,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusPending }} />
            Expires in {Math.ceil(daysUntil)} days
          </span>
        )
      }
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.statusActive, backgroundColor: colors.statusActiveSubtle,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusActive }} />
          Valid
        </span>
      )
    },
  }),
]

// ── Empty State ──────────────────────────────────────────────

function EmptyState({ message, cta, onCta }: { message: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center',
    }}>
      <ShieldCheck size={40} style={{ color: colors.textTertiary }} />
      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 360 }}>
        {message}
      </p>
      {cta && onCta && (
        <Btn variant="primary" onClick={onCta} style={{ minHeight: '44px' }}>
          {cta}
        </Btn>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export const Safety: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('incidents')
  const projectId = useProjectId()

  const { data: inspections, isLoading: loadingInspections, isError: errorInspections } = useSafetyInspections(projectId)
  const { data: incidents, isLoading: loadingIncidents, isError: errorIncidents, refetch: refetchIncidents } = useIncidents(projectId)
  const { data: talks, isLoading: loadingTalks, isError: errorTalks, refetch: refetchTalks } = useToolboxTalks(projectId)
  const { data: certifications, isLoading: loadingCerts, isError: errorCerts, refetch: refetchCerts } = useSafetyCertifications(projectId)
  const { data: correctiveActions, isLoading: loadingCAs, isError: errorCAs, refetch: refetchCAs } = useCorrectiveActions(projectId)
  const { data: dailyLogsResult } = useDailyLogs(projectId)
  const dailyLogs = dailyLogsResult?.data

  // Use mock incidents when API returns empty (prototype fallback)
  const displayIncidents: any[] = (incidents || []).length > 0 ? (incidents || []) : MOCK_INCIDENTS

  // ── KPI calculations ───────────────────────────────────────

  // first_aid and near_miss do NOT reset the days counter — only medical_treatment and above do
  const recordableSeverities = ['medical_treatment', 'lost_time', 'fatality']

  const lastRecordableIncident = displayIncidents
    .filter((i: any) => recordableSeverities.includes(i.severity))
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null

  const daysSinceIncident = lastRecordableIncident
    ? Math.floor((Date.now() - new Date(lastRecordableIncident.date).getTime()) / 86400000)
    : null

  const computedHours = dailyLogs?.reduce((s: number, l: any) => s + (l.total_hours || 0), 0) ?? 0
  // Default to 250000 hours for a realistic TRIR calculation in prototype
  const totalHoursWorked = computedHours > 0 ? computedHours : 250000
  const recordableCount = displayIncidents.filter((i: any) => recordableSeverities.includes(i.severity)).length
  const trirRaw = totalHoursWorked > 0 ? (recordableCount * 200000) / totalHoursWorked : null
  const trir = trirRaw !== null ? trirRaw.toFixed(2) : null

  const openCorrectiveActions = correctiveActions?.filter(
    (ca: any) => ca.status !== 'closed' && ca.status !== 'verified'
  ).length ?? 0

  const now = new Date()

  const expiringCerts = certifications?.filter((c: any) => {
    if (!c.expiration_date) return false
    const daysUntil = (new Date(c.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 30
  }).length ?? 0

  const passCount = inspections?.filter((i: any) => i.status === 'passed').length ?? 0
  const failCount = inspections?.filter((i: any) => i.status === 'failed').length ?? 0

  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  const inspectionsThisWeek = inspections?.filter((insp: any) => {
    if (!insp.date) return false
    const d = new Date(insp.date)
    return d >= weekStart && d < weekEnd
  }).length ?? 0

  // ── MetricBox color overrides ──────────────────────────────

  const daysColor: 'success' | 'warning' | 'danger' | undefined =
    daysSinceIncident === null ? 'success'
    : daysSinceIncident > 30 ? 'success'
    : daysSinceIncident >= 10 ? 'warning'
    : 'danger'

  const trirValue = trir !== null ? parseFloat(trir) : null
  const trirColor: 'success' | 'warning' | 'danger' | undefined =
    trirValue === null ? undefined
    : trirValue <= 2.0 ? 'success'
    : trirValue <= 3.0 ? 'warning'
    : 'danger'

  const caColor: 'success' | 'warning' | 'danger' | undefined =
    openCorrectiveActions === 0 ? 'success'
    : openCorrectiveActions <= 5 ? 'warning'
    : 'danger'

  const certColor: 'success' | 'warning' | 'danger' | undefined =
    expiringCerts === 0 ? 'success' : 'warning'

  // ── Incident form state ────────────────────────────────────

  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    date: '',
    location: '',
    description: '',
    severity: '',
    injured_party_name: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const dateRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const severityRef = useRef<HTMLSelectElement>(null)
  const injuredPartyRef = useRef<HTMLInputElement>(null)

  const requiredFields: { key: keyof typeof incidentForm; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description' },
    { key: 'severity', label: 'Severity' },
    { key: 'injured_party_name', label: 'Involved party' },
  ]

  const validateField = (key: string, value: string): string => {
    if (!value.trim()) {
      const found = requiredFields.find((f) => f.key === key)
      return found ? `${found.label} is required` : 'This field is required'
    }
    return ''
  }

  const handleFieldBlur = (key: string, value: string) => {
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(key, value) }))
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
      if (errors.date) dateRef.current?.focus()
      else if (errors.location) locationRef.current?.focus()
      else if (errors.description) descriptionRef.current?.focus()
      else if (errors.severity) severityRef.current?.focus()
      else if (errors.injured_party_name) injuredPartyRef.current?.focus()
      return
    }
    toast.info('Form submission requires backend configuration')
    handleCloseModal()
  }

  const handleCloseModal = () => {
    setShowIncidentModal(false)
    setIncidentForm({ date: '', location: '', description: '', severity: '', injured_party_name: '' })
    setFieldErrors({})
  }

  // ── Window width ───────────────────────────────────────────

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = windowWidth < 768

  const isLoading = loadingInspections || loadingIncidents || loadingTalks || loadingCerts || loadingCAs
  const hasError = errorInspections || errorIncidents || errorTalks || errorCerts || errorCAs

  const handleRetry = () => {
    refetchIncidents()
    refetchTalks()
    refetchCerts()
    refetchCAs()
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <PageContainer
      title="Safety"
      subtitle="Site safety management, inspections, incidents, and compliance tracking"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Safety_Report" />
          {activeTab === 'incidents' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowIncidentModal(true)} style={{ minHeight: 44 }}>
              Report Incident
            </Btn>
          )}
          {activeTab === 'inspections' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
              New Inspection
            </Btn>
          )}
          {activeTab === 'toolbox' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
              New Talk
            </Btn>
          )}
          {activeTab === 'certifications' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
              Add Certification
            </Btn>
          )}
        </div>
      }
    >
      <style>{`@keyframes safety-pulse { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }`}</style>

      {/* Dashboard Metric Cards */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['2xl'] }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              width: '100%', minWidth: 180, height: 100,
              backgroundColor: '#E5E7EB',
              borderRadius: borderRadius.md,
              animation: 'safety-pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}>
          <MetricBox
            label="Days Since Last Incident"
            value={daysSinceIncident ?? 0}
            colorOverride={daysColor}
            changeLabel="Medical treatment or above"
          />

          {/* TRIR with benchmark sub-label */}
          <div>
            <MetricBox
              label="TRIR"
              value={trir ?? 'N/A'}
              colorOverride={trirColor}
            />
            <p style={{
              margin: '4px 0 0',
              fontSize: typography.fontSize.caption,
              color: colors.textTertiary,
              paddingLeft: spacing['1'],
            }}>
              Industry avg: 2.8
            </p>
          </div>

          <MetricBox
            label="Open Corrective Actions"
            value={openCorrectiveActions}
            colorOverride={caColor}
          />

          <MetricBox
            label="Certifications Expiring Soon"
            value={expiringCerts}
            colorOverride={certColor}
            changeLabel="Within 30 days"
          />
        </div>
      )}

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

      {/* Skeleton loaders while fetching */}
      {isLoading && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ display: 'flex', gap: spacing['3'] }}>
                <div style={{ flex: '0 0 100px', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: '0 0 140px', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                <div style={{ flex: '0 0 120px', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                <div style={{ flex: '1', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                <div style={{ flex: '0 0 90px', height: 20, backgroundColor: '#E5E7EB', borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.25}s` }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error state */}
      {!isLoading && hasError && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: `1px solid #FECACA`,
          borderRadius: borderRadius.md,
          padding: `${spacing['4']} ${spacing['5']}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing['4'],
          marginBottom: spacing['4'],
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: typography.fontWeight.medium, color: '#991B1B', fontSize: typography.fontSize.sm }}>
              Unable to load safety data
            </p>
            <p style={{ margin: '2px 0 0', color: '#B91C1C', fontSize: typography.fontSize.caption }}>
              Check your connection and try again.
            </p>
          </div>
          <Btn variant="secondary" onClick={handleRetry} style={{ flexShrink: 0 }}>
            Retry
          </Btn>
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && !isLoading && !hasError && (
        displayIncidents.length === 0 ? (
          <Card>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: `${spacing['10']} ${spacing['6']}`, gap: spacing['4'], textAlign: 'center',
            }}>
              <Shield size={48} style={{ color: colors.textTertiary }} />
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary, maxWidth: 420 }}>
                Safety tracking not yet configured. Set up your safety program to track incidents, inspections, and certifications.
              </p>
              <div style={{ display: 'flex', gap: spacing['3'], flexWrap: 'wrap', justifyContent: 'center' }}>
                <Btn variant="primary" onClick={() => setShowIncidentModal(true)} style={{ minHeight: 44 }}>
                  Report First Incident
                </Btn>
                <Btn variant="secondary" onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
                  Set Up Inspection Template
                </Btn>
              </div>
            </div>
          </Card>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Card>
              <DataTable
                columns={incidentColumns}
                data={displayIncidents}
                enableSorting
              />
            </Card>
          </div>
        )
      )}

      {/* Inspections Tab */}
      {activeTab === 'inspections' && !isLoading && !hasError && (
        (inspections || []).length === 0 ? (
          <Card>
            <EmptyState
              message="No inspections recorded. Safety tracking not yet configured."
              cta="Schedule First Inspection"
              onCta={() => toast.info('Form submission requires backend configuration')}
            />
          </Card>
        ) : (
          <>
            <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div style={{
                backgroundColor: colors.statusActiveSubtle,
                borderRadius: borderRadius.md,
                padding: `${spacing['2']} ${spacing['4']}`,
              }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
                  {passCount} Passed
                </span>
              </div>
              <div style={{
                backgroundColor: colors.statusCriticalSubtle,
                borderRadius: borderRadius.md,
                padding: `${spacing['2']} ${spacing['4']}`,
              }}>
                <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>
                  {failCount} Failed
                </span>
              </div>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Card>
                <DataTable
                  columns={inspectionColumns}
                  data={inspections || []}
                  enableSorting
                />
              </Card>
            </div>
          </>
        )
      )}

      {/* Toolbox Talks Tab */}
      {activeTab === 'toolbox' && !isLoading && !hasError && (
        (talks || []).length === 0 ? (
          <Card>
            <EmptyState
              message="No toolbox talks recorded. Safety tracking not yet configured."
              cta="Log First Toolbox Talk"
              onCta={() => toast.info('Form submission requires backend configuration')}
            />
          </Card>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Card>
              <DataTable
                columns={talkColumns}
                data={talks || []}
                enableSorting
              />
            </Card>
          </div>
        )
      )}

      {/* Certifications Tab */}
      {activeTab === 'certifications' && !isLoading && !hasError && (
        (certifications || []).length === 0 ? (
          <Card>
            <EmptyState
              message="No certifications on file. Safety tracking not yet configured."
              cta="Add First Certification"
              onCta={() => toast.info('Form submission requires backend configuration')}
            />
          </Card>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Card>
              <DataTable
                columns={certColumns}
                data={certifications || []}
                enableSorting
              />
            </Card>
          </div>
        )
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
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.date && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.date}</p>}
            </div>

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
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.location && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.location}</p>}
            </div>

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
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', backgroundColor: '#fff',
                }}
              >
                <option value="">Select severity...</option>
                <option value="first_aid">First Aid</option>
                <option value="medical_treatment">Medical Treatment</option>
                <option value="lost_time">Lost Time</option>
                <option value="fatality">Fatality</option>
              </select>
              {fieldErrors.severity && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.severity}</p>}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Involved Party<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <input
                ref={injuredPartyRef}
                type="text"
                placeholder="Name or crew"
                value={incidentForm.injured_party_name}
                onChange={(e) => setIncidentForm((p) => ({ ...p, injured_party_name: e.target.value }))}
                onBlur={(e) => handleFieldBlur('injured_party_name', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.injured_party_name ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.injured_party_name && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.injured_party_name}</p>}
            </div>

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
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, resize: 'vertical', outline: 'none',
                }}
              />
              {fieldErrors.description && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.description}</p>}
            </div>

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
