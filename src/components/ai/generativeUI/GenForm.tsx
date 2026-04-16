import React, { useState, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { colors, spacing, typography, borderRadius } from '../../../styles/theme'
import { Btn } from '../../Primitives'
import { FormField, FormInput, FormTextarea, FormSelect } from '../../forms/FormPrimitives'
import { toast } from 'sonner'
import type { FormBlock } from './types'

interface Props {
  block: FormBlock
  onAction?: (action: string, data: Record<string, unknown>) => void
}

export const GenForm: React.FC<Props> = React.memo(({ block, onAction }) => {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const field of block.fields) {
      initial[field.name] = block.prefilled?.[field.name] ?? field.value ?? ''
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = useCallback((name: string, value: unknown) => {
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }, [errors])

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    const newErrors: Record<string, string> = {}
    for (const field of block.fields) {
      if (field.required && !form[field.name]) {
        newErrors[field.name] = `${field.label} is required`
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      onAction?.(`create_${block.entity_type}`, form)
      setSubmitted(true)
      toast.success(`${block.title} created`)
    } catch {
      toast.error('Failed to create')
    } finally {
      setSubmitting(false)
    }
  }, [form, block, onAction])

  if (submitted) {
    return (
      <div style={{
        backgroundColor: colors.statusActiveSubtle,
        borderRadius: borderRadius.lg,
        padding: spacing['4'],
        border: `1px solid ${colors.statusActive}40`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        fontFamily: typography.fontFamily,
      }}>
        <Send size={16} color={colors.statusActive} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, fontWeight: typography.fontWeight.medium }}>
          {block.title} submitted successfully
        </span>
      </div>
    )
  }

  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      borderLeft: `3px solid ${colors.primaryOrange}`,
      padding: spacing['4'],
      fontFamily: typography.fontFamily,
    }}>
      <div style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        marginBottom: spacing['3'],
      }}>
        {block.title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {block.fields.map((field) => (
          <FormField key={field.name} label={field.label} required={field.required} error={errors[field.name]}>
            {field.type === 'textarea' ? (
              <FormTextarea
                value={String(form[field.name] ?? '')}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                hasError={!!errors[field.name]}
              />
            ) : field.type === 'select' && field.options ? (
              <FormSelect
                value={String(form[field.name] ?? '')}
                onChange={(e) => handleChange(field.name, e.target.value)}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FormSelect>
            ) : (
              <FormInput
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={String(form[field.name] ?? '')}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                hasError={!!errors[field.name]}
              />
            )}
          </FormField>
        ))}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: spacing['2'],
        marginTop: spacing['4'],
        paddingTop: spacing['3'],
        borderTop: `1px solid ${colors.borderSubtle}`,
      }}>
        <Btn
          variant="primary"
          size="sm"
          icon={submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
          onClick={handleSubmit}
        >
          {block.submit_label || 'Create'}
        </Btn>
      </div>
    </div>
  )
})
