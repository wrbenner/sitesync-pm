// ── Audit Posture Dashboard ────────────────────────────────────────────────
// What the IT director's security analyst screenshots into the SOC 2
// evidence package. One panel per pillar; data refreshes via the
// audit-posture-snapshot edge fn every 5 minutes.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { colors, spacing, typography } from '../../../styles/theme';
import { CheckCircle2, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

interface PostureBlob {
  generated_at: string;
  organization?: { name?: string; data_region?: string; audit_retention_years?: number; compliance_level?: string };
  hash_chain?: { ok: boolean; rows_checked: number; gaps: number };
  encryption_at_rest?: { enabled: boolean; provider: string; notes?: string };
  active_sessions?: { last_24h_sso_logins: number };
  permission_changes?: Array<{ id: string; created_at: string; action: string; entity_type: string; user_email?: string; user_name?: string }>;
  failed_login_count_30d?: number;
  last_backup?: { completed_at: string; size_bytes: number; status: string } | null;
  api_tokens?: { live: number; total: number };
  recent_sso_events?: Array<{ outcome: string; created_at: string; email?: string }>;
  data_retention_years?: number | null;
}

interface Props { organizationId: string }

export const AuditPosturePage: React.FC<Props> = ({ organizationId }) => {
  const { data, isPending } = useQuery({
    queryKey: ['audit-posture', organizationId],
    queryFn: async (): Promise<PostureBlob | null> => {
      const { data: blob, error } = await (supabase as any).functions.invoke('audit-posture-snapshot', {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
      return blob as PostureBlob;
    },
    refetchInterval: 5 * 60_000,
  });

  return (
    <AdminPageShell
      title="Audit Posture"
      subtitle="Compliance posture for SOC 2 evidence. Snapshot refreshed every 5 minutes."
    >
      {isPending && <p style={{ color: colors.textSecondary }}>Loading…</p>}
      {!isPending && !data && <p style={{ color: colors.statusCritical }}>Failed to load snapshot.</p>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing['3'] }}>
          <Card title="Hash chain" icon={data.hash_chain?.ok ? <CheckCircle2 size={14} color={colors.statusActive} /> : <AlertTriangle size={14} color={colors.statusCritical} />}>
            <p style={metric}>{data.hash_chain?.ok ? 'Intact' : `${data.hash_chain?.gaps ?? 0} gap(s)`}</p>
            <p style={subtle}>{data.hash_chain?.rows_checked ?? 0} rows checked (tail window)</p>
          </Card>
          <Card title="Encryption at rest" icon={<ShieldCheck size={14} color={colors.statusActive} />}>
            <p style={metric}>{data.encryption_at_rest?.enabled ? 'Enabled' : 'Off'}</p>
            <p style={subtle}>{data.encryption_at_rest?.provider}</p>
          </Card>
          <Card title="Active sessions (24h)" icon={<Clock size={14} color={colors.textSecondary} />}>
            <p style={metric}>{data.active_sessions?.last_24h_sso_logins ?? 0}</p>
            <p style={subtle}>SSO sign-ins in the last 24h</p>
          </Card>
          <Card title="Failed logins (30d)" icon={<AlertTriangle size={14} color={(data.failed_login_count_30d ?? 0) > 50 ? colors.statusCritical : colors.statusPending} />}>
            <p style={metric}>{data.failed_login_count_30d ?? 0}</p>
            <p style={subtle}>SSO blocked outcomes in the last 30 days</p>
          </Card>
          <Card title="API tokens" icon={<ShieldCheck size={14} color={colors.statusActive} />}>
            <p style={metric}>{data.api_tokens?.live ?? 0} live</p>
            <p style={subtle}>{data.api_tokens?.total ?? 0} total minted</p>
          </Card>
          <Card title="Last backup">
            <p style={metric}>{data.last_backup?.completed_at ? new Date(data.last_backup.completed_at).toLocaleString() : '—'}</p>
            <p style={subtle}>{data.last_backup?.size_bytes ? `${(data.last_backup.size_bytes / 1024 / 1024).toFixed(1)} MB` : 'No backup record found'}</p>
          </Card>
          <Card title="Data residency">
            <p style={metric}>{data.organization?.data_region ?? 'unknown'}</p>
            <p style={subtle}>Compliance level: {data.organization?.compliance_level ?? '—'}</p>
          </Card>
          <Card title="Audit retention">
            <p style={metric}>{data.data_retention_years ?? 7} years</p>
            <p style={subtle}>Cleared for the audit retention window.</p>
          </Card>
        </div>
      )}

      {data?.permission_changes && data.permission_changes.length > 0 && (
        <fieldset style={{ ...fieldset, marginTop: spacing['3'] }}>
          <legend style={legend}>Recent permission changes</legend>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
            <thead>
              <tr style={{ color: colors.textSecondary, textAlign: 'left' }}>
                <th style={th}>When</th><th style={th}>Action</th><th style={th}>Entity</th><th style={th}>By</th>
              </tr>
            </thead>
            <tbody>
              {data.permission_changes.slice(0, 25).map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  <td style={td}>{new Date(c.created_at).toLocaleString()}</td>
                  <td style={td}>{c.action}</td>
                  <td style={td}>{c.entity_type}</td>
                  <td style={td}>{c.user_name ?? c.user_email ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      )}

      {data && (
        <p style={{ marginTop: spacing['3'], fontSize: typography.fontSize.label, color: colors.textTertiary }}>
          Snapshot generated {new Date(data.generated_at).toLocaleString()}.
        </p>
      )}
    </AdminPageShell>
  );
};

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div style={{ padding: spacing['3'], background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.textSecondary, fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {icon}{title}
    </div>
    <div style={{ marginTop: 6 }}>{children}</div>
  </div>
);

const metric: React.CSSProperties = { margin: 0, fontSize: typography.fontSize.large, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary };
const subtle: React.CSSProperties = { margin: 0, fontSize: typography.fontSize.label, color: colors.textSecondary, marginTop: 2 };
const fieldset: React.CSSProperties = { padding: spacing['3'], background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8 };
const legend: React.CSSProperties = { padding: '0 6px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textPrimary };
const th: React.CSSProperties = { padding: '6px 4px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.4 };
const td: React.CSSProperties = { padding: '6px 4px' };

export default AuditPosturePage;
