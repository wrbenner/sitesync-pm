import React, { useState, useEffect, useCallback, useRef } from 'react'
import { z } from 'zod'
import { FormModal, FormBody, FormField, FormInput, FormTextarea, FormSelect } from './FormPrimitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { Loader2 } from 'lucide-react'

// ── Field Configuration ─────────────────────────────────

export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'time' | 'number' | 'currency' | 'checkbox' | 'multiselect'

export interface SelectOption {
  value: string
  label: string
}

export interface FieldConfig {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  required?: boolean
  options?: SelectOption[]
  row?: number
  min?: number
  step?: number
}

// ── IndexedDB Draft Persistence ─────────────────────────

const DB_NAME = 'sitesync_drafts'
const STORE_NAME = 'form_drafts'
const DB_VERSION = 1

function openDraftDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveDraft(key: string, data: Record<string, unknown>): Promise<void> {
  try {
    const db = await openDraftDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, key)
    db.close()
  } catch {
    // IndexedDB not available, silently fail
  }
}

async function loadDraft(key: string): Promise<Record<string, unknown> | null> {
  try {
    const db = await openDraftDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(key)
      request.onsuccess = () => {
        db.close()
        resolve(request.result || null)
      }
      request.onerror = () => {
        db.close()
        resolve(null)
      }
    })
  } catch {
    return null
  }
}

async function deleteDraft(key: string): Promise<void> {
  try {
    const db = await openDraftDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    db.close()
  } catch {
    // silently fail
  }
}

// ── Main Component ──────────────────────────────────────

interface EntityFormModalProps<T extends z.ZodObject<z.ZodRawShape>> {
  open: boolean
  onClose: () => void
  onSubmit: (data: z.infer<T>) => Promise<void> | void
  title: string
  schema: T
  fields: FieldConfig[]
  defaults?: Partial<z.infer<T>>
  submitLabel?: string
  submittingLabel?: string
  draftKey?: string
  width?: number
}

