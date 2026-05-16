/**
 * RFI Detail — World-class conversation-first design.
 *
 * Design Philosophy:
 *   - The question is the hero. Everything serves it.
 *   - Conversation flows naturally like iMessage/Linear.
 *   - Metadata is accessible but never in the way.
 *   - Status transitions are one-click, never buried.
 *   - Every GC can use this without training.
 *   - "Ball in court" is always crystal clear.
 */

/* eslint-disable react-hooks/todo */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, Clock, Calendar, DollarSign,
  AlertTriangle, MessageSquare, FileText,
  Image, ChevronDown, User, Eye, EyeOff,
  Flag, Pencil, Timer, MoreHorizontal, Printer, Trash2, RotateCcw,
} from 'lucide-react'
import { PageContainer, Btn, Avatar, PriorityTag, useToast } from '../../components/Primitives'
import { colors, spacing, borderRadius } from '../../styles/theme'
import { fromTable } from '../../lib/db/queries'
import { useAuth } from '../../hooks/useAuth'
import { useRFI } from '../../hooks/queries/rfis'
import { useUpdateRFI } from '../../hooks/mutations/rfis'
import { useProjectId } from '../../hooks/useProjectId'
import { useRealtimeRowInvalidation } from '../../hooks/useRealtimeInvalidation'
import { useProfileNames, displayName } from '../../hooks/queries/profiles'
import { UserName } from '../../components/UserName'
import { ApprovalPanel } from '../../components/workflows/ApprovalPanel'
import { WorkflowTimeline } from '../../components/WorkflowTimeline'
import { EntityHistoryPanel } from '../../components/audit/EntityHistoryPanel'
import { RFIInlineMetadata } from '../../components/rfi/RFIInlineMetadata'
import { RFIDistributeDialog } from '../../components/rfi/RFIDistributeDialog'
import { RFIEditPanel } from '../../components/rfi/RFIEditPanel'
import { RFIReopenDialog } from '../../components/rfi/RFIReopenDialog'
import { RFICloseDialog } from '../../components/rfi/RFICloseDialog'
import { RFIDetailSidebar } from '../../components/rfi/RFIDetailSidebar'
import { RFIAssigneeStatusList } from '../../components/rfi/RFIAssigneeStatusList'
import { RFIDistributionStaticList } from '../../components/rfi/RFIDistributionStaticList'
import { RFIQuestionBody } from '../../components/rfi/RFIQuestionBody'
import { RFIResponseThread } from '../../components/rfi/RFIResponseThread'
import { RFIResponseComposer } from '../../components/rfi/RFIResponseComposer'
import { RFIEmailReviewBanner } from '../../components/rfi/RFIEmailReviewBanner'
import { RFIIrisTriage } from '../../components/rfi/RFIIrisTriage'
import { useRFIResponsesList, type RFIResponseRow } from '../../hooks/queries/useRFIResponses'
import { PermissionGate } from '../../components/auth/PermissionGate'
import { usePermissions } from '../../hooks/usePermissions'
import { AuditTrailButton } from '../../components/audit/AuditTrailButton'
import { SpecExcerptPanel } from '../../components/specifications/SpecExcerptPanel'
import { RfiSlaPanel } from '../../components/conversation/RfiSlaPanel'
import { IrisSuggests } from '../../components/iris/IrisSuggests'
import { IrisApprovalGate } from '../../components/iris/IrisApprovalGate'
import {
  useDraftedActions,
  useApproveDraftedAction,
  useRejectDraftedAction,
} from '../../hooks/queries/draftedActions'
import { toast as sonnerToast } from 'sonner'
import {
  getRFIStatusConfig, getValidTransitions, getNextStatus,
  getDueDateUrgency, getDaysOpen,
  type RFIState
} from '../../machines/rfiMachine'
import type { RFI, RFIResponse } from '../../types/database'

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  ((s || '').trim().split(/\s+/).filter(Boolean).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()) || 'U'

// PR #2.5 (A11) — Shared style for ··· overflow menu items.
const overflowMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  fontSize: 13,
  color: colors.textSecondary,
  textAlign: 'left',
  cursor: 'pointer',
}

const formatDate = (d: string | null) => {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateTime = (d: string | null) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// formatShortDate helper removed under P1b — unused after RFIResponseThread
// took over response date rendering.

// relativeTime helper removed under P1b — RFIResponseThread owns
// its own date formatting now.

// ─── Types ────────────────────────────────────────────────

// ─── Watchers Hook ────────────────────────────────────────

function useRFIWatchers(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId],
    queryFn: async () => {
      const { data, error } = await fromTable('rfi_watchers')
        .select('*')
        .eq('rfi_id' as never, rfiId!)
      if (error) throw error
      return (data ?? []) as unknown as Array<{ user_id: string; id: string; rfi_id: string; created_at: string | null }>
    },
    enabled: !!rfiId,
  })
}

