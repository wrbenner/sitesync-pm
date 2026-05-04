// ── Custom Roles Admin ─────────────────────────────────────────────────────
// Define org-wide custom roles with arbitrary subsets of permissions.
// Uses src/lib/customRoles for the merge resolver — admins preview the
// effective set before saving.

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { colors, spacing, typography } from '../../../styles/theme';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../../../components/ConfirmDialog';

interface CustomRoleRow {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  inherits_from: string | null;
  is_active: boolean;
}

interface Props { organizationId: string }

const SAMPLE_PERMISSIONS = [
  'rfis.view', 'rfis.create', 'rfis.respond',
  'submittals.view', 'submittals.approve',
  'change_orders.view', 'change_orders.approve',
  'budget.view', 'budget.edit',
  'reports.view', 'export.data',
  'org.billing', 'org.members',
];

const BUILT_INS = ['owner', 'admin', 'pm', 'viewer', 'foreman', 'sub'];

export const CustomRolesAdminPage: React.FC<Props> = ({ organizationId }) => {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ name: string; description: string; inherits_from: string | null; permissions: string[] }>({
    name: '', description: '', inherits_from: null, permissions: [],
  });

  const { data: roles } = useQuery({
    queryKey: ['org_custom_roles', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('org_custom_roles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });
      return (data as CustomRoleRow[] | null) ?? [];
    },
  });

  const create = async () => {
    if (!draft.name.trim()) { toast.error('Name required'); return; }
    const { error } = await (supabase as any).from('org_custom_roles').insert({
      organization_id: organizationId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      inherits_from: draft.inherits_from,
      permissions: draft.permissions,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success('Custom role created');
    setDraft({ name: '', description: '', inherits_from: null, permissions: [] });
    qc.invalidateQueries({ queryKey: ['org_custom_roles', organizationId] });
  };

  const { confirm: confirmRemove, dialog: removeDialog } = useConfirm();

  const remove = async (id: string) => {
    const ok = await confirmRemove({
      title: 'Delete custom role?',
      description: 'Users assigned to this role lose its permissions immediately. They fall back to their default role until reassigned.',
      destructiveLabel: 'Delete role',
    });
    if (!ok) return;
    await (supabase as any).from('org_custom_roles').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['org_custom_roles', organizationId] });
  };

  const togglePerm = (p: string) => setDraft((d) => ({
    ...d,
    permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : [...d.permissions, p],
  }));

  const previewCount = useMemo(() => draft.permissions.length, [draft.permissions]);

  return (
    <AdminPageShell
      title="Custom Roles"
      subtitle="Define roles with arbitrary subsets of permissions. Built-in roles stay; custom roles supplement them."
    >
      <fieldset style={fieldset}>
        <legend style={legend}>New custom role</legend>
        <input style={input} placeholder="Role name (e.g. Cost Engineer)" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <input style={{ ...input, marginTop: 6 }} placeholder="Description (optional)" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
        <label style={{ display: 'block', marginTop: 8, fontSize: typography.fontSize.label, color: colors.textSecondary }}>
          Inherits from (optional)
        </label>
        <select
          style={{ ...input, marginTop: 4 }}
          value={draft.inherits_from ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, inherits_from: e.target.value || null }))}
        >
          <option value="">None</option>
          {BUILT_INS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <div style={{ marginTop: 10, fontSize: typography.fontSize.label, color: colors.textSecondary }}>
          Permissions ({previewCount})
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {SAMPLE_PERMISSIONS.map((p) => {
            const active = draft.permissions.includes(p);
            return (
              <button key={p} onClick={() => togglePerm(p)}
                style={{
                  padding: '4px 10px', borderRadius: 999,
                  border: `1px solid ${active ? colors.primaryOrange : colors.border}`,
                  background: active ? 'rgba(244,120,32,0.08)' : 'transparent',
                  color: active ? colors.primaryOrange : colors.textSecondary,
                  cursor: 'pointer', fontFamily: 'monospace', fontSize: typography.fontSize.label,
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button onClick={create} style={{ ...primaryBtn, marginTop: spacing['3'] }}>
          <Plus size={12} /> Create role
        </button>
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Existing custom roles</legend>
        {(roles?.length ?? 0) === 0 ? <p style={empty}>None yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                <th style={th}>Name</th><th style={th}>Inherits</th><th style={th}>Perms</th><th style={th}>Active</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {roles!.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.inherits_from ?? '—'}</td>
                  <td style={td}>{r.permissions.length}</td>
                  <td style={td}>{r.is_active ? <span style={{ color: colors.statusActive }}>active</span> : <span style={{ color: colors.textTertiary }}>off</span>}</td>
                  <td style={td}><button onClick={() => remove(r.id)} style={ghostBtn}><Trash2 size={11} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
      {removeDialog}
    </AdminPageShell>
  );
};

const fieldset: React.CSSProperties = { marginBottom: spacing['3'], padding: spacing['3'], background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8 };
const legend: React.CSSProperties = { padding: '0 6px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textPrimary };
const input: React.CSSProperties = { width: '100%', padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: typography.fontSize.sm };
const empty: React.CSSProperties = { color: colors.textSecondary, fontStyle: 'italic', fontSize: typography.fontSize.sm };
const th: React.CSSProperties = { padding: '6px 4px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '6px 4px' };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', borderRadius: 6, background: colors.primaryOrange, color: 'white', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${colors.border}`, borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: typography.fontSize.label, color: colors.textSecondary };

export default CustomRolesAdminPage;
