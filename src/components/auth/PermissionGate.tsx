import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 480, margin: 'auto', padding: 48, textAlign: 'center' }}>
      <ShieldAlert size={48} color={colors.textTertiary} />
      <h2>Access Restricted</h2>
      <p style={{ color: colors.textSecondary }}>
        You do not have permission to access {moduleName || 'this module'}. Your current role is {role || 'unknown'}.
      </p>
      <button
        onClick={() => navigate(-1)}
        style={{
          backgroundColor: colors.primary,
          color: 'white',
          padding: '10px 24px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Go Back
      </button>
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
