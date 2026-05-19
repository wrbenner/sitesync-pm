// ── AdminPageShell ─────────────────────────────────────────────────────────
// Common layout for the IT-pack admin pages. Title + subtitle row, an
// optional right-aligned actions slot, and the page body. Pages drop
// in with consistent spacing without each page reimplementing it.
//
// Bugatti Sev-1 (cat 6 PermissionGate): the 8 admin pages
// (api-tokens, audit-posture, branding, compliance, custom-roles, sso,
// webhooks, workflows) all use this shell. Gating the shell with
// minRole="admin" closes 8 individual Sev-1 unguarded-page findings in
// one edit. The opt-out prop is for the future case where a single
// non-admin admin-style page needs the layout without the gate (none
// today; default behavior is "gated").

import React from 'react';
import { PermissionGate } from '../auth/PermissionGate';
import { RequestAccessPage } from '../auth/PermissionGate';
import { colors, spacing, typography } from '../../styles/theme';

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Set false to render without the admin role gate (default true). */
  requireAdmin?: boolean;
}

export const AdminPageShell: React.FC<AdminPageShellProps> = ({
  title, subtitle, actions, children, requireAdmin = true,
}) => {
  const body = (
    <AdminPageShellBody title={title} subtitle={subtitle} actions={actions}>
      {children}
    </AdminPageShellBody>
  );
  if (!requireAdmin) return body;
  return (
    <PermissionGate minRole="admin" fallback={<RequestAccessPage moduleName={title} />}>
      {body}
    </PermissionGate>
  );
};

const AdminPageShellBody: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, children }) => (
  <div
    style={{
      maxWidth: 1080,
      margin: '0 auto',
      padding: `${spacing['4']} ${spacing['4']}`,
    }}
  >
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: spacing['3'],
        paddingBottom: spacing['2'],
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: 0,
              marginTop: 4,
              fontSize: typography.fontSize.sm,
              color: colors.textSecondary,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </header>
    {children}
  </div>
);

export default AdminPageShell;
