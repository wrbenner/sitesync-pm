import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, ClipboardCheck, Award, Users, Plus, ShieldCheck, Shield, Wrench } from 'lucide-react'
import { PageContainer, Card, Btn, Skeleton, MetricBox } from '../components/Primitives'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSafetyInspections, useIncidents, useToolboxTalks, useSafetyCertifications, useCorrectiveActions, useDailyLogs } from '../hooks/queries'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

type TabKey = 'incidents' | 'inspections' | 'toolbox' | 'certifications' | 'corrective_actions'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'corrective_actions', label: 'Corrective Actions', icon: Wrench },
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


const [] = [
  {
    id: 'ca1',
    description: 'Install fall protection netting on Level 5 perimeter',
    assigned_to: 'Dave Martinez',
    due_date: '2026-04-05',
    status: 'open',
    severity: 'critical',
    created_at: '2026-03-20',
  },
  {
    id: 'ca2',
    description: 'Replace damaged scaffold planks at Section B',
    assigned_to: 'Jake Thompson',
    due_date: '2026-04-01',
    status: 'open',
    severity: 'high',
    created_at: '2026-03-25',
  },
  {
    id: 'ca3',
    description: 'Repair ground fault circuit interrupter on Level 1 panel',
    assigned_to: 'Carlos Rivera',
    due_date: '2026-04-10',
    status: 'in_progress',
    severity: 'high',
    created_at: '2026-03-28',
  },
  {
    id: 'ca4',
    description: 'Restock first aid supplies in job trailer and Level 3 box',
    assigned_to: 'Sarah Chen',
    due_date: '2026-04-07',
    status: 'in_progress',
    severity: 'medium',
    created_at: '2026-03-30',
  },
  {
    id: 'ca5',
    description: 'Clean up oil spill near loading dock entrance',
    assigned_to: 'Bobby Kim',
    due_date: '2026-03-28',
    status: 'closed',
    severity: 'medium',
    created_at: '2026-03-22',
  },
  {
    id: 'ca6',
    description: 'Post updated emergency evacuation route signage on all levels',
    assigned_to: 'Aisha Williams',
    due_date: '2026-04-15',
    status: 'open',
    severity: 'low',
    created_at: '2026-04-01',
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
  incidentCol.accessor('injured_party_name', {
    header: 'Involved Party',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>{(info.getValue() as string) || '\u2014'}</span>
    ),
  }),
  incidentCol.display({
    id: 'ca_count',
    header: 'Corrective Actions',
    cell: (info) => {
      const count = (info.row.original as Record<string, unknown>).corrective_action_count as number ?? 0
      if (count === 0) return <span style={{ color: colors.textTertiary }}>None</span>
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: colors.primaryOrange, backgroundColor: colors.orangeSubtle,
        }}>
          {count}
        </span>
      )
    },
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
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusCritical }} />
            Expires in {Math.ceil(daysUntil)}d
          </span>
        )
      }
      if (daysUntil <= 60) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            color: '#E67E22', backgroundColor: '#FFF7ED',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#E67E22' }} />
            Expires in {Math.ceil(daysUntil)}d
          </span>
        )
      }
      if (daysUntil <= 90) {
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
            padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
            color: colors.statusPending, backgroundColor: colors.statusPendingSubtle,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.statusPending }} />
            Expires in {Math.ceil(daysUntil)}d
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

