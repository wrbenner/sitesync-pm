/**
 * RFI Creation — Enterprise quality. One screen. Fast.
 *
 * Design philosophy:
 *   - The question IS the interface — big, clear, multiline
 *   - "From" auto-fills from your session (overridable)
 *   - "To" pulls real contacts with response-time data
 *   - Spec/drawing references inline (construction standard)
 *   - Progressive disclosure: show only what's needed
 *   - Cmd+Enter sends. Always.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Send, Camera, Paperclip, ChevronDown, Search, Loader2,
  Clock, AlertCircle, Calendar, BookOpen, FileText, Sparkles
} from 'lucide-react'
import { colors, zIndex } from '../../styles/theme'
import { Avatar } from '../Primitives'
import { useRealtimeDirectoryContacts } from '../../hooks/queries/realtime'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuth } from '../../hooks/useAuth'
import { useRFIs } from '../../hooks/queries'
import { supabase } from '../../lib/supabase'
import type { DirectoryContact } from '../../types/database'
import { RFIRichTextEditor } from '../rfi/RFIRichTextEditor'
import {
  useCreateIrisRFIDraftV2,
  useIrisRFIDraftV2,
} from '../../hooks/queries/useIrisRFIDraftV2'
import { useProjectDirectory } from '../../hooks/queries/useProjectDirectory'
import { useAddRFIAssignee } from '../../hooks/queries/useRFIAssignees'
import { useAddRFIDistribution } from '../../hooks/queries/useRFIDistributions'
import { useAddRFIWatcher } from '../../hooks/queries/useRFIWatchers'
import { fromTable } from '../../lib/db/queries'
import { UserChipEditor } from '../rfi/UserChipEditor'
import { RFITypeAhead } from '../rfi/RFITypeAhead'
import { useProjectCostCodes } from '../../hooks/queries/useProjectCostCodes'
import { useProjectRFIStages } from '../../hooks/queries/useProjectRFIStages'

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  ((s || '').trim().split(/\s+/).filter(Boolean).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase()) || 'U'

const isoDate = (d: Date) => d.toISOString().split('T')[0]

const defaultDueDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return isoDate(d)
}

const daysFromNow = (dateStr: string) => {
  if (!dateStr) return 0
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

// ─── Priority Picker ─────────────────────────────────────

const PRIORITIES = [
  { value: 'low',      label: 'Low',      color: '#6B7280', bg: '#F3F4F6' },
  { value: 'medium',   label: 'Medium',   color: '#D97706', bg: '#FFFBEB' },
  { value: 'high',     label: 'High',     color: '#DC2626', bg: '#FEF2F2' },
  { value: 'critical', label: 'Critical', color: '#7C2D12', bg: '#FEE2E2' },
] as const

const PriorityPicker: React.FC<{
  value: string
  onChange: (v: string) => void
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: '6px' }}>
    {PRIORITIES.map(p => {
      const active = value === p.value
      return (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          aria-label={`Priority: ${p.label}`}
          aria-pressed={active}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 12px', borderRadius: '20px',
            border: `1.5px solid ${active ? p.color : colors.borderSubtle}`,
            backgroundColor: active ? p.bg : 'transparent',
            cursor: 'pointer', transition: 'all 0.15s',
            fontSize: '12px',
            fontWeight: active ? 600 : 400,
            color: active ? p.color : colors.textTertiary,
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: active ? p.color : colors.borderSubtle,
            transition: 'background-color 0.15s',
          }} />
          {p.label}
        </button>
      )
    })}
  </div>
)

// ─── Person Picker ────────────────────────────────────────

const PersonPicker: React.FC<{
  contacts: DirectoryContact[]
  selected: DirectoryContact | null
  onSelect: (c: DirectoryContact | null) => void
  label: string
  placeholder: string
}> = ({ contacts, selected, onSelect, label, placeholder }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = useMemo(() => contacts.filter(c => {
    if (!query) return true
    const t = query.toLowerCase()
    return (c.name || '').toLowerCase().includes(t) ||
           (c.company || '').toLowerCase().includes(t) ||
           (c.role || '').toLowerCase().includes(t) ||
           (c.trade || '').toLowerCase().includes(t)
  }), [contacts, query])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        display: 'block', fontSize: '11px', fontWeight: 600,
        color: colors.textTertiary, marginBottom: '6px',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </label>
      <button
        onClick={() => setOpen(!open)}
        type="button"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '10px 12px',
          backgroundColor: colors.white,
          border: `1.5px solid ${open ? colors.primaryOrange : colors.borderDefault}`,
          borderRadius: '10px',
          cursor: 'pointer', transition: 'all 0.15s',
          boxShadow: open ? `0 0 0 3px ${colors.primaryOrange}15` : 'none',
        }}
      >
        {selected ? (
          <>
            <Avatar initials={getInitials(selected.name || '')} size={28} />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: '14px', color: colors.textPrimary, fontWeight: 500, lineHeight: 1.2 }}>
                {selected.name}
              </div>
              <div style={{ fontSize: '11px', color: colors.textTertiary, lineHeight: 1.3, marginTop: 1 }}>
                {[selected.role, selected.company].filter(Boolean).join(' · ')}
                {selected.avg_rfi_response_days != null && (
                  <span style={{ color: '#16A34A' }}> · avg {selected.avg_rfi_response_days}d</span>
                )}
              </div>
            </div>
            <X size={14} style={{ color: colors.textTertiary, flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onSelect(null) }}
            />
          </>
        ) : (
          <>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: colors.surfaceInset, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Search size={12} style={{ color: colors.textTertiary }} />
            </div>
            <span style={{ flex: 1, textAlign: 'left', fontSize: '14px', color: colors.textTertiary }}>
              {placeholder}
            </span>
            <ChevronDown size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)',
              left: 0, right: 0, zIndex: 60,
              backgroundColor: colors.white,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: '10px',
              boxShadow: '0 12px 40px -8px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={13} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, company, or trade..."
                  style={{
                    flex: 1, border: 'none', outline: 'none',
                    fontSize: '13px', color: colors.textPrimary,
                    backgroundColor: 'transparent',
                  }}
                />
              </div>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: colors.textTertiary }}>
                  {query ? 'No matches' : 'No contacts in project directory'}
                </div>
              ) : (
                filtered.slice(0, 20).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onSelect(c); setOpen(false); setQuery('') }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '8px 14px',
                      border: 'none', background: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.08s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceInset)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Avatar initials={getInitials(c.name || '')} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 500 }}>
                        {c.name || 'Unnamed'}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[c.role, c.company, c.trade].filter(Boolean).join(' · ') || 'No details'}
                      </div>
                    </div>
                    {c.avg_rfi_response_days != null && (
                      <span style={{ fontSize: '10px', color: colors.textTertiary, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {c.avg_rfi_response_days}d
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Procore Tier S4 Fields Row ──────────────────────────
// Three-column row that mounts the new Procore-parity inputs (Cost Code,
// RFI Stage, Received From). All optional — the form submits with nulls
// when the user leaves them blank.

interface RFIProcoreFieldsRowProps {
  projectId: string | undefined
  costCode: string
  onCostCodeChange: (v: string) => void
  rfiStage: string
  onRfiStageChange: (v: string) => void
  receivedFromUserId: string
  onReceivedFromChange: (v: string) => void
  memberOptions: ReadonlyArray<{ value: string; label: string }>
}

const RFIProcoreFieldsRow: React.FC<RFIProcoreFieldsRowProps> = ({
  projectId,
  costCode,
  onCostCodeChange,
  rfiStage,
  onRfiStageChange,
  receivedFromUserId,
  onReceivedFromChange,
  memberOptions,
}) => {
  const { data: costCodeOptions = [] } = useProjectCostCodes(projectId)
  const { data: stageOptions = [] } = useProjectRFIStages(projectId)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 600,
            color: colors.textTertiary,
            marginBottom: '5px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Cost Code
        </label>
        <RFITypeAhead
          value={costCode}
          onChange={onCostCodeChange}
          options={costCodeOptions}
          placeholder="e.g. 03-30-00"
          ariaLabel="Cost code"
        />
      </div>
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 600,
            color: colors.textTertiary,
            marginBottom: '5px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          RFI Stage
        </label>
        <RFITypeAhead
          value={rfiStage}
          onChange={onRfiStageChange}
          options={stageOptions}
          placeholder="Construction"
          ariaLabel="RFI stage"
        />
      </div>
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: 600,
            color: colors.textTertiary,
            marginBottom: '5px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Received From
        </label>
        <select
          value={receivedFromUserId}
          onChange={(e) => onReceivedFromChange(e.target.value)}
          aria-label="Received from"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '13px',
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: '8px',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        >
          <option value="">— Select —</option>
          {memberOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Attachment Strip ─────────────────────────────────────

const AttachmentStrip: React.FC<{
  files: File[]
  onRemove: (i: number) => void
}> = ({ files, onRemove }) => {
  if (files.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {files.map((f, i) => {
        const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(f.name)
        return (
          <motion.div
            key={`${f.name}-${i}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'relative', width: 52, height: 52,
              borderRadius: '8px', overflow: 'hidden',
              border: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceInset,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isImage ? (
              <img src={URL.createObjectURL(f)} alt={f.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: '8px', color: colors.textTertiary, textAlign: 'center', padding: 4, wordBreak: 'break-all', lineHeight: 1.2 }}>
                {f.name.length > 14 ? f.name.slice(0, 12) + '…' : f.name}
              </div>
            )}
            <button type="button" onClick={() => onRemove(i)} style={{
              position: 'absolute', top: 2, right: 2, width: 16, height: 16,
              borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}>
              <X size={8} />
            </button>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

interface RFICreateWizardProps {
  open: boolean
  onClose: () => void
  /**
   * Persists the RFI and returns the new row's id so the wizard can
   * fan out per-entity inserts (rfi_assignees / rfi_distributions /
   * rfi_watchers) after creation. Returning void is allowed for
   * legacy callers but disables the multi-assignee fan-out.
   */
  onSubmit: (data: Record<string, unknown>) => Promise<{ id: string } | void> | { id: string } | void
  initialValues?: Record<string, unknown>
}

