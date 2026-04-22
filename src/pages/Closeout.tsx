import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  CheckCircle2, Plus, Shield, BookOpen, Package, FileCheck, Search,
  Award, Trash2, ExternalLink, AlertTriangle, ClipboardList, Upload,
  FileText, ChevronDown, ChevronRight, Building,
  GraduationCap, Activity, DollarSign, Thermometer, Stamp,
  ShieldCheck, Archive, CheckSquare, Filter, ArrowRight,
  Zap, Eye, Link2,
} from 'lucide-react'
import { PageContainer, Card, SectionHeader, MetricBox, Btn, Skeleton, Modal, InputField, EmptyState, ProgressBar, Tag } from '../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme'
import { useProjectId } from '../hooks/useProjectId'
import { usePunchItemsSummary } from '../hooks/queries/enterprise-modules'
import {
  useCloseoutData,
  useCreateCloseoutItem,
  useTransitionCloseoutStatus,
  useDeleteCloseoutItem,
  useUploadCloseoutDoc,
  useGenerateCloseoutList,
  getCloseoutStatusConfig,
  getCloseoutCategoryConfig,
  type CloseoutItemRow,
  type CloseoutItemStatus,
  type CloseoutCategory,
  type ProjectType,
} from '../hooks/queries/closeout'
import { useAuth } from '../hooks/useAuth'
import { toast } from 'sonner'
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation'
import { PageInsightBanners } from '../components/ai/PredictiveAlert'
import { PermissionGate } from '../components/auth/PermissionGate'
import { useNavigate } from 'react-router-dom'
import { getValidCloseoutTransitions, generateCloseoutList, STANDARD_WARRANTY_PERIODS } from '../machines/closeoutMachine'

// ── Category icon mapping ────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  om_manual: BookOpen,
  as_built: FileText,
  warranty: Shield,
  lien_waiver: FileCheck,
  substantial_completion: Award,
  certificate_occupancy: Building,
  training: GraduationCap,
  spare_parts: Package,
  attic_stock: Archive,
  commissioning: Activity,
  punch_list: CheckSquare,
  final_payment: DollarSign,
  consent_surety: Shield,
  testing: Thermometer,
  inspection: Search,
  permit_closeout: Stamp,
  insurance: ShieldCheck,
  other: FileText,
}

const CATEGORY_COLORS: Record<string, string> = {
  om_manual: '#3B82F6',
  as_built: '#EC4899',
  warranty: '#8B5CF6',
  lien_waiver: '#10B981',
  substantial_completion: '#F59E0B',
  certificate_occupancy: '#14B8A6',
  training: '#6366F1',
  spare_parts: '#F97316',
  attic_stock: '#84CC16',
  commissioning: '#06B6D4',
  punch_list: '#EF4444',
  final_payment: '#22C55E',
  consent_surety: '#A855F7',
  testing: '#EAB308',
  inspection: '#F43F5E',
  permit_closeout: '#0EA5E9',
  insurance: '#64748B',
  other: '#9CA3AF',
}

// ── Tab type ─────────────────────────────────────────────

type CloseoutTab = 'overview' | 'items' | 'warranties' | 'handoff'

// ── Project type options ─────────────────────────────────

const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'mixed_use', label: 'Mixed Use' },
]

// ── Category options for form ────────────────────────────

const CATEGORY_OPTIONS: { value: CloseoutCategory; label: string }[] = [
  { value: 'om_manual', label: 'O&M Manual' },
  { value: 'as_built', label: 'As-Built Drawing' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'lien_waiver', label: 'Lien Waiver' },
  { value: 'substantial_completion', label: 'Substantial Completion' },
  { value: 'certificate_occupancy', label: 'Certificate of Occupancy' },
  { value: 'training', label: 'Training Record' },
  { value: 'spare_parts', label: 'Spare Parts' },
  { value: 'attic_stock', label: 'Attic Stock' },
  { value: 'commissioning', label: 'Commissioning Report' },
  { value: 'punch_list', label: 'Final Punch List' },
  { value: 'final_payment', label: 'Final Payment' },
  { value: 'consent_surety', label: 'Consent of Surety' },
  { value: 'testing', label: 'Testing Report' },
  { value: 'inspection', label: 'Final Inspection' },
  { value: 'permit_closeout', label: 'Permit Closeout' },
  { value: 'insurance', label: 'Insurance Certificate' },
  { value: 'other', label: 'Other' },
]

// ── Helper: format file size ─────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// ── Helper: days until date ──────────────────────────────

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Donut Chart Component ────────────────────────────────

interface DonutSegment {
  value: number
  color: string
  label: string
}

const DonutChart: React.FC<{ segments: DonutSegment[]; size?: number; centerLabel?: string; centerValue?: string }> = ({
  segments,
  size = 140,
  centerLabel,
  centerValue,
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke={colors.borderSubtle} strokeWidth="10" opacity="0.3" />
        {centerValue && (
          <text x="50" y="48" textAnchor="middle" fontSize="20" fontWeight="600" fill={colors.textPrimary}>{centerValue}</text>
        )}
        {centerLabel && (
          <text x="50" y="62" textAnchor="middle" fontSize="9" fill={colors.textTertiary}>{centerLabel}</text>
        )}
      </svg>
    )
  }

  let cumulative = 0
  const radius = 38
  const circumference = 2 * Math.PI * radius

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total
        const dashLength = circumference * pct
        const dashOffset = circumference * (1 - cumulative / total)
        cumulative += seg.value
        return (
          <circle
            key={i}
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
            strokeLinecap="round"
          >
            <title>{seg.label}: {seg.value}</title>
          </circle>
        )
      })}
      {centerValue && (
        <text x="50" y="48" textAnchor="middle" fontSize="22" fontWeight="700" fill={colors.textPrimary}>{centerValue}</text>
      )}
      {centerLabel && (
        <text x="50" y="63" textAnchor="middle" fontSize="9" fontWeight="500" fill={colors.textTertiary}>{centerLabel}</text>
      )}
    </svg>
  )
}

