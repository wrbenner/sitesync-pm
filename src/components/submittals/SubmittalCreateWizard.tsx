/**
 * Submittal Creation — Document-first, intelligent.
 *
 * The insight: a submittal IS a document package. Start there.
 * Drop your shop drawings. We figure out the rest.
 *
 * 1. Drop files → auto-detect spec section from filename + suggest title
 * 2. Pick type, sub, reviewer — progressive disclosure for dates/lead time
 * 3. One tap to submit. Cmd+Enter power users.
 *
 * No wizard steps. No 14-field form. Just: "here's my shop drawing, route it."
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, X, Plus,
  Send, Image, File, Sparkles
} from 'lucide-react'
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme'
import { Avatar } from '../Primitives'
import { useRealtimeDirectoryContacts } from '../../hooks/queries/realtime'
import { CSI_DIVISIONS } from '../../machines/submittalMachine'
import type { DirectoryContact } from '../../types/database'

// ─── Types ───────────────────────────────────────────────

interface SubmittalFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  preview?: string
}

type SubmittalType = 'shop_drawing' | 'product_data' | 'sample' | 'design_data' | 'test_report' | 'certificate' | 'closeout'

interface SubmittalCreateWizardProps {
  projectId: string
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>, files: File[]) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────

const getInitials = (s: string) =>
  (s || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  dwg: FileText,
  image: Image,
  default: File,
}

const getFileIcon = (type: string) => {
  if (type.includes('pdf')) return FILE_ICONS.pdf
  if (type.includes('image')) return FILE_ICONS.image
  return FILE_ICONS.default
}

/**
 * Auto-detect CSI spec section from filename.
 * e.g. "05_12_00_Structural_Steel.pdf" → "05 12 00"
 * e.g. "Division 09 - Finishes - Drywall.pdf" → "09"
 */
const detectSpecSection = (filename: string): string | null => {
  // Pattern: XX XX XX or XX-XX-XX or XXXXXX
  const csiPattern = /(\d{2})[\s_-]?(\d{2})[\s_-]?(\d{2})/
  const match = filename.match(csiPattern)
  if (match) return `${match[1]} ${match[2]} ${match[3]}`

  // Pattern: Division XX
  const divPattern = /division\s*(\d{2})/i
  const divMatch = filename.match(divPattern)
  if (divMatch) {
    const div = CSI_DIVISIONS.find(d => d.code === divMatch[1])
    if (div) return `${div.code} 00 00`
  }

  return null
}

/**
 * Suggest a title from filename.
 * "05_12_00_Structural_Steel_Shop_Drawings.pdf" → "Structural Steel Shop Drawings"
 */
const suggestTitle = (filename: string): string => {
  let name = filename.replace(/\.[^.]+$/, '') // remove extension
  name = name.replace(/^\d{2}[\s_-]?\d{2}[\s_-]?\d{2}[\s_-]?/, '') // remove CSI prefix
  name = name.replace(/[_-]+/g, ' ').trim() // underscores/dashes to spaces
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

// ─── Type Picker ──────────────────────────────────────────

const SUBMITTAL_TYPES: Array<{ value: SubmittalType; label: string; icon: string }> = [
  { value: 'shop_drawing', label: 'Shop Drawing', icon: '📐' },
  { value: 'product_data', label: 'Product Data', icon: '📋' },
  { value: 'sample', label: 'Sample', icon: '🔬' },
  { value: 'design_data', label: 'Design Data', icon: '📊' },
  { value: 'test_report', label: 'Test Report', icon: '🧪' },
  { value: 'certificate', label: 'Certificate', icon: '📄' },
  { value: 'closeout', label: 'Closeout', icon: '✅' },
]

const TypePicker: React.FC<{
  value: SubmittalType
  onChange: (t: SubmittalType) => void
}> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {SUBMITTAL_TYPES.map(t => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: borderRadius.full,
          border: `1px solid ${value === t.value ? colors.primaryOrange : colors.borderSubtle}`,
          backgroundColor: value === t.value ? colors.orangeSubtle : 'transparent',
          color: value === t.value ? colors.primaryOrange : colors.textSecondary,
          fontSize: '12px', fontWeight: typography.fontWeight.medium,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: '11px' }}>{t.icon}</span>
        {t.label}
      </button>
    ))}
  </div>
)

