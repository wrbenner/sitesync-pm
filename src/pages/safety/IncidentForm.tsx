import React, { useRef } from 'react';
import { Btn } from '../../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'

interface IncidentFormState {
  date: string;
  type: string;
  location: string;
  description: string;
  severity: string;
  injured_party_name: string;
  root_cause: string;
  ca_description: string;
  ca_assignee: string;
  ca_due_date: string;
  photo: File | null;
}

const defaultForm: IncidentFormState = {
  date: '', type: '', location: '', description: '', severity: '', injured_party_name: '',
  root_cause: '', ca_description: '', ca_assignee: '', ca_due_date: '', photo: null,
};

interface IncidentFormProps {
  projectId: string | null | undefined;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export const IncidentForm: React.FC<IncidentFormProps> = ({ projectId, onClose, onSubmitSuccess }) => {
  const [form, setForm] = React.useState<IncidentFormState>({ ...defaultForm });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const dateRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const severityRef = useRef<HTMLSelectElement>(null);
  const injuredPartyRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const photoRequiredSeverities = ['medical_treatment', 'lost_time', 'fatality'];
  const isPhotoRequired = photoRequiredSeverities.includes(form.severity);

  const requiredFields: { key: keyof IncidentFormState; label: string }[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Incident type' },
    { key: 'location', label: 'Location' },
    { key: 'description', label: 'Description' },
    { key: 'severity', label: 'Severity' },
    { key: 'injured_party_name', label: 'Involved party' },
  ];

  const validateField = (key: string, value: string): string => {
    if (!value.trim()) {
      const found = requiredFields.find((f) => f.key === key);
      return found ? `${found.label} is required` : 'This field is required';
    }
    return '';
  };

  const handleFieldBlur = (key: string, value: string) => {
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(key, value) }));
  };

  const handleClose = () => {
    setForm({ ...defaultForm });
    setFieldErrors({});
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    for (const f of requiredFields) {
      const v = form[f.key];
      if (typeof v === 'string' && !v.trim()) errs[f.key as string] = `${f.label} is required`;
    }
    if (isPhotoRequired && !form.photo) errs.photo = 'Photo documentation is required for this severity';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!projectId) { setSubmitError('No project selected'); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      let photoUrl: string | null = null;
      if (form.photo) {
        const path = `incidents/${projectId}/${Date.now()}-${form.photo.name}`;
        const { error: upErr } = await supabase.storage.from('field-captures').upload(path, form.photo);
        if (!upErr) {
          const { data: pub } = supabase.storage.from('field-captures').getPublicUrl(path);
          photoUrl = pub?.publicUrl ?? null;
        }
      }
      const { error } = await fromTable('incidents').insert({
        project_id: projectId,
        date: form.date,
        type: form.type,
        location: form.location,
        description: form.description,
        severity: form.severity,
        injured_party_name: form.injured_party_name,
        root_cause: form.root_cause || null,
        photos: photoUrl ? [photoUrl] : null,
      } as never);
      if (error) throw error;

      if (form.ca_description.trim()) {
        await fromTable('corrective_actions').insert({
          project_id: projectId,
          description: form.ca_description,
          assigned_to: form.ca_assignee || null,
          due_date: form.ca_due_date || null,
          status: 'open',
        } as never);
      }
      onSubmitSuccess();
      handleClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to save incident');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: `${spacing['2']} ${spacing['3']}`,
    border: hasError ? `1px solid ${colors.statusCritical}` : `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.base,
    fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
    color: colors.textPrimary, outline: 'none',
  });

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Report Incident"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{ backgroundColor: '#fff', borderRadius: borderRadius.lg, padding: spacing['6'], width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['5'] }}>
          <h2 style={{ margin: 0, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Report Incident</h2>
          <button onClick={handleClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: colors.textSecondary, lineHeight: 1, padding: 4, minHeight: '56px', minWidth: '56px' }}>&times;</button>
        </div>

        {/* Date */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Date<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <input ref={dateRef} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} onBlur={(e) => handleFieldBlur('date', e.target.value)} style={inputStyle(!!fieldErrors.date)} />
          {fieldErrors.date && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.date}</p>}
        </div>

        {/* Incident Type */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Incident Type<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} onBlur={(e) => setFieldErrors((p) => ({ ...p, type: e.target.value ? '' : 'Incident type is required' }))} style={{ ...inputStyle(!!fieldErrors.type), backgroundColor: '#fff' }}>
            <option value="">Select type...</option>
            <option value="near_miss">Near Miss</option>
            <option value="injury">Injury</option>
            <option value="property_damage">Property Damage</option>
            <option value="environmental">Environmental</option>
          </select>
          {fieldErrors.type && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.type}</p>}
        </div>

        {/* Location */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Location<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <input ref={locationRef} type="text" placeholder="e.g. Level 3 stairwell" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} onBlur={(e) => handleFieldBlur('location', e.target.value)} style={inputStyle(!!fieldErrors.location)} />
          {fieldErrors.location && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.location}</p>}
        </div>

        {/* Severity */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Severity<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <select ref={severityRef} value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))} onBlur={(e) => handleFieldBlur('severity', e.target.value)} style={{ ...inputStyle(!!fieldErrors.severity), backgroundColor: '#fff' }}>
            <option value="">Select severity...</option>
            <option value="first_aid">First Aid</option>
            <option value="medical_treatment">Medical Treatment</option>
            <option value="lost_time">Lost Time</option>
            <option value="fatality">Fatality</option>
          </select>
          {fieldErrors.severity && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.severity}</p>}
        </div>

        {/* Involved Party */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Involved Party<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <input ref={injuredPartyRef} type="text" placeholder="Name or crew" value={form.injured_party_name} onChange={(e) => setForm((p) => ({ ...p, injured_party_name: e.target.value }))} onBlur={(e) => handleFieldBlur('injured_party_name', e.target.value)} style={inputStyle(!!fieldErrors.injured_party_name)} />
          {fieldErrors.injured_party_name && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.injured_party_name}</p>}
        </div>

        {/* Description */}
        <div style={{ marginBottom: spacing['5'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Description<span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span></label>
          <textarea ref={descriptionRef} rows={4} placeholder="Describe what happened" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} onBlur={(e) => handleFieldBlur('description', e.target.value)} style={{ ...inputStyle(!!fieldErrors.description), resize: 'vertical' }} />
          {fieldErrors.description && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.description}</p>}
        </div>

        {/* Root Cause */}
        <div style={{ marginBottom: spacing['4'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
            Root Cause
            <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>(required for recordable incidents)</span>
          </label>
          <textarea rows={3} placeholder="Immediate cause, contributing factors, and root cause analysis" value={form.root_cause} onChange={(e) => setForm((p) => ({ ...p, root_cause: e.target.value }))} style={{ ...inputStyle(false), resize: 'vertical' }} />
        </div>

        {/* Corrective Action */}
        <div style={{ marginBottom: spacing['5'], border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md, padding: spacing['4'], backgroundColor: colors.surfaceInset }}>
          <p style={{ margin: `0 0 ${spacing['3']} 0`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Corrective Action</p>
          <div style={{ marginBottom: spacing['3'] }}>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Description</label>
            <input type="text" placeholder="Action to prevent recurrence" value={form.ca_description} onChange={(e) => setForm((p) => ({ ...p, ca_description: e.target.value }))} style={{ ...inputStyle(false), backgroundColor: '#fff' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Assignee</label>
              <input type="text" placeholder="Name or role" value={form.ca_assignee} onChange={(e) => setForm((p) => ({ ...p, ca_assignee: e.target.value }))} style={{ ...inputStyle(false), backgroundColor: '#fff' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>Due Date</label>
              <input type="date" value={form.ca_due_date} onChange={(e) => setForm((p) => ({ ...p, ca_due_date: e.target.value }))} style={{ ...inputStyle(false), backgroundColor: '#fff' }} />
            </div>
          </div>
        </div>

        {/* Photo Upload */}
        <div style={{ marginBottom: spacing['5'] }}>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary, marginBottom: spacing['1'] }}>
            Photo Documentation
            {isPhotoRequired && <span style={{ color: colors.statusCritical, marginLeft: 2 }}>*</span>}
            {!isPhotoRequired && <span style={{ color: colors.textTertiary, fontSize: typography.fontSize.caption, marginLeft: spacing['2'], fontWeight: typography.fontWeight.normal }}>(required for medical treatment and above)</span>}
          </label>
          {isPhotoRequired && <p style={{ margin: `0 0 ${spacing['2']} 0`, fontSize: typography.fontSize.caption, color: '#E67E22' }}>Photo documentation is required for this severity level per OSHA recordkeeping standards.</p>}
          <input ref={photoRef} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0] ?? null; setForm((p) => ({ ...p, photo: file })); if (file) setFieldErrors((p) => ({ ...p, photo: '' })); }} style={{ ...inputStyle(!!fieldErrors.photo), cursor: 'pointer', backgroundColor: '#fff' }} />
          {form.photo && <p style={{ margin: '4px 0 0', fontSize: typography.fontSize.caption, color: colors.statusActive }}>{form.photo.name} selected</p>}
          {fieldErrors.photo && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.photo}</p>}
        </div>

        {submitError && <p style={{ color: colors.statusCritical, fontSize: 12, margin: '0 0 12px' }}>{submitError}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['3'] }}>
          <Btn variant="ghost" onClick={handleClose} style={{ minHeight: '56px', minWidth: '56px' }}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={submitting} style={{ minHeight: '56px' }}>{submitting ? 'Saving...' : 'Save Incident'}</Btn>
        </div>
      </div>
    </div>
  );
};
