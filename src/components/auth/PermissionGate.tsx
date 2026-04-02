import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission, ProjectRole } from '../../hooks/usePermissions';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Lock, ShieldAlert } from 'lucide-react';

// ── PermissionGate: conditionally render children based on permission ──

interface PermissionGateProps {
  /** Required permission key */
  permission?: Permission;
  /** Alternative: require any of these permissions */
  anyOf?: Permission[];
  /** Alternative: require minimum role level */
  minRole?: ProjectRole;
  /** What to render if permission is denied (default: null/hidden) */
  fallback?: React.ReactNode;
  /** If true, shows a "no access" message instead of hiding */
  showDenied?: boolean;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission, anyOf, minRole, fallback = null, showDenied = false, children,
}) => {
  const { hasPermission, hasAnyPermission, isAtLeast, loading } = usePermissions();

  // Never render children while permissions are loading — prevents unauthorized content flash
  if (loading) {
    if (!showDenied) return null;
    return (
      <div style={{
        width: '100%',
        height: '32px',
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.md,
        opacity: 0.5,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    );
  }

  let allowed = true;
  if (permission) allowed = hasPermission(permission);
  else if (anyOf) allowed = hasAnyPermission(anyOf);
  else if (minRole) allowed = isAtLeast(minRole);

  if (allowed) return <>{children}</>;

  if (showDenied) return <PermissionDenied />;
  return <>{fallback}</>;
};

// ── PermissionDenied: inline message for gated content ────────

const PermissionDenied: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing['2'],
    padding: `${spacing['2']} ${spacing['3']}`,
    backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.borderSubtle}`,
  }}>
    <Lock size={14} color={colors.textTertiary} />
    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
      You do not have permission to access this feature
    </span>
  </div>
);

// ── RequestAccessPage: full page shown when module access is denied ──

export const RequestAccessPage: React.FC<{ moduleName?: string }> = ({ moduleName }) => {
  const { role } = usePermissions();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', padding: spacing['6'],
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing['4'],
      }}>
        <ShieldAlert size={28} color={colors.textTertiary} />
      </div>
      <h2 style={{
        fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary, margin: 0, marginBottom: spacing['2'],
      }}>
        Access Restricted
      </h2>
      <p style={{
        fontSize: typography.fontSize.body, color: colors.textSecondary,
        margin: 0, marginBottom: spacing['4'], maxWidth: 400, lineHeight: typography.lineHeight.relaxed,
      }}>
        {moduleName
          ? `You don't have permission to access ${moduleName}. Your current role is "${role || 'none'}".`
          : `You don't have the required permissions to view this page.`
        }
      </p>
      <p style={{
        fontSize: typography.fontSize.sm, color: colors.textTertiary,
        margin: 0, maxWidth: 400,
      }}>
        Contact your project administrator to request access.
      </p>
    </div>
  );
};

// ── ProtectedModule: wraps an entire page with module-level permission check ──

interface ProtectedModuleProps {
  moduleId: string;
  moduleName: string;
  children: React.ReactNode;
}

export const ProtectedModule: React.FC<ProtectedModuleProps> = ({ moduleId, moduleName, children }) => {
  const { canAccessModule, loading } = usePermissions();

  if (loading) return null;
  if (!canAccessModule(moduleId)) return <RequestAccessPage moduleName={moduleName} />;

  return <>{children}</>;
};
