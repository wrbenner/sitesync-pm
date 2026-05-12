// src/hooks/useOnboardingState.ts — BRT sub-3 §4.1
//
// Reads + advances the user's onboarding step. Persists via profiles.onboarding_step.
// Returns:
//   step: 0..5
//   advance(toStep): write the new step (server-truth)
//   complete(): set step=5 and onboarded_at=now()

import { useCallback, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

export interface OnboardingState {
  step: number
  loading: boolean
  advance: (toStep: number) => Promise<void>
  complete: () => Promise<void>
}

export function useOnboardingState(): OnboardingState {
  const { user, profile, loadProfile } = useAuthStore()
  // Source of truth: server. Local state derived from profile to avoid
  // setState-in-effect cascades. The wizard re-renders when profile updates,
  // which is the desired refresh trigger.
  const step = (profile as { onboarding_step?: number } | null)?.onboarding_step ?? 0
  const [loading, setLoading] = useState(false)

  const advance = useCallback(async (toStep: number) => {
    if (!user) return
    if (toStep < 0 || toStep > 5) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      // Cast: database.ts will regenerate to include onboarding_step after
      // the next db-types:write run; until then the typed payload doesn't
      // know the new column.
      .update({ onboarding_step: toStep } as never)
      .eq('user_id', user.id)
    if (error) {
      console.error('[onboarding] advance failed:', error)
      setLoading(false)
      return
    }
    await loadProfile()
    setLoading(false)
  }, [user, loadProfile])

  const complete = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_step: 5, onboarded_at: new Date().toISOString() } as never)
      .eq('user_id', user.id)
    if (error) {
      console.error('[onboarding] complete failed:', error)
      setLoading(false)
      return
    }
    await loadProfile()
    setLoading(false)
  }, [user, loadProfile])

  return { step, loading, advance, complete }
}
