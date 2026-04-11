import React, { useState, useEffect } from 'react'
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
  <div role="alert" style={{
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

// Dev bypass requires ALL conditions to be explicitly true.
function isDevBypassActive(): boolean {
  if (import.meta.env.PROD !== false) return false
  if (import.meta.env.DEV !== true) return false
  if (import.meta.env.VITE_DEV_BYPASS !== 'true') return false
  if (import.meta.env.VITE_SUPABASE_URL) return false
  if (import.meta.env.VITE_SUPABASE_ANON_KEY) return false
  console.warn('Auth bypass active — do not use in production')
  return true
}

const SkeletonLoader: React.FC<{ ariaLabel: string }> = ({ ariaLabel }) => {
  const mql = window.matchMedia('(max-width: 767px)')
  const [isMobile, setIsMobile] = useState(() => mql.matches)

  useEffect(() => {
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
  <div role="status" aria-busy="true" aria-label={ariaLabel} style={{
    display: 'flex', height: '100vh', fontFamily: typography.fontFamily,
  }}>
    {/* Sidebar skeleton */}
    {!isMobile && <div style={{
      width: 220, backgroundColor: colors.surfaceSidebar, flexShrink: 0,
      padding: spacing['4'],
    }} />}
    {/* Content area skeleton */}
    <div style={{
      flex: 1, backgroundColor: colors.surfacePage, padding: spacing['6'],
      display: 'flex', flexDirection: 'column', gap: spacing['3'],
    }}>
      <div style={{
        height: 20, borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceInset, width: '40%',
      }} />
      <div style={{
        height: 20, borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceInset, width: '60%',
      }} />
      <div style={{
        height: 20, borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceInset, width: '50%',
      }} />
    </div>
  </div>
  )
}

interface RequestAccessPageProps {
  moduleName?: string
}

const RequestAccessPage: React.FC<RequestAccessPageProps> = ({ moduleName }) => (
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
      {moduleName
        ? `You do not have permission to access ${moduleName}.`
        : 'You do not have permission to access this page.'}
    </p>
    <button
      onClick={() => {/* TODO: wire up request access flow */}}
      style={{
        backgroundColor: colors.brand400, color: colors.white,
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

const ProtectedRoute: React.FC<Props> = ({ children, requiredPermission, moduleId, moduleName }) => {
  const { user, loading: authLoading } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const location = useLocation()

  // Auth timeout: if auth/permissions loading takes >8 seconds, stop waiting.
  // This prevents the entire app from being stuck in skeleton state when
  // Supabase is misconfigured or network is down.
  const [authTimedOut, setAuthTimedOut] = useState(false)
  useEffect(() => {
    if (!authLoading && !permissionsLoading) return
    const timer = setTimeout(() => setAuthTimedOut(true), 8000)
    return () => clearTimeout(timer)
  }, [authLoading, permissionsLoading])

  const isLoading = (authLoading || permissionsLoading) && !authTimedOut

  if (isLoading && !isDevBypassActive()) {
    return (
      <div aria-live="polite">
        <SkeletonLoader ariaLabel="Verifying access" />
      </div>
    )
  }

  // If auth timed out and we still have no user, show an error with retry
  if (authTimedOut && !user && !isDevBypassActive()) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', textAlign: 'center', padding: spacing['6'],
      }}>
        <h2 style={{
          fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold,
          color: colors.textPrimary, margin: 0, marginBottom: spacing['2'],
        }}>
          Connection Issue
        </h2>
        <p style={{
          fontSize: typography.fontSize.body, color: colors.textSecondary,
          margin: 0, marginBottom: spacing['5'], maxWidth: 400,
        }}>
          Unable to verify your session. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
            minHeight: 56, backgroundColor: colors.primaryOrange, color: colors.white,
            border: 'none', borderRadius: borderRadius.md,
            padding: `${spacing['2']} ${spacing['5']}`,
            fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
            cursor: 'pointer', fontFamily: typography.fontFamily,
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!isDevBypassActive() && !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  const requiredPerm = requiredPermission ?? MODULE_PERMISSIONS[moduleId ?? '']

  if (requiredPerm && !hasPermission(requiredPerm)) {
    return <RequestAccessPage moduleName={moduleName} />
  }

  return (
    <>
      {isDevBypassActive() && <DevBanner />}
      {children}
    </>
  )
}

export { ProtectedRoute }
export default ProtectedRoute
