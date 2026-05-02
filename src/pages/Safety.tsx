import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, ClipboardCheck, Award, Users, Plus, ShieldCheck, Shield, Wrench, ListChecks, ChevronDown, ChevronRight, Trash2, Check, X, Minus, Hash, Type, Gauge, CheckSquare } from 'lucide-react'
import { PageContainer, Card, Btn, MetricBox, Modal } from '../components/Primitives'
import { SafetyPhotoAnalyzer } from '../components/safety/SafetyPhotoAnalyzer'
import { PermissionGate } from '../components/auth/PermissionGate'
import { DataTable, createColumnHelper } from '../components/shared/DataTable'
import { ExportButton } from '../components/shared/ExportButton'
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { useSafetyInspections, useIncidents, useToolboxTalks, useSafetyCertifications, useCorrectiveActions, useDailyLogs, useInspectionChecklists, useChecklistTemplates, useChecklistItems } from '../hooks/queries'
import { useCreateIncident, useCreateSafetyInspection, useCreateCorrectiveAction, useUpdateCorrectiveAction, useCreateChecklist, useCreateChecklistFromTemplate, useUpdateChecklistItem, useDeleteChecklist } from '../hooks/mutations'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { InspectionChecklist, InspectionChecklistItem } from '../hooks/queries/inspection-checklists'

type TabKey = 'incidents' | 'inspections' | 'toolbox' | 'certifications' | 'corrective_actions' | 'checklists'

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'checklists', label: 'Checklists', icon: ListChecks },
  { key: 'toolbox', label: 'Toolbox Talks', icon: Users },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'corrective_actions', label: 'Corrective Actions', icon: Wrench },
]

// OSHA incident severity — dot and badge colors per design spec
const OSHA_SEVERITY: Record<string, { fg: string; bg: string; label: string }> = {
  near_miss:          { fg: colors.statusNeutral,   bg: colors.statusNeutralSubtle,   label: 'Near Miss' },
  first_aid:          { fg: colors.statusPending,   bg: colors.statusPendingSubtle,   label: 'First Aid' },
  medical_treatment:  { fg: colors.statusWarning,   bg: colors.statusWarningSubtle,   label: 'Medical Treatment' },
  lost_time:          { fg: colors.statusCritical,  bg: colors.statusCriticalSubtle,  label: 'Lost Time' },
  fatality:           { fg: colors.textPrimary,     bg: colors.statusNeutralSubtle,   label: 'Fatality' },
}

function getSeverityStyle(severity: string | null): { fg: string; bg: string; label: string } {
  if (!severity) return { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: 'Unknown' }
  return OSHA_SEVERITY[severity] ?? { fg: colors.textTertiary, bg: colors.statusNeutralSubtle, label: severity.replace(/_/g, ' ') }
}



// ── Column helpers ───────────────────────────────────────────

const incidentCol = createColumnHelper<Record<string, unknown>>()
const incidentColumns = [
  incidentCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' as const }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'}
      </span>
    ),
  }),
  incidentCol.accessor('type', {
    header: 'Type',
    cell: (info) => {
      const v = info.getValue() as string
      return <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, textTransform: 'capitalize' as const }}>{v ? v.replace(/_/g, ' ') : '\u2014'}</span>
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
  incidentCol.accessor('osha_recordable', {
    header: 'OSHA',
    cell: (info) => {
      const v = info.getValue() as boolean | null
      if (v === true) return (
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.bold,
          color: colors.statusCritical, backgroundColor: colors.statusCriticalSubtle,
          letterSpacing: '0.04em',
        }}>
          REC
        </span>
      )
      return <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption }}>{'\u2014'}</span>
    },
  }),
  incidentCol.accessor('reported_by', {
    header: 'Reported By',
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

const inspectionCol = createColumnHelper<Record<string, unknown>>()
const inspectionColumns = [
  inspectionCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' as const }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'}
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
      if (score == null) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>&mdash;</span>
      const scoreColor = score >= 90 ? colors.statusActive : score >= 70 ? colors.statusPending : colors.statusCritical
      return <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, fontWeight: typography.fontWeight.semibold, color: scoreColor, fontVariantNumeric: 'tabular-nums' as const }}>{score}%</span>
    },
  }),
]

const talkCol = createColumnHelper<Record<string, unknown>>()
const talkColumns = [
  talkCol.accessor('date', {
    header: 'Date',
    cell: (info) => (
      <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' as const }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'}
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
      <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: colors.textPrimary, fontWeight: typography.fontWeight.medium, fontVariantNumeric: 'tabular-nums' as const }}>
        {info.getValue() ?? 0}
      </span>
    ),
  }),
]