const RFICreateWizard: React.FC<RFICreateWizardProps> = ({ open, onClose, onSubmit }) => {
  const projectId = useProjectId()
  const { user } = useAuth()
  const { data: contacts = [] } = useRealtimeDirectoryContacts(projectId)
  const { data: existingRfis } = useRFIs(projectId)

  // Next RFI number
  const nextNumber = useMemo(() => {
    const count = existingRfis?.data?.length ?? 0
    return String(count + 1).padStart(3, '0')
  }, [existingRfis])

  // Auto-detect current user for "From"
  const [currentUserContact, setCurrentUserContact] = useState<DirectoryContact | null>(null)
  useEffect(() => {
    if (!open || !projectId) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user?.email) return
      const match = contacts.find(c =>
        c.email?.toLowerCase() === data.user!.email!.toLowerCase()
      )
      if (match) setCurrentUserContact(match)
    })
  }, [open, projectId, contacts])

  // Core fields
  const [question, setQuestion] = useState('')
  const [details, setDetails] = useState('')
  const [fromContact, setFromContact] = useState<DirectoryContact | null>(null)

  // PR #366 — multi-assignee + distribution + watchers on Create.
  // Closes the Tier S1 gap from RFI_CREATE_FLOW_PARITY_SPEC_2026-05-08.md:
  // Walker's "i still cant assign multiple people and check certain people
  // when creating an rfi" — replaces the previous single-select assignee
  // with three multi-chip editors (assignees, distribution, watchers) and
  // wires submit-time fan-out into rfi_assignees / rfi_distributions /
  // rfi_watchers (each fan-out hook is audit-aware).
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [distributionEmails, setDistributionEmails] = useState<string[]>([])
  const [watcherIds, setWatcherIds] = useState<string[]>([])
  const [showWatchers, setShowWatchers] = useState<boolean>(false)
  // Project directory for the chip editors. Members carry user_id values
  // (auth users); raw emails for distribution come from project_members
  // emails plus free-typed values via UserChipEditor.onFreeText.
  const { data: directory } = useProjectDirectory(projectId)
  const addAssignee = useAddRFIAssignee()
  const addDistribution = useAddRFIDistribution()
  const addWatcher = useAddRFIWatcher()
  // Default Distribution pre-fill from project_rfi_settings.default_distribution
  // (column added by PR #365). On first open we hydrate distributionEmails
  // from this list — but only if the user hasn't already started picking
  // (defensive against a late settings load racing the form).
  const [hasDistributionPrefilled, setHasDistributionPrefilled] = useState(false)
  useEffect(() => {
    if (!open || !projectId || hasDistributionPrefilled) return
    let cancelled = false
    void (async () => {
      const { data } = await fromTable('project_rfi_settings')
        .select('default_distribution')
        .eq('project_id' as never, projectId)
        .maybeSingle()
      if (cancelled || !data) return
      const dd = (data as { default_distribution?: unknown }).default_distribution
      if (Array.isArray(dd) && dd.length > 0 && distributionEmails.length === 0) {
        setDistributionEmails(dd.filter((x): x is string => typeof x === 'string'))
      }
      setHasDistributionPrefilled(true)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot prefill
  }, [open, projectId])

  // Reference fields
  const [specRef, setSpecRef] = useState('')
  const [drawingRef, setDrawingRef] = useState('')

  // Info-density wave PR #4 — Procore-parity Tier S4 fields. All optional
  // text-or-uuid; the schema columns are nullable so empty submits are
  // a no-op (matches the legacy behavior).
  const [costCode, setCostCode] = useState('')
  const [rfiStage, setRfiStage] = useState('')
  const [receivedFromUserId, setReceivedFromUserId] = useState<string>('')

  // PR #367 — Schedule + Cost impact wrappers (Yes/No/TBD) + Private flag.
  // Schema columns already exist: cost_impact_status / schedule_impact_status
  // (PR #350), cost_impact_cents / schedule_days_impact (legacy),
  // is_private (legacy). Closes Tier S2 items 7, 8, 9 from
  // RFI_CREATE_FLOW_PARITY_SPEC_2026-05-08.md.
  const [scheduleImpactStatus, setScheduleImpactStatus] = useState<'' | 'yes' | 'no' | 'tbd'>('')
  const [scheduleDays, setScheduleDays] = useState<string>('')
  const [costImpactStatus, setCostImpactStatus] = useState<'' | 'yes' | 'no' | 'tbd'>('')
  const [costImpactDollars, setCostImpactDollars] = useState<string>('')
  const [isPrivate, setIsPrivate] = useState<boolean>(false)

  // Extras
  const [files, setFiles] = useState<File[]>([])
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [_showMore, setShowMore] = useState(false)

  const [sending, setSending] = useState(false)
  // PR #4 wedge — track which save path the user picked so the
  // success-state UI can reflect "saved as draft" vs "opened".
  const [savingMode, setSavingMode] = useState<'draft' | 'open' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)

  // ── PR #4 wedge — Iris-on-Create ──────────────────────────────────────
  // The May-7 audit's call-out: "Hold the FAB, speak 30 seconds, watch
  // every field fill in." We just deployed ai-rfi-draft-v2 to live; this
  // wires the existing useCreateIrisRFIDraftV2 hook to a button right by
  // the question input. User types a one-liner, clicks Iris, the 7-pass
  // pipeline returns prefilled fields with confidence + citations. User
  // accepts/edits/rejects each before save.
  const [irisDraftId, setIrisDraftId] = useState<string | null>(null)
  const createIrisDraft = useCreateIrisRFIDraftV2()
  const { data: irisDraft } = useIrisRFIDraftV2(irisDraftId)
  const [irisFilledFields, setIrisFilledFields] = useState<Set<string>>(new Set())

  const runIrisDraft = useCallback(async () => {
    if (!projectId || !question.trim() || createIrisDraft.isPending) return
    try {
      const { draftId } = await createIrisDraft.mutateAsync({
        projectId,
        description: question.trim(),
      })
      setIrisDraftId(draftId)
    } catch (err) {
      // surfaced via createIrisDraft.error; toast in parent layer.
      console.error('[iris-draft] create failed', err)
    }
  }, [projectId, question, createIrisDraft])

  // Auto-fill the form once the draft row is available. Only writes to
  // empty fields — never overwrites what the user already typed.
  useEffect(() => {
    if (!irisDraft) return
    const filled = new Set<string>()
    if (irisDraft.suggested_body && !details) {
      setDetails(irisDraft.suggested_body)
      filled.add('details')
    }
    if (irisDraft.suggested_priority && priority === 'medium') {
      setPriority(irisDraft.suggested_priority)
      filled.add('priority')
    }
    if (irisDraft.suggested_due_date && dueDate === defaultDueDate()) {
      setDueDate(irisDraft.suggested_due_date)
      filled.add('dueDate')
    }
    if (irisDraft.suggested_spec_sections.length > 0 && !specRef) {
      setSpecRef(irisDraft.suggested_spec_sections[0])
      filled.add('specRef')
    }
    if (filled.size > 0) setIrisFilledFields(filled)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
    // one-shot fill on draft arrival; we don't re-fill if the user edits.
  }, [irisDraft])

  // Auto-fill "from" when user detected
  useEffect(() => {
    if (currentUserContact && !fromContact) {
      setFromContact(currentUserContact)
    }
  }, [currentUserContact, fromContact])

  useEffect(() => {
    if (open) {
      setTimeout(() => questionRef.current?.focus(), 120)
    } else {
      // Reset all state
      setQuestion(''); setDetails(''); setFromContact(null)
      setAssigneeIds([]); setDistributionEmails([]); setWatcherIds([]); setShowWatchers(false)
      setHasDistributionPrefilled(false)
      setSpecRef(''); setDrawingRef('')
      setFiles([]); setPriority('medium'); setDueDate(defaultDueDate())
      setScheduleImpactStatus(''); setScheduleDays('')
      setCostImpactStatus(''); setCostImpactDollars(''); setIsPrivate(false)
      setSending(false); setShowMore(false)
      setSavingMode(null); setIrisDraftId(null); setIrisFilledFields(new Set())
    }
  }, [open])

  const canSend = question.trim().length >= 5

  // Duplicate detection
  const possibleDuplicate = useMemo(() => {
    if (question.trim().length < 10) return null
    const q = question.toLowerCase().trim()
    const match = existingRfis?.data?.find(r =>
      r.title && (
        r.title.toLowerCase().includes(q.slice(0, 30)) ||
        q.includes(r.title.toLowerCase().slice(0, 30))
      )
    )
    return match ? match.title : null
  }, [question, existingRfis])

  const handleSend = useCallback(async (mode: 'draft' | 'open' = 'open') => {
    if (!canSend || sending || !projectId) return
    setSending(true)
    setSavingMode(mode)
    try {
      const refParts = [specRef, drawingRef].filter(Boolean)
      const fullDescription = [
        details.trim(),
        refParts.length > 0 ? `\n\nReferences: ${refParts.join(', ')}` : '',
      ].filter(Boolean).join('')

      // PR #366 — primary assignee mirror. The first picked assignee
      // populates the legacy `assigned_to` column (uuid FK to auth.users)
      // so existing list views + ball_in_court trigger keep working.
      // Additional assignees land as rfi_assignees rows via fan-out below.
      const primaryAssigneeId = assigneeIds[0] ?? null
      const submitResult = await onSubmit({
        title: question.trim(),
        description: fullDescription || question.trim(),
        // P1b: when the user formatted the body in TipTap, persist the HTML
        // into the rich `question` column. Plain-text duplication into
        // `description` keeps backward compatibility for read paths still
        // looking at the legacy field.
        question: details.trim() ? details : null,
        assigned_to: primaryAssigneeId,
        // ball_in_court omitted — DB trigger handles it from created_by/assigned_to
        created_by: user?.id || null, // auth user UUID
        // PR #4 (C1): two-button save. 'draft' writes Procore-equivalent
        // pre-publish state — Number + Due are suggestions until a PM
        // promotes to Open via the detail-page state-machine action.
        status: mode === 'draft' ? 'draft' : 'open',
        priority,
        due_date: dueDate || null,
        response_due_date: dueDate || null,
        project_id: projectId,
        spec_section: specRef || null,
        drawing_reference: drawingRef || null,
        // Info-density PR #4 — Procore-parity Tier S4 backfill. All
        // nullable; only the picked values flow through. `location_id`
        // and `responsible_contractor_id` deferred — both need their
        // own typed lookup table that doesn't exist yet.
        cost_code: costCode.trim() || null,
        rfi_stage: rfiStage.trim() || null,
        received_from_user_id: receivedFromUserId || null,
        // PR #367 — Schedule + Cost impact + Private. Submit even when
        // empty so the row's columns reflect the user's explicit '—' or
        // null choice rather than an inherited stale value.
        schedule_impact_status: scheduleImpactStatus || null,
        schedule_days_impact:
          scheduleImpactStatus === 'yes' && scheduleDays.trim()
            ? Number.parseInt(scheduleDays, 10)
            : null,
        cost_impact_status: costImpactStatus || null,
        cost_impact_cents:
          costImpactStatus === 'yes' && costImpactDollars.trim()
            ? Math.round(Number.parseFloat(costImpactDollars) * 100)
            : null,
        is_private: isPrivate,
      })

      // PR #366 fan-out — after the RFI insert succeeds, write per-entity
      // rows for assignees / distribution / watchers. Each hook is audit-
      // aware (logs its own audit_log row per Chain Audit Prep Check 5).
      // Failures here surface as warnings but don't block the create —
      // the RFI exists and the user can re-add via the Edit panel.
      const newRfiId = (submitResult as { id?: string } | undefined)?.id ?? null
      if (newRfiId) {
        const fanOuts: Array<Promise<unknown>> = []
        for (const userId of assigneeIds) {
          fanOuts.push(
            addAssignee.mutateAsync({
              rfiId: newRfiId,
              projectId,
              userId,
              role: 'assignee',
            }),
          )
        }
        for (const email of distributionEmails) {
          // Distribution rows track recipient_email; recipient_name is
          // a best-effort lookup from the directory.
          const member = (directory?.members ?? []).find((m) => m.sublabel === email)
          fanOuts.push(
            addDistribution.mutateAsync({
              rfiId: newRfiId,
              projectId,
              recipient_email: email,
              recipient_name: member?.label ?? null,
              message: null,
            }),
          )
        }
        for (const userId of watcherIds) {
          fanOuts.push(
            addWatcher.mutateAsync({ rfiId: newRfiId, userId, projectId }),
          )
        }
        if (fanOuts.length > 0) {
          const results = await Promise.allSettled(fanOuts)
          const failed = results.filter((r) => r.status === 'rejected').length
          if (failed > 0) {
            console.warn(`[rfi-create] ${failed} fan-out write(s) failed; user can re-add via Edit panel`)
          }
        }
      }

      onClose()
    } catch {
      // handled by mutation layer
    } finally {
      setSending(false)
      setSavingMode(null)
    }
  }, [canSend, sending, question, details, user, priority, dueDate, projectId, specRef, drawingRef, onSubmit, onClose, assigneeIds, distributionEmails, watcherIds, directory, addAssignee, addDistribution, addWatcher, scheduleImpactStatus, scheduleDays, costImpactStatus, costImpactDollars, isPrivate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
      e.preventDefault()
      // Cmd+Enter defaults to Open (the prior behavior); shift modifier
      // saves as Draft instead. Discoverable via the button labels below.
      handleSend(e.shiftKey ? 'draft' : 'open')
    }
  }, [canSend, handleSend])

  if (!open) return null

  const dueDays = daysFromNow(dueDate)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: zIndex.modal as number,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        style={{
          position: 'relative', width: '100%', maxWidth: 580,
          maxHeight: '88vh', overflow: 'auto',
          backgroundColor: colors.surfaceRaised,
          borderRadius: '20px', boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.textPrimary }}>
              New RFI
            </h2>
            <span style={{ fontSize: '13px', color: colors.textTertiary, fontWeight: 500 }}>
              #{nextNumber}
            </span>
          </div>
          <button onClick={onClose} type="button" aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textTertiary, padding: 6, borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceInset)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* PR #4.5 (C2) — Draft RFI explainer banner. Matches Procore's
            footer copy: makes the Draft semantic explicit so PMs don't
            commit to a Number / Due Date until they're ready to publish. */}
        <div
          style={{
            margin: '0 24px 12px',
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${colors.borderSubtle}`,
            backgroundColor: colors.surfaceInset,
            fontSize: 11,
            color: colors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: colors.textPrimary }}>Save as Draft</strong> to refine
          later — Number and Due Date are suggested values until you{' '}
          <strong style={{ color: colors.textPrimary }}>Create as Open</strong> (or promote
          via the detail-page state-machine).
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Question — the star of the show */}
          <div>
            <textarea
              ref={questionRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What needs to be clarified?"
              rows={2}
              aria-label="RFI question"
              style={{
                width: '100%', padding: '12px 0',
                fontSize: '18px', fontWeight: 600,
                color: colors.textPrimary, lineHeight: 1.4,
                border: 'none', borderBottom: `2px solid ${question ? colors.primaryOrange : colors.borderSubtle}`,
                outline: 'none', backgroundColor: 'transparent',
                transition: 'border-color 0.2s', boxSizing: 'border-box',
                resize: 'none', fontFamily: 'inherit',
                overflow: 'hidden',
              }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
            />
            {question.length > 0 && question.trim().length < 5 && (
              <div style={{ fontSize: '11px', color: colors.statusCritical, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} /> Be specific — a clear question gets a faster answer
              </div>
            )}

            {/* PR #4 wedge — Iris-on-Create. The May-7 audit's demo
                moment: type a one-liner, click Iris, watch every field
                fill in with confidence + citations. ai-rfi-draft-v2 was
                deployed to live in this wave; this wires the existing
                useCreateIrisRFIDraftV2 hook into the create form. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => void runIrisDraft()}
                disabled={!question.trim() || createIrisDraft.isPending}
                aria-label="Have Iris fill in the rest of this RFI"
                title="Iris reads the question, drawings, and spec book to suggest details, due date, priority, and references."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${colors.primaryOrange}`,
                  backgroundColor: createIrisDraft.isPending ? colors.orangeSubtle : 'transparent',
                  color: colors.primaryOrange,
                  fontSize: 12, fontWeight: 600,
                  cursor: question.trim() && !createIrisDraft.isPending ? 'pointer' : 'not-allowed',
                  opacity: question.trim() ? 1 : 0.5,
                  transition: 'all 0.12s',
                }}
              >
                {createIrisDraft.isPending ? (
                  <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Iris is thinking…</>
                ) : (
                  <><Sparkles size={12} /> Iris draft</>
                )}
              </button>
              {irisDraft && irisFilledFields.size > 0 && (
                <span style={{ fontSize: 11, color: colors.primaryOrange, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={11} /> Iris filled {irisFilledFields.size} field{irisFilledFields.size === 1 ? '' : 's'}
                  {irisDraft.confidence_band ? ` · ${irisDraft.confidence_band} confidence` : ''}
                </span>
              )}
              {createIrisDraft.error && (
                <span style={{ fontSize: 11, color: colors.statusCritical, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> Iris couldn't draft. You can still write it manually.
                </span>
              )}
            </div>
            {possibleDuplicate && (
              <div style={{ fontSize: '11px', color: '#D97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
                <AlertCircle size={11} /> Similar RFI exists: "{possibleDuplicate.slice(0, 60)}"
              </div>
            )}
          </div>

          {/* Details — rich text per RFI P1b spec deliverable #1.
              Persists into `question TEXT` (HTML/Markdown). The DB-side
              column was added in P1a so the wire-up here doesn't need a
              fresh migration. */}
          <div>
            <RFIRichTextEditor
              value={details}
              onChange={setDetails}
              placeholder="Add background, context, or what you've already checked… (optional)"
              ariaLabel="Details"
              minHeight={120}
            />
          </div>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {contacts.length > 0 ? (
              <PersonPicker
                contacts={contacts}
                selected={fromContact}
                onSelect={setFromContact}
                label="From"
                placeholder="Your name"
              />
            ) : (
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  color: colors.textTertiary, marginBottom: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  From
                </label>
                <input
                  value={fromContact?.name || ''}
                  onChange={(e) => setFromContact(e.target.value ? { id: 'manual', name: e.target.value } as DirectoryContact : null)}
                  placeholder="Your name"
                  style={{
                    width: '100%', padding: '10px 12px',
                    fontSize: '14px', color: colors.textPrimary,
                    border: `1.5px solid ${colors.borderDefault}`,
                    borderRadius: '10px', outline: 'none',
                    backgroundColor: 'transparent', boxSizing: 'border-box',
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderDefault)}
                />
              </div>
            )}
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: 600,
                color: colors.textTertiary, marginBottom: '6px',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                To (assignees) <span style={{ color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 }}>· each gets a "Response Required" indicator on detail</span>
              </label>
              <UserChipEditor
                value={assigneeIds}
                onChange={setAssigneeIds}
                options={(directory?.members ?? []).map((m) => ({
                  value: m.value,
                  label: m.label,
                  sublabel: m.sublabel,
                }))}
                placeholder="Pick one or more answerers…"
                ariaLabel="RFI assignees"
                emptyText="No assignees yet"
              />
            </div>
          </div>

          {/* PR #366 — Distribution chip editor. Pre-fills from
              project_rfi_settings.default_distribution (PR #365). Free-typed
              emails accepted via UserChipEditor.onFreeText. */}
          <div>
            <label style={{
              display: 'block', fontSize: '11px', fontWeight: 600,
              color: colors.textTertiary, marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Distribution <span style={{ color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 }}>· cc'd on send; can be project members or free-typed emails</span>
            </label>
            <UserChipEditor
              value={distributionEmails}
              onChange={setDistributionEmails}
              options={(directory?.members ?? [])
                .filter((m) => m.sublabel)
                .map((m) => ({ value: m.sublabel!, label: m.label, sublabel: m.sublabel }))}
              placeholder="Add an email or pick a member…"
              ariaLabel="RFI distribution recipients"
              emptyText="No recipients"
              onFreeText={(raw) => {
                // Bare email validation; reject obvious garbage so the
                // chip + outbound email don't both fail downstream.
                const trimmed = raw.trim()
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
                return { value: trimmed, label: trimmed, sublabel: trimmed }
              }}
            />
          </div>

          {/* PR #366 — Watchers (collapsed by default — secondary feature). */}
          <div>
            {!showWatchers && watcherIds.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowWatchers(true)}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 500, color: colors.primaryOrange,
                  cursor: 'pointer', padding: 0,
                }}
              >
                + Add watchers
              </button>
            ) : (
              <>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  color: colors.textTertiary, marginBottom: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Watchers <span style={{ color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 }}>· receive every status change</span>
                </label>
                <UserChipEditor
                  value={watcherIds}
                  onChange={setWatcherIds}
                  options={(directory?.members ?? []).map((m) => ({
                    value: m.value,
                    label: m.label,
                    sublabel: m.sublabel,
                  }))}
                  placeholder="Pick watchers…"
                  ariaLabel="RFI watchers"
                  emptyText="No watchers"
                />
              </>
            )}
          </div>

          {/* PR #367 — Schedule + Cost Impact pair (Yes/No/TBD + value).
              Procore parity: explicit enum wraps the value cell so 'No'
              and 'TBD' are first-class answers (not just an empty value).
              Schema cols: schedule_impact_status / schedule_days_impact /
              cost_impact_status / cost_impact_cents. */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px', minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Schedule Impact
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={scheduleImpactStatus}
                  onChange={(e) => setScheduleImpactStatus(e.target.value as '' | 'yes' | 'no' | 'tbd')}
                  aria-label="Schedule impact status"
                  style={{
                    flex: '0 0 90px', padding: '8px 10px', fontSize: 12,
                    border: `1px solid ${colors.borderDefault}`, borderRadius: 8,
                    backgroundColor: colors.surfaceInset, color: colors.textPrimary,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="tbd">TBD</option>
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={scheduleDays}
                  onChange={(e) => setScheduleDays(e.target.value)}
                  placeholder="days"
                  disabled={scheduleImpactStatus !== 'yes'}
                  aria-label="Schedule impact days"
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12,
                    border: `1px solid ${colors.borderDefault}`, borderRadius: 8,
                    backgroundColor: scheduleImpactStatus === 'yes' ? colors.surfaceInset : 'transparent',
                    color: colors.textPrimary, fontFamily: 'inherit',
                    opacity: scheduleImpactStatus === 'yes' ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cost Impact
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={costImpactStatus}
                  onChange={(e) => setCostImpactStatus(e.target.value as '' | 'yes' | 'no' | 'tbd')}
                  aria-label="Cost impact status"
                  style={{
                    flex: '0 0 90px', padding: '8px 10px', fontSize: 12,
                    border: `1px solid ${colors.borderDefault}`, borderRadius: 8,
                    backgroundColor: colors.surfaceInset, color: colors.textPrimary,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="tbd">TBD</option>
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={costImpactDollars}
                  onChange={(e) => setCostImpactDollars(e.target.value)}
                  placeholder="0.00"
                  disabled={costImpactStatus !== 'yes'}
                  aria-label="Cost impact dollars"
                  style={{
                    flex: 1, padding: '8px 10px', fontSize: 12,
                    border: `1px solid ${colors.borderDefault}`, borderRadius: 8,
                    backgroundColor: costImpactStatus === 'yes' ? colors.surfaceInset : 'transparent',
                    color: colors.textPrimary, fontFamily: 'inherit',
                    opacity: costImpactStatus === 'yes' ? 1 : 0.5,
                  }}
                />
              </div>
            </div>
          </div>

          {/* PR #367 — Private toggle. Default off; admin Settings can flip
              the project default (rfi_settings.private_by_default — future). */}
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: colors.textSecondary, cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: colors.primaryOrange, cursor: 'pointer' }}
            />
            <span>
              <strong style={{ color: colors.textPrimary }}>Private</strong>: only PMs and admins can read this RFI
            </span>
          </label>

          {/* References + Priority + Due — compact row */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Spec reference */}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Spec Section
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', backgroundColor: colors.surfaceInset, borderRadius: '8px', border: `1px solid transparent`, transition: 'border-color 0.15s' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <BookOpen size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                <input
                  value={specRef}
                  onChange={(e) => setSpecRef(e.target.value)}
                  placeholder="e.g. 03 30 00"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12px', color: colors.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            {/* Drawing reference */}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Drawing Ref
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', backgroundColor: colors.surfaceInset, borderRadius: '8px', border: `1px solid transparent`, transition: 'border-color 0.15s' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <FileText size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                <input
                  value={drawingRef}
                  onChange={(e) => setDrawingRef(e.target.value)}
                  placeholder="e.g. A-201"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12px', color: colors.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
                />
              </div>
            </div>
            {/* Due date compact */}
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Due
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', backgroundColor: colors.surfaceInset, borderRadius: '8px' }}>
                <Calendar size={12} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '12px', color: colors.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }}
                />
                <span style={{ fontSize: '10px', color: dueDays <= 3 ? '#DC2626' : colors.textTertiary, flexShrink: 0 }}>
                  {dueDays}d
                </span>
              </div>
            </div>
          </div>

          {/* Info-density PR #4 — Procore-parity Tier S4 fields. Three
              optional inputs that close the parity gap; admins can leave
              them blank without changing existing flow. */}
          <RFIProcoreFieldsRow
            projectId={projectId}
            costCode={costCode}
            onCostCodeChange={setCostCode}
            rfiStage={rfiStage}
            onRfiStageChange={setRfiStage}
            receivedFromUserId={receivedFromUserId}
            onReceivedFromChange={setReceivedFromUserId}
            memberOptions={(directory?.members ?? []).map((m) => ({
              value: m.value,
              label: m.label,
            }))}
          />

          {/* Priority */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: colors.textTertiary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Priority
            </label>
            <PriorityPicker value={priority} onChange={setPriority} />
          </div>

          {/* Attachments */}
          <AttachmentStrip files={files} onRemove={(i) => setFiles(f => f.filter((_, j) => j !== i))} />

          <input
            ref={fileInputRef}
            type="file" multiple
            accept="image/*,.pdf,.doc,.docx,.dwg,.dxf,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
              if (fileInputRef.current) fileInputRef.current.value = ''
            }}
          />
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 24px', marginTop: '12px',
          borderTop: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.surfaceInset,
          borderRadius: '0 0 20px 20px',
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              aria-label="Attach photo"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '8px',
                border: `1px solid ${colors.borderSubtle}`, backgroundColor: 'transparent',
                cursor: 'pointer', fontSize: '12px', color: colors.textSecondary,
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; e.currentTarget.style.color = colors.primaryOrange }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.color = colors.textSecondary }}
            >
              <Camera size={13} /> Photo
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '8px',
                border: `1px solid ${colors.borderSubtle}`, backgroundColor: 'transparent',
                cursor: 'pointer', fontSize: '12px', color: colors.textSecondary,
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; e.currentTarget.style.color = colors.primaryOrange }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.color = colors.textSecondary }}
            >
              <Paperclip size={13} /> File
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* PR #367 — required-fields legend (D3 equivalent on Create).
                Subject's question textarea is the only currently-required
                field; the legend ties the implicit canSend gate to its
                meaning explicitly. */}
            <span style={{ fontSize: 10, color: colors.textTertiary, marginRight: 'auto' }}>
              <span style={{ color: '#DC2626', fontWeight: 700 }}>*</span> Question is required
            </span>
            <span style={{ fontSize: '11px', color: colors.textTertiary, marginRight: 4 }}>
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+↵
            </span>
            {/* PR #4 (C1) — two-button save. Procore parity: explicit Draft
                vs Open path. Cmd+Enter defaults to Open; Cmd+Shift+Enter
                writes Draft. */}
            <button
              type="button"
              onClick={() => handleSend('draft')}
              disabled={!canSend || sending}
              title="Save as Draft. Number + Due Date are suggestions until promoted to Open."
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '10px',
                border: `1px solid ${canSend && !sending ? colors.borderSubtle : '#E5E7EB'}`,
                backgroundColor: 'transparent',
                color: canSend && !sending ? colors.textSecondary : '#9CA3AF',
                fontSize: '13px', fontWeight: 500,
                cursor: canSend && !sending ? 'pointer' : 'not-allowed',
                transition: 'all 0.12s',
              }}
            >
              {sending && savingMode === 'draft' ? (
                <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving draft</>
              ) : (
                <>Save as Draft</>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSend('open')}
              disabled={!canSend || sending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 22px', borderRadius: '10px', border: 'none',
                backgroundColor: canSend && !sending ? colors.primaryOrange : '#E5E7EB',
                color: canSend && !sending ? '#fff' : '#9CA3AF',
                fontSize: '14px', fontWeight: 600,
                cursor: canSend && !sending ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                boxShadow: canSend && !sending ? '0 2px 8px rgba(244,120,32,0.3)' : 'none',
              }}
            >
              {sending && savingMode === 'open' ? (
                <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
              ) : (
                <><Send size={14} /> Create as Open</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default RFICreateWizard
