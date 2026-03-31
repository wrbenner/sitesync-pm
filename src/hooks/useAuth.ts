import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { setSentryUser, clearSentryUser } from '../lib/sentry'

// ── Shared auth state (module-level singleton) ──────────────
// All callers of useAuth() share this exact state.
// When signIn updates it, every ProtectedRoute, AppContent, etc. re-renders.

interface SharedAuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

let state: SharedAuthState = { user: null, session: null, loading: true }
const listeners = new Set<() => void>()
let initialized = false

function setState(partial: Partial<SharedAuthState>) {
  state = { ...state, ...partial }
  listeners.forEach(fn => fn())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getSnapshot(): SharedAuthState {
  return state
}

// Initialize once: fetch session + listen for changes
function initAuth() {
  if (initialized) return
  initialized = true

  if (!import.meta.env.VITE_SUPABASE_URL) {
    setState({ loading: false })
    return
  }

  supabase.auth.getSession().then(({ data: { session: s } }) => {
    setState({ session: s, user: s?.user ?? null, loading: false })
    if (s?.user) {
      setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    }
  })

  supabase.auth.onAuthStateChange((_event, s) => {
    setState({ session: s, user: s?.user ?? null })
    if (_event === 'SIGNED_OUT') {
      queryClient.clear()
      clearSentryUser()
    } else if (s?.user) {
      setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    }
  })
}

// ── Error mapping ───────────────────────────────────────────

function mapAuthError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login') || msg.includes('invalid_credentials')) return 'Email or password is incorrect'
  if (msg.includes('email not confirmed')) return 'Please check your email to confirm your account'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Too many attempts. Please try again in a few minutes'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed')) return 'Unable to connect. Check your internet connection'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'An account with this email already exists'
  if (msg.includes('password') && msg.includes('short')) return 'Password must be at least 6 characters'
  return message
}

// ── Public hook ─────────────────────────────────────────────

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  isSessionValid: boolean
}

export function useAuth(): AuthState {
  // Start auth initialization on first mount
  useEffect(() => { initAuth() }, [])

  // All callers share the same snapshot
  const { user, session, loading } = useSyncExternalStore(subscribe, getSnapshot)

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.session) {
      // Immediately update shared state so ProtectedRoute sees the user
      setState({ session: data.session, user: data.session.user })
    }
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (!error && data.session) {
      setState({ session: data.session, user: data.session.user })
    }
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    setState({ user: null, session: null })
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const isSessionValid = !!session && !!session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)

  return { user, session, loading, signIn, signUp, signOut, resetPassword, isSessionValid }
}
