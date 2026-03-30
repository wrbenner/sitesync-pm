import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Skeleton } from '../Primitives'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

interface Props {
  children: React.ReactNode
}

const DevBanner: React.FC = () => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
    backgroundColor: colors.statusPending, color: 'white',
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

export const ProtectedRoute: React.FC<Props> = ({ children }) => {
  const { user, loading, isSessionValid } = useAuth()
  const location = useLocation()

  // Dev bypass: explicit opt-in only, with prominent warning banner
  if (isDevBypassActive()) {
    return (
      <>
        <DevBanner />
        <div style={{ marginTop: '28px' }}>{children}</div>
      </>
    )
  }

  if (loading) {
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

  return <>{children}</>
}
