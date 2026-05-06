// ── SSO Setup Page ─────────────────────────────────────────────────────────
// IT director / org admin pastes IdP metadata, picks attribute mappings,
// runs in test mode against a single user, then enables org-wide.

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { colors, spacing, typography } from '../../../styles/theme';
import {
  validateSsoUrl,
  countX509Pems,
  type SsoConfig,
} from '../../../lib/sso';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Save } from 'lucide-react';

interface SsoConfigRow extends SsoConfig {
  id: string;
  organization_id: string;
  protocol: 'saml' | 'oidc';
  enabled: boolean;
  saml_idp_entity_id: string | null;
  saml_sso_url: string | null;
  saml_x509_certs: string | null;
  saml_sp_entity_id: string | null;
  oidc_issuer: string | null;
  oidc_client_id: string | null;
  oidc_authorization_endpoint: string | null;
  oidc_token_endpoint: string | null;
  oidc_userinfo_endpoint: string | null;
  oidc_jwks_uri: string | null;
}

interface SsoAdminProps {
  organizationId: string;
}

export const SsoAdminPage: React.FC<SsoAdminProps> = ({ organizationId }) => {
  const qc = useQueryClient();

  const { data: cfg } = useQuery({
    queryKey: ['org_sso_config', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('org_sso_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      return data as SsoConfigRow | null;
    },
  });

  const [draft, setDraft] = useState<Partial<SsoConfigRow>>({});
  useEffect(() => { if (cfg) setDraft(cfg); }, [cfg]);

  const protocol = draft.protocol ?? 'saml';
  const samlUrlCheck = draft.saml_sso_url
    ? validateSsoUrl(draft.saml_sso_url)
    : { ok: true as const };
  const certCount = draft.saml_x509_certs ? countX509Pems(draft.saml_x509_certs) : 0;

  const save = async () => {
    const payload = { ...draft, organization_id: organizationId };
    const { error } = await (supabase as any)
      .from('org_sso_config')
      .upsert(payload, { onConflict: 'organization_id' });
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success('SSO config saved');
    qc.invalidateQueries({ queryKey: ['org_sso_config', organizationId] });
  };

  return (
    <AdminPageShell
      title="Single Sign-On (SAML / OIDC)"
      subtitle="Configure SAML 2.0 or OIDC against your IdP. Test mode lets a single user verify before org-wide enable."
      actions={
        <button onClick={save} style={primaryBtn}>
          <Save size={12} /> Save
        </button>
      }
    >
      <fieldset style={fieldset}>
        <legend style={legend}>Protocol</legend>
        <label style={radioRow}>
          <input
            type="radio"
            checked={protocol === 'saml'}
            onChange={() => setDraft((d) => ({ ...d, protocol: 'saml' }))}
          />
          <span>SAML 2.0</span>
        </label>
        <label style={radioRow}>
          <input
            type="radio"
            checked={protocol === 'oidc'}
            onChange={() => setDraft((d) => ({ ...d, protocol: 'oidc' }))}
          />
          <span>OIDC</span>
        </label>
      </fieldset>

      {protocol === 'saml' ? (
        <fieldset style={fieldset}>
          <legend style={legend}>SAML</legend>
          <Field label="IdP Entity ID (Issuer)">
            <input style={input} value={draft.saml_idp_entity_id ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, saml_idp_entity_id: e.target.value }))} />
          </Field>
          <Field label="SSO URL" error={!samlUrlCheck.ok ? (samlUrlCheck as any).reason : undefined}>
            <input style={input} value={draft.saml_sso_url ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, saml_sso_url: e.target.value }))} />
          </Field>
          <Field label="SP Entity ID (Audience)">
            <input style={input} value={draft.saml_sp_entity_id ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, saml_sp_entity_id: e.target.value }))} />
          </Field>
          <Field label={`X.509 Certificate(s) — ${certCount} PEM block(s) detected`}
            hint="Paste one or more cert blocks (multiple blocks = rotation overlap)">
            <textarea
              style={{ ...input, minHeight: 120, fontFamily: 'monospace', fontSize: 11 }}
              value={draft.saml_x509_certs ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, saml_x509_certs: e.target.value }))}
            />
          </Field>
        </fieldset>
      ) : (
        <fieldset style={fieldset}>
          <legend style={legend}>OIDC</legend>
          <Field label="Issuer">
            <input style={input} value={draft.oidc_issuer ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, oidc_issuer: e.target.value }))} />
          </Field>
          <Field label="Client ID">
            <input style={input} value={draft.oidc_client_id ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, oidc_client_id: e.target.value }))} />
          </Field>
          <Field label="Authorization endpoint"><input style={input} value={draft.oidc_authorization_endpoint ?? ''} onChange={(e) => setDraft((d) => ({ ...d, oidc_authorization_endpoint: e.target.value }))} /></Field>
          <Field label="Token endpoint"><input style={input} value={draft.oidc_token_endpoint ?? ''} onChange={(e) => setDraft((d) => ({ ...d, oidc_token_endpoint: e.target.value }))} /></Field>
          <Field label="JWKS URI"><input style={input} value={draft.oidc_jwks_uri ?? ''} onChange={(e) => setDraft((d) => ({ ...d, oidc_jwks_uri: e.target.value }))} /></Field>
        </fieldset>
      )}

      <fieldset style={fieldset}>
        <legend style={legend}>Attribute mapping</legend>
        <p style={{ margin: 0, marginBottom: spacing['2'], fontSize: typography.fontSize.label, color: colors.textSecondary }}>
          IdP claim/attribute names that map to SiteSync user fields. Edit the JSON below.
        </p>
        <textarea
          style={{ ...input, minHeight: 120, fontFamily: 'monospace', fontSize: 11 }}
          value={JSON.stringify(draft.attribute_mapping ?? { email: 'EMAIL', first_name: 'FIRSTNAME', last_name: 'LASTNAME', groups: 'MEMBEROF' }, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraft((d) => ({ ...d, attribute_mapping: parsed }));
            } catch { /* ignore until valid */ }
          }}
        />
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Group → role mapping</legend>
        <textarea
          style={{ ...input, minHeight: 100, fontFamily: 'monospace', fontSize: 11 }}
          value={JSON.stringify(draft.group_role_mapping ?? { 'GC-PMs': 'pm', 'GC-Owners': 'owner' }, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setDraft((d) => ({ ...d, group_role_mapping: parsed }));
            } catch { /* ignore */ }
          }}
        />
        <Field label="Default role (used when no group matches)">
          <input style={input} value={draft.default_role ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, default_role: e.target.value || null as any }))} />
        </Field>
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Test mode</legend>
        <label style={radioRow}>
          <input type="checkbox" checked={!!draft.test_mode_enabled}
            onChange={(e) => setDraft((d) => ({ ...d, test_mode_enabled: e.target.checked }))} />
          <span>Restrict SSO to test_user_emails only</span>
        </label>
        <Field label="Test user emails (comma-separated)">
          <input style={input}
            value={(draft.test_user_emails ?? []).join(', ')}
            onChange={(e) => setDraft((d) => ({ ...d, test_user_emails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
          />
        </Field>
        <label style={radioRow}>
          <input type="checkbox" checked={!!draft.allow_jit_provision}
            onChange={(e) => setDraft((d) => ({ ...d, allow_jit_provision: e.target.checked }))} />
          <span>Auto-provision new users on first login (JIT)</span>
        </label>
      </fieldset>

      <fieldset style={fieldset}>
        <legend style={legend}>Status</legend>
        {cfg?.enabled ? (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.statusActive }}>
            <CheckCircle2 size={14} /> SSO is enabled for this organization.
          </p>
        ) : (
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.statusPending }}>
            <AlertTriangle size={14} /> SSO is configured but not enabled — test first, then flip the switch below.
          </p>
        )}
        <label style={radioRow}>
          <input type="checkbox" checked={!!draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} />
          <span>Enable SSO for this organization</span>
        </label>
      </fieldset>
    </AdminPageShell>
  );
};

const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <label style={{ display: 'block', marginBottom: spacing['2'] }}>
    <div style={{ fontSize: typography.fontSize.label, color: colors.textSecondary, marginBottom: 4 }}>
      {label}
    </div>
    {children}
    {hint && <div style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, marginTop: 2 }}>{hint}</div>}
    {error && <div style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, marginTop: 2 }}>{error}</div>}
  </label>
);

const fieldset: React.CSSProperties = {
  marginBottom: spacing['3'],
  padding: spacing['3'],
  background: colors.surfaceRaised,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
};
const legend: React.CSSProperties = {
  padding: '0 6px',
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textPrimary,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  fontSize: typography.fontSize.sm,
};
const radioRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: typography.fontSize.sm,
  marginBottom: 6,
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 14px', border: 'none', borderRadius: 6,
  background: colors.primaryOrange, color: 'white',
  fontWeight: typography.fontWeight.semibold,
  fontSize: typography.fontSize.sm, cursor: 'pointer',
};

export default SsoAdminPage;