const caCol = createColumnHelper<any>()
const caColumns = [
  caCol.accessor('description', {
    header: 'Description',
    cell: (info) => (
      <span style={{ fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
        {info.getValue()}
      </span>
    ),
  }),
  caCol.accessor('assigned_to', {
    header: 'Assigned To',
    cell: (info) => (
      <span style={{ color: colors.textSecondary }}>{info.getValue() || '\u2014'}</span>
    ),
  }),
  caCol.accessor('due_date', {
    header: 'Due Date',
    cell: (info) => {
      const val = info.getValue() as string | null
      if (!val) return <span style={{ color: colors.textTertiary }}>\u2014</span>
      const isOverdue = new Date(val) < new Date() && info.row.original.status !== 'closed' && info.row.original.status !== 'verified'
      return (
        <span style={{
          color: isOverdue ? colors.statusCritical : colors.textSecondary,
          fontWeight: isOverdue ? typography.fontWeight.semibold : typography.fontWeight.normal,
        }}>
          {new Date(val).toLocaleDateString()}
          {isOverdue && (
            <span style={{
              marginLeft: spacing.xs,
              fontSize: typography.fontSize.caption,
              color: colors.statusCritical,
              fontWeight: typography.fontWeight.medium,
            }}>
              {' '}OVERDUE
            </span>
          )}
        </span>
      )
    },
  }),
  caCol.accessor('severity', {
    header: 'Severity',
    cell: (info) => {
      const v = (info.getValue() as string) || 'medium'
      const colorMap: Record<string, { fg: string; bg: string }> = {
        critical: { fg: colors.statusCritical, bg: colors.statusCriticalSubtle },
        high:     { fg: '#E67E22', bg: '#FFF7ED' },
        medium:   { fg: colors.statusPending, bg: colors.statusPendingSubtle },
        low:      { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
      }
      const c = colorMap[v] ?? colorMap.medium
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: c.fg, backgroundColor: c.bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c.fg }} />
          {v.charAt(0).toUpperCase() + v.slice(1)}
        </span>
      )
    },
  }),
  caCol.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const v = (info.getValue() as string) || 'open'
      const c = v === 'closed' || v === 'verified' ? colors.statusActive
        : v === 'in_progress' ? colors.statusInfo
        : colors.statusPending
      const bg = v === 'closed' || v === 'verified' ? colors.statusActiveSubtle
        : v === 'in_progress' ? colors.statusInfoSubtle
        : colors.statusPendingSubtle
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: c, backgroundColor: bg,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: c }} />
          {v === 'in_progress' ? 'In Progress' : v.charAt(0).toUpperCase() + v.slice(1)}
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

// ── Inspection Checklist Templates ───────────────────────────

const CHECKLIST_TEMPLATES = {
  daily_walk: {
    label: 'Daily Safety Walk',
    items: [
      'PPE worn correctly by all workers on site',
      'Housekeeping complete, slip and trip hazards clear',
      'Fall protection in place at all open edges and floor openings',
      'Fire extinguishers accessible and inspection tags current',
      'Emergency exits clear and properly marked',
      'First aid kit stocked and accessible',
    ],
  },
  weekly_audit: {
    label: 'Weekly Site Audit',
    items: [
      'Scaffold inspection tags current and planks in good condition',
      'Electrical panels covered, GFCI functional and tagged',
      'Crane and rigging pre-inspection complete and documented',
      'Excavation and shoring adequate per soil classification',
      'Chemical storage proper and SDS binder current',
      'Site perimeter fencing and security intact',
    ],
  },
  monthly_equipment: {
    label: 'Monthly Equipment Inspection',
    items: [
      'Fire extinguisher hydrostatic test and service tags current',
      'Emergency eyewash and shower stations flushed and tested',
      'GFCI outlets and cords tested, tagged, and documented',
      'Equipment operator certifications current and on file',
      'Personal fall arrest harnesses and lanyards inspected',
      'AED pads and battery status current, first aid restocked',
    ],
  },
} as const

