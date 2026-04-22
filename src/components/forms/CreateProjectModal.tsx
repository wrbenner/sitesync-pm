import React, { useState } from 'react';
import { X, MapPin, HardHat, Calendar, Building2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions, zIndex } from '../../styles/theme';
import { Btn } from '../Primitives';
import { useProjectContext } from '../../stores/projectContextStore';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROJECT_TYPES = [
  { value: 'commercial_office', label: 'Commercial Office' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'data_center', label: 'Data Center' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'government', label: 'Government' },
  { value: 'infrastructure', label: 'Infrastructure' },
] as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${spacing['2']} ${spacing['3']}`,
  fontSize: typography.fontSize.body,
  fontFamily: typography.fontFamily,
  backgroundColor: colors.surfaceInset,
  border: `1px solid ${colors.borderSubtle}`,
  borderRadius: borderRadius.base,
  color: colors.textPrimary,
  outline: 'none',
  transition: `border-color ${transitions.instant}`,
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing['1.5'],
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.medium,
  color: colors.textSecondary,
  marginBottom: spacing['1'],
};

export const CreateProjectModal: React.FC<Props> = ({ open, onClose }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const createProject = useProjectContext((s) => s.createProject);
  const queryClient = useQueryClient();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setSaving(true);
    setError('');

    const payload: Parameters<typeof createProject>[0] = {
      name: name.trim(),
      company_id: currentOrg?.id ?? '',
      created_by: user?.id ?? '',
      address: address.trim() || undefined,
      project_type: projectType || undefined,
      start_date: startDate || undefined,
    };

    const result = await createProject(payload);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Refresh the React Query projects cache so everything is in sync
    await queryClient.invalidateQueries({ queryKey: ['projects'] });

    setSaving(false);
    setName('');
    setAddress('');
    setProjectType('');
    setStartDate('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create new project"
      style={{
        position: 'fixed', inset: 0, zIndex: zIndex.modal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: spacing['4'],
      }}
    >
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlayScrim }}
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
            <div style={{
              width: 32, height: 32, borderRadius: borderRadius.base,
              background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HardHat size={16} color={colors.white} />
            </div>
            <h2 style={{
              margin: 0, fontSize: typography.fontSize.subtitle,
              fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
            }}>
              New Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.overlayBlackLight, border: 'none',
              borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textSecondary,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing['4']} ${spacing['5']}`, display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Name — required */}
          <div>
            <label style={labelStyle}>
              <Building2 size={14} />
              Project Name *
            </label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown Office Tower"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
            />
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>
              <MapPin size={14} />
              Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
            />
          </div>

          {/* Type + Start Date side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <div>
              <label style={labelStyle}>
                <HardHat size={14} />
                Type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
              >
                <option value="">Select type</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                <Calendar size={14} />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
              />
            </div>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.statusRejected }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: spacing['2'],
          padding: `${spacing['3']} ${spacing['5']}`,
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}>
          <Btn variant="ghost" onClick={onClose} type="button">
            Cancel
          </Btn>
          <Btn variant="primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create Project'}
          </Btn>
        </div>
      </form>
    </div>
  );
};

export default CreateProjectModal;
