// ── Branding Admin ─────────────────────────────────────────────────────────
// Per-org brand surface for emails, magic-link pages, and sealed PDFs.
// Logo URL, primary/secondary color, support contacts, sender identity.

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminPageShell } from '../../../components/admin/AdminPageShell';
import { colors, spacing, typography } from '../../../styles/theme';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface BrandingRow {
  organization_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  support_email: string | null;
  support_url: string | null;
  legal_name: string | null;
  privacy_url: string | null;
  terms_url: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  custom_domain: string | null;
}

interface Props { organizationId: string }

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export const BrandingAdminPage: React.FC<Props> = ({ organizationId }) => {
  const qc = useQueryClient();
  const { data: row } = useQuery({
    queryKey: ['org_branding', organizationId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('org_branding')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      return (data as BrandingRow | null);
    },
  });

  const [draft, setDraft] = useState<Partial<BrandingRow>>({});
  useEffect(() => { if (row) setDraft(row); }, [row]);

  const errs: Partial<Record<keyof BrandingRow, string>> = {};
  if (draft.primary_color && !HEX_RE.test(draft.primary_color)) errs.primary_color = 'Use #RRGGBB';
  if (draft.secondary_color && !HEX_RE.test(draft.secondary_color)) errs.secondary_color = 'Use #RRGGBB';

  const save = async () => {
    if (Object.keys(errs).length > 0) { toast.error('Fix the highlighted fields'); return; }
    const payload = { ...draft, organization_id: organizationId };
    const { error } = await (supabase as any).from('org_branding').upsert(payload, { onConflict: 'organization_id' });
    if (error) { toast.error(error.message); return; }
    toast.success('Branding saved');
    qc.invalidateQueries({ queryKey: ['org_branding', organizationId] });
  };

  return (
    <AdminPageShell
      title="Branding"
      subtitle="Logo, colors, sender identity. Used in emails, magic-link pages, and sealed PDF exports."
      actions={<button onClick={save} style={primaryBtn}><Save size={12} /> Save</button>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing['3'] }}>
        <fieldset style={fieldset}>
          <legend style={legend}>Logo &amp; favicon</legend>
          <Field label="Logo URL"><input style={input} value={draft.logo_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, logo_url: e.target.value || null }))} /></Field>
          <Field label="Favicon URL"><input style={input} value={draft.favicon_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, favicon_url: e.target.value || null }))} /></Field>
          {draft.logo_url && (
            <img src={draft.logo_url} alt="Logo preview" style={{ maxHeight: 64, marginTop: 8, border: `1px solid ${colors.border}`, padding: 4, borderRadius: 4 }} />
          )}
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>Colors</legend>
          <Field label="Primary (#RRGGBB)" error={errs.primary_color}><input style={input} value={draft.primary_color ?? ''} onChange={(e) => setDraft((d) => ({ ...d, primary_color: e.target.value || null }))} /></Field>
          <Field label="Secondary (#RRGGBB)" error={errs.secondary_color}><input style={input} value={draft.secondary_color ?? ''} onChange={(e) => setDraft((d) => ({ ...d, secondary_color: e.target.value || null }))} /></Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {draft.primary_color && HEX_RE.test(draft.primary_color) && <Swatch color={draft.primary_color} />}
            {draft.secondary_color && HEX_RE.test(draft.secondary_color) && <Swatch color={draft.secondary_color} />}
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>Support &amp; legal</legend>
          <Field label="Support email"><input style={input} value={draft.support_email ?? ''} onChange={(e) => setDraft((d) => ({ ...d, support_email: e.target.value || null }))} /></Field>
          <Field label="Support URL"><input style={input} value={draft.support_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, support_url: e.target.value || null }))} /></Field>
          <Field label="Legal name (PDF footer)"><input style={input} value={draft.legal_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, legal_name: e.target.value || null }))} /></Field>
          <Field label="Privacy URL"><input style={input} value={draft.privacy_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, privacy_url: e.target.value || null }))} /></Field>
          <Field label="Terms URL"><input style={input} value={draft.terms_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, terms_url: e.target.value || null }))} /></Field>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>Sender identity</legend>
          <Field label="Email From name"><input style={input} value={draft.email_from_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, email_from_name: e.target.value || null }))} /></Field>
          <Field label="Email From address"
            hint="Subject to domain verification with the email provider.">
            <input style={input} value={draft.email_from_address ?? ''} onChange={(e) => setDraft((d) => ({ ...d, email_from_address: e.target.value || null }))} />
          </Field>
          <Field label="Custom domain (magic-link share)"
            hint="Leave blank to use the platform domain.">
            <input style={input} value={draft.custom_domain ?? ''} onChange={(e) => setDraft((d) => ({ ...d, custom_domain: e.target.value || null }))} />
          </Field>
        </fieldset>
      </div>
    </AdminPageShell>
  );
};

const Field: React.FC<{ label: string; hint?: string; error?: string; children: React.ReactNode }> = ({ label, hint, error, children }) => (
  <label style={{ display: 'block', marginBottom: spacing['2'] }}>
    <div style={{ fontSize: typography.fontSize.label, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, marginTop: 2 }}>{hint}</div>}
    {error && <div style={{ fontSize: typography.fontSize.label, color: colors.statusCritical, marginTop: 2 }}>{error}</div>}
  </label>
);

const Swatch: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ width: 32, height: 32, borderRadius: 6, background: color, border: `1px solid ${colors.border}` }} title={color} />
);

const fieldset: React.CSSProperties = { padding: spacing['3'], background: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8 };
const legend: React.CSSProperties = { padding: '0 6px', fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.4, color: colors.textPrimary };
const input: React.CSSProperties = { width: '100%', padding: '6px 10px', border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: typography.fontSize.sm };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 14px', border: 'none', borderRadius: 6, background: colors.primaryOrange, color: 'white', fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, cursor: 'pointer' };

export default BrandingAdminPage;
