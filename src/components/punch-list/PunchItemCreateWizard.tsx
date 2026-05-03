/**
 * Punch Item Creation — Photo-first, field-ready.
 *
 * The insight: a punch item IS a photo of a deficiency. Start there.
 * Snap a photo or drop one. We capture location, trade, and assignee
 * with minimal taps. Built for a superintendent walking a jobsite.
 *
 * 1. Take/drop photo → the hero of every punch item
 * 2. Quick title, location pin (floor + area), trade & assignee
 * 3. Priority pills, progressive disclosure for dates
 * 4. One tap to create. Cmd+Enter for power users.
 *
 * No wizard steps. No 14-field form. Just: "here's the deficiency, fix it."
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, X, Plus, MapPin, Wrench, User, AlertTriangle,
  Send, Image, ChevronDown, Calendar, Zap, Shield
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { Avatar } from '../Primitives'
import { useRealtimeDirectoryContacts } from '../../hooks/queries/realtime'
import type { DirectoryContact } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────

interface PhotoFile {
  id: string
  file: File
  name: string
  size: number
  preview: string
}

interface PunchItemCreateWizardProps {
  projectId: string
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Priority Picker ─────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'critical'

const PRIORITIES: Array<{ value: Priority; label: string; color: string; bg: string; icon: typeof Zap }> = [
  { value: 'low', label: 'Low', color: colors.statusInfo, bg: colors.statusInfoSubtle, icon: Shield },
  { value: 'medium', label: 'Medium', color: colors.statusPending, bg: colors.statusPendingSubtle, icon: AlertTriangle },
  { value: 'high', label: 'High', color: colors.primaryOrange, bg: colors.orangeSubtle, icon: Zap },
  { value: 'critical', label: 'Critical', color: colors.statusCritical, bg: colors.statusCriticalSubtle, icon: AlertTriangle },
]

const PriorityPicker: React.FC<{
  value: Priority
  onChange: (p: Priority) => void
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {PRIORITIES.map(p => {
      const Icon = p.icon
      const active = value === p.value
      return (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: borderRadius.full,
            border: `1.5px solid ${active ? p.color : colors.borderSubtle}`,
            backgroundColor: active ? p.bg : 'transparent',
            color: active ? p.color : colors.textSecondary,
            fontSize: '12px', fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <Icon size={11} />
          {p.label}
        </button>
      )
    })}
  </div>
)

// ─── Trade Picker ────────────────────────────────────────

const TRADES = [
  'Structural', 'Mechanical', 'Electrical', 'Plumbing',
  'Fire Protection', 'Finishing', 'General', 'Roofing',
  'Glazing', 'Painting', 'Drywall', 'Flooring',
]

const TradePicker: React.FC<{
  value: string
  onChange: (t: string) => void
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', marginBottom: 4,
      }}>
        <Wrench size={10} /> Trade
      </label>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '6px 10px',
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.md,
          backgroundColor: 'transparent', cursor: 'pointer',
          fontSize: typography.fontSize.caption, color: value ? colors.textPrimary : colors.textTertiary,
          textAlign: 'left' as const,
        }}
      >
        {value || 'Select trade...'}
        <ChevronDown size={12} style={{ color: colors.textTertiary }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: 4, maxHeight: 200, overflowY: 'auto',
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, boxShadow: shadows.lg,
            }}
          >
            {TRADES.map(t => (
              <div key={t}
                onClick={() => { onChange(t); setOpen(false) }}
                style={{
                  padding: '7px 12px', cursor: 'pointer',
                  fontSize: typography.fontSize.caption,
                  color: t === value ? colors.primaryOrange : colors.textPrimary,
                  fontWeight: t === value ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {t}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Floor Picker ────────────────────────────────────────

const FLOORS = [
  'Basement', 'Lobby', 'Floor 1', 'Floor 2', 'Floor 3', 'Floor 4',
  'Floor 5', 'Floor 6', 'Floor 7', 'Floor 8', 'Floor 9', 'Floor 10',
  'Roof', 'Parking', 'Exterior',
]

const FloorPicker: React.FC<{
  value: string
  onChange: (f: string) => void
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', marginBottom: 4,
      }}>
        Floor
      </label>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '6px 10px',
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.md,
          backgroundColor: 'transparent', cursor: 'pointer',
          fontSize: typography.fontSize.caption, color: value ? colors.textPrimary : colors.textTertiary,
          textAlign: 'left' as const,
        }}
      >
        {value || 'Select...'}
        <ChevronDown size={12} style={{ color: colors.textTertiary }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: 4, maxHeight: 200, overflowY: 'auto',
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, boxShadow: shadows.lg,
            }}
          >
            {FLOORS.map(f => (
              <div key={f}
                onClick={() => { onChange(f); setOpen(false) }}
                style={{
                  padding: '7px 12px', cursor: 'pointer',
                  fontSize: typography.fontSize.caption,
                  color: f === value ? colors.primaryOrange : colors.textPrimary,
                  fontWeight: f === value ? typography.fontWeight.semibold : typography.fontWeight.normal,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {f}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Person Picker ───────────────────────────────────────

const PersonPicker: React.FC<{
  label: string
  icon: typeof User
  projectId: string
  value: DirectoryContact | null
  onChange: (c: DirectoryContact | null) => void
  placeholder?: string
}> = ({ label, icon: LabelIcon, projectId, value, onChange, placeholder = 'Select...' }) => {
  const { data: contacts = [] } = useRealtimeDirectoryContacts(projectId)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = contacts.filter(c => {
    if (value && c.id === value.id) return false
    const term = search.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.company || '').toLowerCase().includes(term) ||
      (c.trade || '').toLowerCase().includes(term)
    )
  })

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', marginBottom: 4,
      }}>
        <LabelIcon size={10} /> {label}
      </label>
      {value ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm,
          padding: '6px 10px', borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset,
          border: `1px solid ${colors.borderSubtle}`,
        }}>
          <Avatar initials={getInitials(value.name || '')} size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
              {value.name}
            </span>
            {value.company && (
              <span style={{ fontSize: '11px', color: colors.textTertiary, marginLeft: 6 }}>
                {value.company}
              </span>
            )}
          </div>
          <button onClick={() => onChange(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: colors.textTertiary, padding: 2,
          }}>
            <X size={12} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            padding: '6px 10px', borderRadius: borderRadius.md,
            border: `1px solid ${colors.borderSubtle}`,
            cursor: 'pointer', transition: 'border-color 0.15s',
          }}
        >
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: typography.fontSize.caption, color: colors.textPrimary,
              backgroundColor: 'transparent',
            }}
          />
        </div>
      )}

      <AnimatePresence>
        {open && filtered.length > 0 && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: 4, maxHeight: 180, overflowY: 'auto',
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, boxShadow: shadows.lg,
            }}
          >
            {filtered.slice(0, 8).map(c => (
              <div key={c.id}
                onClick={() => { onChange(c); setSearch(''); setOpen(false) }}
                style={{
                  padding: '8px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: spacing.sm,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Avatar initials={getInitials(c.name || 'U')} size={22} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textPrimary }}>
                    {c.name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '10px', color: colors.textTertiary }}>
                    {[c.trade, c.company].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Photo Drop Zone ─────────────────────────────────────

const PhotoZone: React.FC<{
  photos: PhotoFile[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}> = ({ photos, onAdd, onRemove }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (dropped.length > 0) onAdd(dropped)
  }, [onAdd])

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > 0) onAdd(selected)
    e.target.value = ''
  }, [onAdd])

  if (photos.length === 0) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '32px 24px',
          borderRadius: borderRadius.lg,
          border: `2px dashed ${dragging ? colors.primaryOrange : colors.borderDefault}`,
          backgroundColor: dragging ? colors.orangeSubtle : colors.surfaceInset,
          cursor: 'pointer', textAlign: 'center',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={handleSelect}
          accept="image/*" capture="environment" />
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: dragging ? colors.orangeSubtle : colors.surfaceHover,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
          border: `2px solid ${dragging ? colors.primaryOrange : colors.borderSubtle}`,
        }}>
          <Camera size={22} style={{
            color: dragging ? colors.primaryOrange : colors.textTertiary,
          }} />
        </div>
        <div style={{
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.medium,
          color: dragging ? colors.primaryOrange : colors.textPrimary,
          marginBottom: 4,
        }}>
          Take or drop a photo of the deficiency
        </div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Photos make punch items 3x faster to resolve
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 8, marginBottom: 8,
      }}>
        {photos.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'relative',
              borderRadius: borderRadius.md,
              overflow: 'hidden',
              border: `1px solid ${colors.borderSubtle}`,
              aspectRatio: photos.length === 1 ? '16/9' : '1',
            }}
          >
            <img
              src={p.preview}
              alt={p.name}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
              }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(p.id) }}
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 22, height: 22, borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={12} style={{ color: 'white' }} />
            </button>
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '2px 6px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                fontSize: '9px', color: 'white',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {formatFileSize(p.size)}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: borderRadius.md,
          border: `1px dashed ${colors.borderDefault}`,
          backgroundColor: 'transparent', cursor: 'pointer',
          fontSize: '12px', color: colors.textTertiary,
          transition: 'all 0.15s', width: '100%',
        }}
      >
        <Plus size={12} /> Add more photos
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={handleSelect}
        accept="image/*" capture="environment" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

const PunchItemCreateWizard: React.FC<PunchItemCreateWizardProps> = ({
  projectId, open, onClose, onSubmit,
}) => {
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [floor, setFloor] = useState('')
  const [area, setArea] = useState('')
  const [location, setLocation] = useState('')
  const [trade, setTrade] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [assignee, setAssignee] = useState<DirectoryContact | null>(null)
  const [reportedBy, setReportedBy] = useState<DirectoryContact | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [sending, setSending] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const suggestedDue = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  const handleAddPhotos = useCallback((newFiles: File[]) => {
    const mapped: PhotoFile[] = newFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f, name: f.name, size: f.size,
      preview: URL.createObjectURL(f),
    }))
    setPhotos(prev => [...prev, ...mapped])
    // Focus title after photo capture
    setTimeout(() => titleRef.current?.focus(), 150)
  }, [])

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const removed = prev.find(p => p.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter(p => p.id !== id)
    })
  }, [])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.preview))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return
    setSending(true)
    try {
      // Upload every selected photo to storage so URLs survive after the
      // modal closes (blob: URLs created by URL.createObjectURL are revoked
      // on unmount and would leave the DB pointing at dead references).
      const uploadedUrls: string[] = []
      for (const p of photos) {
        const ext = p.name.split('.').pop() || 'jpg'
        const path = `${projectId}/pending-${crypto.randomUUID().slice(0, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('punch-list-photos')
          .upload(path, p.file, { contentType: p.file.type, upsert: false })
        if (upErr) {
          toast.error(`Photo upload failed: ${upErr.message}`)
          continue
        }
        const { data } = supabase.storage.from('punch-list-photos').getPublicUrl(path)
        if (data?.publicUrl) uploadedUrls.push(data.publicUrl)
      }

      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        floor: floor || null,
        area: area.trim() || null,
        location: location.trim() || null,
        trade: trade || null,
        priority,
        assigned_to: assignee?.name || null,
        reported_by: reportedBy?.name || null,
        due_date: dueDate || null,
        photos: uploadedUrls.length > 0 ? uploadedUrls : null,
        before_photo_url: uploadedUrls[0] || null,
        project_id: projectId,
      })
      // Reset
      setPhotos([]); setTitle(''); setDescription('')
      setFloor(''); setArea(''); setLocation(''); setTrade('')
      setPriority('medium'); setAssignee(null); setReportedBy(null)
      setShowMore(false); setDueDate(''); onClose()
    } catch {
      // error handled upstream
    } finally {
      setSending(false)
    }
  }, [title, description, floor, area, location, trade, priority,
      assignee, reportedBy, dueDate, photos, projectId, onSubmit, onClose])

  const canSubmit = title.trim().length > 0

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', zIndex: 101,
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '100%', maxWidth: 560, maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.xl,
              boxShadow: shadows.panel,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <div style={{
                  width: 28, height: 28, borderRadius: borderRadius.md,
                  backgroundColor: colors.orangeSubtle,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={14} style={{ color: colors.primaryOrange }} />
                </div>
                <h2 style={{
                  margin: 0, fontSize: typography.fontSize.title,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                }}>
                  New Punch Item
                </h2>
              </div>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textTertiary, padding: 4,
              }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* 1. Photo — the hero */}
              <PhotoZone photos={photos} onAdd={handleAddPhotos} onRemove={handleRemovePhoto} />

              {/* 2. Title */}
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em', marginBottom: 4,
                }}>
                  What's the issue? *
                </label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cracked drywall above unit 802 doorframe"
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.body,
                    color: colors.textPrimary,
                    backgroundColor: 'transparent',
                    outline: 'none', boxSizing: 'border-box' as const,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderSubtle)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
                      e.preventDefault(); handleSubmit()
                    }
                  }}
                />
              </div>

              {/* 3. Location: Floor + Area side by side */}
              <div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em', marginBottom: 4,
                }}>
                  <MapPin size={10} /> Location
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <FloorPicker value={floor} onChange={setFloor} />
                  <div>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                      color: colors.textTertiary, textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      Area
                    </label>
                    <input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Unit 802, Hallway B"
                      style={{
                        width: '100%', padding: '6px 10px',
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md,
                        fontSize: typography.fontSize.caption,
                        color: colors.textPrimary,
                        backgroundColor: 'transparent',
                        outline: 'none', boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Trade + Assigned To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <TradePicker value={trade} onChange={setTrade} />
                <PersonPicker
                  label="Assigned To"
                  icon={User}
                  projectId={projectId}
                  value={assignee}
                  onChange={setAssignee}
                  placeholder="Person or crew..."
                />
              </div>

              {/* 5. Priority */}
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  Priority
                </label>
                <PriorityPicker value={priority} onChange={setPriority} />
              </div>

              {/* 6. Progressive disclosure — description, dates, reported by */}
              {!showMore ? (
                <button
                  onClick={() => { setShowMore(true); if (!dueDate) setDueDate(suggestedDue) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: typography.fontSize.caption, color: colors.textTertiary,
                    padding: 0, transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.primaryOrange)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
                >
                  <Plus size={12} /> Add description, due date, reported by
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {/* Description */}
                  <div>
                    <label style={{
                      display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                      color: colors.textTertiary, textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Additional details, context, or instructions..."
                      rows={2}
                      style={{
                        width: '100%', padding: '8px 12px',
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.md,
                        fontSize: typography.fontSize.caption,
                        color: colors.textPrimary,
                        backgroundColor: 'transparent',
                        outline: 'none', resize: 'vertical',
                        fontFamily: 'inherit', lineHeight: 1.5,
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  </div>

                  {/* Due date + Location detail + Reported by */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                        color: colors.textTertiary, textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em', marginBottom: 4,
                      }}>
                        <Calendar size={10} /> Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{
                          width: '100%', padding: '6px 10px',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: '12px', color: colors.textPrimary,
                          backgroundColor: 'transparent', outline: 'none',
                          boxSizing: 'border-box' as const,
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                        color: colors.textTertiary, textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em', marginBottom: 4,
                      }}>
                        Location Detail
                      </label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Above doorframe, south wall"
                        style={{
                          width: '100%', padding: '6px 10px',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: '12px', color: colors.textPrimary,
                          backgroundColor: 'transparent', outline: 'none',
                          boxSizing: 'border-box' as const,
                        }}
                      />
                    </div>
                  </div>

                  <PersonPicker
                    label="Reported By"
                    icon={User}
                    projectId={projectId}
                    value={reportedBy}
                    onChange={setReportedBy}
                    placeholder="Who found this?"
                  />
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: `${spacing.md} ${spacing.lg}`,
              borderTop: `1px solid ${colors.borderSubtle}`,
              backgroundColor: colors.surfaceInset,
              borderRadius: `0 0 ${borderRadius.xl} ${borderRadius.xl}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                {photos.length > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '11px', color: colors.statusActive,
                    padding: '2px 8px', borderRadius: borderRadius.full,
                    backgroundColor: colors.statusActiveSubtle,
                  }}>
                    <Image size={9} /> {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                  </span>
                )}
                {trade && (
                  <span style={{
                    fontSize: '11px', color: colors.textTertiary,
                    padding: '2px 8px', borderRadius: borderRadius.full,
                    backgroundColor: colors.surfaceHover,
                  }}>
                    {trade}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px', borderRadius: borderRadius.md,
                    border: `1px solid ${colors.borderDefault}`,
                    backgroundColor: 'transparent', cursor: 'pointer',
                    fontSize: typography.fontSize.caption,
                    color: colors.textSecondary,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || sending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 20px', borderRadius: borderRadius.md,
                    border: 'none',
                    backgroundColor: canSubmit && !sending ? colors.primaryOrange : colors.surfaceDisabled,
                    color: canSubmit && !sending ? colors.white : colors.textDisabled,
                    fontSize: typography.fontSize.caption,
                    fontWeight: typography.fontWeight.semibold,
                    cursor: canSubmit && !sending ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                  }}
                >
                  {sending ? (
                    <>Creating...</>
                  ) : (
                    <><Send size={13} /> Create Punch Item</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default PunchItemCreateWizard
