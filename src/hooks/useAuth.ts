import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
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
  error: string | null
}

let state: SharedAuthState = { user: null, session: null, loading: true, error: null }
const listeners = new Set<() => void>()
let initialized = false
let subscriberCount = 0
let authUnsubscribe: (() => void) | null = null
// Stored by the hook so the module-level listener can navigate on session expiry
let navigateFn: ((path: string) => void) | null = null

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
async function initAuth() {
  if (initialized) return
  initialized = true

  if (!import.meta.env.VITE_SUPABASE_URL) {
    setState({ loading: false })
    return
  }

  try {
    const { data: { session: s } } = await supabase.auth.getSession()
    setState({ session: s, user: s?.user ?? null })
    if (s?.user) {
      setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    }
  } finally {
    setState({ loading: false })
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
    if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
      setState({ session: s, user: s?.user ?? null, error: null })
      if (s?.user) setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    } else if (_event === 'SIGNED_OUT') {
      setState({ session: null, user: null, error: null })
      queryClient.clear()
      clearSentryUser()
      navigateFn?.('/login')
    } else if (_event === 'INITIAL_SESSION') {
      setState({ session: s, user: s?.user ?? null, loading: false })
      if (s?.user) setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    } else {
      setState({ session: s, user: s?.user ?? null })
      if (s?.user) setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
    }
  })
  authUnsubscribe = () => subscription.unsubscribe()
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
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  isAuthenticated: boolean
  isSessionValid: boolean
}

export function useAuth(): AuthState {
  const navigate = useNavigate()

  // Start auth initialization on first mount; clean up subscription when last consumer unmounts
  useEffect(() => {
    navigateFn = navigate
    subscriberCount++
    initAuth()
    return () => {
      subscriberCount--
      if (subscriberCount === 0 && authUnsubscribe) {
        authUnsubscribe()
        authUnsubscribe = null
        initialized = false
        navigateFn = null
      }
    }
  }, [navigate])

  // All callers share the same snapshot
  const { user, session, loading, error } = useSyncExternalStore(subscribe, getSnapshot)

  const signIn = useCallback(async (email: string, password: string) => {
    setState({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.session) {
        // Immediately update shared state so ProtectedRoute sees the user
        setState({ session: data.session, user: data.session.user })
      }
      return { error: error ? mapAuthError(error.message) : null }
    } finally {
      setState({ loading: false })
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (authError) return { error: mapAuthError(authError.message) }
    if (data.user) {
      const nameParts = name.trim().split(' ')
      const first_name = nameParts[0] ?? ''
      const last_name = nameParts.slice(1).join(' ') || null
      // Insert profile row into users table (errors here are non-fatal)
      await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)('users').insert({
        id: data.user.id,
        email,
        first_name,
        last_name,
        organization_id: null,
      })
    }
    if (data.session) {
      setState({ session: data.session, user: data.session.user })
    }
    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    clearSentryUser()
    setState({ user: null, session: null, error: null })
    navigate('/login')
  }, [navigate])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error ? mapAuthError(error.message) : null }
  }, [])

  const isAuthenticated = !!session
  const isSessionValid = !!session && !!session.expires_at && session.expires_at > Math.floor(Date.now() / 1000)

  return { user, session, loading, error, signIn, signUp, signOut, resetPassword, isAuthenticated, isSessionValid }
}
