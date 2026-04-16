import React, { useState, useCallback } from 'react';
import { Btn, Tag } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { X, Send, UserPlus, Building2, Mail, Briefcase } from 'lucide-react';
import { createProjectInvitation } from '../../api/endpoints/subInvitations';
import { useProjectId } from '../../hooks/useProjectId';
import { toast } from 'sonner';
import type { ProjectRole } from '../../types/tenant';

interface InviteSubModalProps {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

const ROLE_OPTIONS: Array<{ value: ProjectRole; label: string; description: string }> = [
  { value: 'subcontractor', label: 'Subcontractor', description: 'View plans, create RFIs, submit pay apps' },
  { value: 'architect', label: 'Architect', description: 'Review submittals, respond to RFIs' },
  { value: 'owner_rep', label: 'Owner Rep', description: 'Read only access to project progress' },
  { value: 'viewer', label: 'Viewer', description: 'Read only access to documents' },
];

const InviteSubModal: React.FC<InviteSubModalProps> = ({ open, onClose, onInvited }) => {
  const projectId = useProjectId();
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState<ProjectRole>('subcontractor');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !email.trim() || !companyName.trim()) return;

    setLoading(true);
    try {
      await createProjectInvitation({
        projectId,
        email: email.trim(),
        companyName: companyName.trim(),
        role,
      });

      toast.success(`Invitation sent to ${email}`);
      setEmail('');
      setCompanyName('');
      setRole('subcontractor');
      onInvited?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  }, [projectId, email, companyName, role, onClose, onInvited]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite team member"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        maxWidth: 480, width: '100%', margin: spacing['4'],
        backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.xl,
        boxShadow: shadows.lg, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing['4']} ${spacing['5']}`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
            <UserPlus size={20} color={colors.primary} />
            <h2 style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Invite Team Member
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: spacing['2'],
            color: colors.textTertiary, borderRadius: borderRadius.md, minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Email */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['2'] }}>
              <Mail size={14} /> Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              autoFocus
              style={{
                width: '100%', padding: `${spacing['3']} ${spacing['4']}`,
                border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                color: colors.textPrimary, backgroundColor: colors.surfaceBase,
                outline: 'none', minHeight: 56, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Company */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['2'] }}>
              <Building2 size={14} /> Company name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Valley Electric Inc"
              required
              style={{
                width: '100%', padding: `${spacing['3']} ${spacing['4']}`,
                border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.md,
                fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
                color: colors.textPrimary, backgroundColor: colors.surfaceBase,
                outline: 'none', minHeight: 56, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Role */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary, marginBottom: spacing['2'] }}>
              <Briefcase size={14} /> Role
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: `${spacing['3']} ${spacing['4']}`,
                    border: `2px solid ${role === opt.value ? colors.primary : colors.borderSubtle}`,
                    borderRadius: borderRadius.md, cursor: 'pointer',
                    backgroundColor: role === opt.value ? colors.orangeSubtle : colors.surfaceBase,
                    textAlign: 'left', minHeight: 56, transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
                      {opt.description}
                    </div>
                  </div>
                  {role === opt.value && <Tag>Selected</Tag>}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Btn
            variant="primary"
            type="submit"
            disabled={loading || !email.trim() || !companyName.trim()}
            icon={<Send size={16} />}
            style={{ width: '100%', minHeight: 56, fontSize: typography.fontSize.body }}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Btn>

          <p style={{ margin: 0, fontSize: typography.fontSize.xs, color: colors.textTertiary, textAlign: 'center' }}>
            They will receive an email with a link to join this project. Free access, no subscription required.
          </p>
        </form>
      </div>
    </div>
  );
};

export default InviteSubModal;
