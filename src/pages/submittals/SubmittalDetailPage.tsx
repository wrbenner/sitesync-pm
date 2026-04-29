/**
 * Submittal Detail — Document-centric redesign.
 *
 * Design philosophy (Jobs/Ive):
 * 1. The document IS the page. DocumentViewer dominates the upper half.
 * 2. Approval is the action. Pipeline + action buttons are immediately visible.
 * 3. Progressive disclosure. Hero content first; details unfold on demand.
 * 4. Eliminate visual noise. Every element earns its space.
 *
 * Layout (900px max):
 * ┌─────────────────────────────────────────────┐
 * │ ← Back   SUB-012  ● GC Review  [Approve][X]│
 * ├─────────────────────────────────────────────┤
 * │                                             │
 * │          ┌────────────────────┐             │
 * │          │  DOCUMENT VIEWER   │             │
 * │          │  (hero, 500px+)    │             │
 * │          └────────────────────┘             │
 * │                                             │
 * │  ●━━━━●━━━━◐━━━━○  Pipeline                │
 * │  Sub   GC   A/E  Owner                     │
 * │                                             │
 * │ ┌─────────────────────────────────────────┐ │
 * │ │ Title                                   │ │
 * │ │ Subcontractor · Spec 09 21 16           │ │
 * │ │ Due: Apr 25 · Lead: 8 weeks             │ │
 * │ └─────────────────────────────────────────┘ │
 * │                                             │
 * │ ── Reviews ──────────────────────────────── │
 * │  [reviewer comments thread]                 │
 * │                                             │
 * │ ── Related ──────────────────────────────── │
 * │  [spec section / linked RFIs]               │
 * └─────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Clock, Calendar,
  DollarSign, ChevronDown, User, AlertTriangle, Sparkles,
  ExternalLink, Eye, Stamp, Send, Forward,
} from 'lucide-react'
import { PageContainer, Btn, Avatar, PriorityTag, useToast } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius
} from '../../styles/theme'
import { useAuth } from '../../hooks/useAuth'
import { useSubmittal, useSubmittalReviewers } from '../../hooks/queries/submittals'
import { useUpdateSubmittal } from '../../hooks/mutations/submittals'
import { useProjectId } from '../../hooks/useProjectId'
import {
  getSubmittalStatusConfig, getValidSubmittalTransitions, getNextSubmittalStatus,
  getStampConfig, getLeadTimeUrgency, CSI_DIVISIONS,
  type SubmittalState, type SubmittalStamp,
} from '../../machines/submittalMachine'
import { DocumentViewer } from '../../components/submittals/DocumentViewer'
import { WorkflowTimeline, SUBMITTAL_STEPS } from '../../components/WorkflowTimeline'
import { supabase } from '../../lib/supabase'

const SUBMITTAL_BUCKET = 'project-files'

type SubmittalWithAttachments = ReturnType<typeof useSubmittal>['data'] & {
  attachments?: unknown[]
}

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const formatDate = (d: string | null | undefined) => {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateShort = (d: string | null | undefined) => {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const relativeTime = (d: string | null | undefined) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}

const isOverdue = (d: string | null | undefined) => {
  if (!d) return false
  return new Date(d) < new Date()
}

const getCSIDivisionName = (specSection: string | null | undefined) => {
  if (!specSection) return null
  const code = specSection.trim().slice(0, 2)
  return CSI_DIVISIONS.find(d => d.code === code)?.name || null
}

// ─── Approval Pipeline Visual ─────────────────────────────
// Larger, more visual pipeline for the redesigned layout.

interface ApprovalNode {
  role: string
  label: string
  status: 'complete' | 'active' | 'waiting' | 'rejected'
}

const ApprovalPipeline: React.FC<{ status: SubmittalState; reviewers: any[] }> = ({ status, reviewers }) => {
  const nodes: ApprovalNode[] = useMemo(() => {
    const getNodeStatus = (threshold: SubmittalState[]): ApprovalNode['status'] => {
      if (status === 'rejected' || status === 'resubmit') {
        const rejector = reviewers.find(r => r.status === 'rejected')
        if (rejector) return 'rejected'
      }
      if (threshold.includes(status)) return 'active'
      const order: SubmittalState[] = ['draft', 'submitted', 'gc_review', 'architect_review', 'approved', 'closed']
      const currentIdx = order.indexOf(status)
      const thresholdIdx = Math.max(...threshold.map(t => order.indexOf(t)))
      if (currentIdx > thresholdIdx) return 'complete'
      return 'waiting'
    }

    return [
      { role: 'sub', label: 'Submitted', status: status === 'draft' ? 'active' : 'complete' },
      { role: 'gc', label: 'GC Review', status: getNodeStatus(['submitted', 'gc_review']) },
      { role: 'architect', label: 'A/E Review', status: getNodeStatus(['architect_review']) },
      { role: 'owner', label: 'Approved', status: status === 'approved' || status === 'closed' ? 'complete' : 'waiting' },
    ]
  }, [status, reviewers])

  const statusColors: Record<ApprovalNode['status'], string> = {
    complete: colors.statusActive,
    active: colors.primaryOrange,
    waiting: colors.borderDefault,
    rejected: colors.statusCritical,
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: `${spacing.md} ${spacing.xl}`,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceInset,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      {nodes.map((node, i) => (
        <React.Fragment key={node.role}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, flex: '0 0 auto', position: 'relative',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: node.status === 'waiting' ? 'transparent' : statusColors[node.status],
              border: node.status === 'waiting' ? `2.5px solid ${colors.borderDefault}` : 'none',
              boxShadow: node.status === 'active' ? `0 0 0 4px ${colors.primaryOrange}20` : 'none',
              transition: 'all 0.3s ease',
            }}>
              {node.status === 'complete' && <CheckCircle size={16} color={colors.white} />}
              {node.status === 'active' && (
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Clock size={14} color={colors.white} />
                </motion.div>
              )}
              {node.status === 'rejected' && <XCircle size={16} color={colors.white} />}
              {node.status === 'waiting' && <div style={{
                width: 9, height: 9, borderRadius: '50%',
                backgroundColor: colors.borderDefault,
              }} />}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: typography.fontWeight.semibold,
              color: node.status === 'waiting' ? colors.textTertiary : statusColors[node.status],
              whiteSpace: 'nowrap', letterSpacing: '0.01em',
            }}>
              {node.label}
            </span>
          </motion.div>

          {i < nodes.length - 1 && (
            <div style={{
              flex: 1, height: 3, minWidth: 32,
              borderRadius: 2,
              backgroundColor: node.status === 'complete' ? colors.statusActive : colors.borderSubtle,
              marginBottom: 22,
              transition: 'background-color 0.4s ease',
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Action Buttons (Top bar) ────────────────────────────

const ActionButtons: React.FC<{
  transitions: string[]
  onAction: (action: string) => void
  loading: string | null
}> = ({ transitions, onAction, loading }) => {
  if (transitions.length === 0) return null

  const getActionConfig = (action: string) => {
    if (action.includes('Approve')) return { bg: colors.statusActive, color: colors.white, icon: CheckCircle, primary: true }
    if (action.includes('Reject')) return { bg: colors.statusCritical, color: colors.white, icon: XCircle, primary: false }
    if (action.includes('Revise')) return { bg: colors.statusPending, color: colors.white, icon: RotateCcw, primary: false }
    if (action.includes('Forward')) return { bg: colors.statusInfo, color: colors.white, icon: Forward, primary: true }
    if (action.includes('Submit')) return { bg: colors.primaryOrange, color: colors.white, icon: Send, primary: true }
    if (action.includes('Close')) return { bg: colors.textTertiary, color: colors.white, icon: CheckCircle, primary: true }
    return { bg: colors.primaryOrange, color: colors.white, icon: Send, primary: true }
  }

  // Sort: primary actions first
  const sorted = [...transitions].sort((a, b) => {
    const aConf = getActionConfig(a)
    const bConf = getActionConfig(b)
    if (aConf.primary && !bConf.primary) return -1
    if (!aConf.primary && bConf.primary) return 1
    return 0
  })

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {sorted.map((action, i) => {
        const config = getActionConfig(action)
        const Icon = config.icon
        const isPrimary = i === 0
        const isLoading = loading === action

        return (
          <motion.button
            key={action}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(action)}
            disabled={loading !== null}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: isPrimary ? '8px 20px' : '8px 14px',
              borderRadius: borderRadius.md,
              border: isPrimary ? 'none' : `1.5px solid ${config.bg}40`,
              backgroundColor: isPrimary ? (isLoading ? colors.surfaceDisabled : config.bg) : 'transparent',
              color: isPrimary ? (isLoading ? colors.textDisabled : config.color) : (isLoading ? colors.textDisabled : config.bg),
              fontSize: '13px',
              fontWeight: typography.fontWeight.semibold,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            <Icon size={14} />
            {isLoading ? 'Processing...' : action}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Review Comment Bubble ────────────────────────────────

const ReviewBubble: React.FC<{
  reviewer: any
  index: number
}> = ({ reviewer, index }) => {
  const stampConfig = reviewer.stamp ? getStampConfig(reviewer.stamp as SubmittalStamp) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', gap: spacing.sm, alignItems: 'flex-start' }}
    >
      <Avatar initials={getInitials(reviewer.approver_id || reviewer.role || 'R')} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: 4 }}>
          <span style={{
            fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}>
            {reviewer.role ? reviewer.role.charAt(0).toUpperCase() + reviewer.role.slice(1) : 'Reviewer'}
          </span>
          {stampConfig && (
            <span style={{
              fontSize: '10px', fontWeight: typography.fontWeight.semibold,
              padding: '2px 8px', borderRadius: borderRadius.full,
              backgroundColor: stampConfig.bg, color: stampConfig.color,
              textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              {stampConfig.label}
            </span>
          )}
          <span style={{ fontSize: '11px', color: colors.textTertiary }}>
            {relativeTime(reviewer.reviewed_at)}
          </span>
        </div>
        {reviewer.comments && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: colors.surfaceInset,
            borderRadius: `2px ${borderRadius.lg} ${borderRadius.lg} ${borderRadius.lg}`,
            fontSize: typography.fontSize.body,
            color: colors.textPrimary,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
          }}>
            {reviewer.comments}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Info Card ───────────────────────────────────────────

const InfoCard: React.FC<{ submittal: Record<string, any>; currentStatus: SubmittalState }> = ({ submittal, currentStatus }) => {
  const [showMore, setShowMore] = useState(false)
  const specDiv = getCSIDivisionName(submittal.spec_section)
  const dueUrgent = submittal.due_date && isOverdue(submittal.due_date) && currentStatus !== 'approved' && currentStatus !== 'closed'
  const leadTimeUrgency = getLeadTimeUrgency(submittal.submit_by_date)

  // Primary info: always visible
  const primaryItems: Array<{ label: string; value: string | null; urgent?: boolean }> = [
    { label: 'Due', value: formatDateShort(submittal.due_date), urgent: dueUrgent },
    { label: 'Lead Time', value: submittal.lead_time_weeks ? `${submittal.lead_time_weeks} weeks` : null },
    { label: 'On-Site', value: formatDateShort(submittal.required_onsite_date) },
  ].filter(i => i.value) as Array<{ label: string; value: string; urgent?: boolean }>

  // Secondary info: collapsed by default
  const secondaryItems: Array<{ icon: React.ReactNode; label: string; value: string | null; urgent?: boolean }> = [
    { icon: <User size={13} />, label: 'Assigned', value: submittal.assigned_to },
    { icon: <Calendar size={13} />, label: 'Submit By', value: formatDate(submittal.submit_by_date), urgent: leadTimeUrgency.urgent },
    { icon: <RotateCcw size={13} />, label: 'Revision', value: submittal.revision_number != null && submittal.revision_number > 0 ? `Rev ${submittal.revision_number}` : null },
    { icon: <Clock size={13} />, label: 'Days in Review', value: submittal.days_in_review ? `${submittal.days_in_review} days` : null },
    { icon: <DollarSign size={13} />, label: 'Cost Impact', value: submittal.cost_impact || null },
  ].filter(item => item.value) as Array<{ icon: React.ReactNode; label: string; value: string; urgent?: boolean }>

  return (
    <div style={{
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceRaised,
      overflow: 'hidden',
    }}>
      <div style={{ padding: `${spacing.lg} ${spacing.xl}` }}>
        {/* Title */}
        <h1 style={{
          margin: 0, fontSize: '22px',
          fontWeight: typography.fontWeight.bold, color: colors.textPrimary,
          lineHeight: 1.3, letterSpacing: typography.letterSpacing.tight,
        }}>
          {submittal.title}
        </h1>

        {/* Subtitle row: subcontractor, spec, priority */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          marginTop: 10, flexWrap: 'wrap',
        }}>
          {submittal.subcontractor && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: typography.fontSize.caption, color: colors.textSecondary,
            }}>
              <Avatar initials={getInitials(submittal.subcontractor)} size={18} />
              {submittal.subcontractor}
            </span>
          )}
          {submittal.subcontractor && submittal.spec_section && (
            <span style={{ color: colors.borderDefault, fontSize: '11px' }}>·</span>
          )}
          {submittal.spec_section && (
            <span style={{
              fontSize: '11px', fontFamily: 'monospace',
              padding: '2px 8px', borderRadius: borderRadius.sm,
              backgroundColor: colors.statusInfoSubtle, color: colors.statusInfo,
              fontWeight: typography.fontWeight.medium,
            }}>
              {submittal.spec_section}
              {specDiv && <span style={{ fontFamily: 'inherit', marginLeft: 4, opacity: 0.7 }}>{specDiv}</span>}
            </span>
          )}
          {submittal.priority && submittal.priority !== 'medium' && (
            <PriorityTag priority={submittal.priority} />
          )}
        </div>

        {/* Primary date row */}
        {primaryItems.length > 0 && (
          <div style={{
            display: 'flex', gap: spacing.lg, marginTop: 16,
            flexWrap: 'wrap',
          }}>
            {primaryItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: '10px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: typography.fontSize.caption,
                  fontWeight: typography.fontWeight.semibold,
                  color: item.urgent ? colors.statusCritical : colors.textPrimary,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {item.urgent && <AlertTriangle size={11} />}
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stamp display */}
        {submittal.stamp && (() => {
          const stampCfg = getStampConfig(submittal.stamp as SubmittalStamp)
          return (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: borderRadius.md,
              backgroundColor: stampCfg.bg, marginTop: 16,
              border: `2px solid ${stampCfg.color}40`,
            }}>
              <Stamp size={16} style={{ color: stampCfg.color }} />
              <span style={{
                fontSize: typography.fontSize.caption,
                fontWeight: typography.fontWeight.bold,
                color: stampCfg.color,
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                {stampCfg.label}
              </span>
            </div>
          )
        })()}

        {/* Description */}
        {submittal.description && (
          <div style={{
            fontSize: typography.fontSize.body, color: colors.textSecondary,
            lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            marginTop: 14,
          }}>
            {submittal.description}
          </div>
        )}

        {/* More details toggle */}
        {secondaryItems.length > 0 && (
          <>
            <button
              onClick={() => setShowMore(!showMore)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                padding: 0, marginTop: 14, transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = colors.textSecondary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
            >
              {showMore ? 'Hide details' : `${secondaryItems.length} more details`}
              <motion.span animate={{ rotate: showMore ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={12} />
              </motion.span>
            </button>

            <AnimatePresence>
              {showMore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: spacing.sm,
                    paddingTop: spacing.sm,
                  }}>
                    {secondaryItems.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px', borderRadius: borderRadius.full,
                        backgroundColor: colors.surfaceInset,
                        border: `1px solid ${item.urgent ? colors.statusCritical + '40' : colors.borderSubtle}`,
                        fontSize: typography.fontSize.caption,
                      }}>
                        <span style={{ color: item.urgent ? colors.statusCritical : colors.textTertiary }}>{item.icon}</span>
                        <span style={{ color: colors.textTertiary }}>{item.label}:</span>
                        <span style={{
                          color: item.urgent ? colors.statusCritical : colors.textPrimary,
                          fontWeight: typography.fontWeight.medium,
                        }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Related Intelligence ─────────────────────────────────

const RelatedIntelligence: React.FC<{ submittal: Record<string, any> }> = ({ submittal }) => {
  const specDiv = getCSIDivisionName(submittal.spec_section)

  const relatedItems: Array<{ type: string; label: string; link: string; color: string }> = []

  if (submittal.spec_section) {
    relatedItems.push({
      type: 'Spec', label: `${submittal.spec_section} — ${specDiv || 'Unknown Division'}`,
      link: '#', color: colors.statusInfo,
    })
  }

  if (relatedItems.length === 0) return null

  return (
    <div style={{
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceRaised,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing.sm,
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${colors.borderSubtle}`,
      }}>
        <Sparkles size={13} style={{ color: colors.statusActive }} />
        <span style={{
          fontSize: '11px', fontWeight: typography.fontWeight.semibold,
          color: colors.statusActive, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Related Intelligence
        </span>
      </div>
      <div style={{ padding: spacing.sm }}>
        {relatedItems.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            padding: `6px ${spacing.sm}`, borderRadius: borderRadius.md,
            cursor: 'pointer', transition: 'background 0.1s',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{
              fontSize: '10px', fontWeight: typography.fontWeight.semibold,
              padding: '1px 6px', borderRadius: borderRadius.sm,
              backgroundColor: item.color + '15', color: item.color,
            }}>
              {item.type}
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, flex: 1 }}>
              {item.label}
            </span>
            <ExternalLink size={11} style={{ color: colors.textTertiary }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section Divider ─────────────────────────────────────

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing.md,
    margin: `${spacing.sm} 0`,
  }}>
    <div style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
    <span style={{
      fontSize: '11px', fontWeight: typography.fontWeight.semibold,
      color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, backgroundColor: colors.borderSubtle }} />
  </div>
)

// ─── Main Page ────────────────────────────────────────────

export function SubmittalDetailPage() {
  const { submittalId } = useParams<{ submittalId: string }>()
  const navigate = useNavigate()
  const projectId = useProjectId()
  const { addToast } = useToast()
  const { user } = useAuth()

  const { data: submittal, isLoading, error } = useSubmittal(submittalId)
  const { data: reviewers = [] } = useSubmittalReviewers(submittalId)
  const updateSubmittal = useUpdateSubmittal()
  const [transitioning, setTransitioning] = useState<string | null>(null)

  // Normalize legacy DB statuses (pending, under_review) to machine states so
  // that the XState-driven workflow, stepper, and action buttons all render.
  const rawStatus = submittal?.status || 'draft'
  const currentStatus: SubmittalState = (() => {
    switch (rawStatus) {
      case 'pending': return 'draft'
      case 'under_review': return 'gc_review'
      case 'review_in_progress': return 'gc_review'
      case 'revise_resubmit': return 'resubmit'
      default: return rawStatus as SubmittalState
    }
  })()
  const statusConfig = getSubmittalStatusConfig(currentStatus)
  const transitions = getValidSubmittalTransitions(currentStatus)

  const sub = (submittal as Record<string, any>) || {}

  // ── Construct files for DocumentViewer ──────────────────
  // Uses signed URLs since project-files is a private bucket. We normalize
  // attachments (string | {path,url,name}) into {name, path} and resolve the
  // signed URL asynchronously; rendering uses the resolved state.
  const [resolvedFiles, setResolvedFiles] = useState<Array<{ name: string; url: string; path?: string }>>([])

  useEffect(() => {
    let cancelled = false
    if (!submittal) { setResolvedFiles([]); return }
    const attachments = ((submittal as SubmittalWithAttachments)?.attachments || []) as unknown[]
    const normalized = attachments.map((att: unknown, i: number) => {
      if (typeof att === 'string') {
        return { name: att.split('/').pop() || `Document ${i + 1}`, path: att, url: '' }
      }
      if (typeof att === 'object' && att !== null) {
        const obj = att as Record<string, string>
        return {
          name: obj.name || obj.filename || (obj.path ? obj.path.split('/').pop() : '') || `Document ${i + 1}`,
          path: obj.path || '',
          url: obj.url || '',
        }
      }
      return { name: `Document ${i + 1}`, path: '', url: '' }
    })

    ;(async () => {
      const resolved = await Promise.all(normalized.map(async (f) => {
        if (f.url) return f
        if (!f.path) return { ...f, url: '' }
        const { data, error: signErr } = await supabase.storage
          .from(SUBMITTAL_BUCKET)
          .createSignedUrl(f.path, 3600)
        if (signErr || !data) return { ...f, url: '' }
        return { ...f, url: data.signedUrl }
      }))
      if (!cancelled) setResolvedFiles(resolved.filter(f => f.url))
    })()

    return () => { cancelled = true }
  }, [submittal])

  const viewerFiles = resolvedFiles

  // ── Upload handler ─────────────────────────────────────
  const handleDocumentUpload = useCallback(async (file: File) => {
    if (!submittal || !projectId) {
      addToast('error', 'Cannot upload: missing project context')
      return
    }
    const storagePath = `submittals/${projectId}/${submittal.id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage
      .from(SUBMITTAL_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (uploadErr) {
      addToast('error', 'Failed to upload: ' + uploadErr.message)
      return
    }
    const currentAttachments = ((submittal as SubmittalWithAttachments)?.attachments || []) as unknown[]
    const newAttachment = {
      path: storagePath,
      name: file.name,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    }
    try {
      await updateSubmittal.mutateAsync({
        id: submittal.id,
        projectId,
        updates: { attachments: [...currentAttachments, newAttachment] },
      })
      addToast('success', `${file.name} uploaded`)
    } catch (e) {
      addToast('error', 'Upload saved to storage but attachment record failed: ' + (e as Error).message)
    }
  }, [submittal, projectId, updateSubmittal, addToast])

  // ── Transition handler ─────────────────────────────────
  // DB check constraint allows: draft,pending,submitted,under_review,approved,
  // rejected,resubmit,closed. Machine-only states (gc_review, architect_review)
  // map back to under_review for persistence.
  const toDbStatus = (s: SubmittalState): string => {
    if (s === 'gc_review' || s === 'architect_review') return 'under_review'
    return s
  }

  const handleTransition = useCallback(async (action: string) => {
    if (!submittal || !projectId) return
    const nextStatus = getNextSubmittalStatus(currentStatus, action)
    if (!nextStatus) return
    setTransitioning(action)
    try {
      await updateSubmittal.mutateAsync({
        id: submittal.id,
        projectId,
        updates: { status: toDbStatus(nextStatus) },
      })
      addToast('success', `Submittal ${action.toLowerCase()}`)
    } catch (e) {
      addToast('error', `Failed to ${action.toLowerCase()}: ${(e as Error).message}`)
    } finally {
      setTransitioning(null)
    }
  }, [submittal, projectId, currentStatus, updateSubmittal, addToast])

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageContainer>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: `${spacing.xl} 0` }}>
          {/* Skeleton: top bar */}
          <div style={{
            height: 48, marginBottom: spacing.lg,
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {/* Skeleton: document viewer */}
          <div style={{
            height: 500, marginBottom: spacing.lg,
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.xl,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {/* Skeleton: pipeline */}
          <div style={{
            height: 72, marginBottom: spacing.lg,
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {/* Skeleton: info card */}
          <div style={{
            height: 120,
            backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg,
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </div>
      </PageContainer>
    )
  }

  // ── Error ───────────────────────────────────────────────
  if (error || !submittal) {
    return (
      <PageContainer>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', padding: '80px 0' }}>
          <AlertTriangle size={40} style={{ color: colors.statusCritical, margin: '0 auto 12px' }} />
          <h2 style={{ color: colors.textPrimary, margin: '0 0 8px', fontSize: typography.fontSize.subheading }}>
            Submittal not found
          </h2>
          <p style={{ color: colors.textTertiary, margin: '0 0 20px', fontSize: typography.fontSize.body }}>
            {(error as Error)?.message || 'This submittal may have been deleted or you don\'t have access.'}
          </p>
          <Btn onClick={() => navigate('/submittals')}>Back to Submittals</Btn>
        </div>
      </PageContainer>
    )
  }

  const subNumber = sub.number ? `SUB-${String(sub.number).padStart(3, '0')}` : 'SUB'

  return (
    <PageContainer aria-label={`${subNumber}: ${sub.title}`}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* ── Top Bar: Back + Number + Status + Actions ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.sm,
            minHeight: 48,
          }}
        >
          {/* Left side: back, number, status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <button
              onClick={() => navigate('/submittals')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: borderRadius.md,
                background: 'none', border: `1px solid ${colors.borderSubtle}`,
                cursor: 'pointer', color: colors.textTertiary,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primaryOrange
                e.currentTarget.style.color = colors.primaryOrange
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.borderSubtle
                e.currentTarget.style.color = colors.textTertiary
              }}
            >
              <ArrowLeft size={16} />
            </button>

            <span style={{
              fontSize: '15px', fontWeight: typography.fontWeight.bold,
              color: colors.primaryOrange, letterSpacing: '0.02em',
            }}>
              {subNumber}
            </span>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
              padding: '4px 12px', borderRadius: borderRadius.full,
              backgroundColor: statusConfig.bg, color: statusConfig.color,
            }}>
              {statusConfig.label}
            </span>

            {sub.revision_number > 0 && (
              <span style={{
                fontSize: '12px',
                fontWeight: typography.fontWeight.semibold,
                color: colors.statusCritical,
                padding: '3px 10px', borderRadius: borderRadius.full,
                backgroundColor: colors.statusCriticalSubtle,
              }}>
                Rev {sub.revision_number}
              </span>
            )}
          </div>

          {/* Right side: action buttons */}
          <ActionButtons
            transitions={transitions}
            onAction={handleTransition}
            loading={transitioning}
          />
        </motion.div>

        {/* ── Document Viewer (Hero) ──────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
          style={{
            marginBottom: spacing.lg,
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
          }}
        >
          <DocumentViewer
            files={viewerFiles}
            onUpload={handleDocumentUpload}
            maxHeight={540}
          />
        </motion.div>

        {/* ── Approval Pipeline ──────────────────────── */}
        {/* ── Workflow Timeline ──────────────────────────── */}
        {currentStatus !== 'rejected' && currentStatus !== 'resubmit' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            style={{
              marginBottom: spacing.lg,
              padding: `${spacing.md} ${spacing.lg}`,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <WorkflowTimeline steps={SUBMITTAL_STEPS} currentStep={currentStatus} />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{ marginBottom: spacing.lg }}
        >
          <ApprovalPipeline status={currentStatus} reviewers={reviewers} />
        </motion.div>

        {/* ── Info Card ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{ marginBottom: spacing.lg }}
        >
          <InfoCard submittal={sub} currentStatus={currentStatus} />
        </motion.div>

        {/* ── Reviews ────────────────────────────────── */}
        {(reviewers.length > 0 || (currentStatus !== 'draft' && currentStatus !== 'closed' && currentStatus !== 'approved')) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{ marginBottom: spacing.lg }}
          >
            <SectionDivider label={`${reviewers.length} ${reviewers.length === 1 ? 'Review' : 'Reviews'}`} />

            {reviewers.length > 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: spacing.md,
                padding: `${spacing.md} 0`,
              }}>
                {reviewers.map((r: any, i: number) => (
                  <ReviewBubble key={r.id || i} reviewer={r} index={i} />
                ))}
              </div>
            ) : (
              <div style={{
                padding: `${spacing.lg} ${spacing.xl}`,
                textAlign: 'center',
              }}>
                <Eye size={24} style={{ color: colors.textTertiary, margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>
                  Awaiting review{sub.assigned_to ? ` from ${sub.assigned_to}` : ''}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Related Intelligence ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          style={{ marginBottom: spacing.xl }}
        >
          <SectionDivider label="Related" />
          <div style={{ paddingTop: spacing.sm }}>
            <RelatedIntelligence submittal={sub} />
          </div>
        </motion.div>

      </div>
    </PageContainer>
  )
}

export default SubmittalDetailPage