function useToggleWatch(rfiId: string, userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (watching: boolean) => {
      if (watching) {
        const { error } = await fromTable('rfi_watchers')
          .delete()
          .eq('rfi_id' as never, rfiId)
          .eq('user_id' as never, userId!)
        if (error) throw error
      } else {
        const { error } = await fromTable('rfi_watchers')
          .insert({ rfi_id: rfiId, user_id: userId! } as never)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', rfiId] })
    },
  })
}

// ─── Status Control (primary action button) ──────────────

const StatusControl: React.FC<{
  currentStatus: RFIState
  transitions: string[]
  onTransition: (action: string) => void
  loading: string | null
}> = ({ currentStatus, transitions, onTransition, loading }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const config = getRFIStatusConfig(currentStatus)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (transitions.length === 0) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 14px', borderRadius: '20px',
        backgroundColor: config.bg, color: config.color,
        fontSize: '12px', fontWeight: 600,
      }}>
        {config.label}
      </span>
    )
  }

  const primaryAction = transitions.find(t => t !== 'Void')
  const hasVoid = transitions.includes('Void')

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', gap: '6px' }}>
      {primaryAction && (
        <button
          onClick={() => onTransition(primaryAction)}
          disabled={loading !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 18px', borderRadius: '10px',
            border: 'none',
            backgroundColor: loading ? colors.surfaceDisabled : colors.primaryOrange,
            color: loading ? colors.textDisabled : colors.white,
            fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            boxShadow: loading ? 'none' : '0 2px 8px rgba(244,120,32,0.25)',
          }}
        >
          {loading === primaryAction ? 'Updating…' : primaryAction}
        </button>
      )}

      {(transitions.length > 1 || hasVoid) && (
        <>
          <button
            onClick={() => setOpen(!open)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '10px',
              border: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceRaised, cursor: 'pointer',
              color: colors.textTertiary, transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderDefault)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.borderSubtle)}
          >
            <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 50,
                  marginTop: 6, minWidth: 160,
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: '12px',
                  boxShadow: '0 12px 40px -8px rgba(0,0,0,0.15)',
                  overflow: 'hidden', padding: '4px',
                }}
              >
                {transitions.filter(t => t !== primaryAction).map(action => (
                  <button
                    key={action}
                    onClick={() => { onTransition(action); setOpen(false) }}
                    disabled={loading !== null}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '9px 12px',
                      border: 'none', background: 'none', cursor: 'pointer',
                      fontSize: '13px', textAlign: 'left', borderRadius: '8px',
                      color: action === 'Void' ? colors.statusCritical : colors.textPrimary,
                      fontWeight: 500, transition: 'background 0.08s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {action}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

// ─── Watch Button ────────────────────────────────────────

const WatchButton: React.FC<{
  rfiId: string
  watchers: Array<{ user_id: string; id: string; rfi_id: string; created_at: string | null }>
  userId: string | undefined
}> = ({ rfiId, watchers, userId }) => {
  const toggleWatch = useToggleWatch(rfiId, userId)
  const isWatching = userId ? watchers.some(w => w.user_id === userId) : false
  const watcherCount = watchers.length

  return (
    <button
      onClick={() => {
        if (!userId) return
        toggleWatch.mutate(isWatching)
      }}
      disabled={!userId || toggleWatch.isPending}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 12px', borderRadius: '8px',
        border: `1px solid ${isWatching ? colors.primaryOrange : colors.borderSubtle}`,
        backgroundColor: isWatching ? colors.orangeSubtle : 'transparent',
        color: isWatching ? colors.primaryOrange : colors.textTertiary,
        fontSize: '12px', fontWeight: 500,
        cursor: userId ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isWatching) e.currentTarget.style.borderColor = colors.textTertiary
      }}
      onMouseLeave={(e) => {
        if (!isWatching) e.currentTarget.style.borderColor = colors.borderSubtle
      }}
    >
      {isWatching ? <Eye size={12} /> : <EyeOff size={12} />}
      {isWatching ? 'Watching' : 'Watch'}
      {watcherCount > 0 && (
        <span style={{
          padding: '0 5px', borderRadius: '10px',
          backgroundColor: isWatching ? colors.primaryOrange : colors.surfaceInset,
          color: isWatching ? colors.white : colors.textTertiary,
          fontSize: '10px', fontWeight: 600, lineHeight: '16px',
        }}>
          {watcherCount}
        </span>
      )}
    </button>
  )
}

