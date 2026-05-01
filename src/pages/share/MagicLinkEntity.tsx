// ── MagicLinkEntity ────────────────────────────────────────────────────────
// The page non-app-users land on after clicking a share link. Validates
// the JWT against the entity-magic-link edge function, then renders the
// EntityAuditViewer in read-only / comment-only mode.
//
// URL shape: /share/<entity_type>/<entity_id>?t=<jwt>
// Routing: caller mounts at "/share/:entity_type/:entity_id" via react-router.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Mail, Shield, Clock } from 'lucide-react';
import { colors, spacing, typography } from '../../styles/theme';
import { EntityAuditViewer, type AuditEntityType } from '../../components/audit/EntityAuditViewer';

interface ValidationResult {
  ok: boolean;
  scope: 'view' | 'comment' | null;
  project_id: string | null;
  expires_at: string | null;
  error: string | null;
}

const FUNCTION_BASE =
  (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_URL) ||
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  '';

export const MagicLinkEntity: React.FC = () => {
  const params = useParams<{ entity_type: string; entity_id: string }>();
  const [search] = useSearchParams();
  const token = search.get('t') ?? '';
  const entityType = params.entity_type ?? '';
  const entityId = params.entity_id ?? '';

  const [validation, setValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token || !entityType || !entityId) {
      setValidation({ ok: false, scope: null, project_id: null, expires_at: null, error: 'Missing token or entity reference.' });
      return;
    }
    (async () => {
      const url =
        `${FUNCTION_BASE}/functions/v1/entity-magic-link` +
        `?token=${encodeURIComponent(token)}` +
        `&entity_type=${encodeURIComponent(entityType)}` +
        `&entity_id=${encodeURIComponent(entityId)}`;
      try {
        const res = await fetch(url);
        if (cancelled) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setValidation({
            ok: false, scope: null, project_id: null, expires_at: null,
            error: (err?.error?.message as string) ?? `HTTP ${res.status}`,
          });
          return;
        }
        const data = await res.json();
        setValidation({
          ok: !!data.ok,
          scope: (data.scope as 'view' | 'comment' | null) ?? null,
          project_id: (data.project_id as string | null) ?? null,
          expires_at: (data.expires_at as string | null) ?? null,
          error: null,
        });
      } catch (err) {
        if (!cancelled) {
          setValidation({
            ok: false, scope: null, project_id: null, expires_at: null,
            error: (err as Error).message,
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, entityType, entityId]);

  if (!validation) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <Shield size={32} color={colors.statusNeutral} />
          <h2 style={{ marginTop: spacing['2'] }}>Verifying link…</h2>
        </div>
      </div>
    );
  }

  if (!validation.ok) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <Shield size={32} color={colors.statusCritical} />
          <h2 style={{ marginTop: spacing['2'] }}>Link not valid</h2>
          <p style={{ color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
            {validation.error ??
              'This share link has expired or been revoked. Ask the sender for a fresh link.'}
          </p>
          {validation.error?.toLowerCase().includes('expired') && (
            <a
              href={`mailto:?subject=Please%20resend%20the%20${entityType}%20link`}
              style={primaryLinkStyle}
            >
              <Mail size={12} /> Request a fresh link
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color={colors.statusActive} />
          <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
            Read-only share — {validation.scope === 'comment' ? 'comments allowed' : 'view only'}
          </span>
        </div>
        {validation.expires_at && (
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: typography.fontSize.label,
              color: colors.textSecondary,
            }}
          >
            <Clock size={11} />
            Link expires {new Date(validation.expires_at).toLocaleString()}
          </span>
        )}
      </header>

      <main style={{ maxWidth: 980, margin: '0 auto', padding: spacing['4'] }}>
        {/* The viewer reads via Supabase anon role; the magic-link-token row
            is the source of truth for authorization. RLS on the entity tables
            should permit anon SELECTs only when a corresponding token exists.
            Until that policy lands, we render a minimal info banner. */}
        <p
          style={{
            margin: 0, marginBottom: spacing['3'],
            padding: spacing['2'],
            background: colors.statusPendingSubtle,
            color: colors.statusPending,
            borderRadius: 6,
            fontSize: typography.fontSize.sm,
          }}
        >
          You're viewing this {entityType.replace('_', ' ')} via a shared link.
          Your access is limited to this single record. Sealed PDFs you receive
          are immutable — they cannot be edited after issuance.
        </p>

        {validation.project_id && (
          <EntityAuditViewer
            entityType={entityType as AuditEntityType}
            entityId={entityId}
            projectId={validation.project_id}
            hideShare
          />
        )}
      </main>
    </div>
  );
};

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: colors.surfacePage,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  borderBottom: `1px solid ${colors.border}`,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: '120px auto',
  padding: spacing['4'],
  background: colors.surfaceRaised,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  textAlign: 'center',
};

const primaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 16px',
  marginTop: 12,
  background: colors.primaryOrange,
  color: 'white',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: typography.fontSize.sm,
  fontWeight: typography.fontWeight.semibold,
};

export default MagicLinkEntity;
