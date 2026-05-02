/**
 * Punch Item Detail Page — Photo-first, verification-driven.
 *
 * Synthesizes the best of:
 * - Linear: Speed, keyboard shortcuts, animations, clean density
 * - Apple: "It just works", progressive disclosure, confident minimalism
 * - Tesla: Bold choices, remove until it breaks, data-driven
 * - Amazon: One-click actions, customer obsession, next-action obvious
 * - Google Material 3: Color systems, elevation, micro-animations
 *
 * Full-page detail for the verification workflow:
 * open → in_progress → sub_complete → verified (with rejection loop)
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Camera, MapPin, Wrench, Clock, Calendar,
  CheckCircle2, XCircle, Play, Eye, AlertTriangle,
  User, Shield, Send, Pencil, ChevronLeft,
} from 'lucide-react'
import { colors, typography, shadows } from '../../styles/theme'
import { usePunchItems } from '../../hooks/queries'
import { useUpdatePunchItem } from '../../hooks/mutations'
import { useProjectId } from '../../hooks/useProjectId'
import { toast } from 'sonner'
import { PhotoAnnotation } from '../../components/shared/PhotoAnnotation'
import type { AnnotationData } from '../../components/shared/PhotoAnnotation'
import { STATUS_COLORS, getDueDateColor, formatDate } from './types'
import type { PunchItem } from './types'

// ─── Helpers ──────────────────────────────────────────────

const relativeTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ─── Verification Pipeline ──────────────────────────────

const PIPELINE_STEPS = [
  { key: 'open', label: 'Open', icon: AlertTriangle },
  { key: 'in_progress', label: 'In Progress', icon: Play },
  { key: 'sub_complete', label: 'Sub Complete', icon: Eye },
  { key: 'verified', label: 'Verified', icon: CheckCircle2 },
]
const STEP_ORDER: Record<string, number> = { open: 0, rejected: 0, in_progress: 1, sub_complete: 2, verified: 3 }

const VerificationPipeline: React.FC<{ status: string }> = ({ status }) => {
  const currentIdx = STEP_ORDER[status] ?? 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '16px 24px',
      backgroundColor: colors.surfaceRaised,
      borderRadius: 16,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      {PIPELINE_STEPS.map((step, i) => {
        const Icon = step.icon
        const isDone = i < currentIdx
        const isCurrent = i === currentIdx
        const isRejected = isCurrent && status === 'rejected'
        const nodeColor = isDone ? colors.statusActive
          : isRejected ? colors.statusCritical
          : isCurrent ? colors.primaryOrange
          : colors.textTertiary

        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                style={{
                  flex: 1, height: 2, transformOrigin: 'left',
                  backgroundColor: isDone ? colors.statusActive : colors.borderSubtle,
                }}
              />
            )}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 300 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative' }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                backgroundColor: isDone ? `${colors.statusActive}18`
                  : isCurrent ? `${nodeColor}18`
                  : colors.surfaceInset,
                border: `2px solid ${nodeColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
              }}>
                {isDone ? (
                  <CheckCircle2 size={16} style={{ color: colors.statusActive }} />
                ) : (
                  <Icon size={13} style={{ color: nodeColor }} />
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? nodeColor : colors.textTertiary,
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
              {isRejected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: 'absolute', top: -6, right: -14,
                    fontSize: 8, fontWeight: 800,
                    color: colors.statusCritical,
                    backgroundColor: colors.statusCriticalSubtle,
                    padding: '1px 6px', borderRadius: 100,
                  }}
                >
                  REJECTED
                </motion.span>
              )}
            </motion.div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Photo Hero — Immersive, before/after comparison ─────

const PhotoHero: React.FC<{
  beforeUrl: string | null
  afterUrl: string | null
  onAnnotate?: (imageUrl: string) => void
}> = ({ beforeUrl, afterUrl, onAnnotate }) => {
  const [showAfter] = useState(false)
  const [sliderPos, setSliderPos] = useState(50)
  const [isSliding, setIsSliding] = useState(false)

  const hasBeforeAfter = beforeUrl && afterUrl

  if (!beforeUrl) {
    return (
      <div style={{
        padding: '48px 24px',
        backgroundColor: colors.surfaceInset,
        borderRadius: 16,
        textAlign: 'center',
        border: `2px dashed ${colors.borderDefault}`,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          backgroundColor: colors.surfaceHover,
          border: `2px dashed ${colors.borderDefault}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <Camera size={24} style={{ color: colors.textTertiary }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>
          No photo attached
        </div>
        <div style={{ fontSize: 12, color: colors.textTertiary }}>
          Photos make punch items 3x faster to resolve
        </div>
      </div>
    )
  }

  // Before/After comparison slider
  if (hasBeforeAfter) {
    const handleSliderMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isSliding) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      setSliderPos(pct)
    }

    return (
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
        <div
          style={{ position: 'relative', aspectRatio: '16/10', cursor: 'col-resize', userSelect: 'none' }}
          onMouseDown={() => setIsSliding(true)}
          onMouseUp={() => setIsSliding(false)}
          onMouseLeave={() => setIsSliding(false)}
          onMouseMove={handleSliderMove}
        >
          {/* After image (full width, behind) */}
          <img
            src={afterUrl}
            alt="After fix"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* Before image (clipped) */}
          <div style={{
            position: 'absolute', inset: 0,
            width: `${sliderPos}%`, overflow: 'hidden',
          }}>
            <img
              src={beforeUrl}
              alt="Before fix"
              style={{ width: '100%', height: '100%', objectFit: 'cover', minWidth: '200%', maxWidth: 'none' }}
            />
          </div>
          {/* Slider line */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${sliderPos}%`, width: 3,
            backgroundColor: 'white',
            boxShadow: '0 0 8px rgba(0,0,0,0.4)',
            transform: 'translateX(-50%)',
          }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 32, height: 32, borderRadius: '50%',
              backgroundColor: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                <ChevronLeft size={10} style={{ color: colors.textPrimary }} />
                <ChevronLeft size={10} style={{ color: colors.textPrimary, transform: 'rotate(180deg)' }} />
              </div>
            </div>
          </div>
          {/* Labels */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12,
            padding: '4px 10px', borderRadius: 100,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white', fontSize: 11, fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            Before
          </div>
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            padding: '4px 10px', borderRadius: 100,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white', fontSize: 11, fontWeight: 600,
            backdropFilter: 'blur(4px)',
          }}>
            After
          </div>
        </div>
        {onAnnotate && (
          <button
            onClick={() => onAnnotate(showAfter ? afterUrl : beforeUrl)}
            style={{
              position: 'absolute', top: 12, right: 12,
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 100,
              border: 'none', cursor: 'pointer',
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              color: 'white', fontSize: 11, fontWeight: 600,
              transition: 'background-color 0.15s',
            }}
          >
            <Pencil size={11} /> Annotate
          </button>
        )}
      </div>
    )
  }

  // Single photo
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ position: 'relative', aspectRatio: '16/10' }}>
        <img
          src={beforeUrl}
          alt="Punch item deficiency"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.4))',
        }} />
      </div>
      {onAnnotate && (
        <button
          onClick={() => onAnnotate(beforeUrl)}
          style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', borderRadius: 100,
            border: 'none', cursor: 'pointer',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            color: 'white', fontSize: 11, fontWeight: 600,
          }}
        >
          <Pencil size={11} /> Annotate
        </button>
      )}
    </div>
  )
}

// ─── Action Buttons — One obvious next step ──────────────

const ActionButtons: React.FC<{
  status: string
  onAction: (action: string, data?: Record<string, unknown>) => void
  loading: boolean
}> = ({ status, onAction, loading }) => {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const actions = useMemo(() => {
    switch (status) {
      case 'open':
      case 'rejected':
        return [{ key: 'start', label: 'Start Work', icon: Play, color: colors.statusInfo }]
      case 'in_progress':
        return [{ key: 'sub_complete', label: 'Mark Complete', icon: CheckCircle2, color: colors.statusReview }]
      case 'sub_complete':
        return [
          { key: 'verify', label: 'Verify & Close', icon: Shield, color: colors.statusActive },
          { key: 'reject', label: 'Reject', icon: XCircle, color: colors.statusCritical },
        ]
      default:
        return []
    }
  }, [status])

  if (status === 'verified') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px', borderRadius: 14,
          backgroundColor: `${colors.statusActive}12`,
          border: `1px solid ${colors.statusActive}30`,
        }}
      >
        <CheckCircle2 size={20} style={{ color: colors.statusActive }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: colors.statusActive }}>
          Verified & Closed
        </span>
      </motion.div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {actions.map(a => {
          const Icon = a.icon
          if (a.key === 'reject') {
            return (
              <button key={a.key}
                onClick={() => setShowReject(!showReject)}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 12,
                  border: `1.5px solid ${a.color}30`,
                  backgroundColor: `${a.color}10`,
                  cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  color: a.color,
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} /> {a.label}
              </button>
            )
          }
          return (
            <button key={a.key}
              onClick={() => onAction(a.key)}
              disabled={loading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 12,
                border: 'none',
                backgroundColor: a.color,
                color: 'white', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.15s',
                boxShadow: `0 2px 12px ${a.color}40`,
              }}
            >
              <Icon size={16} /> {a.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {showReject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}
          >
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="What needs to be fixed? (required for the sub)"
              rows={2}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px',
                border: `1.5px solid ${colors.statusCritical}40`,
                borderRadius: 12,
                fontSize: 13, color: colors.textPrimary,
                backgroundColor: colors.statusCriticalSubtle,
                outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => {
                onAction('reject', { rejection_reason: rejectReason })
                setRejectReason('')
                setShowReject(false)
              }}
              disabled={loading || !rejectReason.trim()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 12,
                border: 'none',
                backgroundColor: rejectReason.trim() ? colors.statusCritical : colors.surfaceDisabled,
                color: rejectReason.trim() ? 'white' : colors.textDisabled,
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={12} /> Reject & Return to Sub
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Metadata Pill ───────────────────────────────────────

const MetaPill: React.FC<{
  icon: typeof MapPin
  label: string
  value: string
  color?: string
}> = ({ icon: Icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 100,
    backgroundColor: colors.surfaceInset,
    border: `1px solid ${colors.borderSubtle}`,
  }}>
    <Icon size={11} style={{ color: color || colors.textTertiary }} />
    <span style={{
      fontSize: 10, color: colors.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600,
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 12, color: color || colors.textPrimary,
      fontWeight: 600,
    }}>
      {value}
    </span>
  </div>
)

// ─── Timeline Event ──────────────────────────────────────

const TimelineEvent: React.FC<{
  icon: React.ReactNode
  label: string
  detail?: string
  time: string
  accent?: string
}> = ({ icon, label, detail, time, accent }) => (
  <div style={{
    display: 'flex', gap: 12, padding: '10px 0',
    borderLeft: `2px solid ${colors.borderSubtle}`,
    marginLeft: 14, paddingLeft: 16,
    position: 'relative',
  }}>
    <div style={{
      position: 'absolute', left: -9,
      width: 16, height: 16, borderRadius: '50%',
      backgroundColor: colors.surfaceRaised,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1.5px solid ${colors.borderSubtle}`,
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: 13, color: accent || colors.textPrimary,
        fontWeight: 600,
      }}>
        {label}
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2, lineHeight: 1.4 }}>
          {detail}
        </div>
      )}
    </div>
    {time && (
      <span style={{ fontSize: 11, color: colors.textTertiary, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {time.includes('T') ? relativeTime(time) : time}
      </span>
    )}
  </div>
)

// ─── Main Component ───────────────────────────────────────

const PunchItemDetailPage: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const projectId = useProjectId()
  const updatePunchItem = useUpdatePunchItem()
  const { data: punchListResult, isLoading } = usePunchItems(projectId)
  const punchListRaw = punchListResult?.data ?? []

  const item: PunchItem | null = useMemo(() => {
    const raw = punchListRaw.find((p: Record<string, unknown>) =>
      String(p.id) === itemId || String(p.number) === itemId
    ) as Record<string, unknown> | undefined
    if (!raw) return null
    const photos = Array.isArray(raw.photos) ? raw.photos : []
    return {
      id: raw.id as number,
      itemNumber: `PL-${String(raw.number ?? '').padStart(3, '0')}`,
      area: [raw.floor, raw.area].filter(Boolean).join(', ') || (raw.location as string) || '',
      description: (raw.title as string) || (raw.description as string) || '',
      assigned: (raw.assigned_to as string) || '',
      priority: (raw.priority as string) || 'medium',
      status: (raw.status as string) || 'open',
      verification_status: (raw.verification_status as string) ?? 'open',
      verified_by: (raw.verified_by as string) ?? null,
      verified_at: (raw.verified_at as string) ?? null,
      sub_completed_at: (raw.sub_completed_at as string) ?? null,
      before_photo_url: (raw.before_photo_url as string) ?? null,
      after_photo_url: (raw.after_photo_url as string) ?? null,
      rejection_reason: (raw.rejection_reason as string) ?? null,
      hasPhoto: photos.length > 0,
      photoCount: photos.length,
      dueDate: (raw.due_date as string) || '',
      createdDate: raw.created_at ? (raw.created_at as string).slice(0, 10) : '',
      reportedBy: (raw.reported_by as string) || '',
      responsible: raw.trade === 'general' ? 'gc' : raw.trade === 'owner' ? 'owner' : 'subcontractor',
      trade: (raw.trade as string) || '',
      location: (raw.location as string) || '',
    }
  }, [punchListRaw, itemId])

  const handleAction = useCallback(async (action: string, data?: Record<string, unknown>) => {
    if (!item || !projectId) return
    try {
      const updates: Record<string, unknown> = {}
      switch (action) {
        case 'start': updates.verification_status = 'in_progress'; break
        case 'sub_complete': updates.verification_status = 'sub_complete'; updates.sub_completed_at = new Date().toISOString(); break
        case 'verify': updates.verification_status = 'verified'; updates.verified_at = new Date().toISOString(); break
        case 'reject': updates.verification_status = 'in_progress'; updates.rejection_reason = data?.rejection_reason || 'Rejected'; break
      }
      await updatePunchItem.mutateAsync({ id: String(item.id), updates, projectId })
      const labels: Record<string, string> = {
        start: 'marked in progress', sub_complete: 'marked complete', verify: 'verified and closed', reject: 'rejected',
      }
      toast.success(`${item.itemNumber} ${labels[action] || 'updated'}`)
    } catch { toast.error('Failed to update') }
  }, [item, projectId, updatePunchItem])

  // Annotation modal state
  const [annotateImageUrl, setAnnotateImageUrl] = useState<string | null>(null)

  const handleSaveAnnotations = useCallback((annotations: AnnotationData[]) => {
    toast.success(`Saved ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}`)
    setAnnotateImageUrl(null)
  }, [])

  useEffect(() => {
    if (!annotateImageUrl) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAnnotateImageUrl(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [annotateImageUrl])

  // Loading state
  if (isLoading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ height: 16, width: 120, backgroundColor: colors.surfaceInset, borderRadius: 6, marginBottom: 24 }} />
        <div style={{ height: 240, backgroundColor: colors.surfaceInset, borderRadius: 16, marginBottom: 20 }} />
        <div style={{ height: 60, backgroundColor: colors.surfaceInset, borderRadius: 14 }} />
      </div>
    )
  }

  // Not found
  if (!item) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          backgroundColor: colors.surfaceInset,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <AlertTriangle size={28} style={{ color: colors.textTertiary }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px' }}>
          Punch item not found
        </h2>
        <button
          onClick={() => navigate('/punch-list')}
          style={{
            padding: '10px 24px', borderRadius: 10,
            border: 'none', backgroundColor: colors.primaryOrange,
            color: 'white', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          Back to Punch List
        </button>
      </div>
    )
  }

  const status = item.verification_status || item.status
  const statusColor = STATUS_COLORS[status] || colors.textTertiary

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 720, margin: '0 auto', padding: `24px 24px 64px` }}
    >
      {/* Back nav */}
      <button
        onClick={() => navigate('/punch-list')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: colors.textTertiary, fontSize: 13, fontWeight: 500,
          padding: 0, marginBottom: 20,
          transition: 'color 0.15s', fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = colors.primaryOrange)}
        onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
      >
        <ArrowLeft size={14} /> Punch List
      </button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: colors.primaryOrange,
            fontFamily: typography.fontFamilyMono,
          }}>
            {item.itemNumber}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 100,
            backgroundColor: `${statusColor}14`,
            color: statusColor,
            fontSize: 12, fontWeight: 700,
          }}>
            {status === 'open' ? 'Open' : status === 'in_progress' ? 'In Progress' : status === 'sub_complete' ? 'Sub Complete' : status === 'verified' ? 'Verified' : 'Rejected'}
          </span>
          {item.priority === 'critical' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 8px', borderRadius: 100,
              backgroundColor: colors.statusCriticalSubtle,
              color: colors.statusCritical,
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
            }}>
              <AlertTriangle size={9} /> Critical
            </span>
          )}
        </div>
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 700,
          color: colors.textPrimary, lineHeight: 1.3,
        }}>
          {item.description}
        </h1>
      </div>

      {/* Photo Hero */}
      <div style={{ marginBottom: 20 }}>
        <PhotoHero
          beforeUrl={item.before_photo_url}
          afterUrl={item.after_photo_url}
          onAnnotate={(url) => setAnnotateImageUrl(url)}
        />
      </div>

      {/* Annotation Modal */}
      <AnimatePresence>
        {annotateImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAnnotateImageUrl(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: 20, boxShadow: shadows.lg,
                overflow: 'hidden', maxWidth: '90vw', maxHeight: '90vh',
                width: 900, display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: `1px solid ${colors.borderSubtle}`,
              }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, color: colors.textPrimary,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Pencil size={14} style={{ color: colors.primaryOrange }} />
                  Annotate Photo
                </span>
                <button onClick={() => setAnnotateImageUrl(null)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.textTertiary, fontSize: 12, fontWeight: 500,
                  fontFamily: 'inherit', padding: '4px 8px', borderRadius: 6,
                }}>
                  Esc to close
                </button>
              </div>
              <div style={{ overflow: 'auto', flex: 1 }}>
                <PhotoAnnotation imageUrl={annotateImageUrl} onSave={handleSaveAnnotations} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verification Pipeline */}
      <div style={{ marginBottom: 20 }}>
        <VerificationPipeline status={status} />
      </div>

      {/* Metadata Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {item.area && <MetaPill icon={MapPin} label="Location" value={item.area} />}
        {item.trade && <MetaPill icon={Wrench} label="Trade" value={item.trade} />}
        {item.assigned && <MetaPill icon={User} label="Assigned" value={item.assigned} />}
        {item.priority && (
          <MetaPill icon={AlertTriangle} label="Priority"
            value={item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
            color={item.priority === 'critical' ? colors.statusCritical : item.priority === 'high' ? colors.primaryOrange : undefined}
          />
        )}
        {item.dueDate && (
          <MetaPill icon={Calendar} label="Due" value={formatDate(item.dueDate)}
            color={getDueDateColor(item.dueDate)}
          />
        )}
        {item.reportedBy && <MetaPill icon={User} label="Reported" value={item.reportedBy} />}
      </div>

      {/* Rejection banner */}
      {item.rejection_reason && status !== 'verified' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 16px', borderRadius: 14,
          backgroundColor: colors.statusCriticalSubtle,
          border: `1px solid ${colors.statusCritical}25`,
          marginBottom: 20,
        }}>
          <XCircle size={16} style={{ color: colors.statusCritical, flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: colors.statusCritical, marginBottom: 2 }}>
              Rejection Reason
            </div>
            <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.5 }}>
              {item.rejection_reason}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        padding: 20, borderRadius: 16,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
        marginBottom: 20,
      }}>
        <ActionButtons status={status} onAction={handleAction} loading={updatePunchItem.isPending} />
      </div>

      {/* Activity Timeline */}
      <div style={{
        padding: 20, borderRadius: 16,
        backgroundColor: colors.surfaceRaised,
        border: `1px solid ${colors.borderSubtle}`,
      }}>
        <h3 style={{
          margin: '0 0 12px', fontSize: 13, fontWeight: 700,
          color: colors.textTertiary, textTransform: 'uppercase',
          letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={12} /> Activity
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <TimelineEvent
            icon={<AlertTriangle size={10} style={{ color: colors.statusPending }} />}
            label="Punch item created"
            detail={item.reportedBy ? `Reported by ${item.reportedBy}` : undefined}
            time={item.createdDate}
          />
          {item.sub_completed_at && (
            <TimelineEvent
              icon={<Eye size={10} style={{ color: colors.statusReview }} />}
              label="Marked complete — ready for verification"
              time={item.sub_completed_at}
            />
          )}
          {item.rejection_reason && (
            <TimelineEvent
              icon={<XCircle size={10} style={{ color: colors.statusCritical }} />}
              label="Rejected — returned to sub"
              detail={item.rejection_reason}
              time=""
              accent={colors.statusCritical}
            />
          )}
          {item.verified_at && (
            <TimelineEvent
              icon={<CheckCircle2 size={10} style={{ color: colors.statusActive }} />}
              label="Verified and closed"
              detail={item.verified_by ? `Verified by ${item.verified_by}` : undefined}
              time={item.verified_at}
              accent={colors.statusActive}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default PunchItemDetailPage