// ─── Person Picker (reused pattern from RFIs) ─────────────

const PersonPicker: React.FC<{
  label: string
  projectId: string
  value: DirectoryContact | null
  onChange: (c: DirectoryContact | null) => void
  placeholder?: string
  filterTrade?: boolean
}> = ({ label, projectId, value, onChange, placeholder = 'Select...', filterTrade: _filterTrade }) => {
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
        display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        {label}
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
              backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderDefault}`,
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

// ─── Spec Section Picker ──────────────────────────────────

const SpecSectionInput: React.FC<{
  value: string
  onChange: (v: string) => void
  autoDetected?: boolean
}> = ({ value, onChange, autoDetected }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const divCode = value.slice(0, 2)
  const matchedDiv = CSI_DIVISIONS.find(d => d.code === divCode)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: '11px', fontWeight: typography.fontWeight.semibold,
        color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: 4,
      }}>
        Spec Section
        {autoDetected && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: '9px', color: colors.statusActive,
            fontWeight: typography.fontWeight.semibold,
            textTransform: 'none', letterSpacing: 0,
          }}>
            <Sparkles size={8} /> auto-detected
          </span>
        )}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="e.g. 05 12 00"
          style={{
            flex: 1, padding: '6px 10px',
            border: `1px solid ${autoDetected ? colors.statusActive + '60' : colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.caption,
            color: colors.textPrimary,
            backgroundColor: autoDetected ? colors.statusActiveSubtle : 'transparent',
            outline: 'none', fontFamily: 'monospace',
            transition: 'border-color 0.15s',
          }}
        />
        {matchedDiv && (
          <span style={{ fontSize: '11px', color: colors.textTertiary, whiteSpace: 'nowrap' }}>
            {matchedDiv.name}
          </span>
        )}
      </div>

      <AnimatePresence>
        {open && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: 4, maxHeight: 200, overflowY: 'auto',
              backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, boxShadow: shadows.lg,
            }}
          >
            {CSI_DIVISIONS.map(d => (
              <div key={d.code}
                onClick={() => { onChange(`${d.code} 00 00`); setOpen(false) }}
                style={{
                  padding: '6px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: spacing.sm,
                  fontSize: typography.fontSize.caption,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontFamily: 'monospace', color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold }}>
                  {d.code}
                </span>
                <span style={{ color: colors.textPrimary }}>{d.name}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Drop Zone ────────────────────────────────────────────

const DropZone: React.FC<{
  files: SubmittalFile[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}> = ({ files, onAdd, onRemove }) => {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length > 0) onAdd(dropped)
  }, [onAdd])

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > 0) onAdd(selected)
    e.target.value = ''
  }, [onAdd])

  if (files.length === 0) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '40px 24px',
          borderRadius: borderRadius.lg,
          border: `2px dashed ${dragging ? colors.primaryOrange : colors.borderDefault}`,
          backgroundColor: dragging ? colors.orangeSubtle : colors.surfaceInset,
          cursor: 'pointer', textAlign: 'center',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={handleSelect}
          accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
        <Upload size={32} style={{
          color: dragging ? colors.primaryOrange : colors.textTertiary,
          margin: '0 auto 12px',
        }} />
        <div style={{
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.medium,
          color: dragging ? colors.primaryOrange : colors.textPrimary,
          marginBottom: 4,
        }}>
          Drop shop drawings, product data, or specs
        </div>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          PDF, DWG, images, or documents — we'll figure out the rest
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {files.map(f => {
          const Icon = getFileIcon(f.type)
          return (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing.sm,
                padding: '8px 12px', borderRadius: borderRadius.md,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
              }}
            >
              <Icon size={16} style={{ color: colors.primaryOrange, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: typography.fontSize.caption,
                  color: colors.textPrimary,
                  fontWeight: typography.fontWeight.medium,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.name}
                </div>
                <div style={{ fontSize: '10px', color: colors.textTertiary }}>
                  {formatFileSize(f.size)}
                </div>
              </div>
              <button onClick={() => onRemove(f.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textTertiary, padding: 2,
              }}>
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
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
        <Plus size={12} /> Add more files
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={handleSelect}
        accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

const SubmittalCreateWizard: React.FC<SubmittalCreateWizardProps> = ({
  projectId, open, onClose, onSubmit,
}) => {
  const [files, setFiles] = useState<SubmittalFile[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<SubmittalType>('shop_drawing')
  const [specSection, setSpecSection] = useState('')
  const [specAutoDetected, setSpecAutoDetected] = useState(false)
  const [description, setDescription] = useState('')
  const [subcontractor, setSubcontractor] = useState<DirectoryContact | null>(null)
  const [reviewer, setReviewer] = useState<DirectoryContact | null>(null)
  const [showDates, setShowDates] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [requiredOnsite, setRequiredOnsite] = useState('')
  const [leadTimeWeeks, setLeadTimeWeeks] = useState('')
  const [sending, setSending] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Auto-suggest due date 14 days from now
  const suggestedDue = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString().split('T')[0]
  }, [])

  const handleAddFiles = useCallback((newFiles: File[]) => {
    const mapped: SubmittalFile[] = newFiles.map(f => ({
      id: `${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}`,
      file: f, name: f.name, size: f.size, type: f.type,
    }))
    setFiles(prev => [...prev, ...mapped])

    // Auto-detect from first file if fields are empty
    if (newFiles.length > 0 && !title) {
      const firstFile = newFiles[0]
      const suggestedSpec = detectSpecSection(firstFile.name)
      if (suggestedSpec && !specSection) {
        setSpecSection(suggestedSpec)
        setSpecAutoDetected(true)
      }
      const suggestedName = suggestTitle(firstFile.name)
      if (suggestedName && suggestedName.length > 3) {
        setTitle(suggestedName)
      }
    }

    // Focus title after file drop
    setTimeout(() => titleRef.current?.focus(), 100)
  }, [title, specSection])

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return
    setSending(true)
    try {
      await onSubmit({
        title: title.trim(),
        type,
        spec_section: specSection || null,
        description: description.trim() || null,
        subcontractor: subcontractor?.name || null,
        assigned_to: reviewer?.name || null,
        due_date: dueDate || suggestedDue,
        required_onsite_date: requiredOnsite || null,
        lead_time_weeks: leadTimeWeeks ? parseInt(leadTimeWeeks, 10) : null,
      }, files.map(f => f.file))
      // Reset
      setFiles([]); setTitle(''); setType('shop_drawing')
      setSpecSection(''); setSpecAutoDetected(false); setDescription('')
      setSubcontractor(null); setReviewer(null)
      setShowDates(false); setDueDate(''); setRequiredOnsite('')
      setLeadTimeWeeks(''); onClose()
    } catch {
      // error handled upstream
    } finally {
      setSending(false)
    }
  }, [title, type, specSection, description, subcontractor, reviewer,
      dueDate, requiredOnsite, leadTimeWeeks, suggestedDue, files, onSubmit, onClose])

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

          {/* Centering wrapper — flex instead of transform so Framer Motion doesn't clobber it */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 101,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              padding: spacing.lg,
            }}
          >
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              width: '100%', maxWidth: 580, maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.xl,
              boxShadow: shadows.xl,
              border: `1px solid ${colors.borderSubtle}`,
              pointerEvents: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: `${spacing.lg} ${spacing.lg} ${spacing.md}`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
            }}>
              <h2 style={{
                margin: 0, fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
              }}>
                New Submittal
              </h2>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: colors.textTertiary, padding: 4,
              }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

              {/* 1. Documents — the hero */}
              <DropZone files={files} onAdd={handleAddFiles} onRemove={handleRemoveFile} />

              {/* 2. Title (auto-suggested from filename) */}
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 4,
                }}>
                  Title
                </label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What is this submittal for?"
                  style={{
                    width: '100%', padding: '8px 12px',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.body,
                    color: colors.textPrimary,
                    backgroundColor: 'transparent',
                    outline: 'none', boxSizing: 'border-box',
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

              {/* 3. Type Picker */}
              <div>
                <label style={{
                  display: 'block', fontSize: '11px', fontWeight: typography.fontWeight.semibold,
                  color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 6,
                }}>
                  Type
                </label>
                <TypePicker value={type} onChange={setType} />
              </div>

              {/* 4. Spec Section (auto-detected or manual) */}
              <SpecSectionInput
                value={specSection}
                onChange={(v) => { setSpecSection(v); setSpecAutoDetected(false) }}
                autoDetected={specAutoDetected}
              />

              {/* 5. From / To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                <PersonPicker
                  label="From (Subcontractor)"
                  projectId={projectId}
                  value={subcontractor}
                  onChange={setSubcontractor}
                  placeholder="Who's submitting?"
                  filterTrade
                />
                <PersonPicker
                  label="Route to"
                  projectId={projectId}
                  value={reviewer}
                  onChange={setReviewer}
                  placeholder="GC reviewer..."
                />
              </div>

              {/* 6. Description (optional, collapsed) */}
              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes, special requirements, or context... (optional)"
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
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryOrange)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderSubtle)}
                />
              </div>

              {/* 7. Progressive disclosure — dates & lead time */}
              {!showDates ? (
                <button
                  onClick={() => { setShowDates(true); if (!dueDate) setDueDate(suggestedDue) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: typography.fontSize.caption, color: colors.textTertiary,
                    padding: 0, transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = colors.primaryOrange)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = colors.textTertiary)}
                >
                  <Plus size={12} /> Add dates, lead time
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing.sm }}>
                    <div>
                      <label style={{
                        display: 'block', fontSize: '10px', color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
                      }}>
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        style={{
                          width: '100%', padding: '5px 8px',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: '12px', color: colors.textPrimary,
                          backgroundColor: 'transparent', outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block', fontSize: '10px', color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
                      }}>
                        Required On-Site
                      </label>
                      <input
                        type="date"
                        value={requiredOnsite}
                        onChange={(e) => setRequiredOnsite(e.target.value)}
                        style={{
                          width: '100%', padding: '5px 8px',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: '12px', color: colors.textPrimary,
                          backgroundColor: 'transparent', outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block', fontSize: '10px', color: colors.textTertiary,
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3,
                      }}>
                        Lead Time
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="number"
                          min="0"
                          value={leadTimeWeeks}
                          onChange={(e) => setLeadTimeWeeks(e.target.value)}
                          placeholder="0"
                          style={{
                            width: '100%', padding: '5px 8px',
                            border: `1px solid ${colors.borderSubtle}`,
                            borderRadius: borderRadius.md,
                            fontSize: '12px', color: colors.textPrimary,
                            backgroundColor: 'transparent', outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                        <span style={{ fontSize: '11px', color: colors.textTertiary, whiteSpace: 'nowrap' }}>wks</span>
                      </div>
                    </div>
                  </div>
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
                {files.length > 0 && (
                  <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                  </span>
                )}
                {specAutoDetected && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    fontSize: '11px', color: colors.statusActive,
                    padding: '2px 8px', borderRadius: borderRadius.full,
                    backgroundColor: colors.statusActiveSubtle,
                  }}>
                    <Sparkles size={9} /> AI-detected spec
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
                    <>Submitting...</>
                  ) : (
                    <><Send size={13} /> Submit for Review</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

export default SubmittalCreateWizard
