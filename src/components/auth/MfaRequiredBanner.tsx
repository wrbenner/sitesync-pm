import React from 'react'
import { Shield, ChevronRight, X, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMfa } from '../../hooks/useMfa'
import { useAuthStore } from '../../stores/authStore'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'

// ── MFA-required banner ─────────────────────────────────────
//
// Forces MFA enrollment for privileged roles (owner / admin /
// project_manager / company_admin). Two tiers driven by the
// profile.mfa_grace_period_until column (added in
// supabase/migrations/20260426000004_mfa_grace_period.sql):
//
//   * Within grace (mfa_grace_period_until > now):
//       Dismissible warning ("Enable MFA before {date}").
//   * Past grace (or NULL):
//       Non-dismissible critical-style banner. ProtectedRoute also
//       redirects the user to /profile until they enroll, so they
//       can't navigate away.
//
// Sidesteps:
//   * Never renders if MFA is already enrolled.
//   * Never renders for viewer / subcontractor / field_user roles.
//   * Within-grace banner self-dismisses per-tab via sessionStorage.

const PRIVILEGED_ROLES = new Set(['owner', 'admin', 'project_manager', 'company_admin'])
const DISMISS_KEY = 'sitesync.mfa-banner-dismissed'

interface MfaRequiredState {
  isPrivileged: boolean
  hasMfa: boolean
  isPastGrace: boolean
  graceUntil: Date | null
}

/**
 * Pure helper for ProtectedRoute and the banner — same role/grace
 * logic in one place so they always agree.
 */
export function evaluateMfaRequirement(
  role: string | undefined | null,
  hasMfa: boolean,
  graceUntilIso: string | null | undefined,
): MfaRequiredState {
  const isPrivileged = PRIVILEGED_ROLES.has(role ?? '')
  const graceUntil = graceUntilIso ? new Date(graceUntilIso) : null
  const isPastGrace = !graceUntil || graceUntil.getTime() <= Date.now()
  return { isPrivileged, hasMfa, isPastGrace, graceUntil }
}

export const MfaRequiredBanner: React.FC = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { verifiedFactors, loading } = useMfa()
  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  })

  const role = (profile?.role as string | undefined) ?? ''
  const graceUntilIso = (profile as { mfa_grace_period_until?: string | null } | null)
    ?.mfa_grace_period_until ?? null
  const { isPrivileged, isPastGrace } = evaluateMfaRequirement(
    role,
    verifiedFactors.length > 0,
    graceUntilIso,
  )
  const hasMfa = verifiedFactors.length > 0

  if (loading) return null
  if (!isPrivileged) return null
  if (hasMfa) return null
  // Within-grace + dismissed → hide for the rest of this tab session.
  // Past-grace → never hide.
  if (!isPastGrace && dismissed) return null

  const handleEnroll = () => {
    navigate('/profile')
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sessionStorage unavailable */
    }
  }

  // Past-grace banner uses critical styling and locks copy.
  const headlineColor = isPastGrace ? colors.statusCritical : colors.statusPending
  const bgGradient = isPastGrace
    ? `linear-gradient(90deg, ${colors.statusCritical}15 0%, ${colors.statusCritical}25 100%)`
    : `linear-gradient(90deg, ${colors.statusPending}10 0%, ${colors.primaryOrange}10 100%)`
  const borderColor = isPastGrace ? `${colors.statusCritical}50` : `${colors.statusPending}40`

  const headline = isPastGrace
    ? 'Two-factor authentication required'
    : 'Two-factor authentication recommended'
  const detail = isPastGrace
    ? 'Your role requires a second authentication factor. Enable it now to keep using SiteSync.'
    : 'Your role has access to sensitive project data. Add a second factor so a leaked password can’t access this account.'
  const Icon = isPastGrace ? Lock : Shield

  return (
    <div
      role="alert"
      aria-live={isPastGrace ? 'assertive' : 'polite'}
      style={{
        background: bgGradient,
        borderBottom: `1px solid ${borderColor}`,
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
          background: `${headlineColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={headlineColor} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {headline}
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, marginTop: 2 }}>
          {detail}
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
          background: isPastGrace ? colors.statusCritical : colors.primaryOrange,
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

      {/* Dismiss button hidden once past grace — banner is mandatory. */}
      {!isPastGrace && (
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
      )}
    </div>
  )
}
