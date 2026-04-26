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
// Stored by the hook so the module-level listener can navigate on session expiry
let navigateFn: ((path: string) => void) | null = null

// ── Idle session timeout ────────────────────────────────────
// Default 30 minutes of no user activity → forced sign-out.
// Activity = pointer / keyboard / touch / focus events bubbling to window.
// Per-org override can be wired in later by reading org settings.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
let lastActivityAt = Date.now()
let idleTimerHandle: ReturnType<typeof setInterval> | null = null
let idleListenersAttached = false

function recordActivity() {
  lastActivityAt = Date.now()
}

function startIdleWatcher() {
  if (idleListenersAttached || typeof window === 'undefined') return
  idleListenersAttached = true

  const events: (keyof WindowEventMap)[] = [
    'mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove', 'focus',
  ]
  events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }))

  // Tick once a minute. Cheap; granular enough that users notice the
  // timeout within ~60s of the actual expiry.
  idleTimerHandle = setInterval(() => {
    if (!state.session || !state.user) return
    if (Date.now() - lastActivityAt < IDLE_TIMEOUT_MS) return
    // Idle threshold reached. Sign out.
    void supabase.auth.signOut()
  }, 60 * 1000)
}

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

  // Start the idle-timeout watcher once at boot. It is a no-op until
  // a session exists.
  startIdleWatcher()

  try {
    const { data: { session: s } } = await supabase.auth.getSession()
    setState({ session: s, user: s?.user ?? null })
    if (s?.user) {
      setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
      recordActivity()
    }
  } finally {
    setState({ loading: false })
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
    if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
      setState({ session: s, user: s?.user ?? null, error: null })
      if (s?.user) {
        setSentryUser(s.user.id, s.user.email ?? '', s.user.user_metadata?.role)
        recordActivity() // reset idle clock on fresh sign-in / refresh
      }
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
  // Subscription lives for the lifetime of the app — no cleanup needed
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

// ── Account lockout helpers ─────────────────────────────────
// 5 failed sign-ins in any 15-minute window → 15-minute cooldown.
// Implemented via SECURITY DEFINER RPCs in supabase/migrations/
// 20260426000003_account_lockout.sql so anonymous callers can hit them
// without RLS exposure.

interface LockoutState {
  isLocked: boolean
  attemptsInWindow: number
  attemptsAllowed: number
  unlocksAt: string | null
}

async function checkLockout(email: string): Promise<LockoutState | null> {
  try {
    const { data, error } = await supabase.rpc('check_login_lockout', {
      email_to_check: email,
    })
    if (error || !data) return null
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      isLocked: Boolean(row.is_locked),
      attemptsInWindow: Number(row.attempts_in_window ?? 0),
      attemptsAllowed: Number(row.attempts_allowed ?? 5),
      unlocksAt: row.unlocks_at ?? null,
    }
  } catch {
    return null // fail-open if the RPC is unavailable
  }
}

async function recordFailedLogin(email: string): Promise<void> {
  try {
    await supabase.rpc('record_failed_login', {
      email_to_record: email,
      ip_hint_text: null,
      user_agent_text: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 256) : null,
    })
  } catch {
    // best-effort; never block sign-in path on a failed record
  }
}

function formatLockoutMessage(state: LockoutState): string {
  if (state.unlocksAt) {
    const minutes = Math.max(1, Math.ceil((Date.parse(state.unlocksAt) - Date.now()) / 60000))
    return `Account temporarily locked due to too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
  }
  return 'Account temporarily locked due to too many failed sign-in attempts. Try again in 15 minutes.'
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

  // Start auth initialization on first mount.
  // Auth state is global — never tear down the subscription just because
  // individual components remount (especially under React 19 strict mode).
  useEffect(() => {
    navigateFn = navigate
    initAuth()
  }, [navigate])

  // All callers share the same snapshot
  const { user, session, loading, error } = useSyncExternalStore(subscribe, getSnapshot)

  const signIn = useCallback(async (email: string, password: string) => {
    setState({ loading: true, error: null })
    try {
      // Pre-check: is this email currently locked out?
      const preLockout = await checkLockout(email)
      if (preLockout?.isLocked) {
        return { error: formatLockoutMessage(preLockout) }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Record the failed attempt; it's fire-and-forget but we await it
        // briefly so the next call observes it.
        await recordFailedLogin(email)

        // Re-check: did this attempt push them over the threshold?
        const postLockout = await checkLockout(email)
        if (postLockout?.isLocked) {
          return { error: formatLockoutMessage(postLockout) }
        }

        const remaining = postLockout
          ? Math.max(0, postLockout.attemptsAllowed - postLockout.attemptsInWindow)
          : null
        const baseMsg = mapAuthError(error.message)
        const suffix = remaining !== null && remaining <= 2
          ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} left before temporary lockout)`
          : ''
        return { error: baseMsg + suffix }
      }

      if (data.session) {
        // Immediately update shared state so ProtectedRoute sees the user
        setState({ session: data.session, user: data.session.user })
      }
      return { error: null }
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
      // Create profile row for the new user
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: name.trim(),
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

  // Enforce session expiry: if we have a user but the session has expired, sign out.
  useEffect(() => {
    if (user && session && !isSessionValid) {
      supabase.auth.signOut()
    }
  }, [user, session, isSessionValid])

  return { user, session, loading, error, signIn, signUp, signOut, resetPassword, isAuthenticated, isSessionValid }
}
