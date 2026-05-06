// ── AdminPageShell ─────────────────────────────────────────────────────────
// Common layout for the IT-pack admin pages. Title + subtitle row, an
// optional right-aligned actions slot, and the page body. Pages drop
// in with consistent spacing without each page reimplementing it.

import React from 'react';
import { colors, spacing, typography } from '../../styles/theme';

interface AdminPageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const AdminPageShell: React.FC<AdminPageShellProps> = ({
  title, subtitle, actions, children,
}) => (
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
