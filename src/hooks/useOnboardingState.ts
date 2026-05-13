// src/hooks/useOnboardingState.ts — BRT sub-3 §4.1
//
// Resumable wizard state backed by profiles.onboarding_step.
// 0 = not started, 1-5 = current step, 6 = completed.
//
// The hook returns:
//   - step: the current step (1-5) or null if completed/not-started
//   - setStep(n): persist the new step number
//   - markCompleted(): set to 6 (terminal)
//
// Writes are fire-and-forget (best-effort persistence). If the user
// reloads mid-wizard, they land on the persisted step. If the network
// fails, the in-memory wizard still advances.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export interface OnboardingState {
  step: number
  setStep: (n: number) => void
  markCompleted: () => void
  isCompleted: boolean
}

export function useOnboardingState(): OnboardingState {
  const user = useAuthStore((s) => s.user)
  const userId = user?.id ?? null
  const [step, setLocalStep] = useState<number>(1)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!userId) return
      // Cast to `never` because the generated database types lag the
      // 20261019010000 migration that adds profiles.onboarding_step.
      // The same as-never pattern is used across the codebase for
      // post-migration columns awaiting the next types regen.
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_step' as never)
        .eq('user_id', userId)
        .single()
      if (cancelled) return
      const row = data as { onboarding_step?: unknown } | null
      const persisted = row?.onboarding_step
      if (!error && typeof persisted === 'number') {
        setLocalStep(persisted === 0 ? 1 : persisted)
      }
      setLoaded(true)
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  const persist = useCallback(async (n: number) => {
    if (!userId) return
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_step: n } as never)
      .eq('user_id', userId)
    if (error && import.meta.env.DEV) {
      console.warn('[useOnboardingState] persist failed (non-fatal):', error.message)
    }
  }, [userId])

  const setStep = useCallback((n: number) => {
    setLocalStep(n)
    void persist(n)
  }, [persist])

  const markCompleted = useCallback(() => {
    setLocalStep(6)
    void persist(6)
  }, [persist])

  return {
    step: loaded ? step : 1,
    setStep,
    markCompleted,
    isCompleted: step >= 6,
  }
}
