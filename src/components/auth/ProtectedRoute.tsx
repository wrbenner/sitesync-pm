import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePermissions } from '../../hooks/usePermissions'
import type { Permission } from '../../hooks/usePermissions'
import { colors, spacing, typography, zIndex, borderRadius } from '../../styles/theme'
import { MODULE_PERMISSIONS } from '../../hooks/usePermissions'
import { ShieldAlert } from 'lucide-react'

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
      <div role="status" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: typography.fontSize.body, color: colors.textSecondary,
        fontFamily: typography.fontFamily,
      }}>
        Verifying access...
      </div>
    )
  }

  // No user or expired session → redirect to login with return path
  if (!user || !isSessionValid) {
    const dest = location.pathname + location.search
    const returnTo = dest !== '/login' ? `?returnTo=${encodeURIComponent(dest)}` : ''
    return <Navigate to={`/login${returnTo}`} replace />
  }

  // Permission check (only after auth confirmed and permissions loaded)
  if (!permLoading) {
    const denied =
      (requiredPermission && !hasPermission(requiredPermission)) ||
      (moduleId && !canAccessModule(moduleId))

    if (denied) {
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
            margin: 0, marginBottom: spacing['5'], maxWidth: 400, lineHeight: typography.lineHeight.relaxed,
          }}>
            You do not have permission to access this page.
          </p>
          <button
            onClick={() => {/* TODO: wire up request access flow */}}
            style={{
              backgroundColor: colors.brand, color: colors.white,
              border: 'none', borderRadius: borderRadius.md,
              padding: `${spacing['2']} ${spacing['5']}`,
              fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
              cursor: 'pointer', fontFamily: typography.fontFamily,
            }}
          >
            Request Access
          </button>
        </div>
      )
    }
  }

  return <>{children}</>
}
