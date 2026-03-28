import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Send, ClipboardList } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useSubmittalStore } from '../../stores/submittalStore';
import { useProjectContext } from '../../stores/projectContextStore';
import { useAuthStore } from '../../stores/authStore';
import { createSubmittalSchema } from '../../schemas/submittal';
import type { CreateSubmittalFormData } from '../../schemas/submittal';
import type { Priority } from '../../types/database';

interface CreateSubmittalFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function CreateSubmittalForm({ open, onClose, onSuccess }: CreateSubmittalFormProps) {
  const { createSubmittal } = useSubmittalStore();
  const { activeProject } = useProjectContext();
  const { profile } = useAuthStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateSubmittalFormData>({
    resolver: zodResolver(createSubmittalSchema),
    defaultValues: { priority: 'medium' },
  });

  if (!open) return null;

  const onSubmit = async (data: CreateSubmittalFormData, asDraft: boolean) => {
    if (!activeProject || !profile) return;

    const { error: createError, submittal } = await createSubmittal({
      project_id: activeProject.id,
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      spec_section: data.specSection?.trim() || undefined,
      priority: data.priority,
      due_date: data.dueDate || undefined,
      created_by: profile.id,
    });

    if (createError) {
      setError('root', { message: createError });
      return;
    }

    if (!asDraft && submittal) {
      await useSubmittalStore.getState().updateSubmittalStatus(submittal.id, 'submitted');
    }

    handleClose();
    onSuccess?.();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['2']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surfacePage,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: typography.fontFamily,
    transition: `border-color ${transitions.quick}`,
  };

  const errorInputStyle: React.CSSProperties = {
    ...inputStyle,
    borderColor: colors.statusCritical,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['1'],
    letterSpacing: typography.letterSpacing.wide,
  };

  const fieldErrorStyle: React.CSSProperties = {
    fontSize: typography.fontSize.caption,
    color: colors.statusCritical,
    marginTop: '2px',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }} onClick={handleClose}>
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          boxShadow: shadows.panel,
          width: '560px',
          maxHeight: '90vh',
          overflow: 'auto',
          fontFamily: typography.fontFamily,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: `${spacing['5']} ${spacing['6']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <ClipboardList size={18} color={colors.primaryOrange} />
            <h2 style={{
              margin: 0,
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
            }}>
              New Submittal
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: 'none', borderRadius: borderRadius.base,
              backgroundColor: 'transparent', cursor: 'pointer', color: colors.textTertiary,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}`, display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {errors.root && (
            <div style={{
              padding: spacing['3'],
              backgroundColor: colors.statusCriticalSubtle,
              borderRadius: borderRadius.base,
              color: colors.statusCritical,
              fontSize: typography.fontSize.sm,
            }}>
              {errors.root.message}
            </div>
          )}

          <div>
            <label style={labelStyle}>Title *</label>
            <input
              {...register('title')}
              placeholder="Submittal title (e.g., Structural Steel Shop Drawings)"
              style={errors.title ? errorInputStyle : inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => { if (!errors.title) e.target.style.borderColor = colors.borderDefault; }}
              autoFocus
            />
            {errors.title && <div style={fieldErrorStyle}>{errors.title.message}</div>}
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              {...register('description')}
              placeholder="Describe what is being submitted, reference spec sections and requirements..."
              rows={4}
              style={{ ...(errors.description ? errorInputStyle : inputStyle), resize: 'vertical' as const }}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => { if (!errors.description) e.target.style.borderColor = colors.borderDefault; }}
            />
            {errors.description && <div style={fieldErrorStyle}>{errors.description.message}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
            <div>
              <label style={labelStyle}>Spec Section</label>
              <input
                {...register('specSection')}
                placeholder="e.g., 05 12 00"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
              />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                {...register('priority')}
                style={{ ...inputStyle, backgroundColor: colors.surfaceRaised }}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              {...register('dueDate')}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: spacing['3'],
          padding: `${spacing['4']} ${spacing['6']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: 'transparent',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textSecondary,
              cursor: 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit((data) => onSubmit(data, true))}
            disabled={isSubmitting}
            style={{
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surfaceRaised,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Save as Draft
          </button>
          <button
            onClick={handleSubmit((data) => onSubmit(data, false))}
            disabled={isSubmitting}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['5']}`,
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor: colors.primaryOrange,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: '#fff',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
              transition: `background-color ${transitions.quick}`,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.orangeHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primaryOrange}
          >
            <Send size={14} />
            {isSubmitting ? 'Creating...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