// ─── Metadata Section ────────────────────────────────────

const MetadataSection: React.FC<{ rfi: RFI; assignedName?: string | null }> = ({ rfi, assignedName }) => {
  const [expanded, setExpanded] = useState(false)
  const urgency = getDueDateUrgency(rfi.due_date ?? null)

  const items = [
    { icon: <User size={13} />, label: 'Assigned', value: assignedName ?? null },
    { icon: <Calendar size={13} />, label: 'Due', value: formatDate(rfi.due_date ?? null), color: urgency?.color },
    { icon: <DollarSign size={13} />, label: 'Cost', value: (() => {
        // P1b: cost_impact is dropped; read from cost_impact_cents.
        const cents = (rfi as unknown as { cost_impact_cents?: number | null }).cost_impact_cents
        if (cents == null || Number(cents) === 0) return null
        return `$${(Number(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
      })() },
    { icon: <Clock size={13} />, label: 'Schedule', value: rfi.schedule_impact ? `${rfi.schedule_impact} days` : null },
    { icon: <FileText size={13} />, label: 'Spec', value: rfi.spec_section },
    { icon: <Image size={13} />, label: 'Drawing', value: rfi.drawing_reference },
  ].filter(item => item.value)

  if (items.length === 0) return null

  // Show first 3 always, rest behind toggle
  const visible = expanded ? items : items.slice(0, 3)
  const hasMore = items.length > 3

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {visible.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '8px',
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${item.color ? `${item.color}30` : colors.borderSubtle}`,
            fontSize: '12px',
          }}>
            <span style={{ color: item.color || colors.textTertiary, display: 'flex' }}>{item.icon}</span>
            <span style={{ color: colors.textTertiary }}>{item.label}</span>
            <span style={{ color: item.color || colors.textPrimary, fontWeight: 500 }}>
              {item.value}
            </span>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '8px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '11px', color: colors.textTertiary,
              transition: 'color 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.textSecondary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
          >
            {expanded ? 'Less' : `+${items.length - 3} more`}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={11} />
            </motion.span>
          </button>
        )}
      </div>
    </div>
  )
}


// ─── Main Page ────────────────────────────────────────────