// ── Status Action Button ─────────────────────────────────

const StatusActionButton: React.FC<{
  item: CloseoutItemRow
  projectId: string
  onTransition: (id: string, status: CloseoutItemStatus, projectId: string) => void
  isPending: boolean
}> = ({ item, projectId, onTransition, isPending }) => {
  const currentStatus = (item.status || 'required') as CloseoutItemStatus
  const actions = getValidCloseoutTransitions(currentStatus)
  const statusConfig = getCloseoutStatusConfig(currentStatus)

  if (actions.length === 0) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: `4px ${spacing['3']}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusConfig.color, backgroundColor: statusConfig.bg,
        }}
      >
        {currentStatus === 'approved' && <CheckCircle2 size={12} />}
        {statusConfig.label}
      </span>
    )
  }

  // Map action labels to status values
  const actionMap: Record<string, CloseoutItemStatus> = {
    'Send Request': 'requested',
    'Mark Submitted': 'submitted',
    'Start Review': 'under_review',
    'Approve': 'approved',
    'Reject': 'rejected',
    'Resubmit': 'submitted',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
      <span
        style={{
          display: 'inline-flex', alignItems: 'center',
          padding: `3px ${spacing['2']}`, borderRadius: borderRadius.full,
          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
          color: statusConfig.color, backgroundColor: statusConfig.bg,
        }}
      >
        {statusConfig.label}
      </span>
      {actions.map((action) => {
        const targetStatus = actionMap[action]
        if (!targetStatus) return null
        const isApprove = action === 'Approve'
        const isReject = action === 'Reject'
        return (
          <button
            key={action}
            onClick={() => onTransition(item.id, targetStatus, projectId)}
            disabled={isPending}
            title={action}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: `3px ${spacing['2']}`, borderRadius: borderRadius.base,
              border: `1px solid ${isApprove ? colors.statusActive : isReject ? colors.statusCritical : colors.borderSubtle}`,
              backgroundColor: 'transparent',
              color: isApprove ? colors.statusActive : isReject ? colors.statusCritical : colors.textSecondary,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <ArrowRight size={10} />
            {action}
          </button>
        )
      })}
    </div>
  )
}

// ── Closeout Item Row Component ──────────────────────────

const CloseoutItemCard: React.FC<{
  item: CloseoutItemRow
  projectId: string
  onTransition: (id: string, status: CloseoutItemStatus, projectId: string) => void
  onDelete: (id: string, projectId: string) => void
  onUpload: (itemId: string, file: File) => void
  isTransitioning: boolean
  isUploading: boolean
}> = ({ item, projectId, onTransition, onDelete, onUpload, isTransitioning, isUploading }) => {
  const [expanded, setExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentStatus = (item.status || 'required') as CloseoutItemStatus
  const statusConfig = getCloseoutStatusConfig(currentStatus)
  const isApproved = currentStatus === 'approved'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(item.id, file)
      e.target.value = ''
    }
  }

  return (
    <div
      style={{
        borderRadius: borderRadius.base,
        backgroundColor: isApproved ? colors.statusActiveExtraSubtle || colors.surfaceInset : colors.surfaceInset,
        overflow: 'hidden',
        border: `1px solid ${isApproved ? colors.statusActive : 'transparent'}`,
        opacity: isApproved ? 0.85 : 1,
        transition: 'all 150ms ease',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: spacing['3'],
          padding: `${spacing['3']} ${spacing['4']}`,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand icon */}
        <span style={{ color: colors.textTertiary, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>

        {/* Title and metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
            color: isApproved ? colors.textSecondary : colors.textPrimary,
            textDecoration: isApproved ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.description}
          </p>
          <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {item.trade}
            {item.assigned_to && ` · ${item.assigned_to}`}
          </p>
        </div>

        {/* Document indicator */}
        {item.document_url ? (
          <a
            href={item.document_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
              backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo,
              fontSize: typography.fontSize.caption, textDecoration: 'none',
            }}
            title="View uploaded document"
          >
            <Link2 size={10} /> Document
          </a>
        ) : (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: `2px ${spacing['2']}`, borderRadius: borderRadius.full,
            backgroundColor: colors.statusCriticalSubtle, color: colors.statusCritical,
            fontSize: typography.fontSize.caption,
          }}>
            No doc
          </span>
        )}

        {/* Due date */}
        {item.due_date && (
          <span style={{
            fontSize: typography.fontSize.caption,
            color: daysUntil(item.due_date) < 0 ? colors.statusCritical :
                   daysUntil(item.due_date) < 14 ? colors.statusPending : colors.textTertiary,
            fontWeight: daysUntil(item.due_date) < 7 ? typography.fontWeight.semibold : typography.fontWeight.regular,
            whiteSpace: 'nowrap',
          }}>
            {daysUntil(item.due_date) < 0 ? 'Overdue' :
             daysUntil(item.due_date) === 0 ? 'Due today' :
             `Due ${new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </span>
        )}

        {/* Status + Actions */}
        <div onClick={(e) => e.stopPropagation()}>
          <StatusActionButton
            item={item}
            projectId={projectId}
            onTransition={onTransition}
            isPending={isTransitioning}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: `0 ${spacing['4']} ${spacing['4']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
          paddingTop: spacing['3'],
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'], marginBottom: spacing['3'] }}>
            {item.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Notes / Spec Section</p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.notes}</p>
              </div>
            )}
            {item.completed_date && (
              <div>
                <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: '2px' }}>Completed</p>
                <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.statusActive }}>
                  {new Date(item.completed_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
            {/* Upload button */}
            <label
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.base,
                border: `1px solid ${colors.borderSubtle}`, cursor: isUploading ? 'wait' : 'pointer',
                fontSize: typography.fontSize.caption, color: colors.textSecondary,
                backgroundColor: 'transparent', opacity: isUploading ? 0.6 : 1,
              }}
            >
              <Upload size={12} />
              {isUploading ? 'Uploading...' : 'Upload Document'}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.zip"
                disabled={isUploading}
              />
            </label>

            {/* View document */}
            {item.document_url && (
              <a
                href={item.document_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.base,
                  border: `1px solid ${colors.borderSubtle}`,
                  fontSize: typography.fontSize.caption, color: colors.statusInfo,
                  textDecoration: 'none',
                }}
              >
                <Eye size={12} /> View
              </a>
            )}

            <div style={{ flex: 1 }} />

            {/* Delete */}
            <PermissionGate permission="project.settings" fallback={null}>
              <button
                onClick={() => onDelete(item.id, projectId)}
                title="Delete item"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: borderRadius.base,
                  backgroundColor: 'transparent', border: `1px solid ${colors.borderSubtle}`,
                  cursor: 'pointer', color: colors.textTertiary, flexShrink: 0,
                }}
              >
                <Trash2 size={13} />
              </button>
            </PermissionGate>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ██ MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export const Closeout: React.FC = () => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const navigate = useNavigate()

  // ── Data queries ─────────────────────────────────────
  const { data: closeoutData, isLoading } = useCloseoutData(projectId ?? undefined)
  const { data: punchSummary } = usePunchItemsSummary(projectId ?? undefined)

  // ── Realtime ─────────────────────────────────────────
  useRealtimeInvalidation(projectId ?? undefined)

  // ── Mutations ────────────────────────────────────────
  const createItem = useCreateCloseoutItem()
  const transitionStatus = useTransitionCloseoutStatus()
  const deleteItem = useDeleteCloseoutItem()
  const uploadDoc = useUploadCloseoutDoc()
  const generateList = useGenerateCloseoutList()

  // ── Local state ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CloseoutTab>('overview')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType>('commercial')

  const [form, setForm] = useState({
    category: 'warranty' as CloseoutCategory,
    description: '',
    trade: '',
    assigned_to: '',
    due_date: '',
    notes: '',
  })

  // ── Computed ─────────────────────────────────────────
  const items = closeoutData?.items ?? []
  const total = closeoutData?.total ?? 0
  const approved = closeoutData?.approved ?? 0
  const pctComplete = closeoutData?.pctComplete ?? 0
  const byCategory = closeoutData?.byCategory ?? {}
  const warranties = closeoutData?.warranties ?? []

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items
    if (filterCategory !== 'all') {
      result = result.filter(i => i.category === filterCategory)
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => (i.status || 'required') === filterStatus)
    }
    return result
  }, [items, filterCategory, filterStatus])

  // Group filtered items by category
  const groupedFiltered = useMemo(() => {
    return filteredItems.reduce<Record<string, CloseoutItemRow[]>>((acc, item) => {
      const cat = item.category || 'other'
      acc[cat] = acc[cat] || []
      acc[cat].push(item)
      return acc
    }, {})
  }, [filteredItems])

  // Category progress for donut chart
  const categoryProgress = useMemo(() => {
    const cats = Object.keys(byCategory)
    return cats.map(cat => {
      const catItems = byCategory[cat]
      const catApproved = catItems.filter(i => i.status === 'approved').length
      return {
        category: cat,
        total: catItems.length,
        approved: catApproved,
        pct: catItems.length > 0 ? Math.round((catApproved / catItems.length) * 100) : 0,
      }
    }).sort((a, b) => a.pct - b.pct) // Sort by least complete first
  }, [byCategory])

  // Outstanding items (not approved) sorted by urgency
  const outstandingItems = useMemo(() => {
    return items
      .filter(i => i.status !== 'approved')
      .sort((a, b) => {
        // Overdue items first, then by due date
        if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })
  }, [items])

  // Warranty expiration warnings
  const warningWarranties = useMemo(() => {
    return warranties.filter(w => w.warrantyStatus === 'expiring_soon' || w.warrantyStatus === 'expired')
  }, [warranties])

  // ── Handlers ─────────────────────────────────────────

  const handleTransition = useCallback(async (id: string, status: CloseoutItemStatus, pid: string) => {
    try {
      await transitionStatus.mutateAsync({ id, status, projectId: pid })
      toast.success(`Status updated to ${getCloseoutStatusConfig(status).label}`)
    } catch (err) {
      toast.error('Status update failed: ' + ((err as Error).message || 'Unknown error'))
    }
  }, [transitionStatus])

  const handleDelete = useCallback(async (id: string, pid: string) => {
    if (!window.confirm('Delete this closeout item? This cannot be undone.')) return
    try {
      await deleteItem.mutateAsync({ id, projectId: pid })
      toast.success('Item deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }, [deleteItem])

  const handleUpload = useCallback(async (closeoutItemId: string, file: File) => {
    if (!projectId) return
    try {
      await uploadDoc.mutateAsync({
        projectId,
        closeoutItemId,
        file,
        userId: user?.id,
      })
      toast.success(`"${file.name}" uploaded successfully`)
    } catch (err) {
      toast.error('Upload failed: ' + ((err as Error).message || 'Unknown error'))
    }
  }, [projectId, uploadDoc, user?.id])

  const handleCreateItem = useCallback(async () => {
    if (!projectId || !form.description.trim()) {
      toast.error('Description is required')
      return
    }
    if (!form.trade.trim()) {
      toast.error('Trade is required')
      return
    }
    try {
      await createItem.mutateAsync({
        project_id: projectId,
        category: form.category,
        description: form.description.trim(),
        trade: form.trade.trim(),
        assigned_to: form.assigned_to.trim() || null,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      })
      toast.success('Closeout item created')
      setCreateModalOpen(false)
      setForm({ category: 'warranty', description: '', trade: '', assigned_to: '', due_date: '', notes: '' })
    } catch (err) {
      toast.error('Failed to create: ' + ((err as Error).message || 'Unknown error'))
    }
  }, [projectId, form, createItem])

  const handleGenerateList = useCallback(async () => {
    if (!projectId) return
    try {
      const result = await generateList.mutateAsync({ projectId, projectType: selectedProjectType })
      if (result.count === 0) {
        toast.info('All template items already exist for this project')
      } else {
        toast.success(`Generated ${result.count} closeout items from ${selectedProjectType} template`)
      }
      setGenerateModalOpen(false)
    } catch (err) {
      toast.error('Failed to generate: ' + ((err as Error).message || 'Unknown error'))
    }
  }, [projectId, selectedProjectType, generateList])

  // ── Tab style helper ─────────────────────────────────

  const tabStyle = (tab: CloseoutTab): React.CSSProperties => ({
    padding: `${spacing['2']} ${spacing['4']}`,
    fontSize: typography.fontSize.sm,
    fontWeight: activeTab === tab ? typography.fontWeight.semibold : typography.fontWeight.medium,
    color: activeTab === tab ? colors.primaryOrange : colors.textSecondary,
    borderBottom: `2px solid ${activeTab === tab ? colors.primaryOrange : 'transparent'}`,
    background: 'none',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: activeTab === tab ? colors.primaryOrange : 'transparent',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  })

  // ── Select style ─────────────────────────────────────

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: spacing['2'], borderRadius: borderRadius.base,
    border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
  }

  // ══════════════════════════════════════════════════════
  // ██ RENDER
  // ══════════════════════════════════════════════════════

  return (
    <PageContainer
      title="Project Closeout"
      subtitle="Track every deliverable from contract requirement to owner acceptance"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <PermissionGate permission="project.settings" fallback={null}>
            <Btn variant="secondary" size="sm" icon={<Zap size={14} />} onClick={() => setGenerateModalOpen(true)}>
              Generate List
            </Btn>
          </PermissionGate>
          <PermissionGate
            permission="project.settings"
            fallback={
              <span title="Your role doesn't allow adding closeout items.">
                <Btn variant="primary" size="sm" icon={<Plus size={14} />} disabled>New Item</Btn>
              </span>
            }
          >
            <Btn variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setCreateModalOpen(true)}>New Item</Btn>
          </PermissionGate>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing['4'] }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height="100px" />)}
          </div>
          <Skeleton width="100%" height="300px" />
        </div>
      ) : (
        <>
          {/* ── AI Insights ─────────────────────────── */}
          <PageInsightBanners page="closeout" />

          {/* ── Metric Cards ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing['4'], marginBottom: spacing['4'] }}>
            <MetricBox
              label="Total Items"
              value={total}
            />
            <MetricBox
              label="Approved"
              value={approved}
              colorOverride={approved === total && total > 0 ? 'success' : undefined}
            />
            <MetricBox
              label="Outstanding"
              value={total - approved}
              colorOverride={total - approved > 0 ? 'warning' : 'success'}
            />
            <MetricBox
              label="Complete"
              value={`${pctComplete}%`}
              colorOverride={pctComplete === 100 ? 'success' : pctComplete >= 75 ? 'warning' : 'danger'}
            />
          </div>

          {/* ── Tab Navigation ────────────────────────── */}
          <div style={{ display: 'flex', gap: spacing['1'], borderBottom: `1px solid ${colors.borderSubtle}`, marginBottom: spacing['4'] }}>
            <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
            <button style={tabStyle('items')} onClick={() => setActiveTab('items')}>All Items ({total})</button>
            <button style={tabStyle('warranties')} onClick={() => setActiveTab('warranties')}>
              Warranties ({warranties.length})
              {warningWarranties.length > 0 && (
                <span style={{
                  display: 'inline-block', marginLeft: spacing['1'],
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: colors.statusCritical,
                }} />
              )}
            </button>
            <button style={tabStyle('handoff')} onClick={() => setActiveTab('handoff')}>Handoff</button>
          </div>

          {/* ══════════════════════════════════════════ */}
          {/* ██ OVERVIEW TAB                           */}
          {/* ══════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>

              {/* Progress by Category */}
              <Card padding={spacing['5']}>
                <SectionHeader title="Progress by Category" />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['6'], marginTop: spacing['4'] }}>
                  {/* Donut chart */}
                  <div style={{ flexShrink: 0 }}>
                    <DonutChart
                      size={160}
                      centerValue={`${pctComplete}%`}
                      centerLabel="Complete"
                      segments={[
                        { value: approved, color: colors.chartGreen || '#A3E635', label: 'Approved' },
                        { value: closeoutData?.submitted ?? 0, color: colors.chartCyan || '#06B6D4', label: 'Submitted' },
                        { value: closeoutData?.underReview ?? 0, color: colors.chartAmber || '#FB923C', label: 'Under Review' },
                        { value: closeoutData?.rejected ?? 0, color: colors.chartRed || '#E05252', label: 'Rejected' },
                        { value: (closeoutData?.required ?? 0) + (closeoutData?.requested ?? 0), color: colors.gray400 || '#B0B0B0', label: 'Pending' },
                      ]}
                    />
                  </div>

                  {/* Category breakdown */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                    {categoryProgress.map(cp => {
                      const catConfig = getCloseoutCategoryConfig(cp.category as CloseoutCategory)
                      const catColor = CATEGORY_COLORS[cp.category] || '#9CA3AF'
                      return (
                        <div key={cp.category} style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', backgroundColor: catColor, flexShrink: 0,
                          }} />
                          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                            {catConfig.label}
                          </span>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, minWidth: 40, textAlign: 'right' }}>
                            {cp.approved}/{cp.total}
                          </span>
                          <div style={{ width: 80, height: 6, borderRadius: 3, backgroundColor: colors.surfaceInset, overflow: 'hidden' }}>
                            <div style={{
                              width: `${cp.pct}%`, height: '100%', borderRadius: 3,
                              backgroundColor: cp.pct === 100 ? colors.statusActive : catColor,
                              transition: 'width 300ms ease',
                            }} />
                          </div>
                          <span style={{ fontSize: typography.fontSize.caption, color: cp.pct === 100 ? colors.statusActive : colors.textTertiary, minWidth: 32, textAlign: 'right', fontWeight: typography.fontWeight.medium }}>
                            {cp.pct}%
                          </span>
                        </div>
                      )
                    })}
                    {categoryProgress.length === 0 && (
                      <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
                        No closeout items yet. Use "Generate List" to create items from industry templates.
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Punch Items Integration */}
              <Card padding={spacing['5']}>
                <SectionHeader title="Punch List Status" action={
                  <Btn variant="secondary" size="sm" icon={<ExternalLink size={14} />} onClick={() => navigate('/punch-list')}>
                    View Punch List
                  </Btn>
                } />
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['6'], marginTop: spacing['3'] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                    <ClipboardList size={18} color={colors.statusInfo} />
                    <div>
                      <p style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                        {punchSummary?.total ?? 0}
                      </p>
                      <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Total Items</p>
                    </div>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.semibold, color: colors.statusActive }}>
                      {punchSummary?.pct ?? 0}%
                    </p>
                    <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>Completed</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <ProgressBar value={punchSummary?.pct ?? 0} />
                    <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                      {punchSummary?.completed ?? 0} of {punchSummary?.total ?? 0} punch items resolved
                    </p>
                  </div>
                </div>
              </Card>

              {/* Outstanding Items — most urgent first */}
              {outstandingItems.length > 0 && (
                <Card padding={spacing['5']}>
                  <SectionHeader title="Action Required" action={
                    <span style={{ fontSize: typography.fontSize.caption, color: colors.statusCritical, fontWeight: typography.fontWeight.medium }}>
                      {outstandingItems.length} items outstanding
                    </span>
                  } />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                    {outstandingItems.slice(0, 10).map(item => {
                      const statusCfg = getCloseoutStatusConfig((item.status || 'required') as CloseoutItemStatus)
                      const catCfg = getCloseoutCategoryConfig((item.category || 'other') as CloseoutCategory)
                      const overdue = item.due_date && daysUntil(item.due_date) < 0
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: spacing['3'],
                            padding: spacing['3'], borderRadius: borderRadius.base,
                            backgroundColor: overdue ? colors.statusCriticalSubtle : colors.surfaceInset,
                            border: overdue ? `1px solid ${colors.statusCritical}` : `1px solid transparent`,
                          }}
                        >
                          {overdue && <AlertTriangle size={14} color={colors.statusCritical} style={{ flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                            {item.description}
                          </span>
                          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{item.trade}</span>
                          <Tag label={catCfg.label} />
                          <Tag label={statusCfg.label} color={statusCfg.color} backgroundColor={statusCfg.bg} />
                          {item.due_date && (
                            <span style={{
                              fontSize: typography.fontSize.caption,
                              color: overdue ? colors.statusCritical : colors.textTertiary,
                              fontWeight: overdue ? typography.fontWeight.semibold : typography.fontWeight.regular,
                              whiteSpace: 'nowrap',
                            }}>
                              {overdue ? `${Math.abs(daysUntil(item.due_date))}d overdue` :
                               `${daysUntil(item.due_date)}d left`}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {outstandingItems.length > 10 && (
                      <button
                        onClick={() => setActiveTab('items')}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['1'],
                          padding: spacing['2'], borderRadius: borderRadius.base,
                          border: `1px dashed ${colors.borderSubtle}`, backgroundColor: 'transparent',
                          color: colors.textSecondary, fontSize: typography.fontSize.sm, cursor: 'pointer',
                        }}
                      >
                        View all {outstandingItems.length} outstanding items <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </Card>
              )}

              {/* Warranty Alerts */}
              {warningWarranties.length > 0 && (
                <Card padding={spacing['5']}>
                  <SectionHeader title="Warranty Alerts" action={
                    <Btn variant="secondary" size="sm" onClick={() => setActiveTab('warranties')}>View All</Btn>
                  } />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'], marginTop: spacing['3'] }}>
                    {warningWarranties.map(w => {
                      const days = w.due_date ? daysUntil(w.due_date) : 0
                      const isExpired = days < 0
                      return (
                        <div
                          key={w.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: spacing['3'],
                            padding: spacing['3'], borderRadius: borderRadius.base,
                            backgroundColor: isExpired ? colors.statusCriticalSubtle : colors.statusPendingSubtle,
                            borderLeft: `3px solid ${isExpired ? colors.statusCritical : colors.statusPending}`,
                          }}
                        >
                          <AlertTriangle size={14} color={isExpired ? colors.statusCritical : colors.statusPending} />
                          <span style={{ flex: 1, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                            {w.description}
                          </span>
                          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{w.trade}</span>
                          <span style={{
                            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                            color: isExpired ? colors.statusCritical : colors.statusPending,
                          }}>
                            {isExpired ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Empty state */}
              {total === 0 && (
                <Card padding={spacing['5']}>
                  <EmptyState
                    icon={<CheckCircle2 size={48} />}
                    title="No closeout items yet"
                    description="Generate a closeout checklist from industry templates or add items manually. The closeout list tracks every deliverable from contract requirement through owner acceptance."
                  />
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ██ ALL ITEMS TAB                          */}
          {/* ══════════════════════════════════════════ */}
          {activeTab === 'items' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'center' }}>
                <Filter size={16} color={colors.textTertiary} />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{
                    padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.base,
                    border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
                    color: colors.textPrimary, fontSize: typography.fontSize.sm,
                  }}
                >
                  <option value="all">All Categories</option>
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{
                    padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.base,
                    border: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
                    color: colors.textPrimary, fontSize: typography.fontSize.sm,
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="required">Required</option>
                  <option value="requested">Requested</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                  {filteredItems.length} of {total} items
                </span>
              </div>

              {/* Grouped items */}
              {Object.keys(groupedFiltered).sort().map(cat => {
                const catItems = groupedFiltered[cat]
                const catConfig = getCloseoutCategoryConfig(cat as CloseoutCategory)
                const CatIcon = CATEGORY_ICONS[cat] || FileText
                const catColor = CATEGORY_COLORS[cat] || '#9CA3AF'
                const catApproved = catItems.filter(i => i.status === 'approved').length
                const catPct = catItems.length > 0 ? Math.round((catApproved / catItems.length) * 100) : 0

                return (
                  <Card key={cat} padding={spacing['4']}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['3'] }}>
                      <CatIcon size={18} color={catColor} />
                      <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                        {catConfig.label}
                      </h3>
                      <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                        ({catApproved}/{catItems.length})
                      </span>
                      <div style={{ flex: 1 }} />
                      <div style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: colors.surfaceInset, overflow: 'hidden' }}>
                        <div style={{ width: `${catPct}%`, height: '100%', borderRadius: 2, backgroundColor: catPct === 100 ? colors.statusActive : catColor }} />
                      </div>
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        color: catPct === 100 ? colors.statusActive : colors.textTertiary,
                        fontWeight: typography.fontWeight.medium,
                      }}>
                        {catPct}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
                      {catItems.map(item => (
                        <CloseoutItemCard
                          key={item.id}
                          item={item}
                          projectId={projectId!}
                          onTransition={handleTransition}
                          onDelete={handleDelete}
                          onUpload={handleUpload}
                          isTransitioning={transitionStatus.isPending}
                          isUploading={uploadDoc.isPending}
                        />
                      ))}
                    </div>
                  </Card>
                )
              })}

              {filteredItems.length === 0 && (
                <Card padding={spacing['5']}>
                  <EmptyState
                    icon={<Filter size={48} />}
                    title={total === 0 ? 'No closeout items' : 'No items match filters'}
                    description={total === 0 ? 'Generate a closeout checklist or add items manually.' : 'Try adjusting the category or status filter.'}
                  />
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ██ WARRANTIES TAB                         */}
          {/* ══════════════════════════════════════════ */}
          {activeTab === 'warranties' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              {/* Warranty summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing['3'] }}>
                <div style={{ padding: spacing['4'], borderRadius: borderRadius.lg, backgroundColor: colors.statusActiveSubtle, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: colors.statusActive }}>
                    {warranties.filter(w => w.warrantyStatus === 'active').length}
                  </p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Active</p>
                </div>
                <div style={{ padding: spacing['4'], borderRadius: borderRadius.lg, backgroundColor: colors.statusPendingSubtle, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: colors.statusPending }}>
                    {warranties.filter(w => w.warrantyStatus === 'expiring_soon').length}
                  </p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Expiring Soon</p>
                </div>
                <div style={{ padding: spacing['4'], borderRadius: borderRadius.lg, backgroundColor: colors.statusCriticalSubtle, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: colors.statusCritical }}>
                    {warranties.filter(w => w.warrantyStatus === 'expired').length}
                  </p>
                  <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Expired</p>
                </div>
              </div>

              {/* Standard warranty reference */}
              <Card padding={spacing['4']}>
                <SectionHeader title="Industry Standard Warranty Periods" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'], marginTop: spacing['3'] }}>
                  {Object.entries(STANDARD_WARRANTY_PERIODS).map(([trade, months]) => (
                    <span
                      key={trade}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                        padding: `${spacing['1']} ${spacing['3']}`, borderRadius: borderRadius.full,
                        backgroundColor: colors.surfaceInset, fontSize: typography.fontSize.caption,
                        color: colors.textSecondary,
                      }}
                    >
                      {trade}: <strong style={{ color: colors.textPrimary }}>{months >= 12 ? `${months / 12}yr` : `${months}mo`}</strong>
                    </span>
                  ))}
                </div>
              </Card>

              {/* Warranty items table */}
              <Card padding={spacing['4']}>
                <SectionHeader title="Warranty Items" action={
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {warranties.length} warranties tracked
                  </span>
                } />
                {warranties.length > 0 ? (
                  <div style={{ overflowX: 'auto', marginTop: spacing['3'] }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${colors.borderSubtle}` }}>
                          {['Description', 'Trade', 'Assigned To', 'Due / Expires', 'Status', 'Document', 'Actions'].map(h => (
                            <th key={h} style={{
                              padding: spacing['2'], textAlign: 'left',
                              fontSize: typography.fontSize.caption, color: colors.textTertiary,
                              fontWeight: typography.fontWeight.medium,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {warranties.map(w => {
                          const days = w.due_date ? daysUntil(w.due_date) : null
                          const isExpired = days !== null && days < 0
                          const isExpiringSoon = days !== null && days >= 0 && days <= 30
                          return (
                            <tr key={w.id} style={{ borderBottom: `1px solid ${colors.borderSubtle}` }}>
                              <td style={{ padding: spacing['2'], fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                                {w.description}
                              </td>
                              <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{w.trade}</td>
                              <td style={{ padding: spacing['2'], color: colors.textSecondary }}>{w.assigned_to || '—'}</td>
                              <td style={{ padding: spacing['2'] }}>
                                {w.due_date ? (
                                  <span style={{
                                    color: isExpired ? colors.statusCritical : isExpiringSoon ? colors.statusPending : colors.textSecondary,
                                    fontWeight: (isExpired || isExpiringSoon) ? typography.fontWeight.semibold : typography.fontWeight.regular,
                                  }}>
                                    {new Date(w.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {isExpired && ` (${Math.abs(days!)}d overdue)`}
                                    {isExpiringSoon && ` (${days}d left)`}
                                  </span>
                                ) : '—'}
                              </td>
                              <td style={{ padding: spacing['2'] }}>
                                <StatusActionButton
                                  item={w}
                                  projectId={projectId!}
                                  onTransition={handleTransition}
                                  isPending={transitionStatus.isPending}
                                />
                              </td>
                              <td style={{ padding: spacing['2'] }}>
                                {w.document_url ? (
                                  <a href={w.document_url} target="_blank" rel="noopener noreferrer" style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    color: colors.statusInfo, fontSize: typography.fontSize.caption, textDecoration: 'none',
                                  }}>
                                    <Eye size={12} /> View
                                  </a>
                                ) : (
                                  <span style={{ color: colors.statusCritical, fontSize: typography.fontSize.caption }}>Missing</span>
                                )}
                              </td>
                              <td style={{ padding: spacing['2'] }}>
                                <label style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: `2px ${spacing['2']}`, borderRadius: borderRadius.base,
                                  border: `1px solid ${colors.borderSubtle}`, cursor: 'pointer',
                                  fontSize: typography.fontSize.caption, color: colors.textSecondary,
                                }}>
                                  <Upload size={10} /> Upload
                                  <input type="file" hidden onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) handleUpload(w.id, file)
                                    e.target.value = ''
                                  }} accept=".pdf,.doc,.docx,.jpg,.png" />
                                </label>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ marginTop: spacing['3'] }}>
                    <EmptyState
                      icon={<Shield size={48} />}
                      title="No warranties tracked"
                      description="Add warranty items or generate a closeout list to start tracking warranty expirations."
                    />
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* ██ HANDOFF TAB                            */}
          {/* ══════════════════════════════════════════ */}
          {activeTab === 'handoff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              <Card padding={spacing['5']}>
                <SectionHeader title="Owner Handoff Package" action={
                  <span style={{
                    padding: `4px ${spacing['3']}`, borderRadius: borderRadius.full,
                    fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                    color: pctComplete === 100 ? colors.statusActive : colors.statusPending,
                    backgroundColor: pctComplete === 100 ? colors.statusActiveSubtle : colors.statusPendingSubtle,
                  }}>
                    {pctComplete === 100 ? 'Ready for Handoff' : `${pctComplete}% Complete`}
                  </span>
                } />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['6'], margin: `${spacing['4']} 0` }}>
                  {/* Progress ring */}
                  <div style={{ flexShrink: 0 }}>
                    <DonutChart
                      size={120}
                      centerValue={`${pctComplete}%`}
                      centerLabel="Ready"
                      segments={[
                        { value: approved, color: colors.statusActive, label: 'Approved' },
                        { value: total - approved, color: colors.surfaceInset, label: 'Outstanding' },
                      ]}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ margin: `0 0 ${spacing['2']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {approved} of {total} closeout deliverables approved. All items must reach "Approved" status before the handoff package can be submitted to the owner.
                    </p>

                    {/* Category readiness */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                      {categoryProgress.map(cp => {
                        const catConfig = getCloseoutCategoryConfig(cp.category as CloseoutCategory)
                        const isComplete = cp.pct === 100
                        return (
                          <div key={cp.category} style={{
                            display: 'flex', alignItems: 'center', gap: spacing['2'],
                            padding: `${spacing['1']} ${spacing['2']}`, borderRadius: borderRadius.base,
                          }}>
                            {isComplete ? (
                              <CheckCircle2 size={14} color={colors.statusActive} />
                            ) : (
                              <span style={{
                                width: 14, height: 14, borderRadius: '50%',
                                border: `2px solid ${colors.borderSubtle}`, display: 'inline-block',
                              }} />
                            )}
                            <span style={{
                              flex: 1, fontSize: typography.fontSize.sm,
                              color: isComplete ? colors.textSecondary : colors.textPrimary,
                              textDecoration: isComplete ? 'line-through' : 'none',
                            }}>
                              {catConfig.label}
                            </span>
                            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                              {cp.approved}/{cp.total}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Missing documents alert */}
                {(() => {
                  const missingDocs = items.filter(i => i.status === 'approved' && !i.document_url)
                  if (missingDocs.length === 0) return null
                  return (
                    <div style={{
                      padding: spacing['3'], backgroundColor: colors.statusPendingSubtle,
                      borderRadius: borderRadius.base, borderLeft: `3px solid ${colors.statusPending}`,
                      marginBottom: spacing['3'],
                    }}>
                      <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.statusPending, fontWeight: typography.fontWeight.medium }}>
                        <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: spacing['1'] }} />
                        {missingDocs.length} approved item{missingDocs.length > 1 ? 's' : ''} missing uploaded documents
                      </p>
                      <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                        {missingDocs.map(d => d.description).join(', ')}
                      </p>
                    </div>
                  )
                })()}

                {/* Handoff readiness checklist */}
                <div style={{
                  padding: spacing['4'], backgroundColor: colors.surfaceInset,
                  borderRadius: borderRadius.base, marginTop: spacing['2'],
                }}>
                  <p style={{ margin: `0 0 ${spacing['3']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    Handoff Readiness Checklist
                  </p>
                  {[
                    { label: 'All closeout items approved', done: approved === total && total > 0 },
                    { label: 'All punch items resolved', done: (punchSummary?.pct ?? 0) === 100 },
                    { label: 'All documents uploaded', done: items.every(i => i.document_url || i.status !== 'approved') },
                    { label: 'Final lien waivers collected', done: (byCategory['lien_waiver'] ?? []).every(i => i.status === 'approved') },
                    { label: 'Certificate of Occupancy obtained', done: (byCategory['certificate_occupancy'] ?? []).every(i => i.status === 'approved') },
                    { label: 'Owner training completed', done: (byCategory['training'] ?? []).every(i => i.status === 'approved') },
                  ].map((check, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: spacing['2'],
                      padding: `${spacing['2']} 0`,
                      borderBottom: i < 5 ? `1px solid ${colors.borderSubtle}` : 'none',
                    }}>
                      {check.done ? (
                        <CheckCircle2 size={16} color={colors.statusActive} />
                      ) : (
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center',
                          border: `2px solid ${colors.borderSubtle}`,
                        }} />
                      )}
                      <span style={{
                        fontSize: typography.fontSize.sm,
                        color: check.done ? colors.textSecondary : colors.textPrimary,
                        textDecoration: check.done ? 'line-through' : 'none',
                      }}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ██ CREATE ITEM MODAL                         */}
      {/* ══════════════════════════════════════════════ */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Closeout Item" width="560px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as CloseoutCategory })} style={selectStyle}>
              {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <InputField label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} placeholder="e.g. HVAC Equipment Warranty — Trane RTU-1 through RTU-4" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Trade" value={form.trade} onChange={v => setForm({ ...form, trade: v })} placeholder="e.g. Mechanical" />
            <InputField label="Assigned To" value={form.assigned_to} onChange={v => setForm({ ...form, assigned_to: v })} placeholder="e.g. ABC Mechanical Inc." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Due Date" type="date" value={form.due_date} onChange={v => setForm({ ...form, due_date: v })} />
            <div /> {/* spacer */}
          </div>
          <InputField label="Notes / Spec Section" value={form.notes} onChange={v => setForm({ ...form, notes: v })} placeholder="e.g. Spec 23 00 00 — 5yr manufacturer warranty required" />
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
            <Btn variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreateItem} loading={createItem.isPending}>Create Item</Btn>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════ */}
      {/* ██ GENERATE LIST MODAL                       */}
      {/* ══════════════════════════════════════════════ */}
      <Modal open={generateModalOpen} onClose={() => setGenerateModalOpen(false)} title="Generate Closeout Checklist" width="480px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Generate a comprehensive closeout checklist from industry-standard templates. Items are based on CSI MasterFormat divisions and include O&M manuals, as-builts, warranties, lien waivers, training records, commissioning reports, and more.
          </p>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Project Type</label>
            <select
              value={selectedProjectType}
              onChange={e => setSelectedProjectType(e.target.value as ProjectType)}
              style={selectStyle}
            >
              {PROJECT_TYPE_OPTIONS.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </div>
          <div style={{ padding: spacing['3'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.base }}>
            <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
              This will generate approximately {(() => {
                const templates = generateCloseoutList(selectedProjectType)
                return templates.length
              })()} closeout items. Existing items will not be duplicated.
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setGenerateModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" icon={<Zap size={14} />} onClick={handleGenerateList} loading={generateList.isPending}>
              Generate Checklist
            </Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  )
}

export default Closeout