export function EntityFormModal<T extends z.ZodObject<z.ZodRawShape>>({
  open,
  onClose,
  onSubmit,
  title,
  schema,
  fields,
  defaults = {},
  submitLabel = 'Create',
  submittingLabel,
  draftKey,
  width,
}: EntityFormModalProps<T>) {
  type FormData = z.infer<T>

  const getInitialValues = useCallback((): Record<string, unknown> => {
    const values: Record<string, unknown> = {}
    for (const field of fields) {
      if (field.type === 'checkbox') {
        values[field.name] = (defaults as Record<string, unknown>)[field.name] ?? false
      } else {
        values[field.name] = (defaults as Record<string, unknown>)[field.name] ?? ''
      }
    }
    return values
  }, [fields, defaults])

  const [form, setForm] = useState<Record<string, unknown>>(getInitialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  // Load draft on open
  useEffect(() => {
    if (open && draftKey && !draftLoaded) {
      loadDraft(draftKey).then((draft) => {
        if (draft) {
          setForm((prev) => ({ ...prev, ...draft }))
        }
        setDraftLoaded(true)
      })
    }
    if (!open) {
      setDraftLoaded(false)
    }
  }, [open, draftKey, draftLoaded])

  // Auto-save draft on changes (debounced)
  useEffect(() => {
    if (!draftKey || !open) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const hasContent = Object.values(form).some((v) => v !== '' && v !== false)
      if (hasContent) {
        saveDraft(draftKey, form)
      }
    }, 1000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [form, draftKey, open])

  // Focus first field on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => firstFieldRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleChange = useCallback((name: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (prev[name]) {
        const next = { ...prev }
        delete next[name]
        return next
      }
      return prev
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const result = schema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const path = issue.path[0]
        if (path && !fieldErrors[String(path)]) {
          fieldErrors[String(path)] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(result.data as FormData)
      if (draftKey) {
        deleteDraft(draftKey)
      }
      setForm(getInitialValues())
      setErrors({})
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        setErrors({ _form: err.message })
      }
    } finally {
      setSubmitting(false)
    }
  }, [schema, form, onSubmit, onClose, draftKey, getInitialValues])

  const handleClose = useCallback(() => {
    if (!submitting) {
      setForm(getInitialValues())
      setErrors({})
      onClose()
    }
  }, [submitting, getInitialValues, onClose])

  // Group fields by row
  const groupedFields: FieldConfig[][] = []
  let currentRow: FieldConfig[] = []
  let lastRow: number | undefined

  for (const field of fields) {
    if (field.row !== undefined && field.row === lastRow) {
      currentRow.push(field)
    } else {
      if (currentRow.length > 0) groupedFields.push(currentRow)
      currentRow = [field]
      lastRow = field.row
    }
  }
  if (currentRow.length > 0) groupedFields.push(currentRow)

  return (
    <FormModal open={open} onClose={handleClose} title={title} width={width}>
      <FormBody onSubmit={handleSubmit}>
        {errors._form && (
          <div
            role="alert"
            style={{
              padding: spacing['3'],
              backgroundColor: colors.errorSubtle,
              border: `1px solid ${colors.statusCritical}`,
              borderRadius: borderRadius.md,
              color: colors.statusCritical,
              fontSize: typography.fontSize.sm,
            }}
          >
            {errors._form}
          </div>
        )}

        {groupedFields.map((row, rowIdx) => {
          if (row.length === 1) {
            const field = row[0]
            return (
              <FieldRenderer
                key={field.name}
                field={field}
                value={form[field.name]}
                error={errors[field.name]}
                onChange={handleChange}
                inputRef={rowIdx === 0 ? firstFieldRef : undefined}
                disabled={submitting}
              />
            )
          }
          return (
            <div
              key={`row-${rowIdx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                gap: spacing['3'],
              }}
            >
              {row.map((field, colIdx) => (
                <FieldRenderer
                  key={field.name}
                  field={field}
                  value={form[field.name]}
                  error={errors[field.name]}
                  onChange={handleChange}
                  inputRef={rowIdx === 0 && colIdx === 0 ? firstFieldRef : undefined}
                  disabled={submitting}
                />
              ))}
            </div>
          )
        })}

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: spacing['3'],
          marginTop: spacing['2'], paddingTop: spacing['4'],
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            style={{
              padding: `${spacing['2']} ${spacing['5']}`,
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.medium,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.white,
              color: colors.textSecondary,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: `${spacing['2']} ${spacing['5']}`,
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              fontWeight: typography.fontWeight.semibold,
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor: submitting ? colors.orangeHover : colors.primaryOrange,
              color: colors.white,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
            }}
          >
            {submitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting && submittingLabel ? submittingLabel : submitLabel}
          </button>
        </div>
      </FormBody>
    </FormModal>
  )
}

// ── Field Renderer ──────────────────────────────────────

interface FieldRendererProps {
  field: FieldConfig
  value: unknown
  error?: string
  onChange: (name: string, value: unknown) => void
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  disabled?: boolean
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, error, onChange, inputRef, disabled }) => {
  const stringValue = String(value ?? '')

  if (field.type === 'checkbox') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        <input
          type="checkbox"
          id={`field-${field.name}`}
          checked={Boolean(value)}
          onChange={(e) => onChange(field.name, e.target.checked)}
          disabled={disabled}
          style={{ width: 18, height: 18, accentColor: colors.primaryOrange, cursor: 'pointer' }}
        />
        <label
          htmlFor={`field-${field.name}`}
          style={{
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
            color: colors.textPrimary, fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
          }}
        >
          {field.label}
        </label>
      </div>
    )
  }

  if (field.type === 'currency') {
    return (
      <FormField label={field.label} required={field.required} error={error}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)',
            fontSize: typography.fontSize.body, color: colors.textTertiary,
          }}>$</span>
          <FormInput
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="number"
            value={stringValue}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder || '0'}
            min={field.min ?? 0}
            step={field.step ?? 0.01}
            hasError={!!error}
            disabled={disabled}
            style={{ paddingLeft: spacing['6'] }}
          />
        </div>
      </FormField>
    )
  }

  if (field.type === 'textarea') {
    return (
      <FormField label={field.label} required={field.required} error={error}>
        <FormTextarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={stringValue}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          hasError={!!error}
          disabled={disabled}
        />
      </FormField>
    )
  }

  if (field.type === 'select') {
    return (
      <FormField label={field.label} required={field.required} error={error}>
        <FormSelect
          ref={inputRef as React.Ref<HTMLSelectElement>}
          value={stringValue}
          onChange={(e) => onChange(field.name, e.target.value)}
          disabled={disabled}
        >
          {!field.required && <option value="">Select...</option>}
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </FormSelect>
      </FormField>
    )
  }

  return (
    <FormField label={field.label} required={field.required} error={error}>
      <FormInput
        ref={inputRef as React.Ref<HTMLInputElement>}
        type={field.type}
        value={stringValue}
        onChange={(e) => onChange(field.name, e.target.value)}
        placeholder={field.placeholder}
        min={field.min}
        step={field.step}
        hasError={!!error}
        disabled={disabled}
      />
    </FormField>
  )
}

export default EntityFormModal
