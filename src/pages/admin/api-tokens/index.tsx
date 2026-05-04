// ── API Tokens Admin Page ──────────────────────────────────────────────────
// Org admin mints long-lived tokens with scoped permissions, lists active
// tokens, revokes any token, sees usage stats. The minted secret is shown
// ONCE in a banner immediately after creation; the admin must copy it
// then. After that only the prefix is visible.

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { mintToken, maskToken } from '../../../lib/apiTokens';
import { colors, spacing, typography } from '../../../styles/theme';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, AlertCircle } from 'lucide-react';
import { useConfirm } from '../../../components/ConfirmDialog';

interface TokenRow {
  id: string;
  name: string;
  description: string | null;
  prefix: string;
  scopes: string[];
  project_ids: string[] | null;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  use_count: number;
  revoked_at: string | null;
}

interface Props { organizationId: string }

const COMMON_SCOPES = [
  'rfis.view', 'rfis.create',
  'submittals.view', 'submittals.create',
  'change_orders.view', 'change_orders.create',
  'punch_list.view', 'punch_list.create',
  'daily_log.view', 'daily_log.create',
  'reports.view', 'export.data',
  'scim.manage', '*',
];

export const ApiTokensAdminPage: React.FC<Props> = ({ organizationId }) => {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['rfis.view']);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  const { data: tokens } = useQuery({
    queryKey: ['org_api_tokens', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('org_api_tokens')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      return (data as unknown as TokenRow[] | null) ?? [];
    },
  });

  const create = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    const minted = await mintToken();
    const { error } = await (supabase as any).from('org_api_tokens').insert({
      organization_id: organizationId,
      name: name.trim(),
      prefix: minted.prefix,
      token_hash: minted.hash,
      scopes,
    } as never);
    if (error) { toast.error(error.message); return; }
    setRevealedToken(minted.token);
    setName('');
    qc.invalidateQueries({ queryKey: ['org_api_tokens', organizationId] });
  };

  const { confirm: confirmRevoke, dialog: revokeDialog } = useConfirm();

  const revoke = async (id: string) => {
    const ok = await confirmRevoke({
      title: 'Revoke API token?',
      description: 'Any external system or integration using this token will stop working immediately. The token cannot be reactivated.',
      destructiveLabel: 'Revoke token',
    });
    if (!ok) return;
    const { error } = await (supabase as any)
      .from('org_api_tokens')
      .update({ revoked_at: new Date().toISOString(), revoked_reason: 'admin_revoked' } as never)
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Token revoked');
    qc.invalidateQueries({ queryKey: ['org_api_tokens', organizationId] });
  };

  return (
    <AdminPageShell
      title="API Tokens"
      subtitle="Long-lived tokens for outbound integrations. Each token's scopes constrain what it can do."
    >
      {revealedToken && (
        <div
          role="alert"
          style={{
            padding: spacing['3'],
            marginBottom: spacing['3'],
            background: colors.statusPendingSubtle,
            border: `1px solid ${colors.statusPending}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>
            <AlertCircle size={14} /> Copy this token now — you won't see it again.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <code style={{ flex: 1, padding: '6px 10px', background: 'white', border: `1px solid ${colors.border}`, borderRadius: 6, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
              {revealedToken}
            </code>
            <button onClick={() => { navigator.clipboard?.writeText(revealedToken); toast.success('Copied'); }} style={ghostBtn}>
              <Copy size={11} /> Copy
            </button>
            <button onClick={() => setRevealedToken(null)} style={ghostBtn}>Dismiss</button>
          </div>
        </div>
      )}

      <fieldset style={fieldset}>
        <legend style={legend}>Mint a new token</legend>
        <input
          placeholder="Token name (e.g. Snowflake export, Webhook receiver)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />
        <div style={{ marginTop: spacing['2'] }}>
          <div style={{ fontSize: typography.fontSize.label, color: colors.textSecondary, marginBottom: 6 }}>
            Scopes
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COMMON_SCOPES.map((s) => {
              const active = scopes.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setScopes((cur) => active ? cur.filter((x) => x !== s) : [...cur, s])}
                  style={{
                    padding: '4px 10px',
                    border: `1px solid ${active ? colors.primaryOrange : colors.border}`,
                    borderRadius: 999,
                    background: active ? 'rgba(244,120,32,0.08)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: typography.fontSize.label,
                    fontFamily: 'monospace',
                    color: active ? colors.primaryOrange : colors.textSecondary,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={create} style={{ ...primaryBtn, marginTop: spacing['3'] }}>
          <Plus size={12} /> Mint token
        </button>
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Active tokens</legend>
        {(tokens?.length ?? 0) === 0 ? (
          <p style={empty}>No tokens minted yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                <th style={th}>Name</th>
                <th style={th}>Prefix</th>
                <th style={th}>Scopes</th>
                <th style={th}>Last used</th>
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {tokens!.map((t) => (
                <tr key={t.id} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <td style={td}>{t.name}</td>
                  <td style={td}><code>{maskToken(t.prefix)}</code></td>
                  <td style={td}>{t.scopes.slice(0, 3).join(', ')}{t.scopes.length > 3 ? ` +${t.scopes.length - 3}` : ''}</td>
                  <td style={td}>{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : '—'}</td>
                  <td style={td}>{t.revoked_at ? <span style={{ color: colors.statusCritical }}>revoked</span> : <span style={{ color: colors.statusActive }}>active</span>}</td>
                  <td style={td}>
                    {!t.revoked_at && (
                      <button onClick={() => revoke(t.id)} style={ghostBtn} aria-label="Revoke">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </fieldset>
      {revokeDialog}
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

export default ApiTokensAdminPage;
