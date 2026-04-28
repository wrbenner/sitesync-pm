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

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, Clock, Calendar, DollarSign,
  CheckCircle, AlertTriangle, XCircle, MessageSquare, FileText,
  Image, ChevronDown, MoreHorizontal, User, Eye, EyeOff,
  Paperclip, Flag, Bell, Users, Timer, CircleDot, Zap,
  Copy, ExternalLink, Share2
} from 'lucide-react'
import { PageContainer, Card, Btn, Avatar, PriorityTag, useToast } from '../../components/Primitives'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRFI } from '../../hooks/queries/rfis'
import { useUpdateRFI, useCreateRFIResponse } from '../../hooks/mutations/rfis'
import { useProjectId } from '../../hooks/useProjectId'
import { useRealtimeRowInvalidation } from '../../hooks/useRealtimeInvalidation'
import { EntityPresence } from '../../components/collaboration/PresenceBar'
import { useProfileNames, displayName, type ProfileMap } from '../../hooks/queries/profiles'
import { ApprovalPanel } from '../../components/workflows/ApprovalPanel'
import {
  getRFIStatusConfig, getValidTransitions, getNextStatus,
  getDueDateUrgency, getDaysOpen,
  type RFIState
} from '../../machines/rfiMachine'
import { WorkflowTimeline } from '../../components/WorkflowTimeline'
import type { RFI, RFIResponse } from '../../types/database'

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

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

const formatShortDate = (d: string | null) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const relativeTime = (d: string | null) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatShortDate(d)
}

// ─── Types ────────────────────────────────────────────────

interface ActivityEvent {
  type: 'response' | 'status_change'
  timestamp: string
  data: RFIResponse | { from: string; to: string; changedBy: string }
}

// ─── Watchers Hook ────────────────────────────────────────

function useRFIWatchers(rfiId: string | undefined) {
  return useQuery({
    queryKey: ['rfi_watchers', rfiId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfi_watchers')
        .select('*')
        .eq('rfi_id', rfiId!)
      if (error) throw error
      return data ?? []
    },
    enabled: !!rfiId,
  })
}

function useToggleWatch(rfiId: string, userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (watching: boolean) => {
      if (watching) {
        const { error } = await supabase
          .from('rfi_watchers')
          .delete()
          .eq('rfi_id', rfiId)
          .eq('user_id', userId!)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('rfi_watchers')
          .insert({ rfi_id: rfiId, user_id: userId! })
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

// ─── Response Bubble ──────────────────────────────────────

const ResponseBubble: React.FC<{
  response: RFIResponse
  index: number
  isNew?: boolean
  profileMap?: ProfileMap
}> = ({ response, index, isNew, profileMap }) => {
  const authorName = displayName(profileMap, response.created_by)
  return (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03, type: 'spring', stiffness: 500, damping: 35 }}
    style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      position: 'relative', padding: '2px 0',
    }}
  >
    {/* New indicator */}
    {isNew && (
      <div style={{
        position: 'absolute', left: -12, top: 14,
        width: 5, height: 5, borderRadius: '50%',
        backgroundColor: colors.primaryOrange,
      }} />
    )}

    <Avatar initials={getInitials(authorName)} size={30} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{
          fontSize: '13px', fontWeight: 600,
          color: colors.textPrimary,
        }}>
          {authorName}
        </span>
        {(response as Record<string, unknown>).company && (
          <span style={{
            fontSize: '10px', color: colors.textTertiary,
            padding: '1px 6px', borderRadius: '10px',
            backgroundColor: colors.surfaceInset,
          }}>
            {String((response as Record<string, unknown>).company)}
          </span>
        )}
        <span style={{ fontSize: '11px', color: colors.textTertiary }}>
          {relativeTime(response.created_at)}
        </span>
      </div>
      <div style={{
        padding: '12px 16px',
        backgroundColor: colors.surfaceInset,
        borderRadius: '4px 14px 14px 14px',
        fontSize: '14px', color: colors.textPrimary,
        lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {response.content || ''}
      </div>
      {/* Attachments */}
      {response.attachments && Array.isArray(response.attachments) && (response.attachments as unknown[]).length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          {(response.attachments as unknown[]).map((att: unknown, i: number) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', color: colors.primaryOrange,
              padding: '3px 8px', borderRadius: '6px',
              backgroundColor: colors.orangeSubtle, cursor: 'pointer',
            }}>
              <Paperclip size={10} />
              {typeof att === 'string' ? att : `File ${i + 1}`}
            </span>
          ))}
        </div>
      )}
    </div>
  </motion.div>
  )
}