export function RFIDetail() {
  const { rfiId } = useParams<{ rfiId: string }>()
  const navigate = useNavigate()
  const projectId = useProjectId()
  const { addToast } = useToast()
  const { user } = useAuth()

  const { data: rfiData, isLoading, error } = useRFI(rfiId)
  const { data: watchers = [] } = useRFIWatchers(rfiId)
  const updateRFI = useUpdateRFI()

  // Iris approval gate — drafts targeting THIS RFI go below the IrisSuggests panel.
  const { data: draftedActions = [] } = useDraftedActions('rfi', rfiId)
  const approveDraft = useApproveDraftedAction()
  const rejectDraft = useRejectDraftedAction()

  // Realtime: invalidate this RFI's detail cache when another user edits it.
  useRealtimeRowInvalidation('rfis', rfiId, [
    ['rfis', 'detail', rfiId],
    ['rfis', projectId],
  ])
  const [transitioning, setTransitioning] = useState<string | null>(null)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [editPanelOpen, setEditPanelOpen] = useState(false)
  // PR #2.5 wave — Reopen-with-reason dialog (A12) + ··· overflow menu (A11)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const overflowMenuRef = useRef<HTMLDivElement>(null)

  // Track "last viewed" for unread indicator
  const lastViewedKey = rfiId ? `rfi_viewed_${rfiId}` : null
  const lastViewed = useMemo(() => {
    if (!lastViewedKey) return null
    try { return localStorage.getItem(lastViewedKey) } catch { return null }
  }, [lastViewedKey])

  useEffect(() => {
    if (lastViewedKey) {
      try { localStorage.setItem(lastViewedKey, new Date().toISOString()) } catch { /* localStorage may be unavailable (Safari private mode) */ }
    }
  }, [lastViewedKey])

  const rfi = rfiData as (RFI & { responses?: RFIResponse[] }) | undefined
  const responses = useMemo(() => rfi?.responses ?? [], [rfi?.responses])

  // P1b: live thread query — picks up edits/deletes/official toggles
  // without requiring a full RFI re-fetch. Falls back to whatever the
  // RFI detail bundle returned for the first paint (preserves current
  // mark-as-read + skeleton timing).
  const { data: liveResponses } = useRFIResponsesList(rfiId)
  const detailedResponses = useMemo<RFIResponseRow[]>(() => {
    const fromLive = liveResponses ?? null
    if (fromLive && fromLive.length >= 0) return fromLive
    return (responses as unknown as RFIResponseRow[]) ?? []
  }, [liveResponses, responses])

  const userIdsToResolve = useMemo(
    () => [rfi?.created_by, rfi?.assigned_to, ...responses.map(r => r.author_id)],
    [rfi?.created_by, rfi?.assigned_to, responses],
  )
  const { data: profileMap } = useProfileNames(userIdsToResolve)
  const creatorName = displayName(profileMap, rfi?.created_by)
  const assignedName = rfi?.assigned_to ? displayName(profileMap, rfi.assigned_to) : null

  const currentStatus = (rfi?.status as RFIState) || 'draft'
  const statusConfig = getRFIStatusConfig(currentStatus)
  // Pass the real user role so getValidTransitions can hide Void from
  // non-admin/non-owner users (per PermissionGate audit + Build Spec
  // Part 5). Falls back to 'viewer' which yields the safest minimum
  // transition set while permissions are loading.
  const { role: userRole } = usePermissions()
  const transitions = getValidTransitions(currentStatus, userRole ?? 'viewer')
  const daysOpen = getDaysOpen(rfi?.created_at ?? null)

  const newResponseCount = useMemo(() => {
    if (!lastViewed || responses.length === 0) return 0
    return responses.filter(r => r.created_at && r.created_at > lastViewed).length
  }, [lastViewed, responses])

  // firstNewIndex deprecated under P1b — RFIResponseThread owns
  // ordering + new-since indicators inside its own cards.
  void newResponseCount

  const handleTransition = useCallback(async (action: string) => {
    if (!rfi || !projectId) return
    // PR #2.5 (A12) — Reopen captures reason + category before firing
    // the state-machine transition. Intercept here and let the dialog
    // handle the actual flip via onReopen callback.
    if (action === 'Reopen') {
      setReopenDialogOpen(true)
      return
    }
    // Info-density wave PR #2 — Close intercepts the same way Reopen does.
    // Open the dialog so disposition + final-response link + summary land
    // alongside the status flip in one mutation.
    if (action === 'Close') {
      setCloseDialogOpen(true)
      return
    }
    const nextStatus = getNextStatus(currentStatus, action)
    if (!nextStatus) return
    setTransitioning(action)
    try {
      await updateRFI.mutateAsync({ id: rfi.id, projectId, updates: { status: nextStatus } })
      addToast('success', `Status updated`)
    } catch {
      addToast('error', `Failed to update status`)
    } finally {
      setTransitioning(null)
    }
  }, [rfi, projectId, currentStatus, updateRFI, addToast])

  // PR #2.5 (A12) — fired by RFIReopenDialog after reason + category
  // persist; flips status to 'open' via the same audit-aware path.
  const handleReopenAfterReason = useCallback(async () => {
    if (!rfi || !projectId) return
    setTransitioning('Reopen')
    try {
      await updateRFI.mutateAsync({ id: rfi.id, projectId, updates: { status: 'open' } })
      addToast('success', 'RFI reopened')
    } catch {
      addToast('error', 'Failed to reopen RFI')
    } finally {
      setTransitioning(null)
    }
  }, [rfi, projectId, updateRFI, addToast])

  // PR #2.5 (A11) — close the ··· overflow menu when clicking outside.
  useEffect(() => {
    if (!overflowMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setOverflowMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [overflowMenuOpen])

  // PR #2.5 (A11) — Print uses the browser's native print pipeline; CSS
  // print rules in app-level styles can refine the layout if needed.
  const handlePrint = useCallback(() => {
    setOverflowMenuOpen(false)
    window.print()
  }, [])

  // PR #2.5 (A11) — Soft-delete via existing `deleted_at`. Confirms via
  // window.confirm; the Recycle Bin tab on the list page surfaces the
  // restore path.
  const handleDelete = useCallback(async () => {
    if (!rfi || !projectId) return
    setOverflowMenuOpen(false)
    if (!window.confirm(`Delete RFI-${String(rfi.number ?? '').padStart(3, '0')}? It moves to the Recycle Bin and can be restored.`)) return
    try {
      await updateRFI.mutateAsync({
        id: rfi.id,
        projectId,
        updates: { deleted_at: new Date().toISOString() } as never,
      })
      addToast('success', 'RFI moved to Recycle Bin')
      navigate('/rfis')
    } catch {
      addToast('error', 'Failed to delete RFI')
    }
  }, [rfi, projectId, updateRFI, addToast, navigate])

  // Auto-scroll to bottom of thread
  const threadEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (responses.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [responses.length])

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageContainer>
        <style>{`@keyframes rfi-detail-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 0' }}>
          <div style={{ height: 32, width: 120, borderRadius: '8px', backgroundColor: colors.surfaceInset, marginBottom: '20px', animation: 'rfi-detail-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 28, width: '80%', borderRadius: '8px', backgroundColor: colors.surfaceInset, marginBottom: '12px', animation: 'rfi-detail-pulse 1.5s ease-in-out infinite', animationDelay: '0.1s' }} />
          <div style={{ height: 120, borderRadius: '16px', backgroundColor: colors.surfaceInset, marginBottom: '16px', animation: 'rfi-detail-pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
          <div style={{ height: 80, borderRadius: '16px', backgroundColor: colors.surfaceInset, animation: 'rfi-detail-pulse 1.5s ease-in-out infinite', animationDelay: '0.3s' }} />
        </div>
      </PageContainer>
    )
  }

  // ── Error ───────────────────────────────────────────────
  if (error || !rfi) {
    return (
      <PageContainer>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '80px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '18px',
            backgroundColor: `${colors.statusCritical}08`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertTriangle size={28} color={colors.statusCritical} />
          </div>
          <h2 style={{ color: colors.textPrimary, margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
            RFI not found
          </h2>
          <p style={{ color: colors.textTertiary, margin: '0 0 20px', fontSize: '14px' }}>
            {/*
              Hide raw Supabase / PostgREST errors like "Cannot coerce the
              result to a single JSON object" or "JSON object requested,
              multiple (or no) rows returned" — pure developer-speak.
              Always render the friendly explanation in the not-found state.
            */}
            This RFI may have been deleted or you don&apos;t have access.
          </p>
          <Btn onClick={() => navigate('/rfis')}>Back to RFIs</Btn>
        </div>
      </PageContainer>
    )
  }

  const rfiNumber = rfi.number ? `RFI-${String(rfi.number).padStart(3, '0')}` : 'RFI'

  return (
    <PageContainer aria-label={`${rfiNumber}: ${rfi.title}`}>
      <style>{`
        @keyframes rfi-detail-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @media (max-width: 1024px) {
          .rfi-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .rfi-detail-sidebar { order: -1; }
        }
      `}</style>
      {/* Drop the 720px cap (May-7 final gap audit item #5) — Procore is
          1240px+ with metadata in a side rail. Grid: main content (1fr) +
          sidebar (320px). Collapses to single column under 1024px. */}
      <div
        className="rfi-detail-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 24,
          maxWidth: 1240,
          margin: '0 auto',
        }}
      >
        <div style={{ minWidth: 0 }}>

        {/* ── Back navigation ──────────────────────────── */}
        <button
          onClick={() => navigate('/rfis')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textTertiary, fontSize: '13px', fontWeight: 500,
            padding: '6px 10px', marginLeft: '-10px', marginBottom: '16px',
            borderRadius: '8px', transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.primaryOrange
            e.currentTarget.style.backgroundColor = colors.orangeSubtle
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.textTertiary
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <ArrowLeft size={14} /> Back to RFIs
        </button>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ marginBottom: '20px' }}>
          {/* Top row: number + status badges + actions */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '13px', fontWeight: 700, color: colors.primaryOrange,
              }}>
                {rfiNumber}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '8px',
                backgroundColor: statusConfig.bg, color: statusConfig.color,
                fontSize: '12px', fontWeight: 600,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusConfig.color }} />
                {statusConfig.label}
              </span>
              <span style={{
                fontSize: '12px', color: colors.textTertiary,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Timer size={12} />
                {daysOpen}d open
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AuditTrailButton
                entityType="rfi"
                entityId={rfi.id}
                projectId={rfi.project_id}
              />
              <WatchButton rfiId={rfi.id} watchers={watchers} userId={user?.id} />
              {/* P1a — Edit panel button. Watcher list editor lives inside.
                  Clicking opens the same slide-in panel users see from the
                  list page's [Edit] column, with all RFI fields editable,
                  including the multi-select watcher + distribution chips. */}
              <PermissionGate permission="rfis.edit">
                <button
                  type="button"
                  onClick={() => setEditPanelOpen(true)}
                  title="Edit all RFI fields, watchers, and distribution"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 8,
                    border: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <Pencil size={12} /> Edit
                </button>
              </PermissionGate>
              {/* Distribute / Forward to sub — P0 #8. Permission-gated to
                  rfis.edit so read-only users see no affordance. The
                  dialog itself persists to rfi_distributions and the
                  audit trigger surfaces the event in History. */}
              <PermissionGate permission="rfis.edit">
                <button
                  type="button"
                  onClick={() => setDistributeOpen(true)}
                  title="Forward this RFI to a sub or other recipient"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 8,
                    border: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <Send size={12} /> Distribute
                </button>
              </PermissionGate>
              {/* PermissionGate around the entire StatusControl (P0 #9):
                  Close, Void, Send for Review, Reopen, Submit all live
                  here. Read-only / viewer role sees only the static pill.
                  Void is further filtered to admin/owner inside
                  getValidTransitions(role) — defense in depth. */}
              <PermissionGate
                permission="rfis.edit"
                fallback={
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '20px',
                    backgroundColor: statusConfig.bg, color: statusConfig.color,
                    fontSize: '12px', fontWeight: 600,
                  }}>
                    {statusConfig.label}
                  </span>
                }
              >
                <StatusControl
                  currentStatus={currentStatus}
                  transitions={transitions}
                  onTransition={handleTransition}
                  loading={transitioning}
                />
              </PermissionGate>

              {/* PR #2.5 (A11) — ··· overflow menu. Print / Convert /
                  Delete in the first cut; Duplicate + Move project queued
                  for follow-up. Print is browser-native; Convert reuses
                  the existing RFIConvertMenu; Delete soft-deletes via
                  the existing deleted_at column. */}
              <div ref={overflowMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setOverflowMenuOpen((v) => !v)}
                  aria-label="More actions"
                  aria-expanded={overflowMenuOpen}
                  title="More actions"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '5px 8px', borderRadius: 8,
                    border: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
                {overflowMenuOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                      minWidth: 200, padding: 4,
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: 10,
                      boxShadow: '0 12px 32px -8px rgba(0,0,0,0.25)',
                      zIndex: 60,
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handlePrint}
                      style={overflowMenuItemStyle}
                    >
                      <Printer size={13} /> Print
                    </button>
                    {currentStatus === 'closed' || currentStatus === 'answered' ? (
                      <PermissionGate permission="rfis.edit">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOverflowMenuOpen(false)
                            setReopenDialogOpen(true)
                          }}
                          style={overflowMenuItemStyle}
                        >
                          <RotateCcw size={13} /> Reopen…
                        </button>
                      </PermissionGate>
                    ) : null}
                    <PermissionGate permission="rfis.edit">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleDelete()}
                        style={{ ...overflowMenuItemStyle, color: colors.red }}
                      >
                        <Trash2 size={13} /> Move to Recycle Bin
                      </button>
                    </PermissionGate>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 style={{
            margin: 0, fontSize: '24px',
            fontWeight: 700, color: colors.textPrimary,
            lineHeight: 1.3, letterSpacing: '-0.02em',
          }}>
            {rfi.title}
          </h1>

          {/* Ball in court — prominent when active */}
          {rfi.ball_in_court && currentStatus !== 'closed' && currentStatus !== 'void' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              marginTop: '10px', padding: '5px 12px',
              borderRadius: '8px',
              backgroundColor: colors.orangeSubtle,
              border: `1px solid ${colors.primaryOrange}20`,
              fontSize: '12px', color: colors.primaryOrange, fontWeight: 600,
            }}>
              <Flag size={11} />
              {/* The literal site of Walker's "code in activity" complaint —
                  this used to render a raw UUID. UserName guarantees skeleton
                  during load, then a name; never the UUID. */}
              Ball in court: <UserName userId={rfi.ball_in_court} fallback="—" />
            </div>
          )}
        </div>

        {/* ── Workflow Timeline ──────────────────────────── */}
        <div
          style={{
            marginBottom: '24px',
            padding: spacing['4'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <WorkflowTimeline
            ariaLabel={`RFI ${rfiNumber} workflow status`}
            currentState={currentStatus === 'void' ? 'closed' : currentStatus}
            states={[
              { key: 'draft', label: 'Draft' },
              { key: 'open', label: 'Open', mobileLabel: 'Open' },
              { key: 'under_review', label: 'Under Review', mobileLabel: 'Reviewing' },
              { key: 'answered', label: 'Answered' },
              { key: 'closed', label: 'Closed' },
            ]}
          />
        </div>

        {/* ── Approval Workflow ──────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <ApprovalPanel entityType="rfi" entityId={rfi.id} />
        </div>

        {/* ── Inline-editable metadata (P0 #7: subject, ball-in-court,
            due date, priority, drawing ref, spec section) ───────── */}
        <div style={{ marginBottom: '24px' }}>
          <RFIInlineMetadata rfi={rfi as RFI} />
        </div>

        {/* ── Assignees with per-person ✓ checkboxes (May-7 audit item
            #2). Reads rfi_assignees rows. The plumbing has been there
            since P1b; this is the first time we render it on detail. */}
        <section
          aria-label="Assignees"
          style={{
            marginBottom: '24px',
            padding: spacing['4'],
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: spacing['3'],
              fontSize: 13,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Assignees
          </h2>
          <RFIAssigneeStatusList rfiId={rfi.id} />
        </section>

        {/* ── Distribution recipients (May-7 audit item #3). Static chip
            list, click-to-edit. Surfaces who's on the distribution
            without forcing a click into Edit. */}
        <section
          aria-label="Distribution"
          style={{
            marginBottom: '24px',
            padding: spacing['4'],
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: spacing['3'],
              fontSize: 13,
              fontWeight: 700,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Distribution
          </h2>
          <RFIDistributionStaticList
            rfiId={rfi.id}
            projectId={rfi.project_id}
            rfiNumber={rfi.number}
          />
        </section>

        {/* ── Audit timeline (the moat) ──────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <EntityHistoryPanel entityType="rfi" entityId={rfi.id} />
        </div>

        {/* ── P1c — Iris email review banner. Surfaces low-confidence
              inbound matches for Walker to Accept/Reject before they
              join the legal record. ─────────────────────────────── */}
        <RFIEmailReviewBanner rfiId={rfi.id} projectId={rfi.project_id} />

        {/* ── The Question + Thread Card ──────────────────── */}
        <div style={{
          borderRadius: '16px',
          border: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceRaised,
          overflow: 'hidden',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* Question content */}
          <div style={{ padding: '20px 24px' }}>
            {/* Author */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '14px',
            }}>
              <Avatar initials={getInitials(creatorName)} size={30} />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
                  {creatorName}
                </span>
                {(rfi as RFI & { from_company?: string }).from_company && (
                  <span style={{
                    marginLeft: '6px', fontSize: '10px', color: colors.textTertiary,
                    padding: '1px 6px', borderRadius: '10px',
                    backgroundColor: colors.surfaceInset,
                  }}>
                    {(rfi as RFI & { from_company?: string }).from_company}
                  </span>
                )}
                <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '1px' }}>
                  {formatDateTime(rfi.created_at)}
                </div>
              </div>
              {rfi.priority && rfi.priority !== 'medium' && (
                <div style={{ marginLeft: 'auto' }}>
                  <PriorityTag priority={rfi.priority as 'critical' | 'high' | 'medium' | 'low'} />
                </div>
              )}
            </div>

            {/* The question body — TipTap-authored HTML rendered via
                read-only editor (May-7 audit item #5). Falls back to
                pre-wrap plain text for legacy non-HTML rows. */}
            <RFIQuestionBody
              body={rfi.description || (rfi as RFI & { question?: string }).question || null}
              fallback={rfi.title ?? ''}
            />

            {/* SLA timer + pause/resume + bounce surface */}
            <RfiSlaPanel
              rfiId={rfi.id}
              projectId={rfi.project_id}
              dueDate={(rfi as RFI & { response_due_date?: string | null }).response_due_date ?? rfi.due_date ?? null}
              pausedAt={(rfi as RFI & { sla_paused_at?: string | null }).sla_paused_at ?? null}
              pausedReason={(rfi as RFI & { sla_paused_reason?: string | null }).sla_paused_reason ?? null}
            />

            {/* Spec excerpt — auto-loaded when rfi.spec_section is set */}
            <SpecExcerptPanel projectId={rfi.project_id} specSection={rfi.spec_section} />

            {/* Iris suggestions — proactive draft responses, escalations, follow-ups */}
            <IrisSuggests entityType="rfi" entityId={rfi.id} projectId={rfi.project_id} />

            {/* Iris approval gates — drafted actions awaiting one-click approval */}
            {draftedActions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], margin: `${spacing['3']} 0 ${spacing['4']}` }}>
                {draftedActions.map((draft) => (
                  <IrisApprovalGate
                    key={draft.id}
                    draft={draft}
                    busy={approveDraft.isPending || rejectDraft.isPending}
                    onApprove={async (d) => {
                      try {
                        await approveDraft.mutateAsync(d)
                        sonnerToast.success('Approved')
                      } catch {
                        sonnerToast.error('Could not approve — please try again')
                      }
                    }}
                    onReject={async (d) => {
                      await rejectDraft.mutateAsync({ draft: d, reason: undefined })
                      sonnerToast('Rejected')
                    }}
                  />
                ))}
              </div>
            )}

            {/* Metadata pills */}
            <MetadataSection rfi={rfi} assignedName={assignedName} />
          </div>

          {/* ── Response Thread (P1b) — pinned Official answer + per-card
                kebab + edit/delete + response_type badges + internal
                styling. Pulls live data so edits land without refresh. */}
          {detailedResponses.length > 0 && (
            <>
              {/* P2b — Iris triage banner above the latest response. */}
              <RFIIrisTriage
                rfiId={rfi.id}
                projectId={rfi.project_id}
                responses={detailedResponses}
              />
              <RFIResponseThread
                rfiId={rfi.id}
                projectId={rfi.project_id}
                responses={detailedResponses}
              />
            </>
          )}

          {/* Empty state */}
          {detailedResponses.length === 0 && (currentStatus === 'open' || currentStatus === 'under_review') && (
            <div style={{
              padding: '32px 24px', borderTop: `1px solid ${colors.borderSubtle}`,
              textAlign: 'center',
            }}>
              <MessageSquare size={24} style={{ color: colors.textTertiary, margin: '0 auto 8px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', color: colors.textTertiary }}>
                Waiting for a response{assignedName ? ` from ${assignedName}` : ''}
              </div>
              {rfi.due_date && (
                <div style={{ fontSize: '12px', color: colors.textTertiary, marginTop: '4px' }}>
                  Due {formatDate(rfi.due_date)}
                </div>
              )}
            </div>
          )}

          {/* ── Compose (P1b composer w/ response type, internal toggle, @-mentions) */}
          {currentStatus !== 'closed' && currentStatus !== 'void' && (
            <RFIResponseComposer
              rfiId={rfi.id}
              projectId={rfi.project_id}
              rfiNumber={rfi.number}
            />
          )}
        </div>

        </div>

        {/* ── Sidebar (May-7 audit item #6). Right-rail summary so the
            detail page reads as an enterprise record, not a chat thread.
            On <1024px the sidebar collapses to the top of the column. */}
        <div className="rfi-detail-sidebar" style={{ minWidth: 0 }}>
          <RFIDetailSidebar
            rfiId={rfi.id}
            ballInCourt={rfi.ball_in_court ?? null}
            status={currentStatus}
            dueDate={rfi.due_date ?? null}
            scheduleImpactStatus={(rfi as RFI & { schedule_impact_status?: string | null }).schedule_impact_status ?? null}
            scheduleDaysImpact={(rfi as RFI & { schedule_days_impact?: number | null }).schedule_days_impact ?? null}
            costImpactStatus={(rfi as RFI & { cost_impact_status?: string | null }).cost_impact_status ?? null}
            costImpactCents={(rfi as RFI & { cost_impact_cents?: number | null }).cost_impact_cents ?? null}
          />
        </div>

      </div>

      {/* ── Distribute / Forward dialog (P0 #8). Mounted here so it
          overlays the whole detail page when open. ───────────────── */}
      <RFIDistributeDialog
        rfiId={rfi.id}
        projectId={rfi.project_id}
        rfiNumber={rfi.number}
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
      />

      {/* ── P1a — Full Edit panel. Hosts the watcher + distribution chip
          editors so the detail-page Edit click reaches the same surface
          users see from the list page. ─────────────────────────────── */}
      <RFIEditPanel
        open={editPanelOpen}
        onClose={() => setEditPanelOpen(false)}
        rfiId={rfi.id}
        projectId={rfi.project_id}
      />

      {/* ── PR #2.5 (A12) — Reopen-with-reason dialog. Captures the
          reason + category onto rfis.{reopen_reason, reopen_category}
          before flipping status; chain-of-custody win for downstream
          legal review. ───────────────────────────────────────────── */}
      <RFIReopenDialog
        open={reopenDialogOpen}
        onClose={() => setReopenDialogOpen(false)}
        rfiId={rfi.id}
        projectId={rfi.project_id}
        rfiNumber={rfi.number}
        onReopen={handleReopenAfterReason}
      />

      {/* Info-density PR #2 — Close-with-disposition dialog. Captures the
          6 close-action fields (disposition, final_response_id, summary,
          schedule_actual, cost_actual, signoff) onto the rfis row before
          flipping status; matches Procore parity + the Bugatti audit
          chain (legal-grade narrative). ───────────────────────────── */}
      <RFICloseDialog
        open={closeDialogOpen}
        onClose={() => setCloseDialogOpen(false)}
        rfiId={rfi.id}
        projectId={rfi.project_id}
        rfiNumber={rfi.number}
        scheduleImpactStatus={
          (rfi as RFI & { schedule_impact_status?: string | null }).schedule_impact_status ?? null
        }
        costImpactStatus={
          (rfi as RFI & { cost_impact_status?: string | null }).cost_impact_status ?? null
        }
      />
    </PageContainer>
  )
}
