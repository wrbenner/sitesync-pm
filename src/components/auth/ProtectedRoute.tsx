import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import type { Permission } from '../../hooks/usePermissions'
import { Skeleton } from '../Primitives'
import { RequestAccessPage } from './PermissionGate'
import { colors, spacing, typography, zIndex } from '../../styles/theme'
import { MODULE_PERMISSIONS } from '../../hooks/usePermissions'

interface Props {
  children: React.ReactNode
  /** Optional: require a specific permission to access this route */
  requiredPermission?: Permission
  /** Optional: module ID for automatic permission lookup via MODULE_PERMISSIONS */
  moduleId?: string
  /** Optional: human-readable name for the access denied page */
  moduleName?: string
}

const DevBanner: React.FC = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: zIndex.toast,
    backgroundColor: colors.statusPending, color: colors.white,
    padding: `${spacing['1']} ${spacing['4']}`,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
  }}>
    Development Mode — Authentication bypassed (VITE_DEV_BYPASS=true). Connect Supabase for real auth.
  </div>
)

// BUG #1 FIX: Dev bypass requires EXPLICIT opt-in. Matches usePermissions logic.
function isDevBypassActive(): boolean {
  if (!import.meta.env.DEV) return false
  if (import.meta.env.VITE_SUPABASE_URL) return false
  if (import.meta.env.VITE_DEV_BYPASS !== 'true') return false
  return true
}

export const ProtectedRoute: React.FC<Props> = ({ children, requiredPermission, moduleId, moduleName }) => {
  const { user, loading: authLoading, isSessionValid } = useAuth()
  const { hasPermission, canAccessModule, loading: permLoading } = usePermissions()
  const location = useLocation()

  // Dev bypass: explicit opt-in only, with prominent warning banner
  if (isDevBypassActive()) {
    return (
      <>
        <DevBanner />
        <div style={{ marginTop: spacing['7'] }}>{children}</div>
      </>
    )
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Skeleton width="200px" height="24px" />
      </div>
    )
  }

  // No user or expired session → redirect to login with return path
  if (!user || !isSessionValid) {
    const returnTo = location.pathname !== '/login' ? `?returnTo=${encodeURIComponent(location.pathname)}` : ''
    return <Navigate to={`/login${returnTo}`} replace />
  }

  // Permission check (only after auth confirmed and permissions loaded)
  if (!permLoading) {
    // Check explicit permission
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return <RequestAccessPage moduleName={moduleName} />
    }
    // Check module-level permission
    if (moduleId && !canAccessModule(moduleId)) {
      return <RequestAccessPage moduleName={moduleName || moduleId} />
    }
  }

  return <>{children}</>
}