type TemplateKey = keyof typeof CHECKLIST_TEMPLATES

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
  const displayIncidents: any[] = (incidents || []).length > 0 ? (incidents || []) : []

  // Use mock corrective actions when API returns empty (prototype fallback)
  const displayCAs: any[] = (correctiveActions || []).length > 0 ? (correctiveActions || []) : []

  // ── Real-time subscriptions ────────────────────────────────

  useEffect(() => {
    if (!projectId) return
    const ch1 = supabase
      .channel(`safety-incidents-rt-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'incidents',
        filter: `project_id=eq.${projectId}`,
      }, () => { refetchIncidents() })
      .subscribe()
    const ch2 = supabase
      .channel(`safety-corrective-rt-${projectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'corrective_actions',
        filter: `project_id=eq.${projectId}`,
      }, () => { refetchCAs() })
      .subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [projectId])

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
    type: '',
    location: '',
    description: '',
    severity: '',
    injured_party_name: '',
    root_cause: '',
    ca_description: '',
    ca_assignee: '',
    ca_due_date: '',
    photo: null as File | null,
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Inspection checklist state
  const [activeTemplate, setActiveTemplate] = useState<'daily_walk' | 'weekly_audit' | 'monthly_equipment' | null>(null)
  const [checklistResults, setChecklistResults] = useState<Record<string, 'pass' | 'fail' | 'na' | null>>({})
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({})

  // Toolbox talk modal state
  const [showTalkModal, setShowTalkModal] = useState(false)
  const [talkForm, setTalkForm] = useState({
    topic: '',
    date: '',
    presenter: '',
    attendees: [] as string[],
    newAttendee: '',
  })
  const [talkErrors, setTalkErrors] = useState<Record<string, string>>({})

  const dateRef = useRef<HTMLInputElement>(null)
  const locationRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const severityRef = useRef<HTMLSelectElement>(null)
  const injuredPartyRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const photoRequiredSeverities = ['medical_treatment', 'lost_time', 'fatality']
  const isPhotoRequired = photoRequiredSeverities.includes(incidentForm.severity)

  const requiredFields: { key: keyof typeof incidentForm; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Incident type' },
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
      const err = validateField(key, String(incidentForm[key] ?? ''))
      if (err) errors[key] = err
    })
    if (isPhotoRequired && !incidentForm.photo) {
      errors.photo = 'Photo documentation is required for this severity level'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Please complete all required fields')
      if (errors.date) dateRef.current?.focus()
      else if (errors.location) locationRef.current?.focus()
      else if (errors.description) descriptionRef.current?.focus()
      else if (errors.severity) severityRef.current?.focus()
      else if (errors.injured_party_name) injuredPartyRef.current?.focus()
      else if (errors.photo) photoRef.current?.focus()
      return
    }
    toast.info('Form submission requires backend configuration')
    handleCloseModal()
  }

  const handleCloseModal = () => {
    setShowIncidentModal(false)
    setIncidentForm({ date: '', type: '', location: '', description: '', severity: '', injured_party_name: '', root_cause: '', ca_description: '', ca_assignee: '', ca_due_date: '', photo: null })
    setFieldErrors({})
  }

  // ── Toolbox talk handlers ──────────────────────────────────

  const handleAddAttendee = () => {
    const name = talkForm.newAttendee.trim()
    if (!name) return
    if (talkForm.attendees.includes(name)) {
      setTalkErrors((p) => ({ ...p, newAttendee: 'Already on the list' }))
      return
    }
    setTalkForm((p) => ({ ...p, attendees: [...p.attendees, name], newAttendee: '' }))
    setTalkErrors((p) => ({ ...p, newAttendee: '' }))
  }

  const handleRemoveAttendee = (name: string) => {
    setTalkForm((p) => ({ ...p, attendees: p.attendees.filter((a) => a !== name) }))
  }

  const handleTalkSubmit = () => {
    const errs: Record<string, string> = {}
    if (!talkForm.topic.trim()) errs.topic = 'Topic is required'
    if (!talkForm.date.trim()) errs.date = 'Date is required'
    if (!talkForm.presenter.trim()) errs.presenter = 'Presenter is required'
    setTalkErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Please complete all required fields')
      return
    }
    toast.info('Form submission requires backend configuration')
    handleCloseTalkModal()
  }

  const handleCloseTalkModal = () => {
    setShowTalkModal(false)
    setTalkForm({ topic: '', date: '', presenter: '', attendees: [], newAttendee: '' })
    setTalkErrors({})
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
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowTalkModal(true)} style={{ minHeight: 44 }}>
              New Talk
            </Btn>
          )}
          {activeTab === 'certifications' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
              Add Certification
            </Btn>
          )}
          {activeTab === 'corrective_actions' && (
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => toast.info('Form submission requires backend configuration')} style={{ minHeight: 44 }}>
              Log Corrective Action
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
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
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

          <MetricBox
            label="Inspections This Week"
            value={inspectionsThisWeek}
            colorOverride={inspectionsThisWeek > 0 ? 'success' : undefined}
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
        <>
          {/* Checklist Template Selector */}
          <Card style={{ marginBottom: spacing['4'] }}>
            <p style={{ margin: `0 0 ${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Run Inspection Checklist
            </p>
            <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap', marginBottom: activeTemplate ? spacing['5'] : 0 }}>
              {(Object.keys(CHECKLIST_TEMPLATES) as TemplateKey[]).map((key) => {
                const isActive = activeTemplate === key
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (activeTemplate === key) {
                        setActiveTemplate(null)
                        setChecklistResults({})
                        setChecklistNotes({})
                      } else {
                        setActiveTemplate(key)
                        setChecklistResults({})
                        setChecklistNotes({})
                      }
                    }}
                    style={{
                      padding: `${spacing['2']} ${spacing['4']}`,
                      border: isActive ? `1.5px solid ${colors.primaryOrange}` : `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.sm,
                      fontFamily: typography.fontFamily,
                      fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                      color: isActive ? colors.orangeText : colors.textPrimary,
                      backgroundColor: isActive ? colors.orangeSubtle : colors.surfaceRaised,
                      transition: `all ${transitions.instant}`,
                    }}
                  >
                    {CHECKLIST_TEMPLATES[key].label}
                  </button>
                )
              })}
            </div>

            {activeTemplate && (
              <>
                <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing['4'] }}>
                  {CHECKLIST_TEMPLATES[activeTemplate].items.map((item, idx) => {
                    const result = checklistResults[idx] ?? null
                    const note = checklistNotes[idx] ?? ''
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: spacing['2'],
                          padding: `${spacing['3']} 0`,
                          borderBottom: idx < CHECKLIST_TEMPLATES[activeTemplate].items.length - 1
                            ? `1px solid ${colors.borderSubtle}` : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], justifyContent: 'space-between', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, flex: 1, minWidth: 200 }}>
                            {item}
                          </span>
                          <div style={{ display: 'flex', gap: spacing['2'], flexShrink: 0 }}>
                            {(['pass', 'fail', 'na'] as const).map((val) => {
                              const isSelected = result === val
                              const btnColor = val === 'pass'
                                ? { fg: colors.statusActive, bg: colors.statusActiveSubtle, border: colors.statusActive }
                                : val === 'fail'
                                ? { fg: colors.statusCritical, bg: colors.statusCriticalSubtle, border: colors.statusCritical }
                                : { fg: colors.textSecondary, bg: colors.surfaceInset, border: colors.borderDefault }
                              return (
                                <button
                                  key={val}
                                  onClick={() => setChecklistResults((p) => ({ ...p, [idx]: isSelected ? null : val }))}
                                  style={{
                                    padding: `4px 10px`,
                                    border: isSelected ? `1.5px solid ${btnColor.border}` : `1px solid ${colors.borderDefault}`,
                                    borderRadius: borderRadius.base,
                                    cursor: 'pointer',
                                    fontSize: typography.fontSize.caption,
                                    fontWeight: isSelected ? typography.fontWeight.semibold : typography.fontWeight.normal,
                                    fontFamily: typography.fontFamily,
                                    color: isSelected ? btnColor.fg : colors.textTertiary,
                                    backgroundColor: isSelected ? btnColor.bg : 'transparent',
                                    transition: `all ${transitions.instant}`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    minHeight: 32,
                                  }}
                                >
                                  {val === 'na' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={note}
                          onChange={(e) => setChecklistNotes((p) => ({ ...p, [idx]: e.target.value }))}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: `${spacing['1']} ${spacing['3']}`,
                            border: `1px solid ${colors.borderSubtle}`,
                            borderRadius: borderRadius.base,
                            fontSize: typography.fontSize.caption,
                            fontFamily: typography.fontFamily,
                            color: colors.textPrimary,
                            outline: 'none',
                            backgroundColor: colors.surfaceInset,
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing['4'] }}>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {Object.values(checklistResults).filter(Boolean).length} of {CHECKLIST_TEMPLATES[activeTemplate].items.length} items reviewed
                    {Object.values(checklistResults).filter((r) => r === 'fail').length > 0 && (
                      <span style={{ marginLeft: spacing['2'], color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
                        {Object.values(checklistResults).filter((r) => r === 'fail').length} failed
                      </span>
                    )}
                  </span>
                  <Btn
                    variant="primary"
                    onClick={() => {
                      toast.info('Inspection saved. Backend required to persist.')
                      setActiveTemplate(null)
                      setChecklistResults({})
                      setChecklistNotes({})
                    }}
                    style={{ minHeight: 36 }}
                  >
                    Complete Inspection
                  </Btn>
                </div>
              </>
            )}
          </Card>

          {/* Past Inspection Records */}
          {(inspections || []).length === 0 ? (
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
          )}
        </>
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

      {/* Corrective Actions Tab */}
      {activeTab === 'corrective_actions' && !isLoading && !hasError && (
        displayCAs.length === 0 ? (
          <Card>
            <EmptyState
              message="No corrective actions on record. Corrective actions are created from safety inspections and incident investigations."
              cta="Log Corrective Action"
              onCta={() => toast.info('Form submission requires backend configuration')}
            />
          </Card>
        ) : (
          <>
            <div style={{ display: 'flex', gap: spacing['4'], marginBottom: spacing['4'], flexWrap: 'wrap' }}>
              {(['open', 'in_progress', 'closed'] as const).map((s) => {
                const count = displayCAs.filter((ca) => ca.status === s || (s === 'closed' && ca.status === 'verified')).length
                const colorMap = {
                  open: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
                  in_progress: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
                  closed: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
                }
                const c = colorMap[s]
                const label = s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
                return (
                  <div key={s} style={{
                    backgroundColor: c.bg, borderRadius: borderRadius.md,
                    padding: `${spacing['2']} ${spacing['4']}`,
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: c.fg }}>
                      {count} {label}
                    </span>
                  </div>
                )
              })}
              {(() => {
                const overdueCount = displayCAs.filter((ca) => {
                  if (!ca.due_date) return false
                  if (ca.status === 'closed' || ca.status === 'verified') return false
                  return new Date(ca.due_date) < new Date()
                }).length
                if (overdueCount === 0) return null
                return (
                  <div style={{
                    backgroundColor: colors.statusCriticalSubtle, borderRadius: borderRadius.md,
                    padding: `${spacing['2']} ${spacing['4']}`,
                  }}>
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical }}>
                      {overdueCount} Overdue
                    </span>
                  </div>
                )
              })()}
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Card>
                <DataTable
                  columns={caColumns}
                  data={displayCAs}
                  enableSorting
                />
              </Card>
            </div>
          </>
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
                Incident Type<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <select
                value={incidentForm.type}
                onChange={(e) => setIncidentForm((p) => ({ ...p, type: e.target.value }))}
                onBlur={(e) => setFieldErrors((p) => ({ ...p, type: e.target.value ? '' : 'Incident type is required' }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.type ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', backgroundColor: '#fff',
                }}
              >
                <option value="">Select type...</option>
                <option value="near_miss">Near Miss</option>
                <option value="injury">Injury</option>
                <option value="property_damage">Property Damage</option>
                <option value="environmental">Environmental</option>
              </select>
              {fieldErrors.type && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.type}</p>}
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

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Root Cause
                <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>(required for recordable incidents)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Immediate cause, contributing factors, and root cause analysis"
                value={incidentForm.root_cause}
                onChange={(e) => setIncidentForm((p) => ({ ...p, root_cause: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            {/* Corrective Action */}
            <div style={{
              marginBottom: spacing['5'],
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              padding: spacing['4'],
              backgroundColor: colors.surfaceInset,
            }}>
              <p style={{ margin: `0 0 ${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                Corrective Action
              </p>
              <div style={{ marginBottom: spacing['3'] }}>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Action to prevent recurrence"
                  value={incidentForm.ca_description}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, ca_description: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: '1px solid #E5E7EB',
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none', backgroundColor: '#fff',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                    Assignee
                  </label>
                  <input
                    type="text"
                    placeholder="Name or role"
                    value={incidentForm.ca_assignee}
                    onChange={(e) => setIncidentForm((p) => ({ ...p, ca_assignee: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      border: '1px solid #E5E7EB',
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={incidentForm.ca_due_date}
                    onChange={(e) => setIncidentForm((p) => ({ ...p, ca_due_date: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      border: '1px solid #E5E7EB',
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: '#fff',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Photo upload — required when severity >= medical treatment */}
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Photo Documentation
                {isPhotoRequired && <span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>}
                {!isPhotoRequired && <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'] }}>(required for medical treatment and above)</span>}
              </label>
              {isPhotoRequired && (
                <p style={{ margin: `0 0 ${spacing['2']} 0`, fontSize: typography.fontSize.caption, color: '#E67E22' }}>
                  Photo documentation is required for this severity level per OSHA recordkeeping standards.
                </p>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setIncidentForm((p) => ({ ...p, photo: file }))
                  if (file) setFieldErrors((p) => ({ ...p, photo: '' }))
                }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.photo ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', cursor: 'pointer',
                  backgroundColor: '#fff',
                }}
              />
              {incidentForm.photo && (
                <p style={{ margin: '4px 0 0', fontSize: typography.fontSize.caption, color: colors.statusActive }}>
                  {incidentForm.photo.name} selected
                </p>
              )}
              {fieldErrors.photo && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.photo}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
              <Btn variant="ghost" onClick={handleCloseModal} style={{ minHeight: '44px', minWidth: '44px' }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleIncidentSubmit} style={{ minHeight: '44px', minWidth: '44px' }}>Submit Incident</Btn>
            </div>
          </div>
        </div>
      )}
      {/* Toolbox Talk Creation Modal */}
      {showTalkModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Toolbox Talk"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseTalkModal() }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: borderRadius.lg,
            padding: spacing['6'],
            width: '100%',
            maxWidth: 560,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['5'] }}>
              <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                New Toolbox Talk
              </h2>
              <button
                onClick={handleCloseTalkModal}
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
                Topic<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Fall protection, Lockout tagout"
                value={talkForm.topic}
                onChange={(e) => setTalkForm((p) => ({ ...p, topic: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: talkErrors.topic ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {talkErrors.topic && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{talkErrors.topic}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Date<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="date"
                  value={talkForm.date}
                  onChange={(e) => setTalkForm((p) => ({ ...p, date: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: talkErrors.date ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                {talkErrors.date && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{talkErrors.date}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Presenter<span style={{ color: '#E74C3C', marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Name or title"
                  value={talkForm.presenter}
                  onChange={(e) => setTalkForm((p) => ({ ...p, presenter: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: talkErrors.presenter ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                {talkErrors.presenter && <p style={{ color: '#E74C3C', fontSize: 12, margin: '4px 0 0' }}>{talkErrors.presenter}</p>}
              </div>
            </div>

            {/* Digital attendance sign-in */}
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Attendance Sign-in
                <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>
                  {talkForm.attendees.length} signed in
                </span>
              </label>
              <div style={{ display: 'flex', gap: spacing['2'], marginBottom: spacing['2'] }}>
                <input
                  type="text"
                  placeholder="Enter name and press Add"
                  value={talkForm.newAttendee}
                  onChange={(e) => setTalkForm((p) => ({ ...p, newAttendee: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAttendee() } }}
                  style={{
                    flex: 1, boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: talkErrors.newAttendee ? '1px solid #E74C3C' : '1px solid #E5E7EB',
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                <Btn variant="secondary" onClick={handleAddAttendee} style={{ minHeight: '44px', flexShrink: 0 }}>
                  Add
                </Btn>
              </div>
              {talkErrors.newAttendee && <p style={{ color: '#E74C3C', fontSize: 12, margin: '0 0 4px' }}>{talkErrors.newAttendee}</p>}
              {talkForm.attendees.length > 0 && (
                <div style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: borderRadius.base,
                  maxHeight: 180,
                  overflowY: 'auto',
                }}>
                  {talkForm.attendees.map((name, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: `${spacing['2']} ${spacing['3']}`,
                        borderBottom: idx < talkForm.attendees.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          backgroundColor: colors.orangeSubtle,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: typography.fontSize.caption,
                          fontWeight: typography.fontWeight.semibold,
                          color: colors.primaryOrange,
                          flexShrink: 0,
                        }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveAttendee(name)}
                        aria-label={`Remove ${name}`}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.textTertiary, fontSize: 16, padding: '2px 4px',
                          lineHeight: 1,
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {talkForm.attendees.length === 0 && (
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  No attendees signed in yet. Add names above.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
              <Btn variant="ghost" onClick={handleCloseTalkModal} style={{ minHeight: '44px' }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleTalkSubmit} style={{ minHeight: '44px' }}>Save Talk</Btn>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

export default Safety