const certCol = createColumnHelper<Record<string, unknown>>()
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
      <span style={{ fontSize: 11, fontFamily: typography.fontFamilyMono, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' as const }}>
        {info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014'}
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
            color: colors.white, backgroundColor: colors.statusCritical,
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
            color: colors.primaryOrange, backgroundColor: colors.orangeSubtle,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: colors.primaryOrange }} />
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

const caCol = createColumnHelper<Record<string, unknown>>()
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
      if (!val) return <span style={{ fontSize: 11, color: colors.textTertiary, opacity: 0.5 }}>&mdash;</span>
      const isOverdue = new Date(val) < new Date() && info.row.original.status !== 'closed' && info.row.original.status !== 'verified'
      return (
        <span style={{
          fontSize: 11,
          fontFamily: typography.fontFamilyMono,
          fontVariantNumeric: 'tabular-nums' as const,
          color: isOverdue ? colors.statusCritical : colors.textSecondary,
          fontWeight: isOverdue ? typography.fontWeight.semibold : typography.fontWeight.normal,
        }}>
          {new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {isOverdue && <span style={{ marginLeft: 4, fontSize: 10, letterSpacing: '0.04em' }}> OVERDUE</span>}
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
        high:     { fg: colors.primaryOrange, bg: colors.orangeSubtle },
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
        <Btn variant="primary" onClick={onCta}>
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

// ── Checklist Items Panel ────────────────────────────────────

function ChecklistItemsPanel({ checklistId, projectId, updateChecklistItemMut }: {
  checklistId: string
  projectId: string
  updateChecklistItemMut: ReturnType<typeof import('../hooks/mutations').useUpdateChecklistItem>
}) {
  const { data: items, isLoading } = useChecklistItems(checklistId)

  if (isLoading) {
    return (
      <div style={{ padding: `${spacing['3']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ height: 20, width: '60%', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: `${spacing['4']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}`, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
          No items in this checklist yet.
        </p>
      </div>
    )
  }

  const completed = items.filter((i: InspectionChecklistItem) => i.status !== 'pending').length
  const total = items.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const handleUpdateItem = (item: InspectionChecklistItem, updates: Record<string, unknown>) => {
    updateChecklistItemMut.mutate({
      id: item.id,
      updates: { ...updates, completed_at: new Date().toISOString() },
      checklistId,
      projectId,
    })
  }

  const taskTypeIcon = (type: string) => {
    switch (type) {
      case 'inspection': return <ClipboardCheck size={14} style={{ color: colors.textTertiary }} />
      case 'text': return <Type size={14} style={{ color: colors.textTertiary }} />
      case 'number': return <Hash size={14} style={{ color: colors.textTertiary }} />
      case 'meter': return <Gauge size={14} style={{ color: colors.textTertiary }} />
      case 'subtask': return <CheckSquare size={14} style={{ color: colors.textTertiary }} />
      default: return <ClipboardCheck size={14} style={{ color: colors.textTertiary }} />
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
      {/* Progress bar */}
      <div style={{ padding: `${spacing['3']} ${spacing['5']}`, display: 'flex', alignItems: 'center', gap: spacing['3'], backgroundColor: colors.surfaceInset }}>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, whiteSpace: 'nowrap' }}>
          {completed}/{total} completed ({pct}%)
        </span>
        <div style={{ flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: borderRadius.full, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: pct === 100 ? colors.statusActive : colors.statusInfo,
            borderRadius: borderRadius.full,
            transition: `width ${transitions.instant}`,
          }} />
        </div>
      </div>

      {/* Items */}
      {items.map((item: InspectionChecklistItem, idx: number) => (
        <div
          key={item.id}
          style={{
            display: 'flex', flexDirection: 'column', gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['5']}`,
            borderBottom: idx < items.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
            backgroundColor: item.status === 'pass' ? `${colors.statusActive}08` : item.status === 'fail' ? `${colors.statusCritical}08` : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'], justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flex: 1, minWidth: 200 }}>
              {taskTypeIcon(item.task_type)}
              <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                {item.label}
                {item.is_required && <span style={{ color: colors.statusCritical, marginLeft: 2, fontSize: typography.fontSize.caption }}>*</span>}
              </span>
            </div>

            {/* Type-specific inputs */}
            <div style={{ display: 'flex', gap: spacing['2'], flexShrink: 0, alignItems: 'center' }}>
              {item.task_type === 'inspection' && (
                <>
                  {(['pass', 'fail', 'na'] as const).map((val) => {
                    const isSelected = item.status === val
                    const btnColor = val === 'pass'
                      ? { fg: colors.statusActive, bg: colors.statusActiveSubtle, border: colors.statusActive, icon: <Check size={12} /> }
                      : val === 'fail'
                      ? { fg: colors.statusCritical, bg: colors.statusCriticalSubtle, border: colors.statusCritical, icon: <X size={12} /> }
                      : { fg: colors.textSecondary, bg: colors.surfaceInset, border: colors.borderDefault, icon: <Minus size={12} /> }
                    return (
                      <button
                        key={val}
                        aria-pressed={isSelected}
                        onClick={() => handleUpdateItem(item, { status: isSelected ? 'pending' : val })}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: `${spacing['1']} ${spacing['3']}`,
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
                          minHeight: '36px',
                        }}
                      >
                        {btnColor.icon}
                        {val === 'na' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)}
                      </button>
                    )
                  })}
                </>
              )}

              {item.task_type === 'subtask' && (
                <button
                  onClick={() => handleUpdateItem(item, { status: item.status === 'pass' ? 'pending' : 'pass' })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: `${spacing['1']} ${spacing['3']}`,
                    border: item.status === 'pass' ? `1.5px solid ${colors.statusActive}` : `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.caption,
                    fontWeight: item.status === 'pass' ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    fontFamily: typography.fontFamily,
                    color: item.status === 'pass' ? colors.statusActive : colors.textTertiary,
                    backgroundColor: item.status === 'pass' ? colors.statusActiveSubtle : 'transparent',
                    minHeight: '36px',
                  }}
                >
                  <CheckSquare size={14} />
                  {item.status === 'pass' ? 'Done' : 'Mark Done'}
                </button>
              )}

              {item.task_type === 'text' && (
                <input
                  type="text"
                  placeholder="Enter value..."
                  defaultValue={item.value_text || ''}
                  onBlur={(e) => handleUpdateItem(item, { value_text: e.target.value, status: e.target.value ? 'pass' : 'pending' })}
                  style={{
                    width: 200, boxSizing: 'border-box',
                    padding: `${spacing['1']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              )}

              {item.task_type === 'number' && (
                <input
                  type="number"
                  placeholder="0"
                  defaultValue={item.value_number ?? ''}
                  onBlur={(e) => handleUpdateItem(item, { value_number: e.target.value ? parseFloat(e.target.value) : null, status: e.target.value ? 'pass' : 'pending' })}
                  style={{
                    width: 120, boxSizing: 'border-box',
                    padding: `${spacing['1']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.caption,
                    fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              )}

              {item.task_type === 'meter' && (
                <div style={{ display: 'flex', gap: spacing['1'], alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="0"
                    defaultValue={item.value_meter ?? ''}
                    onBlur={(e) => handleUpdateItem(item, { value_meter: e.target.value ? parseFloat(e.target.value) : null, status: e.target.value ? 'pass' : 'pending' })}
                    style={{
                      width: 100, boxSizing: 'border-box',
                      padding: `${spacing['1']} ${spacing['3']}`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.caption,
                      fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {item.meter_unit || 'unit'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes input for all types */}
          {item.description && (
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, paddingLeft: 22 }}>
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export const Safety: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('incidents')
  const [nowMs] = useState(() => Date.now())
  const projectId = useProjectId()

  const { data: inspections, isLoading: loadingInspections, isError: errorInspections } = useSafetyInspections(projectId)
  const { data: incidents, isLoading: loadingIncidents, isError: errorIncidents, refetch: refetchIncidents } = useIncidents(projectId)
  const { data: talks, isLoading: loadingTalks, isError: errorTalks, refetch: refetchTalks } = useToolboxTalks(projectId)
  const { data: certifications, isLoading: loadingCerts, isError: errorCerts, refetch: refetchCerts } = useSafetyCertifications(projectId)
  const { data: correctiveActions, isLoading: loadingCAs, isError: errorCAs, refetch: refetchCAs } = useCorrectiveActions(projectId)
  const { data: dailyLogsResult } = useDailyLogs(projectId)
  const dailyLogs = dailyLogsResult?.data

  // Checklist hooks
  const { data: checklists, isLoading: loadingChecklists } = useInspectionChecklists(projectId)
  const { data: checklistTemplatesData } = useChecklistTemplates(projectId)

  const createIncident = useCreateIncident()
  const createSafetyInspection = useCreateSafetyInspection()
  const createCorrectiveAction = useCreateCorrectiveAction()
  const updateCorrectiveAction = useUpdateCorrectiveAction()
  const createChecklist = useCreateChecklist()
  const createChecklistFromTemplate = useCreateChecklistFromTemplate()
  const updateChecklistItemMut = useUpdateChecklistItem()
  const deleteChecklistMut = useDeleteChecklist()

  const displayIncidents = (incidents || []) as Array<Record<string, unknown>>

  const displayCAs = (correctiveActions || []) as Array<Record<string, unknown>>

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
  }, [projectId, refetchIncidents, refetchCAs])

  // ── KPI calculations ───────────────────────────────────────

  // first_aid and near_miss do NOT reset the days counter — only medical_treatment and above do
  const recordableSeverities = ['medical_treatment', 'lost_time', 'fatality']

  const lastRecordableIncident = displayIncidents
    .filter((i) => recordableSeverities.includes(String(i.severity ?? '')))
    .sort((a, b) => new Date(String(b.date ?? '')).getTime() - new Date(String(a.date ?? '')).getTime())[0] ?? null

  const daysSinceIncident = lastRecordableIncident
    ? Math.floor((nowMs - new Date(String(lastRecordableIncident.date ?? '')).getTime()) / 86400000)
    : null

  const computedHours = dailyLogs?.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.total_hours) || 0), 0) ?? 0
  // Default to 250000 hours for a realistic TRIR calculation in prototype
  const totalHoursWorked = computedHours > 0 ? computedHours : 250000
  const recordableCount = displayIncidents.filter((i) => recordableSeverities.includes(String(i.severity ?? ''))).length
  const trirRaw = totalHoursWorked > 0 ? (recordableCount * 200000) / totalHoursWorked : null
  const trir = trirRaw !== null ? trirRaw.toFixed(2) : null

  // DART rate: (cases with days away + restricted duty) × 200,000 / hours worked
  const dartCases = displayIncidents.filter((i) => {
    const daysAway = i.days_away_from_work as number | null
    const daysRestricted = i.days_restricted_duty as number | null
    return (daysAway != null && daysAway > 0) || (daysRestricted != null && daysRestricted > 0)
  }).length
  const dartRaw = totalHoursWorked > 0 ? (dartCases * 200000) / totalHoursWorked : null
  const dart = dartRaw !== null ? dartRaw.toFixed(2) : null

  const openCorrectiveActions = (correctiveActions as Array<Record<string, unknown>> | undefined)?.filter(
    (ca) => ca.status !== 'closed' && ca.status !== 'verified'
  ).length ?? 0

  const now = new Date()

  const expiringCerts = certifications?.filter((c: unknown) => {
    if (!c.expiration_date) return false
    const daysUntil = (new Date(c.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 30
  }).length ?? 0

  const passCount = inspections?.filter((i: unknown) => i.status === 'passed').length ?? 0
  const failCount = inspections?.filter((i: unknown) => i.status === 'failed').length ?? 0

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
  const [showAiScanModal, setShowAiScanModal] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    date: '',
    type: '',
    location: '',
    area: '',
    floor: '',
    description: '',
    severity: '',
    injured_party_name: '',
    injured_party_company: '',
    injured_party_trade: '',
    body_part: '',
    nature_of_injury: '',
    immediate_actions: '',
    osha_recordable: false,
    reported_by: '',
    days_away_from_work: '',
    days_restricted_duty: '',
    witness_names: '',
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

  // Checklist creation modal state
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    category: 'general' as string,
    templateId: '' as string,
  })
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null)

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

  const handleCloseModal = () => {
    setShowIncidentModal(false)
    setIncidentForm({ date: '', type: '', location: '', area: '', floor: '', description: '', severity: '', injured_party_name: '', injured_party_company: '', injured_party_trade: '', body_part: '', nature_of_injury: '', immediate_actions: '', osha_recordable: false, reported_by: '', days_away_from_work: '', days_restricted_duty: '', witness_names: '', root_cause: '', ca_description: '', ca_assignee: '', ca_due_date: '', photo: null })
    setFieldErrors({})
  }

  const handleIncidentSubmit = async () => {
    const errors: Record<string, string> = {}
    requiredFields.forEach(({ key, label }) => {
      if (!incidentForm[key]?.toString().trim()) errors[key] = `${label} is required`
    })
    if (isPhotoRequired && !incidentForm.photo) errors.photo = 'Photo is required for this severity level'
    if (Object.values(errors).some(Boolean)) {
      setFieldErrors(errors)
      return
    }
    try {
      const result = await createIncident.mutateAsync({
        data: {
          project_id: projectId,
          date: incidentForm.date,
          type: incidentForm.type,
          location: incidentForm.location,
          area: incidentForm.area || null,
          floor: incidentForm.floor || null,
          description: incidentForm.description,
          severity: incidentForm.severity,
          injured_party_name: incidentForm.injured_party_name,
          injured_party_company: incidentForm.injured_party_company || null,
          injured_party_trade: incidentForm.injured_party_trade || null,
          body_part: incidentForm.body_part || null,
          nature_of_injury: incidentForm.nature_of_injury || null,
          immediate_actions: incidentForm.immediate_actions || null,
          osha_recordable: incidentForm.osha_recordable,
          reported_by: incidentForm.reported_by || null,
          days_away_from_work: incidentForm.days_away_from_work ? parseInt(incidentForm.days_away_from_work) : null,
          days_restricted_duty: incidentForm.days_restricted_duty ? parseInt(incidentForm.days_restricted_duty) : null,
          witness_names: incidentForm.witness_names ? incidentForm.witness_names.split(',').map((n: string) => n.trim()).filter(Boolean) : null,
          root_cause: incidentForm.root_cause || null,
          investigation_status: 'open',
        },
        projectId: projectId!,
      })
      const incidentId = (result.data as Record<string, unknown>)?.id as string | undefined
      // Upload photo to Supabase storage if provided
      if (incidentForm.photo && incidentId) {
        const ext = incidentForm.photo.name.split('.').pop() || 'jpg'
        const filePath = `incidents/${projectId}/${incidentId}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('safety-photos')
          .upload(filePath, incidentForm.photo, { contentType: incidentForm.photo.type, upsert: true })
        if (!uploadError) {
          await supabase.from('incidents').update({ photos: [filePath] }).eq('id', incidentId)
        }
      }
      if (incidentForm.ca_description.trim()) {
        await createCorrectiveAction.mutateAsync({
          data: {
            project_id: projectId,
            incident_id: incidentId,
            description: incidentForm.ca_description,
            assigned_to: incidentForm.ca_assignee || null,
            due_date: incidentForm.ca_due_date || null,
            status: 'open',
            severity: 'medium',
          },
          projectId: projectId!,
        })
      }
      toast.success('Incident reported successfully')
      handleCloseModal()
    } catch {
      toast.error('Failed to report incident')
    }
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

  const handleCloseTalkModal = () => {
    setShowTalkModal(false)
    setTalkForm({ topic: '', date: '', presenter: '', attendees: [], newAttendee: '' })
    setTalkErrors({})
  }

  const handleSaveTalk = async () => {
    const errors: Record<string, string> = {}
    if (!talkForm.topic.trim()) errors.topic = 'Topic is required'
    if (!talkForm.date.trim()) errors.date = 'Date is required'
    if (!talkForm.presenter.trim()) errors.presenter = 'Presenter is required'
    if (talkForm.attendees.length === 0) errors.newAttendee = 'At least one attendee is required'
    if (Object.keys(errors).length > 0) {
      setTalkErrors(errors)
      return
    }
    try {
      const { data: insertedTalk, error: insertError } = await supabase.from('toolbox_talks').insert({
        project_id: projectId,
        title: talkForm.topic.trim(),
        topic: talkForm.topic.trim(),
        date: talkForm.date,
        attendance_count: talkForm.attendees.length,
      }).select('id').single()
      if (insertError) throw insertError
      const talkId = insertedTalk?.id as string | undefined
      if (talkId && talkForm.attendees.length > 0) {
        await supabase.from('toolbox_talk_attendees').insert(
          talkForm.attendees.map((name) => ({
            toolbox_talk_id: talkId,
            worker_name: name,
          }))
        )
      }
      toast.success('Toolbox talk saved')
      handleCloseTalkModal()
      refetchTalks()
    } catch {
      toast.error('Failed to save toolbox talk')
    }
  }

  const handleSaveInspection = async () => {
    if (!activeTemplate || !projectId) return
    const items = CHECKLIST_TEMPLATES[activeTemplate].items
    const reviewed = Object.values(checklistResults).filter(Boolean)
    if (reviewed.length === 0) {
      toast.error('Complete at least one checklist item before saving')
      return
    }
    const passedCount = Object.values(checklistResults).filter((r) => r === 'pass').length
    const failedCount = Object.values(checklistResults).filter((r) => r === 'fail').length
    const score = Math.round((passedCount / items.length) * 100)
    const status = failedCount > 0 ? 'failed' : 'passed'
    try {
      await createSafetyInspection.mutateAsync({
        data: {
          project_id: projectId,
          type: CHECKLIST_TEMPLATES[activeTemplate].label,
          date: new Date().toISOString().split('T')[0],
          status,
          score,
          checklist_results: checklistResults,
          checklist_notes: checklistNotes,
        },
        projectId,
      })
      toast.success('Inspection saved')
      setActiveTemplate(null)
      setChecklistResults({})
      setChecklistNotes({})
    } catch {
      toast.error('Failed to save inspection')
    }
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
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton pdfFilename="SiteSync_Safety_Report" />
          {activeTab === 'incidents' && (
            <PermissionGate permission="safety.manage">
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowIncidentModal(true)}>
              Report Incident
            </Btn>
            </PermissionGate>
          )}
          {activeTab === 'toolbox' && (
            <PermissionGate permission="safety.manage">
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowTalkModal(true)}>
              New Talk
            </Btn>
            </PermissionGate>
          )}
          {activeTab === 'checklists' && (
            <PermissionGate permission="safety.manage">
            <Btn variant="primary" icon={<Plus size={16} />} onClick={() => setShowChecklistModal(true)}>
              New Checklist
            </Btn>
            </PermissionGate>
          )}
        </div>
      }
    >
      <style>{`@keyframes safety-pulse { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }`}</style>

      {/* Dashboard Metric Cards */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: spacing['3'], marginBottom: spacing.lg }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              width: '100%', height: 88,
              backgroundColor: colors.surfaceInset,
              borderRadius: borderRadius.md,
              animation: 'safety-pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: spacing['3'],
          marginBottom: spacing.lg,
        }}>
          <MetricBox
            label="Days Without Incident"
            value={daysSinceIncident ?? 0}
            colorOverride={daysColor}
          />
          <MetricBox
            label="TRIR"
            value={trir ?? 'N/A'}
            colorOverride={trirColor}
          />
          <MetricBox
            label="Open Actions"
            value={openCorrectiveActions}
            colorOverride={caColor}
          />
          <MetricBox
            label="Expiring Certs"
            value={expiringCerts}
            colorOverride={certColor}
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
        marginBottom: spacing.lg,
        overflowX: 'auto',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              aria-pressed={isActive}
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
                <div style={{ flex: '0 0 100px', height: 20, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: '0 0 140px', height: 20, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
                <div style={{ flex: '0 0 120px', height: 20, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                <div style={{ flex: '1', height: 20, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                <div style={{ flex: '0 0 90px', height: 20, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.25}s` }} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error state */}
      {!isLoading && hasError && (
        <div style={{
          backgroundColor: colors.statusCriticalSubtle,
          border: `1px solid ${colors.statusCritical}40`,
          borderRadius: borderRadius.md,
          padding: `${spacing['4']} ${spacing['5']}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing['4'],
          marginBottom: spacing['4'],
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: typography.fontWeight.medium, color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
              Unable to load safety data
            </p>
            <p style={{ margin: '2px 0 0', color: colors.statusCritical, fontSize: typography.fontSize.caption }}>
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
                <PermissionGate permission="safety.manage">
                <Btn variant="primary" onClick={() => setShowIncidentModal(true)}>
                  Report First Incident
                </Btn>
                </PermissionGate>
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
                                  aria-pressed={isSelected}
                                  aria-label={`${val === 'na' ? 'N/A' : val.charAt(0).toUpperCase() + val.slice(1)} for: ${item}`}
                                  onClick={() => setChecklistResults((p) => ({ ...p, [idx]: isSelected ? null : val }))}
                                  style={{
                                    padding: `${spacing['1']} ${spacing['3']}`,
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
                  <PermissionGate permission="safety.manage">
                    <Btn variant="primary" onClick={handleSaveInspection} disabled={createSafetyInspection.isPending}>
                      {createSafetyInspection.isPending ? 'Saving…' : 'Save Inspection'}
                    </Btn>
                  </PermissionGate>
                </div>
              </>
            )}
          </Card>

          {/* Past Inspection Records */}
          {(inspections || []).length === 0 ? (
            <Card>
              <EmptyState
                message="No inspections recorded. Safety tracking not yet configured."
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
                  columns={[...caColumns, caCol.display({
                    id: 'ca_status_action',
                    header: '',
                    cell: (info) => {
                      const row = info.row.original
                      const status = (row.status as string) || 'open'
                      if (status === 'closed' || status === 'verified') return null
                      const nextStatus = status === 'open' ? 'in_progress' : 'closed'
                      const label = status === 'open' ? 'Start' : 'Close'
                      return (
                        <PermissionGate permission="safety.manage">
                          <Btn
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await updateCorrectiveAction.mutateAsync({
                                  id: row.id as string,
                                  updates: { status: nextStatus },
                                  projectId: projectId!,
                                })
                                toast.success('Status updated')
                              } catch {
                                toast.error('Failed to update status')
                              }
                            }}
                            disabled={updateCorrectiveAction.isPending}
                            style={{ fontSize: typography.fontSize.caption }}
                          >
                            {label}
                          </Btn>
                        </PermissionGate>
                      )
                    },
                  })]}
                  data={displayCAs}
                  enableSorting
                />
              </Card>
            </div>
          </>
        )
      )}

      {/* Checklists Tab */}
      {activeTab === 'checklists' && !isLoading && !hasError && (
        loadingChecklists ? (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 60, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, animation: 'safety-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          </Card>
        ) : (checklists || []).length === 0 ? (
          <Card>
            <EmptyState
              message="No checklists created yet. Create a new checklist to track inspection items with pass/fail, text, numeric, and meter readings."
              cta="New Checklist"
              onCta={() => setShowChecklistModal(true)}
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {(checklists || []).map((cl: InspectionChecklist) => {
              const isExpanded = expandedChecklistId === cl.id
              const statusColor = cl.status === 'completed' ? colors.statusActive
                : cl.status === 'failed' ? colors.statusCritical
                : cl.status === 'in_progress' ? colors.statusInfo
                : colors.statusPending
              const statusBg = cl.status === 'completed' ? colors.statusActiveSubtle
                : cl.status === 'failed' ? colors.statusCriticalSubtle
                : cl.status === 'in_progress' ? colors.statusInfoSubtle
                : colors.statusPendingSubtle
              const categoryLabel = cl.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

              return (
                <Card key={cl.id} style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Checklist Header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: `${spacing['4']} ${spacing['5']}`,
                      cursor: 'pointer',
                      transition: `background-color ${transitions.instant}`,
                    }}
                    onClick={() => setExpandedChecklistId(isExpanded ? null : cl.id)}
                  >
                    {isExpanded ? <ChevronDown size={16} style={{ color: colors.textTertiary, flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: colors.textTertiary, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{cl.name}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                          padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: colors.textSecondary, backgroundColor: colors.surfaceInset,
                        }}>
                          {categoryLabel}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                          padding: `1px ${spacing.sm}`, borderRadius: borderRadius.full,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                          color: statusColor, backgroundColor: statusBg,
                        }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColor }} />
                          {cl.status === 'in_progress' ? 'In Progress' : cl.status.charAt(0).toUpperCase() + cl.status.slice(1)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginTop: spacing['1'] }}>
                        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                          {new Date(cl.created_at).toLocaleDateString()}
                        </span>
                        {cl.pass_rate != null && (
                          <span style={{ fontSize: typography.fontSize.caption, color: cl.pass_rate >= 80 ? colors.statusActive : cl.pass_rate >= 50 ? colors.statusPending : colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
                            {cl.pass_rate}% pass rate
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {cl.pass_rate != null && (
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{ height: 6, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${cl.pass_rate}%`,
                            backgroundColor: cl.pass_rate >= 80 ? colors.statusActive : cl.pass_rate >= 50 ? colors.statusPending : colors.statusCritical,
                            borderRadius: borderRadius.full,
                            transition: `width ${transitions.instant}`,
                          }} />
                        </div>
                      </div>
                    )}

                    <PermissionGate permission="safety.manage">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this checklist?')) {
                            deleteChecklistMut.mutate({ id: cl.id, projectId: projectId! }, {
                              onSuccess: () => toast.success('Checklist deleted'),
                              onError: () => toast.error('Failed to delete'),
                            })
                          }
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.textTertiary, padding: spacing['1'], flexShrink: 0,
                        }}
                        aria-label="Delete checklist"
                      >
                        <Trash2 size={14} />
                      </button>
                    </PermissionGate>
                  </div>

                  {/* Expanded Items */}
                  {isExpanded && (
                    <ChecklistItemsPanel checklistId={cl.id} projectId={projectId!} updateChecklistItemMut={updateChecklistItemMut} />
                  )}
                </Card>
              )
            })}
          </div>
        )
      )}

      {/* Checklist Creation Modal */}
      {showChecklistModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New Checklist"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowChecklistModal(false); setChecklistForm({ name: '', category: 'general', templateId: '' }) } }}
        >
          <div style={{
            backgroundColor: colors.white,
            borderRadius: borderRadius.lg,
            padding: spacing['6'],
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['5'] }}>
              <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                New Checklist
              </h2>
              <button
                onClick={() => { setShowChecklistModal(false); setChecklistForm({ name: '', category: 'general', templateId: '' }) }}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: colors.textSecondary, lineHeight: 1, padding: 4 }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Name<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Weekly Safety Audit - Building A"
                value={checklistForm.name}
                onChange={(e) => setChecklistForm((p) => ({ ...p, name: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Category
              </label>
              <select
                value={checklistForm.category}
                onChange={(e) => setChecklistForm((p) => ({ ...p, category: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                }}
              >
                <option value="general">General</option>
                <option value="safety">Safety</option>
                <option value="quality">Quality</option>
                <option value="environmental">Environmental</option>
                <option value="pre-task">Pre-Task</option>
              </select>
            </div>

            {(checklistTemplatesData || []).length > 0 && (
              <div style={{ marginBottom: spacing['4'] }}>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Start from Template
                  <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>(optional)</span>
                </label>
                <select
                  value={checklistForm.templateId}
                  onChange={(e) => setChecklistForm((p) => ({ ...p, templateId: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                  }}
                >
                  <option value="">Blank checklist</option>
                  {(checklistTemplatesData || []).map((t: InspectionChecklist) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
              <Btn variant="ghost" onClick={() => { setShowChecklistModal(false); setChecklistForm({ name: '', category: 'general', templateId: '' }) }}>Cancel</Btn>
              <Btn
                variant="primary"
                disabled={!checklistForm.name.trim() || createChecklist.isPending || createChecklistFromTemplate.isPending}
                onClick={async () => {
                  if (!checklistForm.name.trim() || !projectId) return
                  try {
                    if (checklistForm.templateId) {
                      await createChecklistFromTemplate.mutateAsync({
                        templateId: checklistForm.templateId,
                        projectId,
                        name: checklistForm.name,
                        category: checklistForm.category,
                      })
                    } else {
                      await createChecklist.mutateAsync({
                        data: {
                          project_id: projectId,
                          name: checklistForm.name,
                          category: checklistForm.category,
                          is_template: false,
                          status: 'pending',
                        },
                        projectId,
                      })
                    }
                    toast.success('Checklist created')
                    setShowChecklistModal(false)
                    setChecklistForm({ name: '', category: 'general', templateId: '' })
                  } catch {
                    toast.error('Failed to create checklist')
                  }
                }}
              >
                {createChecklist.isPending || createChecklistFromTemplate.isPending ? 'Creating...' : 'Create Checklist'}
              </Btn>
            </div>
          </div>
        </div>
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
            backgroundColor: colors.white,
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
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Date<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
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
                  border: fieldErrors.date ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.date && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.date}</p>}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Incident Type<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
              </label>
              <select
                value={incidentForm.type}
                onChange={(e) => setIncidentForm((p) => ({ ...p, type: e.target.value }))}
                onBlur={(e) => setFieldErrors((p) => ({ ...p, type: e.target.value ? '' : 'Incident type is required' }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.type ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                }}
              >
                <option value="">Select type...</option>
                <option value="near_miss">Near Miss</option>
                <option value="injury">Injury</option>
                <option value="property_damage">Property Damage</option>
                <option value="environmental">Environmental</option>
              </select>
              {fieldErrors.type && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.type}</p>}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Location<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
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
                  border: fieldErrors.location ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.location && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.location}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Area
                </label>
                <input
                  type="text"
                  placeholder="e.g. North wing"
                  value={incidentForm.area}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, area: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Floor
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3rd floor"
                  value={incidentForm.floor}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, floor: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Severity<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
              </label>
              <select
                ref={severityRef}
                value={incidentForm.severity}
                onChange={(e) => {
                  const sev = e.target.value
                  const autoRecordable = ['medical_treatment', 'lost_time', 'fatality'].includes(sev)
                  setIncidentForm((p) => ({ ...p, severity: sev, osha_recordable: autoRecordable || p.osha_recordable }))
                }}
                onBlur={(e) => handleFieldBlur('severity', e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: fieldErrors.severity ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                }}
              >
                <option value="">Select severity...</option>
                <option value="near_miss">Near Miss</option>
                <option value="first_aid">First Aid</option>
                <option value="medical_treatment">Medical Treatment</option>
                <option value="lost_time">Lost Time</option>
                <option value="fatality">Fatality</option>
              </select>
              {fieldErrors.severity && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.severity}</p>}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Involved Party<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
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
                  border: fieldErrors.injured_party_name ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {fieldErrors.injured_party_name && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.injured_party_name}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Company
                </label>
                <input
                  type="text"
                  placeholder="Employer / subcontractor"
                  value={incidentForm.injured_party_company}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, injured_party_company: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Trade
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electrician, Ironworker"
                  value={incidentForm.injured_party_trade}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, injured_party_trade: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Body Part Affected
                </label>
                <select
                  value={incidentForm.body_part}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, body_part: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                  }}
                >
                  <option value="">Select...</option>
                  <option value="head">Head</option>
                  <option value="eyes">Eyes</option>
                  <option value="neck">Neck</option>
                  <option value="shoulder">Shoulder</option>
                  <option value="arm">Arm</option>
                  <option value="hand">Hand / Fingers</option>
                  <option value="back">Back</option>
                  <option value="chest">Chest</option>
                  <option value="abdomen">Abdomen</option>
                  <option value="hip">Hip</option>
                  <option value="leg">Leg</option>
                  <option value="knee">Knee</option>
                  <option value="foot">Foot / Toes</option>
                  <option value="multiple">Multiple</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Nature of Injury
                </label>
                <select
                  value={incidentForm.nature_of_injury}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, nature_of_injury: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                  }}
                >
                  <option value="">Select...</option>
                  <option value="laceration">Laceration / Cut</option>
                  <option value="contusion">Contusion / Bruise</option>
                  <option value="fracture">Fracture</option>
                  <option value="sprain">Sprain / Strain</option>
                  <option value="burn">Burn</option>
                  <option value="puncture">Puncture</option>
                  <option value="abrasion">Abrasion</option>
                  <option value="crushing">Crushing</option>
                  <option value="amputation">Amputation</option>
                  <option value="electrical">Electrical Shock</option>
                  <option value="inhalation">Inhalation</option>
                  <option value="foreign_body">Foreign Body</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Description<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
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
                  border: fieldErrors.description ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, resize: 'vertical', outline: 'none',
                }}
              />
              {fieldErrors.description && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.description}</p>}
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Immediate Actions Taken
              </label>
              <textarea
                rows={2}
                placeholder="What was done immediately after the incident"
                value={incidentForm.immediate_actions}
                onChange={(e) => setIncidentForm((p) => ({ ...p, immediate_actions: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, resize: 'vertical', outline: 'none',
                }}
              />
            </div>

            {/* OSHA recordkeeping fields */}
            <div style={{
              marginBottom: spacing['4'],
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              padding: spacing['4'],
              backgroundColor: colors.surfaceInset,
            }}>
              <p style={{ margin: `0 0 ${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                OSHA Recordkeeping
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, color: colors.textPrimary, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={incidentForm.osha_recordable}
                    onChange={(e) => setIncidentForm((p) => ({ ...p, osha_recordable: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: colors.primaryOrange }}
                  />
                  OSHA Recordable
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                    Days Away From Work
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={incidentForm.days_away_from_work}
                    onChange={(e) => setIncidentForm((p) => ({ ...p, days_away_from_work: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                    Days Restricted Duty
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={incidentForm.days_restricted_duty}
                    onChange={(e) => setIncidentForm((p) => ({ ...p, days_restricted_duty: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: `${spacing['2']} ${spacing['3']}`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Reported By
                </label>
                <input
                  type="text"
                  placeholder="Name of person reporting"
                  value={incidentForm.reported_by}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, reported_by: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Witnesses
                </label>
                <input
                  type="text"
                  placeholder="Comma-separated names"
                  value={incidentForm.witness_names}
                  onChange={(e) => setIncidentForm((p) => ({ ...p, witness_names: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
              </div>
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
                  border: `1px solid ${colors.borderDefault}`,
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
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
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
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
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
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                      color: colors.textPrimary, outline: 'none', backgroundColor: colors.white,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Photo upload — required when severity >= medical treatment */}
            <div style={{ marginBottom: spacing['5'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Photo Documentation
                {isPhotoRequired && <span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>}
                {!isPhotoRequired && <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'] }}>(required for medical treatment and above)</span>}
              </label>
              {isPhotoRequired && (
                <p style={{ margin: `0 0 ${spacing['2']} 0`, fontSize: typography.fontSize.caption, color: colors.primaryOrange }}>
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
                  border: fieldErrors.photo ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none', cursor: 'pointer',
                  backgroundColor: colors.white,
                }}
              />
              {incidentForm.photo && (
                <p style={{ margin: '4px 0 0', fontSize: typography.fontSize.caption, color: colors.statusActive }}>
                  {incidentForm.photo.name} selected
                </p>
              )}
              {fieldErrors.photo && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.photo}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
              <Btn variant="ghost" onClick={handleCloseModal}>Cancel</Btn>
              <Btn variant="primary" onClick={handleIncidentSubmit} disabled={createIncident.isPending || createCorrectiveAction.isPending}>
                {createIncident.isPending ? 'Saving…' : 'Submit Report'}
              </Btn>
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
            backgroundColor: colors.white,
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
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ marginBottom: spacing['4'] }}>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                Topic<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Fall protection, Lockout tagout"
                value={talkForm.topic}
                onChange={(e) => setTalkForm((p) => ({ ...p, topic: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: talkErrors.topic ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                  color: colors.textPrimary, outline: 'none',
                }}
              />
              {talkErrors.topic && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{talkErrors.topic}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'], marginBottom: spacing['4'] }}>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Date<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="date"
                  value={talkForm.date}
                  onChange={(e) => setTalkForm((p) => ({ ...p, date: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: talkErrors.date ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                {talkErrors.date && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{talkErrors.date}</p>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
                  Presenter<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Name or title"
                  value={talkForm.presenter}
                  onChange={(e) => setTalkForm((p) => ({ ...p, presenter: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: talkErrors.presenter ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                {talkErrors.presenter && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{talkErrors.presenter}</p>}
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
                    border: talkErrors.newAttendee ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                    color: colors.textPrimary, outline: 'none',
                  }}
                />
                <Btn variant="secondary" onClick={handleAddAttendee} style={{ flexShrink: 0 }}>
                  Add
                </Btn>
              </div>
              {talkErrors.newAttendee && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '0 0 4px' }}>{talkErrors.newAttendee}</p>}
              {talkForm.attendees.length > 0 && (
                <div style={{
                  border: `1px solid ${colors.borderDefault}`,
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
              <Btn variant="ghost" onClick={handleCloseTalkModal}>Cancel</Btn>
              <Btn onClick={handleSaveTalk}>Save Talk</Btn>
            </div>
          </div>
        </div>
      )}

      <Modal open={showAiScanModal} onClose={() => setShowAiScanModal(false)} title="AI Safety Scan" width="720px">
        <SafetyPhotoAnalyzer
          onClose={() => setShowAiScanModal(false)}
          onCreateObservation={(v, photoUrl) => {
            setIncidentForm((f) => ({
              ...f,
              description: `[AI-detected ${v.severity} violation – ${v.category}]\n${v.description}\n\nOSHA: ${v.osha_reference}\nCorrective action: ${v.corrective_action}\n\nPhoto: ${photoUrl}`,
            }))
            setShowAiScanModal(false)
            setShowIncidentModal(true)
            toast.info('Incident form pre-filled from AI analysis')
          }}
        />
      </Modal>
    </PageContainer>
  )
}

export default Safety

