import React, { useState } from 'react';
import { X, Send, ClipboardList } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { UppyUploader } from '../files/UppyUploader';
import { useSubmittalStore } from '../../stores/submittalStore';
import { useProjectContext } from '../../stores/projectContextStore';
import { useAuthStore } from '../../stores/authStore';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specSection, setSpecSection] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (asDraft: boolean) => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!activeProject || !profile) return;

    setSaving(true);
    setError('');

    const { error: createError, submittal } = await createSubmittal({
      project_id: activeProject.id,
      title: title.trim(),
      description: description.trim() || undefined,
      spec_section: specSection.trim() || undefined,
      due_date: dueDate || undefined,
    });

    if (createError) {
      setError(createError);
      setSaving(false);
      return;
    }

    // If not draft, immediately submit
    if (!asDraft && submittal) {
      await useSubmittalStore.getState().updateSubmittalStatus(submittal.id, 'submitted');
    }

    setSaving(false);
    resetForm();
    onClose();
    onSuccess?.();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSpecSection('');
    setPriority('medium');
    setDueDate('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing['1'],
    letterSpacing: typography.letterSpacing.wide,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: zIndex.dropdown as number,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.overlayDark,
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
          {error && (
            <div style={{
              padding: spacing['3'],
              backgroundColor: colors.statusCriticalSubtle,
              borderRadius: borderRadius.base,
              color: colors.statusCritical,
              fontSize: typography.fontSize.sm,
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={labelStyle}>Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Submittal title (e.g., Structural Steel Shop Drawings)"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what is being submitted, reference spec sections and requirements..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
            <div>
              <label style={labelStyle}>Spec Section</label>
              <input
                value={specSection}
                onChange={(e) => setSpecSection(e.target.value)}
                placeholder="e.g., 05 12 00"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
                onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
              />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = colors.primaryOrange}
              onBlur={(e) => e.target.style.borderColor = colors.borderDefault}
            />
          </div>

          {/* Attachments */}
          <div>
            <label style={labelStyle}>Attachments</label>
            <UppyUploader
              compact
              onFilesSelected={() => {}}
              accept=".pdf,.png,.jpg,.jpeg,.dwg,.xlsx,.docx"
              label="Drop shop drawings, specs, or documents"
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
            onClick={() => handleSubmit(true)}
            disabled={saving}
            style={{
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              backgroundColor: colors.surfaceRaised,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.textPrimary,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
            }}
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['5']}`,
              border: 'none',
              borderRadius: borderRadius.md,
              backgroundColor: colors.primaryOrange,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              color: colors.white,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: typography.fontFamily,
              transition: `background-color ${transitions.quick}`,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.orangeHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.primaryOrange}
          >
            <Send size={14} />
            {saving ? 'Creating...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
