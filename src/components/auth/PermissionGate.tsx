import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePermissions } from '../../hooks/usePermissions';
import type { Permission, ProjectRole } from '../../hooks/usePermissions';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Lock, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useProjectId } from '../../hooks/useProjectId';

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
        opacity: 0.6,
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
  <div role="alert" aria-live="polite" style={{
    display: 'flex', alignItems: 'center', gap: spacing['2'],
    padding: `${spacing['2']} ${spacing['3']}`,
    backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.borderSubtle}`,
  }}>
    <Lock size={14} color={colors.textTertiary} aria-label="Access denied" />
    <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
      You do not have permission to access this feature
    </span>
  </div>
);

// ── RequestAccessPage: full page shown when module access is denied ──

export const RequestAccessPage: React.FC<{ moduleName?: string }> = ({ moduleName }) => {
  const { role } = usePermissions();
  const navigate = useNavigate();
  const projectId = useProjectId();
  const [requesting, setRequesting] = React.useState(false);

  const submitRequest = React.useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('You must be signed in to request access');
        return;
      }

      // Look up project admins so we know where to send the request.
      let adminEmails: string[] = [];
      if (projectId) {
        const { data } = await supabase
          .from('project_members')
          .select('user:user_id(email)')
          .eq('project_id', projectId)
          .in('role', ['owner', 'admin', 'project_manager']);
        adminEmails = (data ?? [])
          .map((row) => (row as { user?: { email?: string | null } }).user?.email)
          .filter((email): email is string => !!email);
      }

      const subject = `Access request: ${moduleName ?? 'SiteSync module'}`;
      const bodyLines = [
        `User: ${user.email}`,
        `Current role: ${role ?? 'unknown'}`,
        `Requested access: ${moduleName ?? 'unspecified module'}`,
        projectId ? `Project: ${projectId}` : '',
        '',
        'Please grant the appropriate role in Project Settings > Members.',
      ].filter(Boolean);

      const mailto =
        `mailto:${adminEmails.join(',')}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(bodyLines.join('\n'))}`;

      window.location.href = mailto;
      toast.success(
        adminEmails.length > 0
          ? 'Opening email to your project administrator'
          : 'Opening email client. Add your administrator address to send.',
      );
    } catch (err) {
      toast.error('Unable to prepare access request. Please contact your administrator directly.');
      console.error('Access request failed:', err);
    } finally {
      setRequesting(false);
    }
  }, [requesting, projectId, moduleName, role]);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        width: '100%',
        padding: spacing['8'],
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <ShieldAlert size={48} color={colors.textTertiary} />
        <h2 style={{
          fontSize: 20,
          fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary,
          margin: `${spacing['4']} 0 ${spacing['2']}`,
        }}>Access Restricted</h2>
        <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 8 }}>
          You don't have permission to access {moduleName || 'this section'}. Your current role is {role || 'unknown'}.
        </p>
        <button
          onClick={submitRequest}
          disabled={requesting}
          style={{
            backgroundColor: colors.primary,
            color: 'white',
            padding: `${spacing['2']} ${spacing['4']}`,
            borderRadius: borderRadius.md,
            border: 'none',
            cursor: requesting ? 'default' : 'pointer',
            marginTop: spacing['6'],
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            opacity: requesting ? 0.6 : 1,
          }}
        >
          {requesting ? 'Sending...' : 'Request Access'}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'block',
            margin: `${spacing['3']} auto 0`,
            background: 'none',
            border: 'none',
            color: colors.primary,
            fontSize: typography.fontSize.sm,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Go to Dashboard
        </button>
      </div>
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
