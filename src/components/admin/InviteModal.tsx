// Phase 7 — InviteModal
// Wraps the send-invite edge function. Supports single + bulk invite,
// per-project scope, role picker, and CSV paste for bulk.

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, UserPlus, Users, AlertCircle, Check, X } from 'lucide-react';
import { Modal, Btn, InputField } from '../Primitives';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries';
import { colors, spacing, typography } from '../../styles/theme';

export type InviteRole = 'admin' | 'pm' | 'editor' | 'viewer';

interface Project {
  id: string;
  name: string;
}

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName?: string;
  /** Called after at least one invite is sent successfully. */
  onInvited?: (count: number) => void;
}

const ROLES: { value: InviteRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Manage org, billing, members' },
  { value: 'pm', label: 'Project Manager', description: 'Manage projects, approve work' },
  { value: 'editor', label: 'Editor', description: 'Create and edit content' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

function parseCsvEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes('@')),
    ),
  );
}

export const InviteModal: React.FC<InviteModalProps> = ({
  open,
  onClose,
  organizationId,
  organizationName,
  onInvited,
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [email, setEmail] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [role, setRole] = useState<InviteRole>('viewer');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [expiresHours, setExpiresHours] = useState<number>(48);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ email: string; status: string; error?: string }> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await fromTable('projects')
          .select('id, name')
          .eq('organization_id' as never, organizationId)
          .order('name');
        if (!cancelled) setProjects((data as unknown as Project[]) ?? []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  const emails = useMemo(
    () => (mode === 'single' ? (email ? [email] : []) : parseCsvEmails(bulkText)),
    [mode, email, bulkText],
  );

  const toggleProject = (id: string) => {
    setSelectedProjects((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const reset = () => {
    setEmail('');
    setBulkText('');
    setSelectedProjects([]);
    setResults(null);
    setRole('viewer');
    setExpiresHours(48);
    setMode('single');
  };

  const handleSubmit = async () => {
    if (emails.length === 0 || submitting) return;
    setSubmitting(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite', {
        body: {
          action: 'invite',
          emails,
          role,
          organization_id: organizationId,
          organization_name: organizationName,
          project_ids: selectedProjects,
          expires_hours: expiresHours,
        },
      });
      if (error) throw error;
      const res = (data?.results ?? []) as Array<{ email: string; status: string; error?: string }>;
      setResults(res);
      const sentCount = res.filter((r) => r.status === 'sent' || r.status === 'queued').length;
      if (sentCount > 0) onInvited?.(sentCount);
    } catch (e) {
      setResults([{ email: emails[0] ?? '', status: 'failed', error: String(e) }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Invite Team Members" width="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <button
            type="button"
            onClick={() => setMode('single')}
            style={{
              flex: 1,
              padding: spacing['3'],
              borderRadius: 8,
              border: `1px solid ${mode === 'single' ? colors.primaryOrange : colors.borderSubtle}`,
              background: mode === 'single' ? colors.orangeSubtle : 'transparent',
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing['2'],
            }}
          >
            <UserPlus size={16} /> Single
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            style={{
              flex: 1,
              padding: spacing['3'],
              borderRadius: 8,
              border: `1px solid ${mode === 'bulk' ? colors.primaryOrange : colors.borderSubtle}`,
              background: mode === 'bulk' ? colors.orangeSubtle : 'transparent',
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing['2'],
            }}
          >
            <Users size={16} /> Bulk (CSV)
          </button>
        </div>

        {mode === 'single' ? (
          <InputField
            label="Email address"
            placeholder="teammate@company.com"
            value={email}
            onChange={setEmail}
            type="email"
            icon={<Mail size={14} />}
          />
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'] }}>
              Paste or type emails (comma, space, or newline separated)
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={5}
              placeholder="alice@co.com, bob@co.com&#10;charlie@co.com"
              style={{
                width: '100%',
                padding: spacing['3'],
                borderRadius: 8,
                border: `1px solid ${colors.borderSubtle}`,
                fontFamily: 'inherit',
                fontSize: typography.fontSize.sm,
                color: colors.textPrimary,
                background: 'transparent',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: spacing['1'] }}>
              {emails.length} valid email{emails.length === 1 ? '' : 's'} detected
            </div>
          </div>
        )}

        {/* Role picker */}
        <div>
          <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'] }}>Role</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['2'] }}>
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                style={{
                  padding: spacing['3'],
                  borderRadius: 8,
                  border: `1px solid ${role === r.value ? colors.primaryOrange : colors.borderSubtle}`,
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary }}>{r.label}</div>
                <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{r.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Project scope */}
        {projects.length > 0 && (
          <div>
            <label style={{ display: 'block', fontSize: typography.fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2'] }}>
              Project access {selectedProjects.length === 0 ? '(all org projects)' : `(${selectedProjects.length} selected)`}
            </label>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: `1px solid ${colors.borderSubtle}`, borderRadius: 8, padding: spacing['2'] }}>
              {projects.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: spacing['2'], cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Expiry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <label style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Expires in</label>
          <select
            value={expiresHours}
            onChange={(e) => setExpiresHours(Number(e.target.value))}
            style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              borderRadius: 6,
              border: `1px solid ${colors.borderSubtle}`,
              fontSize: typography.fontSize.sm,
              background: 'transparent',
              color: colors.textPrimary,
            }}
          >
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
          </select>
        </div>

        {/* Results */}
        {results && (
          <div style={{ padding: spacing['3'], borderRadius: 8, background: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}` }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], fontSize: typography.fontSize.sm, padding: spacing['1'] }}>
                {r.status === 'sent' || r.status === 'queued' ? (
                  <Check size={14} color={colors.statusActive} />
                ) : (
                  <AlertCircle size={14} color={colors.statusCritical} />
                )}
                <span style={{ color: colors.textPrimary }}>{r.email}</span>
                <span style={{ color: colors.textSecondary }}>— {r.status}</span>
                {r.error && <span style={{ color: colors.statusCritical }}>({r.error})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: spacing['3'], justifyContent: 'flex-end', marginTop: spacing['2'] }}>
          <Btn variant="ghost" onClick={() => { reset(); onClose(); }} icon={<X size={14} />}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={handleSubmit}
            disabled={emails.length === 0 || submitting}
            icon={<Mail size={14} />}
          >
            {submitting ? 'Sending…' : `Send ${emails.length || ''} invite${emails.length === 1 ? '' : 's'}`}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

export default InviteModal;
