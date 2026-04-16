import React from 'react';
import { X } from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { toast } from 'sonner';
import { inspectionService } from '../../services/inspectionService';
import type { InspectionType } from '../../types/inspection';
import type { Priority } from '../../types/database';

interface InspectionFormState {
  title: string;
  type: InspectionType;
  priority: Priority;
  scheduled_date: string;
  location: string;
}

const defaultForm: InspectionFormState = {
  title: '',
  type: 'safety',
  priority: 'medium',
  scheduled_date: '',
  location: '',
};

interface InspectionFormProps {
  projectId: string | null | undefined;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: `${spacing['3']} ${spacing['4']}`,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.base,
  fontSize: typography.fontSize.sm,
  fontFamily: typography.fontFamily,
  color: colors.textPrimary,
  backgroundColor: colors.surfaceRaised,
  outline: 'none',
  minHeight: '48px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: spacing['1'],
  fontSize: typography.fontSize.caption,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const InspectionForm: React.FC<InspectionFormProps> = ({ projectId, onClose, onSubmitSuccess }) => {
  const [form, setForm] = React.useState<InspectionFormState>({ ...defaultForm });
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const set = (key: keyof InspectionFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.type) errors.type = 'Type is required';
    if (!form.priority) errors.priority = 'Priority is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Please complete all required fields');
      return;
    }
    if (!projectId) {
      toast.error('Project not loaded');
      return;
    }

    setSubmitting(true);
    try {
      const result = await inspectionService.createInspection({
        project_id: projectId,
        title: form.title.trim(),
        type: form.type,
        priority: form.priority,
        scheduled_date: form.scheduled_date || undefined,
        location: form.location.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error.userMessage ?? 'Failed to create inspection');
        return;
      }

      toast.success('Inspection scheduled');
      onSubmitSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Inspection"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 22, 41, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: spacing['4'],
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['5']} ${spacing['6']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
          <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            New Inspection
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing['1'], borderRadius: borderRadius.base, minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing['5']} ${spacing['6']}`, display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>

          {/* Title */}
          <div>
            <label htmlFor="insp-title" style={labelStyle}>Title <span style={{ color: colors.statusCritical }}>*</span></label>
            <input
              id="insp-title"
              type="text"
              placeholder="e.g. Level 3 framing safety walk"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              style={{ ...inputStyle, borderColor: fieldErrors.title ? colors.statusCritical : colors.borderDefault }}
            />
            {fieldErrors.title && <p style={{ margin: `${spacing['1']} 0 0`, fontSize: typography.fontSize.caption, color: colors.statusCritical }}>{fieldErrors.title}</p>}
          </div>

          {/* Type + Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label htmlFor="insp-type" style={labelStyle}>Type <span style={{ color: colors.statusCritical }}>*</span></label>
              <select
                id="insp-type"
                value={form.type}
                onChange={(e) => set('type', e.target.value as InspectionType)}
                style={{ ...inputStyle, borderColor: fieldErrors.type ? colors.statusCritical : colors.borderDefault }}
              >
                <option value="safety">Safety</option>
                <option value="quality">Quality</option>
                <option value="building">Building</option>
                <option value="fire">Fire</option>
                <option value="electrical">Electrical</option>
                <option value="structural">Structural</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label htmlFor="insp-priority" style={labelStyle}>Priority <span style={{ color: colors.statusCritical }}>*</span></label>
              <select
                id="insp-priority"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as Priority)}
                style={{ ...inputStyle, borderColor: fieldErrors.priority ? colors.statusCritical : colors.borderDefault }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Scheduled Date */}
          <div>
            <label htmlFor="insp-date" style={labelStyle}>Scheduled Date</label>
            <input
              id="insp-date"
              type="date"
              value={form.scheduled_date}
              onChange={(e) => set('scheduled_date', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="insp-location" style={labelStyle}>Location</label>
            <input
              id="insp-location"
              type="text"
              placeholder="e.g. Level 3, Northwest stairwell"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: spacing['3'], justifyContent: 'flex-end', padding: `${spacing['4']} ${spacing['6']}`, borderTop: `1px solid ${colors.borderSubtle}` }}>
          <Btn variant="secondary" onClick={onClose} style={{ minHeight: '48px' }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} loading={submitting} style={{ minHeight: '48px' }}>
            Schedule Inspection
          </Btn>
        </div>
      </div>
    </div>
  );
};