// ─── Compose Box ──────────────────────────────────────────

const ComposeBox: React.FC<{
  rfiId: string
  projectId: string
}> = ({ rfiId, projectId }) => {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const createResponse = useCreateRFIResponse()
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await createResponse.mutateAsync({
        data: { rfi_id: rfiId, content: text.trim(), project_id: projectId },
        rfiId, projectId,
      })
      setText('')
    } catch {
      // handled by mutation
    } finally {
      setSending(false)
    }
  }, [text, sending, rfiId, projectId, createResponse])

  // Auto-grow textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = Math.min(ref.current.scrollHeight, 180) + 'px'
    }
  }, [text])

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-end',
      padding: '16px 20px',
      borderTop: `1px solid ${colors.borderSubtle}`,
      backgroundColor: colors.surfaceInset,
      borderRadius: '0 0 16px 16px',
    }}>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a response… (⌘+Enter to send)"
        rows={1}
        style={{
          flex: 1, padding: '11px 14px',
          fontSize: '14px', color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
          border: `1.5px solid ${colors.borderSubtle}`,
          borderRadius: '12px',
          outline: 'none', resize: 'none',
          fontFamily: 'inherit', lineHeight: 1.5,
          minHeight: 44, maxHeight: 180,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = colors.primaryOrange
          e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.primaryOrange}10`
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = colors.borderSubtle
          e.currentTarget.style.boxShadow = 'none'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSend()
          }
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || sending}
        title="Send (⌘+Enter)"
        style={{
          width: 42, height: 42, borderRadius: '12px', border: 'none',
          backgroundColor: text.trim() && !sending ? colors.primaryOrange : colors.surfaceDisabled,
          color: text.trim() && !sending ? colors.white : colors.textDisabled,
          cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.15s',
          boxShadow: text.trim() && !sending ? '0 2px 8px rgba(244,120,32,0.25)' : 'none',
        }}
      >
        <Send size={16} />
      </button>
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
    { icon: <DollarSign size={13} />, label: 'Cost', value: rfi.cost_impact != null && rfi.cost_impact !== 0 ? `$${Number(rfi.cost_impact).toLocaleString()}` : null },
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

// ─── New Activity Banner ─────────────────────────────────

const NewActivityBanner: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 0',
    }}>
      <div style={{ flex: 1, height: 1, backgroundColor: `${colors.primaryOrange}25` }} />
      <span style={{
        fontSize: '11px', fontWeight: 600,
        color: colors.primaryOrange, textTransform: 'uppercase',
        letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <Zap size={10} />
        {count} new
      </span>
      <div style={{ flex: 1, height: 1, backgroundColor: `${colors.primaryOrange}25` }} />
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

  // Realtime: invalidate this RFI's detail cache when another user edits it.
  useRealtimeRowInvalidation('rfis', rfiId, [
    ['rfis', 'detail', rfiId],
    ['rfis', projectId],
  ])
  const [transitioning, setTransitioning] = useState<string | null>(null)

  // Track "last viewed" for unread indicator
  const lastViewedKey = rfiId ? `rfi_viewed_${rfiId}` : null
  const lastViewed = useMemo(() => {
    if (!lastViewedKey) return null
    try { return localStorage.getItem(lastViewedKey) } catch { return null }
  }, [lastViewedKey])

  useEffect(() => {
    if (lastViewedKey) {
      try { localStorage.setItem(lastViewedKey, new Date().toISOString()) } catch {}
    }
  }, [lastViewedKey])

  const rfi = rfiData as (RFI & { responses?: RFIResponse[] }) | undefined
  const responses = rfi?.responses ?? []

  const userIdsToResolve = useMemo(
    () => [rfi?.created_by, rfi?.assigned_to, ...responses.map(r => r.created_by)],
    [rfi?.created_by, rfi?.assigned_to, responses],
  )
  const { data: profileMap } = useProfileNames(userIdsToResolve)
  const creatorName = displayName(profileMap, rfi?.created_by)
  const assignedName = rfi?.assigned_to ? displayName(profileMap, rfi.assigned_to) : null

  const currentStatus = (rfi?.status as RFIState) || 'draft'
  const statusConfig = getRFIStatusConfig(currentStatus)
  const transitions = getValidTransitions(currentStatus, 'admin')
  const daysOpen = getDaysOpen(rfi?.created_at ?? null)

  const newResponseCount = useMemo(() => {
    if (!lastViewed || responses.length === 0) return 0
    return responses.filter(r => r.created_at && r.created_at > lastViewed).length
  }, [lastViewed, responses])

  const firstNewIndex = useMemo(() => {
    if (!lastViewed || newResponseCount === 0) return -1
    return responses.findIndex(r => r.created_at && r.created_at > lastViewed)
  }, [lastViewed, newResponseCount, responses])

  const handleTransition = useCallback(async (action: string) => {
    if (!rfi || !projectId) return
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
            {error?.message || 'This RFI may have been deleted or you don\'t have access.'}
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
      `}</style>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

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
              <WatchButton rfiId={rfi.id} watchers={watchers} userId={user?.id} />
              <StatusControl
                currentStatus={currentStatus}
                transitions={transitions}
                onTransition={handleTransition}
                loading={transitioning}
              />
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
              Ball in court: {rfi.ball_in_court}
            </div>
          )}
        </div>

        {/* ── Workflow Timeline ──────────────────────────── */}
        {currentStatus !== 'void' && (
          <div style={{
            marginBottom: '24px',
            padding: '16px 20px',
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
          }}>
            <WorkflowTimeline
              states={['draft', 'open', 'under_review', 'answered', 'closed']}
              currentState={currentStatus === 'void' ? 'closed' : currentStatus}
              completedStates={(() => {
                const order = ['draft', 'open', 'under_review', 'answered', 'closed']
                const idx = order.indexOf(currentStatus)
                return idx > 0 ? order.slice(0, idx) : []
              })()}
              labels={{
                draft: 'Draft',
                open: 'Submitted',
                under_review: 'In Review',
                answered: 'Answered',
                closed: 'Closed',
              }}
            />
          </div>
        )}

        {/* ── Approval Workflow ──────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <ApprovalPanel entityType="rfi" entityId={rfi.id} />
        </div>

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
                {(rfi as Record<string, unknown>).from_company && (
                  <span style={{
                    marginLeft: '6px', fontSize: '10px', color: colors.textTertiary,
                    padding: '1px 6px', borderRadius: '10px',
                    backgroundColor: colors.surfaceInset,
                  }}>
                    {String((rfi as Record<string, unknown>).from_company)}
                  </span>
                )}
                <div style={{ fontSize: '11px', color: colors.textTertiary, marginTop: '1px' }}>
                  {formatDateTime(rfi.created_at)}
                </div>
              </div>
              {rfi.priority && rfi.priority !== 'medium' && (
                <div style={{ marginLeft: 'auto' }}>
                  <PriorityTag priority={rfi.priority} />
                </div>
              )}
            </div>

            {/* The question body */}
            <div style={{
              fontSize: '15px', color: colors.textPrimary,
              lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {rfi.description || String((rfi as Record<string, unknown>).question ?? '') || rfi.title}
            </div>

            {/* Metadata pills */}
            <MetadataSection rfi={rfi} assignedName={assignedName} />
          </div>

          {/* ── Response Thread ─────────────────────────── */}
          {responses.length > 0 && (
            <div style={{
              padding: '16px 24px 20px',
              borderTop: `1px solid ${colors.borderSubtle}`,
              display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '12px', color: colors.textTertiary,
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {responses.length} {responses.length === 1 ? 'Response' : 'Responses'}
                </span>
                {newResponseCount > 0 && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, color: colors.primaryOrange,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: colors.primaryOrange,
                    }} />
                    {newResponseCount} new
                  </span>
                )}
              </div>

              {responses.map((r, i) => (
                <React.Fragment key={r.id}>
                  {i === firstNewIndex && <NewActivityBanner count={newResponseCount} />}
                  <ResponseBubble
                    response={r}
                    index={i}
                    isNew={lastViewed ? (r.created_at != null && r.created_at > lastViewed) : false}
                    profileMap={profileMap}
                  />
                </React.Fragment>
              ))}
              <div ref={threadEndRef} />
            </div>
          )}

          {/* Empty state */}
          {responses.length === 0 && (currentStatus === 'open' || currentStatus === 'under_review') && (
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

          {/* ── Compose ────────────────────────────────── */}
          {currentStatus !== 'closed' && currentStatus !== 'void' && (
            <ComposeBox rfiId={rfi.id} projectId={projectId || ''} />
          )}
        </div>

      </div>
    </PageContainer>
  )
}
