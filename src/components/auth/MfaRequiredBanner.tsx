import React from 'react'
import { Shield, ChevronRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMfa } from '../../hooks/useMfa'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

// ── MFA-required banner ─────────────────────────────────────
//
// Soft-force MFA enrollment for privileged roles (owner / admin /
// project_manager). Renders a dismissible banner across the top of the
// app shell when the user matches and has no verified TOTP factor.
//
// Soft-force tier:
//   * Days 0-7  → dismissible warning ("Enable MFA before {date}")
//   * Days 8+   → non-dismissible block ("MFA required to continue")
//
// Phase 1 ships the warning tier only — the hard block lives behind a
// follow-up that adds a per-user mfa_grace_period_until timestamp on
// profiles. Until then everyone gets the dismissible warning.
//
// Sidesteps:
//   * Banner never renders if MFA is already enrolled.
//   * Banner never renders for viewer / subcontractor / field_user roles.
//   * Banner self-dismisses via sessionStorage so it doesn't nag inside
//     a single tab session, but reappears on refresh.

const PRIVILEGED_ROLES = new Set(['owner', 'admin', 'project_manager', 'company_admin'])
const DISMISS_KEY = 'sitesync.mfa-banner-dismissed'

export const MfaRequiredBanner: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { verifiedFactors, loading } = useMfa()
  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })

  // Roles can come from either profile.role or the org-membership role —
  // we check both via the auth store's normalized profile.role.
  const role = (profile?.role as string | undefined) ?? ''
  const isPrivileged = PRIVILEGED_ROLES.has(role)
  const hasMfa = verifiedFactors.length > 0

  if (loading) return null
  if (!isPrivileged) return null
  if (hasMfa) return null
  if (dismissed) return null

  const handleEnroll = () => {
    navigate('/profile')
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // sessionStorage unavailable — banner reappears next render, fine
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        background: `linear-gradient(90deg, ${colors.statusPending}10 0%, ${colors.primaryOrange}10 100%)`,
        borderBottom: `1px solid ${colors.statusPending}40`,
        padding: `${spacing['2.5']} ${spacing['4']}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        fontFamily: typography.fontFamily,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: borderRadius.sm,
          background: `${colors.statusPending}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Shield size={16} color={colors.statusPending} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          Two-factor authentication recommended
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
          Your role has access to sensitive project data. Add a second factor so a leaked password can&apos;t access this account.
        </div>
      </div>

      <button
        type="button"
        onClick={handleEnroll}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: `${spacing['1.5']} ${spacing['3']}`,
          borderRadius: borderRadius.md,
          border: 'none',
          background: colors.primaryOrange,
          color: '#fff',
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Enable now
        <ChevronRight size={14} />
      </button>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 4,
          color: colors.textTertiary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
