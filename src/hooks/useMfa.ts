import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ───────────────────────────────────────────────────

export interface MfaFactor {
  id: string
  friendlyName: string | null
  factorType: 'totp' | 'phone'
  status: 'verified' | 'unverified'
  createdAt: string
}

export interface MfaState {
  /** TOTP factors that have been verified and are active for sign-in. */
  verifiedFactors: MfaFactor[]
  /** Authenticator Assurance Level: 'aal1' = password only, 'aal2' = passed MFA. */
  currentAAL: 'aal1' | 'aal2' | null
  /** What the *next* AAL would be after MFA challenge — i.e. is MFA available? */
  nextAAL: 'aal1' | 'aal2' | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// ── Hook ───────────────────────────────────────────────────

export function useMfa(): MfaState {
  const [verifiedFactors, setVerifiedFactors] = useState<MfaFactor[]>([])
  const [currentAAL, setCurrentAAL] = useState<MfaState['currentAAL']>(null)
  const [nextAAL, setNextAAL] = useState<MfaState['nextAAL']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [factorsRes, aalRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ])

      if (factorsRes.error) throw factorsRes.error
      if (aalRes.error) throw aalRes.error

      const all = (factorsRes.data?.totp ?? []).concat(factorsRes.data?.phone ?? [])
      setVerifiedFactors(
        all
          .filter((f) => f.status === 'verified')
          .map((f) => ({
            id: f.id,
            friendlyName: f.friendly_name ?? null,
            factorType: f.factor_type as 'totp' | 'phone',
            status: f.status as 'verified',
            createdAt: f.created_at,
          })),
      )

      setCurrentAAL((aalRes.data?.currentLevel ?? null) as MfaState['currentAAL'])
      setNextAAL((aalRes.data?.nextLevel ?? null) as MfaState['nextAAL'])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MFA state')
    } finally {
      setLoading(false)
    }
  }, [])

  // We refresh on mount. The setState-in-effect rule flags this even
  // though it's the canonical "fetch on mount" pattern; refactoring to
  // TanStack Query is queued as a Phase 2 cleanup. Disabling here with
  // a clear pointer to that work item.
   
  useEffect(() => {
    void refresh()
  }, [refresh])

  return { verifiedFactors, currentAAL, nextAAL, loading, error, refresh }
}
