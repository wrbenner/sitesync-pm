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
  Clock, AlertCircle, Calendar, BookOpen, FileText
} from 'lucide-react'
import { colors, zIndex } from '../../styles/theme'
import { Avatar } from '../Primitives'
import { useRealtimeDirectoryContacts } from '../../hooks/queries/realtime'
import { useProjectId } from '../../hooks/useProjectId'
import { useAuth } from '../../hooks/useAuth'
import { useRFIs } from '../../hooks/queries'
import { supabase } from '../../lib/supabase'
import type { DirectoryContact } from '../../types/database'

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

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
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
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
  const [assignee, setAssignee] = useState<DirectoryContact | null>(null)
  const [manualAssignee, setManualAssignee] = useState('')
  const [fromContact, setFromContact] = useState<DirectoryContact | null>(null)

  // Reference fields
  const [specRef, setSpecRef] = useState('')
  const [drawingRef, setDrawingRef] = useState('')

  // Extras
  const [files, setFiles] = useState<File[]>([])
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState(defaultDueDate())
  const [_showMore, setShowMore] = useState(false)

  const [sending, setSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const questionRef = useRef<HTMLTextAreaElement>(null)

  // Auto-fill "from" when user detected
  useEffect(() => {
    if (currentUserContact && !fromContact) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
      setFromContact(currentUserContact)
    }
  }, [currentUserContact, fromContact])

  useEffect(() => {
    if (open) {
      setTimeout(() => questionRef.current?.focus(), 120)
    } else {
      // Reset all state
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
      setQuestion(''); setDetails(''); setAssignee(null); setManualAssignee(''); setFromContact(null)
      setSpecRef(''); setDrawingRef('')
      setFiles([]); setPriority('medium'); setDueDate(defaultDueDate())
      setSending(false); setShowMore(false)
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

  const handleSend = useCallback(async () => {
    if (!canSend || sending) return
    setSending(true)
    try {
      const refParts = [specRef, drawingRef].filter(Boolean)
      const fullDescription = [
        details.trim(),
        refParts.length > 0 ? `\n\nReferences: ${refParts.join(', ')}` : '',
      ].filter(Boolean).join('')

      const assigneeName = assignee?.name || manualAssignee.trim()
      // DB columns created_by, assigned_to, ball_in_court are uuid REFERENCES auth.users.
      // Directory contacts aren't auth users, so we store their names in the
      // description and leave the uuid columns null (or set to the auth user).
      // The DB trigger auto_number_rfi() sets ball_in_court based on status.
      const descWithAssignee = assigneeName
        ? `${fullDescription || question.trim()}\n\nAssigned to: ${assigneeName}${assignee?.company ? ` (${assignee.company})` : ''}`
        : fullDescription || question.trim()
      await onSubmit({
        title: question.trim(),
        description: descWithAssignee,
        assigned_to: null,          // uuid FK — directory contacts aren't auth users
        // ball_in_court omitted — DB trigger handles it from created_by/assigned_to
        created_by: user?.id || null, // auth user UUID
        status: 'open',
        priority,
        due_date: dueDate || null,
        response_due_date: dueDate || null,
        project_id: projectId,
        spec_section: specRef || null,
        drawing_reference: drawingRef || null,
      })
      onClose()
    } catch {
      // handled by mutation layer
    } finally {
      setSending(false)
    }
  }, [canSend, sending, question, details, assignee, manualAssignee, user, priority, dueDate, projectId, specRef, drawingRef, onSubmit, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
      e.preventDefault()
      handleSend()
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
            {possibleDuplicate && (
              <div style={{ fontSize: '11px', color: '#D97706', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
                <AlertCircle size={11} /> Similar RFI exists: "{possibleDuplicate.slice(0, 60)}"
              </div>
            )}
          </div>

          {/* Details — expandable context area */}
          <div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add background, context, or what you've already checked... (optional)"
              rows={2}
              style={{
                width: '100%', padding: '10px 12px',
                fontSize: '13px', color: colors.textPrimary,
                backgroundColor: colors.surfaceInset, border: `1.5px solid transparent`,
                borderRadius: '10px', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', minHeight: 56, boxSizing: 'border-box',
                lineHeight: 1.6, transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
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
            {contacts.length > 0 ? (
              <PersonPicker
                contacts={contacts}
                selected={assignee}
                onSelect={setAssignee}
                label="To (answerer)"
                placeholder="Select person..."
              />
            ) : (
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  color: colors.textTertiary, marginBottom: '6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  To (answerer)
                </label>
                <input
                  value={manualAssignee}
                  onChange={(e) => setManualAssignee(e.target.value)}
                  placeholder="Name or company"
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
          </div>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: colors.textTertiary }}>
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+↵
            </span>
            <button type="button" onClick={handleSend} disabled={!canSend || sending}
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
              {sending ? (
                <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
              ) : (
                <><Send size={14} /> Send RFI</>
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
